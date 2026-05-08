import { Injectable } from '@nestjs/common';
import { LLMFactory } from './factory/llm.factory';
import type { LLMProvider } from './interfaces/llm-provider.interface';
import type { InferredSchemaV2 } from './dto/enrichment.dto';
import {
  SCHEMA_INFERENCE_PROMPT,
  SCHEMA_INFERENCE_SCHEMA,
} from './prompts/schema-inference.prompt';
import { createLogger } from 'src/helpers/console-logger.helper';

@Injectable()
export class SchemaInferenceService {
  private llmProvider: LLMProvider | null = null;

  constructor(private llmFactory: LLMFactory) {}

  private readonly logger = createLogger('SchemaInferenceService');

  async inferSchema(
    columns: string[],
    sampleRows: Record<string, unknown>[],
    useLLM: boolean = true,
  ): Promise<InferredSchemaV2> {
    if (!useLLM) {
      throw new Error(
        'Deterministic schema inference has been removed. Use LLM-based inference.',
      );
    }

    try {
      this.logger.info('Starting schema inference v2', {
        columnCount: columns.length,
        rowCount: sampleRows.length,
      });

      const deterministicProfile = this.deterministicColumnProfile(
        columns,
        sampleRows,
      );
      this.logger.info('Deterministic column profiling completed', {
        profiledColumns: deterministicProfile.size,
      });

      let llmResult: InferredSchemaV2 | null = null;

      try {
        this.logger.info('Attempting LLM inference', {
          timeoutMs: 10000,
        });

        llmResult = await Promise.race([
          this.llmInference(columns, sampleRows),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('LLM schema inference timeout')),
              10000,
            ),
          ),
        ]);

        this.logger.info('LLM inference succeeded', {
          columnsInResult: llmResult?.columns?.length,
          fieldsMapped: llmResult ? Object.values(llmResult.fieldMapping).filter(f => f?.column).length : 0,
        });
      } catch (llmError) {
        this.logger.warn(
          'LLM inference failed or timed out, using manual schema inference',
          {
            error: llmError instanceof Error ? llmError.message : String(llmError),
            errorStack: llmError instanceof Error ? llmError.stack : undefined,
            timeout: llmError instanceof Error && llmError.message.includes('timeout'),
          },
        );
      }

      let mergedResult: InferredSchemaV2;

      if (llmResult) {
        mergedResult = this.mergeWithDeterministic(
          deterministicProfile,
          llmResult,
        );
        this.logger.info('Schema inference v2 completed via LLM', {
          columnsAnalyzed: mergedResult.columns.length,
          fieldsMapped: Object.values(mergedResult.fieldMapping).filter(
            (f) => f?.column,
          ).length,
          qualityScore: mergedResult.schemaQuality.completeness,
          needsReview: mergedResult.schemaQuality.needsReview,
        });
      } else {
        mergedResult = this.createManualSchema(
          columns,
          sampleRows,
          deterministicProfile,
        );
        this.logger.info('Schema inference completed via manual inference', {
          columnsAnalyzed: mergedResult.columns.length,
          fieldsMapped: Object.values(mergedResult.fieldMapping).filter(
            (f) => f?.column,
          ).length,
          qualityScore: mergedResult.schemaQuality.completeness,
        });
      }

      return mergedResult;
    } catch (error) {
      this.logger.error('Schema inference v2 failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private deterministicColumnProfile(
    columns: string[],
    sampleRows: Record<string, unknown>[],
  ): Map<
    string,
    {
      type: string;
      isCoordinate: boolean;
      isCurrency: boolean;
      isEmpty: boolean;
    }
  > {
    const profile = new Map();

    for (const col of columns) {
      const values = sampleRows.slice(0, 10).map((row) => row[col]);
      const nonNullValues = values.filter(
        (v) => v !== null && v !== undefined && v !== '',
      );

      const isEmpty = nonNullValues.length === 0;

      let detectedType: string = 'string';
      if (!isEmpty) {
        const numericCount = nonNullValues.filter(
          (v) => typeof v === 'number' || this.isNumericString(v),
        ).length;
        if (numericCount === nonNullValues.length) {
          detectedType = 'number';
        } else if (nonNullValues.every((v) => this.isDateString(v))) {
          detectedType = 'date';
        } else if (nonNullValues.every((v) => typeof v === 'boolean')) {
          detectedType = 'boolean';
        }
      }

      const isCoordinate =
        ((col.toLowerCase().includes('lat') || col.toLowerCase() === 'y') &&
          detectedType === 'number') ||
        ((col.toLowerCase().includes('lng') ||
          col.toLowerCase().includes('lon') ||
          col.toLowerCase() === 'x') &&
          detectedType === 'number');

      const isCurrency =
        col.toLowerCase().includes('currency') ||
        col.toLowerCase().includes('curr') ||
        nonNullValues.some((v) => this.isCurrencyCode(v));

      profile.set(col, {
        type: detectedType,
        isCoordinate,
        isCurrency,
        isEmpty,
      });
    }

    return profile;
  }

  private isNumericString(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
  }

  private isDateString(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  private isCurrencyCode(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const currencyCodes = [
      'USD',
      'EUR',
      'GBP',
      'JPY',
      'AUD',
      'CAD',
      'CHF',
      'CNY',
      'INR',
      'BRL',
      'MXN',
      'SGD',
      'HKD',
      'KRW',
    ];
    return currencyCodes.includes(value.toUpperCase());
  }

  private mergeWithDeterministic(
    deterministicProfile: Map<
      string,
      {
        type: string;
        isCoordinate: boolean;
        isCurrency: boolean;
        isEmpty: boolean;
      }
    >,
    llmResult: InferredSchemaV2,
  ): InferredSchemaV2 {
    const merged = { ...llmResult, columns: [...llmResult.columns] };

    for (const col of merged.columns) {
      const profile = deterministicProfile.get(col.name);
      if (!profile) continue;

      if (profile.isEmpty) {
        col.detectedType = 'empty';
        col.semanticRole = 'irrelevant';
        col.confidence = 1.0;
        col.reasoning = 'Column contains only empty values';
      }

      if (profile.isCoordinate) {
        const role =
          col.name.toLowerCase().includes('lat') ||
          col.name.toLowerCase() === 'y'
            ? 'latitude'
            : 'longitude';
        col.semanticRole = role;
        col.confidence = 1.0;
        col.reasoning = `Deterministic match: column name matches ${role} pattern`;
      }

      if (profile.isCurrency) {
        col.semanticRole = 'currency';
        col.confidence = 1.0;
        col.reasoning =
          'Deterministic match: column name or values match currency pattern';
      }
    }

    for (const [key, entry] of Object.entries(merged.fieldMapping)) {
      if (!entry?.column) continue;

      const profile = deterministicProfile.get(entry.column);
      if (!profile) continue;

      if (profile.isCoordinate) {
        const isLat =
          entry.column.toLowerCase().includes('lat') ||
          entry.column.toLowerCase() === 'y';
        if (
          (isLat && key === 'latitudeColumn') ||
          (!isLat && key === 'longitudeColumn')
        ) {
          entry.confidence = 1.0;
        }
      }

      if (profile.isCurrency && key === 'currencyColumn') {
        entry.confidence = 1.0;
      }
    }

    return merged;
  }

  private createManualSchema(
    columns: string[],
    sampleRows: Record<string, unknown>[],
    deterministicProfile: Map<
      string,
      {
        type: string;
        isCoordinate: boolean;
        isCurrency: boolean;
        isEmpty: boolean;
      }
    >,
  ): InferredSchemaV2 {
    const columnKeywords: Record<string, string[]> = {
      assetNameColumn: [
        'asset',
        'name',
        'property',
        'building',
        'facility',
        'site',
        'location',
      ],
      valueColumn: [
        'value',
        'amount',
        'price',
        'valuation',
        'cost',
        'total',
        'market',
      ],
      currencyColumn: ['currency', 'curr'],
      jurisdictionColumn: [
        'jurisdiction',
        'location',
        'country',
        'state',
        'province',
        'region',
        'city',
        'address',
      ],
      latitudeColumn: ['lat', 'latitude'],
      longitudeColumn: ['lng', 'lon', 'longitude'],
      assetTypeColumn: ['type', 'category', 'classification', 'kind'],
    };

    const columnsAnalysis: {
      name: string;
      detectedType: string;
      sampleValues: unknown[];
      semanticRole: string;
      confidence: number;
      reasoning: string;
      alternatives: string[];
    }[] = [];
    const fieldMapping: InferredSchemaV2['fieldMapping'] = {};
    const unmappedColumns: { name: string; reason: string }[] = [];

    for (const col of columns) {
      const profile = deterministicProfile.get(col);
      const colLower = col.toLowerCase().replace(/[^a-z0-9]/g, '');

      let semanticRole = 'unknown';
      let confidence = 0.1;
      let reasoning = 'No pattern detected';

      if (profile?.isEmpty) {
        semanticRole = 'irrelevant';
        confidence = 1.0;
        reasoning = 'Column is empty';
      } else if (profile?.isCoordinate) {
        semanticRole =
          colLower.includes('lat') || colLower === 'y'
            ? 'latitude'
            : 'longitude';
        confidence = 1.0;
        reasoning = 'Coordinate pattern detected';
      } else if (profile?.isCurrency) {
        semanticRole = 'currency';
        confidence = 1.0;
        reasoning = 'Currency pattern detected';
      } else {
        for (const [field, keywords] of Object.entries(columnKeywords)) {
          for (const kw of keywords) {
            if (colLower.includes(kw)) {
              semanticRole =
                field === 'assetNameColumn'
                  ? 'asset_name'
                  : field === 'latitudeColumn'
                    ? 'latitude'
                    : field === 'longitudeColumn'
                      ? 'longitude'
                      : field === 'valueColumn'
                        ? 'value'
                        : field === 'currencyColumn'
                          ? 'currency'
                          : field === 'jurisdictionColumn'
                            ? 'jurisdiction'
                            : field === 'assetTypeColumn'
                              ? 'metadata'
                              : 'unknown';
              confidence = 0.8;
              reasoning = `Keyword match: ${kw}`;

              if (!fieldMapping[field as keyof typeof fieldMapping]) {
                fieldMapping[field as keyof typeof fieldMapping] = {
                  column: col,
                  confidence,
                  alternatives: [],
                };
              }
              break;
            }
          }
          if (semanticRole !== 'unknown') break;
        }
      }

      if (semanticRole === 'unknown') {
        unmappedColumns.push({ name: col, reason: reasoning });
      }

      const sampleVals = sampleRows
        .slice(0, 5)
        .map((r) => r[col])
        .filter((v) => v !== null && v !== undefined);
      columnsAnalysis.push({
        name: col,
        detectedType: profile?.isEmpty ? 'empty' : profile?.type || 'string',
        sampleValues: sampleVals,
        semanticRole,
        confidence,
        reasoning,
        alternatives: [],
      });
    }

    const mappedCount = Object.values(fieldMapping).filter(
      (f) => f?.column,
    ).length;

    return {
      columns: columnsAnalysis as any,
      fieldMapping,
      unmappedColumns,
      schemaQuality: {
        completeness: mappedCount / 4,
        ambiguityScore: mappedCount > 0 ? 0.3 : 0.9,
        deterministicCoverage: 1.0,
        needsReview: mappedCount < 2,
      },
      inferenceNotes: [
        'Schema created via manual inference (LLM failed or timed out)',
      ],
    };
  }

  private async llmInference(
    columns: string[],
    sampleRows: Record<string, unknown>[],
  ): Promise<InferredSchemaV2> {
    this.logger.info('Creating LLM provider');

    if (!this.llmProvider) {
      this.llmProvider = this.llmFactory.createProvider();
    }

    this.logger.info('LLM provider created', {
      providerClass: this.llmProvider.constructor.name,
    });

    const columnsStr = columns.join(', ');
    const sampleRowsStr = JSON.stringify(sampleRows.slice(0, 10), null, 2);

    this.logger.info('Calling LLM for schema inference', {
      columnCount: columns.length,
      sampleRowCount: sampleRows.slice(0, 10).length,
    });

    const prompt = SCHEMA_INFERENCE_PROMPT.replace(
      '{{columns}}',
      columnsStr,
    ).replace('{{sampleRows}}', sampleRowsStr);

    try {
      const result = await this.llmProvider.generateStructuredOutput<InferredSchemaV2>(
        prompt,
        SCHEMA_INFERENCE_SCHEMA,
      );

      this.logger.info('LLM response received', {
        hasResult: !!result,
        columnsCount: result?.columns?.length,
      });

      return result;
    } catch (error) {
      this.logger.error('LLM generateStructuredOutput failed', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}

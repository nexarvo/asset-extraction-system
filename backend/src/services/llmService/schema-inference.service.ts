import { Injectable } from '@nestjs/common';
import { LLMFactory } from './factory/llm.factory';
import type { LLMProvider } from './interfaces/llm-provider.interface';
import type { InferredSchema } from './dto/enrichment.dto';
import {
  SCHEMA_INFERENCE_PROMPT,
  SCHEMA_INFERENCE_SCHEMA,
} from './prompts/schema-inference.prompt';
import { AppLoggerService } from '../../core/app-logger.service';

const CANONICAL_FIELD_MAPPINGS: Record<string, string[]> = {
  assetNameColumn: [
    'asset',
    'name',
    'asset_name',
    'asset_name',
    'property',
    'property_name',
    'building',
    'facility',
    'assetname',
    'assset',
  ],
  valueColumn: [
    'value',
    'amount',
    'price',
    'valuation',
    'cost',
    'total_value',
    'market_value',
    'estimated_value',
    'assessed_value',
  ],
  currencyColumn: ['currency', 'curr', 'currency_code', 'currency_code'],
  jurisdictionColumn: [
    'jurisdiction',
    'location',
    'country',
    'state',
    'province',
    'region',
    'city',
    'address',
    'location',
  ],
  latitudeColumn: ['lat', 'latitude', 'lat_deg', 'y'],
  longitudeColumn: ['lng', 'longitude', 'lon', 'long', 'lng_deg', 'x'],
};

@Injectable()
export class SchemaInferenceService {
  private llmProvider: LLMProvider | null = null;

  constructor(
    private llmFactory: LLMFactory,
    private logger: AppLoggerService,
  ) {}

  async inferSchema(
    columns: string[],
    sampleRows: Record<string, unknown>[],
    useLLM: boolean = false,
  ): Promise<InferredSchema> {
    const deterministicResult = this.deterministicSchemaMatch(
      columns,
      sampleRows,
    );

    const unmappedFields = this.getUnmappedFields(deterministicResult);

    if (unmappedFields.length === 0 || !useLLM) {
      this.logger.log(
        'Schema inferred deterministically',
        'SchemaInferenceService',
        {
          mappedFields: Object.keys(deterministicResult).filter(
            (k) => deterministicResult[k as keyof InferredSchema],
          ),
        },
      );
      return deterministicResult;
    }

    try {
      const llmResult = await this.llmFallback(
        columns,
        sampleRows,
        unmappedFields,
      );
      return this.mergeSchemaResults(deterministicResult, llmResult);
    } catch (error) {
      this.logger.warn(
        'LLM schema inference failed, using deterministic result',
        'SchemaInferenceService',
        {
          error: (error as Error).message,
        },
      );
      return deterministicResult;
    }
  }

  private deterministicSchemaMatch(
    columns: string[],
    sampleRows: Record<string, unknown>[],
  ): InferredSchema {
    const result: InferredSchema = {
      assetNameColumn: undefined,
      valueColumn: undefined,
      currencyColumn: undefined,
      jurisdictionColumn: undefined,
      latitudeColumn: undefined,
      longitudeColumn: undefined,
    };

    const normalizedColumns = columns.map((c) => ({
      original: c,
      normalized: this.normalizeColumnName(c),
    }));

    for (const [canonicalField, keywords] of Object.entries(
      CANONICAL_FIELD_MAPPINGS,
    )) {
      for (const col of normalizedColumns) {
        if (this.matchesKeywords(col.normalized, keywords)) {
          (result as any)[canonicalField] = col.original;
          break;
        }
      }
    }

    this.inferFromDataPatterns(result, sampleRows, columns);

    return result;
  }

  private normalizeColumnName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/[0-9]+/g, '')
      .trim();
  }

  private matchesKeywords(normalizedName: string, keywords: string[]): boolean {
    for (const keyword of keywords) {
      if (
        normalizedName.includes(keyword) ||
        keyword.includes(normalizedName)
      ) {
        return true;
      }
    }
    return false;
  }

  private inferFromDataPatterns(
    result: InferredSchema,
    sampleRows: Record<string, unknown>[],
    columns: string[],
  ): void {
    if (!result.currencyColumn && columns.length > 0) {
      const currencyCandidate = columns.find((col) => {
        const values = sampleRows.slice(0, 5).map((row) => row[col]);
        const currencyCount = values.filter((v) =>
          this.isCurrencyCode(v),
        ).length;
        return currencyCount >= 2;
      });
      if (currencyCandidate) {
        result.currencyColumn = currencyCandidate;
      }
    }

    if (!result.latitudeColumn && !result.longitudeColumn) {
      const coords = this.detectCoordinateColumns(columns, sampleRows);
      if (coords.latitude && coords.longitude) {
        result.latitudeColumn = coords.latitude;
        result.longitudeColumn = coords.longitude;
      }
    }

    if (!result.jurisdictionColumn) {
      const locationCandidate = columns.find((col) => {
        const values = sampleRows.slice(0, 5).map((row) => row[col]);
        return values.some((v) => this.isLocationValue(v));
      });
      if (locationCandidate) {
        result.jurisdictionColumn = locationCandidate;
      }
    }
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

  private isLocationValue(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return value.length >= 2 && /^[A-Za-z\s,.-]+$/.test(value);
  }

  private detectCoordinateColumns(
    columns: string[],
    sampleRows: Record<string, unknown>[],
  ): { latitude?: string; longitude?: string } {
    const numericColumns = columns.filter((col) => {
      const values = sampleRows.slice(0, 5).map((row) => row[col]);
      const numericCount = values.filter(
        (v) => typeof v === 'number' || this.isNumericString(v),
      ).length;
      return numericCount >= 3;
    });

    let latCol: string | undefined;
    let lngCol: string | undefined;

    for (const col of numericColumns) {
      const colLower = col.toLowerCase();
      if (colLower.includes('lat') || colLower === 'y') {
        latCol = col;
      } else if (
        colLower.includes('lng') ||
        colLower.includes('lon') ||
        colLower === 'x'
      ) {
        lngCol = col;
      }
    }

    if (!latCol && !lngCol && numericColumns.length >= 2) {
      const firstValues = sampleRows.slice(0, 5).map((row) => ({
        col: numericColumns[0],
        val: this.parseNumeric(row[numericColumns[0]]),
      }));
      const secondValues = sampleRows.slice(0, 5).map((row) => ({
        col: numericColumns[1],
        val: this.parseNumeric(row[numericColumns[1]]),
      }));

      const firstInRange = firstValues.some(
        (v) => v.val !== null && v.val >= -90 && v.val <= 90,
      );
      const secondInRange = secondValues.some(
        (v) => v.val !== null && v.val >= -180 && v.val <= 180,
      );

      if (firstInRange && secondInRange) {
        latCol = numericColumns[0];
        lngCol = numericColumns[1];
      }
    }

    return { latitude: latCol, longitude: lngCol };
  }

  private isNumericString(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
  }

  private parseNumeric(value: unknown): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  private getUnmappedFields(schema: InferredSchema): string[] {
    const unmapped: string[] = [];
    if (!schema.assetNameColumn) unmapped.push('assetNameColumn');
    if (!schema.valueColumn) unmapped.push('valueColumn');
    if (!schema.currencyColumn) unmapped.push('currencyColumn');
    if (!schema.jurisdictionColumn) unmapped.push('jurisdictionColumn');
    if (!schema.latitudeColumn) unmapped.push('latitudeColumn');
    if (!schema.longitudeColumn) unmapped.push('longitudeColumn');
    return unmapped;
  }

  private async llmFallback(
    columns: string[],
    sampleRows: Record<string, unknown>[],
    unmappedFields: string[],
  ): Promise<InferredSchema> {
    if (!this.llmProvider) {
      this.llmProvider = this.llmFactory.createProvider();
    }

    const columnsStr = columns.join(', ');
    const sampleRowsStr = JSON.stringify(sampleRows.slice(0, 5), null, 2);

    const prompt = SCHEMA_INFERENCE_PROMPT.replace(
      '{{columns}}',
      columnsStr,
    ).replace('{{sampleRows}}', sampleRowsStr);

    return this.llmProvider.generateStructuredOutput<InferredSchema>(
      prompt,
      SCHEMA_INFERENCE_SCHEMA,
    );
  }

  private mergeSchemaResults(
    deterministic: InferredSchema,
    llmResult: InferredSchema,
  ): InferredSchema {
    const merged: InferredSchema = { ...deterministic };

    if (llmResult.assetNameColumn && !merged.assetNameColumn) {
      merged.assetNameColumn = llmResult.assetNameColumn;
    }
    if (llmResult.valueColumn && !merged.valueColumn) {
      merged.valueColumn = llmResult.valueColumn;
    }
    if (llmResult.currencyColumn && !merged.currencyColumn) {
      merged.currencyColumn = llmResult.currencyColumn;
    }
    if (llmResult.jurisdictionColumn && !merged.jurisdictionColumn) {
      merged.jurisdictionColumn = llmResult.jurisdictionColumn;
    }
    if (llmResult.latitudeColumn && !merged.latitudeColumn) {
      merged.latitudeColumn = llmResult.latitudeColumn;
    }
    if (llmResult.longitudeColumn && !merged.longitudeColumn) {
      merged.longitudeColumn = llmResult.longitudeColumn;
    }

    return merged;
  }
}

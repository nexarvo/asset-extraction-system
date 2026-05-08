import { Injectable } from '@nestjs/common';
import type { LLMProvider } from './interfaces/llm-provider.interface';
import { LLMFactory } from './factory/llm.factory';
import { SchemaInferenceService } from './schema-inference.service';
import type {
  RowEnrichmentInput,
  RowEnrichmentOutput,
  InferredSchema,
} from './dto/enrichment.dto';
import type { BatchEnrichmentOutput } from './dto/enrichment.dto';
import {
  BATCH_ENRICHMENT_PROMPT,
  BATCH_ENRICHMENT_SCHEMA,
} from './prompts/enrichment.prompt';
import { AppLoggerService } from '../../core/app-logger.service';

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 100;

@Injectable()
export class EnrichmentService {
  private llmProvider: LLMProvider | null = null;

  constructor(
    private llmFactory: LLMFactory,
    private schemaInferenceService: SchemaInferenceService,
    private logger: AppLoggerService,
  ) {}

  async processBatch(
    rows: RowEnrichmentInput[],
    schema: InferredSchema,
    batchSize: number = DEFAULT_BATCH_SIZE,
  ): Promise<BatchEnrichmentOutput> {
    if (rows.length === 0) {
      return { enrichedRows: [], errors: [] };
    }

    const safeBatchSize = Math.min(Math.max(batchSize, 1), MAX_BATCH_SIZE);
    const batches = this.chunkArray(rows, safeBatchSize);

    const allEnrichedRows: RowEnrichmentOutput[] = [];
    const allErrors: { rowIndex: number; reason: string }[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
        const result = await this.enrichBatch(batch, schema, i * safeBatchSize);
        allEnrichedRows.push(...result.enrichedRows);
        allErrors.push(...result.errors);
      } catch (error) {
        this.logger.warn(`Batch ${i} enrichment failed`, 'EnrichmentService', {
          error: (error as Error).message,
          batchSize: batch.length,
        });

        for (let j = 0; j < batch.length; j++) {
          allErrors.push({
            rowIndex: batch[j].sourceRowIndex,
            reason: `Batch enrichment failed: ${(error as Error).message}`,
          });
        }
      }
    }

    return { enrichedRows: allEnrichedRows, errors: allErrors };
  }

  async inferSchemaAndEnrich(
    columns: string[],
    sampleRows: Record<string, unknown>[],
    allRows: RowEnrichmentInput[],
  ): Promise<{
    schema: InferredSchema;
    enrichedRows: RowEnrichmentOutput[];
    errors: { rowIndex: number; reason: string }[];
  }> {
    const schema = await this.schemaInferenceService.inferSchema(
      columns,
      sampleRows.slice(0, 10),
      true,
    );

    const rowsToEnrich = allRows.filter((row) =>
      this.needsEnrichment(row, schema),
    );
    const rowsWithoutEnrichment = allRows.filter(
      (row) => !this.needsEnrichment(row, schema),
    );

    const basicOutputs: RowEnrichmentOutput[] = rowsWithoutEnrichment.map(
      (row) => ({
        normalizedAssetName: String(
          row.rowData[schema.assetNameColumn || 'asset_name'] || '',
        ),
        currency: this.extractCurrency(
          row.rowData[schema.currencyColumn || 'currency'],
        ),
        confidenceSignals: {
          exactValueMatch: true,
          fieldMissing: false,
        },
        explanation: 'Direct extraction - no LLM inference required',
        needsReview: false,
      }),
    );

    let enrichedOutputs: RowEnrichmentOutput[] = [];
    let errors: { rowIndex: number; reason: string }[] = [];

    if (rowsToEnrich.length > 0) {
      const result = await this.processBatch(rowsToEnrich, schema);
      enrichedOutputs = result.enrichedRows;
      errors = result.errors;
    }

    return {
      schema,
      enrichedRows: [...basicOutputs, ...enrichedOutputs],
      errors,
    };
  }

  private needsEnrichment(
    row: RowEnrichmentInput,
    schema: InferredSchema,
  ): boolean {
    const data = row.rowData;

    if (!schema.currencyColumn && !data.currency) return true;
    if (!schema.jurisdictionColumn && !data.jurisdiction) return true;
    if (
      (!schema.latitudeColumn || !schema.longitudeColumn) &&
      (!data.latitude || !data.longitude)
    )
      return true;

    return false;
  }

  private extractCurrency(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') {
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
      const upper = value.toUpperCase();
      if (currencyCodes.includes(upper)) return upper;
    }
    return undefined;
  }

  private async enrichBatch(
    rows: RowEnrichmentInput[],
    schema: InferredSchema,
    offset: number,
  ): Promise<BatchEnrichmentOutput> {
    if (!this.llmProvider) {
      this.llmProvider = this.llmFactory.createProvider();
    }

    const schemaJson = JSON.stringify(schema, null, 2);
    const rowsJson = JSON.stringify(
      rows.map((r) => ({
        ...r.rowData,
        _sourceRowIndex: r.sourceRowIndex,
        _sourceSheetName: r.sourceSheetName,
      })),
      null,
      2,
    );

    const prompt = BATCH_ENRICHMENT_PROMPT.replace(
      '{{schema}}',
      schemaJson,
    ).replace('{{rowsData}}', rowsJson);

    try {
      const response = await this.llmProvider.generateStructuredOutput<
        RowEnrichmentOutput[]
      >(prompt, BATCH_ENRICHMENT_SCHEMA);

      const enrichedRows: RowEnrichmentOutput[] = [];
      const errors: { rowIndex: number; reason: string }[] = [];

      if (Array.isArray(response)) {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const enriched = response[i];

          if (enriched) {
            enrichedRows.push(enriched);
          } else {
            errors.push({
              rowIndex: row.sourceRowIndex,
              reason: 'No enrichment result returned',
            });
            enrichedRows.push(this.createEmptyEnrichment(row.sourceRowIndex));
          }
        }
      } else {
        for (const row of rows) {
          errors.push({
            rowIndex: row.sourceRowIndex,
            reason: 'Invalid response format from LLM',
          });
          enrichedRows.push(this.createEmptyEnrichment(row.sourceRowIndex));
        }
      }

      return { enrichedRows, errors };
    } catch (error) {
      throw new Error(
        `LLM batch enrichment failed: ${(error as Error).message}`,
      );
    }
  }

  private createEmptyEnrichment(rowIndex: number): RowEnrichmentOutput {
    return {
      confidenceSignals: {
        fieldMissing: true,
      },
      explanation: 'Enrichment failed - using raw values',
      needsReview: true,
    };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

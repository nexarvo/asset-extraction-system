import { ExtractedAssetCandidate } from '../utils/csv-stream.types';
import { InferredSchema } from '../services/llmService/dto/enrichment.dto';
import { BatchHelper, BatchItem } from './batch.helper';
import { DeterministicHelpers } from './deterministic.helpers';
import { ConsoleLogger, createLogger } from './console-logger.helper';
import { LLMEnrichmentService } from '../services/llmService/llm.service';
import { ExtractionPersistenceService } from '../services/extraction-persistence.service';
import { SchemaInferenceService } from '../services/llmService/schema-inference.service';
import { ExtractionContext } from '../strategies/extraction-strategy.interface';

export interface ProcessedRow {
  row: Record<string, unknown>;
  sourceRowIndex: number;
  sourceSheetName?: string;
}

export class ExtractionProcessor {
  private readonly logger: ConsoleLogger;
  private batchHelper: BatchHelper | null = null;
  private schema: InferredSchema | null = null;
  private sampleRows: ProcessedRow[] = [];
  private processedCount = 0;
  private totalDeterministic = 0;
  private totalAmbiguous = 0;

  constructor(
    private context: ExtractionContext,
    private onFlush?: () => void,
  ) {
    this.logger = createLogger('ExtractionProcessor');
  }

  async processRow(
    row: Record<string, unknown>,
    sourceRowIndex: number,
    sourceSheetName?: string,
  ): Promise<void> {
    if (!this.batchHelper) {
      await this.initialize();
    }

    const batchHelper = this.batchHelper!;

    if (batchHelper.hasDeterministicBatch()) {
      await this.flushDeterministicBatch();
    }

    if (batchHelper.hasAmbiguousBatch()) {
      await this.flushAmbiguousBatch();
    }

    const candidate = this.mapToCandidate(row, sourceRowIndex, sourceSheetName);
    batchHelper.processRow(candidate, sourceRowIndex, this.schema || {});
    this.processedCount++;
  }

  async flush(): Promise<void> {
    if (!this.batchHelper) return;

    const remaining = this.batchHelper.flushAll();

    if (remaining.deterministic.length > 0) {
      this.totalDeterministic += remaining.deterministic.length;
      await this.persistBatch(remaining.deterministic);
    }

    if (remaining.ambiguous.length > 0) {
      this.totalAmbiguous += remaining.ambiguous.length;
      await this.enrichBatch(remaining.ambiguous);
    }
  }

  getStats(): { total: number; deterministic: number; ambiguous: number } {
    return {
      total: this.processedCount,
      deterministic: this.totalDeterministic,
      ambiguous: this.totalAmbiguous,
    };
  }

  private async initialize(): Promise<void> {
    this.batchHelper = new BatchHelper(
      this.context.documentId,
      this.context.extractionJobId,
    );
  }

  async inferInitialSchema(
    sampleRows: ProcessedRow[],
  ): Promise<InferredSchema> {
    if (sampleRows.length === 0) {
      return {};
    }

    this.sampleRows = sampleRows.slice(0, 20);
    const columns = this.extractColumnsFromRows(sampleRows);

    const dataStartRow = DeterministicHelpers.detectDataStartRow(
      sampleRows.map((r) => r.row) as Record<string, unknown>[],
    );
    if (dataStartRow > 0) {
      this.sampleRows = this.sampleRows.slice(dataStartRow);
    }

    try {
      return await this.context.schemaInferenceService.inferSchema(
        columns,
        this.sampleRows.map((r) => r.row) as Record<string, unknown>[],
        true,
      );
    } catch (error) {
      this.logger.warn(`Schema inference failed, using deterministic fallback`, {
        error: (error as Error).message,
      });
      return this.deterministicSchemaInference(columns);
    }
  }

  setSchema(schema: InferredSchema): void {
    this.schema = schema;
  }

  private mapToCandidate(
    row: Record<string, unknown>,
    sourceRowIndex: number,
    sourceSheetName?: string,
  ): ExtractedAssetCandidate {
    const metaFields = [
      'sheetName',
      'sourceSheetName',
      'sourceRowIndex',
      'overallConfidence',
      'rawAssetName',
    ];

    const rawRowData: Record<string, string | number | null> = {};
    const normalizedRowData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      if (!metaFields.includes(key) && key && key.trim() !== '') {
        rawRowData[key] =
          value !== undefined
            ? typeof value === 'object'
              ? JSON.stringify(value)
              : String(value)
            : null;
        normalizedRowData[key] = value;
      }
    }

    return {
      rawAssetName:
        String(
          row['asset_name'] ||
            row['name'] ||
            row['Asset Name'] ||
            row['asset'] ||
            `asset_${sourceRowIndex + 1}`,
        ) || `asset_${sourceRowIndex + 1}`,
      fields: [],
      sourceRowIndex: sourceRowIndex + 1,
      sourceSheetName: sourceSheetName || (row['sheetName'] as string) || undefined,
      overallConfidence: 0.8,
      rawRowData: Object.keys(rawRowData).length > 0 ? rawRowData : undefined,
      normalizedRowData:
        Object.keys(normalizedRowData).length > 0 ? normalizedRowData : undefined,
    };
  }

  private async flushDeterministicBatch(): Promise<void> {
    if (!this.batchHelper) return;

    const batch = this.batchHelper.flushDeterministic();
    if (batch.length === 0) return;

    this.totalDeterministic += batch.length;
    await this.persistBatch(batch);
  }

  private async flushAmbiguousBatch(): Promise<void> {
    if (!this.batchHelper) return;

    const batch = this.batchHelper.flushAmbiguous();
    if (batch.length === 0) return;

    this.totalAmbiguous += batch.length;
    await this.enrichBatch(batch);
  }

  private async persistBatch(batch: BatchItem[]): Promise<void> {
    const candidates = batch.map((item) => item.candidate);

    this.logger.info(`Persisting deterministic batch`, { count: candidates.length });

    try {
      await this.context.persistenceService.persistBatchWithTransaction(
        this.context.documentId,
        this.context.extractionJobId,
        candidates,
      );
    } catch (error) {
      this.logger.error(`Failed to persist deterministic batch`, {
        error: (error as Error).message,
        count: candidates.length,
      });
    }
  }

  private async enrichBatch(batch: BatchItem[]): Promise<void> {
    this.logger.info(`Processing ambiguous batch via LLM`, { count: batch.length });

    try {
      const rows = batch.map((item) =>
        item.candidate.normalizedRowData || item.candidate.rawRowData || {},
      );
      const columns = this.extractColumns(
        batch.map((item) => item.candidate),
      );

      const result = await this.context.llmEnrichmentService.enrichExtraction({
        documentId: this.context.documentId,
        extractionJobId: this.context.extractionJobId,
        columns,
        rows: rows as Record<string, unknown>[],
      });

      if (result.enrichedFields.length > 0) {
        await this.context.llmEnrichmentService.persistEnrichmentResults(result);
      }

      this.logger.info(`Ambiguous batch enrichment completed`, {
        enriched: result.enrichedFields.length,
        errors: result.errors.length,
        reviewItems: result.reviewItems.length,
      });
    } catch (error) {
      this.logger.error(`Failed to enrich ambiguous batch`, {
        error: (error as Error).message,
        count: batch.length,
      });
    }
  }

  private extractColumns(candidates: ExtractedAssetCandidate[]): string[] {
    const columnsSet = new Set<string>();
    for (const candidate of candidates) {
      const rowData = candidate.normalizedRowData || candidate.rawRowData;
      if (rowData) {
        Object.keys(rowData).forEach((col) => columnsSet.add(col));
      }
    }
    return Array.from(columnsSet);
  }

  private extractColumnsFromRows(rows: ProcessedRow[]): string[] {
    const columnsSet = new Set<string>();
    for (const row of rows) {
      if (row.row) {
        Object.keys(row.row).forEach((col) => columnsSet.add(col));
      }
    }
    return Array.from(columnsSet);
  }

  private deterministicSchemaInference(columns: string[]): InferredSchema {
    const schema: InferredSchema = {};

    for (const col of columns) {
      if (DeterministicHelpers.matchColumn(col, 'assetName') && !schema.assetNameColumn) {
        schema.assetNameColumn = col;
      } else if (DeterministicHelpers.matchColumn(col, 'value') && !schema.valueColumn) {
        schema.valueColumn = col;
      } else if (DeterministicHelpers.matchColumn(col, 'currency') && !schema.currencyColumn) {
        schema.currencyColumn = col;
      } else if (DeterministicHelpers.matchColumn(col, 'jurisdiction') && !schema.jurisdictionColumn) {
        schema.jurisdictionColumn = col;
      } else if (DeterministicHelpers.matchColumn(col, 'latitude') && !schema.latitudeColumn) {
        schema.latitudeColumn = col;
      } else if (DeterministicHelpers.matchColumn(col, 'longitude') && !schema.longitudeColumn) {
        schema.longitudeColumn = col;
      } else if (DeterministicHelpers.matchColumn(col, 'assetType') && !schema.assetTypeColumn) {
        schema.assetTypeColumn = col;
      }
    }

    return schema;
  }
}
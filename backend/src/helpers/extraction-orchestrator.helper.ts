import { ExtractedAssetCandidate } from '../utils/csv-stream.types';
import { InferredSchema } from '../services/llmService/dto/enrichment.dto';
import { BatchHelper, BatchItem } from './batch.helper';
import { DeterministicHelpers } from './deterministic.helpers';
import { ConsoleLogger, createLogger } from './console-logger.helper';
import { LLMEnrichmentService } from '../services/llmService/llm.service';
import { ExtractionPersistenceService } from '../services/extraction-persistence.service';
import { SchemaInferenceService } from '../services/llmService/schema-inference.service';

export interface ExtractionResult {
  totalRows: number;
  deterministicRows: number;
  ambiguousRows: number;
  persistedCount: number;
  enrichedCount: number;
  errors: string[];
}

export class ExtractionOrchestrator {
  private readonly logger: ConsoleLogger;
  private batchHelper: BatchHelper | null = null;
  private schema: InferredSchema | null = null;
  private sampleRows: Record<string, unknown>[] = [];

  constructor(
    private documentId: string,
    private extractionJobId: string | null,
    private persistenceService: ExtractionPersistenceService,
    private llmEnrichmentService: LLMEnrichmentService,
    private schemaInferenceService: SchemaInferenceService,
  ) {
    this.logger = createLogger('ExtractionOrchestrator');
  }

  async processFile(
    candidates: ExtractedAssetCandidate[],
  ): Promise<ExtractionResult> {
    this.logger.info(`Starting file processing`, { totalCandidates: candidates.length });

    this.sampleRows = candidates.slice(0, 20).map(c => c.normalizedRowData || c.rawRowData || {});
    this.schema = await this.inferSchema(candidates);
    
    this.logger.info(`Schema inferred`, { 
      assetNameColumn: this.schema?.assetNameColumn,
      currencyColumn: this.schema?.currencyColumn,
      assetTypeColumn: this.schema?.assetTypeColumn,
    });

    this.batchHelper = new BatchHelper(this.documentId, this.extractionJobId);

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      
      if (this.batchHelper.hasDeterministicBatch()) {
        await this.flushDeterministicBatch();
      }

      if (this.batchHelper.hasAmbiguousBatch()) {
        await this.flushAmbiguousBatch();
      }

      this.batchHelper.processRow(candidate, i, this.schema);
    }

    await this.flushRemainingBatches();

    const result = this.getResult(candidates.length);
    this.logger.info(`File processing completed`, { 
      totalRows: result.totalRows,
      deterministicRows: result.deterministicRows,
      ambiguousRows: result.ambiguousRows,
    });

    return result;
  }

  private async inferSchema(candidates: ExtractedAssetCandidate[]): Promise<InferredSchema> {
    if (candidates.length === 0) {
      return {};
    }

    const columns = this.extractColumns(candidates);
    
    const dataStartRow = DeterministicHelpers.detectDataStartRow(this.sampleRows as Record<string, unknown>[]);
    if (dataStartRow > 0) {
      this.sampleRows = this.sampleRows.slice(dataStartRow);
    }

    try {
      return await this.schemaInferenceService.inferSchema(
        columns,
        this.sampleRows as Record<string, unknown>[],
        true,
      );
    } catch (error) {
      this.logger.warn(`Schema inference failed, using deterministic fallback`, {
        error: (error as Error).message,
      });
      return this.deterministicSchemaInference(columns);
    }
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

  private async flushDeterministicBatch(): Promise<void> {
    if (!this.batchHelper) return;

    const batch = this.batchHelper.flushDeterministic();
    
    if (batch.length === 0) return;

    const candidates = batch.map(item => item.candidate);
    
    this.logger.info(`Persisting deterministic batch`, { count: candidates.length });

    try {
      await this.persistenceService.persistBatchWithTransaction(
        this.documentId,
        this.extractionJobId,
        candidates,
      );
    } catch (error) {
      this.logger.error(`Failed to persist deterministic batch`, {
        error: (error as Error).message,
        count: candidates.length,
      });
    }
  }

  private async flushAmbiguousBatch(): Promise<void> {
    if (!this.batchHelper) return;

    const batch = this.batchHelper.flushAmbiguous();
    
    if (batch.length === 0) return;

    this.logger.info(`Processing ambiguous batch via LLM`, { count: batch.length });

    try {
      const rows = batch.map(item => item.candidate.normalizedRowData || item.candidate.rawRowData || {});
      const columns = this.extractColumns(batch.map(item => item.candidate));

      const result = await this.llmEnrichmentService.enrichExtraction({
        documentId: this.documentId,
        extractionJobId: this.extractionJobId,
        columns,
        rows: rows as Record<string, unknown>[],
      });

      if (result.enrichedFields.length > 0) {
        await this.llmEnrichmentService.persistEnrichmentResults(result);
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

  private async flushRemainingBatches(): Promise<void> {
    if (!this.batchHelper) return;

    const remaining = this.batchHelper.flushAll();

    if (remaining.deterministic.length > 0) {
      this.logger.info(`Flushing remaining deterministic rows`, { 
        count: remaining.deterministic.length,
      });
      
      try {
        await this.persistenceService.persistBatchWithTransaction(
          this.documentId,
          this.extractionJobId,
          remaining.deterministic.map(item => item.candidate),
        );
      } catch (error) {
        this.logger.error(`Failed to flush deterministic batch`, {
          error: (error as Error).message,
        });
      }
    }

    if (remaining.ambiguous.length > 0) {
      this.logger.info(`Flushing remaining ambiguous rows`, { 
        count: remaining.ambiguous.length,
      });

      try {
        const rows = remaining.ambiguous.map(item => item.candidate.normalizedRowData || item.candidate.rawRowData || {});
        const columns = this.extractColumns(remaining.ambiguous.map(item => item.candidate));

        const result = await this.llmEnrichmentService.enrichExtraction({
          documentId: this.documentId,
          extractionJobId: this.extractionJobId,
          columns,
          rows: rows as Record<string, unknown>[],
        });

        if (result.enrichedFields.length > 0) {
          await this.llmEnrichmentService.persistEnrichmentResults(result);
        }
      } catch (error) {
        this.logger.error(`Failed to flush ambiguous batch`, {
          error: (error as Error).message,
        });
      }
    }
  }

  private extractColumns(candidates: ExtractedAssetCandidate[]): string[] {
    const columnsSet = new Set<string>();
    for (const candidate of candidates) {
      const rowData = candidate.normalizedRowData || candidate.rawRowData;
      if (rowData) {
        Object.keys(rowData).forEach(col => columnsSet.add(col));
      }
    }
    return Array.from(columnsSet);
  }

  private getResult(totalRows: number): ExtractionResult {
    const deterministicCount = this.batchHelper?.getDeterministicCount() || 0;
    const ambiguousCount = this.batchHelper?.getAmbiguousCount() || 0;

    return {
      totalRows,
      deterministicRows: deterministicCount,
      ambiguousRows: ambiguousCount,
      persistedCount: deterministicCount,
      enrichedCount: ambiguousCount,
      errors: [],
    };
  }
}
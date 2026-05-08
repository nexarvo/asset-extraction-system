import { ExtractedAssetCandidate } from '../utils/csv-stream.types';
import { InferredSchema } from '../services/llmService/dto/enrichment.dto';
import { DeterministicHelpers } from './deterministic.helpers';
import { ConsoleLogger, createLogger } from './console-logger.helper';

export interface BatchItem {
  candidate: ExtractedAssetCandidate;
  rowIndex: number;
  isAmbiguous: boolean;
  ambiguityReasons: string[];
}

export interface PersistenceBatch {
  items: BatchItem[];
  flush: () => Promise<void>;
}

export class BatchHelper {
  private deterministicBatch: BatchItem[] = [];
  private ambiguousBatch: BatchItem[] = [];
  private readonly DETERMINISTIC_BATCH_SIZE = 500;
  private readonly AMBIGUOUS_BATCH_SIZE = 50;
  private readonly logger: ConsoleLogger;

  constructor(private documentId: string, private extractionJobId: string | null) {
    this.logger = createLogger('BatchHelper');
  }

  processRow(
    candidate: ExtractedAssetCandidate,
    rowIndex: number,
    schema: InferredSchema,
  ): void {
    const rowData = candidate.normalizedRowData || candidate.rawRowData || {};
    
    const schemaMap = this.buildSchemaMap(schema);
    const { isAmbiguous, reasons } = DeterministicHelpers.detectAmbiguity(
      rowData as Record<string, unknown>,
      schemaMap,
    );

    const item: BatchItem = {
      candidate,
      rowIndex,
      isAmbiguous,
      ambiguityReasons: reasons,
    };

    if (isAmbiguous) {
      this.ambiguousBatch.push(item);
      
      if (this.ambiguousBatch.length >= this.AMBIGUOUS_BATCH_SIZE) {
        this.logger.warn(`Ambiguous batch threshold reached: ${this.AMBIGUOUS_BATCH_SIZE}`, {
          ambiguousCount: this.ambiguousBatch.length,
        });
      }
    } else {
      const hasExactMatch = this.hasExactSchemaMatch(rowData, schema);
      const hasAllFields = this.hasAllExpectedFields(rowData, schema);
      
      candidate.overallConfidence = DeterministicHelpers.calculateInitialConfidence(
        hasExactMatch,
        hasAllFields,
      );
      
      this.deterministicBatch.push(item);
      
      if (this.deterministicBatch.length >= this.DETERMINISTIC_BATCH_SIZE) {
        this.logger.info(`Deterministic batch threshold reached: ${this.DETERMINISTIC_BATCH_SIZE}`, {
          deterministicCount: this.deterministicBatch.length,
        });
      }
    }
  }

  private buildSchemaMap(schema: InferredSchema): Record<string, string> {
    const map: Record<string, string> = {};
    
    if (schema.assetNameColumn) map[schema.assetNameColumn] = 'assetName';
    if (schema.valueColumn) map[schema.valueColumn] = 'value';
    if (schema.currencyColumn) map[schema.currencyColumn] = 'currency';
    if (schema.jurisdictionColumn) map[schema.jurisdictionColumn] = 'jurisdiction';
    if (schema.latitudeColumn) map[schema.latitudeColumn] = 'latitude';
    if (schema.longitudeColumn) map[schema.longitudeColumn] = 'longitude';
    if (schema.assetTypeColumn) map[schema.assetTypeColumn] = 'assetType';
    
    return map;
  }

  private hasExactSchemaMatch(
    rowData: Record<string, unknown>,
    schema: InferredSchema,
  ): boolean {
    const expectedColumns = [
      schema.assetNameColumn,
      schema.valueColumn,
      schema.currencyColumn,
      schema.jurisdictionColumn,
    ].filter(Boolean);

    if (expectedColumns.length === 0) return false;

    let matched = 0;
    for (const col of expectedColumns) {
      if (col && rowData[col] !== undefined && rowData[col] !== null && rowData[col] !== '') {
        matched++;
      }
    }

    return matched / expectedColumns.length >= 0.8;
  }

  private hasAllExpectedFields(
    rowData: Record<string, unknown>,
    schema: InferredSchema,
  ): boolean {
    const criticalFields = [schema.currencyColumn, schema.assetTypeColumn].filter(Boolean);
    
    if (criticalFields.length === 0) return true;

    for (const col of criticalFields) {
      if (col && (!rowData[col] || String(rowData[col]).trim() === '')) {
        return false;
      }
    }

    return true;
  }

  getDeterministicBatch(): BatchItem[] {
    return this.deterministicBatch;
  }

  getAmbiguousBatch(): BatchItem[] {
    return this.ambiguousBatch;
  }

  getDeterministicCount(): number {
    return this.deterministicBatch.length;
  }

  getAmbiguousCount(): number {
    return this.ambiguousBatch.length;
  }

  hasDeterministicBatch(): boolean {
    return this.deterministicBatch.length >= this.DETERMINISTIC_BATCH_SIZE;
  }

  hasAmbiguousBatch(): boolean {
    return this.ambiguousBatch.length >= this.AMBIGUOUS_BATCH_SIZE;
  }

  flushDeterministic(): BatchItem[] {
    const batch = [...this.deterministicBatch];
    this.deterministicBatch = [];
    return batch;
  }

  flushAmbiguous(): BatchItem[] {
    const batch = [...this.ambiguousBatch];
    this.ambiguousBatch = [];
    return batch;
  }

  flushAll(): { deterministic: BatchItem[]; ambiguous: BatchItem[] } {
    return {
      deterministic: this.flushDeterministic(),
      ambiguous: this.flushAmbiguous(),
    };
  }

  clear(): void {
    this.deterministicBatch = [];
    this.ambiguousBatch = [];
  }
}
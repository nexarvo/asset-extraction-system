import { ExtractedAssetCandidate } from '../utils/csv-stream.types';
import { InferredSchemaV2 } from '../services/llmService/dto/enrichment.dto';
import { DeterministicHelpers } from './deterministic.helpers';
import { ConsoleLogger, createLogger } from './console-logger.helper';

function extractSchemaFields(schema: InferredSchemaV2): Record<string, string | null> {
  const mapping = schema.fieldMapping;
  return {
    assetNameColumn: mapping.assetNameColumn?.column ?? null,
    valueColumn: mapping.valueColumn?.column ?? null,
    currencyColumn: mapping.currencyColumn?.column ?? null,
    jurisdictionColumn: mapping.jurisdictionColumn?.column ?? null,
    latitudeColumn: mapping.latitudeColumn?.column ?? null,
    longitudeColumn: mapping.longitudeColumn?.column ?? null,
    assetTypeColumn: mapping.assetTypeColumn?.column ?? null,
  };
}

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
  private readonly DETERMINISTIC_BATCH_SIZE = 5000;
  private readonly AMBIGUOUS_BATCH_SIZE = 50;
  private readonly logger: ConsoleLogger;

  constructor(private documentId: string, private extractionJobId: string | null) {
    this.logger = createLogger('BatchHelper');
  }

  processRow(
    candidate: ExtractedAssetCandidate,
    rowIndex: number,
    schema: InferredSchemaV2,
  ): void {
    const rowData = candidate.normalizedRowData || candidate.rawRowData || {};
    const fields = extractSchemaFields(schema);
    
    const schemaMap = this.buildSchemaMap(fields);
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
      const hasExactMatch = this.hasExactSchemaMatch(rowData, fields);
      const hasAllFields = this.hasAllExpectedFields(rowData, fields);
      
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

  private buildSchemaMap(fields: Record<string, string | null>): Record<string, string> {
    const map: Record<string, string> = {};
    
    if (fields.assetNameColumn) map[fields.assetNameColumn] = 'assetName';
    if (fields.valueColumn) map[fields.valueColumn] = 'value';
    if (fields.currencyColumn) map[fields.currencyColumn] = 'currency';
    if (fields.jurisdictionColumn) map[fields.jurisdictionColumn] = 'jurisdiction';
    if (fields.latitudeColumn) map[fields.latitudeColumn] = 'latitude';
    if (fields.longitudeColumn) map[fields.longitudeColumn] = 'longitude';
    if (fields.assetTypeColumn) map[fields.assetTypeColumn] = 'assetType';
    
    return map;
  }

  private hasExactSchemaMatch(
    rowData: Record<string, unknown>,
    fields: Record<string, string | null>,
  ): boolean {
    const expectedColumns = [
      fields.assetNameColumn,
      fields.valueColumn,
      fields.currencyColumn,
      fields.jurisdictionColumn,
    ].filter((c): c is string => !!c);

    if (expectedColumns.length === 0) return false;

    let matched = 0;
    for (const col of expectedColumns) {
      if (rowData[col] !== undefined && rowData[col] !== null && rowData[col] !== '') {
        matched++;
      }
    }

    return matched / expectedColumns.length >= 0.8;
  }

  private hasAllExpectedFields(
    rowData: Record<string, unknown>,
    fields: Record<string, string | null>,
  ): boolean {
    const criticalFields = [fields.currencyColumn, fields.assetTypeColumn].filter((c): c is string => !!c);
    
    if (criticalFields.length === 0) return true;

    for (const col of criticalFields) {
      if (!rowData[col] || String(rowData[col]).trim() === '') {
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
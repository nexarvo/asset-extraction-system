import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../core/app-logger.service';
import { LLMEnrichmentService, LLMEnrichmentInput, LLMEnrichmentResult } from './llm.service';
import { ExtractedAssetFieldRepository } from '../../repositories/extracted-asset-field.repository';
import { ValidationFlagRepository } from '../../repositories/validation-flag.repository';
import { ReviewQueueRepository } from '../../repositories/review-queue.repository';
import { InferredSchema, EnrichmentMetadata } from './dto/enrichment.dto';
import { ExtractedAssetCandidate } from '../../utils/csv-stream.types';

export interface AmbiguousRow {
  candidate: ExtractedAssetCandidate;
  documentId: string;
  extractionJobId: string | null;
  sourceRowIndex: number;
  sourceSheetName?: string;
}

export interface EnrichmentBatchResult {
  totalProcessed: number;
  enrichedCount: number;
  failedCount: number;
  reviewItemsCount: number;
  validationFlagsCount: number;
}

@Injectable()
export class EnrichmentCoordinatorService {
  private ambiguousRows: AmbiguousRow[] = [];
  private readonly BATCH_SIZE = 50;
  private readonly AMBIGUOUS_THRESHOLD = 0.7;

  constructor(
    private logger: AppLoggerService,
    private llmEnrichmentService: LLMEnrichmentService,
    private extractedAssetFieldRepository: ExtractedAssetFieldRepository,
    private validationFlagRepository: ValidationFlagRepository,
    private reviewQueueRepository: ReviewQueueRepository,
  ) {}

  isAmbiguousRow(candidate: ExtractedAssetCandidate, schema: InferredSchema): boolean {
    const rowData = candidate.normalizedRowData || candidate.rawRowData || {};
    
    const hasMissingFields = this.hasMissingFields(rowData, schema);
    const hasUncertainValues = this.hasUncertainValues(rowData, schema);
    
    return hasMissingFields || hasUncertainValues;
  }

  private hasMissingFields(rowData: Record<string, unknown>, schema: InferredSchema): boolean {
    if (!schema.currencyColumn && !rowData.currency) return true;
    if (!schema.jurisdictionColumn && !rowData.location && !rowData.jurisdiction && !rowData.country) return true;
    if (!schema.assetTypeColumn && !rowData.type && !rowData.asset_type && !rowData.category) return true;
    return false;
  }

  private hasUncertainValues(rowData: Record<string, unknown>, schema: InferredSchema): boolean {
    if (schema.currencyColumn) {
      const currency = rowData[schema.currencyColumn];
      if (currency && typeof currency === 'string' && currency.length !== 3) return true;
    }
    return false;
  }

  queueAmbiguousRow(
    candidate: ExtractedAssetCandidate,
    documentId: string,
    extractionJobId: string | null,
    sourceSheetName?: string,
  ): void {
    this.ambiguousRows.push({
      candidate,
      documentId,
      extractionJobId,
      sourceRowIndex: candidate.sourceRowIndex || 0,
      sourceSheetName,
    });

    if (this.ambiguousRows.length >= this.BATCH_SIZE) {
      this.logger.log('Ambiguous row batch threshold reached', 'EnrichmentCoordinator', {
        batchSize: this.ambiguousRows.length,
      });
    }
  }

  async flushAndEnrich(): Promise<EnrichmentBatchResult> {
    if (this.ambiguousRows.length === 0) {
      return {
        totalProcessed: 0,
        enrichedCount: 0,
        failedCount: 0,
        reviewItemsCount: 0,
        validationFlagsCount: 0,
      };
    }

    this.logger.log('Flushing ambiguous rows for LLM enrichment', 'EnrichmentCoordinator', {
      count: this.ambiguousRows.length,
    });

    const rows = this.ambiguousRows.map(r => r.candidate.normalizedRowData || r.candidate.rawRowData || {});
    const columns = this.extractColumns(this.ambiguousRows.map(r => r.candidate));

    try {
      const result = await this.llmEnrichmentService.enrichExtraction({
        documentId: this.ambiguousRows[0].documentId,
        extractionJobId: this.ambiguousRows[0].extractionJobId,
        columns,
        rows: rows as Record<string, unknown>[],
        sourceSheetName: this.ambiguousRows[0].sourceSheetName,
      });

      await this.persistEnrichmentResults(result);

      const resultSummary: EnrichmentBatchResult = {
        totalProcessed: this.ambiguousRows.length,
        enrichedCount: result.enrichedFields.length,
        failedCount: result.errors.length,
        reviewItemsCount: result.reviewItems.length,
        validationFlagsCount: result.validationFlags.length,
      };

      this.logger.log('Ambiguous row enrichment completed', 'EnrichmentCoordinator', resultSummary as any);

      this.ambiguousRows = [];

      return resultSummary;
    } catch (error) {
      this.logger.error('Ambiguous row enrichment failed', (error as Error).stack, 'EnrichmentCoordinator', {
        error: (error as Error).message,
        rowCount: this.ambiguousRows.length,
      });

      const failedCount = this.ambiguousRows.length;
      this.ambiguousRows = [];

      return {
        totalProcessed: failedCount,
        enrichedCount: 0,
        failedCount,
        reviewItemsCount: 0,
        validationFlagsCount: 0,
      };
    }
  }

  private async persistEnrichmentResults(result: LLMEnrichmentResult): Promise<void> {
    if (result.enrichedFields.length > 0) {
      for (const field of result.enrichedFields) {
        const existingFields = await this.extractedAssetFieldRepository.findByDocumentId(field.documentId);
        const matchingField = existingFields.find(
          f => f.sourceRowIndex === field.sourceRowIndex
        );

        if (matchingField && field.normalizedValue) {
          const mergedNormalized = this.mergeNormalizedValues(
            matchingField.normalizedValue,
            field.normalizedValue,
          );
          
          await this.extractedAssetFieldRepository.update(matchingField.id, {
            normalizedValue: mergedNormalized,
            confidenceScore: field.confidenceScore,
            overallConfidence: field.overallConfidence,
            isInferred: field.isInferred,
            inferenceExplanation: field.inferenceExplanation,
            reviewStatus: field.reviewStatus,
          });
        }
      }
    }

    for (const flag of result.validationFlags) {
      try {
        await this.validationFlagRepository.create(flag as any);
      } catch (error) {
        this.logger.warn('Failed to create validation flag', 'EnrichmentCoordinator', {
          error: (error as Error).message,
        });
      }
    }

    for (const review of result.reviewItems) {
      try {
        await this.reviewQueueRepository.create(review as any);
      } catch (error) {
        this.logger.warn('Failed to create review item', 'EnrichmentCoordinator', {
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

  private mergeNormalizedValues(
    existing: object | string | null,
    newValues: object,
  ): object {
    let existingObj: Record<string, unknown> = {};
    
    if (existing) {
      if (typeof existing === 'string') {
        try {
          existingObj = JSON.parse(existing);
        } catch {
          existingObj = {};
        }
      } else {
        existingObj = existing as Record<string, unknown>;
      }
    }

    return { ...existingObj, ...newValues };
  }

  getQueuedCount(): number {
    return this.ambiguousRows.length;
  }

  hasQueuedRows(): boolean {
    return this.ambiguousRows.length > 0;
  }

  clearQueue(): void {
    this.ambiguousRows = [];
  }
}
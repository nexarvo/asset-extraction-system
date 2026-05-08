import { Injectable } from '@nestjs/common';
import {
  ExtractedAssetCandidate,
  BatchPersistenceResult,
  CsvRowError,
} from '../utils/csv-stream.types';
import {
  ExtractedAssetFieldRepository,
  BulkInsertFieldData,
} from '../repositories/extracted-asset-field.repository';
import {
  ExtractionMethod,
  ExtractedAssetReviewStatus,
} from '../entities/extracted-asset-field.entity';

@Injectable()
export class ExtractionPersistenceService {
  constructor(
    private readonly extractedAssetFieldRepository: ExtractedAssetFieldRepository,
  ) {}

  async persistBatch(
    documentId: string,
    extractionJobId: string | null,
    candidates: ExtractedAssetCandidate[],
    batchSize: number = 500,
  ): Promise<BatchPersistenceResult> {
    const errors: CsvRowError[] = [];
    let savedFields = 0;

    const chunks = this.chunkArray(candidates, batchSize);

    for (const chunk of chunks) {
      const result = await this.persistChunk(
        documentId,
        extractionJobId,
        chunk,
      );
      savedFields += result.savedFields;
      errors.push(...result.errors);
    }

    return { savedAssets: candidates.length, savedFields, errors };
  }

  async persistBatchWithTransaction(
    documentId: string,
    extractionJobId: string | null,
    candidates: ExtractedAssetCandidate[],
  ): Promise<BatchPersistenceResult> {
    const errors: CsvRowError[] = [];
    let savedFields = 0;

    try {
      const fieldsToInsert = this.transformCandidatesToInsertData(
        documentId,
        extractionJobId,
        candidates,
      );

      if (fieldsToInsert.length > 0) {
        savedFields =
          await this.extractedAssetFieldRepository.bulkInsertWithTransaction(
            fieldsToInsert,
          );
      }
    } catch (error) {
      for (const candidate of candidates) {
        errors.push({
          rowIndex: candidate.sourceRowIndex,
          reason: `Batch transaction failed: ${(error as Error).message}`,
        });
      }
      savedFields = 0;
    }

    return { savedAssets: candidates.length, savedFields, errors };
  }

  private async persistChunk(
    documentId: string,
    extractionJobId: string | null,
    candidates: ExtractedAssetCandidate[],
  ): Promise<BatchPersistenceResult> {
    const errors: CsvRowError[] = [];
    let savedFields = 0;

    try {
      const fieldsToInsert = this.transformCandidatesToInsertData(
        documentId,
        extractionJobId,
        candidates,
      );

      if (fieldsToInsert.length > 0) {
        savedFields =
          await this.extractedAssetFieldRepository.bulkInsertWithTransaction(
            fieldsToInsert,
          );
      }
    } catch (error) {
      for (const candidate of candidates) {
        errors.push({
          rowIndex: candidate.sourceRowIndex,
          reason: `Transaction failed: ${(error as Error).message}`,
        });
      }
      savedFields = 0;
    }

    return { savedAssets: candidates.length, savedFields, errors };
  }

  private transformCandidatesToInsertData(
    documentId: string,
    extractionJobId: string | null,
    candidates: ExtractedAssetCandidate[],
  ): BulkInsertFieldData[] {
    const fieldsToInsert: BulkInsertFieldData[] = [];

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      const rawData = candidate.rawRowData || candidate.normalizedRowData;
      if (!rawData || Object.keys(rawData).length === 0) {
        continue;
      }

      const assetName =
        candidate.rawAssetName || `asset_${candidate.sourceRowIndex || 0}`;
      const sourceRow =
        typeof candidate.sourceRowIndex === 'number'
          ? candidate.sourceRowIndex
          : 0;

      fieldsToInsert.push({
        documentId: documentId,
        extractionJobId: extractionJobId || null,
        rawAssetName: assetName,
        overallConfidence: candidate.overallConfidence ?? 0.8,
        reviewStatus: ExtractedAssetReviewStatus.PENDING,
        extractionStrategy: 'TABLE_EXTRACTION',
        fieldName: 'row_data',
        rawValue: candidate.rawRowData
          ? JSON.stringify(candidate.rawRowData)
          : JSON.stringify(candidate.normalizedRowData),
        normalizedValue: candidate.normalizedRowData
          ? JSON.stringify(candidate.normalizedRowData)
          : null,
        confidenceScore: candidate.overallConfidence ?? 0.8,
        extractionMethod: ExtractionMethod.TABLE_EXTRACTION,
        sourceRowIndex: sourceRow,
        sourceSheetName: candidate.sourceSheetName || null,
        isInferred: false,
        createdAt: new Date(),
      });
    }

    return fieldsToInsert;
  }

  async logError(
    processingJobId: string | null,
    stage: string,
    code: string,
    message: string,
    rowIndex?: number,
  ): Promise<void> {
    console.error(`[ExtractionError] ${stage}:${code} - ${message}`, {
      processingJobId,
      rowIndex,
    });
  }

  async checkIdempotency(
    documentId: string,
    rowIndex: number,
  ): Promise<boolean> {
    const fields =
      await this.extractedAssetFieldRepository.findByDocumentId(documentId);
    return fields.some((f) => f.sourceRowIndex === rowIndex);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

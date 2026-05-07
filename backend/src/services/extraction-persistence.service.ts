import { Injectable } from '@nestjs/common';
import { ExtractedAssetCandidate, BatchPersistenceResult, CsvRowError } from '../utils/csv-stream.types';
import { ExtractedAssetFieldRepository } from '../repositories/extracted-asset-field.repository';
import { ExtractionErrorRepository } from '../repositories/extraction-error.repository';
import { ExtractedAssetFieldEntity, ExtractionMethod, ExtractedAssetReviewStatus } from '../entities/extracted-asset-field.entity';

@Injectable()
export class ExtractionPersistenceService {
  constructor(
    private readonly extractedAssetFieldRepository: ExtractedAssetFieldRepository,
    private readonly extractionErrorRepository: ExtractionErrorRepository,
  ) {}

  async persistBatch(
    documentId: string,
    extractionJobId: string | null,
    candidates: ExtractedAssetCandidate[],
    batchSize: number = 100,
  ): Promise<BatchPersistenceResult> {
    const errors: CsvRowError[] = [];
    let savedFields = 0;

    const chunks = this.chunkArray(candidates, batchSize);

    for (const chunk of chunks) {
      const result = await this.persistChunk(documentId, extractionJobId, chunk);
      savedFields += result.savedFields;
      errors.push(...result.errors);
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
      const fieldsToInsert: Partial<ExtractedAssetFieldEntity>[] = [];

      for (const candidate of candidates) {
        for (const field of candidate.fields) {
          fieldsToInsert.push({
            documentId,
            extractionJobId: extractionJobId || null,
            rawAssetName: candidate.rawAssetName || null,
            overallConfidence: candidate.overallConfidence ?? null,
            reviewStatus: ExtractedAssetReviewStatus.PENDING,
            extractionStrategy: 'TABLE_EXTRACTION',
            fieldName: field.fieldName,
            rawValue: field.rawValue,
            normalizedValue: field.normalizedValue !== undefined ? field.normalizedValue as object : null,
            confidenceScore: field.confidenceScore ?? null,
            extractionMethod: field.confidenceScore !== undefined ? ExtractionMethod.TABLE_EXTRACTION : null,
            sourceRowIndex: candidate.sourceRowIndex,
            sourceSheetName: candidate.sourceSheetName || null,
          });
        }
      }

      if (fieldsToInsert.length > 0) {
        await this.extractedAssetFieldRepository.createMany(fieldsToInsert);
        savedFields = fieldsToInsert.length;
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

  async logError(
    processingJobId: string | null,
    stage: string,
    code: string,
    message: string,
    rowIndex?: number,
  ): Promise<void> {
    await this.extractionErrorRepository.create({
      processingJobId: processingJobId || undefined,
      errorStage: stage,
      errorCode: code,
      message: message,
      recoverable: false,
    });
  }

  async checkIdempotency(documentId: string, rowIndex: number): Promise<boolean> {
    const fields = await this.extractedAssetFieldRepository.findByDocumentId(documentId);
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
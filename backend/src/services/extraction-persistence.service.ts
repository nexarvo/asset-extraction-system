import { Injectable } from '@nestjs/common';
import { ExtractedAssetCandidate, BatchPersistenceResult, CsvRowError } from '../utils/csv-stream.types';
import { ExtractedAssetRepository } from '../repositories/extracted-asset.repository';
import { ExtractedAssetFieldRepository } from '../repositories/extracted-asset-field.repository';
import { ExtractionErrorRepository } from '../repositories/extraction-error.repository';
import { ExtractedAssetEntity } from '../entities/extracted-asset.entity';
import { ExtractedAssetFieldEntity } from '../entities/extracted-asset-field.entity';
import { ExtractionErrorEntity } from '../entities/extraction-error.entity';
import { ExtractedAssetReviewStatus } from '../entities/extracted-asset.entity';
import { ExtractionMethod } from '../entities/extracted-asset-field.entity';

@Injectable()
export class ExtractionPersistenceService {
  constructor(
    private readonly extractedAssetRepository: ExtractedAssetRepository,
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
    let savedAssets = 0;
    let savedFields = 0;

    const chunks = this.chunkArray(candidates, batchSize);

    for (const chunk of chunks) {
      const result = await this.persistChunk(documentId, extractionJobId, chunk);
      savedAssets += result.savedAssets;
      savedFields += result.savedFields;
      errors.push(...result.errors);
    }

    return { savedAssets, savedFields, errors };
  }

  private async persistChunk(
    documentId: string,
    extractionJobId: string | null,
    candidates: ExtractedAssetCandidate[],
  ): Promise<BatchPersistenceResult> {
    const errors: CsvRowError[] = [];
    let savedAssets = 0;
    let savedFields = 0;

    try {
      for (const candidate of candidates) {
        try {
          const asset = await this.extractedAssetRepository.create({
            documentId,
            extractionJobId: extractionJobId || undefined,
            rawAssetName: candidate.rawAssetName,
            overallConfidence: candidate.overallConfidence,
            reviewStatus: ExtractedAssetReviewStatus.PENDING,
            extractionStrategy: 'TABLE_EXTRACTION',
          });
          savedAssets++;

          const fields = candidate.fields.map((field) => ({
            extractedAssetId: asset.id,
            fieldName: field.fieldName,
            rawValue: field.rawValue,
            normalizedValue: field.normalizedValue !== undefined ? field.normalizedValue as object : undefined,
            confidenceScore: field.confidenceScore,
            extractionMethod: field.confidenceScore !== undefined ? ExtractionMethod.TABLE_EXTRACTION : undefined,
          }));

          if (fields.length > 0) {
            await this.extractedAssetFieldRepository.createMany(fields);
            savedFields += fields.length;
          }
        } catch (error) {
          errors.push({
            rowIndex: candidate.sourceRowIndex,
            reason: `Failed to save asset: ${(error as Error).message}`,
            rawData: { rawAssetName: candidate.rawAssetName },
          });
        }
      }
    } catch (error) {
      for (const candidate of candidates) {
        errors.push({
          rowIndex: candidate.sourceRowIndex,
          reason: `Transaction failed: ${(error as Error).message}`,
        });
      }
      savedAssets = 0;
      savedFields = 0;
    }

    return { savedAssets, savedFields, errors };
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
    const assets = await this.extractedAssetRepository.findByDocumentId(documentId);
    return assets.some((a) => a.rawAssetName?.includes(`row_${rowIndex}`));
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
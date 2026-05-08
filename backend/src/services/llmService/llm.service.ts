import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnrichmentService } from './enrichment.service';
import { LLMValidationHelper } from '../../helpers/llm-validation.helper';
import { LLMReviewHelper } from '../../helpers/llm-review.helper';
import {
  RowEnrichmentInput,
  InferredSchemaV2,
  EnrichmentMetadata,
  ConfidenceScoreResult,
} from './dto/enrichment.dto';
import { ValidationResult } from './dto/validation.dto';
import { AppLoggerService } from '../../core/app-logger.service';
import {
  ExtractionMethod,
  ExtractedAssetReviewStatus,
} from '../../entities/extracted-asset-field.entity';
import { ReviewQueueEntity } from '../../entities/review-queue.entity';
import { ValidationFlagEntity } from '../../entities/validation-flag.entity';
import { ExtractedAssetFieldRepository } from '../../repositories/extracted-asset-field.repository';
import { ReviewQueueRepository } from '../../repositories/review-queue.repository';
import { ValidationFlagRepository } from '../../repositories/validation-flag.repository';
import {
  LLMConfig,
  LLMProvider as ProviderEnum,
} from '../../core/config/llm.config';

export interface LLMEnrichmentInput {
  documentId: string;
  extractionJobId: string | null;
  columns: string[];
  rows: Record<string, unknown>[];
  sourceSheetName?: string;
}

export interface LLMEnrichmentResult {
  enrichedFields: EnrichedFieldData[];
  reviewItems: Partial<ReviewQueueEntity>[];
  validationFlags: Partial<ValidationFlagEntity>[];
  schema: InferredSchemaV2;
  errors: string[];
}

export interface EnrichedFieldData {
  documentId: string;
  extractionJobId: string | null;
  rawAssetName: string;
  fieldName: string;
  rawValue: string;
  normalizedValue: object | null;
  confidenceScore: number;
  overallConfidence: number;
  extractionMethod: ExtractionMethod;
  reviewStatus: ExtractedAssetReviewStatus;
  isInferred: boolean;
  inferenceExplanation: string | null;
  sourceRowIndex: number;
  sourceSheetName?: string;
  metadata: EnrichmentMetadata;
}

@Injectable()
export class LLMEnrichmentService {
  private readonly validationHelper = new LLMValidationHelper();
  private readonly reviewHelper = new LLMReviewHelper();

  constructor(
    private enrichmentService: EnrichmentService,
    private configService: ConfigService,
    private logger: AppLoggerService,
    private extractedAssetFieldRepository: ExtractedAssetFieldRepository,
    private reviewQueueRepository: ReviewQueueRepository,
    private validationFlagRepository: ValidationFlagRepository,
  ) {}

  async enrichExtraction(
    input: LLMEnrichmentInput,
  ): Promise<LLMEnrichmentResult> {
    const config = this.configService.get<LLMConfig>('llm');
    const useLLM = config?.provider !== undefined && config.provider !== null;

    if (!useLLM || !this.isLLMProviderConfigured(config)) {
      this.logger.log(
        'LLM not configured, skipping enrichment',
        'LLMEnrichmentService',
      );
      const emptySchema: InferredSchemaV2 = {
        columns: [],
        fieldMapping: {},
        unmappedColumns: [],
        schemaQuality: { completeness: 0, ambiguityScore: 0, deterministicCoverage: 0, needsReview: true },
        inferenceNotes: [],
      };

      return {
        enrichedFields: [],
        reviewItems: [],
        validationFlags: [],
        schema: emptySchema,
        errors: ['LLM provider not configured'],
      };
    }

    this.logger.log('Starting LLM enrichment', 'LLMEnrichmentService', {
      documentId: input.documentId,
      rowCount: input.rows.length,
    });

    const rowInputs: RowEnrichmentInput[] = input.rows.map((row, index) => ({
      rowData: row,
      sourceRowIndex: index + 1,
      sourceSheetName: input.sourceSheetName,
    }));

    try {
      const { schema, enrichedRows, errors } =
        await this.enrichmentService.inferSchemaAndEnrich(
          input.columns,
          input.rows.slice(0, 10),
          rowInputs,
        );

      const enrichedFields: EnrichedFieldData[] = [];
      const reviewItems: Partial<ReviewQueueEntity>[] = [];
      const validationFlags: Partial<ValidationFlagEntity>[] = [];

      for (let i = 0; i < enrichedRows.length; i++) {
        const enrichment = enrichedRows[i];
        const originalRow = input.rows[i];
        const fieldId = `field_${input.documentId}_${i}`;

        const validation =
          this.validationHelper.validateEnrichmentOutput(enrichment);

        const confidence = this.validationHelper.calculateConfidence(
          enrichment,
          validation,
          schema,
          originalRow,
        );

        const fieldData = this.createEnrichedFieldData(
          input.documentId,
          input.extractionJobId,
          originalRow,
          schema,
          enrichment,
          confidence,
          fieldId,
          input.sourceSheetName,
        );

        enrichedFields.push(fieldData);

        if (validation.issues.length > 0) {
          const criticalIssues = validation.issues.filter(
            (i) => i.severity === 'critical' || i.severity === 'high',
          );
          const flagType =
            criticalIssues.length > 0
              ? criticalIssues[0].code
              : validation.issues[0]?.code || 'VALIDATION_ERROR';
          const explanation = validation.issues
            .map((i) => `${i.field}: ${i.message}`)
            .join('; ');
          const maxSeverity = validation.issues.reduce((max, issue) => {
            const severityOrder = ['low', 'medium', 'high', 'critical'];
            return severityOrder.indexOf(issue.severity) > severityOrder.indexOf(max)
              ? issue.severity
              : max;
          }, 'low');

          const severityMap: Record<string, string> = {
            critical: 'CRITICAL',
            high: 'HIGH',
            medium: 'MEDIUM',
            low: 'LOW',
          };

          validationFlags.push({
            entityType: 'extracted_asset_field',
            entityId: fieldId,
            flagType,
            severity: severityMap[maxSeverity] as any,
            explanation,
          });
        }

        const reviewInput = {
          entityId: fieldId,
          entityType: 'extracted_asset_field',
          confidence,
          validation,
          enrichmentExplanation: enrichment.explanation,
        };

        const reviewResult = this.reviewHelper.shouldEscalate(reviewInput);
        if (reviewResult.shouldEscalate) {
          reviewItems.push({
            entityType: 'extracted_asset_field',
            entityId: fieldId,
            reviewReason: reviewResult.reason,
            priority: reviewResult.priority,
            status: 'pending' as any,
          });
        }
      }

      this.logger.log('LLM enrichment completed', 'LLMEnrichmentService', {
        documentId: input.documentId,
        enrichedFields: enrichedFields.length,
        reviewItems: reviewItems.length,
        validationFlags: validationFlags.length,
        errors: errors.length,
      });

      return {
        enrichedFields,
        reviewItems,
        validationFlags,
        schema,
        errors: errors.map((e) => e.reason),
      };
    } catch (error) {
      this.logger.error(
        'LLM enrichment failed',
        (error as Error).stack,
        'LLMEnrichmentService',
        {
          documentId: input.documentId,
          error: (error as Error).message,
        },
      );

      const emptySchema: InferredSchemaV2 = {
        columns: [],
        fieldMapping: {},
        unmappedColumns: [],
        schemaQuality: { completeness: 0, ambiguityScore: 0, deterministicCoverage: 0, needsReview: true },
        inferenceNotes: [],
      };

      return {
        enrichedFields: [],
        reviewItems: [],
        validationFlags: [],
        schema: emptySchema,
        errors: [(error as Error).message],
      };
    }
  }

  private isLLMProviderConfigured(
    config: LLMConfig | undefined | null,
  ): boolean {
    if (!config) return false;

    switch (config.provider) {
      case ProviderEnum.OPENAI:
        return !!config.openai?.apiKey;
      case ProviderEnum.ANTHROPIC:
        return !!config.anthropic?.apiKey;
      case ProviderEnum.GOOGLE:
        return !!config.google?.apiKey;
      case ProviderEnum.OLLAMA:
        return !!config.ollama?.baseUrl;
      default:
        return false;
    }
  }

  private createEnrichedFieldData(
    documentId: string,
    extractionJobId: string | null,
    originalRow: Record<string, unknown>,
    schema: InferredSchemaV2,
    enrichment: any,
    confidence: ConfidenceScoreResult,
    fieldId: string,
    sourceSheetName?: string,
  ): EnrichedFieldData {
    const assetNameCol = schema.fieldMapping.assetNameColumn?.column ?? null;
    const assetName =
      enrichment.normalizedAssetName ||
      (originalRow[assetNameCol || 'asset_name'] as string) ||
      `asset_${fieldId}`;
    const fieldName = 'enriched_asset_data';

    const normalizedValue: Record<string, unknown> = {};
    if (enrichment.normalizedAssetName)
      normalizedValue.normalizedAssetName = enrichment.normalizedAssetName;
    if (enrichment.currency) normalizedValue.currency = enrichment.currency;
    if (enrichment.assetType) normalizedValue.assetType = enrichment.assetType;
    if (enrichment.jurisdiction)
      normalizedValue.jurisdiction = enrichment.jurisdiction;
    if (enrichment.latitude !== undefined)
      normalizedValue.latitude = enrichment.latitude;
    if (enrichment.longitude !== undefined)
      normalizedValue.longitude = enrichment.longitude;
    normalizedValue.confidenceSignals = enrichment.confidenceSignals;

    return {
      documentId,
      extractionJobId,
      rawAssetName: String(assetName),
      fieldName,
      rawValue: JSON.stringify(originalRow),
      normalizedValue,
      confidenceScore: confidence.overallConfidence,
      overallConfidence: confidence.overallConfidence,
      extractionMethod: ExtractionMethod.LLM_EXTRACTION,
      reviewStatus:
        confidence.overallConfidence < 0.65
          ? ExtractedAssetReviewStatus.REQUIRES_REVIEW
          : ExtractedAssetReviewStatus.AUTO_APPROVED,
      isInferred: true,
      inferenceExplanation:
        enrichment.explanation || confidence.confidenceExplanation,
      sourceRowIndex: (originalRow['sourceRowIndex'] as number) || 0,
      sourceSheetName,
      metadata: {
        extractionModel: 'llm_enrichment',
        extractionStrategy: 'llm_inference',
        inferenceExplanation: enrichment.explanation,
      },
    };
  }

  async persistEnrichmentResults(result: LLMEnrichmentResult): Promise<void> {
    if (result.enrichedFields.length > 0) {
      const bulkData = result.enrichedFields.map((field) => ({
        documentId: field.documentId,
        extractionJobId: field.extractionJobId,
        extractionStrategy: field.metadata.extractionStrategy,
        extractionModel: field.metadata.extractionModel,
        rawAssetName: field.rawAssetName,
        overallConfidence: field.overallConfidence,
        reviewStatus: field.reviewStatus,
        fieldName: field.fieldName,
        rawValue: field.rawValue,
        normalizedValue: field.normalizedValue
          ? JSON.stringify(field.normalizedValue)
          : null,
        confidenceScore: field.confidenceScore,
        extractionMethod: field.extractionMethod,
        isInferred: field.isInferred,
        inferenceExplanation: field.inferenceExplanation,
        sourceRowIndex: field.sourceRowIndex,
        sourceSheetName: field.sourceSheetName || null,
        createdAt: new Date(),
      }));

      await this.extractedAssetFieldRepository.bulkInsertWithTransaction(
        bulkData,
      );
    }

    if (result.validationFlags.length > 0) {
      for (const flag of result.validationFlags) {
        await this.validationFlagRepository.create(flag);
      }
    }

    if (result.reviewItems.length > 0) {
      for (const review of result.reviewItems) {
        await this.reviewQueueRepository.create(review);
      }
    }
  }
}

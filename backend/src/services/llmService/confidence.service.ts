import { Injectable } from '@nestjs/common';
import type {
  RowEnrichmentOutput,
  ConfidenceScoreResult,
  ConfidenceFactor,
  InferredSchema,
} from './dto/enrichment.dto';
import type { ValidationResult } from './dto/validation.dto';

const CONFIDENCE_THRESHOLD = 0.65;

@Injectable()
export class ConfidenceService {
  calculateConfidence(
    enrichmentOutput: RowEnrichmentOutput,
    validationResult: ValidationResult,
    schema: InferredSchema,
    originalRowData: Record<string, unknown>,
  ): ConfidenceScoreResult {
    const factors: ConfidenceFactor[] = [];
    let score = 0.5;

    const exactMappingScore = this.calculateExactColumnMappingScore(
      schema,
      enrichmentOutput,
    );
    score += exactMappingScore.score;
    if (exactMappingScore.factor) {
      factors.push(exactMappingScore.factor);
    }

    const deterministicScore = this.calculateDeterministicScore(
      enrichmentOutput,
      originalRowData,
    );
    score += deterministicScore.score;
    if (deterministicScore.factor) {
      factors.push(deterministicScore.factor);
    }

    const inferenceScore = this.calculateInferenceScore(
      enrichmentOutput.confidenceSignals,
    );
    score += inferenceScore.score;
    if (inferenceScore.factor) {
      factors.push(inferenceScore.factor);
    }

    const missingFieldScore = this.calculateMissingFieldScore(
      enrichmentOutput,
      schema,
    );
    score += missingFieldScore.score;
    if (missingFieldScore.factor) {
      factors.push(missingFieldScore.factor);
    }

    const validationScore = this.calculateValidationScore(validationResult);
    score += validationScore.score;
    if (validationScore.factor) {
      factors.push(validationScore.factor);
    }

    const reviewScore = this.calculateReviewScore(enrichmentOutput.needsReview);
    score += reviewScore.score;
    if (reviewScore.factor) {
      factors.push(reviewScore.factor);
    }

    const finalScore = Math.max(0, Math.min(1, score));

    const fieldConfidence: Record<string, number> = {
      assetName: enrichmentOutput.normalizedAssetName ? 0.9 : 0.3,
      currency: enrichmentOutput.currency
        ? enrichmentOutput.confidenceSignals.currencyInferred
          ? 0.7
          : 0.9
        : 0.3,
      assetType: enrichmentOutput.assetType
        ? enrichmentOutput.confidenceSignals.assetTypeInferred
          ? 0.7
          : 0.9
        : 0.3,
      jurisdiction: enrichmentOutput.jurisdiction
        ? enrichmentOutput.confidenceSignals.jurisdictionInferred
          ? 0.7
          : 0.9
        : 0.3,
      coordinates:
        enrichmentOutput.latitude && enrichmentOutput.longitude ? 0.9 : 0.3,
    };

    const confidenceExplanation = this.generateConfidenceExplanation(
      factors,
      finalScore,
    );

    return {
      fieldConfidence,
      overallConfidence: finalScore,
      confidenceExplanation,
      confidenceFactors: factors,
    };
  }

  needsReviewEscalation(confidence: number): boolean {
    return confidence < CONFIDENCE_THRESHOLD;
  }

  private calculateExactColumnMappingScore(
    schema: InferredSchema,
    enrichmentOutput: RowEnrichmentOutput,
  ): { score: number; factor?: ConfidenceFactor } {
    let mappedFields = 0;
    let totalFields = 0;

    if (schema.assetNameColumn) {
      totalFields++;
      if (enrichmentOutput.normalizedAssetName) mappedFields++;
    }
    if (schema.valueColumn) {
      totalFields++;
      if (enrichmentOutput.currency) mappedFields++;
    }
    if (schema.currencyColumn) {
      totalFields++;
      if (enrichmentOutput.currency) mappedFields++;
    }
    if (schema.jurisdictionColumn) {
      totalFields++;
      if (enrichmentOutput.jurisdiction) mappedFields++;
    }
    if (schema.latitudeColumn && schema.longitudeColumn) {
      totalFields++;
      if (
        enrichmentOutput.latitude !== undefined &&
        enrichmentOutput.longitude !== undefined
      )
        mappedFields++;
    }

    if (totalFields === 0) {
      return { score: 0 };
    }

    const ratio = mappedFields / totalFields;
    if (ratio >= 0.8) {
      return {
        score: 0.3,
        factor: {
          factor: 'exact_column_mapping',
          score: 0.3,
          reason: `${mappedFields}/${totalFields} fields mapped via exact column match`,
        },
      };
    } else if (ratio >= 0.5) {
      return {
        score: 0.1,
        factor: {
          factor: 'partial_column_mapping',
          score: 0.1,
          reason: `${mappedFields}/${totalFields} fields mapped via column match`,
        },
      };
    }

    return { score: 0 };
  }

  private calculateDeterministicScore(
    enrichmentOutput: RowEnrichmentOutput,
    originalRowData: Record<string, unknown>,
  ): { score: number; factor?: ConfidenceFactor } {
    if (enrichmentOutput.confidenceSignals.exactValueMatch) {
      return {
        score: 0.2,
        factor: {
          factor: 'deterministic_parse',
          score: 0.2,
          reason: 'Values matched exactly without inference',
        },
      };
    }

    return { score: 0 };
  }

  private calculateInferenceScore(
    signals: RowEnrichmentOutput['confidenceSignals'],
  ): { score: number; factor?: ConfidenceFactor } {
    let inferenceCount = 0;
    let totalSignals = 0;

    if (signals.currencyInferred !== undefined) {
      totalSignals++;
      if (signals.currencyInferred) inferenceCount++;
    }
    if (signals.assetTypeInferred !== undefined) {
      totalSignals++;
      if (signals.assetTypeInferred) inferenceCount++;
    }
    if (signals.jurisdictionInferred !== undefined) {
      totalSignals++;
      if (signals.jurisdictionInferred) inferenceCount++;
    }
    if (signals.coordinatesInferred !== undefined) {
      totalSignals++;
      if (signals.coordinatesInferred) inferenceCount++;
    }

    if (totalSignals === 0) {
      return { score: 0 };
    }

    const ratio = inferenceCount / totalSignals;
    if (ratio >= 0.5) {
      return {
        score: -0.2,
        factor: {
          factor: 'llm_inference_required',
          score: -0.2,
          reason: `${inferenceCount}/${totalSignals} fields required LLM inference`,
        },
      };
    }

    return { score: 0 };
  }

  private calculateMissingFieldScore(
    enrichmentOutput: RowEnrichmentOutput,
    schema: InferredSchema,
  ): { score: number; factor?: ConfidenceFactor } {
    const hasAllExpectedFields =
      (schema.assetNameColumn
        ? enrichmentOutput.normalizedAssetName !== undefined
        : true) &&
      (schema.currencyColumn
        ? enrichmentOutput.currency !== undefined
        : true) &&
      (schema.jurisdictionColumn
        ? enrichmentOutput.jurisdiction !== undefined
        : true);

    if (
      !hasAllExpectedFields ||
      enrichmentOutput.confidenceSignals.fieldMissing
    ) {
      return {
        score: -0.3,
        factor: {
          factor: 'missing_fields',
          score: -0.3,
          reason: 'Expected fields are missing or could not be inferred',
        },
      };
    }

    return { score: 0 };
  }

  private calculateValidationScore(validationResult: ValidationResult): {
    score: number;
    factor?: ConfidenceFactor;
  } {
    if (validationResult.confidencePenalty !== 0) {
      return {
        score: validationResult.confidencePenalty,
        factor: {
          factor: 'validation_issue',
          score: validationResult.confidencePenalty,
          reason: `Validation issues detected: ${validationResult.issues.length} issues`,
        },
      };
    }

    if (!validationResult.valid) {
      return {
        score: -0.2,
        factor: {
          factor: 'validation_failed',
          score: -0.2,
          reason: 'Validation failed for one or more fields',
        },
      };
    }

    return { score: 0 };
  }

  private calculateReviewScore(needsReview: boolean): {
    score: number;
    factor?: ConfidenceFactor;
  } {
    if (needsReview) {
      return {
        score: -0.3,
        factor: {
          factor: 'review_escalation_triggered',
          score: -0.3,
          reason: 'LLM marked this row for human review',
        },
      };
    }

    return { score: 0 };
  }

  private generateConfidenceExplanation(
    factors: ConfidenceFactor[],
    score: number,
  ): string {
    const positiveFactors = factors
      .filter((f) => f.score > 0)
      .map((f) => f.reason);
    const negativeFactors = factors
      .filter((f) => f.score < 0)
      .map((f) => f.reason);

    let explanation = `Overall confidence: ${(score * 100).toFixed(0)}%. `;

    if (positiveFactors.length > 0) {
      explanation += `Positive signals: ${positiveFactors.join('; ')}. `;
    }

    if (negativeFactors.length > 0) {
      explanation += `Negative signals: ${negativeFactors.join('; ')}.`;
    }

    return explanation;
  }
}

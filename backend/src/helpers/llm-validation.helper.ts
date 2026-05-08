import type {
  RowEnrichmentOutput,
  ConfidenceScoreResult,
  ConfidenceFactor,
  InferredSchema,
} from '../services/llmService/dto/enrichment.dto';
import type { ValidationResult, ValidationIssue, ValidationSeverity } from '../services/llmService/dto/validation.dto';

const VALID_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'BRL',
  'MXN', 'SGD', 'HKD', 'KRW', 'SEK', 'NOK', 'DKK', 'NZD', 'ZAR', 'RUB',
  'IDR', 'MYR', 'PHP', 'THB', 'VND', 'AED', 'SAR', 'ILS', 'TRY',
];

const MAX_COORDINATE_PRECISION = 6;
const CONFIDENCE_THRESHOLD = 0.65;

export class LLMValidationHelper {
  validateEnrichmentOutput(output: RowEnrichmentOutput): ValidationResult {
    const issues: ValidationIssue[] = [];

    if (output.latitude !== undefined && output.latitude !== null) {
      const latValidation = this.validateLatitude(output.latitude);
      if (!latValidation.valid && latValidation.issue) {
        issues.push(latValidation.issue);
      }
    }

    if (output.longitude !== undefined && output.longitude !== null) {
      const lngValidation = this.validateLongitude(output.longitude);
      if (!lngValidation.valid && lngValidation.issue) {
        issues.push(lngValidation.issue);
      }
    }

    if (output.currency !== undefined && output.currency !== null) {
      const currencyValidation = this.validateCurrency(output.currency);
      if (!currencyValidation.valid && currencyValidation.issue) {
        issues.push(currencyValidation.issue);
      }
    }

    if (
      output.normalizedAssetName !== undefined &&
      output.normalizedAssetName !== null
    ) {
      if (output.normalizedAssetName.trim().length === 0) {
        issues.push({
          field: 'normalizedAssetName',
          severity: 'high',
          message: 'Asset name cannot be empty',
          code: 'EMPTY_ASSET_NAME',
        });
      }
    }

    const confidencePenalty = this.calculateValidationPenalty(issues);

    return {
      valid:
        issues.filter((i) => i.severity === 'critical' || i.severity === 'high')
          .length === 0,
      issues,
      confidencePenalty,
    };
  }

  private validateLatitude(lat: number): {
    valid: boolean;
    issue?: ValidationIssue;
  } {
    if (isNaN(lat) || !isFinite(lat)) {
      return {
        valid: false,
        issue: {
          field: 'latitude',
          severity: 'critical' as ValidationSeverity,
          message: 'Latitude is not a valid number',
          code: 'INVALID_LATITUDE',
        },
      };
    }

    if (lat < -90 || lat > 90) {
      return {
        valid: false,
        issue: {
          field: 'latitude',
          severity: 'critical' as ValidationSeverity,
          message: `Latitude ${lat} is out of range (-90 to 90)`,
          code: 'LATITUDE_OUT_OF_RANGE',
        },
      };
    }

    const decimals = this.countDecimalPlaces(lat);
    if (decimals > MAX_COORDINATE_PRECISION) {
      return {
        valid: false,
        issue: {
          field: 'latitude',
          severity: 'low' as ValidationSeverity,
          message: `Latitude has excessive precision (${decimals} decimals)`,
          code: 'EXCESSIVE_COORDINATE_PRECISION',
        },
      };
    }

    return { valid: true };
  }

  private validateLongitude(lng: number): {
    valid: boolean;
    issue?: ValidationIssue;
  } {
    if (isNaN(lng) || !isFinite(lng)) {
      return {
        valid: false,
        issue: {
          field: 'longitude',
          severity: 'critical' as ValidationSeverity,
          message: 'Longitude is not a valid number',
          code: 'INVALID_LONGITUDE',
        },
      };
    }

    if (lng < -180 || lng > 180) {
      return {
        valid: false,
        issue: {
          field: 'longitude',
          severity: 'critical' as ValidationSeverity,
          message: `Longitude ${lng} is out of range (-180 to 180)`,
          code: 'LONGITUDE_OUT_OF_RANGE',
        },
      };
    }

    const decimals = this.countDecimalPlaces(lng);
    if (decimals > MAX_COORDINATE_PRECISION) {
      return {
        valid: false,
        issue: {
          field: 'longitude',
          severity: 'low' as ValidationSeverity,
          message: `Longitude has excessive precision (${decimals} decimals)`,
          code: 'EXCESSIVE_COORDINATE_PRECISION',
        },
      };
    }

    return { valid: true };
  }

  private validateCurrency(currency: string): {
    valid: boolean;
    issue?: ValidationIssue;
  } {
    if (!currency || currency.length !== 3) {
      return {
        valid: false,
        issue: {
          field: 'currency',
          severity: 'high' as ValidationSeverity,
          message: 'Currency must be a 3-letter code',
          code: 'INVALID_CURRENCY_FORMAT',
        },
      };
    }

    const upperCurrency = currency.toUpperCase();
    if (!VALID_CURRENCIES.includes(upperCurrency)) {
      return {
        valid: false,
        issue: {
          field: 'currency',
          severity: 'medium' as ValidationSeverity,
          message: `Currency ${upperCurrency} is not in the standard currency list`,
          code: 'UNKNOWN_CURRENCY',
        },
      };
    }

    return { valid: true };
  }

  private countDecimalPlaces(num: number): number {
    const str = num.toString();
    if (str.includes('.')) {
      return str.split('.')[1].length;
    }
    return 0;
  }

  private calculateValidationPenalty(issues: ValidationIssue[]): number {
    let penalty = 0;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          penalty -= 0.4;
          break;
        case 'high':
          penalty -= 0.3;
          break;
        case 'medium':
          penalty -= 0.2;
          break;
        case 'low':
          penalty -= 0.1;
          break;
      }
    }

    return Math.max(penalty, -1);
  }

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
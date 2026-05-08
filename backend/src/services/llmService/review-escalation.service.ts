import { Injectable } from '@nestjs/common';
import type { ConfidenceScoreResult } from './dto/enrichment.dto';
import type { ValidationResult } from './dto/validation.dto';
import {
  ReviewQueueEntity,
  ReviewQueueStatus,
} from '../../entities/review-queue.entity';

export interface ReviewEscalationInput {
  entityId: string;
  entityType: string;
  confidence: ConfidenceScoreResult;
  validation: ValidationResult;
  enrichmentExplanation?: string;
}

export interface ReviewEscalationResult {
  shouldEscalate: boolean;
  reason?: string;
  priority: number;
  reviewData?: Partial<ReviewQueueEntity>;
}

const CONFIDENCE_THRESHOLD = 0.65;
const VALIDATION_THRESHOLD = 2;

@Injectable()
export class ReviewEscalationService {
  shouldEscalate(input: ReviewEscalationInput): ReviewEscalationResult {
    const reasons: string[] = [];
    let priority = 0;

    if (input.confidence.overallConfidence < CONFIDENCE_THRESHOLD) {
      reasons.push(
        `Low confidence score: ${(input.confidence.overallConfidence * 100).toFixed(0)}%`,
      );
      priority = Math.max(priority, 2);
    }

    const criticalValidationIssues = input.validation.issues.filter(
      (i) => i.severity === 'critical' || i.severity === 'high',
    );
    if (criticalValidationIssues.length > 0) {
      reasons.push(
        `Validation issues: ${criticalValidationIssues.map((i) => i.field).join(', ')}`,
      );
      priority = Math.max(priority, 3);
    }

    if (input.validation.issues.length >= VALIDATION_THRESHOLD) {
      reasons.push(
        `Multiple validation issues: ${input.validation.issues.length} total`,
      );
      priority = Math.max(priority, 2);
    }

    const hasInvalidCoordinates = input.validation.issues.some(
      (i) => i.code.includes('LATITUDE') || i.code.includes('LONGITUDE'),
    );
    if (hasInvalidCoordinates) {
      reasons.push('Invalid coordinates detected');
      priority = Math.max(priority, 2);
    }

    const hasInvalidCurrency = input.validation.issues.some((i) =>
      i.code.includes('CURRENCY'),
    );
    if (hasInvalidCurrency) {
      reasons.push('Invalid or unknown currency');
      priority = Math.max(priority, 1);
    }

    if (!input.validation.valid) {
      reasons.push('Deterministic validation failed');
      priority = Math.max(priority, 2);
    }

    const ambiguousInferences = input.confidence.confidenceFactors.filter(
      (f) => f.factor === 'llm_inference_required',
    );
    if (ambiguousInferences.length >= 2) {
      reasons.push('Multiple fields required LLM inference');
      priority = Math.max(priority, 1);
    }

    if (reasons.length === 0) {
      return { shouldEscalate: false, priority: 0 };
    }

    const reason = reasons.join('; ');

    return {
      shouldEscalate: true,
      reason,
      priority,
      reviewData: {
        entityType: input.entityType,
        entityId: input.entityId,
        reviewReason: reason,
        priority,
        status: ReviewQueueStatus.PENDING,
      },
    };
  }

  createReviewEntry(
    input: ReviewEscalationInput,
  ): Partial<ReviewQueueEntity> | null {
    const escalation = this.shouldEscalate(input);

    if (!escalation.shouldEscalate || !escalation.reviewData) {
      return null;
    }

    return {
      entityType: input.entityType,
      entityId: input.entityId,
      reviewReason: escalation.reason,
      priority: escalation.priority,
      status: ReviewQueueStatus.PENDING,
    };
  }
}

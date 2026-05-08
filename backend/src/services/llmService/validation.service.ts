import { Injectable } from '@nestjs/common';
import type { RowEnrichmentOutput } from './dto/enrichment.dto';
import type {
  ValidationResult,
  ValidationIssue,
  ValidationSeverity,
} from './dto/validation.dto';
import {
  ValidationFlagEntity,
  ValidationFlagSeverity,
} from '../../entities/validation-flag.entity';

const VALID_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'INR',
  'BRL',
  'MXN',
  'SGD',
  'HKD',
  'KRW',
  'SEK',
  'NOK',
  'DKK',
  'NZD',
  'ZAR',
  'RUB',
  'INR',
  'IDR',
  'MYR',
  'PHP',
  'THB',
  'VND',
  'AED',
  'SAR',
  'ILS',
  'TRY',
];

const MAX_COORDINATE_PRECISION = 6;

@Injectable()
export class ValidationService {
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

  createValidationFlag(
    entityId: string,
    entityType: string,
    issues: ValidationIssue[],
  ): Partial<ValidationFlagEntity> {
    const criticalIssues = issues.filter(
      (i) => i.severity === 'critical' || i.severity === 'high',
    );

    const flagType =
      criticalIssues.length > 0
        ? criticalIssues[0].code
        : issues[0]?.code || 'VALIDATION_ERROR';
    const explanation = issues
      .map((i) => `${i.field}: ${i.message}`)
      .join('; ');

    const maxSeverity = issues.reduce((max, issue) => {
      const severityOrder: ValidationSeverity[] = [
        'low',
        'medium',
        'high',
        'critical',
      ];
      return severityOrder.indexOf(issue.severity) > severityOrder.indexOf(max)
        ? issue.severity
        : max;
    }, 'low' as ValidationSeverity);

    return {
      entityType,
      entityId,
      flagType,
      severity: this.mapSeverity(maxSeverity),
      explanation,
    };
  }

  private mapSeverity(severity: ValidationSeverity): ValidationFlagSeverity {
    switch (severity) {
      case 'critical':
        return ValidationFlagSeverity.CRITICAL;
      case 'high':
        return ValidationFlagSeverity.HIGH;
      case 'medium':
        return ValidationFlagSeverity.MEDIUM;
      case 'low':
        return ValidationFlagSeverity.LOW;
    }
  }
}

import { Injectable } from '@nestjs/common';
import {
  RawCsvRow,
  ParsedCsvRow,
  CsvRowError,
  CsvValidationResult,
} from '../utils/csv-stream.types';

@Injectable()
export class CsvRowValidator {
  private requiredHeaders: string[] = [];
  private headerCount: number = 0;

  setRequiredHeaders(requiredHeaders: string[]): void {
    this.requiredHeaders = requiredHeaders;
  }

  setHeaderCount(count: number): void {
    this.headerCount = count;
  }

  validateRow(rawRow: RawCsvRow): CsvValidationResult {
    const errors: CsvRowError[] = [];

    if (this.headerCount > 0 && rawRow.values.length !== this.headerCount) {
      errors.push({
        rowIndex: rawRow.rowIndex,
        reason: `Column count mismatch: expected ${this.headerCount}, got ${rawRow.values.length}`,
        rawData: rawRow.raw,
      });
    }

    if (this.requiredHeaders.length > 0) {
      const missingHeaders = this.requiredHeaders.filter(
        (required) => !rawRow.headers.includes(required),
      );
      if (missingHeaders.length > 0) {
        errors.push({
          rowIndex: rawRow.rowIndex,
          reason: `Missing required headers: ${missingHeaders.join(', ')}`,
          rawData: rawRow.raw,
        });
      }
    }

    const isEmpty = rawRow.values.every((v) => !v || v.trim() === '');
    if (isEmpty) {
      errors.push({
        rowIndex: rawRow.rowIndex,
        reason: 'Empty row',
        rawData: rawRow.raw,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  parseRow(rawRow: RawCsvRow): ParsedCsvRow {
    const data: Record<string, string | null> = {};

    for (let i = 0; i < rawRow.headers.length; i++) {
      const header = rawRow.headers[i];
      const value = rawRow.values[i];
      data[header] = value === undefined || value === '' ? null : value.trim();
    }

    return {
      rowIndex: rawRow.rowIndex,
      data,
    };
  }

  validateRows(rows: RawCsvRow[]): CsvValidationResult {
    const allErrors: CsvRowError[] = [];

    for (const row of rows) {
      const result = this.validateRow(row);
      allErrors.push(...result.errors);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
    };
  }
}

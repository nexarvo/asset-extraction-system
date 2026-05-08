import type { ParsedCsvRow, CsvRowError, CsvValidationResult } from '../utils/csv-stream.types';

interface GenericRawRow {
  rowIndex: number;
  headers: string[];
  values: (string | number | null)[];
  raw?: Record<string, unknown>;
}

export class RowValidationHelper {
  private requiredHeaders: string[] = [];
  private headerCount: number = 0;

  setRequiredHeaders(requiredHeaders: string[]): void {
    this.requiredHeaders = requiredHeaders;
  }

  setHeaderCount(count: number): void {
    this.headerCount = count;
  }

  validateRow(rawRow: GenericRawRow): CsvValidationResult {
    const errors: CsvRowError[] = [];
    const stringValues = rawRow.values.map(v => v === null || v === undefined ? '' : String(v));

    if (this.headerCount > 0 && stringValues.length !== this.headerCount) {
      errors.push({
        rowIndex: rawRow.rowIndex,
        reason: `Column count mismatch: expected ${this.headerCount}, got ${stringValues.length}`,
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

    const isEmpty = stringValues.every((v: string) => !v || v.trim() === '');
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

  parseRow(rawRow: GenericRawRow): ParsedCsvRow {
    const data: Record<string, string | null> = {};

    for (let i = 0; i < rawRow.headers.length; i++) {
      const header = rawRow.headers[i];
      const value = rawRow.values[i];
      data[header] = value === null || value === undefined || value === '' ? null : String(value).trim();
    }

    return {
      rowIndex: rawRow.rowIndex,
      data,
    };
  }

  validateRows(rows: GenericRawRow[]): CsvValidationResult {
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
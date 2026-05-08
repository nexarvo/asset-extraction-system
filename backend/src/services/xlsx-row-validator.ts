import { Injectable } from '@nestjs/common';
import {
  RawXlsxRow,
  ParsedXlsxRow,
  XlsxRowError,
  XlsxValidationResult,
} from '../utils/csv-stream.types';

@Injectable()
export class XlsxRowValidator {
  private requiredHeaders: string[] = [];
  private headerCount: number = 0;
  private numericFields: string[] = [];

  setRequiredHeaders(requiredHeaders: string[]): void {
    this.requiredHeaders = requiredHeaders;
  }

  setHeaderCount(count: number): void {
    this.headerCount = count;
  }

  setNumericFields(fields: string[]): void {
    this.numericFields = fields;
  }

  validateRow(rawRow: RawXlsxRow): XlsxValidationResult {
    const errors: XlsxRowError[] = [];

    if (this.headerCount > 0 && rawRow.values.length !== this.headerCount) {
      errors.push({
        sheetName: rawRow.sheetName,
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
          sheetName: rawRow.sheetName,
          rowIndex: rawRow.rowIndex,
          reason: `Missing required headers: ${missingHeaders.join(', ')}`,
          rawData: rawRow.raw,
        });
      }
    }

    const isEmpty = rawRow.values.every(
      (v) => v === null || v === '' || v === undefined,
    );
    if (isEmpty) {
      errors.push({
        sheetName: rawRow.sheetName,
        rowIndex: rawRow.rowIndex,
        reason: 'Empty row',
        rawData: rawRow.raw,
      });
    }

    for (let i = 0; i < rawRow.headers.length; i++) {
      const header = rawRow.headers[i];
      const value = rawRow.values[i];

      if (
        this.numericFields.includes(header) &&
        value !== null &&
        value !== ''
      ) {
        const numValue =
          typeof value === 'number' ? value : parseFloat(String(value));
        if (isNaN(numValue)) {
          errors.push({
            sheetName: rawRow.sheetName,
            rowIndex: rawRow.rowIndex,
            reason: `Invalid numeric value for column "${header}": ${value}`,
            rawData: rawRow.raw,
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  parseRow(rawRow: RawXlsxRow): ParsedXlsxRow {
    const data: Record<string, string | number | null> = {};

    for (let i = 0; i < rawRow.headers.length; i++) {
      const header = rawRow.headers[i];
      const value = rawRow.values[i];
      data[header] = value === null || value === undefined ? null : value;
    }

    return {
      sheetName: rawRow.sheetName,
      rowIndex: rawRow.rowIndex,
      data,
    };
  }

  validateRows(rows: RawXlsxRow[]): XlsxValidationResult {
    const allErrors: XlsxRowError[] = [];

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

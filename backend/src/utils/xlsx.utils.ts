import { ErrorCode } from '../error-codes/error-codes';
import { RawXlsxCellValue, RawXlsxRow } from './extraction.types';

export interface XlsxRowValidationFailure {
  readonly code: ErrorCode.XlsxRowInvalid;
  readonly sheetName: string;
  readonly rowIndex: number;
  readonly reason: string;
  readonly rawData: {
    readonly headers: string[];
    readonly values: RawXlsxCellValue[];
    readonly extraValues: RawXlsxCellValue[];
  };
}

export function normalizeXlsxHeaders(headers: readonly RawXlsxCellValue[]): string[] {
  const seen = new Map<string, number>();

  return headers.map((header, index) => {
    const normalized = normalizeXlsxHeader(header) || `column_${index + 1}`;
    const count = seen.get(normalized) ?? 0;
    seen.set(normalized, count + 1);

    if (count === 0) {
      return normalized;
    }

    return `${normalized}_${count + 1}`;
  });
}

export function normalizeXlsxHeader(header: RawXlsxCellValue): string {
  return String(header ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export class XlsxRowValidator {
  validate(row: RawXlsxRow): XlsxRowValidationFailure[] {
    const failures: XlsxRowValidationFailure[] = [];

    if (row.values.every((value) => this.isEmpty(value)) && row.extraValues.every((value) => this.isEmpty(value))) {
      failures.push(this.createFailure(row, 'Row is empty.'));
    }

    if (row.extraValues.some((value) => !this.isEmpty(value))) {
      failures.push(this.createFailure(row, `Extra columns detected: ${row.extraValues.filter((value) => !this.isEmpty(value)).length}.`));
    }

    return failures;
  }

  private createFailure(row: RawXlsxRow, reason: string): XlsxRowValidationFailure {
    return {
      code: ErrorCode.XlsxRowInvalid,
      sheetName: row.sheetName,
      rowIndex: row.rowIndex,
      reason,
      rawData: {
        headers: row.headers,
        values: row.values,
        extraValues: row.extraValues,
      },
    };
  }

  private isEmpty(value: RawXlsxCellValue | undefined): boolean {
    return value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0);
  }
}

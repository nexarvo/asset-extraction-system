import { ErrorCode } from '../error-codes/error-codes';
import { RawCsvRow } from './extraction.types';

export interface CsvRowValidationFailure {
  readonly code: ErrorCode.CsvRowInvalid;
  readonly rowIndex: number;
  readonly reason: string;
  readonly rawData: Record<string, string>;
}

export function normalizeCsvHeaders(headers: readonly string[]): string[] {
  const seen = new Map<string, number>();

  return headers.map((header, index) => {
    const normalized = normalizeCsvHeader(header) || `column_${index + 1}`;
    const count = seen.get(normalized) ?? 0;
    seen.set(normalized, count + 1);

    if (count === 0) {
      return normalized;
    }

    return `${normalized}_${count + 1}`;
  });
}

export function normalizeCsvHeader(header: string): string {
  return header
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

export class CsvRowValidator {
  validate(row: RawCsvRow): CsvRowValidationFailure[] {
    const failures: CsvRowValidationFailure[] = [];

    if (
      row.values.every((value) => value.trim().length === 0) &&
      row.extraValues.length === 0
    ) {
      failures.push(this.createFailure(row, 'Row is empty.'));
    }

    const missingHeaders = row.headers.filter((header) => !(header in row.raw));
    if (missingHeaders.length > 0) {
      failures.push(
        this.createFailure(
          row,
          `Missing columns: ${missingHeaders.join(', ')}.`,
        ),
      );
    }

    if (row.extraValues.length > 0) {
      failures.push(
        this.createFailure(
          row,
          `Extra columns detected: ${row.extraValues.length}.`,
        ),
      );
    }

    return failures;
  }

  private createFailure(
    row: RawCsvRow,
    reason: string,
  ): CsvRowValidationFailure {
    return {
      code: ErrorCode.CsvRowInvalid,
      rowIndex: row.rowIndex,
      reason,
      rawData: row.raw,
    };
  }
}

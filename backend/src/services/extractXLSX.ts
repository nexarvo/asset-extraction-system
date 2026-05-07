import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { AppLoggerService } from '../core/app-logger.service';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import {
  AssetFileInput,
  ExtractedAssetRecord,
  ExtractionResult,
  RawXlsxCellValue,
  RawXlsxRow,
  SupportedFileType,
} from '../utils/extraction.types';
import { createExtractionMetadata, getSupportedFileType } from '../utils/file.utils';
import { normalizeXlsxHeaders, XlsxRowValidator } from '../utils/xlsx.utils';
import { XlsxAssetMapperService } from './xlsxAssetMapper.service';

interface RowAnalysis {
  rowNumber: number;
  values: RawXlsxCellValue[];
  nonEmptyCount: number;
  stringCount: number;
  numericCount: number;
  dateCount: number;
}

@Injectable()
export class XlsxExtractionService {
  private readonly rowValidator = new XlsxRowValidator();

  constructor(
    private readonly logger: AppLoggerService,
    private readonly xlsxAssetMapperService: XlsxAssetMapperService,
  ) {}

  async extractDataFromXlsx(input: AssetFileInput): Promise<ExtractionResult> {
    try {
      this.logger.log('starting spreadsheet extraction', 'XlsxExtractionService', { filename: input.filename });
      const workbook = this.readWorkbook(input.buffer);
      const records = this.extractWorkbookRecords(workbook, input.filename);
      const fileType = getSupportedFileType(input);

      return {
        sourceFile: input.filename,
        fileType: fileType === SupportedFileType.Xls ? SupportedFileType.Xls : SupportedFileType.Xlsx,
        records,
        metadata: createExtractionMetadata(records.length),
      };
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }

      throw new ApplicationError(ErrorCode.XlsxExtractionFailed, undefined, {
        filename: input.filename,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private readWorkbook(buffer: Buffer): XLSX.WorkBook {
    return XLSX.read(buffer, { type: 'buffer', cellDates: true });
  }

  private extractWorkbookRecords(workbook: XLSX.WorkBook, filename: string): ExtractedAssetRecord[] {
    try {
      const records: ExtractedAssetRecord[] = [];

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        this.extractSheetRecords(worksheet, sheetName, filename, records);
      });

      return records;
    } catch (error) {
      throw new ApplicationError(ErrorCode.XlsxWorkbookFailure, undefined, {
        filename,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private extractSheetRecords(
    worksheet: XLSX.WorkSheet | undefined,
    sheetName: string,
    filename: string,
    records: ExtractedAssetRecord[],
  ): void {
    if (!worksheet?.['!ref']) {
      this.logger.warn('empty spreadsheet sheet skipped', 'XlsxExtractionService', { filename, sheetName });
      return;
    }

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const headerRowNumber = this.detectHeaderRowNumber(worksheet, range);

    if (headerRowNumber === null) {
      this.logger.warn('spreadsheet sheet missing headers', 'XlsxExtractionService', { filename, sheetName });
      return;
    }

    const headerCells = this.readRowValues(worksheet, headerRowNumber, range.s.c, range.e.c);
    const headerLength = this.findLastNonEmptyIndex(headerCells) + 1;
    const headers = normalizeXlsxHeaders(headerCells.slice(0, headerLength));
    this.logger.log('spreadsheet headers parsed', 'XlsxExtractionService', {
      filename,
      sheetName,
      headerRowIndex: headerRowNumber + 1,
      headers,
    });

    for (let rowNumber = headerRowNumber + 1; rowNumber <= range.e.r; rowNumber += 1) {
      try {
        const values = this.readRowValues(worksheet, rowNumber, range.s.c, range.s.c + headerLength - 1);
        const extraValues = this.readRowValues(worksheet, rowNumber, range.s.c + headerLength, range.e.c);
        const rawRow: RawXlsxRow = {
          sheetName,
          rowIndex: rowNumber + 1,
          headers,
          values,
          extraValues,
        };

        if (this.isTrailingNoteRow(rawRow)) {
          this.logger.log('spreadsheet note row skipped', 'XlsxExtractionService', {
            filename,
            sheetName,
            rowIndex: rowNumber + 1,
          });
          continue;
        }

        const failures = this.rowValidator.validate(rawRow);

        if (failures.length > 0) {
          failures.forEach((failure) => {
            this.logger.warn('invalid spreadsheet row skipped', 'XlsxExtractionService', {
              filename,
              ...failure,
            });
          });
          continue;
        }

        records.push(this.xlsxAssetMapperService.mapRow(rawRow));
      } catch (error) {
        this.logger.warn('spreadsheet row processing failed', 'XlsxExtractionService', {
          filename,
          sheetName,
          rowIndex: rowNumber + 1,
          cause: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private detectHeaderRowNumber(worksheet: XLSX.WorkSheet, range: XLSX.Range): number | null {
    const scanEnd = Math.min(range.e.r, range.s.r + 99);
    const rowData = this.scanRows(worksheet, range, range.s.r, scanEnd);

    if (rowData.length === 0) {
      return null;
    }

    const strategies = [
      this.detectByHeaderDataTransition(rowData),
      this.detectByStringDominance(rowData),
      this.detectByColumnConsistency(worksheet, range, rowData),
      this.detectByFirstValidRow(rowData),
    ];

    const validResults = strategies.filter((r): r is number => r !== null);

    if (validResults.length === 0) {
      return this.fallbackDetectHeader(rowData);
    }

    return validResults[0];
  }

  private scanRows(
    worksheet: XLSX.WorkSheet,
    range: XLSX.Range,
    startRow: number,
    endRow: number,
  ): RowAnalysis[] {
    const rows: RowAnalysis[] = [];

    for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
      const values = this.readRowValues(worksheet, rowNumber, range.s.c, range.e.c);
      const nonEmpty = values.filter((v) => !this.isEmpty(v));

      rows.push({
        rowNumber,
        values,
        nonEmptyCount: nonEmpty.length,
        stringCount: nonEmpty.filter((v) => typeof v === 'string').length,
        numericCount: nonEmpty.filter((v) => typeof v === 'number').length,
        dateCount: nonEmpty.filter((v) => v instanceof Date).length,
      });
    }

    return rows;
  }

  private detectByHeaderDataTransition(rows: RowAnalysis[]): number | null {
    const candidates = rows.filter((r) => r.nonEmptyCount >= 2);

    if (candidates.length < 2) {
      return null;
    }

    let bestScore = -Infinity;
    let bestRow: number | null = null;

    for (let i = 0; i < candidates.length - 1; i++) {
      const header = candidates[i];
      const next = candidates[i + 1];

      const stringRatio = header.stringCount / header.nonEmptyCount;
      const nextNumericRatio = next.numericCount / next.nonEmptyCount;
      const hasMoreNumeric = next.numericCount > header.numericCount;

      const score =
        stringRatio * 40 +
        (hasMoreNumeric ? 25 : 0) +
        (nextNumericRatio > 0.3 ? 15 : 0) +
        header.nonEmptyCount * 5 -
        (header.rowNumber - rows[0].rowNumber) * 2;

      if (score > bestScore) {
        bestScore = score;
        bestRow = header.rowNumber;
      }
    }

    return bestRow;
  }

  private detectByStringDominance(rows: RowAnalysis[]): number | null {
    const candidates = rows.filter((r) => r.nonEmptyCount >= 2);

    if (candidates.length === 0) {
      return null;
    }

    const avgStrings =
      candidates.reduce((sum, r) => sum + r.stringCount, 0) /
      candidates.length;

    const likelyHeader = candidates.find((r) => {
      const stringRatio = r.stringCount / r.nonEmptyCount;
      return stringRatio > 0.6 && r.stringCount > avgStrings * 0.8;
    });

    return likelyHeader?.rowNumber ?? null;
  }

  private detectByColumnConsistency(
    worksheet: XLSX.WorkSheet,
    range: XLSX.Range,
    rows: RowAnalysis[],
  ): number | null {
    const candidates = rows.filter((r) => r.nonEmptyCount >= 2);

    if (candidates.length < 2) {
      return null;
    }

    const columnTypes: Map<
      number,
      { string: number; numeric: number; date: number }
    > = new Map();

    for (let col = range.s.c; col <= range.e.c; col++) {
      columnTypes.set(col, { string: 0, numeric: 0, date: 0 });
    }

    for (let i = 1; i < candidates.length; i++) {
      const row = candidates[i];
      for (let colIdx = 0; colIdx < row.values.length; colIdx++) {
        const col = range.s.c + colIdx;
        const typeMap = columnTypes.get(col);
        if (!typeMap) continue;

        const value = row.values[colIdx];
        if (this.isEmpty(value)) continue;

        if (typeof value === 'string') typeMap.string++;
        else if (typeof value === 'number') typeMap.numeric++;
        else if (value instanceof Date) typeMap.date++;
      }
    }

    let bestScore = -Infinity;
    let bestRow: number | null = null;

    for (let i = 0; i < candidates.length - 1; i++) {
      const header = candidates[i];
      let matchingColumns = 0;

      for (let colIdx = 0; colIdx < header.values.length; colIdx++) {
        const col = range.s.c + colIdx;
        const headerValue = header.values[colIdx];
        if (this.isEmpty(headerValue)) continue;

        const typeMap = columnTypes.get(col);
        if (!typeMap) continue;

        const total = typeMap.string + typeMap.numeric + typeMap.date;
        if (total === 0) continue;

        if (
          typeof headerValue === 'string' &&
          typeMap.string > total * 0.5
        ) {
          matchingColumns++;
        }
      }

      const score =
        matchingColumns * 10 -
        (header.rowNumber - rows[0].rowNumber) * 2;

      if (score > bestScore) {
        bestScore = score;
        bestRow = header.rowNumber;
      }
    }

    return bestRow;
  }

  private detectByFirstValidRow(rows: RowAnalysis[]): number | null {
    const candidates = rows.filter((r) => r.nonEmptyCount >= 2);
    return candidates[0]?.rowNumber ?? null;
  }

  private fallbackDetectHeader(rows: RowAnalysis[]): number | null {
    const nonEmpty = rows.filter((r) => r.nonEmptyCount > 0);
    return nonEmpty[0]?.rowNumber ?? null;
  }

  private readRowValues(worksheet: XLSX.WorkSheet, rowNumber: number, startColumn: number, endColumn: number): RawXlsxCellValue[] {
    if (endColumn < startColumn) {
      return [];
    }

    const values: RawXlsxCellValue[] = [];
    for (let columnNumber = startColumn; columnNumber <= endColumn; columnNumber += 1) {
      const address = XLSX.utils.encode_cell({ r: rowNumber, c: columnNumber });
      const cell = worksheet[address];
      values.push(this.readCellValue(cell));
    }
    return values;
  }

  private readCellValue(cell: XLSX.CellObject | undefined): RawXlsxCellValue {
    if (!cell || cell.v === undefined || cell.v === null) {
      return null;
    }

    if (cell.v instanceof Date) {
      return cell.v;
    }

    if (typeof cell.v === 'string' || typeof cell.v === 'number' || typeof cell.v === 'boolean') {
      return cell.v;
    }

    return String(cell.v);
  }

  private findLastNonEmptyIndex(values: RawXlsxCellValue[]): number {
    for (let index = values.length - 1; index >= 0; index -= 1) {
      const value = values[index];
      if (value !== null && !(typeof value === 'string' && value.trim().length === 0)) {
        return index;
      }
    }

    return -1;
  }

  private isTrailingNoteRow(row: RawXlsxRow): boolean {
    if (row.headers.length <= 1 || row.extraValues.some((value) => !this.isEmpty(value))) {
      return false;
    }

    const nonEmptyValues = row.values.filter((value) => !this.isEmpty(value));
    if (nonEmptyValues.length !== 1 || this.isEmpty(row.values[0])) {
      return false;
    }

    return typeof row.values[0] === 'string' && row.values[0].trim().length > 25;
  }

  private isEmpty(value: RawXlsxCellValue | undefined): boolean {
    return value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0);
  }
}

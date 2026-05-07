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
    const scannedRows: Array<{ rowNumber: number; nonEmptyCount: number; stringCount: number; numericCount: number }> = [];
    const scanEnd = Math.min(range.e.r, range.s.r + 49);

    for (let rowNumber = range.s.r; rowNumber <= scanEnd; rowNumber += 1) {
      const values = this.readRowValues(worksheet, rowNumber, range.s.c, range.e.c);
      const nonEmptyValues = values.filter((value) => !this.isEmpty(value));

      if (nonEmptyValues.length === 0) {
        continue;
      }

      scannedRows.push({
        rowNumber,
        nonEmptyCount: nonEmptyValues.length,
        stringCount: nonEmptyValues.filter((value) => typeof value === 'string').length,
        numericCount: nonEmptyValues.filter((value) => typeof value === 'number').length,
      });
    }

    if (scannedRows.length === 0) {
      return null;
    }

    const hasWideRows = scannedRows.some((row) => row.nonEmptyCount > 1);
    const candidates = scannedRows.filter((row) => row.nonEmptyCount >= (hasWideRows ? 2 : 1));

    return candidates
      .map((row, index) => {
        const nextRow = candidates[index + 1];
        const nextRowLooksLikeData = nextRow && nextRow.nonEmptyCount >= row.nonEmptyCount && nextRow.numericCount > row.numericCount;

        return {
          rowNumber: row.rowNumber,
          score:
            row.nonEmptyCount * 10 +
            row.stringCount * 2 -
            row.numericCount * 3 +
            (nextRow ? 3 : 0) +
            (nextRowLooksLikeData ? 8 : 0) -
            (row.rowNumber - range.s.r) * 4,
        };
      })
      .sort((left, right) => right.score - left.score || left.rowNumber - right.rowNumber)[0].rowNumber;
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

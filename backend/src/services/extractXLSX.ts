import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { AssetFileInput, ExtractionResult, SupportedFileType } from '../utils/extraction.types';
import { createExtractionMetadata, getSupportedFileType } from '../utils/file.utils';
import { normalizeXlsxHeaders } from '../utils/xlsx.utils';
import { RawXlsxRow, ExtractedAssetCandidate } from '../utils/csv-stream.types';
import { RowValidationHelper } from '../helpers/row-validation.helper';
import { AssetMappingHelper } from '../helpers/asset-mapping.helper';
import { createLogger } from '../helpers/console-logger.helper';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import { ExtractionProcessor } from '../helpers/extraction-processor.helper';
import { ExtractionContext } from '../strategies/extraction-strategy.interface';

@Injectable()
export class XlsxExtractionService {
  private readonly logger = createLogger('XlsxExtractionService');
  private readonly rowValidator = new RowValidationHelper();
  private readonly assetMapper = new AssetMappingHelper();

  async extractDataFromXlsx(input: AssetFileInput): Promise<ExtractionResult> {
    try {
      this.logger.info('starting spreadsheet extraction', { filename: input.filename });
      const workbook = this.readWorkbook(input.buffer);
      const result = await this.processWorkbook(workbook, input.filename);
      const fileType = getSupportedFileType(input);

      return {
        sourceFile: input.filename,
        fileType:
          fileType === SupportedFileType.Xls
            ? SupportedFileType.Xls
            : SupportedFileType.Xlsx,
        records: result.candidates as unknown as Record<string, unknown>[],
        metadata: createExtractionMetadata(
          result.candidates.length,
          result.warnings,
        ),
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

  async extractWithProcessor(
    input: AssetFileInput,
    context: ExtractionContext,
  ): Promise<ExtractionResult> {
    try {
      this.logger.info('Starting XLSX extraction with processor', { filename: input.filename });

      const workbook = this.readWorkbook(input.buffer);
      const processor = new ExtractionProcessor(context);

      this.logger.info('Collecting sample rows for schema inference', { filename: input.filename });

      const sampleRows: { row: Record<string, unknown>; sourceRowIndex: number; sourceSheetName?: string }[] = [];

      await this.processWorkbookWithBackpressure(
        workbook,
        input.filename,
        async (candidate) => {
          if (sampleRows.length < 20) {
            sampleRows.push({
              row: candidate.normalizedRowData || candidate.rawRowData || {},
              sourceRowIndex: candidate.sourceRowIndex,
              sourceSheetName: candidate.sourceSheetName,
            });
          }
        },
      );

      this.logger.info('Sample rows collected, starting schema inference', { 
        filename: input.filename,
        sampleRowCount: sampleRows.length,
      });

      const schema = await processor.inferInitialSchema(sampleRows);
      processor.setSchema(schema);

      this.logger.info('Schema inference completed, now processing rows', { 
        filename: input.filename,
        schemaColumns: schema.columns?.length || 0,
        fieldsMapped: Object.values(schema.fieldMapping).filter(f => f?.column).length,
      });

      await this.processWorkbookWithBackpressure(
        workbook,
        input.filename,
        async (candidate) => {
          const row = candidate.normalizedRowData || candidate.rawRowData || {};
          await processor.processRow(row, candidate.sourceRowIndex - 1, candidate.sourceSheetName);
        },
      );

      await processor.flush();

      const stats = processor.getStats();
      const fileType = getSupportedFileType(input);

      return {
        sourceFile: input.filename,
        fileType: fileType === SupportedFileType.Xls ? SupportedFileType.Xls : SupportedFileType.Xlsx,
        metadata: createExtractionMetadata(stats.total, []),
        processingStats: {
          totalRows: stats.total,
          deterministicRows: stats.deterministic,
          ambiguousRows: stats.ambiguous,
          persistedCount: stats.deterministic,
          enrichedCount: stats.ambiguous,
          errors: [],
          inferredSchema: schema as unknown as Record<string, unknown>,
        },
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

  async processWorkbook(
    workbook: XLSX.WorkBook,
    filename: string,
  ): Promise<{ candidates: ExtractedAssetCandidate[]; warnings: string[] }> {
    const candidates: ExtractedAssetCandidate[] = [];
    const warnings: string[] = [];

    try {
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const sheetResult = this.processSheet(worksheet, sheetName, filename);
        candidates.push(...sheetResult.candidates);
        warnings.push(...sheetResult.warnings);
      }

      this.logger.info('spreadsheet extraction completed', {
          filename,
          recordCount: candidates.length,
          skippedRows: warnings.length,
        });

      return { candidates, warnings };
    } catch (error) {
      throw new ApplicationError(ErrorCode.XlsxWorkbookFailure, undefined, {
        filename,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private processSheet(
    worksheet: XLSX.WorkSheet | undefined,
    sheetName: string,
    filename: string,
  ): { candidates: ExtractedAssetCandidate[]; warnings: string[] } {
    const candidates: ExtractedAssetCandidate[] = [];
    const warnings: string[] = [];

    if (!worksheet?.['!ref']) {
      this.logger.warn('empty spreadsheet sheet skipped', { filename, sheetName });
      return { candidates, warnings };
    }

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const totalRows = range.e.r - range.s.r + 1;

    this.logger.info('sheet processing started', {
      filename,
      sheetName,
      totalRows,
      rangeStart: range.s.r,
      rangeEnd: range.e.r,
    });

    const headerRowNumber = this.detectHeaderRowNumber(worksheet, range);

    if (headerRowNumber === null) {
      this.logger.warn('spreadsheet sheet missing headers', { filename, sheetName });
      return { candidates, warnings };
    }

    const headerCells = this.readRowValues(
      worksheet,
      headerRowNumber,
      range.s.c,
      range.e.c,
    );
    const headerLength = this.findLastNonEmptyIndex(headerCells) + 1;
    const headers = normalizeXlsxHeaders(headerCells.slice(0, headerLength));
    this.rowValidator.setHeaderCount(headers.length);

    this.logger.info('spreadsheet headers parsed', {
      filename,
      sheetName,
      headerRowIndex: headerRowNumber + 1,
      headerCount: headers.length,
      headerLength,
    });

    let processedRows = 0;
    let consecutiveEmptyRows = 0;
    const MAX_CONSECUTIVE_EMPTY_ROWS = 100;

    for (
      let rowNumber = headerRowNumber + 1;
      rowNumber <= range.e.r;
      rowNumber += 1
    ) {
      processedRows++;
      try {
        const values = this.readRowValues(
          worksheet,
          rowNumber,
          range.s.c,
          range.s.c + headerLength - 1,
        );

        const rawRow: RawXlsxRow = {
          sheetName,
          rowIndex: rowNumber + 1,
          headers,
          values,
          raw: this.valuesToRecord(headers, values),
        };

        const isEmptyRow = values.every((v) => this.isEmpty(v));
        if (isEmptyRow) {
          consecutiveEmptyRows++;
          if (consecutiveEmptyRows >= MAX_CONSECUTIVE_EMPTY_ROWS) {
            this.logger.info('stopping due to consecutive empty rows', { filename, sheetName, consecutiveEmptyRows, processedRows });
            break;
          }
          continue;
        } else {
          consecutiveEmptyRows = 0;
        }

        if (this.isTrailingNoteRow(rawRow)) {
          this.logger.info('spreadsheet note row skipped', {
              filename,
              sheetName,
              rowIndex: rowNumber + 1,
            });
          continue;
        }

        const validationResult = this.rowValidator.validateRow(rawRow);

        if (!validationResult.isValid) {
          validationResult.errors.forEach((error) => {
            const warning = `sheet ${rawRow.sheetName}, row ${error.rowIndex}: ${error.reason}`;
            warnings.push(warning);
            this.logger.warn('invalid spreadsheet row skipped', {
                filename,
                ...error,
              },
            );
          });
          continue;
        }

        const parsedRow = this.rowValidator.parseRow(rawRow);
        const candidate = this.assetMapper.mapRow(parsedRow.data, rawRow.rowIndex);
        candidates.push(candidate);
      } catch (error) {
        const warning = `sheet ${sheetName}, row ${rowNumber + 1}: ${error instanceof Error ? error.message : String(error)}`;
        warnings.push(warning);
        this.logger.warn('spreadsheet row processing failed', {
            filename,
            sheetName,
            rowIndex: rowNumber + 1,
            cause: error instanceof Error ? error.message : String(error),
          });
      }
    }

    this.logger.info('sheet processing completed', {
      filename,
      sheetName,
      processedRows,
      candidatesCount: candidates.length,
    });

    return { candidates, warnings };
  }

  async processWorkbookWithBackpressure(
    workbook: XLSX.WorkBook,
    filename: string,
    onCandidate: (candidate: ExtractedAssetCandidate) => Promise<void>,
  ): Promise<{ totalProcessed: number; warnings: string[] }> {
    const warnings: string[] = [];
    let totalProcessed = 0;

    try {
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const result = await this.processSheetWithBackpressure(
          worksheet,
          sheetName,
          filename,
          onCandidate,
        );
        totalProcessed += result.processedRows;
        warnings.push(...result.warnings);
      }

      this.logger.info('spreadsheet extraction with backpressure completed', {
          filename,
          totalProcessed,
        },
      );

      return { totalProcessed, warnings };
    } catch (error) {
      throw new ApplicationError(ErrorCode.XlsxWorkbookFailure, undefined, {
        filename,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processSheetWithBackpressure(
    worksheet: XLSX.WorkSheet | undefined,
    sheetName: string,
    filename: string,
    onCandidate: (candidate: ExtractedAssetCandidate) => Promise<void>,
  ): Promise<{ processedRows: number; warnings: string[] }> {
    const warnings: string[] = [];
    let processedRows = 0;

    if (!worksheet?.['!ref']) {
      return { processedRows, warnings };
    }

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const headerRowNumber = this.detectHeaderRowNumber(worksheet, range);

    if (headerRowNumber === null) {
      return { processedRows, warnings };
    }

    const headerCells = this.readRowValues(
      worksheet,
      headerRowNumber,
      range.s.c,
      range.e.c,
    );
    const headerLength = this.findLastNonEmptyIndex(headerCells) + 1;
    const headers = normalizeXlsxHeaders(headerCells.slice(0, headerLength));
    this.rowValidator.setHeaderCount(headers.length);

    let consecutiveEmptyRows = 0;
    const MAX_CONSECUTIVE_EMPTY_ROWS = 100;

    for (
      let rowNumber = headerRowNumber + 1;
      rowNumber <= range.e.r;
      rowNumber += 1
    ) {
      processedRows++;
      try {
        const values = this.readRowValues(
          worksheet,
          rowNumber,
          range.s.c,
          range.s.c + headerLength - 1,
        );

        const rawRow: RawXlsxRow = {
          sheetName,
          rowIndex: rowNumber + 1,
          headers,
          values,
          raw: this.valuesToRecord(headers, values),
        };

        const isEmptyRow = values.every((v) => this.isEmpty(v));
        if (isEmptyRow) {
          consecutiveEmptyRows++;
          if (consecutiveEmptyRows >= MAX_CONSECUTIVE_EMPTY_ROWS) {
            break;
          }
          continue;
        } else {
          consecutiveEmptyRows = 0;
        }

        if (this.isTrailingNoteRow(rawRow)) {
          continue;
        }

        const validationResult = this.rowValidator.validateRow(rawRow);
        if (!validationResult.isValid) {
          validationResult.errors.forEach((error) => {
            warnings.push(
              `sheet ${sheetName}, row ${error.rowIndex}: ${error.reason}`,
            );
          });
          continue;
        }

        const parsedRow = this.rowValidator.parseRow(rawRow);
        const candidate = this.assetMapper.mapRow(parsedRow.data, rawRow.rowIndex);
        await onCandidate(candidate);
      } catch (error) {
        warnings.push(
          `sheet ${sheetName}, row ${rowNumber + 1}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { processedRows, warnings };
  }

  readWorkbook(buffer: Buffer): XLSX.WorkBook {
    return XLSX.read(buffer, { type: 'buffer', cellDates: true });
  }

  private valuesToRecord(
    headers: string[],
    values: (string | number | null)[],
  ): Record<string, unknown> {
    const record: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) {
      record[headers[i]] = values[i] ?? null;
    }
    return record;
  }

  private detectHeaderRowNumber(
    worksheet: XLSX.WorkSheet,
    range: XLSX.Range,
  ): number | null {
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
  ): {
    rowNumber: number;
    values: (string | number | null)[];
    nonEmptyCount: number;
    stringCount: number;
    numericCount: number;
    dateCount: number;
  }[] {
    const rows: {
      rowNumber: number;
      values: (string | number | null)[];
      nonEmptyCount: number;
      stringCount: number;
      numericCount: number;
      dateCount: number;
    }[] = [];

    for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
      const values = this.readRowValues(
        worksheet,
        rowNumber,
        range.s.c,
        range.e.c,
      );
      const nonEmpty = values.filter((v) => !this.isEmpty(v));

      rows.push({
        rowNumber,
        values,
        nonEmptyCount: nonEmpty.length,
        stringCount: nonEmpty.filter((v) => typeof v === 'string').length,
        numericCount: nonEmpty.filter((v) => typeof v === 'number').length,
        dateCount: 0,
      });
    }

    return rows;
  }

  private detectByHeaderDataTransition(
    rows: {
      rowNumber: number;
      nonEmptyCount: number;
      stringCount: number;
      numericCount: number;
    }[],
  ): number | null {
    const candidates = rows.filter((r) => r.nonEmptyCount >= 2);
    if (candidates.length < 2) return null;

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

  private detectByStringDominance(
    rows: { rowNumber: number; nonEmptyCount: number; stringCount: number }[],
  ): number | null {
    const candidates = rows.filter((r) => r.nonEmptyCount >= 2);
    if (candidates.length === 0) return null;

    const avgStrings =
      candidates.reduce((sum, r) => sum + r.stringCount, 0) / candidates.length;

    const likelyHeader = candidates.find((r) => {
      const stringRatio = r.stringCount / r.nonEmptyCount;
      return stringRatio > 0.6 && r.stringCount > avgStrings * 0.8;
    });

    return likelyHeader?.rowNumber ?? null;
  }

  private detectByColumnConsistency(
    worksheet: XLSX.WorkSheet,
    range: XLSX.Range,
    rows: {
      rowNumber: number;
      values: (string | number | null)[];
      nonEmptyCount: number;
    }[],
  ): number | null {
    const candidates = rows.filter((r) => r.nonEmptyCount >= 2);
    if (candidates.length < 2) return null;

    const columnTypes = new Map<
      number,
      { string: number; numeric: number; date: number }
    >();

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

        if (typeof headerValue === 'string' && typeMap.string > total * 0.5) {
          matchingColumns++;
        }
      }

      const score =
        matchingColumns * 10 - (header.rowNumber - rows[0].rowNumber) * 2;

      if (score > bestScore) {
        bestScore = score;
        bestRow = header.rowNumber;
      }
    }

    return bestRow;
  }

  private detectByFirstValidRow(
    rows: { rowNumber: number; nonEmptyCount: number }[],
  ): number | null {
    const candidates = rows.filter((r) => r.nonEmptyCount >= 2);
    return candidates[0]?.rowNumber ?? null;
  }

  private fallbackDetectHeader(
    rows: { rowNumber: number; nonEmptyCount: number }[],
  ): number | null {
    const nonEmpty = rows.filter((r) => r.nonEmptyCount > 0);
    return nonEmpty[0]?.rowNumber ?? null;
  }

  private readRowValues(
    worksheet: XLSX.WorkSheet,
    rowNumber: number,
    startColumn: number,
    endColumn: number,
  ): (string | number | null)[] {
    if (endColumn < startColumn) {
      return [];
    }

    const values: (string | number | null)[] = [];
    for (
      let columnNumber = startColumn;
      columnNumber <= endColumn;
      columnNumber += 1
    ) {
      const address = XLSX.utils.encode_cell({ r: rowNumber, c: columnNumber });
      const cell = worksheet[address];
      values.push(this.readCellValue(cell));
    }
    return values;
  }

  private readCellValue(
    cell: XLSX.CellObject | undefined,
  ): string | number | null {
    if (!cell || cell.v === undefined || cell.v === null) {
      return null;
    }

    if (cell.v instanceof Date) {
      return cell.v.toISOString();
    }

    if (typeof cell.v === 'string') {
      return cell.v;
    }

    if (typeof cell.v === 'number') {
      return cell.v;
    }

    return String(cell.v);
  }

  private findLastNonEmptyIndex(values: (string | number | null)[]): number {
    for (let index = values.length - 1; index >= 0; index -= 1) {
      const value = values[index];
      if (
        value !== null &&
        !(typeof value === 'string' && value.trim().length === 0)
      ) {
        return index;
      }
    }

    return -1;
  }

  private isTrailingNoteRow(row: RawXlsxRow): boolean {
    const nonEmptyValues = row.values.filter((value) => !this.isEmpty(value));
    if (nonEmptyValues.length !== 1 || this.isEmpty(row.values[0])) {
      return false;
    }

    return (
      typeof row.values[0] === 'string' && row.values[0].trim().length > 25
    );
  }

  private isEmpty(value: unknown): boolean {
    return (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim().length === 0)
    );
  }
}

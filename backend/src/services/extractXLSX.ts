import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { AppLoggerService } from '../core/app-logger.service';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import {
  AssetFileInput,
  ExtractedAssetRecord,
  ExtractionResult,
  SupportedFileType,
} from '../utils/extraction.types';
import { createExtractionMetadata, getSupportedFileType } from '../utils/file.utils';

@Injectable()
export class XlsxExtractionService {
  constructor(private readonly logger: AppLoggerService) {}

  async extractDataFromXlsx(input: AssetFileInput): Promise<ExtractionResult> {
    try {
      this.logger.log('starting spreadsheet extraction', 'XlsxExtractionService', { filename: input.filename });
      const workbook = this.readWorkbook(input.buffer);
      const records = this.extractWorkbookRecords(workbook);
      const fileType = getSupportedFileType(input);

      return {
        sourceFile: input.filename,
        fileType: fileType === SupportedFileType.Xls ? SupportedFileType.Xls : SupportedFileType.Xlsx,
        records,
        metadata: createExtractionMetadata(records.length),
      };
    } catch (error) {
      throw new ApplicationError(ErrorCode.XlsxExtractionFailed, undefined, {
        filename: input.filename,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private readWorkbook(buffer: Buffer): XLSX.WorkBook {
    return XLSX.read(buffer, { type: 'buffer', cellDates: true });
  }

  private extractWorkbookRecords(workbook: XLSX.WorkBook): ExtractedAssetRecord[] {
    return workbook.SheetNames.flatMap((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<ExtractedAssetRecord>(worksheet, {
        defval: null,
        raw: false,
      });

      return rows.map((row) => ({
        sheetName,
        ...row,
      }));
    });
  }
}

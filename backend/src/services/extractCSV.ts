import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../core/app-logger.service';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import {
  AssetFileInput,
  ExtractedAssetRecord,
  ExtractionResult,
  SupportedFileType,
} from '../utils/extraction.types';
import { createExtractionMetadata } from '../utils/file.utils';

@Injectable()
export class CsvExtractionService {
  constructor(private readonly logger: AppLoggerService) {}

  async extractDataFromCsv(input: AssetFileInput): Promise<ExtractionResult> {
    try {
      this.logger.log('starting csv extraction', 'CsvExtractionService', { filename: input.filename });
      const csvText = this.decodeBuffer(input.buffer);
      const rows = this.parseCsvRows(csvText);
      const records = this.mapRowsToRecords(rows);

      return {
        sourceFile: input.filename,
        fileType: SupportedFileType.Csv,
        records,
        metadata: createExtractionMetadata(records.length),
      };
    } catch (error) {
      throw new ApplicationError(ErrorCode.CsvExtractionFailed, undefined, {
        filename: input.filename,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private decodeBuffer(buffer: Buffer): string {
    return buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
  }

  private parseCsvRows(csvText: string): string[][] {
    if (!csvText) {
      return [];
    }

    const rows: string[][] = [];
    let cell = '';
    let row: string[] = [];
    let inQuotes = false;

    for (let index = 0; index < csvText.length; index += 1) {
      const character = csvText[index];
      const nextCharacter = csvText[index + 1];

      if (character === '"' && nextCharacter === '"') {
        cell += '"';
        index += 1;
        continue;
      }

      if (character === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (character === ',' && !inQuotes) {
        row.push(cell.trim());
        cell = '';
        continue;
      }

      if ((character === '\n' || character === '\r') && !inQuotes) {
        if (character === '\r' && nextCharacter === '\n') {
          index += 1;
        }
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = '';
        continue;
      }

      cell += character;
    }

    row.push(cell.trim());
    rows.push(row);

    return rows.filter((cells) => cells.some((value) => value.length > 0));
  }

  private mapRowsToRecords(rows: string[][]): ExtractedAssetRecord[] {
    if (rows.length === 0) {
      return [];
    }

    const [headers, ...dataRows] = rows;
    return dataRows.map((row) => this.mapRow(headers, row));
  }

  private mapRow(headers: string[], row: string[]): ExtractedAssetRecord {
    return headers.reduce<ExtractedAssetRecord>((record, header, index) => {
      record[header] = row[index] ?? null;
      return record;
    }, {});
  }
}

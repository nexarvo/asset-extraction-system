import { Injectable } from '@nestjs/common';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { AppLoggerService } from '../core/app-logger.service';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import {
  AssetFileInput,
  ExtractedAssetRecord,
  ExtractionResult,
  RawCsvRow,
  SupportedFileType,
} from '../utils/extraction.types';
import { CsvRowValidator, normalizeCsvHeaders } from '../utils/csv.utils';
import { createExtractionMetadata } from '../utils/file.utils';
import { CsvAssetMapperService } from './csvAssetMapper.service';

type CsvParserRow = Record<string, string | undefined>;

@Injectable()
export class CsvExtractionService {
  private readonly rowValidator = new CsvRowValidator();

  constructor(
    private readonly logger: AppLoggerService,
    private readonly csvAssetMapperService: CsvAssetMapperService,
  ) {}

  async extractDataFromCsv(input: AssetFileInput): Promise<ExtractionResult> {
    try {
      this.logger.log('starting csv extraction', 'CsvExtractionService', {
        filename: input.filename,
      });
      const { records, warnings } = await this.processCsvStream(input);

      return {
        sourceFile: input.filename,
        fileType: SupportedFileType.Csv,
        records,
        metadata: createExtractionMetadata(records.length, warnings),
      };
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }

      throw new ApplicationError(ErrorCode.CsvExtractionFailed, undefined, {
        filename: input.filename,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processCsvStream(
    input: AssetFileInput,
  ): Promise<{ records: ExtractedAssetRecord[]; warnings: string[] }> {
    return new Promise((resolve, reject) => {
      const records: ExtractedAssetRecord[] = [];
      const warnings: string[] = [];
      let headers: string[] = [];
      let rowIndex = 1;

      const parser = csvParser({
        strict: false,
        mapHeaders: ({ header }) => {
          headers = normalizeCsvHeaders([...headers, header]);
          return headers[headers.length - 1];
        },
        mapValues: ({ value }) =>
          typeof value === 'string' ? value.trim() : String(value ?? '').trim(),
      });

      parser.on('headers', (parsedHeaders: string[]) => {
        headers = normalizeCsvHeaders(parsedHeaders);
        this.logger.log('csv headers parsed', 'CsvExtractionService', {
          filename: input.filename,
          headers,
        });
      });

      parser.on('data', (data: CsvParserRow) => {
        rowIndex += 1;
        try {
          const rawRow = this.toRawCsvRow(data, headers, rowIndex);
          const failures = this.rowValidator.validate(rawRow);

          if (failures.length > 0) {
            failures.forEach((failure) => {
              const warning = `row ${failure.rowIndex}: ${failure.reason}`;
              warnings.push(warning);
              this.logger.warn(
                'invalid csv row skipped',
                'CsvExtractionService',
                {
                  filename: input.filename,
                  ...failure,
                },
              );
            });
            return;
          }

          records.push(this.csvAssetMapperService.mapRow(rawRow));
        } catch (error) {
          const warning = `row ${rowIndex}: ${error instanceof Error ? error.message : String(error)}`;
          warnings.push(warning);
          this.logger.warn(
            'csv row processing failed',
            'CsvExtractionService',
            {
              filename: input.filename,
              rowIndex,
              cause: error instanceof Error ? error.message : String(error),
              rawData: data,
            },
          );
        }
      });

      parser.on('error', (error: Error) => {
        reject(
          new ApplicationError(ErrorCode.CsvStreamFailure, undefined, {
            filename: input.filename,
            cause: error.message,
          }),
        );
      });

      parser.on('end', () => {
        this.logger.log('csv extraction completed', 'CsvExtractionService', {
          filename: input.filename,
          recordCount: records.length,
          skippedRows: warnings.length,
        });
        resolve({ records, warnings });
      });

      Readable.from(input.buffer).pipe(parser);
    });
  }

  private toRawCsvRow(
    data: CsvParserRow,
    headers: string[],
    rowIndex: number,
  ): RawCsvRow {
    const extraKeys = Object.keys(data).filter((key) => !headers.includes(key));
    return {
      headers,
      rowIndex,
      values: headers.map((header) => data[header] ?? ''),
      extraValues: extraKeys.map((key) => data[key] ?? ''),
      raw: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, value ?? '']),
      ),
    };
  }
}

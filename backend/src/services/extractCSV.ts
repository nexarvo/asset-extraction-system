import { Injectable } from '@nestjs/common';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { AppLoggerService } from '../core/app-logger.service';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import {
  AssetFileInput,
  ExtractionResult,
  SupportedFileType,
} from '../utils/extraction.types';
import { normalizeCsvHeaders } from '../utils/csv.utils';
import { createExtractionMetadata } from '../utils/file.utils';
import { CsvAssetMapperService } from './csvAssetMapper.service';
import { CsvRowValidator } from './csv-row-validator';
import { RawCsvRow, ParsedCsvRow, ExtractedAssetCandidate } from '../utils/csv-stream.types';

type CsvParserRow = Record<string, string | undefined>;

@Injectable()
export class CsvExtractionService {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly csvAssetMapperService: CsvAssetMapperService,
    private readonly rowValidator: CsvRowValidator,
  ) {}

  async extractDataFromCsv(input: AssetFileInput): Promise<ExtractionResult> {
    try {
      this.logger.log('starting csv extraction', 'CsvExtractionService', {
        filename: input.filename,
      });
      const { candidates, warnings } = await this.processCsvStream(input);

      return {
        sourceFile: input.filename,
        fileType: SupportedFileType.Csv,
        records: candidates as unknown as Record<string, unknown>[],
        metadata: createExtractionMetadata(candidates.length, warnings),
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

  async processCsvStream(
    input: AssetFileInput,
  ): Promise<{ candidates: ExtractedAssetCandidate[]; warnings: string[] }> {
    return new Promise((resolve, reject) => {
      const candidates: ExtractedAssetCandidate[] = [];
      const warnings: string[] = [];
      let headers: string[] = [];
      let rowIndex = 0;
      let isFirstRow = true;

      const parser = csvParser({
        strict: false,
        mapValues: ({ value }) =>
          typeof value === 'string' ? value.trim() : String(value ?? '').trim(),
      });

      parser.on('headers', (parsedHeaders: string[]) => {
        const result = normalizeCsvHeaders(parsedHeaders);
        headers = result;
        this.rowValidator.setHeaderCount(headers.length);
        this.logger.log('csv headers parsed', 'CsvExtractionService', {
          filename: input.filename,
          headers,
        });
      });

      parser.on('data', (data: CsvParserRow) => {
        rowIndex++;
        if (isFirstRow) {
          isFirstRow = false;
          return;
        }

        try {
          const rawRow = this.toRawCsvRow(data, headers, rowIndex);
          const validationResult = this.rowValidator.validateRow(rawRow);

          if (!validationResult.isValid) {
            validationResult.errors.forEach((error) => {
              const warning = `row ${error.rowIndex}: ${error.reason}`;
              warnings.push(warning);
              this.logger.warn(
                'invalid csv row skipped',
                'CsvExtractionService',
                {
                  filename: input.filename,
                  ...error,
                },
              );
            });
            return;
          }

          const parsedRow = this.rowValidator.parseRow(rawRow);
          const candidate = this.csvAssetMapperService.mapRow(parsedRow);
          candidates.push(candidate);
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
          recordCount: candidates.length,
          skippedRows: warnings.length,
        });
        resolve({ candidates, warnings });
      });

      Readable.from(input.buffer).pipe(parser);
    });
  }

  private toRawCsvRow(
    data: CsvParserRow,
    headers: string[],
    rowIndex: number,
  ): RawCsvRow {
    return {
      headers,
      rowIndex,
      values: headers.map((header) => data[header] ?? ''),
      raw: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, value ?? '']),
      ),
    };
  }
}
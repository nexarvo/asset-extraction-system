import { Injectable } from '@nestjs/common';
import csvParser from 'csv-parser';
import { Readable, PassThrough } from 'stream';
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
import {
  RawCsvRow,
  ParsedCsvRow,
  ExtractedAssetCandidate,
} from '../utils/csv-stream.types';
import { StreamingBatchProcessor } from './streaming-batch-processor';

type CsvParserRow = Record<string, string | undefined>;

export interface CsvExtractionOptions {
  useBatchPersistence?: boolean;
  batchSize?: number;
  onBatchFlush?: (result: {
    candidates: ExtractedAssetCandidate[];
  }) => Promise<void>;
}

@Injectable()
export class CsvExtractionService {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly csvAssetMapperService: CsvAssetMapperService,
    private readonly rowValidator: CsvRowValidator,
  ) {}

  async extractDataFromCsv(
    input: AssetFileInput,
    options?: CsvExtractionOptions,
  ): Promise<ExtractionResult> {
    try {
      this.logger.log('starting csv extraction', 'CsvExtractionService', {
        filename: input.filename,
      });

      if (options?.useBatchPersistence) {
        return await this.extractWithBatchPersistence(input, options);
      }

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

  private async extractWithBatchPersistence(
    input: AssetFileInput,
    options: CsvExtractionOptions,
  ): Promise<ExtractionResult> {
    const batchProcessor = new StreamingBatchProcessor({} as any, this.logger);

    batchProcessor.configure({
      batchSize: options.batchSize || 500,
      documentId: '',
      extractionJobId: null,
    });

    const warnings: string[] = [];

    await this.processCsvStreamWithBackpressure(
      input,
      async (candidate) => {
        await batchProcessor.addCandidate(candidate);
      },
      warnings,
    );

    const result = await batchProcessor.flushRemaining();

    return {
      sourceFile: input.filename,
      fileType: SupportedFileType.Csv,
      records: [],
      metadata: createExtractionMetadata(result.savedFields, warnings),
    };
  }

  async processCsvStreamWithBackpressure(
    input: AssetFileInput,
    onCandidate: (candidate: ExtractedAssetCandidate) => Promise<void>,
    warnings: string[],
  ): Promise<void> {
    return new Promise((resolve, reject) => {
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
      });

      parser.on('data', async (data: CsvParserRow) => {
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
              warnings.push(`row ${error.rowIndex}: ${error.reason}`);
            });
            return;
          }

          const parsedRow = this.rowValidator.parseRow(rawRow);
          const candidate = this.csvAssetMapperService.mapRow(parsedRow);
          await onCandidate(candidate);
        } catch (error) {
          warnings.push(
            `row ${rowIndex}: ${error instanceof Error ? error.message : String(error)}`,
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
        this.logger.log(
          'csv extraction with backpressure completed',
          'CsvExtractionService',
          {
            filename: input.filename,
            rowCount: rowIndex,
          },
        );
        resolve();
      });

      Readable.from(input.buffer).pipe(parser);
    });
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
        this.headerMapping = new Map();
        result.forEach((normalized, index) => {
          this.headerMapping.set(normalized, parsedHeaders[index]);
        });
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

  private headerMapping: Map<string, string> = new Map();

  private toRawCsvRow(
    data: CsvParserRow,
    headers: string[],
    rowIndex: number,
  ): RawCsvRow {
    const raw: Record<string, string> = {};

    for (const header of headers) {
      const originalKey = this.headerMapping.get(header) || header;
      raw[header] = data[originalKey] ?? '';
    }

    return {
      headers,
      rowIndex,
      values: headers.map((header) => raw[header]),
      raw,
    };
  }

  private denormalizeHeader(header: string): string {
    return header.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

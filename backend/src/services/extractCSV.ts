import { Injectable } from '@nestjs/common';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { AssetFileInput, ExtractionResult, SupportedFileType } from '../utils/extraction.types';
import { createExtractionMetadata } from '../utils/file.utils';
import type { RawCsvRow } from '../utils/csv-stream.types';
import { RowValidationHelper } from '../helpers/row-validation.helper';
import { AssetMappingHelper } from '../helpers/asset-mapping.helper';
import { createLogger } from '../helpers/console-logger.helper';
import { ExtractionProcessor } from '../helpers/extraction-processor.helper';
import { ExtractionContext } from '../strategies/extraction-strategy.interface';

export type RowProcessor = (
  row: Record<string, unknown>,
  rowIndex: number,
) => Promise<void>;

@Injectable()
export class CsvExtractionService {
  private readonly logger = createLogger('CsvExtractionService');
  private readonly rowValidator = new RowValidationHelper();
  private readonly assetMapper = new AssetMappingHelper();

  async extractDataFromCsv(input: AssetFileInput): Promise<ExtractionResult> {
    try {
      this.logger.info('Starting CSV extraction', { filename: input.filename });

      const { warnings } = await this.processCsvStream(input, null);

      return {
        sourceFile: input.filename,
        fileType: SupportedFileType.Csv,
        metadata: createExtractionMetadata(0, warnings),
      };
    } catch (error) {
      throw new Error(`CSV extraction failed: ${(error as Error).message}`);
    }
  }

  async extractWithProcessor(
    input: AssetFileInput,
    context: ExtractionContext,
  ): Promise<ExtractionResult> {
    try {
      this.logger.info('Starting CSV extraction with processor', { filename: input.filename });

      const warnings: string[] = [];
      const processor = new ExtractionProcessor(context);

      const sampleRows: { row: Record<string, unknown>; sourceRowIndex: number }[] = [];
      let rowIndex = 0;

      await this.processCsvStream(input, async (row, index) => {
        rowIndex = index;
        const candidate = this.assetMapper.mapRow(row as Record<string, string | null>, index);
        const rowData = candidate.normalizedRowData || candidate.rawRowData || {};

        if (sampleRows.length < 20) {
          sampleRows.push({ row: rowData, sourceRowIndex: index });
        }

        await processor.processRow(rowData, index);
      });

      const schema = await processor.inferInitialSchema(sampleRows);
      processor.setSchema(schema);

      await processor.flush();

      const stats = processor.getStats();

      return {
        sourceFile: input.filename,
        fileType: SupportedFileType.Csv,
        metadata: createExtractionMetadata(stats.total, warnings),
        processingStats: {
          totalRows: stats.total,
          deterministicRows: stats.deterministic,
          ambiguousRows: stats.ambiguous,
          persistedCount: stats.deterministic,
          enrichedCount: stats.ambiguous,
          errors: [],
        },
      };
    } catch (error) {
      throw new Error(`CSV extraction failed: ${(error as Error).message}`);
    }
  }

  private async processCsvStream(
    input: AssetFileInput,
    processor: RowProcessor | null,
  ): Promise<{ warnings: string[] }> {
    const warnings: string[] = [];

    return new Promise((resolve, reject) => {
      const buffer = Buffer.from(input.buffer);
      const stream = Readable.from(buffer);

      let headers: string[] = [];
      let rowIndex = 0;

      stream
        .pipe(csvParser())
        .on('headers', (cols: string[]) => {
          headers = cols;
          this.rowValidator.setHeaderCount(cols.length);
        })
        .on('data', async (row: Record<string, string>) => {
          rowIndex++;
          const rawValues = headers.map((h) => row[h]);

          const rawRow: RawCsvRow = { rowIndex, headers, values: rawValues, raw: row };
          const validation = this.rowValidator.validateRow(rawRow);

          if (!validation.isValid) {
            validation.errors.forEach((err) => warnings.push(`Row ${err.rowIndex}: ${err.reason}`));
            return;
          }

          const parsed = this.rowValidator.parseRow(rawRow);

          if (processor) {
            await processor(parsed.data, rowIndex);
          }
        })
        .on('end', () => {
          this.logger.info('CSV extraction completed', { rowsProcessed: rowIndex });
          resolve({ warnings });
        })
        .on('error', (error: Error) => {
          this.logger.error('CSV stream error', { error: error.message });
          reject(error);
        });
    });
  }
}
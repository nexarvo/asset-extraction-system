import { Injectable } from '@nestjs/common';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { AssetFileInput, ExtractionResult, SupportedFileType } from '../utils/extraction.types';
import { createExtractionMetadata } from '../utils/file.utils';
import type { ExtractedAssetCandidate, RawCsvRow } from '../utils/csv-stream.types';
import { RowValidationHelper } from '../helpers/row-validation.helper';
import { AssetMappingHelper } from '../helpers/asset-mapping.helper';
import { createLogger } from '../helpers/console-logger.helper';

@Injectable()
export class CsvExtractionService {
  private readonly logger = createLogger('CsvExtractionService');
  private readonly rowValidator = new RowValidationHelper();
  private readonly assetMapper = new AssetMappingHelper();

  async extractDataFromCsv(input: AssetFileInput): Promise<ExtractionResult> {
    try {
      this.logger.info('Starting CSV extraction', { filename: input.filename });

      const { candidates, warnings } = await this.processCsvStream(input);

      return {
        sourceFile: input.filename,
        fileType: SupportedFileType.Csv,
        records: candidates as unknown as Record<string, unknown>[],
        metadata: createExtractionMetadata(candidates.length, warnings),
      };
    } catch (error) {
      throw new Error(`CSV extraction failed: ${(error as Error).message}`);
    }
  }

  private async processCsvStream(
    input: AssetFileInput,
  ): Promise<{ candidates: ExtractedAssetCandidate[]; warnings: string[] }> {
    const warnings: string[] = [];
    const results: ExtractedAssetCandidate[] = [];

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
        .on('data', (row: Record<string, string>) => {
          rowIndex++;
          const rawValues = headers.map((h) => row[h]);

          const rawRow: RawCsvRow = { rowIndex, headers, values: rawValues, raw: row };
          const validation = this.rowValidator.validateRow(rawRow);

          if (!validation.isValid) {
            validation.errors.forEach((err) => warnings.push(`Row ${err.rowIndex}: ${err.reason}`));
            return;
          }

          const parsed = this.rowValidator.parseRow(rawRow);
          const candidate = this.assetMapper.mapRow(parsed.data, rowIndex);
          results.push(candidate);
        })
        .on('end', () => {
          this.logger.info('CSV extraction completed', { rowsProcessed: rowIndex, candidatesFound: results.length });
          resolve({ candidates: results, warnings });
        })
        .on('error', (error: Error) => {
          this.logger.error('CSV stream error', { error: error.message });
          reject(error);
        });
    });
  }
}
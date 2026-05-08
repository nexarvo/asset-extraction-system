import { Injectable } from '@nestjs/common';
import { CsvExtractionService } from '../services/extractCSV';
import { AssetFileInput, ExtractionResult } from '../utils/extraction.types';
import { IExtractionStrategy, ExtractionContext } from './extraction-strategy.interface';

@Injectable()
export class CsvExtractionStrategy implements IExtractionStrategy {
  constructor(private readonly csvExtractionService: CsvExtractionService) {}

  canHandle(fileType: string): boolean {
    return fileType === 'csv';
  }

  async extract(
    buffer: Buffer,
    filename: string,
    context: ExtractionContext,
  ): Promise<ExtractionResult> {
    const input: AssetFileInput = {
      filename,
      buffer,
      mimeType: 'text/csv',
    };

    return this.csvExtractionService.extractWithProcessor(input, context);
  }
}

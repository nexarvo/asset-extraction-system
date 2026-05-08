import { Injectable } from '@nestjs/common';
import { XlsxExtractionService } from '../services/extractXLSX';
import { AssetFileInput, ExtractionResult } from '../utils/extraction.types';
import { IExtractionStrategy, ExtractionContext } from './extraction-strategy.interface';

@Injectable()
export class XlsxExtractionStrategy implements IExtractionStrategy {
  constructor(private readonly xlsxExtractionService: XlsxExtractionService) {}

  canHandle(fileType: string): boolean {
    return fileType === 'xlsx' || fileType === 'xls';
  }

  async extract(
    buffer: Buffer,
    filename: string,
    context: ExtractionContext,
  ): Promise<ExtractionResult> {
    const isXls = filename.toLowerCase().endsWith('.xls');
    const input: AssetFileInput = {
      filename,
      buffer,
      mimeType: isXls
        ? 'application/vnd.ms-excel'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    return this.xlsxExtractionService.extractWithProcessor(input, context);
  }
}

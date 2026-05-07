import { Injectable } from '@nestjs/common';
import { XlsxExtractionService } from '../services/extractXLSX';
import { AssetFileInput, ExtractionResult } from '../utils/extraction.types';
import { IExtractionStrategy } from './extraction-strategy.interface';

@Injectable()
export class XlsxExtractionStrategy implements IExtractionStrategy {
  constructor(private readonly xlsxExtractionService: XlsxExtractionService) {}

  canHandle(fileType: string): boolean {
    return fileType === 'xlsx';
  }

  async extract(buffer: Buffer, filename: string): Promise<ExtractionResult> {
    const input: AssetFileInput = {
      filename,
      buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    return this.xlsxExtractionService.extractDataFromXlsx(input);
  }
}
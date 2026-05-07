import { Injectable } from '@nestjs/common';
import { PdfExtractionService } from '../services/extractPDF';
import { AssetFileInput, ExtractionResult } from '../utils/extraction.types';
import { IExtractionStrategy } from './extraction-strategy.interface';

@Injectable()
export class PdfExtractionStrategy implements IExtractionStrategy {
  constructor(private readonly pdfExtractionService: PdfExtractionService) {}

  canHandle(fileType: string): boolean {
    return fileType === 'pdf';
  }

  async extract(buffer: Buffer, filename: string): Promise<ExtractionResult> {
    const input: AssetFileInput = {
      filename,
      buffer,
      mimeType: 'application/pdf',
    };

    return this.pdfExtractionService.extractDataFromPdf(input);
  }
}
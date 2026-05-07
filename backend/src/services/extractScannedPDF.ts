import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../core/app-logger.service';
import {
  AssetFileInput,
  ExtractedAssetRecord,
  ExtractionResult,
  PdfExtractionStrategy,
  SupportedFileType,
} from '../utils/extraction.types';
import { createExtractionMetadata } from '../utils/file.utils';
import { PaddleOcrService } from './paddleOCR';

@Injectable()
export class ScannedPdfExtractionService {
  constructor(
    private readonly paddleOcrService: PaddleOcrService,
    private readonly logger: AppLoggerService,
  ) {}

  async extractDataFromScannedPdf(
    input: AssetFileInput,
  ): Promise<ExtractionResult> {
    this.logger.log(
      'starting scanned pdf extraction',
      'ScannedPdfExtractionService',
      { filename: input.filename },
    );
    const ocrResult = await this.paddleOcrService.extractTextFromPdf(input);
    const records = this.mapOcrTextToRecords(ocrResult.text);

    return {
      sourceFile: input.filename,
      fileType: SupportedFileType.Pdf,
      strategy: PdfExtractionStrategy.Scanned,
      text: ocrResult.text,
      records,
      metadata: createExtractionMetadata(records.length, [
        `ocrConfidence:${ocrResult.confidence}`,
      ]),
    };
  }

  private mapOcrTextToRecords(text: string): ExtractedAssetRecord[] {
    if (!text) {
      return [];
    }

    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => ({ lineNumber: index + 1, text: line }));
  }
}

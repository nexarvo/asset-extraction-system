import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../core/app-logger.service';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import {
  AssetFileInput,
  ExtractedAssetRecord,
  ExtractionResult,
  PdfExtractionStrategy,
  SupportedFileType,
} from '../utils/extraction.types';
import { createExtractionMetadata } from '../utils/file.utils';

@Injectable()
export class DigitalPdfExtractionService {
  constructor(private readonly logger: AppLoggerService) {}

  async extractDataFromDigitalPdf(
    input: AssetFileInput,
  ): Promise<ExtractionResult> {
    try {
      this.logger.log(
        'starting digital pdf extraction',
        'DigitalPdfExtractionService',
        { filename: input.filename },
      );
      const text = this.extractText(input.buffer);
      const records = this.mapTextToRecords(text);

      return {
        sourceFile: input.filename,
        fileType: SupportedFileType.Pdf,
        strategy: PdfExtractionStrategy.Digital,
        text,
        records,
        metadata: createExtractionMetadata(records.length),
      };
    } catch (error) {
      throw new ApplicationError(ErrorCode.PdfExtractionFailed, undefined, {
        filename: input.filename,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private extractText(buffer: Buffer): string {
    return buffer
      .toString('utf8')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private mapTextToRecords(text: string): ExtractedAssetRecord[] {
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

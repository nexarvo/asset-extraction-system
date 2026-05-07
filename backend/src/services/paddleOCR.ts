import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../core/app-logger.service';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import { AssetFileInput, OcrResult } from '../utils/extraction.types';

@Injectable()
export class PaddleOcrService {
  constructor(private readonly logger: AppLoggerService) {}

  async extractTextFromPdf(input: AssetFileInput): Promise<OcrResult> {
    try {
      this.logger.log('starting paddleocr extraction', 'PaddleOcrService', {
        filename: input.filename,
      });
      const decoded = input.buffer.toString('utf8');
      const text = this.extractDummyText(decoded);

      return {
        text,
        confidence: text.length > 0 ? 0.9 : 0,
        engine: 'paddleocr',
      };
    } catch (error) {
      throw new ApplicationError(ErrorCode.OcrExtractionFailed, undefined, {
        filename: input.filename,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private extractDummyText(decodedPdf: string): string {
    const explicitText = decodedPdf
      .match(/OCR_TEXT:\s*([\s\S]*)/i)?.[1]
      ?.trim();
    if (explicitText) {
      return explicitText;
    }

    return decodedPdf
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../core/app-logger.service';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import { AssetFileInput, ExtractionResult } from '../utils/extraction.types';
import { DigitalPdfExtractionService } from './extractDigitalPDF';
import { ScannedPdfExtractionService } from './extractScannedPDF';

@Injectable()
export class PdfExtractionService {
  constructor(
    private readonly digitalPdfExtractionService: DigitalPdfExtractionService,
    private readonly scannedPdfExtractionService: ScannedPdfExtractionService,
    private readonly logger: AppLoggerService,
  ) {}

  async extractDataFromPdf(input: AssetFileInput): Promise<ExtractionResult> {
    try {
      const isScanned = this.isLikelyScannedPdf(input.buffer);
      this.logger.log('selected pdf extraction strategy', 'PdfExtractionService', {
        filename: input.filename,
        strategy: isScanned ? 'scanned' : 'digital',
      });

      if (isScanned) {
        return this.scannedPdfExtractionService.extractDataFromScannedPdf(input);
      }

      return this.digitalPdfExtractionService.extractDataFromDigitalPdf(input);
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }

      throw new ApplicationError(ErrorCode.PdfExtractionFailed, undefined, {
        filename: input.filename,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private isLikelyScannedPdf(buffer: Buffer): boolean {
    const decoded = buffer.toString('utf8');

    if (/SCANNED_PDF|OCR_TEXT:/i.test(decoded)) {
      return true;
    }

    const printableCharacters = decoded.replace(/[^\x20-\x7E]/g, '');
    return printableCharacters.trim().length < 25;
  }
}

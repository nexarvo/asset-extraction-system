import { Injectable } from '@nestjs/common';
import pdf = require('pdf-parse');
import { AppLoggerService } from '../core/app-logger.service';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import {
  AssetFileInput,
  ExtractedAssetRecord,
  ExtractionResult,
  PdfDocument,
  PdfExtractionStrategy,
  PdfPage,
  SupportedFileType,
  TextBlock,
  TextBlockType,
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

      const pdfDocument = await this.parsePdf(input.buffer);
      const records = this.extractRecordsFromPdf(pdfDocument);

      this.logger.log(
        'digital pdf extraction completed',
        'DigitalPdfExtractionService',
        {
          filename: input.filename,
          pageCount: pdfDocument.pages.length,
          recordCount: records.length,
        },
      );

      return {
        sourceFile: input.filename,
        fileType: SupportedFileType.Pdf,
        strategy: PdfExtractionStrategy.Digital,
        records,
        pdfDocument,
        metadata: createExtractionMetadata(records.length),
      };
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }

      this.logger.error(
        'digital pdf extraction failed',
        error instanceof Error ? error.stack : undefined,
        'DigitalPdfExtractionService',
        {
          filename: input.filename,
          error: error instanceof Error ? error.message : String(error),
        },
      );

      throw new ApplicationError(ErrorCode.PdfExtractionFailed, undefined, {
        filename: input.filename,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async parsePdf(buffer: Buffer): Promise<PdfDocument> {
    const data = await pdf(buffer, {
      max: 0,
      version: 'v1.10.100',
    });

    const totalPages = data.numpages;
    const fullText = data.text ?? '';

    this.logger.log(
      'pdf text extracted',
      'DigitalPdfExtractionService',
      { totalPages, textLength: fullText.length },
    );

    const pageTexts = this.splitByPageMarkers(fullText, totalPages);

    const pages: PdfPage[] = [];

    for (let i = 0; i < pageTexts.length; i++) {
      const pageNum = i + 1;
      this.logger.log(
        'parsing pdf page',
        'DigitalPdfExtractionService',
        { pageNumber: pageNum, totalPages },
      );

      const textBlocks = this.extractTextBlocks(pageTexts[i], pageNum);

      pages.push({
        pageNumber: pageNum,
        textBlocks,
      });
    }

    return { pages };
  }

  private splitByPageMarkers(text: string, totalPages: number): string[] {
    if (totalPages === 1) {
      return [text];
    }

    const formFeedMatches = text.match(/\f/g);
    const formFeedCount = formFeedMatches ? formFeedMatches.length : 0;

    if (formFeedCount >= totalPages - 1) {
      return text
        .split(/\f/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const pagePatternMatches = text.match(/Page\s+(\d+)\s+of\s+\d+/gi);
    if (pagePatternMatches && pagePatternMatches.length >= totalPages - 1) {
      const parts: string[] = [];
      const regex = /(Page\s+)(\d+)( of )(\d+)/gi;
      let lastIndex = 0;
      let match;
      let pageNum = 1;

      while ((match = regex.exec(text)) !== null) {
        parts.push(text.slice(lastIndex, match.index).trim());
        lastIndex = regex.lastIndex;
        pageNum++;
      }

      if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex).trim());
      }

      return parts.filter(Boolean);
    }

    const avgLength = Math.ceil(text.length / totalPages);
    const pages: string[] = [];

    for (let i = 0; i < totalPages; i++) {
      const start = i * avgLength;
      const end = i === totalPages - 1 ? text.length : (i + 1) * avgLength;
      pages.push(text.slice(start, end).trim());
    }

    return pages;
  }

  private extractTextBlocks(pageText: string, pageNumber: number): TextBlock[] {
    const blocks: TextBlock[] = [];
    const paragraphs = pageText.split(/\n\s*\n/);

    for (const paragraph of paragraphs) {
      const trimmedText = paragraph.trim();
      if (!trimmedText) continue;

      const blockType = this.determineBlockType(trimmedText);
      blocks.push({
        text: trimmedText,
        type: blockType,
      });
    }

    if (blocks.length === 0 && pageText.trim()) {
      blocks.push({
        text: pageText.trim(),
        type: 'unknown' as TextBlockType,
      });
    }

    return blocks;
  }

  private determineBlockType(text: string): TextBlockType {
    const firstLine = text.split('\n')[0]?.trim() ?? '';

    if (firstLine.length > 0 && firstLine.length < 100) {
      const hasNumbers = /\d/.test(firstLine);
      const isAllCaps = firstLine === firstLine.toUpperCase() && /[A-Z]/.test(firstLine);

      if (isAllCaps && firstLine.length < 50) {
        return 'header';
      }

      if (!hasNumbers && firstLine.length < 60) {
        return 'header';
      }
    }

    if (text.includes('Footnotes') || text.includes('footnote')) {
      return 'footer';
    }

    const tableIndicators = ['\t', '  ', '|'];
    const hasTableStructure = tableIndicators.some((indicator) => text.includes(indicator));

    if (hasTableStructure && text.split('\n').length > 1) {
      return 'table';
    }

    return 'paragraph';
  }

  private extractRecordsFromPdf(pdfDocument: PdfDocument): ExtractedAssetRecord[] {
    const records: ExtractedAssetRecord[] = [];

    for (const page of pdfDocument.pages) {
      for (const block of page.textBlocks) {
        records.push({
          pageNumber: page.pageNumber,
          blockType: block.type,
          text: block.text,
        });
      }
    }

    return records;
  }
}
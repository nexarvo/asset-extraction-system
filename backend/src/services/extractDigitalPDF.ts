import { Injectable } from '@nestjs/common';
import * as pdfjs from 'pdfjs-dist';
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
  PdfTextItem,
  SupportedFileType,
  TextBlock,
  TextBlockType,
} from '../utils/extraction.types';
import { createExtractionMetadata } from '../utils/file.utils';

pdfjs.GlobalWorkerOptions.workerSrc = '';

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
      const records = this.convertToRecords(pdfDocument);

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
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;

    const pages: PdfPage[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      this.logger.log('parsing pdf page', 'DigitalPdfExtractionService', {
        pageNumber: pageNum,
        totalPages: pdf.numPages,
      });

      const page = await pdf.getPage(pageNum);
      const items = await this.extractTextItems(page);
      const textBlocks = this.groupSpatially(items, pageNum);

      pages.push({
        pageNumber: pageNum,
        items,
        textBlocks,
      });
    }

    return { pages };
  }

  private async extractTextItems(page: pdfjs.PDFPage): Promise<PdfTextItem[]> {
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    const items: PdfTextItem[] = [];

    for (const item of textContent.items) {
      if ('str' in item && item.str) {
        const transform = item.transform;
        const fontSize = Math.sqrt(
          transform[0] * transform[0] + transform[1] * transform[1],
        );

        items.push({
          text: item.str,
          x: transform[4],
          y: viewport.height - transform[5],
          width: item.width,
          height: item.height,
          fontSize: fontSize > 0 ? fontSize : undefined,
        });
      }
    }

    return items;
  }

  private groupSpatially(
    items: PdfTextItem[],
    pageNumber: number,
  ): TextBlock[] {
    if (items.length === 0) {
      return [];
    }

    const sortedByY = [...items].sort((a, b) => a.y - b.y);
    const yBands = this.groupIntoYBands(sortedByY);

    const blocks: TextBlock[] = [];

    for (const band of yBands) {
      const xClusters = this.groupByXGaps(band);

      for (const cluster of xClusters) {
        if (cluster.length === 0) continue;

        const blockType = this.detectBlockType(cluster);
        const text = cluster.map((item) => item.text).join(' ');
        const boundingBox = this.computeBoundingBox(cluster);

        blocks.push({
          text,
          type: blockType,
          pageNumber,
          items: cluster,
          boundingBox,
        });
      }
    }

    return blocks;
  }

  private groupIntoYBands(items: PdfTextItem[]): PdfTextItem[][] {
    if (items.length === 0) return [];

    const bands: PdfTextItem[][] = [];
    let currentBand: PdfTextItem[] = [];
    let currentY = items[0].y;
    const yThreshold = 12;

    for (const item of items) {
      if (Math.abs(item.y - currentY) > yThreshold) {
        if (currentBand.length > 0) bands.push(currentBand);
        currentBand = [item];
        currentY = item.y;
      } else {
        currentBand.push(item);
      }
    }

    if (currentBand.length > 0) bands.push(currentBand);

    return bands;
  }

  private groupByXGaps(band: PdfTextItem[]): PdfTextItem[][] {
    if (band.length === 0) return [];

    const sortedByX = [...band].sort((a, b) => a.x - b.x);
    const clusters: PdfTextItem[][] = [];
    let currentCluster: PdfTextItem[] = [];
    let lastX = sortedByX[0].x;
    const xGapThreshold = 25;

    for (const item of sortedByX) {
      if (item.x - lastX > xGapThreshold) {
        if (currentCluster.length > 0) clusters.push(currentCluster);
        currentCluster = [item];
      } else {
        currentCluster.push(item);
      }
      lastX = item.x;
    }

    if (currentCluster.length > 0) clusters.push(currentCluster);

    return clusters;
  }

  private detectBlockType(items: PdfTextItem[]): TextBlockType {
    if (items.length < 3) return 'paragraph';

    const xValues = items.map((i) => i.x);
    const yValues = items.map((i) => i.y);

    const xVariance = this.computeVariance(xValues);
    const yVariance = this.computeVariance(yValues);

    if (xVariance > 5000 && yVariance < 100) {
      return 'table';
    }

    const avgFontSize =
      items.reduce((sum, i) => sum + (i.fontSize ?? 0), 0) / items.length;
    if (avgFontSize > 14 && items.length <= 2) {
      return 'header';
    }

    return 'paragraph';
  }

  private computeVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    return (
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );
  }

  private computeBoundingBox(items: PdfTextItem[]) {
    return {
      xMin: Math.min(...items.map((i) => i.x)),
      xMax: Math.max(...items.map((i) => i.x + (i.width ?? 0))),
      yMin: Math.min(...items.map((i) => i.y)),
      yMax: Math.max(...items.map((i) => i.y + (i.height ?? 0))),
    };
  }

  private convertToRecords(pdfDocument: PdfDocument): ExtractedAssetRecord[] {
    const records: ExtractedAssetRecord[] = [];

    for (const page of pdfDocument.pages) {
      for (const block of page.textBlocks) {
        records.push({
          pageNumber: block.pageNumber,
          blockType: block.type,
          text: block.text,
          items: block.items,
          boundingBox: block.boundingBox,
        });
      }
    }

    return records;
  }
}

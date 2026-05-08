import { Injectable } from '@nestjs/common';
import { IExtractionStrategy } from './extraction-strategy.interface';
import { CsvExtractionStrategy } from './csv-extraction.strategy';
import { XlsxExtractionStrategy } from './xlsx-extraction.strategy';
import { PdfExtractionStrategy } from './pdf-extraction.strategy';

@Injectable()
export class ExtractionStrategyFactory {
  constructor(
    private readonly csvStrategy: CsvExtractionStrategy,
    private readonly xlsxStrategy: XlsxExtractionStrategy,
    private readonly pdfStrategy: PdfExtractionStrategy,
  ) {}

  getStrategy(fileType: string): IExtractionStrategy | null {
    const strategies = [this.csvStrategy, this.xlsxStrategy, this.pdfStrategy];

    return strategies.find((s) => s.canHandle(fileType)) ?? null;
  }
}

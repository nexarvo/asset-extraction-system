import * as XLSX from 'xlsx';
import { AppLoggerService } from '../core/app-logger.service';
import { PdfExtractionStrategy } from '../utils/extraction.types';
import { CsvExtractionService } from './extractCSV';
import { DigitalPdfExtractionService } from './extractDigitalPDF';
import { PdfExtractionService } from './extractPDF';
import { ScannedPdfExtractionService } from './extractScannedPDF';
import { XlsxExtractionService } from './extractXLSX';
import { PaddleOcrService } from './paddleOCR';

describe('Extraction services', () => {
  const logger = new AppLoggerService();

  beforeEach(() => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('processes structured CSV files successfully', async () => {
    const service = new CsvExtractionService(logger);
    const result = await service.extractDataFromCsv({
      filename: 'assets.csv',
      buffer: Buffer.from('assetId,name\nA-1,Laptop\nA-2,Monitor'),
    });

    expect(result.records).toEqual([
      { assetId: 'A-1', name: 'Laptop' },
      { assetId: 'A-2', name: 'Monitor' },
    ]);
    expect(result.metadata.rowCount).toBe(2);
  });

  it('processes spreadsheet files successfully', async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([{ assetId: 'A-1', name: 'Laptop' }]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');

    const service = new XlsxExtractionService(logger);
    const result = await service.extractDataFromXlsx({
      filename: 'assets.xlsx',
      buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
    });

    expect(result.records).toEqual([{ sheetName: 'Assets', assetId: 'A-1', name: 'Laptop' }]);
  });

  it('routes digital PDFs to the digital extraction service', async () => {
    const service = createPdfExtractionService();
    const result = await service.extractDataFromPdf({
      filename: 'digital.pdf',
      buffer: Buffer.from('%PDF-1.7\nAsset Register\nLaptop A-1'),
    });

    expect(result.strategy).toBe(PdfExtractionStrategy.Digital);
    expect(result.text).toContain('Asset Register');
  });

  it('routes scanned PDFs to the OCR extraction service', async () => {
    const service = createPdfExtractionService();
    const result = await service.extractDataFromPdf({
      filename: 'scan.pdf',
      buffer: Buffer.from('SCANNED_PDF\nOCR_TEXT: Laptop A-1'),
    });

    expect(result.strategy).toBe(PdfExtractionStrategy.Scanned);
    expect(result.text).toBe('Laptop A-1');
  });

  it('uses PaddleOCR integration to extract text from scanned PDFs', async () => {
    const paddleOcr = new PaddleOcrService(logger);
    const result = await paddleOcr.extractTextFromPdf({
      filename: 'scan.pdf',
      buffer: Buffer.from('OCR_TEXT: Monitor A-2'),
    });

    expect(result).toEqual({
      text: 'Monitor A-2',
      confidence: 0.9,
      engine: 'paddleocr',
    });
  });

  function createPdfExtractionService(): PdfExtractionService {
    const paddleOcr = new PaddleOcrService(logger);
    return new PdfExtractionService(
      new DigitalPdfExtractionService(logger),
      new ScannedPdfExtractionService(paddleOcr, logger),
      logger,
    );
  }
});

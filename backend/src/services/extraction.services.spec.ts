import * as XLSX from 'xlsx';
import { AppLoggerService } from '../core/app-logger.service';
import { RawCsvRow, PdfExtractionStrategy } from '../utils/extraction.types';
import { CsvRowValidator, normalizeCsvHeaders } from '../utils/csv.utils';
import { CsvAssetMapperService } from './csvAssetMapper.service';
import { CsvExtractionService } from './extractCSV';
import { DigitalPdfExtractionService } from './extractDigitalPDF';
import { PdfExtractionService } from './extractPDF';
import { ScannedPdfExtractionService } from './extractScannedPDF';
import { XlsxExtractionService } from './extractXLSX';
import { PaddleOcrService } from './paddleOCR';

describe('Extraction services', () => {
  const logger = new AppLoggerService();
  const csvAssetMapperService = new CsvAssetMapperService();

  beforeEach(() => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('processes structured CSV files successfully', async () => {
    const service = new CsvExtractionService(logger, csvAssetMapperService);
    const result = await service.extractDataFromCsv({
      filename: 'assets.csv',
      buffer: Buffer.from('assetId,name\nA-1,Laptop\nA-2,Monitor'),
    });

    expect(result.records).toEqual([
      { assetid: 'A-1', name: 'Laptop' },
      { assetid: 'A-2', name: 'Monitor' },
    ]);
    expect(result.metadata.rowCount).toBe(2);
  });

  it('normalizes inconsistent CSV headers', async () => {
    const service = new CsvExtractionService(logger, csvAssetMapperService);
    const result = await service.extractDataFromCsv({
      filename: 'assets.csv',
      buffer: Buffer.from(' Asset ID , Asset Name ,Asset ID\nA-1,Laptop,DUP'),
    });

    expect(result.records).toEqual([{ asset_id: 'A-1', asset_name: 'Laptop', asset_id_2: 'DUP' }]);
  });

  it('logs malformed CSV rows and continues extraction', async () => {
    const service = new CsvExtractionService(logger, csvAssetMapperService);
    const result = await service.extractDataFromCsv({
      filename: 'assets.csv',
      buffer: Buffer.from('assetId,name\nA-1,Laptop\nBROKEN\nA-2,Monitor,EXTRA\nA-3,Keyboard'),
    });

    expect(result.records).toEqual([
      { assetid: 'A-1', name: 'Laptop' },
      { assetid: 'A-3', name: 'Keyboard' },
    ]);
    expect(result.metadata.warnings).toEqual([
      'row 3: Missing columns: name.',
      'row 4: Extra columns detected: 1.',
    ]);
  });

  it('detects mismatched CSV column counts in the row validator', () => {
    const validator = new CsvRowValidator();
    const row: RawCsvRow = {
      headers: ['assetid', 'name'],
      values: ['A-1', ''],
      extraValues: ['unexpected'],
      rowIndex: 2,
      raw: { assetid: 'A-1', _2: 'unexpected' },
    };

    const failures = validator.validate(row);

    expect(failures.map((failure) => failure.reason)).toEqual([
      'Missing columns: name.',
      'Extra columns detected: 1.',
    ]);
  });

  it('maps raw CSV rows into structured asset records', () => {
    const record = csvAssetMapperService.mapRow({
      headers: ['assetid', 'name', 'location'],
      values: ['A-1', 'Laptop', ''],
      extraValues: [],
      rowIndex: 2,
      raw: { assetid: 'A-1', name: 'Laptop', location: '' },
    });

    expect(record).toEqual({ assetid: 'A-1', name: 'Laptop', location: null });
  });

  it('deduplicates normalized CSV headers', () => {
    expect(normalizeCsvHeaders(['Asset ID', ' asset id ', ''])).toEqual(['asset_id', 'asset_id_2', 'column_3']);
  });

  it('processes a large CSV payload through the streaming parser', async () => {
    const service = new CsvExtractionService(logger, csvAssetMapperService);
    const largeDescription = 'x'.repeat(51 * 1024 * 1024);
    const result = await service.extractDataFromCsv({
      filename: 'large-assets.csv',
      buffer: Buffer.from(`assetId,description\nA-1,${largeDescription}`),
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0].assetid).toBe('A-1');
    expect(result.metadata.rowCount).toBe(1);
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

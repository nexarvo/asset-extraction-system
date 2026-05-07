import * as XLSX from 'xlsx';
import { AppLoggerService } from '../core/app-logger.service';
import {
  RawCsvRow,
  RawXlsxRow,
  PdfExtractionStrategy,
} from '../utils/extraction.types';
import { CsvRowValidator, normalizeCsvHeaders } from '../utils/csv.utils';
import { XlsxRowValidator, normalizeXlsxHeaders } from '../utils/xlsx.utils';
import { CsvAssetMapperService } from './csvAssetMapper.service';
import { CsvExtractionService } from './extractCSV';
import { DigitalPdfExtractionService } from './extractDigitalPDF';
import { PdfExtractionService } from './extractPDF';
import { ScannedPdfExtractionService } from './extractScannedPDF';
import { XlsxExtractionService } from './extractXLSX';
import { PaddleOcrService } from './paddleOCR';
import { XlsxAssetMapperService } from './xlsxAssetMapper.service';

describe('Extraction services', () => {
  const logger = new AppLoggerService();
  const csvAssetMapperService = new CsvAssetMapperService();
  const xlsxAssetMapperService = new XlsxAssetMapperService();

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

    expect(result.records).toEqual([
      { asset_id: 'A-1', asset_name: 'Laptop', asset_id_2: 'DUP' },
    ]);
  });

  it('logs malformed CSV rows and continues extraction', async () => {
    const service = new CsvExtractionService(logger, csvAssetMapperService);
    const result = await service.extractDataFromCsv({
      filename: 'assets.csv',
      buffer: Buffer.from(
        'assetId,name\nA-1,Laptop\nBROKEN\nA-2,Monitor,EXTRA\nA-3,Keyboard',
      ),
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
    expect(normalizeCsvHeaders(['Asset ID', ' asset id ', ''])).toEqual([
      'asset_id',
      'asset_id_2',
      'column_3',
    ]);
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
    const worksheet = XLSX.utils.json_to_sheet([
      { assetId: 'A-1', name: 'Laptop' },
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');

    const service = new XlsxExtractionService(logger, xlsxAssetMapperService);
    const result = await service.extractDataFromXlsx({
      filename: 'assets.xlsx',
      buffer: XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      }) as Buffer,
    });

    expect(result.records).toEqual([
      { sheetName: 'Assets', assetid: 'A-1', name: 'Laptop' },
    ]);
  });

  it('normalizes inconsistent spreadsheet headers', async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      [' Asset ID ', 'Asset Name', 'Asset ID'],
      ['A-1', 'Laptop', 'DUP'],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');

    const service = new XlsxExtractionService(logger, xlsxAssetMapperService);
    const result = await service.extractDataFromXlsx({
      filename: 'assets.xlsx',
      buffer: XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      }) as Buffer,
    });

    expect(result.records).toEqual([
      {
        sheetName: 'Assets',
        asset_id: 'A-1',
        asset_name: 'Laptop',
        asset_id_2: 'DUP',
      },
    ]);
  });

  it('logs malformed spreadsheet rows and continues extraction', async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['assetId', 'name'],
      ['A-1', 'Laptop'],
      ['BROKEN'],
      ['A-2', 'Monitor', 'EXTRA'],
      ['A-3', 'Keyboard'],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');

    const service = new XlsxExtractionService(logger, xlsxAssetMapperService);
    const result = await service.extractDataFromXlsx({
      filename: 'assets.xlsx',
      buffer: XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      }) as Buffer,
    });

    expect(result.records).toEqual([
      { sheetName: 'Assets', assetid: 'A-1', name: 'Laptop' },
      { sheetName: 'Assets', assetid: 'BROKEN', name: null },
      { sheetName: 'Assets', assetid: 'A-3', name: 'Keyboard' },
    ]);
    expect(result.metadata.warnings).toEqual([]);
  });

  it('detects spreadsheet headers below title rows', async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['2024 Utility Bundled Retail Sales- Total'],
      ['(Data from forms EIA-861- schedules 4A & 4D and EIA-861S)'],
      [
        'Entity',
        'State',
        'Ownership',
        'Short Form',
        'Customers (Count)',
        'Sales (Megawatthours)',
        'Revenues (Thousands Dollars)',
        'Average Price (cents/kWh)',
      ],
      [
        'Akiachak Native Community Electric',
        'AK',
        'Cooperative',
        'Y',
        254,
        1976,
        1269.4,
        64.240891,
      ],
      [
        'Short form utilities are only published at the utility level in table 10 (total sector)',
      ],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Table 10');

    const service = new XlsxExtractionService(logger, xlsxAssetMapperService);
    const result = await service.extractDataFromXlsx({
      filename: 'table_10.xlsx',
      buffer: XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      }) as Buffer,
    });

    expect(result.records).toEqual([
      {
        sheetName: 'Table 10',
        entity: 'Akiachak Native Community Electric',
        state: 'AK',
        ownership: 'Cooperative',
        short_form: 'Y',
        customers_count: 254,
        sales_megawatthours: 1976,
        revenues_thousands_dollars: 1269.4,
        average_price_cents_kwh: 64.240891,
      },
    ]);
    expect(result.metadata.warnings).toEqual([]);
  });

  it('preserves sheet context for multi-sheet spreadsheets', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['assetId'], ['A-1']]),
      'Hardware',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['assetId'], ['S-1']]),
      'Software',
    );

    const service = new XlsxExtractionService(logger, xlsxAssetMapperService);
    const result = await service.extractDataFromXlsx({
      filename: 'assets.xlsx',
      buffer: XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      }) as Buffer,
    });

    expect(result.records).toEqual([
      { sheetName: 'Hardware', assetid: 'A-1' },
      { sheetName: 'Software', assetid: 'S-1' },
    ]);
  });

  it('detects mismatched spreadsheet column counts in the row validator', () => {
    const validator = new XlsxRowValidator();
    const row: RawXlsxRow = {
      sheetName: 'Assets',
      headers: ['assetid', 'name'],
      values: ['A-1'],
      extraValues: ['unexpected'],
      rowIndex: 2,
    };

    const failures = validator.validate(row);

    expect(failures.map((failure) => failure.reason)).toEqual([
      'Extra columns detected: 1.',
    ]);
  });

  it('maps raw spreadsheet rows into structured asset records', () => {
    const record = xlsxAssetMapperService.mapRow({
      sheetName: 'Assets',
      headers: ['assetid', 'name', 'location'],
      values: ['A-1', 'Laptop', null],
      extraValues: [],
      rowIndex: 2,
    });

    expect(record).toEqual({
      sheetName: 'Assets',
      assetid: 'A-1',
      name: 'Laptop',
      location: null,
    });
  });

  it('deduplicates normalized spreadsheet headers', () => {
    expect(normalizeXlsxHeaders(['Asset ID', ' asset id ', '!!!'])).toEqual([
      'asset_id',
      'asset_id_2',
      'column_3',
    ]);
  });

  it('processes a large spreadsheet without sheet_to_json conversion', async () => {
    const workbook = XLSX.utils.book_new();
    const rows = [['assetId', 'name']];
    for (let index = 0; index < 5000; index += 1) {
      rows.push([`A-${index}`, `Asset ${index}`]);
    }
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      'Assets',
    );
    const sheetToJsonSpy = jest.spyOn(XLSX.utils, 'sheet_to_json');

    const service = new XlsxExtractionService(logger, xlsxAssetMapperService);
    const result = await service.extractDataFromXlsx({
      filename: 'large-assets.xlsx',
      buffer: XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      }) as Buffer,
    });

    expect(result.records).toHaveLength(5000);
    expect(result.records[0]).toEqual({
      sheetName: 'Assets',
      assetid: 'A-0',
      name: 'Asset 0',
    });
    expect(sheetToJsonSpy).not.toHaveBeenCalled();
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

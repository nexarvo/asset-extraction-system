import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as XLSX from 'xlsx';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppLoggerService } from './../src/core/app-logger.service';
import { HttpExceptionFilter } from './../src/core/http-exception.filter';
import { AppModule } from './../src/app.module';
import { ErrorCode } from './../src/error-codes/error-codes';
import { PdfExtractionStrategy } from './../src/utils/extraction.types';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let logger: AppLoggerService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    logger = moduleFixture.get<AppLoggerService>(AppLoggerService);
    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter(logger));
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/extractions/csv (POST) uploads and extracts CSV files', async () => {
    const response = await request(app.getHttpServer())
      .post('/extractions/csv')
      .attach('file', Buffer.from('assetId,name\nA-1,Laptop'), {
        filename: 'assets.csv',
        contentType: 'text/csv',
      })
      .expect(201);

    expect(response.body.result.records).toEqual([{ assetid: 'A-1', name: 'Laptop' }]);
  });

  it('/extractions/xlsx (POST) uploads and extracts spreadsheets', async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([{ assetId: 'A-2', name: 'Monitor' }]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const response = await request(app.getHttpServer())
      .post('/extractions/xlsx')
      .attach('file', buffer, {
        filename: 'assets.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    expect(response.body.result.records).toEqual([{ sheetName: 'Assets', assetId: 'A-2', name: 'Monitor' }]);
  });

  it('/extractions/pdf (POST) uploads and routes PDF files', async () => {
    const response = await request(app.getHttpServer())
      .post('/extractions/pdf')
      .attach('file', Buffer.from('%PDF-1.7\nAsset Register'), {
        filename: 'assets.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(response.body.result.strategy).toBe(PdfExtractionStrategy.Digital);
    expect(response.body.result.text).toContain('Asset Register');
  });

  it('/extractions/csv (POST) rejects invalid file types', async () => {
    const response = await request(app.getHttpServer())
      .post('/extractions/csv')
      .attach('file', Buffer.from('not,csv'), {
        filename: 'assets.txt',
        contentType: 'application/json',
      })
      .expect(400);

    expect(response.body.error.code).toBe(ErrorCode.UnsupportedFileType);
  });

  it('/extractions/csv (POST) rejects empty uploads gracefully', async () => {
    const response = await request(app.getHttpServer())
      .post('/extractions/csv')
      .attach('file', Buffer.alloc(0), {
        filename: 'empty.csv',
        contentType: 'text/csv',
      })
      .expect(400);

    expect(response.body.error.code).toBe(ErrorCode.ValidationFailed);
  });

  it('/extractions/csv (POST) passes the uploaded buffer into the extraction pipeline', async () => {
    const response = await request(app.getHttpServer())
      .post('/extractions/csv')
      .attach('file', Buffer.from('assetId,name\nBUFFER-1,Camera'), {
        filename: 'buffer-check.csv',
        contentType: 'text/csv',
      })
      .expect(201);

    expect(response.body.result.records[0]).toEqual({ assetid: 'BUFFER-1', name: 'Camera' });
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });
});

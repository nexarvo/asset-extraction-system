import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppLoggerService } from '../core/app-logger.service';
import { CsvExtractionService } from '../services/extractCSV';
import { XlsxExtractionService } from '../services/extractXLSX';
import { PdfExtractionService } from '../services/extractPDF';
import { DigitalPdfExtractionService } from '../services/extractDigitalPDF';
import { ScannedPdfExtractionService } from '../services/extractScannedPDF';
import { JobDispatcherService } from '../services/job-dispatcher.service';
import { ExtractionWorker } from '../workers/extraction.worker';
import { CsvExtractionStrategy } from '../strategies/csv-extraction.strategy';
import { XlsxExtractionStrategy } from '../strategies/xlsx-extraction.strategy';
import { PdfExtractionStrategy } from '../strategies/pdf-extraction.strategy';
import { ExtractionStrategyFactory } from '../strategies/extraction-strategy.factory';
import { ExtractionController } from '../controllers/extraction.controller';
import { ExtractionRepository } from '../repositories/extraction.repository';
import { CsvAssetMapperService } from '../services/csvAssetMapper.service';
import { XlsxAssetMapperService } from '../services/xlsxAssetMapper.service';
import { PaddleOcrService } from '../services/paddleOCR';
import {
  ExtractionJobEntity,
  ExtractionResultEntity,
  ExtractedRecordEntity,
  ExtractionErrorEntity,
} from '../entities';
import { ExtractionJobRepository } from '../repositories/extraction-job.repository';
import { ExtractionResultRepository } from '../repositories/extraction-result.repository';
import { ExtractedRecordRepository } from '../repositories/extracted-record.repository';
import { ExtractionErrorRepository } from '../repositories/extraction-error.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExtractionJobEntity,
      ExtractionResultEntity,
      ExtractedRecordEntity,
      ExtractionErrorEntity,
    ]),
  ],
  controllers: [ExtractionController],
  providers: [
    AppLoggerService,
    CsvExtractionService,
    XlsxExtractionService,
    PdfExtractionService,
    DigitalPdfExtractionService,
    ScannedPdfExtractionService,
    JobDispatcherService,
    ExtractionWorker,
    CsvExtractionStrategy,
    XlsxExtractionStrategy,
    PdfExtractionStrategy,
    ExtractionStrategyFactory,
    ExtractionRepository,
    CsvAssetMapperService,
    XlsxAssetMapperService,
    PaddleOcrService,
    ExtractionJobRepository,
    ExtractionResultRepository,
    ExtractedRecordRepository,
    ExtractionErrorRepository,
  ],
})
export class ExtractionModule {}
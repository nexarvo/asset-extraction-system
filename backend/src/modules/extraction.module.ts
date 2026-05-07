import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../core/database/database.module';
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
  DocumentEntity,
  ProcessingJobEntity,
  DocumentPageEntity,
  ExtractedAssetEntity,
  ExtractedAssetFieldEntity,
  CanonicalAssetEntity,
  CanonicalAssetFieldEntity,
  FieldEvidenceEntity,
  AssetRelationshipEntity,
  DuplicateClusterEntity,
  AssetMatchEntity,
  ValidationFlagEntity,
  ReviewQueueEntity,
  AssetVersionEntity,
  AssetChangeEventEntity,
  ExtractionErrorEntity,
} from '../entities';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([
      DocumentEntity,
      ProcessingJobEntity,
      DocumentPageEntity,
      ExtractedAssetEntity,
      ExtractedAssetFieldEntity,
      CanonicalAssetEntity,
      CanonicalAssetFieldEntity,
      FieldEvidenceEntity,
      AssetRelationshipEntity,
      DuplicateClusterEntity,
      AssetMatchEntity,
      ValidationFlagEntity,
      ReviewQueueEntity,
      AssetVersionEntity,
      AssetChangeEventEntity,
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
  ],
})
export class ExtractionModule {}
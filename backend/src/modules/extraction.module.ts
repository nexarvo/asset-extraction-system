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
import { ExtractionPersistenceService } from '../services/extraction-persistence.service';
import { CsvRowValidator } from '../services/csv-row-validator';
import { XlsxRowValidator } from '../services/xlsx-row-validator';
import { DocumentRepository } from '../repositories/document.repository';
import { ProcessingJobRepository } from '../repositories/processing-job.repository';
import { DocumentPageRepository } from '../repositories/document-page.repository';
import { ExtractedAssetFieldRepository } from '../repositories/extracted-asset-field.repository';
import { CanonicalAssetRepository } from '../repositories/canonical-asset.repository';
import { CanonicalAssetFieldRepository } from '../repositories/canonical-asset-field.repository';
import { FieldEvidenceRepository } from '../repositories/field-evidence.repository';
import { AssetRelationshipRepository } from '../repositories/asset-relationship.repository';
import { DuplicateClusterRepository } from '../repositories/duplicate-cluster.repository';
import { AssetMatchRepository } from '../repositories/asset-match.repository';
import { ValidationFlagRepository } from '../repositories/validation-flag.repository';
import { ReviewQueueRepository } from '../repositories/review-queue.repository';
import { AssetVersionRepository } from '../repositories/asset-version.repository';
import { AssetChangeEventRepository } from '../repositories/asset-change-event.repository';
import { ExtractionErrorRepository } from '../repositories/extraction-error.repository';
import {
  DocumentEntity,
  ProcessingJobEntity,
  DocumentPageEntity,
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
    ExtractionPersistenceService,
    CsvRowValidator,
    XlsxRowValidator,
    DocumentRepository,
    ProcessingJobRepository,
    DocumentPageRepository,
    ExtractedAssetFieldRepository,
    CanonicalAssetRepository,
    CanonicalAssetFieldRepository,
    FieldEvidenceRepository,
    AssetRelationshipRepository,
    DuplicateClusterRepository,
    AssetMatchRepository,
    ValidationFlagRepository,
    ReviewQueueRepository,
    AssetVersionRepository,
    AssetChangeEventRepository,
    ExtractionErrorRepository,
  ],
})
export class ExtractionModule {}
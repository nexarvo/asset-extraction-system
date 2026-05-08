import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../core/database/database.module';
import { AppLoggerService } from '../core/app-logger.service';
import { llmConfig } from '../core/config/llm.config';
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
import { DocumentsController } from '../controllers/documents.controller';
import { ExtractionRepository } from '../repositories/extraction.repository';
import { DocumentsService } from '../services/documents.service';
import { CsvAssetMapperService } from '../services/csvAssetMapper.service';
import { XlsxAssetMapperService } from '../services/xlsxAssetMapper.service';
import { PaddleOcrService } from '../services/paddleOCR';
import { ExtractionPersistenceService } from '../services/extraction-persistence.service';
import { BatchExtractionAccumulator } from '../services/batch-extraction-accumulator.service';
import { StreamingBatchProcessor } from '../services/streaming-batch-processor';
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
import { LLMFactory } from '../services/llmService/factory/llm.factory';
import { SchemaInferenceService } from '../services/llmService/schema-inference.service';
import { EnrichmentService } from '../services/llmService/enrichment.service';
import { ValidationService } from '../services/llmService/validation.service';
import { ConfidenceService } from '../services/llmService/confidence.service';
import { ReviewEscalationService } from '../services/llmService/review-escalation.service';
import { LLMEnrichmentService } from '../services/llmService/llm.service';
import { EnrichmentCoordinatorService } from '../services/llmService/enrichment-coordinator.service';

@Module({
  imports: [
    ConfigModule.forFeature(llmConfig),
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
  controllers: [ExtractionController, DocumentsController],
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
    DocumentsService,
    CsvAssetMapperService,
    XlsxAssetMapperService,
    PaddleOcrService,
    ExtractionPersistenceService,
    BatchExtractionAccumulator,
    StreamingBatchProcessor,
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
    LLMFactory,
    SchemaInferenceService,
    EnrichmentService,
    ValidationService,
    ConfidenceService,
    ReviewEscalationService,
    LLMEnrichmentService,
    EnrichmentCoordinatorService,
  ],
})
export class ExtractionModule {}

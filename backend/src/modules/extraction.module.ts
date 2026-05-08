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
import { PaddleOcrService } from '../services/paddleOCR';
import { ExtractionPersistenceService } from '../services/extraction-persistence.service';
import { DocumentRepository } from '../repositories/document.repository';
import { ProcessingJobRepository } from '../repositories/processing-job.repository';
import { DocumentPageRepository } from '../repositories/document-page.repository';
import { ExtractedAssetFieldRepository } from '../repositories/extracted-asset-field.repository';
import { ValidationFlagRepository } from '../repositories/validation-flag.repository';
import { ReviewQueueRepository } from '../repositories/review-queue.repository';
import {
  DocumentEntity,
  ProcessingJobEntity,
  DocumentPageEntity,
  ExtractedAssetFieldEntity,
  ValidationFlagEntity,
  ReviewQueueEntity,
} from '../entities';
import { LLMFactory } from '../services/llmService/factory/llm.factory';
import { SchemaInferenceService } from '../services/llmService/schema-inference.service';
import { EnrichmentService } from '../services/llmService/enrichment.service';
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
      ValidationFlagEntity,
      ReviewQueueEntity,
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
    PaddleOcrService,
    ExtractionPersistenceService,
    DocumentRepository,
    ProcessingJobRepository,
    DocumentPageRepository,
    ExtractedAssetFieldRepository,
    ValidationFlagRepository,
    ReviewQueueRepository,
    LLMFactory,
    SchemaInferenceService,
    EnrichmentService,
    LLMEnrichmentService,
    EnrichmentCoordinatorService,
  ],
})
export class ExtractionModule {}

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { AppLoggerService } from '../core/app-logger.service';
import { ExtractionStrategyFactory } from '../strategies/extraction-strategy.factory';
import { ExtractionPersistenceService } from '../services/extraction-persistence.service';
import { ProcessingJobRepository } from '../repositories/processing-job.repository';
import { DocumentRepository } from '../repositories/document.repository';
import { EXTRACTION_QUEUE_NAME } from '../queues/extraction.queue';
import {
  ExtractionJobData,
  ExtractionJobResult,
} from '../utils/extraction.types';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import { ProcessingJobStatus } from '../entities/processing-job.entity';
import { LLMEnrichmentService } from '../services/llmService/llm.service';
import { SchemaInferenceService } from '../services/llmService/schema-inference.service';

const WORKER_CONCURRENCY = 3;

@Injectable()
export class ExtractionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly worker: Worker<ExtractionJobData, ExtractionJobResult>;

  constructor(
    private readonly logger: AppLoggerService,
    private readonly strategyFactory: ExtractionStrategyFactory,
    private readonly persistenceService: ExtractionPersistenceService,
    private readonly processingJobRepository: ProcessingJobRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly llmEnrichmentService: LLMEnrichmentService,
    private readonly schemaInferenceService: SchemaInferenceService,
  ) {
    this.worker = new Worker<ExtractionJobData, ExtractionJobResult>(
      EXTRACTION_QUEUE_NAME,
      async (job: Job<ExtractionJobData, ExtractionJobResult>) => {
        return this.processJob(job);
      },
      this.getWorkerOptions(),
    );

    this.worker.on('completed', async (job) => {
      if (job && job.data?.jobId) {
        await this.markJobCompleted(job.data.jobId);
        this.logger.log('job completed', 'ExtractionWorker', {
          jobId: job.data.jobId,
          filename: job.data?.filename,
        });
      }
    });

    this.worker.on('failed', async (job, error) => {
      if (job && job.data?.jobId) {
        await this.setJobError(job.data.jobId, error.message);

        this.logger.error('job failed', error.stack, 'ExtractionWorker', {
          jobId: job.data.jobId,
          filename: job.data?.filename,
          error: error.message,
        });
      }
    });
  }

  private async markJobCompleted(jobId: string): Promise<void> {
    await this.processingJobRepository.markCompleted(jobId);
  }

  private async setJobError(
    jobId: string,
    errorMessage: string,
  ): Promise<void> {
    await this.processingJobRepository.setError(jobId, errorMessage);
  }

  private async processJob(
    job: Job<ExtractionJobData, ExtractionJobResult>,
  ): Promise<ExtractionJobResult> {
    const { jobId, filename, buffer, fileType } = job.data;

    const bufferData =
      typeof buffer === 'string' ? Buffer.from(buffer, 'base64') : buffer;

    this.logger.log('processing job', 'ExtractionWorker', {
      jobId,
      filename,
      fileType,
      attempt: job.attemptsMade,
    });

    await this.processingJobRepository.updateStatus(
      jobId,
      ProcessingJobStatus.RUNNING,
    );

    const processingJob = await this.processingJobRepository.findById(jobId);
    let documentId = processingJob?.documentId;

    if (!documentId) {
      this.logger.warn(
        'No document associated with job, creating one',
        'ExtractionWorker',
        { jobId },
      );

      const doc = await this.documentRepository.createForExtraction(
        filename,
        `uploads/${Date.now()}-${filename}`,
      );

      documentId = doc.id;

      if (documentId) {
        await this.processingJobRepository.updateDocumentId(jobId, documentId);
      } else {
        throw new ApplicationError(ErrorCode.PersistenceFailed, undefined, {
          jobId,
          reason: 'Failed to create document',
        });
      }
    }

    await this.processWithStrategy(
      bufferData,
      filename,
      fileType,
      documentId,
      jobId,
    );

    return {
      jobId,
      status: 'completed',
      filename,
      fileType,
    };
  }

  private async processWithStrategy(
    bufferData: Buffer,
    filename: string,
    fileType: string,
    documentId: string,
    jobId: string,
  ): Promise<void> {
    const strategy = this.strategyFactory.getStrategy(fileType);

    if (!strategy) {
      throw new ApplicationError(ErrorCode.UnsupportedFileType, undefined, {
        filename,
        fileType,
      });
    }

    this.logger.log('extracting with strategy', 'ExtractionWorker', {
      fileType,
      strategy: strategy.constructor.name,
    });

    const context: import('../strategies/extraction-strategy.interface').ExtractionContext = {
      documentId,
      extractionJobId: jobId,
      persistenceService: this.persistenceService,
      llmEnrichmentService: this.llmEnrichmentService,
      schemaInferenceService: this.schemaInferenceService,
    };

    const result = await strategy.extract(bufferData, filename, context);

    const stats = result.processingStats;
    this.logger.log('extraction completed', 'ExtractionWorker', {
      jobId,
      fileType,
      totalRows: stats?.totalRows || 0,
      deterministicRows: stats?.deterministicRows || 0,
      ambiguousRows: stats?.ambiguousRows || 0,
    });
  }

  private getWorkerOptions() {
    return {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
      concurrency: WORKER_CONCURRENCY,
    };
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('extraction worker started', 'ExtractionWorker', {
      concurrency: WORKER_CONCURRENCY,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
  }
}

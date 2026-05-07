import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { AppLoggerService } from '../core/app-logger.service';
import { ExtractionStrategyFactory } from '../strategies/extraction-strategy.factory';
import { ExtractionPersistenceService } from '../services/extraction-persistence.service';
import { ProcessingJobRepository } from '../repositories/processing-job.repository';
import { ExtractionErrorRepository } from '../repositories/extraction-error.repository';
import { EXTRACTION_QUEUE_NAME } from '../queues/extraction.queue';
import { ExtractionJobData, ExtractionJobResult } from '../utils/extraction.types';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import { ProcessingJobStatus } from '../entities/processing-job.entity';
import { DataSource } from 'typeorm';

const WORKER_CONCURRENCY = 3;

@Injectable()
export class ExtractionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly worker: Worker<ExtractionJobData, ExtractionJobResult>;

  constructor(
    private readonly logger: AppLoggerService,
    private readonly strategyFactory: ExtractionStrategyFactory,
    private readonly persistenceService: ExtractionPersistenceService,
    private readonly processingJobRepository: ProcessingJobRepository,
    private readonly extractionErrorRepository: ExtractionErrorRepository,
    private readonly dataSource: DataSource,
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
        this.logger.log(
          'job completed',
          'ExtractionWorker',
          { jobId: job.data.jobId, filename: job.data?.filename },
        );
      }
    });

    this.worker.on('failed', async (job, error) => {
      if (job && job.data?.jobId) {
        await this.setJobError(job.data.jobId, error.message);
        
        const jobExists = await this.processingJobRepository.findById(job.data.jobId);
        if (jobExists) {
          try {
            await this.extractionErrorRepository.create({
              processingJobId: job.data.jobId,
              errorStage: 'EXTRACTION',
              errorCode: 'JOB_FAILED',
              message: error.message,
              stackTrace: error.stack || undefined,
              recoverable: job.opts?.attempts ? job.attemptsMade < (job.opts.attempts as number) : false,
            });
          } catch (err) {
            this.logger.warn('Failed to create extraction error', 'ExtractionWorker', { error: (err as Error).message });
          }
        }
        
        this.logger.error(
          'job failed',
          error.stack,
          'ExtractionWorker',
          {
            jobId: job.data.jobId,
            filename: job.data?.filename,
            error: error.message,
          },
        );
      }
    });
  }

  private async markJobCompleted(jobId: string): Promise<void> {
    await this.processingJobRepository.markCompleted(jobId);
  }

  private async setJobError(jobId: string, errorMessage: string): Promise<void> {
    await this.processingJobRepository.setError(jobId, errorMessage);
  }

  private async processJob(
    job: Job<ExtractionJobData, ExtractionJobResult>,
  ): Promise<ExtractionJobResult> {
    const { jobId, filename, buffer, fileType } = job.data;

    const bufferData = typeof buffer === 'string' ? Buffer.from(buffer, 'base64') : buffer;

    this.logger.log(
      'processing job',
      'ExtractionWorker',
      {
        jobId,
        filename,
        fileType,
        attempt: job.attemptsMade,
      },
    );

    await this.processingJobRepository.updateStatus(jobId, ProcessingJobStatus.RUNNING);

    try {
      const strategy = this.strategyFactory.getStrategy(fileType);

      if (!strategy) {
        throw new ApplicationError(ErrorCode.UnsupportedFileType, undefined, {
          filename,
          fileType,
        });
      }

      this.logger.log('extracting with strategy', 'ExtractionWorker', { fileType, strategy: strategy.constructor.name });

      const result = await strategy.extract(bufferData, filename);

      this.logger.log('extraction completed', 'ExtractionWorker', {
        jobId,
        recordCount: result.records?.length || 0,
        metadata: result.metadata,
      });

      const processingJob = await this.processingJobRepository.findById(jobId);

      let documentId = processingJob?.documentId;

      if (!documentId) {
        this.logger.warn('No document associated with job, creating one', 'ExtractionWorker', { jobId });
        
        const doc = await this.dataSource.query(
          `INSERT INTO documents (id, original_file_name, storage_key, ingestion_status, created_at)
           VALUES (gen_random_uuid(), $1, $2, 'processing', now())
           RETURNING id`,
          [filename, `uploads/${Date.now()}-${filename}`],
        );
        
        documentId = doc[0]?.id;
        
        if (documentId) {
          await this.dataSource.query(
            `UPDATE processing_jobs SET document_id = $1 WHERE id = $2`,
            [documentId, jobId],
          );
        } else {
          throw new ApplicationError(ErrorCode.PersistenceFailed, undefined, {
            jobId,
            reason: 'Failed to create document',
          });
        }
      }

      const candidates = this.mapToAssetCandidates(result.records, documentId);

      if (candidates.length > 0) {
        const persistenceResult = await this.persistenceService.persistBatch(
          documentId,
          jobId,
          candidates,
          100,
        );

        this.logger.log(
          'batch persistence completed',
          'ExtractionWorker',
          {
            jobId,
            savedAssets: persistenceResult.savedAssets,
            savedFields: persistenceResult.savedFields,
            errors: persistenceResult.errors.length,
          },
        );

        for (const error of persistenceResult.errors) {
          await this.persistenceService.logError(
            jobId,
            'VALIDATION',
            'XLSX_ROW_INVALID',
            error.reason,
            error.rowIndex,
          );
        }
      }

      return {
        jobId,
        status: 'completed',
        filename,
        fileType,
      };
    } catch (error) {
      this.logger.error(
        'extraction error',
        error instanceof Error ? error.stack : undefined,
        'ExtractionWorker',
        {
          jobId,
          filename,
          error: error instanceof Error ? error.message : String(error),
          cause: error instanceof ApplicationError ? (error as any).details : undefined,
        },
      );

      const isRetryable =
        error instanceof Error &&
        !(
          error instanceof ApplicationError &&
          (error.code === ErrorCode.ValidationFailed ||
            error.code === ErrorCode.UnsupportedFileType)
        );

      if (!isRetryable) {
        await this.processingJobRepository.setError(jobId, (error as Error).message);
      }

      throw error;
    }
  }

  private mapToAssetCandidates(
    records: Record<string, unknown>[],
    documentId: string,
    sourceSheetName?: string,
  ): import('../utils/csv-stream.types').ExtractedAssetCandidate[] {
    const metaFields = ['sheetName', 'sourceSheetName', 'sourceRowIndex', 'overallConfidence', 'rawAssetName'];
    
    return records.map((record, index) => {
      const fields = Object.entries(record)
        .filter(([key]) => !metaFields.includes(key))
        .map(([key, value]) => ({
          fieldName: key,
          rawValue: value !== undefined ? (typeof value === 'object' ? JSON.stringify(value) : String(value)) : null,
          normalizedValue: value,
          confidenceScore: 0.8,
          sourceColumn: key,
        }));
      
      return {
        rawAssetName: String(record['asset_name'] || record['name'] || record['Asset Name'] || record['asset'] || `asset_${index + 1}`),
        fields,
        sourceRowIndex: index + 1,
        sourceSheetName: sourceSheetName || record['sheetName'] as string || undefined,
        overallConfidence: 0.8,
      };
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
    this.logger.log(
      'extraction worker started',
      'ExtractionWorker',
      { concurrency: WORKER_CONCURRENCY },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
  }
}
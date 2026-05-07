import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { AppLoggerService } from '../core/app-logger.service';
import { ExtractionStrategyFactory } from '../strategies/extraction-strategy.factory';
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
        await this.dataSource.query(
          `INSERT INTO extraction_errors (id, processing_job_id, error_stage, error_code, message, stack_trace, recoverable, created_at)
           VALUES (gen_random_uuid(), $1, 'EXTRACTION', 'JOB_FAILED', $2, $3, $4, now())`,
          [
            job.data.jobId,
            error.message,
            error.stack || null,
            job.opts?.attempts ? job.attemptsMade < (job.opts.attempts as number) : false,
          ],
        );
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
    await this.dataSource
      .createQueryBuilder()
      .update('processing_jobs')
      .set({ status: ProcessingJobStatus.COMPLETED, completedAt: new Date() })
      .where('id = :id', { id: jobId })
      .execute();
  }

  private async setJobError(jobId: string, errorMessage: string): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update('processing_jobs')
      .set({ status: ProcessingJobStatus.FAILED, errorSummary: errorMessage, completedAt: new Date() })
      .where('id = :id', { id: jobId })
      .execute();
  }

  private async processJob(
    job: Job<ExtractionJobData, ExtractionJobResult>,
  ): Promise<ExtractionJobResult> {
    const { jobId, filename, buffer, fileType } = job.data;

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

    await this.dataSource
      .createQueryBuilder()
      .update('processing_jobs')
      .set({ status: ProcessingJobStatus.RUNNING, startedAt: new Date() })
      .where('id = :id', { id: jobId })
      .execute();

    try {
      const strategy = this.strategyFactory.getStrategy(fileType);

      if (!strategy) {
        throw new ApplicationError(ErrorCode.UnsupportedFileType, undefined, {
          filename,
          fileType,
        });
      }

      const result = await strategy.extract(buffer, filename);

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      try {
        await queryRunner.startTransaction();

        const extractionResult = await queryRunner.query(
          `INSERT INTO "extracted_assets" (id, document_id, extraction_strategy, raw_asset_name, raw_payload, overall_confidence, review_status, created_at)
           VALUES (gen_random_uuid(), (SELECT document_id FROM processing_jobs WHERE id = $1), $2, $3, $4, $5, 'pending', now())
           RETURNING id`,
          [jobId, result.strategy || fileType, filename, JSON.stringify(result.metadata), null],
        );

        const assetId = extractionResult[0]?.id;

        if (result.records && result.records.length > 0) {
          for (const record of result.records) {
            await queryRunner.query(
              `INSERT INTO "extracted_asset_fields" (id, extracted_asset_id, field_name, raw_value, normalized_value, confidence_score, extraction_method, created_at)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'LLM_EXTRACTION', now())`,
              [assetId, 'asset_data', typeof record === 'object' ? JSON.stringify(record) : String(record), JSON.stringify(record), null],
            );
          }
        }

        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }

      return {
        jobId,
        status: 'completed',
        filename,
        fileType,
      };
    } catch (error) {
      const isRetryable =
        error instanceof Error &&
        !(
          error instanceof ApplicationError &&
          (error.code === ErrorCode.ValidationFailed ||
            error.code === ErrorCode.UnsupportedFileType)
        );

      if (!isRetryable) {
        await this.dataSource
          .createQueryBuilder()
          .update('processing_jobs')
          .set({ status: ProcessingJobStatus.FAILED, errorSummary: (error as Error).message, completedAt: new Date() })
          .where('id = :id', { id: jobId })
          .execute();
        this.logger.log(
          'non-retryable error',
          'ExtractionWorker',
          { jobId, filename, error: (error as Error).message },
        );
      }

      throw error;
    }
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
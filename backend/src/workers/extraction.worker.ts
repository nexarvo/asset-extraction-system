import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { AppLoggerService } from '../core/app-logger.service';
import { ExtractionStrategyFactory } from '../strategies/extraction-strategy.factory';
import { EXTRACTION_QUEUE_NAME } from '../queues/extraction.queue';
import { ExtractionJobData, ExtractionJobResult } from '../utils/extraction.types';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';

const WORKER_CONCURRENCY = 3;

@Injectable()
export class ExtractionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly worker: Worker<ExtractionJobData, ExtractionJobResult>;

  constructor(
    private readonly logger: AppLoggerService,
    private readonly strategyFactory: ExtractionStrategyFactory,
  ) {
    this.worker = new Worker<ExtractionJobData, ExtractionJobResult>(
      EXTRACTION_QUEUE_NAME,
      async (job: Job<ExtractionJobData, ExtractionJobResult>) => {
        return this.processJob(job);
      },
      this.getWorkerOptions(),
    );

    this.worker.on('completed', (job) => {
      if (job) {
        this.logger.log(
          'job completed',
          'ExtractionWorker',
          { jobId: job.id, filename: job.data?.filename },
        );
      }
    });

    this.worker.on('failed', (job, error) => {
      if (job) {
        this.logger.error(
          'job failed',
          error.stack,
          'ExtractionWorker',
          {
            jobId: job.id,
            filename: job.data?.filename,
            error: error.message,
          },
        );
      }
    });
  }

  private async processJob(
    job: Job<ExtractionJobData, ExtractionJobResult>,
  ): Promise<ExtractionJobResult> {
    const { filename, buffer, fileType } = job.data;

    this.logger.log(
      'processing job',
      'ExtractionWorker',
      {
        jobId: job.id,
        filename,
        fileType,
        attempt: job.attemptsMade,
      },
    );

    try {
      const strategy = this.strategyFactory.getStrategy(fileType);

      if (!strategy) {
        throw new ApplicationError(ErrorCode.UnsupportedFileType, undefined, {
          filename,
          fileType,
        });
      }

      await strategy.extract(buffer, filename);

      return {
        jobId: job.id!,
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
        this.logger.log(
          'non-retryable error',
          'ExtractionWorker',
          { jobId: job.id, filename, error: (error as Error).message },
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
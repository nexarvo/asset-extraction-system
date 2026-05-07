import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { AppLoggerService } from '../core/app-logger.service';
import { ExtractionStrategyFactory } from '../strategies/extraction-strategy.factory';
import { ExtractionJobRepository } from '../repositories/extraction-job.repository';
import { ExtractionResultRepository } from '../repositories/extraction-result.repository';
import { ExtractedRecordRepository } from '../repositories/extracted-record.repository';
import { ExtractionErrorRepository } from '../repositories/extraction-error.repository';
import { EXTRACTION_QUEUE_NAME } from '../queues/extraction.queue';
import { ExtractionJobData, ExtractionJobResult } from '../utils/extraction.types';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import { ExtractionJobStatus } from '../entities/extraction-job.entity';

const WORKER_CONCURRENCY = 3;

@Injectable()
export class ExtractionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly worker: Worker<ExtractionJobData, ExtractionJobResult>;

  constructor(
    private readonly logger: AppLoggerService,
    private readonly strategyFactory: ExtractionStrategyFactory,
    private readonly jobRepository: ExtractionJobRepository,
    private readonly resultRepository: ExtractionResultRepository,
    private readonly recordRepository: ExtractedRecordRepository,
    private readonly errorRepository: ExtractionErrorRepository,
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
        await this.jobRepository.markCompleted(job.data.jobId);
        this.logger.log(
          'job completed',
          'ExtractionWorker',
          { jobId: job.data.jobId, filename: job.data?.filename },
        );
      }
    });

    this.worker.on('failed', async (job, error) => {
      if (job && job.data?.jobId) {
        await this.jobRepository.setError(job.data.jobId, error.message);
        await this.errorRepository.create({
          jobId: job.data.jobId,
          errorCode: 'JOB_FAILED',
          message: error.message,
          stackTrace: error.stack,
        });
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

    await this.jobRepository.updateStatus(jobId, ExtractionJobStatus.ACTIVE);

    try {
      const strategy = this.strategyFactory.getStrategy(fileType);

      if (!strategy) {
        throw new ApplicationError(ErrorCode.UnsupportedFileType, undefined, {
          filename,
          fileType,
        });
      }

      const result = await strategy.extract(buffer, filename);

      const extractionResult = await this.resultRepository.create({
        jobId,
        sourceFile: filename,
        extractionStrategy: result.strategy || fileType,
        metadata: result.metadata as unknown as Record<string, unknown>,
      });

      const records = result.records.map((record) => ({
        extractionResultId: extractionResult.id,
        rawText: typeof record === 'object' ? JSON.stringify(record) : String(record ?? ''),
        structuredData: record as Record<string, unknown>,
      }));

      if (records.length > 0) {
        await this.recordRepository.createMany(records);
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
        await this.jobRepository.updateStatus(
          jobId,
          ExtractionJobStatus.FAILED,
          { errorMessage: (error as Error).message },
        );
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
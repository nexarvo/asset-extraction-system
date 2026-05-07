import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { AppLoggerService } from '../core/app-logger.service';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import {
  EXTRACTION_QUEUE_NAME,
  extractionQueueOptions,
} from '../queues/extraction.queue';
import {
  ExtractionJobData,
  QueuedJobResponse,
} from '../utils/extraction.types';
import { getFileExtension } from '../utils/file.utils';
import { ProcessingJobStatus } from '../entities/processing-job.entity';

@Injectable()
export class JobDispatcherService {
  private queue: Queue<ExtractionJobData> | null = null;

  constructor(
    private readonly logger: AppLoggerService,
    private readonly dataSource: DataSource,
  ) {}

  private getQueue(): Queue<ExtractionJobData> {
    if (!this.queue) {
      this.queue = new Queue<ExtractionJobData>(
        EXTRACTION_QUEUE_NAME,
        extractionQueueOptions,
      );
    }
    return this.queue;
  }

  async dispatchFiles(
    files: Array<{ filename: string; buffer: Buffer }>,
  ): Promise<QueuedJobResponse[]> {
    try {
      const queue = this.getQueue();
      const jobs: QueuedJobResponse[] = [];

      for (const file of files) {
        const extension = getFileExtension(file.filename);
        const fileType = extension as 'csv' | 'xlsx' | 'pdf';

        const jobId = await this.dataSource.query(
          `INSERT INTO processing_jobs (id, job_type, status, attempt_count, created_at)
           VALUES (gen_random_uuid(), 'EXTRACTION', $1, 0, now())
           RETURNING id`,
          [ProcessingJobStatus.QUEUED],
        );

        const insertedJobId = jobId[0]?.id;

        await queue.add('extract', {
          jobId: insertedJobId,
          filename: file.filename,
          buffer: file.buffer,
          fileType,
        });

        this.logger.log(
          'job dispatched',
          'JobDispatcherService',
          {
            jobId: insertedJobId,
            filename: file.filename,
            fileType,
          },
        );

        jobs.push({
          jobId: insertedJobId,
          filename: file.filename,
          status: 'waiting',
        });
      }

      return jobs;
    } catch (error) {
      this.logger.error(
        'failed to dispatch files',
        error instanceof Error ? error.stack : undefined,
        'JobDispatcherService',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );

      throw new ApplicationError(ErrorCode.QueueDispatchFailed, undefined, {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getJobStatus(jobId: string): Promise<QueuedJobResponse | null> {
    try {
      const result = await this.dataSource.query(
        `SELECT id, document_id, status FROM processing_jobs WHERE id = $1`,
        [jobId],
      );

      const job = result[0];

      if (!job) {
        return null;
      }

      return {
        jobId: job.id,
        filename: '',
        status: job.status,
      };
    } catch (error) {
      this.logger.error(
        'failed to get job status',
        error instanceof Error ? error.stack : undefined,
        'JobDispatcherService',
        {
          jobId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
    }
  }
}
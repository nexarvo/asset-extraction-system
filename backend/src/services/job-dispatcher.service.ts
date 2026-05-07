import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
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
import { getSupportedFileType, getFileExtension } from '../utils/file.utils';

@Injectable()
export class JobDispatcherService {
  private queue: Queue<ExtractionJobData> | null = null;

  constructor(private readonly logger: AppLoggerService) {}

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

        const job = await queue.add('extract', {
          jobId: '',
          filename: file.filename,
          buffer: file.buffer,
          fileType,
        });

        this.logger.log(
          'job dispatched',
          'JobDispatcherService',
          {
            jobId: job.id,
            filename: file.filename,
            fileType,
          },
        );

        jobs.push({
          jobId: job.id!,
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
      const queue = this.getQueue();
      const job = await queue.getJob(jobId);

      if (!job) {
        return null;
      }

      let status: 'waiting' | 'active' | 'completed' | 'failed' | 'retrying' = 'waiting';

      const isCompleted = await job.isCompleted();
      const isFailed = await job.isFailed();
      const isActive = await job.isActive();
      const isWaiting = await job.isWaiting();

      if (isCompleted) {
        status = 'completed';
      } else if (isFailed) {
        status = 'failed';
      } else if (isActive) {
        status = 'active';
      } else if (isWaiting) {
        status = 'waiting';
      }

      return {
        jobId: job.id!,
        filename: job.data.filename,
        status,
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
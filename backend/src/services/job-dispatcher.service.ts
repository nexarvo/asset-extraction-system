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
import { getFileExtension } from '../utils/file.utils';
import { ExtractionJobRepository } from '../repositories/extraction-job.repository';
import { ExtractionJobStatus } from '../entities/extraction-job.entity';

@Injectable()
export class JobDispatcherService {
  private queue: Queue<ExtractionJobData> | null = null;

  constructor(
    private readonly logger: AppLoggerService,
    private readonly jobRepository: ExtractionJobRepository,
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

        const dbJob = await this.jobRepository.create({
          fileName: file.filename,
          fileType,
          status: ExtractionJobStatus.WAITING,
        });

        await queue.add('extract', {
          jobId: dbJob.id,
          filename: file.filename,
          buffer: file.buffer,
          fileType,
        });

        this.logger.log(
          'job dispatched',
          'JobDispatcherService',
          {
            jobId: dbJob.id,
            filename: file.filename,
            fileType,
          },
        );

        jobs.push({
          jobId: dbJob.id,
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
      const job = await this.jobRepository.findById(jobId);

      if (!job) {
        return null;
      }

      return {
        jobId: job.id,
        filename: job.fileName,
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
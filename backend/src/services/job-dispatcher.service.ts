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
  JobStatusResponse,
  JobStatus,
} from '../utils/extraction.types';
import { getFileExtension } from '../utils/file.utils';
import { ProcessingJobRepository } from '../repositories/processing-job.repository';
import { DocumentRepository } from '../repositories/document.repository';
import {
  ProcessingJobStatus,
  ProcessingJobType,
} from '../entities/processing-job.entity';
import { DocumentIngestionStatus } from '../entities/document.entity';

@Injectable()
export class JobDispatcherService {
  private queue: Queue<ExtractionJobData> | null = null;

  constructor(
    private readonly logger: AppLoggerService,
    private readonly processingJobRepository: ProcessingJobRepository,
    private readonly documentRepository: DocumentRepository,
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

        const document = await this.documentRepository.create({
          originalFileName: file.filename,
          storageKey: `uploads/${Date.now()}-${file.filename}`,
          mimeType: this.getMimeType(fileType),
          fileSize: file.buffer.length,
          ingestionStatus: DocumentIngestionStatus.PROCESSING,
        });

        const processingJob = await this.processingJobRepository.create({
          documentId: document.id,
          jobType: ProcessingJobType.EXTRACTION,
          status: ProcessingJobStatus.QUEUED,
        });

        await queue.add('extract', {
          jobId: processingJob.id,
          filename: file.filename,
          buffer: file.buffer.toString('base64'),
          fileType,
        });

        this.logger.log('job dispatched', 'JobDispatcherService', {
          jobId: processingJob.id,
          filename: file.filename,
          fileType,
        });

        jobs.push({
          jobId: processingJob.id,
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

  async getJobStatus(jobId: string): Promise<JobStatusResponse | null> {
    try {
      const job = await this.processingJobRepository.findById(jobId);

      if (!job) {
        return null;
      }

      const progress = this.calculateProgress(job.status);
      const status = this.mapJobStatus(job.status);

      return {
        jobId: job.id,
        status,
        progress,
        error: job.errorSummary ?? undefined,
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

  private mapJobStatus(status: ProcessingJobStatus): JobStatus {
    switch (status) {
      case ProcessingJobStatus.QUEUED:
        return 'waiting';
      case ProcessingJobStatus.RUNNING:
        return 'processing';
      default:
        return status;
    }
  }

  private calculateProgress(status: ProcessingJobStatus): number {
    switch (status) {
      case ProcessingJobStatus.QUEUED:
        return 0;
      case ProcessingJobStatus.RUNNING:
        return 50;
      case ProcessingJobStatus.COMPLETED:
        return 100;
      case ProcessingJobStatus.FAILED:
      case ProcessingJobStatus.RETRYING:
        return 0;
      default:
        return 0;
    }
  }

  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
    }
  }

  private getMimeType(fileType: string): string {
    const mimeTypes: Record<string, string> = {
      csv: 'text/csv',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf',
    };
    return mimeTypes[fileType] || 'application/octet-stream';
  }
}

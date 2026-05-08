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
import { ExtractedAssetCandidate } from '../utils/csv-stream.types';
import { LLMEnrichmentService } from '../services/llmService/llm.service';
import { SchemaInferenceService } from '../services/llmService/schema-inference.service';
import { ExtractionOrchestrator } from '../helpers/extraction-orchestrator.helper';

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

    const result = await strategy.extract(bufferData, filename);

    this.logger.log('extraction completed', 'ExtractionWorker', {
      jobId,
      recordCount: result.records?.length || 0,
      metadata: result.metadata,
    });

    const candidates = this.mapToAssetCandidates(result.records, documentId);
    const validCandidates = candidates.filter(
      (c) =>
        (c.rawRowData && Object.keys(c.rawRowData).length > 0) ||
        (c.normalizedRowData && Object.keys(c.normalizedRowData).length > 0),
    );

    if (validCandidates.length > 0) {
      const orchestrator = new ExtractionOrchestrator(
        documentId,
        jobId,
        this.persistenceService,
        this.llmEnrichmentService,
        this.schemaInferenceService,
      );

      await orchestrator.processFile(validCandidates);

      this.logger.log('CSV extraction completed via orchestrator', 'ExtractionWorker', {
        jobId,
        totalCandidates: validCandidates.length,
      });
    }
  }

  private mapToAssetCandidates(
    records: Record<string, unknown>[],
    documentId: string,
    sourceSheetName?: string,
  ): import('../utils/csv-stream.types').ExtractedAssetCandidate[] {
    return records
      .map((record, index) => {
        if (record && (record as any).rawRowData) {
          return record as unknown as import('../utils/csv-stream.types').ExtractedAssetCandidate;
        }

        const metaFields = [
          'sheetName',
          'sourceSheetName',
          'sourceRowIndex',
          'overallConfidence',
          'rawAssetName',
        ];
        const rawRowData: Record<string, string | number | null> = {};
        const normalizedRowData: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(record)) {
          if (!metaFields.includes(key) && key && key.trim() !== '') {
            rawRowData[key] =
              value !== undefined
                ? typeof value === 'object'
                  ? JSON.stringify(value)
                  : String(value)
                : null;
            normalizedRowData[key] = value;
          }
        }

        return {
          rawAssetName: String(
            record['asset_name'] ||
              record['name'] ||
              record['Asset Name'] ||
              record['asset'] ||
              `asset_${index + 1}`,
          ),
          fields: [],
          sourceRowIndex: index + 1,
          sourceSheetName:
            sourceSheetName || (record['sheetName'] as string) || undefined,
          overallConfidence: 0.8,
          rawRowData:
            Object.keys(rawRowData).length > 0 ? rawRowData : undefined,
          normalizedRowData:
            Object.keys(normalizedRowData).length > 0
              ? normalizedRowData
              : undefined,
        };
      })
      .filter(
        (c) =>
          (c as any).rawRowData !== undefined ||
          (c as any).normalizedRowData !== undefined,
      );
  }

  private extractColumns(candidates: ExtractedAssetCandidate[]): string[] {
    const columnsSet = new Set<string>();
    for (const candidate of candidates) {
      const rowData = candidate.normalizedRowData || candidate.rawRowData;
      if (rowData) {
        Object.keys(rowData).forEach((col) => columnsSet.add(col));
      }
    }
    return Array.from(columnsSet);
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

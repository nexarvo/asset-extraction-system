import { Queue, Worker } from 'bullmq';
import { ExtractedAssetCandidate } from '../utils/csv-stream.types';
import { ConsoleLogger, createLogger } from './console-logger.helper';
import { ExtractionPersistenceService } from '../services/extraction-persistence.service';

export const BATCH_PERSISTENCE_QUEUE_NAME = 'batch-persistence-queue';

export interface PersistenceBatchJob {
  documentId: string;
  extractionJobId: string | null;
  candidates: ExtractedAssetCandidate[];
}

export interface QueueConfig {
  maxConcurrency: number;
  maxRetries: number;
  maxQueueSize: number;
}

const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrency: 3,
  maxRetries: 3,
  maxQueueSize: 50000,
};

export class BatchPersistenceQueue {
  private readonly logger: ConsoleLogger;
  private readonly config: QueueConfig;
  private queue: Queue<PersistenceBatchJob> | null = null;
  private worker: Worker<PersistenceBatchJob> | null = null;
  private isDraining = false;
  private pendingCount = 0;

  private metrics = {
    queued: 0,
    completed: 0,
    failed: 0,
    retried: 0,
  };

  constructor(
    private persistenceService: ExtractionPersistenceService,
    private documentId: string,
    private extractionJobId: string | null,
    config: Partial<QueueConfig> = {},
  ) {
    this.logger = createLogger('BatchPersistenceQueue');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get context() {
    return { jobId: this.extractionJobId, documentId: this.documentId };
  }

  async initialize(): Promise<void> {
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    };

    this.queue = new Queue<PersistenceBatchJob>(BATCH_PERSISTENCE_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: this.config.maxRetries,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    });

    this.worker = new Worker<PersistenceBatchJob>(
      BATCH_PERSISTENCE_QUEUE_NAME,
      async (job) => {
        const ctx = { ...this.context, batchId: job.id };
        
        this.logger.info(`Persistence batch started`, {
          ...ctx,
          rowCount: job.data.candidates.length,
          attempt: job.attemptsMade + 1,
        });

        await this.persistenceService.persistBatchWithTransaction(
          job.data.documentId,
          job.data.extractionJobId,
          job.data.candidates,
        );

        this.metrics.completed++;
        this.pendingCount = Math.max(0, this.pendingCount - 1);
        this.logger.info(`Persistence batch completed`, {
          ...ctx,
          rowCount: job.data.candidates.length,
        });
      },
      {
        connection,
        concurrency: this.config.maxConcurrency,
      },
    );

    this.worker.on('failed', (job, error) => {
      if (job) {
        this.metrics.failed++;
        this.pendingCount = Math.max(0, this.pendingCount - 1);
        this.logger.error(`Persistence batch failed`, {
          ...this.context,
          batchId: job.id,
          rowCount: job.data.candidates.length,
          attempts: job.attemptsMade,
          error: error.message,
        });
      }
    });

    this.logger.info(`Batch persistence queue initialized`, {
      ...this.context,
      maxConcurrency: this.config.maxConcurrency,
      maxQueueSize: this.config.maxQueueSize,
    });
  }

  async enqueue(candidates: ExtractedAssetCandidate[]): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue not initialized. Call initialize() first.');
    }

    if (candidates.length === 0) return;

    if (this.pendingCount >= this.config.maxQueueSize) {
      this.logger.warn(`Backpressure: queue full, waiting for drain`, {
        ...this.context,
        pendingCount: this.pendingCount,
        maxQueueSize: this.config.maxQueueSize,
      });

      await this.waitForDrain();
    }

    await this.queue.add('persist', {
      documentId: this.documentId,
      extractionJobId: this.extractionJobId,
      candidates,
    });

    this.pendingCount++;
    this.metrics.queued++;

    this.logger.info(`Persistence batch queued`, {
      ...this.context,
      rowCount: candidates.length,
      pendingCount: this.pendingCount,
    });
  }

  private async waitForDrain(): Promise<void> {
    const maxWaitMs = 60000;
    const startTime = Date.now();

    while (this.pendingCount >= this.config.maxQueueSize * 0.8) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (Date.now() - startTime > maxWaitMs) {
        this.logger.warn(`Backpressure wait timeout, proceeding anyway`, {
          ...this.context,
          pendingCount: this.pendingCount,
        });
        break;
      }
    }
  }

  async drain(): Promise<void> {
    if (!this.queue) return;

    this.isDraining = true;

    this.logger.info(`Starting queue drain`, {
      ...this.context,
      pendingCount: this.pendingCount,
    });

    await this.queue.drain();

    await this.waitForCompletion();

    await this.queue.close();

    if (this.worker) {
      await this.worker.close();
    }

    this.logger.info(`Queue drain completed`, {
      ...this.context,
      metrics: this.getMetrics(),
    });

    this.isDraining = false;
  }

  private async waitForCompletion(): Promise<void> {
    const maxWaitMs = 30000;
    const startTime = Date.now();

    while (this.pendingCount > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (Date.now() - startTime > maxWaitMs) {
        this.logger.error(`Queue drain timeout, some jobs may be incomplete`, {
          ...this.context,
          pendingCount: this.pendingCount,
        });
        break;
      }
    }

    this.pendingCount = 0;
  }

  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    metrics: { queued: number; completed: number; failed: number; retried: number };
  }> {
    if (!this.queue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, metrics: this.metrics };
    }

    const counts = await this.queue.getJobCounts('wait', 'active', 'completed', 'failed');
    return {
      waiting: counts.wait || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      metrics: { ...this.metrics },
    };
  }

  getMetrics() {
    return { ...this.metrics };
  }

  onJobComplete(): void {
    this.pendingCount = Math.max(0, this.pendingCount - 1);
  }
}
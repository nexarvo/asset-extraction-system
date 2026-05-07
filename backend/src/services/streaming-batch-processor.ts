import { Injectable } from '@nestjs/common';
import { ExtractedAssetCandidate, BatchPersistenceResult } from '../utils/csv-stream.types';
import { ExtractionPersistenceService } from './extraction-persistence.service';
import { AppLoggerService } from '../core/app-logger.service';

export interface StreamingBatchProcessorConfig {
  batchSize: number;
  documentId: string;
  extractionJobId: string | null;
}

@Injectable()
export class StreamingBatchProcessor {
  private batch: ExtractedAssetCandidate[] = [];
  private config: StreamingBatchProcessorConfig;
  private paused = false;
  private resolvePause: (() => void) | null = null;
  private totalPersisted = 0;
  private errors: { rowIndex: number; reason: string }[] = [];

  constructor(
    private readonly persistenceService: ExtractionPersistenceService,
    private readonly logger: AppLoggerService,
  ) {
    this.config = {
      batchSize: 500,
      documentId: '',
      extractionJobId: null,
    };
  }

  configure(config: StreamingBatchProcessorConfig): void {
    this.config = config;
  }

  async addCandidate(candidate: ExtractedAssetCandidate): Promise<boolean> {
    if (this.paused) {
      await new Promise<void>((resolve) => {
        this.resolvePause = resolve;
      });
    }

    this.batch.push(candidate);

    if (this.shouldFlush()) {
      await this.flush();
      return true;
    }

    return false;
  }

  shouldFlush(): boolean {
    return this.batch.length >= this.config.batchSize;
  }

  async flush(): Promise<BatchPersistenceResult> {
    if (this.batch.length === 0) {
      return { savedAssets: 0, savedFields: 0, errors: [] };
    }

    this.pause();

    this.logger.log('flushing batch', 'StreamingBatchProcessor', {
      batchSize: this.batch.length,
      documentId: this.config.documentId,
    });

    const result = await this.persistenceService.persistBatchWithTransaction(
      this.config.documentId,
      this.config.extractionJobId,
      this.batch,
    );

    this.totalPersisted += result.savedFields;
    this.errors.push(...result.errors);

    this.logger.log('batch flushed', 'StreamingBatchProcessor', {
      savedFields: result.savedFields,
      totalPersisted: this.totalPersisted,
      errors: result.errors.length,
    });

    this.clear();
    this.resume();

    return result;
  }

  async flushRemaining(): Promise<BatchPersistenceResult> {
    if (this.batch.length === 0) {
      return { savedAssets: 0, savedFields: 0, errors: [] };
    }

    this.logger.log('flushing remaining batch', 'StreamingBatchProcessor', {
      remaining: this.batch.length,
    });

    const result = await this.persistenceService.persistBatchWithTransaction(
      this.config.documentId,
      this.config.extractionJobId,
      this.batch,
    );

    this.totalPersisted += result.savedFields;
    this.errors.push(...result.errors);

    this.clear();

    return result;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    if (this.resolvePause) {
      this.resolvePause();
      this.resolvePause = null;
    }
  }

  clear(): void {
    this.batch = [];
  }

  size(): number {
    return this.batch.length;
  }

  getTotalPersisted(): number {
    return this.totalPersisted;
  }

  getErrors(): { rowIndex: number; reason: string }[] {
    return this.errors;
  }

  isPaused(): boolean {
    return this.paused;
  }
}
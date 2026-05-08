import { Injectable, OnModuleInit } from '@nestjs/common';
import { ExtractedAssetCandidate } from '../utils/csv-stream.types';

export interface ExtractionContext {
  documentId: string;
  extractionJobId: string | null;
  fileId: string;
  sheetName?: string;
}

export interface ExtractionCheckpoint {
  fileId: string;
  sheetName?: string;
  lastProcessedRow: number;
  totalPersisted: number;
}

export interface BatchFlushResult {
  candidates: ExtractedAssetCandidate[];
  checkpoint: ExtractionCheckpoint;
}

@Injectable()
export class BatchExtractionAccumulator implements OnModuleInit {
  private batch: ExtractedAssetCandidate[] = [];
  private context: ExtractionContext | null = null;
  private lastCheckpoint: ExtractionCheckpoint | null = null;

  private batchSize: number = 500;
  private flushCallback: ((result: BatchFlushResult) => Promise<void>) | null =
    null;

  onModuleInit() {}

  configure(batchSize: number): void {
    this.batchSize = batchSize;
  }

  setFlushCallback(
    callback: (result: BatchFlushResult) => Promise<void>,
  ): void {
    this.flushCallback = callback;
  }

  setContext(context: ExtractionContext): void {
    this.context = context;
  }

  async add(candidate: ExtractedAssetCandidate): Promise<boolean> {
    this.batch.push(candidate);

    if (this.shouldFlush()) {
      await this.flush();
      return true;
    }

    return false;
  }

  shouldFlush(): boolean {
    return this.batch.length >= this.batchSize;
  }

  async flush(): Promise<void> {
    if (this.batch.length === 0 || !this.context) {
      return;
    }

    const candidates = [...this.batch];
    const checkpoint: ExtractionCheckpoint = {
      fileId: this.context.fileId,
      sheetName: this.context.sheetName,
      lastProcessedRow: candidates.reduce(
        (max, c) => Math.max(max, c.sourceRowIndex),
        0,
      ),
      totalPersisted: candidates.length,
    };

    if (this.flushCallback) {
      await this.flushCallback({ candidates, checkpoint });
    }

    this.lastCheckpoint = checkpoint;
    this.clear();
  }

  async flushRemaining(): Promise<void> {
    if (this.batch.length > 0) {
      await this.flush();
    }
  }

  clear(): void {
    this.batch = [];
  }

  size(): number {
    return this.batch.length;
  }

  getLastCheckpoint(): ExtractionCheckpoint | null {
    return this.lastCheckpoint;
  }

  getContext(): ExtractionContext | null {
    return this.context;
  }
}

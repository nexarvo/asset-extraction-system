import { Injectable } from '@nestjs/common';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import { ExtractionRecordModel } from '../models/extraction.model';
import { ExtractionResult, StoredExtraction } from '../utils/extraction.types';

@Injectable()
export class ExtractionRepository {
  private readonly records = new Map<string, StoredExtraction>();

  async save(result: ExtractionResult): Promise<StoredExtraction> {
    try {
      const record = new ExtractionRecordModel(this.createId(), result);
      this.records.set(record.id, record);
      return record;
    } catch (error) {
      throw new ApplicationError(ErrorCode.PersistenceFailed, undefined, {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async findById(id: string): Promise<StoredExtraction | undefined> {
    return this.records.get(id);
  }

  async findAll(): Promise<StoredExtraction[]> {
    return [...this.records.values()];
  }

  private createId(): string {
    return `ext_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

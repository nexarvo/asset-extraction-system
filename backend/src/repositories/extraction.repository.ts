import { Injectable } from '@nestjs/common';
import { ExtractionResult, StoredExtraction } from '../utils/extraction.types';

@Injectable()
export class ExtractionRepository {
  private readonly records: Map<string, StoredExtraction> = new Map();

  async save(result: ExtractionResult): Promise<StoredExtraction> {
    const id = `ext_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const record: StoredExtraction = { id, result, createdAt: new Date().toISOString() };
    this.records.set(id, record);
    return record;
  }

  async findById(id: string): Promise<StoredExtraction | undefined> {
    return this.records.get(id);
  }

  async findAll(): Promise<StoredExtraction[]> {
    return Array.from(this.records.values());
  }
}
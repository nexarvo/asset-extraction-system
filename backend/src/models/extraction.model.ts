import { ExtractionResult, StoredExtraction } from '../utils/extraction.types';

export class ExtractionRecordModel implements StoredExtraction {
  readonly id: string;
  readonly result: ExtractionResult;
  readonly createdAt: string;

  constructor(id: string, result: ExtractionResult) {
    this.id = id;
    this.result = result;
    this.createdAt = new Date().toISOString();
  }
}

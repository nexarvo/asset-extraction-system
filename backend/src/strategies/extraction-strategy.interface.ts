import { ExtractionResult } from '../utils/extraction.types';

export interface IExtractionStrategy {
  canHandle(fileType: string): boolean;
  extract(buffer: Buffer, filename: string): Promise<ExtractionResult>;
}

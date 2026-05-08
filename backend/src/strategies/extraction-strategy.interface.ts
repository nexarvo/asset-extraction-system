import { ExtractionResult } from '../utils/extraction.types';
import { ExtractionPersistenceService } from '../services/extraction-persistence.service';
import { LLMEnrichmentService } from '../services/llmService/llm.service';
import { SchemaInferenceService } from '../services/llmService/schema-inference.service';

export interface ExtractionContext {
  documentId: string;
  extractionJobId: string | null;
  persistenceService: ExtractionPersistenceService;
  llmEnrichmentService: LLMEnrichmentService;
  schemaInferenceService: SchemaInferenceService;
}

export interface IExtractionStrategy {
  canHandle(fileType: string): boolean;
  extract(
    buffer: Buffer,
    filename: string,
    context: ExtractionContext,
  ): Promise<ExtractionResult>;
}

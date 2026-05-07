export interface RawCsvRow {
  rowIndex: number;
  headers: string[];
  values: string[];
  raw: Record<string, string>;
}

export interface ParsedCsvRow {
  rowIndex: number;
  data: Record<string, string | null>;
}

export interface ExtractedFieldCandidate {
  fieldName: string;
  rawValue: string | null;
  normalizedValue?: unknown;
  confidenceScore?: number;
  sourceColumn?: string;
}

export interface ExtractedAssetCandidate {
  rawAssetName?: string;
  fields: ExtractedFieldCandidate[];
  sourceRowIndex: number;
  overallConfidence?: number;
}

export interface CsvRowError {
  rowIndex: number;
  reason: string;
  rawData?: Record<string, unknown>;
}

export interface CsvValidationResult {
  isValid: boolean;
  errors: CsvRowError[];
}

export interface HeaderNormalizationResult {
  normalizedHeaders: string[];
  duplicateHeaders: string[];
}

export interface BatchPersistenceResult {
  savedAssets: number;
  savedFields: number;
  errors: CsvRowError[];
}
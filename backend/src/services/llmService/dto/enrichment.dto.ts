export interface RowEnrichmentInput {
  rowData: Record<string, unknown>;
  sourceRowIndex: number;
  sourceSheetName?: string;
  existingSchema?: InferredSchema;
}

export interface RowEnrichmentOutput {
  normalizedAssetName?: string;
  currency?: string;
  assetType?: string;
  jurisdiction?: string;
  latitude?: number;
  longitude?: number;
  confidenceSignals: ConfidenceSignals;
  explanation: string;
  needsReview: boolean;
}

export interface ConfidenceSignals {
  currencyInferred?: boolean;
  exactValueMatch?: boolean;
  assetTypeInferred?: boolean;
  jurisdictionInferred?: boolean;
  coordinatesInferred?: boolean;
  fieldMissing?: boolean;
}

export type SemanticRole =
  | 'asset_identifier'
  | 'asset_name'
  | 'value'
  | 'currency'
  | 'jurisdiction'
  | 'latitude'
  | 'longitude'
  | 'temporal_field'
  | 'metadata'
  | 'irrelevant'
  | 'unknown';

export interface ColumnAnalysis {
  name: string;
  detectedType: 'string' | 'number' | 'boolean' | 'date' | 'empty';
  sampleValues: (string | number | boolean | null)[];
  semanticRole: SemanticRole;
  confidence: number;
  reasoning: string;
  alternatives: string[];
}

export interface FieldMappingEntry {
  column: string | null;
  confidence: number;
  alternatives: string[];
}

export interface UnmappedColumn {
  name: string;
  reason: string;
}

export interface SchemaQuality {
  completeness: number;
  ambiguityScore: number;
  deterministicCoverage: number;
  needsReview: boolean;
}

export interface InferredSchemaV2 {
  columns: ColumnAnalysis[];
  fieldMapping: {
    assetNameColumn?: FieldMappingEntry;
    valueColumn?: FieldMappingEntry;
    currencyColumn?: FieldMappingEntry;
    jurisdictionColumn?: FieldMappingEntry;
    latitudeColumn?: FieldMappingEntry;
    longitudeColumn?: FieldMappingEntry;
    assetTypeColumn?: FieldMappingEntry;
  };
  unmappedColumns: UnmappedColumn[];
  schemaQuality: SchemaQuality;
  inferenceNotes: string[];
}

export interface InferredSchema {
  assetNameColumn?: string;
  valueColumn?: string;
  currencyColumn?: string;
  jurisdictionColumn?: string;
  latitudeColumn?: string;
  longitudeColumn?: string;
  assetTypeColumn?: string;
}

export interface BatchEnrichmentInput {
  rows: RowEnrichmentInput[];
  schema: InferredSchema;
}

export interface BatchEnrichmentOutput {
  enrichedRows: RowEnrichmentOutput[];
  errors: EnrichmentError[];
}

export interface EnrichmentError {
  rowIndex: number;
  reason: string;
}

export interface EnrichmentMetadata {
  extractionModel: string;
  extractionStrategy: string;
  inferenceExplanation?: string;
}

export interface ConfidenceScoreResult {
  fieldConfidence: Record<string, number>;
  overallConfidence: number;
  confidenceExplanation: string;
  confidenceFactors: ConfidenceFactor[];
}

export interface ConfidenceFactor {
  factor: string;
  score: number;
  reason: string;
}

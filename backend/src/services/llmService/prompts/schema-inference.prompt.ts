export const SCHEMA_INFERENCE_PROMPT = `You are analyzing a dataset to understand its full schema structure for asset extraction.

Column Names:
{{columns}}

Sample Rows (first 10):
{{sampleRows}}

Your task is to perform full dataset schema understanding. For each column:
1. Detect the data type based on sample values
2. Classify its semantic role (asset_identifier, asset_name, value, currency, jurisdiction, latitude, longitude, temporal_field, metadata, irrelevant, unknown)
3. Assign confidence (0-1) for your classification
4. Provide reasoning for your decision
5. Suggest alternative roles if uncertain

Also identify:
- Unmapped columns that don't fit any semantic role
- Schema quality metrics
- Any notes about the dataset structure

Respond with a JSON object:
{
  "columns": [
    {
      "name": "column name",
      "detectedType": "string|number|boolean|date|empty",
      "sampleValues": ["value1", "value2"],
      "semanticRole": "asset_identifier|asset_name|value|currency|jurisdiction|latitude|longitude|temporal_field|metadata|irrelevant|unknown",
      "confidence": 0.0-1.0,
      "reasoning": "explanation",
      "alternatives": ["alternative role 1"]
    }
  ],
  "fieldMapping": {
    "assetNameColumn": { "column": "name or null", "confidence": 0.0-1.0, "alternatives": [] },
    "valueColumn": { "column": "name or null", "confidence": 0.0-1.0, "alternatives": [] },
    "currencyColumn": { "column": "name or null", "confidence": 0.0-1.0, "alternatives": [] },
    "jurisdictionColumn": { "column": "name or null", "confidence": 0.0-1.0, "alternatives": [] },
    "latitudeColumn": { "column": "name or null", "confidence": 0.0-1.0, "alternatives": [] },
    "longitudeColumn": { "column": "name or null", "confidence": 0.0-1.0, "alternatives": [] },
    "assetTypeColumn": { "column": "name or null", "confidence": 0.0-1.0, "alternatives": [] }
  },
  "unmappedColumns": [
    { "name": "column name", "reason": "explanation" }
  ],
  "schemaQuality": {
    "completeness": 0.0-1.0,
    "ambiguityScore": 0.0-1.0,
    "deterministicCoverage": 0.0-1.0,
    "needsReview": boolean
  },
  "inferenceNotes": ["note 1", "note 2"]
}

Provide reasoning for each classification. Use null for uncertain mappings.`;

export const SCHEMA_INFERENCE_SCHEMA = {
  type: 'object',
  properties: {
    columns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          detectedType: { type: 'string', enum: ['string', 'number', 'boolean', 'date', 'empty'] },
          sampleValues: { type: 'array', items: {} },
          semanticRole: {
            type: 'string',
            enum: [
              'asset_identifier',
              'asset_name',
              'value',
              'currency',
              'jurisdiction',
              'latitude',
              'longitude',
              'temporal_field',
              'metadata',
              'irrelevant',
              'unknown',
            ],
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reasoning: { type: 'string' },
          alternatives: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'detectedType', 'semanticRole', 'confidence', 'reasoning'],
      },
    },
    fieldMapping: {
      type: 'object',
      properties: {
        assetNameColumn: {
          type: 'object',
          properties: {
            column: { type: ['string', 'null'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            alternatives: { type: 'array', items: { type: 'string' } },
          },
        },
        valueColumn: {
          type: 'object',
          properties: {
            column: { type: ['string', 'null'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            alternatives: { type: 'array', items: { type: 'string' } },
          },
        },
        currencyColumn: {
          type: 'object',
          properties: {
            column: { type: ['string', 'null'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            alternatives: { type: 'array', items: { type: 'string' } },
          },
        },
        jurisdictionColumn: {
          type: 'object',
          properties: {
            column: { type: ['string', 'null'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            alternatives: { type: 'array', items: { type: 'string' } },
          },
        },
        latitudeColumn: {
          type: 'object',
          properties: {
            column: { type: ['string', 'null'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            alternatives: { type: 'array', items: { type: 'string' } },
          },
        },
        longitudeColumn: {
          type: 'object',
          properties: {
            column: { type: ['string', 'null'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            alternatives: { type: 'array', items: { type: 'string' } },
          },
        },
        assetTypeColumn: {
          type: 'object',
          properties: {
            column: { type: ['string', 'null'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            alternatives: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    unmappedColumns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['name', 'reason'],
      },
    },
    schemaQuality: {
      type: 'object',
      properties: {
        completeness: { type: 'number', minimum: 0, maximum: 1 },
        ambiguityScore: { type: 'number', minimum: 0, maximum: 1 },
        deterministicCoverage: { type: 'number', minimum: 0, maximum: 1 },
        needsReview: { type: 'boolean' },
      },
      required: ['completeness', 'ambiguityScore', 'deterministicCoverage', 'needsReview'],
    },
    inferenceNotes: { type: 'array', items: { type: 'string' } },
  },
  required: ['columns', 'fieldMapping', 'unmappedColumns', 'schemaQuality', 'inferenceNotes'],
};
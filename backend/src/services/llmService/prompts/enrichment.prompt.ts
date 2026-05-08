export const ROW_ENRICHMENT_PROMPT = `You are an asset data enrichment assistant. Given a row of extracted asset data, your task is to:
1. Normalize and enrich the data
2. Infer missing fields where possible
3. Generate explanations for inferences
4. Identify if human review is needed

Inferred Schema:
{{schema}}

Row Data:
{{rowData}}

For each row, respond with a JSON object:
{
  "normalizedAssetName": "normalized name or null",
  "currency": "3-letter currency code or null",
  "assetType": "asset type or null",
  "jurisdiction": "jurisdiction or null",
  "latitude": number or null,
  "longitude": number or null,
  "confidenceSignals": {
    "currencyInferred": boolean,
    "exactValueMatch": boolean,
    "assetTypeInferred": boolean,
    "jurisdictionInferred": boolean,
    "coordinatesInferred": boolean,
    "fieldMissing": boolean
  },
  "explanation": "explanation of what was inferred and why",
  "needsReview": boolean
}

Set needsReview to true if:
- Currency cannot be reasonably inferred
- Multiple conflicting values exist
- Data quality is poor
- Coordinates are invalid

Use null for fields that cannot be determined.`;

export const ROW_ENRICHMENT_SCHEMA = {
  type: 'object',
  properties: {
    normalizedAssetName: { type: 'string', nullable: true },
    currency: { type: 'string', nullable: true },
    assetType: { type: 'string', nullable: true },
    jurisdiction: { type: 'string', nullable: true },
    latitude: { type: 'number', nullable: true },
    longitude: { type: 'number', nullable: true },
    confidenceSignals: {
      type: 'object',
      properties: {
        currencyInferred: { type: 'boolean' },
        exactValueMatch: { type: 'boolean' },
        assetTypeInferred: { type: 'boolean' },
        jurisdictionInferred: { type: 'boolean' },
        coordinatesInferred: { type: 'boolean' },
        fieldMissing: { type: 'boolean' },
      },
      required: [],
    },
    explanation: { type: 'string' },
    needsReview: { type: 'boolean' },
  },
  required: ['confidenceSignals', 'explanation', 'needsReview'],
};

export const BATCH_ENRICHMENT_PROMPT = `You are an asset data enrichment assistant. Given multiple rows of extracted asset data, your task is to:
1. Normalize and enrich each row
2. Infer missing fields where possible
3. Generate explanations for inferences
4. Identify if human review is needed

Inferred Schema:
{{schema}}

Rows Data (JSON array):
{{rowsData}}

For each row, respond with a JSON array of objects:
[
  {
    "normalizedAssetName": "normalized name or null",
    "currency": "3-letter currency code or null",
    "assetType": "asset type or null",
    "jurisdiction": "jurisdiction or null",
    "latitude": number or null,
    "longitude": number or null,
    "confidenceSignals": {
      "currencyInferred": boolean,
      "exactValueMatch": boolean,
      "assetTypeInferred": boolean,
      "jurisdictionInferred": boolean,
      "coordinatesInferred": boolean,
      "fieldMissing": boolean
    },
    "explanation": "explanation of what was inferred and why",
    "needsReview": boolean
  }
]

Set needsReview to true if:
- Currency cannot be reasonably inferred
- Multiple conflicting values exist
- Data quality is poor
- Coordinates are invalid

Use null for fields that cannot be determined.`;

export const BATCH_ENRICHMENT_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      normalizedAssetName: { type: 'string', nullable: true },
      currency: { type: 'string', nullable: true },
      assetType: { type: 'string', nullable: true },
      jurisdiction: { type: 'string', nullable: true },
      latitude: { type: 'number', nullable: true },
      longitude: { type: 'number', nullable: true },
      confidenceSignals: {
        type: 'object',
        properties: {
          currencyInferred: { type: 'boolean' },
          exactValueMatch: { type: 'boolean' },
          assetTypeInferred: { type: 'boolean' },
          jurisdictionInferred: { type: 'boolean' },
          coordinatesInferred: { type: 'boolean' },
          fieldMissing: { type: 'boolean' },
        },
        required: [],
      },
      explanation: { type: 'string' },
      needsReview: { type: 'boolean' },
    },
    required: ['confidenceSignals', 'explanation', 'needsReview'],
  },
};

export const SCHEMA_INFERENCE_PROMPT = `Analyze the following column names and sample data to identify the schema for asset extraction.

Column Names:
{{columns}}

Sample Rows (first 5):
{{sampleRows}}

Respond with a JSON object identifying which columns correspond to:
{
  "assetNameColumn": "column name or null",
  "valueColumn": "column name or null", 
  "currencyColumn": "column name or null",
  "jurisdictionColumn": "column name or null",
  "latitudeColumn": "column name or null",
  "longitudeColumn": "column name or null"
}

Only identify columns that clearly match these patterns. Use null for uncertain mappings.`;

export const SCHEMA_INFERENCE_SCHEMA = {
  type: 'object',
  properties: {
    assetNameColumn: { type: 'string', nullable: true },
    valueColumn: { type: 'string', nullable: true },
    currencyColumn: { type: 'string', nullable: true },
    jurisdictionColumn: { type: 'string', nullable: true },
    latitudeColumn: { type: 'string', nullable: true },
    longitudeColumn: { type: 'string', nullable: true },
  },
  required: [],
};

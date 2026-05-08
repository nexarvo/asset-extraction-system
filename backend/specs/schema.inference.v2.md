Schema Inference v2 (Full Dataset Understanding) - Spec

⸻

1. Goal & Context

Why

The current schema inference system only returns minimal column-to-field mappings (e.g., assetNameColumn, jurisdictionColumn). This is insufficient for production-grade ingestion because:

- it does not describe the dataset structure
- it lacks column-level understanding and reasoning
- it provides no alternatives or ambiguity signals
- downstream deterministic processing still requires manual inspection
- it breaks auditability requirements for financial-grade extraction

The system must evolve from “column selection” to “dataset schema understanding”.

⸻

Goal

Build a schema inference system that:

- fully understands CSV/XLSX structure
- analyzes all columns (not just target fields)
- provides semantic roles for each column
- outputs confidence + alternatives per mapping
- detects missing/implicit fields
- supports deterministic fallback logic
- integrates directly into existing ingestion pipeline without architectural expansion

⸻

2. Scope & Boundaries

In Scope

- [TODO] Redesign schema inference output format
- [TODO] Expand LLM schema understanding prompt
- [TODO] Add full column profiling (all columns)
- [TODO] Add semantic role classification per column
- [TODO] Add confidence scoring per column role
- [TODO] Add alternative column suggestions
- [TODO] Add schema quality scoring
- [TODO] Add unmapped column detection
- [TODO] Add ambiguity detection layer
- [TODO] Integrate with existing CSV/XLSX ingestion flow
- [TODO] Persist schema inference metadata (existing tables only)

⸻

Out of Scope

- New database tables
- Vector embeddings for schema matching
- UI changes
- Separate schema service layer
- External schema registry system
- Auto-schema evolution system

⸻

3. Constraints & Dependencies

Tech Stack

- NestJS
- TypeScript
- PostgreSQL
- Existing ingestion pipeline

⸻

Architecture Constraints

- Must NOT introduce new services
- Must NOT create new pipeline stages
- Must integrate into existing processXlsxExtraction() / processCsvExtraction()
- Must remain lightweight and deterministic-friendly
- Must preserve existing batch processing system
- LLM is only used for semantic interpretation, not deterministic logic

⸻

Dependencies

- Existing CSV/XLSX parsers
- Existing batch processing pipeline
- Existing LLM factory
- Existing extracted_asset_fields schema

⸻

4. Technical Requirements

⸻

4.1 New Schema Inference Output Contract

[REQUIRED OUTPUT STRUCTURE]

Replace current flat mapping with:

{
"columns": [
{
"name": "Location Code",
"detectedType": "string",
"sampleValues": ["LOC-001", "LOC-002"],
"semanticRole": "asset_identifier",
"confidence": 0.92,
"reasoning": "Column appears as primary identifier for asset location records",
"alternatives": ["Asset ID", "Site Code"]
}
],
"fieldMapping": {
"assetNameColumn": {
"column": "Location Code",
"confidence": 0.92,
"alternatives": ["Asset Name", "Site Name"]
},
"jurisdictionColumn": {
"column": "Region Code",
"confidence": 0.88,
"alternatives": []
}
},
"unmappedColumns": [
{
"name": "Unnamed: 4",
"reason": "No semantic signal detected"
}
],
"schemaQuality": {
"completeness": 0.82,
"ambiguityScore": 0.19,
"deterministicCoverage": 0.75,
"needsReview": false
},
"inferenceNotes": [
"No explicit currency column detected; likely embedded in value field or missing entirely"
]
}

⸻

4.2 Column Semantic Classification

Each column MUST be classified into one of:

- asset_identifier
- asset_name
- value
- currency
- jurisdiction
- latitude
- longitude
- temporal_field
- metadata
- irrelevant
- unknown

⸻

Requirements

- [TODO] Classify ALL columns (not just target fields)
- [TODO] Assign confidence per column
- [TODO] Provide reasoning per classification
- [TODO] Provide alternatives if uncertain

⸻

4.3 Deterministic Pre-Processing Layer

Before calling LLM:

- [TODO] detect empty columns
- [TODO] detect numeric vs string columns
- [TODO] detect coordinate-like patterns
- [TODO] detect currency symbols
- [TODO] detect header anomalies (Unnamed columns)

This reduces LLM dependency.

⸻

4.4 LLM Prompt Redesign

[TODO]

LLM must be instructed to:

- analyze full dataset schema
- not just map fields
- reason per column
- explain uncertainty
- output structured JSON only

⸻

REQUIRED PROMPT BEHAVIOR

LLM must:

- treat input as full dataset schema problem
- NOT as column classification only
- include reasoning per column
- include confidence per decision
- include alternatives

⸻

4.5 Schema Quality Scoring

[TODO]

Compute:

- completeness score
- ambiguity score
- deterministic coverage score

⸻

Definitions

- completeness: how many required fields are confidently mapped
- ambiguity: conflicting interpretations
- deterministic coverage: how many fields resolved without LLM dependency

⸻

4.6 Integration Into Existing Pipeline

[TODO]

Must integrate at:

CSV/XLSX parse
→ deterministic column profiling
→ schema inference v2 (LLM + heuristics)
→ store schema metadata
→ row processing starts

⸻

Constraints

- must NOT create new ingestion service
- must reuse processXlsxExtraction() / processCsvExtraction()
- must not break existing row batching system

⸻

4.7 Persistence Strategy

[TODO]

Store schema inference result inside existing structures:

- extracted_asset_fields (metadata columns or json fields)
- extraction_results metadata field

⸻

Requirements

- [TODO] store full schema inference JSON
- [TODO] store timestamped inference per job
- [TODO] preserve audit trail
- [TODO] avoid schema duplication per batch

⸻

4.8 Ambiguity Handling

[TODO]

If:

- multiple columns match same role
- confidence < threshold
- missing required field

Then:

- mark field as ambiguous
- pass to downstream LLM row-level inference pipeline

⸻

4.9 Deterministic Override Rules

[TODO]

Deterministic logic MUST override LLM when:

- exact header match exists
- strong regex pattern match exists (lat/lng/currency)
- column name is canonical

⸻

5. Implementation Steps

⸻

Core Refactor

- [TODO] 1. Replace current schema inference DTO
- [TODO] 2. Implement full column profiling step
- [TODO] 3. Update LLM prompt for schema v2
- [TODO] 4. Add deterministic pre-processing layer
- [TODO] 5. Implement semantic column classification
- [TODO] 6. Implement schema quality scoring

⸻

Pipeline Integration

- [TODO] 7. Integrate schema inference into CSV flow
- [TODO] 8. Integrate schema inference into XLSX flow
- [TODO] 9. Store schema metadata in existing DB structures
- [TODO] 10. Ensure row processing uses new schema contract

⸻

Cleanup

- [TODO] 11. Remove old schema inference logic
- [TODO] 12. Remove redundant DTOs related to old mapping
- [TODO] 13. Remove duplicated schema services
- [TODO] 14. Simplify ingestion pipeline dependency graph

⸻

6. Verification Criteria (Tests)

- [TODO] SCENARIO 1: Schema output includes ALL columns with semantic roles
- [TODO] SCENARIO 2: Missing value column is explicitly detected, not guessed
- [TODO] SCENARIO 3: Ambiguous columns are flagged with low confidence
- [TODO] SCENARIO 4: Deterministic matches override LLM predictions
- [TODO] SCENARIO 5: Schema quality score reflects dataset clarity
- [TODO] SCENARIO 6: XLSX and CSV produce identical schema structure
- [TODO] SCENARIO 7: No manual schema inspection is required
- [TODO] SCENARIO 8: Row pipeline correctly consumes new schema format
- [TODO] SCENARIO 9: Existing ingestion flow remains unaffected
- [TODO] SCENARIO 10: No additional DB tables required

⸻

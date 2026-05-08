LLM-Powered Extraction Enrichment & Confidence System - Spec (Updated)

1. Goal & Context

Why

The current ingestion pipeline extracts and stores structured asset fields from CSV/XLSX documents, but lacks semantic enrichment, inference, confidence reasoning, and ambiguity handling. The platform needs an AI-assisted enrichment layer that can infer missing information, normalize inconsistent values, provide explainability, and escalate uncertain cases for review.

Goal

Build an extensible LLM enrichment system integrated directly into the ingestion pipeline that:

- enriches extracted asset fields
- performs semantic inference
- generates explainability metadata
- supports multiple LLM providers
- validates outputs deterministically
- integrates with confidence scoring and review workflows
- follows existing backend architecture without unnecessary abstraction or overengineering
- integrates directly into the existing CSV/XLSX processing implementation
- persists all inferred/enriched data into existing database entities
- supports hybrid deterministic + LLM enrichment architecture

⸻

2. Scope & Boundaries

In Scope

- [DONE] Create llmService folder under existing services directory
- [DONE] Add provider-agnostic LLM abstraction using Factory Pattern
- [DONE] Support:
  - OpenAI
  - Anthropic
  - Google Gemini
  - Ollama
- [DONE] Add centralized LLM configuration under core/config
- [REVIEW] Add schema inference pipeline for CSV/XLSX
- [REVIEW] Add row enrichment pipeline
- [REVIEW] Add deterministic validation after LLM response
- [REVIEW] Add heuristic confidence scoring
- [REVIEW] Add abstention/review escalation logic
- [REVIEW] Store inference explanations and extraction metadata
- [REVIEW] Batch processing support for rows
- [REVIEW] Integrate into existing CSV/XLSX ingestion pipeline

⸻

Newly Added Scope

- [IN-PROGRESS] Integrate asset inference directly during CSV/XLSX file processing
- [IN-PROGRESS] Infer asset type during initial extraction stage
- [IN-PROGRESS] Persist inferred asset type into existing extracted fields records
- [IN-PROGRESS] Persist inference explanations into existing extracted fields records
- [IN-PROGRESS] Add in-memory ambiguous row collection mechanism
- [IN-PROGRESS] Queue ambiguous rows for batched LLM enrichment
- [IN-PROGRESS] Batch-process ambiguous rows through LLM inference pipeline
- [IN-PROGRESS] Persist post-inference confidence and enrichment results
- [IN-PROGRESS] Add row-level enrichment lifecycle tracking
- [IN-PROGRESS] Ensure deterministic extraction runs BEFORE LLM enrichment
- [IN-PROGRESS] Ensure enrichment pipeline reuses existing row-processing mechanism
- [IN-PROGRESS] Ensure ALL extracted/inferred values are persisted
- [IN-PROGRESS] Avoid introducing any new database tables
- [IN-PROGRESS] Extend existing entities only if absolutely necessary

⸻

Out of Scope

- PDF OCR implementation
- Streaming LLM responses
- Tool calling / function calling
- Embedding/vector database integration
- Multi-agent orchestration
- Fine-tuning models
- Full entity resolution engine
- Refactoring unrelated services/modules
- Rewriting existing extraction architecture

⸻

3. Constraints & Dependencies

Tech Stack

- NestJS
- TypeScript
- PostgreSQL
- Existing extraction pipeline architecture

⸻

Architecture Constraints

- Must follow current folder structure and service patterns
- Must NOT introduce unnecessary wrappers, helper classes, or abstractions
- Must NOT create speculative/future-proof infrastructure unless immediately required
- Keep implementation lean and incremental
- Reuse existing ingestion flow and services where possible
- Do not duplicate parsing logic already implemented for CSV/XLSX
- Do NOT create new database tables
- Reuse existing persistence layer
- Reuse existing row processing implementation
- In-memory batching should be lightweight and request/job scoped

⸻

Security

- API keys loaded from environment variables
- No secrets hardcoded
- LLM requests must not log sensitive payloads

⸻

Dependencies

- Existing extraction ingestion flow
- Existing extracted_asset_fields table
- Existing review queue system
- Existing validation flags system
- Existing CSV/XLSX parsers
- Existing row processing implementation

⸻

4. Technical Requirements

4.1 Folder Structure

Status

- [DONE]

Current structure:

src/
services/
llmService/
interfaces/
providers/
factory/
prompts/
dto/
llm.service.ts
core/
config/
llm.config.ts

Requirements:

- Do NOT create unnecessary files
- Do NOT introduce speculative abstractions
- Keep provider implementations minimal and consistent

⸻

4.2 Factory Pattern

Status

- [DONE]

Provider-agnostic LLM factory implemented.

Required Interface:

interface LLMProvider {
generateStructuredOutput<T>(
prompt: string,
schema?: unknown,
): Promise<T>;
}

Factory must support runtime provider switching using config.

⸻

4.3 Supported Providers

Status

- [DONE]

OpenAI Provider

Supported:

- GPT-4.1
- GPT-4o-mini

Anthropic Provider

Supported:

- Claude Sonnet

Google Provider

Supported:

- Gemini models

Ollama Provider

Supported:

- local models via Ollama HTTP API

⸻

4.4 Config System

Status

- [DONE]

Centralized config:

LLM_PROVIDER=openai
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
OLLAMA_BASE_URL=
LLM_MODEL=

Config location:

core/config/llm.config.ts

⸻

4.5 Schema Inference Pipeline

Status

- [IN-PROGRESS]

Before row enrichment:

Analyze:

- column names
- sample rows
- data patterns

Infer:

{
"asset_name_column": "",
"value_column": "",
"currency_column": "",
"jurisdiction_column": "",
"latitude_column": "",
"longitude_column": "",
"asset_type_column": ""
}

⸻

Newly Added Requirements

- [IN-PROGRESS] Run schema inference immediately after CSV/XLSX parse
- [IN-PROGRESS] Infer asset-related columns before row iteration starts
- [IN-PROGRESS] Persist schema inference metadata if supported by existing entities
- [IN-PROGRESS] Add confidence score for schema mappings
- [IN-PROGRESS] Support deterministic asset type column identification
- [IN-PROGRESS] Use LLM fallback only for unresolved mappings

⸻

Deterministic First Pass

Use heuristics before LLM:

- exact column matching
- fuzzy matching
- synonym matching

Examples:

Raw Column Canonical Field
asset asset_name
usd value value
lat latitude
lng longitude
type asset_type

⸻

LLM Fallback

Use LLM only if:

- ambiguous mappings exist
- multiple candidate columns
- no deterministic confidence

⸻

4.6 Row Enrichment Pipeline

Status

- [IN-PROGRESS]

Process rows in batches.

Recommended batch size:

- 25–100 rows

Do NOT send entire files in one request.

⸻

Newly Added Requirements

- [IN-PROGRESS] Integrate enrichment directly into existing row processing mechanism
- [IN-PROGRESS] Process rows deterministically first
- [IN-PROGRESS] Immediately persist deterministic extraction results
- [IN-PROGRESS] Detect ambiguous rows during processing
- [IN-PROGRESS] Store ambiguous rows temporarily in memory
- [IN-PROGRESS] Batch ambiguous rows for LLM enrichment
- [IN-PROGRESS] Merge deterministic and inferred values before persistence
- [IN-PROGRESS] Persist enrichment results back into existing extracted field entities
- [IN-PROGRESS] Persist enrichment explanations
- [IN-PROGRESS] Persist inference metadata
- [IN-PROGRESS] Support partial enrichment without blocking ingestion
- [IN-PROGRESS] Ensure failed enrichment does not fail entire ingestion pipeline

⸻

LLM Responsibilities

- infer missing currency
- infer asset type
- normalize jurisdictions
- normalize coordinates
- normalize asset names
- generate explanation
- identify ambiguity
- recommend review escalation
- infer missing values from contextual row information

⸻

Example Output

{
"normalized_asset_name": "ABC Solar Facility",
"currency": "USD",
"asset_type": "Energy Infrastructure",
"confidence_signals": {
"currency_inferred": true,
"exact_value_match": true
},
"explanation": "Currency inferred from US jurisdiction.",
"needs_review": false
}

⸻

Integration Requirements

Must integrate directly after CSV/XLSX extraction.

Pipeline:

CSV/XLSX Parse
→ Schema inference
→ Deterministic row extraction
→ Persist deterministic fields
→ Detect ambiguous rows
→ Queue ambiguous rows in memory
→ Batch LLM enrichment
→ Deterministic validation
→ Confidence scoring
→ Persist enrichment results
→ Create validation flags
→ Create review items if needed

⸻

4.7 Deterministic Validation Layer

Status

- [IN-PROGRESS]

ALL LLM outputs must be validated before persistence.

⸻

Newly Added Requirements

- [IN-PROGRESS] Validate inferred asset types
- [IN-PROGRESS] Validate inferred currencies against jurisdiction
- [IN-PROGRESS] Validate inferred coordinates
- [IN-PROGRESS] Validate confidence score ranges
- [IN-PROGRESS] Reject malformed enrichment payloads
- [IN-PROGRESS] Persist raw LLM response for debugging/audit if supported

⸻

Required Validations

Coordinates

latitude: -90 to 90
longitude: -180 to 180

Numeric Validation

- numeric parsing validation
- invalid decimals
- malformed values

Currency Validation

- ISO currency format validation
- unsupported currency detection

Required Fields

Validate:

- asset_name
- asset_type
- value presence if expected

Precision Validation

Detect:

- impossible precision
- excessive decimal precision
- unsupported coordinate precision

⸻

4.8 Confidence Scoring

Status

- [IN-PROGRESS]

Do NOT rely on raw LLM confidence.

Use deterministic heuristic scoring.

⸻

Newly Added Requirements

- [IN-PROGRESS] Add confidence scoring during deterministic extraction
- [IN-PROGRESS] Reduce confidence when LLM inference required
- [IN-PROGRESS] Reduce confidence on ambiguous rows
- [IN-PROGRESS] Increase confidence for exact schema matches
- [IN-PROGRESS] Add field-level confidence persistence
- [IN-PROGRESS] Add row-level confidence aggregation
- [IN-PROGRESS] Persist confidence factors for explainability
- [IN-PROGRESS] Add confidence scoring for inferred asset type

⸻

Confidence Signals

Signal Score
Exact column mapping +0.3
Deterministic parse +0.2
Deterministic currency detection +0.2
LLM inference required -0.2
Missing fields -0.3
Validation issue -0.4
Ambiguous schema mapping -0.2
Review escalation triggered -0.3

⸻

4.9 Review Escalation

Status

- [IN-PROGRESS]

If:

- confidence below threshold
- conflicting values
- validation failures
- ambiguous inference
- malformed LLM output

Then:

- create review queue entry

⸻

Newly Added Requirements

- [IN-PROGRESS] Escalate rows with unresolved asset types
- [IN-PROGRESS] Escalate rows with conflicting inferred values
- [IN-PROGRESS] Escalate rows with repeated validation failures
- [IN-PROGRESS] Escalate rows with incomplete enrichment payloads
- [IN-PROGRESS] Persist review escalation reason for every ambiguous row

⸻

4.10 Integration With Existing Pipeline

Status

- [IN-PROGRESS]

Integrate directly into current ingestion flow.

Required pipeline:

Upload
→ Parse CSV/XLSX
→ Schema inference
→ Deterministic extraction
→ Persist extracted fields
→ Detect ambiguous rows
→ Queue ambiguous rows in memory
→ Batch LLM enrichment
→ Deterministic validation
→ Confidence scoring
→ Persist enrichment results
→ Create validation flags
→ Create review items if needed

⸻

Important Constraints

- Do NOT create a separate ingestion architecture
- Reuse existing extraction services
- Reuse existing repositories/entities
- Preserve current CRUD functionality
- Do NOT create new persistence flows
- Reuse existing save/update operations
- Ensure enrichment updates existing extracted records

⸻

4.11 Database Usage

Status

- [IN-PROGRESS]

Reuse existing tables where possible:

- [DONE] extracted_asset_fields
- [DONE] validation_flags
- [DONE] review_queue

⸻

Newly Added Requirements

- [IN-PROGRESS] Store inferred asset type in existing entity
- [IN-PROGRESS] Store inference explanation in existing entity
- [IN-PROGRESS] Store confidence factors in existing entity
- [IN-PROGRESS] Store enrichment strategy/model metadata
- [IN-PROGRESS] Store deterministic vs inferred source markers
- [IN-PROGRESS] Update existing records after enrichment completion
- [IN-PROGRESS] Ensure row enrichment persistence is idempotent

⸻

Important Constraint

- [IN-PROGRESS] Do NOT create any new database tables
- [IN-PROGRESS] Extend existing entities only if absolutely necessary

⸻

4.12 Deterministic vs LLM Responsibility Separation

Status

- [IN-PROGRESS]

Deterministic Responsibilities

Use rules/code for:

- coordinate validation
- numeric parsing
- currency symbol parsing
- schema enforcement
- confidence aggregation
- validation rules
- ambiguous row detection

⸻

LLM Responsibilities

Use LLM for:

- semantic normalization
- missing field inference
- ambiguous classification
- asset type inference
- explanation generation
- contextual row understanding

⸻

Important Rule

LLM outputs must ALWAYS pass through deterministic validation before persistence.

⸻

4.13 Batch Processing

Status

- [IN-PROGRESS]

Requirements:

- process rows in chunks
- avoid token explosion
- support large CSV/XLSX files

Recommended:

- 25–100 rows per batch

⸻

Newly Added Requirements

- [IN-PROGRESS] Maintain in-memory ambiguous row queue
- [IN-PROGRESS] Flush queue when batch threshold reached
- [IN-PROGRESS] Flush remaining rows after file processing completes
- [IN-PROGRESS] Track failed batch retries
- [IN-PROGRESS] Ensure enrichment batches are isolated per job/document

⸻

Failure Handling

If one batch fails:

- do not fail entire ingestion job
- create extraction error entry
- continue remaining batches if possible

⸻

5. Implementation Steps

- [DONE] 1. Create llmService folder structure
- [DONE] 2. Add provider interface
- [DONE] 3. Implement LLM factory
- [DONE] 4. Implement OpenAI adapter
- [DONE] 5. Implement Anthropic adapter
- [DONE] 6. Implement Google Gemini adapter
- [DONE] 7. Implement Ollama adapter
- [DONE] 8. Add centralized LLM config

⸻

Remaining Work

- [REVIEW] 9. Implement schema inference service
- [REVIEW] 10. Implement deterministic schema matching heuristics
- [REVIEW] 11. Implement row batching logic
- [REVIEW] 12. Implement enrichment prompt templates
- [REVIEW] 13. Integrate enrichment into CSV pipeline
- [REVIEW] 14. Integrate enrichment into XLSX pipeline
- [REVIEW] 15. Implement deterministic validation layer
- [REVIEW] 16. Implement validation flag creation
- [REVIEW] 17. Implement heuristic confidence scoring
- [REVIEW] 18. Implement confidence aggregation
- [REVIEW] 19. Implement review escalation logic
- [REVIEW] 20. Persist enrichment metadata
- [REVIEW] 21. Persist confidence metadata
- [REVIEW] 22. Add structured logging
- [REVIEW] 23. Add malformed JSON handling

⸻

Newly Added Tasks

- [IN-PROGRESS] 24. Integrate asset type inference into CSV processing flow
- [IN-PROGRESS] 25. Integrate asset type inference into XLSX processing flow
- [IN-PROGRESS] 26. Add ambiguous row detection mechanism
- [IN-PROGRESS] 27. Add in-memory ambiguous row batching
- [IN-PROGRESS] 28. Add enrichment queue flushing logic
- [IN-PROGRESS] 29. Persist deterministic extraction immediately
- [IN-PROGRESS] 30. Update extracted rows after enrichment completion
- [IN-PROGRESS] 31. Add deterministic vs inferred source tagging
- [IN-PROGRESS] 32. Add confidence persistence to extracted entities
- [IN-PROGRESS] 33. Add enrichment explanation persistence
- [IN-PROGRESS] 34. Add idempotent enrichment updates
- [IN-PROGRESS] 35. Add malformed enrichment payload validation
- [IN-PROGRESS] 36. Add enrichment retry handling
- [IN-PROGRESS] 37. Ensure all enrichment updates are persisted
- [IN-PROGRESS] 38. Ensure existing CRUD APIs return enriched values
- [IN-PROGRESS] 39. Ensure ingestion job status supports enrichment lifecycle
- [TODO] 40. Add tests
- [TODO] 41. Update README documentation

⸻

6. Verification Criteria (Tests)

- [IN-PROGRESS] SCENARIO 1: CSV with complete structured fields processes without LLM inference.
- [IN-PROGRESS] SCENARIO 2: Missing currency inferred correctly from jurisdiction.
- [IN-PROGRESS] SCENARIO 3: Invalid coordinates create validation flags.
- [IN-PROGRESS] SCENARIO 4: Low-confidence rows enter review queue.
- [IN-PROGRESS] SCENARIO 5: Batch processing handles 10K rows successfully.
- [IN-PROGRESS] SCENARIO 6: Provider factory switches providers without code changes.
- [IN-PROGRESS] SCENARIO 7: Ollama provider works locally without cloud APIs.
- [IN-PROGRESS] SCENARIO 8: LLM malformed JSON does not crash ingestion pipeline.
- [IN-PROGRESS] SCENARIO 9: Confidence scores computed deterministically.
- [IN-PROGRESS] SCENARIO 10: Extraction explanation stored successfully.
- [IN-PROGRESS] SCENARIO 11: Existing ingestion pipeline remains functional.
- [IN-PROGRESS] SCENARIO 12: XLSX multi-sheet metadata preserved correctly.
- [IN-PROGRESS] SCENARIO 13: Deterministic validation catches malformed coordinates.
- [IN-PROGRESS] SCENARIO 14: Ambiguous schema mappings trigger LLM fallback.
- [IN-PROGRESS] SCENARIO 15: Failed LLM batch does not terminate entire ingestion job.
- [IN-PROGRESS] SCENARIO 16: Asset type inference persists successfully.
- [IN-PROGRESS] SCENARIO 17: Ambiguous rows are queued and enriched correctly.
- [IN-PROGRESS] SCENARIO 18: Deterministic extraction persists before enrichment.
- [IN-PROGRESS] SCENARIO 19: Enrichment updates existing extracted rows correctly.
- [IN-PROGRESS] SCENARIO 20: No new database tables are introduced.

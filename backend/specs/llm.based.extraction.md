LLM-Powered Extraction Enrichment & Confidence System - Spec

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

Architecture Constraints

- Must follow current folder structure and service patterns
- Must NOT introduce unnecessary wrappers, helper classes, or abstractions
- Must NOT create speculative/future-proof infrastructure unless immediately required
- Keep implementation lean and incremental
- Reuse existing ingestion flow and services where possible
- Do not duplicate parsing logic already implemented for CSV/XLSX

Security

- API keys loaded from environment variables
- No secrets hardcoded
- LLM requests must not log sensitive payloads

Dependencies

- Existing extraction ingestion flow
- Existing extracted_asset_fields table
- Existing review queue system
- Existing validation flags system
- Existing CSV/XLSX parsers

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

- [TODO]

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
"longitude_column": ""
}

Implementation Requirements

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

LLM Fallback

Use LLM only if:

- ambiguous mappings exist
- multiple candidate columns
- no deterministic confidence

Persistence

Persist:

- inferred schema
- mapping confidence
- inference explanation

Integration

Must integrate directly into existing CSV/XLSX parsing pipeline.

⸻

4.6 Row Enrichment Pipeline

Status

- [TODO]

Process rows in batches.

Recommended batch size:

- 25–100 rows

Do NOT send entire files in one request.

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
→ Extract raw rows
→ Schema inference
→ Row enrichment
→ Deterministic validation
→ Confidence scoring
→ Persistence

⸻

4.7 Deterministic Validation Layer

Status

- [TODO]

ALL LLM outputs must be validated before persistence.

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

Validation Failure Behavior

On validation failure:

- create validation flag
- reduce confidence
- optionally escalate review
- preserve raw output for auditability

LLM outputs must NEVER be trusted directly.

⸻

4.8 Confidence Scoring

Status

- [TODO]

Do NOT rely on raw LLM confidence.

Use deterministic heuristic scoring.

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

Compute

Compute:

- field confidence
- overall confidence

⸻

Store

Persist:

- confidence score
- confidence explanation
- confidence factors/signals

⸻

Confidence Rules

Example:

if overall_confidence < 0.65:
send_to_review_queue

Confidence must be deterministic and reproducible.

⸻

4.9 Review Escalation

Status

- [TODO]

If:

- confidence below threshold
- conflicting values
- validation failures
- ambiguous inference
- malformed LLM output

Then:

- create review queue entry

Example:

{
"reason": "Currency could not be inferred confidently",
"priority": 2
}

⸻

Requirements

Persist:

- escalation reason
- triggering rule
- related entity id

⸻

4.10 Integration With Existing Pipeline

Status

- [TODO]

Integrate directly into current ingestion flow.

Required pipeline:

Upload
→ Parse CSV/XLSX
→ Extract rows
→ Schema inference
→ Deterministic extraction
→ LLM enrichment
→ Deterministic validation
→ Confidence scoring
→ Persist extracted fields
→ Create validation flags
→ Create review items if needed

⸻

Important Constraints

- Do NOT create a separate ingestion architecture
- Reuse existing extraction services
- Reuse existing repositories/entities
- Preserve current CRUD functionality

⸻

4.11 Database Usage

Status

- [PARTIAL]

Reuse existing tables where possible:

- [DONE] extracted_asset_fields
- [DONE] validation_flags
- [DONE] review_queue

Potential additions:

- [TODO] inference_explanation
- [TODO] confidence_explanation
- [TODO] confidence_factors
- [TODO] extraction_model
- [TODO] extraction_strategy

Only add fields if currently missing.

Avoid unnecessary migrations.

⸻

4.12 Deterministic vs LLM Responsibility Separation

Status

- [TODO]

Deterministic Responsibilities

Use rules/code for:

- coordinate validation
- numeric parsing
- currency symbol parsing
- schema enforcement
- confidence aggregation
- validation rules

⸻

LLM Responsibilities

Use LLM for:

- semantic normalization
- missing field inference
- ambiguous classification
- asset type inference
- explanation generation

⸻

Important Rule

LLM outputs must ALWAYS pass through deterministic validation before persistence.

⸻

4.13 Batch Processing

Status

- [TODO]

Requirements:

- process rows in chunks
- avoid token explosion
- support large CSV/XLSX files

Recommended:

- 25–100 rows per batch

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
- [TODO] 24. Add retry handling for provider failures
- [TODO] 25. Add tests
- [TODO] 26. Update README documentation

⸻

6. Verification Criteria (Tests)

- [TODO] SCENARIO 1: CSV with complete structured fields processes without LLM inference.
- [TODO] SCENARIO 2: Missing currency inferred correctly from jurisdiction.
- [TODO] SCENARIO 3: Invalid coordinates create validation flags.
- [TODO] SCENARIO 4: Low-confidence rows enter review queue.
- [TODO] SCENARIO 5: Batch processing handles 10K rows successfully.
- [TODO] SCENARIO 6: Provider factory switches providers without code changes.
- [TODO] SCENARIO 7: Ollama provider works locally without cloud APIs.
- [TODO] SCENARIO 8: LLM malformed JSON does not crash ingestion pipeline.
- [TODO] SCENARIO 9: Confidence scores computed deterministically.
- [TODO] SCENARIO 10: Extraction explanation stored successfully.
- [TODO] SCENARIO 11: Existing ingestion pipeline remains functional.
- [TODO] SCENARIO 12: XLSX multi-sheet metadata preserved correctly.
- [TODO] SCENARIO 13: Deterministic validation catches malformed coordinates.
- [TODO] SCENARIO 14: Ambiguous schema mappings trigger LLM fallback.
- [TODO] SCENARIO 15: Failed LLM batch does not terminate entire ingestion job.

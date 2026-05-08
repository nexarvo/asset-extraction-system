Extraction Pipeline Refactor & Cleanup - Spec

1. Goal & Context

Why

The current extraction system works functionally, but the architecture has become overly fragmented and difficult to maintain. There are too many services, DTOs, database calls, duplicate logic paths, and persistence responsibilities spread across the codebase.

The enrichment pipeline is also becoming difficult to reason about because deterministic logic, LLM enrichment, batching, validation, and persistence are mixed together.

The system needs a cleaner, leaner architecture before additional features are added.

⸻

Goal

Refactor the CSV/XLSX extraction pipeline into a cleaner streaming-based architecture that:

- processes files incrementally using streams
- minimizes memory usage
- reduces database calls
- centralizes orchestration logic
- separates deterministic logic from LLM logic cleanly
- removes duplicate code
- removes unnecessary DTOs/services
- introduces helper-based deterministic processing
- preserves existing functionality
- supports batch persistence
- supports ambiguity batching + enrichment
- improves maintainability and readability
- keeps architecture lean and pragmatic

⸻

2. Scope & Boundaries

In Scope

- [IN-PROGRESS] Refactor CSV processing pipeline
- [IN-PROGRESS] Refactor XLSX processing pipeline
- [IN-PROGRESS] Convert extraction flow to streaming-based processing
- [IN-PROGRESS] Add schema inference from initial rows
- [IN-PROGRESS] Add empty-row detection before schema inference
- [IN-PROGRESS] Centralize orchestration inside main extraction functions
- [IN-PROGRESS] Replace unnecessary services with helper utilities
- [IN-PROGRESS] Add deterministic helper layer
- [IN-PROGRESS] Add ambiguity detection pipeline
- [IN-PROGRESS] Add ambiguity batching logic
- [IN-PROGRESS] Add persistence batching logic
- [IN-PROGRESS] Reduce unnecessary DB calls
- [IN-PROGRESS] Remove duplicate extraction logic
- [TODO] Remove unnecessary DTOs
- [TODO] Keep DTOs only for real persisted entities
- [IN-PROGRESS] Add clean logging system
- [IN-PROGRESS] Remove DB-based error logging
- [IN-PROGRESS] Preserve existing functionality
- [IN-PROGRESS] Preserve current database schema usage
- [IN-PROGRESS] Preserve current CRUD APIs

⸻

Out of Scope

- PDF extraction refactor
- OCR redesign
- Entity reconciliation redesign
- New database tables
- Queue infrastructure redesign
- Distributed processing redesign
- Full modular monorepo restructuring
- Rewriting persistence entities

⸻

3. Constraints & Dependencies

Tech Stack

- NestJS
- TypeScript
- PostgreSQL
- Existing extraction entities

⸻

Architecture Constraints

- Must NOT introduce overengineering
- Must NOT create speculative abstractions
- Must NOT create unnecessary services
- Prefer helper utilities for deterministic logic
- Keep orchestration centralized
- Preserve existing functionality
- Reuse current repositories/entities
- Avoid excessive indirection
- Minimize memory usage
- Minimize database calls

⸻

Logging Constraints

- Do NOT persist logs/errors into database
- Logging should only be console based
- Logging must support:
  - INFO
  - WARN
  - ERROR
- Logging should be color encoded
- Logging must remain lightweight
- Avoid noisy logs

⸻

Dependencies

- Existing CSV parser
- Existing XLSX parser
- Existing extraction entities
- Existing LLM service/factory
- Existing persistence repositories

⸻

4. Technical Requirements

4.1 Streaming-Based File Processing

Status

- [IN-PROGRESS]

Files must be processed incrementally using streams.

Requirements:

- [IN-PROGRESS] Stream CSV rows instead of loading entire file into memory
- [IN-PROGRESS] Stream XLSX sheet rows incrementally
- [IN-PROGRESS] Support large files efficiently
- [IN-PROGRESS] Minimize in-memory row retention
- [IN-PROGRESS] Process rows as they arrive
- [IN-PROGRESS] Avoid full dataset materialization

⸻

Required Flow

Open File Stream
→ Detect actual data start rows
→ Read first 10–20 valid rows
→ Run schema inference
→ Process rows incrementally
→ Detect ambiguities
→ Batch deterministic rows
→ Batch ambiguous rows
→ Persist deterministic rows
→ Run LLM enrichment on ambiguity batches
→ Validate enriched rows
→ Persist enriched rows

⸻

4.2 Schema Inference Refactor

Status

- [IN-PROGRESS]

Before row processing:

- [IN-PROGRESS] Detect first meaningful rows
- [IN-PROGRESS] Skip empty/header garbage rows
- [IN-PROGRESS] Extract first 10–20 valid rows
- [IN-PROGRESS] Send schema inference request to LLM
- [IN-PROGRESS] Infer:
  - column meanings
  - canonical mappings
  - column types
  - asset-related fields

⸻

Example Schema Output

{
"asset_name_column": "Facility Name",
"value_column": "Asset Value",
"currency_column": "Currency",
"latitude_column": "Lat",
"longitude_column": "Lng",
"asset_type_column": "Category",
"column_types": {
"Asset Value": "number",
"Lat": "coordinate",
"Currency": "currency"
}
}

⸻

Requirements

- [IN-PROGRESS] Prefer deterministic inference first
- [IN-PROGRESS] Use LLM only for ambiguity
- [IN-PROGRESS] Keep schema inference lightweight
- [IN-PROGRESS] Avoid repeated schema inference calls
- [IN-PROGRESS] Reuse inferred schema throughout processing

⸻

4.3 Deterministic Processing Helpers

Status

- [IN-PROGRESS]

Deterministic logic must NOT live inside bloated services.

⸻

Requirements

Create helper-based utilities for:

- [IN-PROGRESS] Coordinate parsing
- [IN-PROGRESS] Currency normalization
- [IN-PROGRESS] Numeric parsing
- [IN-PROGRESS] Validation checks
- [IN-PROGRESS] Precision validation
- [IN-PROGRESS] Ambiguity detection
- [IN-PROGRESS] Confidence scoring
- [IN-PROGRESS] Row normalization
- [IN-PROGRESS] Column matching
- [IN-PROGRESS] Asset type normalization

⸻

Important Constraints

- Helpers should remain stateless
- Helpers should NOT make DB calls
- Helpers should NOT contain orchestration logic
- Helpers should be callable from extraction functions directly

⸻

4.4 Main Orchestration Functions

Status

- [IN-PROGRESS]

The architecture should favor clear top-level orchestration functions.

⸻

Required Pattern

Example:

processXlsxExtraction()

Should orchestrate:

schema inference
→ row processing
→ ambiguity detection
→ batching
→ validation
→ persistence
→ enrichment

⸻

Requirements

- [IN-PROGRESS] Centralize orchestration logic
- [IN-PROGRESS] Keep orchestration readable
- [IN-PROGRESS] Avoid deeply nested service chains
- [IN-PROGRESS] Keep helper calls explicit
- [IN-PROGRESS] Keep execution flow easy to trace

⸻

4.5 Ambiguous Row Pipeline

Status

- [IN-PROGRESS]

When deterministic checks detect ambiguity:

- [IN-PROGRESS] Store ambiguous rows in memory
- [IN-PROGRESS] Maintain ambiguity batch
- [IN-PROGRESS] Flush ambiguity batch at 50 rows

⸻

Ambiguity Examples

- Missing currency
- Invalid coordinate formats
- Unknown asset type
- Conflicting numeric values
- Ambiguous column mappings
- Partial location information

⸻

LLM Enrichment Flow

Ambiguous Row Queue
→ Batch of 50
→ Send to LLM
→ Receive JSON
→ Run deterministic validation
→ Accept valid rows
→ Reject invalid rows
→ Persist valid enriched rows

⸻

Requirements

- [IN-PROGRESS] LLM must return strict JSON
- [IN-PROGRESS] Reject malformed outputs
- [IN-PROGRESS] Deterministically validate ALL enriched rows
- [IN-PROGRESS] Failed enrichment must NOT break pipeline
- [IN-PROGRESS] Retry malformed batches if appropriate

⸻

4.6 Deterministic Persistence Batching

Status

- [IN-PROGRESS]

Rows that pass deterministic checks immediately should NOT wait for LLM processing.

⸻

Requirements

- [IN-PROGRESS] Maintain valid deterministic row batch
- [IN-PROGRESS] Persist deterministic rows in batches of 500
- [IN-PROGRESS] Minimize insert queries
- [IN-PROGRESS] Use bulk inserts where possible
- [IN-PROGRESS] Avoid per-row DB writes
- [IN-PROGRESS] Flush remaining rows after processing completes

⸻

Required Flow

Deterministic Valid Rows
→ Batch Queue (500)
→ Bulk Persist

⸻

4.7 Database Access Cleanup

Status

- [IN-PROGRESS]

Current DB access patterns are overly fragmented.

⸻

Requirements

- [IN-PROGRESS] Reduce unnecessary DB calls
- [IN-PROGRESS] Remove repeated lookups
- [IN-PROGRESS] Centralize persistence logic
- [IN-PROGRESS] Use batch persistence where possible
- [IN-PROGRESS] Avoid repository calls inside helpers
- [IN-PROGRESS] Avoid persistence inside validation helpers
- [IN-PROGRESS] Avoid persistence inside parsing helpers

⸻

Important Constraints

- DB access should primarily happen:
  - during batch persistence
  - during ingestion lifecycle updates
  - during review/validation creation if needed

⸻

4.8 DTO Cleanup

Status

- [TODO]

There are too many unnecessary DTOs.

⸻

Requirements

- [TODO] Remove unused DTOs
- [TODO] Remove speculative DTOs
- [TODO] Remove duplicate DTOs
- [TODO] Keep DTOs only for:
  - API contracts
  - entity persistence structures
- [TODO] Avoid DTO explosion
- [TODO] Prefer internal typed interfaces where appropriate

⸻

Important Rule

DTOs should map to real entity/business needs only.

⸻

4.9 Service Cleanup

Status

- [IN-PROGRESS]

The current architecture has too many fragmented services.

⸻

Requirements

- [IN-PROGRESS] Remove unnecessary services
- [IN-PROGRESS] Consolidate duplicate logic
- [IN-PROGRESS] Move deterministic utilities into helpers
- [IN-PROGRESS] Keep only meaningful orchestration services
- [IN-PROGRESS] Avoid service-per-feature anti-pattern

⸻

Preferred Structure

Extraction Service
→ orchestration
Helpers
→ deterministic processing
LLM Service
→ enrichment only
Repositories
→ persistence only

⸻

4.10 Logging Refactor

Status

- [IN-PROGRESS]

Current logging architecture is not desired.

⸻

Requirements

- [IN-PROGRESS] Remove DB-based error logging
- [IN-PROGRESS] Add lightweight console logger
- [IN-PROGRESS] Support:
  - INFO
  - WARN
  - ERROR
- [IN-PROGRESS] Add color encoding
- [IN-PROGRESS] Keep logs readable
- [IN-PROGRESS] Avoid excessive verbosity
- [IN-PROGRESS] Log pipeline stages clearly

⸻

Example

[INFO] XLSX schema inferred successfully
[WARN] Ambiguous currency detected on row 142
[ERROR] Failed enrichment batch validation

⸻

4.11 Code Cleanup & Deduplication

Status

- [IN-PROGRESS]

The codebase currently contains duplicated logic and inconsistent patterns.

⸻

Requirements

- [IN-PROGRESS] Remove duplicate parsing logic
- [IN-PROGRESS] Remove duplicate validation logic
- [IN-PROGRESS] Remove duplicate enrichment logic
- [IN-PROGRESS] Remove dead code
- [IN-PROGRESS] Remove unused utilities
- [IN-PROGRESS] Remove obsolete services
- [IN-PROGRESS] Normalize extraction flow structure
- [IN-PROGRESS] Normalize naming conventions
- [IN-PROGRESS] Simplify execution paths

⸻

5. Implementation Steps

Pipeline Refactor

- [REVIEW] 1. Refactor CSV processing into streaming flow
- [REVIEW] 2. Refactor XLSX processing into streaming flow
- [REVIEW] 3. Add actual data-start row detection
- [REVIEW] 4. Add first-row sampling logic
- [REVIEW] 5. Add schema inference orchestration
- [REVIEW] 6. Add deterministic helper utilities
- [REVIEW] 7. Remove deterministic logic from bloated services
- [REVIEW] 8. Add ambiguity detection helpers
- [REVIEW] 9. Add ambiguity batching mechanism
- [REVIEW] 10. Add deterministic persistence batching
- [REVIEW] 11. Add enrichment orchestration
- [REVIEW] 12. Add deterministic validation after enrichment
- [REVIEW] 13. Add enrichment retry handling
- [REVIEW] 14. Add batch flush handling
- [REVIEW] 15. Add end-of-stream flush handling

⸻

Persistence Cleanup

- [REVIEW] 16. Consolidate persistence logic
- [REVIEW] 17. Reduce DB call frequency
- [REVIEW] 18. Add bulk insert support
- [REVIEW] 19. Remove per-row persistence patterns

⸻

Architecture Cleanup

- [REVIEW] 20. Remove unnecessary services (batch services deprecated, validation moved to helpers)
- [REVIEW] 21. Remove dead code
- [REVIEW] 22. Remove unnecessary DTOs
- [REVIEW] 23. Normalize extraction structure
- [REVIEW] 24. Simplify orchestration flow
- [REVIEW] 25. Consolidate duplicate helpers

⸻

Logging Cleanup

- [REVIEW] 26. Remove DB logging
- [REVIEW] 27. Add lightweight console logger
- [REVIEW] 28. Add color-encoded log levels
- [REVIEW] 29. Normalize logging format

⸻

Finalization

- [TODO] 30. Verify backward compatibility
- [TODO] 31. Verify CRUD APIs still function
- [TODO] 32. Add integration tests
- [TODO] 33. Update README/documentation

⸻

6. Verification Criteria (Tests)

- [REVIEW] SCENARIO 1: Large CSV processes without full memory load.
- [REVIEW] SCENARIO 2: XLSX sheets process incrementally.
- [REVIEW] SCENARIO 3: Empty/header rows are skipped correctly.
- [REVIEW] SCENARIO 4: Schema inference runs once per sheet/file.
- [REVIEW] SCENARIO 5: Deterministic rows persist in batches of 500.
- [REVIEW] SCENARIO 6: Ambiguous rows batch at 50 before enrichment.
- [REVIEW] SCENARIO 7: LLM enrichment returns validated JSON.
- [REVIEW] SCENARIO 8: Malformed enrichment responses do not crash pipeline.
- [REVIEW] SCENARIO 9: Failed enrichment batch does not terminate ingestion.
- [REVIEW] SCENARIO 10: Remaining batches flush successfully at stream completion.
- [REVIEW] SCENARIO 11: DB call count reduced significantly.
- [IN-PROGRESS] SCENARIO 12: Duplicate extraction logic removed successfully.
- [IN-PROGRESS] SCENARIO 13: DTO count reduced appropriately.
- [REVIEW] SCENARIO 14: Existing CRUD functionality remains intact.
- [REVIEW] SCENARIO 15: Logging outputs INFO/WARN/ERROR correctly.
- [REVIEW] SCENARIO 16: No DB error logging occurs.
- [REVIEW] SCENARIO 17: Memory usage remains stable for large files.
- [REVIEW] SCENARIO 18: Orchestration flow remains readable and maintainable.

Asset Extraction & Reconciliation Platform — Database Schema Spec

1. Goal & Context

Why

The platform ingests noisy financial and infrastructure documents, extracts asset-level intelligence using OCR + LLM pipelines, reconciles conflicting information across sources, and produces a canonical asset registry that is explainable, reproducible, auditable, and reviewable by human analysts.

The current schema captures only:

- jobs
- extraction results
- extracted records
- errors

But the assignment requires significantly richer capabilities:

- provenance tracking
- field-level confidence
- inferred vs extracted facts
- conflict preservation
- reconciliation
- delta tracking
- review workflows
- auditability
- canonical entities
- duplicate clustering
- validation flags

The current schema is too extraction-centric and lacks:

- canonical asset modeling
- normalized field evidence
- reconciliation lineage
- review system
- change tracking
- inference modeling

Goal

Design a normalized but practical relational schema that:

- supports the entire pipeline lifecycle
- maintains a single source of truth
- separates raw extraction from canonical truth
- preserves auditability and provenance
- supports future scaling and ML evolution
- supports analyst review workflows

⸻

2. Scope & Boundaries

In Scope

- ingestion metadata
- extraction pipeline tracking
- OCR/document understanding
- extracted asset candidates
- canonical assets
- field-level evidence
- confidence scoring
- inferred facts
- validation flags
- reconciliation/linkage
- review queue
- delta/change tracking
- provenance
- audit trail

Out of Scope

- authentication/authorization
- billing
- notification systems
- vector databases
- embeddings storage
- observability tooling
- ML training datasets
- object/file storage itself (S3 only referenced)

⸻

3. Constraints & Dependencies

Tech Stack

- NestJS
- TypeORM
- PostgreSQL
- React frontend
- S3-compatible blob storage
- OpenAI / Claude integrations

Security

- Analyst actions must be auditable
- Immutable provenance history
- No destructive updates to evidence

Dependencies

- OCR provider
- geocoding provider
- LLM extraction services
- async queue system (BullMQ/SQS)

⸻

4. Architecture Principles

Core Design Principle

The most important architectural decision:

Separate:

1. Raw extracted claims
2. Canonical resolved truth
3. Evidence/provenance
4. Human review decisions

This is the key to making the system:

- explainable
- reproducible
- audit-ready

⸻

5. High-Level Data Flow

Document
↓
Document Processing Job
↓
Page/OCR Analysis
↓
Extracted Asset Candidates
↓
Extracted Field Claims
↓
Validation + Confidence
↓
Reconciliation
↓
Canonical Assets
↓
Human Review
↓
Asset History / Delta Tracking

⸻

6. Recommended Database Schema

⸻

TABLE: documents

Represents uploaded source files.

Purpose

Single source of truth for uploaded files.

Columns

Column Type Notes
id uuid PK
original_file_name varchar
storage_key varchar S3 path
mime_type varchar
file_size bigint
checksum_sha256 varchar dedupe
uploaded_by uuid nullable
upload_source varchar ui/api/batch
ingestion_status enum uploaded, processing, completed, failed
created_at timestamp

Indexes

- checksum_sha256
- ingestion_status

⸻

TABLE: processing_jobs

Represents async orchestration jobs.

Purpose

Tracks processing lifecycle.

Columns

Column Type
id uuid PK
document_id FK
job_type enum
status enum
attempt_count int
started_at timestamp
completed_at timestamp
error_summary text
created_at timestamp

Job Types

- OCR
- DOCUMENT_UNDERSTANDING
- EXTRACTION
- RECONCILIATION
- VALIDATION
- GEOCODING
- CONFIDENCE_SCORING

⸻

TABLE: document_pages

Represents analyzed pages.

Purpose

Supports provenance and page-level understanding.

Columns

Column Type
id uuid PK
document_id FK
page_number int
has_text_layer boolean
ocr_required boolean
detected_layout jsonb
page_classification varchar
confidence_score numeric
created_at timestamp

Example page classifications

- table
- appendix
- map
- cover_page
- narrative
- footnote

⸻

TABLE: extracted_assets

MOST IMPORTANT RAW TABLE

Represents raw extracted asset candidates BEFORE reconciliation.

This replaces your current extracted_records.

Why

An extracted record is not generic data.
It is specifically:

- an asset candidate
- from a source
- with uncertainty/conflicts

Columns

Column Type
id uuid PK
document_id FK
extraction_job_id FK
source_page_id FK
extraction_strategy varchar
extraction_model varchar
raw_asset_name text
raw_payload jsonb
overall_confidence numeric
review_status enum
created_at timestamp

review_status

- pending
- auto_approved
- requires_review
- rejected

⸻

TABLE: extracted_asset_fields

MOST IMPORTANT TABLE IN ENTIRE SYSTEM

This is the real heart of the platform.

Every extracted field becomes a row.

Instead of:

{
"name": "ABC Solar Plant",
"value": 1000000
}

Store:

asset_id field_name field_value
x asset_name ABC Solar Plant
x value 1000000

Why This Matters

This enables:

- field-level provenance
- field-level confidence
- conflict handling
- explainability
- inferred vs extracted distinction

Columns

Column Type
id uuid PK
extracted_asset_id FK
field_name varchar
normalized_value jsonb
raw_value text
value_type varchar
confidence_score numeric
extraction_method enum
is_inferred boolean
inference_explanation text
evidence_text text
source_page_number int
source_bbox jsonb
validation_status enum
created_at timestamp

extraction_method

- OCR
- TABLE_EXTRACTION
- LLM_EXTRACTION
- GEOCODING
- HEURISTIC
- HUMAN_REVIEW

validation_status

- valid
- suspicious
- invalid
- unverifiable

⸻

TABLE: canonical_assets

Single Source of Truth

Represents reconciled final assets.

Important

This table should contain ONLY the resolved canonical truth.

Never overwrite history destructively.

Columns

Column Type
id uuid PK
canonical_name varchar
asset_type varchar
jurisdiction varchar
latitude numeric
longitude numeric
canonical_value numeric
canonical_currency varchar
value_basis varchar
overall_confidence numeric
review_status enum
duplicate_cluster_id FK nullable
active_version_id FK
created_at timestamp
updated_at timestamp

⸻

TABLE: canonical_asset_fields

Field-level resolved truth.

Purpose

Stores the chosen canonical value AND lineage.

Columns

Column Type
id uuid PK
canonical_asset_id FK
field_name varchar
resolved_value jsonb
selected_evidence_id FK
resolution_strategy varchar
confidence_score numeric
explanation text
created_at timestamp

⸻

TABLE: field_evidence

Auditability Table

Links canonical fields back to extracted evidence.

Columns

Column Type
id uuid PK
canonical_field_id FK
extracted_field_id FK
evidence_weight numeric
evidence_role varchar
created_at timestamp

evidence_role

- primary
- supporting
- conflicting

⸻

TABLE: asset_relationships

Supports parent-child relationships.

Columns

Column Type
id uuid PK
parent_asset_id FK
child_asset_id FK
relationship_type varchar
confidence_score numeric
created_at timestamp

⸻

TABLE: duplicate_clusters

Tracks potential duplicates.

Columns

Column Type
id uuid PK
cluster_status enum
created_at timestamp

⸻

TABLE: asset_matches

Stores reconciliation decisions.

Purpose

Critical for explainability.

Columns

Column Type
id uuid PK
extracted_asset_id FK
canonical_asset_id FK
match_score numeric
match_strategy varchar
match_explanation text
decision enum
created_at timestamp

decision

- matched
- merged
- distinct
- ambiguous

⸻

TABLE: validation_flags

Purpose

Stores all detected issues.

Columns

Column Type
id uuid PK
entity_type varchar
entity_id uuid
flag_type varchar
severity enum
explanation text
created_at timestamp

Examples

- impossible_coordinates
- currency_mismatch
- unsupported_precision
- duplicate_collision
- hq_address_misattribution

⸻

TABLE: review_queue

Human review workflow.

Columns

Column Type
id uuid PK
entity_type varchar
entity_id uuid
review_reason varchar
priority int
assigned_to uuid nullable
status enum
resolution_notes text
resolved_by uuid nullable
resolved_at timestamp
created_at timestamp

⸻

TABLE: asset_versions

CRITICAL FOR DELTA TRACKING

Stores immutable snapshots.

Columns

Column Type
id uuid PK
canonical_asset_id FK
version_number int
snapshot_data jsonb
created_by_process varchar
created_at timestamp

⸻

TABLE: asset_change_events

Tracks changes between versions.

Columns

Column Type
id uuid PK
canonical_asset_id FK
previous_version_id FK
new_version_id FK
field_name varchar
old_value jsonb
new_value jsonb
change_reason text
confidence_delta numeric
created_at timestamp

⸻

TABLE: extraction_errors

Your current table is fine conceptually.

Improve slightly.

Columns

Column Type
id uuid PK
processing_job_id FK
error_stage varchar
error_code varchar
message text
stack_trace text
recoverable boolean
created_at timestamp

⸻

7. Important Schema Design Decisions

⸻

Decision 1 — Do NOT Store Everything in JSONB

Bad:

{
"asset_name": "...",
"value": "...",
"currency": "..."
}

Why bad:

- impossible to audit properly
- hard to reconcile
- hard to compare fields
- hard to track provenance
- weak indexing

Use:

- normalized field rows
- JSONB only for auxiliary metadata

⸻

Decision 2 — Separate Extracted vs Canonical

This is mandatory.

Raw extraction:

- noisy
- duplicated
- contradictory

Canonical:

- resolved
- explainable
- validated

Never mix them.

⸻

Decision 3 — Field-Level Provenance

The assignment explicitly requires:

Every field must be traceable

That means provenance must exist PER FIELD.

Not just per asset.

⸻

Decision 4 — Immutable History

Never overwrite canonical values without versioning.

You need:

- auditability
- delta updates
- reproducibility

⸻

Decision 5 — Human Review Is First-Class

Do not treat review as an afterthought.

The assignment explicitly requires:

escalate for human review

Therefore review workflow must exist in schema.

⸻

8. Recommended Enums

processing_jobs.status

queued
running
completed
failed
retrying

review_queue.status

pending
in_review
approved
rejected
resolved

validation_flags.severity

low
medium
high
critical

⸻

9. Recommended Indexes

Critical Indexes

extracted_asset_fields

- (field_name)
- (confidence_score)
- GIN(normalized_value)

canonical_assets

- (canonical_name)
- (jurisdiction)
- (asset_type)

asset_matches

- (match_score)

validation_flags

- (entity_type, entity_id)

review_queue

- (status, priority)

⸻

10. What To Remove From Current Schema

Remove

extraction_results

Not necessary as separate table.

Its concerns are better represented by:

- processing_jobs
- extracted_assets

⸻

Rename

extracted_records

→ extracted_assets

Because that is what they actually represent.

⸻

Keep

extraction_errors

Useful.

⸻

11. Verification Criteria (Tests)

SCENARIO 1 — Provenance

- Every canonical field can trace back to extracted evidence.

SCENARIO 2 — Conflicting Values

- System preserves conflicting values without overwriting evidence.

SCENARIO 3 — Human Review

- Low-confidence extraction enters review queue.

SCENARIO 4 — Delta Tracking

- New extraction generates version diff.

SCENARIO 5 — Duplicate Detection

- Similar assets cluster correctly.

SCENARIO 6 — Validation

- Impossible coordinates trigger validation flags.

SCENARIO 7 — Auditability

- Analyst can inspect why a value was chosen.

⸻

CSV Ingestion V2 (Streaming + Robust Parsing) - Spec

1. Goal & Context

- Why:
  The current CSV ingestion implementation loads and parses the entire file in memory using a character-based parser, which limits scalability, increases memory pressure, and tightly couples parsing with extraction/domain logic. The current implementation also lacks transactional persistence orchestration, row-level auditability, and resilient partial-failure handling required for production-grade extraction pipelines.
- Goal:
  Build a streaming-based CSV ingestion pipeline that:
  - processes large files safely and efficiently
  - separates parsing, validation, mapping, and persistence concerns
  - supports row-level validation and error handling
  - introduces transactional persistence boundaries
  - enables reliable retry behavior
  - produces auditable extracted asset records

⸻

2. Scope & Boundaries

In Scope

- Streaming-based CSV parsing
- Replace full in-memory parsing with stream processing
- Row-by-row CSV ingestion
- Header normalization
- Row validation layer
- Separation of parser and mapper responsibilities
- Asset mapping layer
- Transactional persistence service
- Structured extraction error handling
- Partial success ingestion behavior
- Batch persistence strategy
- Extraction pipeline orchestration
- Idempotency support for extraction writes
- Strong TypeScript typing

Out of Scope

- PDF ingestion pipeline
- XLS/XLSX ingestion pipeline
- OCR implementation
- Frontend modifications
- Distributed chunk processing
- Reconciliation/canonical asset merging
- Human review workflows
- Queue architecture changes
- Database schema redesign beyond extraction-related entities

⸻

3. Constraints & Dependencies

Tech Stack

- NestJS
- TypeScript (strict mode)
- Node.js Streams
- TypeORM
- PostgreSQL
- csv-parser or fast-csv

Security

- Memory-safe file processing
- No full file buffering during parsing
- Validation before persistence
- Structured error handling without leaking internal exceptions

Dependencies

- Existing extraction queue/worker pipeline
- Existing extraction entities/repositories
- Existing ApplicationError structure
- Existing ErrorCode enum
- Existing ExtractionResult domain structures

⸻

4. Technical Requirements

API / Interface

No API changes required.

Input remains:

AssetFileInput {
filename: string;
mimeType: string;
buffer: Buffer;
}

⸻

Streaming Architecture

File Buffer
↓
Readable Stream
↓
CSV Stream Parser
↓
Header Normalizer
↓
RawCsvRow
↓
CsvRowValidator
↓
CsvAssetMapperService
↓
ExtractedAssetCandidate
↓
ExtractionPersistenceService
↓
Database

⸻

Data Model

No major schema redesign required for this feature.

Existing extraction entities should support:

- extracted assets
- extracted asset fields
- extraction errors

The ingestion layer should produce normalized intermediate structures before persistence.

⸻

Intermediate Types

RawCsvRow

interface RawCsvRow {
rowIndex: number;
headers: string[];
values: string[];
raw: Record<string, string>;
}

⸻

ParsedCsvRow

Normalized validated row.

interface ParsedCsvRow {
rowIndex: number;
data: Record<string, string | null>;
}

⸻

ExtractedAssetCandidate

Produced by mapping layer before persistence.

interface ExtractedAssetCandidate {
rawAssetName?: string;
fields: ExtractedFieldCandidate[];
sourceRowIndex: number;
overallConfidence?: number;
}

⸻

ExtractedFieldCandidate

interface ExtractedFieldCandidate {
fieldName: string;
rawValue: string | null;
normalizedValue?: unknown;
confidenceScore?: number;
sourceColumn?: string;
}

⸻

Business Logic

⸻

1. Streaming CSV Parsing

Replace:

- manual character parsing
- full buffer decoding
- string concatenation parsing logic

With:

- Node.js stream pipeline
- csv-parser or fast-csv

Requirements:

- process rows incrementally
- avoid loading entire CSV into memory
- support large file ingestion (>50MB)

⸻

2. Separation of Concerns

The ingestion pipeline must be divided into isolated responsibilities.

⸻

CSV Parsing Layer

Responsibilities:

- consume readable stream
- parse CSV syntax
- emit raw rows
- handle malformed CSV structure

Must NOT:

- apply business mapping
- persist data
- normalize asset fields

⸻

Header Normalization Layer

Responsibilities:

- trim whitespace
- lowercase headers
- normalize separators
- remove duplicate spacing
- detect duplicate headers

Example:

" Asset Name "
→
"asset_name"

⸻

Validation Layer

Responsibilities:

- validate row structure
- validate required headers
- detect malformed rows
- validate column count consistency
- skip empty rows

Validation errors must:

- be structured
- include row index
- include reason
- optionally include raw snapshot

⸻

Asset Mapping Layer

New service:

CsvAssetMapperService

Responsibilities:

- convert validated CSV rows into extracted asset candidates
- apply business mapping rules
- map headers → domain fields
- normalize values
- assign extraction metadata

Must NOT:

- persist directly
- manage transactions

⸻

3. Persistence Layer

Introduce a dedicated orchestration service:

ExtractionPersistenceService

This service becomes the transactional boundary for extraction persistence.

⸻

Responsibilities

- manage database transaction boundaries
- coordinate repository writes
- persist extracted assets
- persist extracted asset fields
- persist extraction errors
- rollback failed persistence operations
- support batch inserts
- support idempotent writes

⸻

Persistence Flow

Mapped Asset Candidates
↓
ExtractionPersistenceService
↓
BEGIN TRANSACTION
↓
Save Extracted Assets
↓
Save Extracted Fields
↓
Save Extraction Metadata
COMMIT

⸻

Important Constraint

Transactions must ONLY wrap database operations.

Transactions must NOT include:

- stream parsing
- file reading
- external API calls
- long-running processing

⸻

Repository Responsibilities

Repositories should remain thin CRUD abstractions.

Example:

ExtractedAssetRepository
ExtractedAssetFieldRepository
ExtractionErrorRepository

Repositories must NOT:

- call other repositories
- open transactions
- orchestrate workflows

⸻

Transaction Orchestration

Only:

ExtractionPersistenceService

should coordinate transactional writes.

Example:

await dataSource.transaction(async (manager) => {
// persist extraction entities
});

⸻

4. Batch Persistence Strategy

To avoid excessive database writes:

Do NOT:

for (const row of rows) {
await repository.save(row);
}

Use:

- batched inserts
- chunked persistence
- bulk save operations

Recommended batch size:

- 100–1000 rows depending on payload size

⸻

5. Partial Success Behavior

CSV ingestion should support partial success.

Requirements:

- malformed rows should not fail entire ingestion
- valid rows should continue processing
- row-level failures should be logged

Example:

1000 rows
5 invalid
995 persisted successfully

⸻

6. Extraction Error Handling

Structured errors must include:

interface CsvRowError {
rowIndex: number;
reason: string;
rawData?: Record<string, unknown>;
}

Use:

- ApplicationError
- ErrorCode.CsvRowInvalid
- ErrorCode.CsvStreamFailure

⸻

7. Idempotency

Extraction writes should tolerate retries safely.

Recommended approach:

- deterministic row hashing
- unique extraction constraints
- processing stage checks

Example:

(document_id, row_index)

or:

(document_id, asset_hash)

should be uniquely identifiable.

⸻

8. Memory Efficiency

The parser must:

- process rows incrementally
- avoid full file buffering after stream creation
- avoid accumulating all rows in memory before persistence

Preferred approach:

- stream rows
- batch persist periodically
- clear processed buffers

⸻

5. Implementation Steps

- 1. Add streaming CSV parsing library (csv-parser or fast-csv)
- 2. Refactor CSV extraction pipeline to use streams
- 3. Implement RawCsvRow intermediate structure
- 4. Create header normalization utility
- 5. Create CsvRowValidator
- 6. Create CsvAssetMapperService
- 7. Create ExtractionPersistenceService
- 8. Refactor repositories into thin persistence abstractions
- 9. Add transactional extraction persistence flow
- 10. Implement batch persistence logic
- 11. Add row-level error handling
- 12. Add structured extraction logging
- 13. Add idempotency protections
- 14. Add streaming ingestion tests
- 15. Add malformed row tests
- 16. Add large-file performance tests
- 17. Update extraction pipeline integration
- 18. Update documentation

⸻

6. Verification Criteria (Tests)

- SCENARIO 1: Large CSV file (>50MB) is processed without memory overflow.
- SCENARIO 2: Streaming parser processes rows incrementally.
- SCENARIO 3: CSV ingestion does not load full file contents into application memory.
- SCENARIO 4: Malformed rows are logged without crashing the pipeline.
- SCENARIO 5: Header normalization maps inconsistent column names correctly.
- SCENARIO 6: Validation layer detects mismatched column counts.
- SCENARIO 7: Asset mapper converts rows into extracted asset candidates correctly.
- SCENARIO 8: Persistence layer commits all extraction entities atomically within a transaction.
- SCENARIO 9: Failed transactional persistence rolls back all related writes.
- SCENARIO 10: Partial row failures do not prevent valid rows from being persisted.
- SCENARIO 11: Batch persistence reduces excessive database write operations.
- SCENARIO 12: Retry of same extraction job does not create duplicate extracted assets.
- SCENARIO 13: Repositories remain transaction-agnostic and do not orchestrate other repositories.

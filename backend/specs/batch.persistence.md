Extraction Batch Persistence & Backpressure Control - Spec

1. Goal & Context

- Why:
  The current extraction persistence flow performs row-level database writes during ingestion. For large CSV/XLSX files containing hundreds of thousands or millions of rows, this results in excessive database roundtrips, transaction overhead, WAL pressure, connection saturation, and severe performance degradation. With concurrent file processing enabled, the existing architecture risks overwhelming the database under realistic ingestion workloads.
- Goal:
  Introduce a bounded batch-oriented persistence architecture that:
  - replaces per-row persistence with bulk transactional writes
  - reduces database query volume dramatically
  - introduces controlled in-memory buffering
  - supports backpressure-aware ingestion
  - maintains transactional consistency at batch boundaries
  - enables scalable concurrent extraction processing
  - preserves streaming-based memory efficiency

⸻

2. Scope & Boundaries

In Scope

- Batch-oriented persistence architecture
- In-memory extraction accumulation
- Bulk database insert strategy
- Transactional batch persistence
- Backpressure-aware extraction flow
- Batch flushing policies
- Persistence checkpointing
- Shared persistence support for CSV/XLSX pipelines
- Bulk insertion optimization
- Memory-bound ingestion buffering
- Incremental commit strategy
- Persistence retry handling

Out of Scope

- Database schema redesign
- Reconciliation pipeline changes
- OCR processing
- Queue infrastructure redesign
- Distributed ingestion workers
- Horizontal database scaling
- Kafka/event streaming systems
- Frontend changes

⸻

3. Constraints & Dependencies

Tech Stack

- NestJS
- TypeScript (strict mode)
- TypeORM
- PostgreSQL
- Node.js Streams

Security

- Prevent uncontrolled memory growth
- Prevent transaction explosion
- Avoid long-running database locks
- Avoid connection pool exhaustion

Dependencies

- Existing CSV ingestion pipeline
- Existing XLSX ingestion pipeline
- Existing ExtractionPersistenceService
- Existing extraction repositories
- Existing extraction entities
- Existing worker/queue architecture

⸻

4. Technical Requirements

Existing Problem

Current architecture:

Parse Row
↓
Validate
↓
Map
↓
Persist Immediately

This creates:

- one or more DB operations per row
- excessive network roundtrips
- ORM overhead amplification
- poor transaction efficiency

Example:

100K rows
× 3 inserts per row
=
300K+ database operations

This is not scalable.

⸻

Target Architecture

New architecture:

Stream Row
↓
Validate
↓
Map
↓
Batch Accumulator
↓
Batch Threshold Reached?
↓
YES
↓
ExtractionPersistenceService.persistBatch()
↓
Bulk Insert
↓
Commit
↓
Clear Batch

⸻

Batch-Oriented Persistence

Persistence granularity must change from:

1 row = 1 transaction

to:

N rows = 1 transaction

⸻

Batch Accumulator

Introduce:

BatchExtractionAccumulator

Responsibilities:

- accumulate extracted asset candidates
- track current batch size
- trigger flush conditions
- support memory-safe buffering
- clear processed batches after persistence

⸻

BatchAccumulator Interface

interface BatchExtractionAccumulator {
add(candidate: ExtractedAssetCandidate): void;
shouldFlush(): boolean;
flush(): ExtractedAssetCandidate[];
clear(): void;
size(): number;
}

⸻

Batch Flush Strategy

The accumulator should flush when ANY condition is met:

Row Count Threshold

Default:

500 extracted rows

⸻

Payload Size Threshold

Optional future optimization:

5 MB accumulated payload

⸻

Stream Completion

Flush remaining rows when:

- sheet processing completes
- file processing completes

⸻

Recommended Batch Size

Based on:

- average extracted field row size (~1.34KB)
- JSONB persistence overhead
- transaction overhead
- concurrent ingestion load

Recommended default:

const DEFAULT_BATCH_SIZE = 500;

Expected transactional payload:

~1–5 MB per transaction

which is considered safe and scalable for PostgreSQL ingestion workloads.

⸻

Shared Persistence Service Updates

Existing:

ExtractionPersistenceService

must be extended to support:

- bulk persistence
- batch transactions
- checkpoint-aware persistence
- chunked extraction writes

without breaking existing CSV/XLSX ingestion behavior.

⸻

Persistence API

Replace:

persist(candidate)

With:

persistBatch(
candidates: ExtractedAssetCandidate[],
context: ExtractionContext,
): Promise<void>

⸻

Transaction Boundaries

Transactions must wrap ONLY:

- batch database writes

Transactions must NOT include:

- file parsing
- row iteration
- validation
- normalization
- mapping
- external service calls

⸻

Bulk Insert Requirements

Persistence implementation must use:

- bulk inserts
- batched writes
- insert query builders

Avoid:

repository.save()

for high-volume ingestion persistence.

Preferred:

queryBuilder
.insert()
.values(batch)

⸻

Bulk Persistence Flow

BEGIN TRANSACTION
Bulk Insert Extracted Assets
Bulk Insert Extracted Asset Fields
Bulk Insert Extraction Errors
COMMIT

⸻

Repository Constraints

Repositories remain:

- thin CRUD abstractions
- transaction-agnostic

Repositories must NOT:

- orchestrate transactions
- coordinate workflows
- call other repositories internally

Only:

ExtractionPersistenceService

coordinates transactional persistence.

⸻

Incremental Commit Strategy

The ingestion pipeline must support incremental persistence.

Requirements:

- batches commit independently
- ingestion continues after successful commit
- failed batches rollback independently

The system must NOT:

- wrap entire workbook/file processing in a single transaction

⸻

Partial Persistence Behavior

Example:

100K rows total
80K persisted
Worker crashes

Expected behavior:

- persisted rows remain committed
- processing resumes safely from checkpoint
- entire ingestion is NOT rolled back

⸻

Checkpointing

Introduce extraction progress tracking.

Example metadata:

interface ExtractionCheckpoint {
fileId: string;
sheetName?: string;
lastProcessedRow: number;
}

Purpose:

- safe retries
- resumable ingestion
- failure recovery

⸻

Backpressure Control

The ingestion pipeline must support backpressure-aware processing.

Problem:

- parser may produce rows faster than DB can persist

Without control:

- memory usage grows unbounded

⸻

Backpressure Strategy

When accumulator reaches flush threshold:

pause parser
↓
persist batch
↓
clear accumulator
↓
resume parser

⸻

Memory Constraints

The system must NEVER:

- accumulate entire files in memory
- accumulate entire sheets in memory

Target behavior:

bounded memory ingestion

Expected memory profile:

O(batch_size)

instead of:

O(total_rows)

⸻

Concurrency Constraints

Current worker concurrency:

3 concurrent files

Batch persistence must:

- prevent DB overload under concurrent ingestion
- minimize simultaneous transaction pressure
- keep transaction duration short

⸻

Performance Goals

Expected improvements:

- drastically fewer DB queries
- reduced WAL amplification
- lower ORM overhead
- improved ingestion throughput
- reduced transaction contention

Example:

Before:

300K+ DB operations

After:

~200–500 transactional batch writes

⸻

Failure Handling

Batch persistence failures must:

- rollback only current batch
- preserve previously committed batches
- produce structured extraction errors
- support retry behavior

⸻

5. Implementation Steps

- 1. Create BatchExtractionAccumulator
- 2. Add configurable batch size support
- 3. Implement persistBatch() in ExtractionPersistenceService
- 4. Replace row-level persistence with batch persistence
- 5. Implement bulk insert strategy using query builders
- 6. Remove high-volume usage of repository.save()
- 7. Add transactional batch persistence
- 8. Add accumulator flush conditions
- 9. Add parser pause/resume backpressure support
- 10. Add checkpoint tracking support
- 11. Add incremental commit behavior
- 12. Add batch rollback handling
- 13. Add structured batch persistence logging
- 14. Update CSV ingestion integration
- 15. Update XLSX ingestion integration
- 16. Add ingestion performance benchmarks
- 17. Add concurrency stress tests
- 18. Update documentation

⸻

6. Verification Criteria (Tests)

- SCENARIO 1: 100K+ row files are processed without excessive DB query volume.
- SCENARIO 2: Rows are persisted in transactional batches instead of individually.
- SCENARIO 3: Batch persistence reduces total DB operations significantly.
- SCENARIO 4: Memory usage remains bounded during ingestion.
- SCENARIO 5: Parser pauses when accumulator reaches flush threshold.
- SCENARIO 6: Parser resumes correctly after successful batch persistence.
- SCENARIO 7: Failed batch transactions rollback without affecting previous batches.
- SCENARIO 8: Previously committed batches survive worker crashes.
- SCENARIO 9: Checkpointing enables resumable ingestion.
- SCENARIO 10: Concurrent ingestion of multiple large files does not overwhelm PostgreSQL.
- SCENARIO 11: Bulk insert strategy performs significantly better than row-level persistence.
- SCENARIO 12: CSV and XLSX pipelines both use shared batch persistence architecture.
- SCENARIO 13: Batch persistence works correctly with extraction error handling.
- SCENARIO 14: Transaction duration remains bounded under large ingestion workloads.

Async Batch Persistence Queue Refactor - Spec

1. Goal & Context

Why

The current extraction pipeline blocks row processing while waiting for database batch persistence. Even though batching exists, the pipeline still pauses on every flush because persistence is awaited inline.

This creates:

- unnecessary stream backpressure
- reduced throughput
- excessive transaction waiting
- inefficient CPU utilization
- slower ingestion for large files

The architecture needs lightweight asynchronous persistence queues so extraction can continue while persistence happens independently.

⸻

Goal

Introduce a minimal asynchronous batch persistence queue architecture that:

- decouples row processing from DB persistence
- avoids blocking stream processing
- supports large bulk inserts
- retries failed persistence automatically
- uses exponential backoff retries
- keeps architecture lean and maintainable
- avoids introducing heavy queue infrastructure
- preserves current extraction flow

⸻

2. Scope & Boundaries

In Scope

- [DONE] Introduce async batch persistence queue
- [DONE] Increase deterministic persistence batch size to 5000
- [DONE] Decouple persistence from row processing
- [DONE] Add async queue consumer flow
- [DONE] Add retry handling
- [DONE] Add exponential backoff retries
- [DONE] Add queue draining before job completion
- [DONE] Add queue error handling
- [DONE] Support concurrent persistence processing
- [DONE] Preserve existing extraction functionality

⸻

Out of Scope

- Distributed queues
- Multi-worker queue coordination
- Queue persistence to disk
- Dead letter queues
- Event sourcing
- Distributed transactions
- Full job orchestration redesign

⸻

3. Constraints & Dependencies

Tech Stack

- NestJS
- TypeScript
- PostgreSQL

⸻

Architecture Constraints

- Must remain lightweight
- Use BullMQ for queue management
- Queue implementation should remain minimal
- Avoid unnecessary abstractions
- Preserve current orchestration flow

⸻

Performance Constraints

- Row processing must not block on persistence
- Batch persistence should happen asynchronously
- Persistence should support high throughput
- Bulk inserts should minimize DB roundtrips

⸻

Dependencies

- Existing extraction pipeline
- Existing repositories/entities
- Existing persistence logic

⸻

4. Technical Requirements

4.1 Async Batch Persistence Queue

Status

- [TODO]

Introduce:

batch_persistence_queue

Purpose:

- asynchronously persist deterministic batches
- prevent stream blocking
- improve ingestion throughput

⸻

Required Flow

Row Processing
→ Deterministic batch reaches 5000
→ Hand batch to batch_persistence_queue
→ Continue stream processing immediately
Queue Consumer
→ Persist batch async
→ Retry if failed
→ Mark batch completed

⸻

Requirements

- [TODO] Queue must remain in-memory
- [TODO] Queue must support async processing
- [TODO] Queue must support concurrent jobs
- [TODO] Queue must support graceful draining
- [TODO] Queue must not block extraction stream

⸻

4.2 Batch Size Refactor

Status

- [TODO]

Increase deterministic persistence batch size:

From:

500

To:

5000

⸻

Requirements

- [TODO] Batch size must be configurable
- [TODO] Flush remaining rows at stream completion
- [TODO] Avoid tiny partial flushes during processing
- [TODO] Optimize for bulk inserts

⸻

4.3 Queue Consumer

Status

- [TODO]

Add lightweight async queue consumer.

⸻

Responsibilities

- [TODO] Pull batches from queue
- [TODO] Persist batch
- [TODO] Handle retry logic
- [TODO] Track failed batches
- [TODO] Log failures
- [TODO] Mark queue item completed

⸻

Important Constraints

- Consumer must remain minimal
- Avoid complex worker abstractions
- Avoid event-driven overengineering
- Keep logic readable

⸻

4.4 Retry Handling

Status

- [TODO]

Persistence failures must retry automatically.

⸻

Requirements

- [TODO] Retry failed persistence batches 3 times
- [TODO] Use exponential backoff
- [TODO] Retry only persistence failures
- [TODO] Preserve failed batch payload during retries

⸻

Retry Strategy

Example:

Attempt Delay
1 immediate
2 1 second
3 2 seconds
4 4 seconds

After max retries:

- log ERROR
- mark batch failed
- continue ingestion pipeline

⸻

4.5 Queue Draining

Status

- [TODO]

Before ingestion completes:

- [TODO] Wait for queue completion
- [TODO] Flush remaining batches
- [TODO] Ensure all persistence promises resolve

⸻

Required Flow

End of Stream
→ Flush remaining rows
→ Wait for queue drain
→ Mark ingestion completed

⸻

4.6 Bulk Persistence Optimization

Status

- [TODO]

Persistence layer must support efficient bulk inserts.

⸻

Requirements

- [TODO] Prefer raw bulk insert queries
- [TODO] Avoid ORM .save() loops
- [TODO] Avoid per-row inserts
- [TODO] Minimize transaction count
- [TODO] Minimize repository overhead

⸻

Important Constraints

- Persistence should happen batch-wise only
- Avoid row-level persistence calls

⸻

4.7 Concurrency Handling

Status

- [TODO]

Queue should support controlled concurrency.

⸻

Requirements

- [TODO] Allow multiple persistence batches simultaneously
- [TODO] Prevent uncontrolled parallelism
- [TODO] Add configurable concurrency limit

⸻

Example

MAX_PERSISTENCE_WORKERS=3

⸻

4.8 Error Handling

Status

- [TODO]

Persistence failures must not terminate ingestion.

⸻

Requirements

- [TODO] Failed batches should not crash pipeline
- [TODO] Continue remaining processing
- [TODO] Log failed persistence batches
- [TODO] Preserve ingestion stability

⸻

Important Constraints

- Do NOT persist errors to DB
- Console logging only

⸻

4.9 Logging

Status

- [TODO]

Queue logging should remain lightweight.

⸻

Required Logs

[INFO] Persistence batch queued (5000 rows)
[INFO] Persistence batch started
[INFO] Persistence batch completed
[WARN] Persistence batch retry #2
[ERROR] Persistence batch failed after retries

⸻

Requirements

- [TODO] Use INFO/WARN/ERROR levels
- [TODO] Use color-encoded console logging
- [TODO] Avoid excessive logs
- [TODO] Log queue drain completion

⸻

4.10 Architecture Requirements

Status

- [TODO]

Architecture must remain clean and minimal.

⸻

Required Structure

Extraction Service
→ orchestration
Helpers
→ deterministic processing
LLM Service
→ enrichment only
Batch Persistence Queue
→ async persistence only
Repositories
→ DB access only

⸻

Important Constraints

- Avoid unnecessary services
- Avoid nested queue abstractions
- Avoid framework-heavy implementations
- Keep queue implementation understandable

⸻

5. Implementation Steps

Queue Infrastructure

- [TODO] 1. Create in-memory batch persistence queue
- [TODO] 2. Add queue item structure
- [TODO] 3. Add async queue consumer
- [TODO] 4. Add configurable batch size
- [TODO] 5. Add configurable concurrency limit
- [TODO] 6. Add queue draining logic

⸻

Persistence Refactor

- [TODO] 7. Increase deterministic batch size to 5000
- [TODO] 8. Refactor inline persistence to queue handoff
- [TODO] 9. Remove blocking await persistence flow
- [TODO] 10. Add bulk insert optimization
- [TODO] 11. Remove row-level persistence calls

⸻

Retry Handling

- [TODO] 12. Add retry mechanism
- [TODO] 13. Add exponential backoff logic
- [TODO] 14. Add retry tracking
- [TODO] 15. Add max retry enforcement

⸻

Logging

- [TODO] 16. Add queue lifecycle logging
- [TODO] 17. Add retry logging
- [TODO] 18. Add queue drain logging

⸻

Finalization

- [TODO] 19. Add queue shutdown handling
- [TODO] 20. Verify ingestion stability
- [TODO] 21. Verify no stream blocking occurs
- [TODO] 22. Add integration tests
- [TODO] 23. Update documentation

⸻

6. Verification Criteria (Tests)

- [TODO] SCENARIO 1: Row processing continues while persistence runs asynchronously.
- [TODO] SCENARIO 2: Deterministic rows batch at 5000 correctly.
- [TODO] SCENARIO 3: Queue receives batches without blocking extraction.
- [TODO] SCENARIO 4: Bulk inserts reduce DB transaction count.
- [TODO] SCENARIO 5: Persistence retries occur automatically on failure.
- [TODO] SCENARIO 6: Exponential backoff delays work correctly.
- [TODO] SCENARIO 7: Failed persistence batches do not terminate ingestion.
- [TODO] SCENARIO 8: Queue drains completely before ingestion completion.
- [TODO] SCENARIO 9: Concurrent persistence workers function correctly.
- [TODO] SCENARIO 10: No row loss occurs during async persistence.
- [TODO] SCENARIO 11: Console logging outputs queue lifecycle correctly.
- [TODO] SCENARIO 12: No DB logging occurs.
- [TODO] SCENARIO 13: Memory usage remains stable during large ingestion.
- [TODO] SCENARIO 14: Throughput improves versus inline persistence.
- [TODO] SCENARIO 15: Existing CRUD functionality remains intact.

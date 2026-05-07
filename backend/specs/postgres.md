PostgreSQL Persistence Integration (TypeORM) - Spec

⸻

1. Goal & Context

- Why: The current system processes extraction jobs and stores data in-memory/repository-level abstractions only, which is insufficient for persistence, auditability, job tracking, extraction history, and scalable querying.
- Goal: Introduce PostgreSQL as the primary persistence layer using TypeORM for extraction jobs, extraction results, extracted records, and error tracking.

⸻

2. Scope & Boundaries

In Scope:

- Add PostgreSQL integration using TypeORM
- Add database configuration module
- Persist:
  - extraction jobs
  - extraction results
  - extracted records
  - extraction errors
- Add TypeORM entities and repositories
- Add migrations support
- Add indexes for common queries
- Add transaction support
- Add connection pooling
- Persist BullMQ job states

Out of Scope:

- Vector databases
- Semantic search
- Frontend changes
- Multi-tenant support
- Analytics/data warehouse pipelines

⸻

3. Constraints & Dependencies

Tech Stack:

- NestJS
- PostgreSQL
- TypeORM
- TypeScript (strict mode)

Queue Dependencies:

- BullMQ
- Redis

Dependencies:

- Existing extraction services
- Existing BullMQ job orchestration
- Centralized logging system
- Centralized error handling system

⸻

4. Technical Requirements

⸻

4.1 Database Configuration

Add Folder:

/src/core/database

Files:

database.module.ts
database.config.ts
typeorm.config.ts

⸻

Environment Variables

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=asset_extraction

⸻

4.2 Suggested Folder Structure

/src
/controllers
/services
/repositories
extraction.repository.ts
extraction-job.repository.ts
extraction-error.repository.ts
/entities
extraction-job.entity.ts
extraction-result.entity.ts
extracted-record.entity.ts
extraction-error.entity.ts
/core
/database
database.module.ts
database.config.ts
typeorm.config.ts
/migrations
/queues
/workers

⸻

4.3 TypeORM Configuration

Use:

TypeOrmModule.forRootAsync()

Requirements:

- connection pooling enabled
- autoLoadEntities enabled
- synchronize = false
- migrations enabled

⸻

4.4 Core Entities

⸻

1. ExtractionJobEntity

ExtractionJobEntity {
id: uuid
fileName: string
fileType: string
status: string
attempts: number
errorMessage?: string
createdAt: Date
updatedAt: Date
completedAt?: Date
}

Purpose:

- queue tracking
- polling
- retries
- auditability

⸻

2. ExtractionResultEntity

ExtractionResultEntity {
id: uuid
jobId: uuid
sourceFile: string
extractionStrategy: string
metadata: jsonb
createdAt: Date
}

Relations:

- many-to-one → ExtractionJobEntity

⸻

3. ExtractedRecordEntity

ExtractedRecordEntity {
id: uuid
extractionResultId: uuid
pageNumber?: number
blockType?: string
confidenceScore?: number
rawText?: string
structuredData: jsonb
provenance: jsonb
createdAt: Date
}

Relations:

- many-to-one → ExtractionResultEntity

⸻

4. ExtractionErrorEntity

ExtractionErrorEntity {
id: uuid
jobId: uuid
errorCode: string
message: string
stackTrace?: string
createdAt: Date
}

Relations:

- many-to-one → ExtractionJobEntity

⸻

4.5 BullMQ + Database Synchronization

Job lifecycle events must persist to PostgreSQL.

Events:

waiting
active
completed
failed
retrying

Example:

- worker starts → update status = active
- retry triggered → increment attempts
- completed → save completedAt

⸻

4.6 Repository Layer Refactor

Replace:

in-memory repositories

With:

TypeORM-backed repositories

Using:

@InjectRepository(Entity)
private readonly repository: Repository<Entity>

⸻

4.7 Indexing Strategy

ExtractionJobEntity

Indexes:

- status
- createdAt
- fileType

⸻

ExtractedRecordEntity

Indexes:

- extractionResultId
- confidenceScore

⸻

ExtractionErrorEntity

Indexes:

- jobId

⸻

4.8 Transaction Support

Critical operations must use transactions.

Examples:

- save extraction result + extracted records
- complete job + persist metadata

Use:

queryRunner.startTransaction()

OR:

dataSource.transaction()

⸻

4.9 Migration Support

Add:

typeorm migration:generate
typeorm migration:run

Requirements:

- version-controlled schema changes
- reproducible local setup

⸻

4.10 Polling Endpoint Improvements

Endpoint:

GET /extractions/jobs/:jobId

Must retrieve:

- persisted job state from PostgreSQL
- retry count
- timestamps
- error state if failed

⸻

4.11 Auditability Requirements

Persist:

- extraction timestamps
- job retries
- extraction strategy
- source file metadata
- structured provenance
- error metadata

⸻

4.12 Future-Proofing

Schema should support:

- reconciliation workflows
- review queue
- confidence scoring
- duplicate detection
- provenance tracking
- delta comparisons

⸻

5. Implementation Steps

- 1. Install PostgreSQL + TypeORM dependencies
- 2. Configure TypeOrmModule
- 3. Create database configuration module
- 4. Create TypeORM entities
- 5. Add entity relationships
- 6. Create migrations setup
- 7. Implement TypeORM repositories
- 8. Refactor existing repositories
- 9. Persist BullMQ job lifecycle states
- 10. Add transactional writes
- 11. Add indexes
- 12. Add integration tests
- 13. Add migration scripts
- 14. Update README with PostgreSQL setup instructions

⸻

6. Verification Criteria (Tests)

- SCENARIO 1: Uploaded files create persisted extraction jobs.
- SCENARIO 2: BullMQ job states persist correctly in PostgreSQL.
- SCENARIO 3: Extraction results persist successfully.
- SCENARIO 4: Extracted records are linked correctly to extraction results.
- SCENARIO 5: Failed jobs persist structured error records.
- SCENARIO 6: Polling endpoint retrieves DB-backed job state.
- SCENARIO 7: Concurrent workers do not exhaust DB connections.
- SCENARIO 8: Transactions rollback correctly on partial failures.
- SCENARIO 9: Indexes improve query performance for polling and retrieval.

⸻

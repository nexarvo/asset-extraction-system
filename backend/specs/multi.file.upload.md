Multi-File Extraction Queue System (BullMQ Orchestration) - Spec

⸻

1. Goal & Context

- Why: The current extraction system processes files synchronously, which is not scalable for multiple large documents (PDF, CSV, XLSX). Financial datasets can be heavy, and processing them inline risks blocking CPU/memory and causing timeouts.
- Goal: Introduce an asynchronous, queue-based ingestion system using BullMQ, where each uploaded file becomes an independent job with retry logic, concurrency control, and traceable execution.

⸻

2. Scope & Boundaries

In Scope:

- Add /extract endpoint supporting multi-file upload (CSV, XLSX, PDF)
- Each file becomes a separate BullMQ job
- Add BullMQ queue + worker system
- Set concurrency to 3 workers
- Add retry policy (max 3 retries per job)
- Add job status tracking (for polling)
- Return job IDs to frontend
- Centralized logging per job
- Error handling per file (not batch failure)
- Support heterogeneous file types in same request

Out of Scope:

- Distributed queue scaling (multi-node workers)
- Real-time WebSocket updates (polling only)
- Database persistence redesign
- Frontend UI changes
- OCR/scanned PDF improvements (already separate layer)

⸻

3. Constraints & Dependencies

Tech Stack:

- NestJS
- BullMQ
- Redis (required for queue backend)
- TypeScript (strict mode)

Queue Constraints:

- Concurrency: 3 jobs processed simultaneously
- Retry policy: maxAttempts = 3
- Backoff strategy: exponential (recommended)
- Each file = independent job

Dependencies:

- Existing extraction services:
  - CSV extraction service
  - XLSX extraction service
  - Digital PDF extraction service
  - OCR pipeline (if applicable)
- Centralized logging service
- Centralized error handling (ApplicationError)

⸻

4. Technical Requirements

⸻

4.1 API Design

Endpoint: /extract

POST /extract

Request:

- Multi-part form data (recommended)

files: File[]

Supported file types:

- CSV
- XLSX
- PDF (digital/scanned handled internally)

⸻

Response:

{
jobs: [
{
jobId: string;
fileName: string;
status: 'queued';
}
]
}

⸻

4.2 Job Processing Model

Each file becomes:

ExtractionJob {
jobId: string;
fileName: string;
fileBuffer: Buffer;
fileType: 'csv' | 'xlsx' | 'pdf';
}

⸻

4.3 Queue Design

Queue Name:

asset-extraction-queue

Worker Configuration:

- Concurrency: 3
- Retry policy:
  - attempts: 3
  - backoff: exponential (e.g. 2s → 4s → 8s)

⸻

4.4 Processing Flow

HTTP Upload (/extract)
↓
Create BullMQ Jobs (1 per file)
↓
Return job IDs immediately
↓
Worker picks jobs (concurrency = 3)
↓
Route by file type:
├── CSV → CSV Extraction Service
├── XLSX → XLSX Extraction Service
├── PDF → PDF Extraction Service
↓
Store result + logs
↓
Update job status

⸻

4.5 Job Status Tracking

Each job must support:

JobStatus {
waiting
active
completed
failed
retrying
}

⸻

4.6 Retry Strategy

- Max retries: 3
- Retry only for:
  - transient errors (IO, parsing failures, memory spikes)
- Do NOT retry:
  - validation errors
  - unsupported file types

⸻

4.7 Logging Requirements

Each job must log:

- job start
- file type
- extraction stage
- completion status
- error stack (if failed)

Logs must include:

jobId
fileName
fileType
timestamp

⸻

4.8 Error Handling

- Each file failure is isolated
- One file failure does NOT fail batch
- Errors stored per job:

{
jobId,
errorCode,
message,
stackTrace
}

⸻

4.9 Suggested Folder Structure (IMPORTANT)

/src
/services
job-dispatcher.service.ts
/queues
extraction.queue.ts
/workers
extraction.worker.ts
/core
config

⸻

4.10 Strategy Pattern (Required Improvement)

Each file type should route through:

IExtractionStrategy {
canHandle(fileType): boolean;
extract(buffer): Promise<ExtractionResult>;
}

Factory:

- selects correct strategy per job

⸻

5. Implementation Steps

- 1. Install and configure BullMQ + Redis
- 2. Create /extract controller for multi-file upload
- 3. Implement Job Dispatcher Service (1 file → 1 job)
- 4. Create Extraction Queue (BullMQ)
- 5. Implement Worker with concurrency = 3
- 6. Implement retry policy (max 3 attempts)
- 7. Create per-file processors (CSV/XLSX/PDF)
- 8. Add strategy factory for file routing
- 9. Implement job status tracking service
- 10. Add structured logging per job lifecycle
- 11. Add error isolation per job
- 12. Add polling endpoint (e.g. /jobs/:jobId)
- 13. Add tests:
  - multiple file upload
  - retry behavior
  - worker concurrency limits
  - job failure isolation
- 14. Update documentation (queue architecture + flow)

⸻

6. Verification Criteria (Tests)

- SCENARIO 1: Multiple files uploaded in single request create separate jobs.
- SCENARIO 2: API returns job IDs immediately without blocking.
- SCENARIO 3: Worker processes max 3 jobs concurrently.
- SCENARIO 4: Failed job is retried up to 3 times.
- SCENARIO 5: One job failure does not affect other jobs.
- SCENARIO 6: Each file type routes to correct processor.
- SCENARIO 7: Job status can be polled using jobId.
- SCENARIO 8: Logs include full job lifecycle metadata.
- SCENARIO 9: System handles mixed file types in single batch.

⸻

Upload & Extract Page — Spec

1. Goal & Context

- Why:
  Analysts need a centralized ingestion interface to upload source documents and trigger the extraction pipeline for asset intelligence processing. This page acts as the entry point into the entire extraction → review → reconciliation workflow.
  Unlike a simple upload page, this system must support:
  - asynchronous extraction jobs
  - large file ingestion
  - concurrent processing
  - streaming backend workflows
  - extraction status visibility
  - resumable/retriable operations
  - scalable Redux-driven state orchestration
- Goal:
  Deliver a scalable Upload & Extract page that:
  - supports multi-file uploads
  - tracks upload lifecycle
  - triggers extraction jobs
  - monitors extraction progress
  - displays extraction states/errors
  - integrates cleanly with Redux Toolkit as the single source of truth
  - follows the established frontend architecture and folder conventions
  - prepares the system for downstream review/reconciliation workflows

⸻

2. Scope & Boundaries

In Scope

- Drag-and-drop upload zone
- Click-to-browse upload support
- Multiple file uploads
- Upload validation
- File queue visualization
- Upload progress tracking
- Extraction job triggering
- Extraction status monitoring
- Extraction polling
- Retry support
- Removal of queued files
- Redux-only business state management
- Reusable component decomposition
- Integration with backend extraction APIs
- Support for CSV/XLSX/PDF ingestion workflows
- Persistent extraction lifecycle state

Out of Scope

- Authentication/authorization
- Asset review UI
- Reconciliation UI
- Delta tracking UI
- Provenance inspection UI
- Real-time websocket updates
- Notifications/email
- OCR visualization
- Advanced filtering/search
- Offline support

⸻

3. Constraints & Dependencies

Tech Stack

- React
- TypeScript (strict mode)
- Redux Toolkit
- React Router
- Axios
- React Testing Library
- Jest/Vitest

⸻

State Management Constraints

Redux Toolkit is the ONLY business/domain state management solution.

Allowed local state:

- drag hover state
- dropdown open/close state
- purely visual transient UI state

Forbidden local state:

- uploaded files
- extraction jobs
- upload progress
- extraction progress
- API response state

⸻

Folder Structure Constraints

Implementation MUST follow:

src/
pages/
components/
hooks/
store/
apis/
services/
types/
constants/
utils/
routes/

Responsibilities must remain separated.

⸻

Dependencies

Backend APIs

Upload File

POST /uploads

Multipart upload endpoint.

Returns:

{
fileId: string;
}

⸻

Create Extraction Job

POST /extraction-jobs

Request:

{
fileIds: string[];
}

Response:

{
jobs: ExtractionJobResponse[];
}

⸻

Get Extraction Job Status

GET /extraction-jobs/:jobId

⸻

Get Multiple Extraction Job Statuses

GET /extraction-jobs/status

Optional batch polling endpoint.

⸻

4. Technical Requirements

Page Responsibilities

The Upload & Extract page must:

- orchestrate upload workflow
- orchestrate extraction workflow
- compose reusable components
- subscribe to Redux state
- remain thin and declarative

The page must NOT:

- call APIs directly
- contain extraction business logic
- contain upload orchestration logic

⸻

Feature-Oriented Structure

Recommended structure:

features/
upload-extraction/
components/
hooks/
services/
store/
types/

This feature module may internally integrate with:

- global store/
- shared components/
- shared apis/

⸻

Redux Store Structure

uploadExtraction.slice.ts

Single feature slice preferred over fragmented upload/extraction slices.

⸻

State Shape

interface UploadExtractionState {
files: UploadFileItem[];
isUploading: boolean;
isTriggeringExtraction: boolean;
pollingActive: boolean;
globalError?: string;
}

⸻

UploadFileItem

interface UploadFileItem {
clientId: string;
file: File;
fileName: string;
fileSize: number;
mimeType: string;
uploadStatus:
| 'queued'
| 'uploading'
| 'uploaded'
| 'upload_failed';
uploadProgress: number;
backendFileId?: string;
extractionJobId?: string;
extractionStatus?:
| 'waiting'
| 'processing'
| 'completed'
| 'failed';
extractionProgress?: number;
extractionError?: string;
uploadError?: string;
createdAt: string;
}

⸻

Why Unified State?

Because:

- upload lifecycle
- extraction lifecycle

belong to the same workflow entity:

uploaded file

Splitting them causes:

- duplicated selectors
- synchronization complexity
- unnecessary cross-slice coupling

⸻

Redux Actions

File Queue Actions

addFiles(files)
removeFile(clientId)
clearFiles()

⸻

Upload Actions

setUploadStarted(clientId)
setUploadProgress(clientId, progress)
setUploadSuccess(clientId, backendFileId)
setUploadFailure(clientId, error)

⸻

Extraction Actions

setExtractionStarted(clientId, jobId)
setExtractionStatus(clientId, status)
setExtractionFailure(clientId, error)
setExtractionProgress(clientId, progress)

⸻

Global Actions

setPollingActive(boolean)
setGlobalError(error)

⸻

Redux Selectors

File Selectors

selectAllFiles
selectQueuedFiles
selectUploadedFiles
selectFailedFiles

⸻

Upload Selectors

selectIsUploading
selectUploadProgress

⸻

Extraction Selectors

selectActiveExtractionJobs
selectCompletedExtractionJobs
selectFailedExtractionJobs
selectIsExtracting
selectAllJobsCompleted

⸻

Derived Selectors

selectCanTriggerExtraction

True when:

- at least one uploaded file exists
- no extraction currently triggering

⸻

API Layer

upload.api.ts

Thin HTTP-only client.

uploadFile(
file: File,
onProgress?: (progress: number) => void
)

⸻

extraction.api.ts

createExtractionJobs(fileIds: string[])
getExtractionJob(jobId: string)
getExtractionJobsStatus(jobIds: string[])

⸻

Service Layer

⸻

uploadExtraction.service.ts

Central orchestration layer.

Responsibilities:

- upload orchestration
- extraction orchestration
- polling orchestration
- retry handling
- dispatch coordination

This service becomes the main workflow coordinator.

⸻

Upload Workflow

Files Selected
↓
Validation
↓
Redux Queue
↓
Upload Files
↓
Upload Status Updates
↓
Backend File IDs Stored

⸻

Extraction Workflow

Uploaded Files
↓
Trigger Extraction Jobs
↓
Store Job IDs
↓
Start Polling
↓
Update Redux Status
↓
Stop Polling When Complete

⸻

Polling Strategy

Polling interval:

EXTRACTION_POLL_INTERVAL_MS = 3000;

Polling should:

- batch status requests when possible
- stop automatically
- cleanup on unmount

⸻

Hooks

⸻

useUploadExtraction.ts

Primary feature hook.

Responsibilities:

- connect selectors
- expose dispatch-bound actions
- expose derived state

Returns:

{
files,
canExtract,
isUploading,
isExtracting,
handleFileSelect,
handleFileDrop,
handleRemoveFile,
handleExtract,
handleRetry,
}

⸻

useExtractionPolling.ts

Responsibilities:

- poll active extraction jobs
- dispatch updates
- cleanup polling lifecycle

⸻

Components

⸻

FileDropZone

Responsibilities:

- drag/drop UI
- file selection
- validation feedback

Must NOT:

- call APIs
- own business state

⸻

UploadQueue

Container for uploaded file rows.

⸻

UploadQueueItem

Displays:

- filename
- file size
- upload status
- extraction status
- progress
- retry/remove actions

⸻

UploadProgressBar

Reusable upload/extraction progress component.

⸻

ExtractionStatusBadge

Displays:

- waiting
- processing
- completed
- failed

⸻

ExtractButton

Responsibilities:

- trigger extraction
- loading state
- disabled logic

⸻

UploadSummaryCard

Optional summary widget.

Displays:

- total files
- completed
- failed
- processing

⸻

Page Structure

UploadExtractPage.tsx

Responsibilities:

- page composition only

Example:

UploadExtractPage
├── UploadSummaryCard
├── FileDropZone
├── UploadQueue
└── ExtractButton

⸻

Validation Rules

⸻

Supported File Types

[
'text/csv',
'application/pdf',
'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

⸻

Max File Size

MAX_FILE_SIZE_MB = 100

⸻

Max Concurrent Uploads

MAX_CONCURRENT_UPLOADS = 3

Aligns with backend extraction concurrency model.

⸻

Error Handling

Errors must be:

- normalized centrally
- stored in Redux
- displayed per-file when possible

Error types:

- validation errors
- upload failures
- extraction failures
- polling failures

⸻

Retry Behavior

Retry should support:

- failed uploads
- failed extraction triggers
- failed extraction jobs

without resetting entire queue.

⸻

Routing

/upload

Primary ingestion route.

⸻

Type Definitions

upload-extraction.types.ts

Contains:

- UploadFileItem
- UploadExtractionState
- status enums
- DTOs

⸻

Constants

upload.constants.ts

MAX_FILE_SIZE_MB
MAX_CONCURRENT_UPLOADS
SUPPORTED_FILE_TYPES

⸻

extraction.constants.ts

EXTRACTION_POLL_INTERVAL_MS

⸻

Architecture Rules

⸻

Rule 1

Pages orchestrate.
They do NOT own business logic.

⸻

Rule 2

Services orchestrate workflows.
APIs remain thin.

⸻

Rule 3

Redux is single source of truth.

⸻

Rule 4

Components remain reusable and presentation-oriented.

⸻

Rule 5

Hooks abstract Redux/service integration.

⸻

Rule 6

All upload/extraction state must survive page rerenders.

⸻

Rule 7

No direct API calls inside components/pages.

⸻

5. Implementation Steps

- 1. Create upload-extraction feature module structure
- 2. Define upload/extraction shared types
- 3. Create Redux slice
- 4. Create Redux selectors
- 5. Register slice in root reducer
- 6. Implement upload API client
- 7. Implement extraction API client
- 8. Implement upload/extraction orchestration service
- 9. Implement polling service logic
- 10. Create useUploadExtraction hook
- 11. Create useExtractionPolling hook
- 12. Build FileDropZone
- 13. Build UploadQueue
- 14. Build UploadQueueItem
- 15. Build UploadProgressBar
- 16. Build ExtractionStatusBadge
- 17. Build ExtractButton
- 18. Build UploadSummaryCard
- 19. Compose UploadExtractPage
- 20. Register application route
- 21. Add slice tests
- 22. Add selector tests
- 23. Add hook tests
- 24. Add service tests
- 25. Add integration tests
- 26. Add documentation

⸻

6. Verification Criteria (Tests)

- SCENARIO 1: Valid files appear in queue correctly.
- SCENARIO 2: Invalid file types are rejected.
- SCENARIO 3: Oversized files are rejected.
- SCENARIO 4: Upload progress updates correctly.
- SCENARIO 5: Upload failures display per-file errors.
- SCENARIO 6: Successful uploads store backend file IDs.
- SCENARIO 7: Extraction jobs are triggered correctly.
- SCENARIO 8: Polling updates extraction statuses correctly.
- SCENARIO 9: Polling stops after all jobs complete.
- SCENARIO 10: Retry works for failed uploads.
- SCENARIO 11: Retry works for failed extraction jobs.
- SCENARIO 12: Redux remains single source of truth.
- SCENARIO 13: Components remain presentation-oriented.
- SCENARIO 14: APIs are only called from services.
- SCENARIO 15: Concurrent uploads respect configured limits.
- SCENARIO 16: Upload/extraction workflows survive rerenders.
- SCENARIO 17: Page remains maintainable with increasing workflow complexity.

## Multi-File Extraction Architecture (CSV/XLSX Focus)

This backend processes multi-file uploads asynchronously using a queue/worker architecture. The key entry point is `POST /api/extractions/extract`, which accepts up to 10 files in one request and supports `csv`, `xls`, `xlsx`, and `pdf`.

### 1) Request Layer (Controller)

- `ExtractionController.extractMultiFile()` validates all uploaded files with `MultiFileValidationPipe`.
- It forwards `{ filename, buffer }[]` to `JobDispatcherService.dispatchFiles(files, sessionId?)`.
- The API immediately returns job tickets (`jobId`, `filename`, `status: waiting`) so the frontend can start polling.

### 2) Dispatch Layer (Queue + DB Pre-creation)

`JobDispatcherService` does three things per file:

1. Creates a `documents` row (ingestion status `PROCESSING`, optional `sessionId`).
2. Creates a `processing_jobs` row (`QUEUED`, linked to the document/session).
3. Pushes a BullMQ job to `asset-extraction-queue` with:
   - `jobId`
   - `filename`
   - `buffer` (base64)
   - `fileType` (derived from extension)

Queue behavior comes from `extraction.queue.ts`:

- 3 retry attempts
- exponential backoff (2s base delay)
- completed jobs removed automatically

### 3) Worker Layer (Async Processing)

`ExtractionWorker` consumes queue jobs with concurrency `3`.

Processing flow:

1. Marks job `RUNNING`.
2. Ensures a document is linked to the job.
3. Selects strategy via `ExtractionStrategyFactory` by `fileType`.
4. Executes extraction strategy with `ExtractionContext` (document id, job id, persistence + LLM services).
5. On success: marks processing job `COMPLETED`.
6. On failure: marks job `FAILED` and stores `errorSummary`.

### 4) Strategy Layer (CSV/XLSX)

- `CsvExtractionStrategy` -> `CsvExtractionService.extractWithProcessor(...)`
- `XlsxExtractionStrategy` -> `XlsxExtractionService.extractWithProcessor(...)`

Both CSV and XLSX use the same pattern:

1. **Sample pass** (up to 20 rows) to infer schema using `SchemaInferenceService`.
2. **Processing pass** over rows through `ExtractionProcessor`.
3. **Batch routing** in `ExtractionProcessor`:
   - Deterministic rows -> persisted via `ExtractionPersistenceService`
   - Ambiguous rows -> sent to LLM enrichment flow, then persisted/reviewed
4. **Flush and stats** returned (`totalRows`, deterministic/ambiguous counts, inferred schema metadata).

### 5) CSV-specific Notes

- Stream-based parsing with `csv-parser` (`processCsvStream`), which is memory-efficient for large files.
- Row validation and parsing are handled by `RowValidationHelper`.
- Row-to-candidate mapping is handled by `AssetMappingHelper`.

### 6) XLSX-specific Notes

- Workbook parsing uses `xlsx` library.
- Header detection is heuristic-based (multiple strategies, fallback included).
- Multi-sheet traversal is supported.
- Backpressure-aware processing path (`processWorkbookWithBackpressure`) is used by `extractWithProcessor` to process rows sequentially/asynchronously without unbounded parallel work.

### 7) Persistence Model (for extracted data)

Extracted row payloads are ultimately stored as `extracted_asset_fields` entries (not one DB table per source row). The row payload is persisted in fields like:

- `rawValue` (serialized row)
- `normalizedValue` (normalized row)
- `sourceRowIndex`
- `sourceSheetName` (for spreadsheets)
- review/extraction metadata

### 8) Frontend Contract

The frontend flow aligns with this architecture:

- `extractionApi.extract(files, sessionId?)` -> returns queued jobs quickly.
- `extractionApi.getJobStatus(jobId)` -> polls job lifecycle (`waiting` -> `processing` -> `completed|failed`).
- `extractionApi.getDocumentsBySession(sessionId)` / `getDocumentsByJobIds(jobIds)` -> resolves document metadata for UI.

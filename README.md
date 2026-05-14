
<img width="2112" height="748" alt="image" src="https://github.com/user-attachments/assets/07b2c84a-ea5f-4a2b-9499-6a9446a12ce1" />

## Architecture
### Backend
I have designed this system to be scalable that can handle multiple files uploads. I am using a producer/consumer architecture with queues so that every file can be processed in background and it does not overwhelm the eventloop. Concurrency is set to 3 files at a time. If something fails then I have added Max_Retries=3, so it will retry 3 times with exponential backoff before failing as task completely. I am streaming the file to the memory which means every rows is streamed one by one which means I am not loading the complete file in memory at once which can overload the memory.

The schema design is very lean. Some noteable tables are `documents`, `extract_asset_fields`, `processing_jobs`. I am storing every row as a separate row in the table which give us granular level of control on if we want to compare changes or do llm inference on ambiguous rows. As we are storing every row of `csv` and `xlsx` so that could be a lot of db calls. Like if we have N number of rows then we will be inserting those N rows into the DB. I have made this efficient by introducting bulk insert. Postgres is a very popular database and it can handle 5000 - 100000 inserts at a time. So I have taken a batch of 5000 just to be safe and don't overload the memory. So, if we have 12K rows in excel file, then 12K / 5K = 3 DB call. Which is negligable than 12K DB calls. 

I have made batching more optimized by handling it async. So I have introduced another queue and I dispatch the 5K batch to the queue so that it can handle DB persistence async. In that way the processing/extraction of file rows does not get interupted. 

#### Inference
For inference I have added schema level inference and ambiguous rows inference. I take first 20 non empty rows and ask llm to infer the schema with types. If somehow LLM fails then I infer deterministically. For ambiguous rows/values I batch 50 rows and process them with LLM. Although this is not complete yet. The frontend of inference is not there yet.

### Frontend
Instead of going to a complex solution like Websocket, I have opted for short polling. So, our `/extract` gets us the queue jobIds and we poll them unitl the status is completed or failed. There are very limited functionalities on frontend as I have mostly worked on making the backend robust and scalable.

### Time Constraint
I have developed this app in 2 days as I did not had a lot of time because of the other professional commitments. I also had a constraint of only using FREE coding tool(not much out there, alot of rate limiting), as I did not had CLAUDE subscription. Lastly, I have created the architecture of project and systems like I would do in production. If I had more time to spend I could improve the code quality alot(I did some cleanup, but putting my thoughts out there). If I estimate, the current architecture supports Fast development to complete the full asignment would take 2-3 more days. And if we are building it for production then we can roll out our production ready V1 in 1 week. That was the thing I kept in mind when building the product which means I gone with the production ready architecture.

#### Upload Screen
<img width="3024" height="1718" alt="image" src="https://github.com/user-attachments/assets/1a987ecc-bca1-49ee-aed9-03225c2e1e46" />

#### Sessions Screen
<img width="3024" height="1720" alt="image" src="https://github.com/user-attachments/assets/b35d678f-4e0c-4c59-abd0-ac28b4518d28" />



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

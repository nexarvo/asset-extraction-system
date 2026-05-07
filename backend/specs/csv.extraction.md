CSV Ingestion Improvements (Streaming + Robust Parsing) - Spec

1. Goal & Context

- Why: The current CSV ingestion implementation loads and parses the entire file in memory using a character-based parser, which limits scalability and introduces performance risks for large datasets (e.g., government or financial CSV exports).
- Goal: Improve CSV ingestion to support streaming-based processing, better correctness guarantees, and stronger validation, while separating parsing from domain mapping for asset extraction.

⸻

2. Scope & Boundaries

- In Scope:
  - Introduce streaming-based CSV parsing
  - Replace full in-memory string parsing with stream processing
  - Improve CSV correctness handling (headers, row validation, edge cases)
  - Separate parsing layer from asset mapping layer
  - Add row-level validation and error handling
  - Improve performance for large files
  - Maintain strict TypeScript structure
- Out of Scope:
  - Changes to PDF or XLSX pipelines
  - Database schema changes
  - Frontend modifications
  - Distributed processing or queueing systems

⸻

3. Constraints & Dependencies

- Tech stack:
  - NestJS
  - TypeScript (strict mode)
  - Node.js Streams
  - CSV parsing library (optional but recommended: csv-parser or fast-csv)
- Security:
  - Memory-safe file processing (no full file buffering)
  - Validation of row structure before processing
- Dependencies:
  - Existing CsvExtractionService
  - Existing ExtractionResult and ExtractedAssetRecord types

⸻

4. Technical Requirements

API / Interface Changes

No API changes required.

Input remains:

AssetFileInput {
filename: string;
mimeType: string;
buffer: Buffer;
}

⸻

New Architecture (Streaming Pipeline)

File Buffer
↓
Stream Reader
↓
CSV Parser (stream-based)
↓
Row Validator
↓
Raw Row Output
↓
Asset Mapping Service (separate layer)
↓
ExtractionResult

⸻

Data Model Improvements

No schema changes required, but internal structure should be extended:

- Introduce intermediate type:

RawCsvRow {
headers: string[];
values: string[];
rowIndex: number;
}

⸻

Business Logic Improvements

1. Streaming CSV Parsing

Replace:

- manual character-based parsing
- full string loading

With:

- stream-based parser

Recommended approach:

- csv-parser OR fast-csv
- or Node.js stream pipeline

⸻

2. Separation of Concerns

Split responsibilities:

CSV Parsing Layer

- Reads stream
- Produces raw rows
- Handles CSV syntax correctness

Mapping Layer (New)

- Converts raw rows → ExtractedAssetRecord
- Handles header normalization
- Applies business rules

⸻

3. Row Validation Layer

Each row must be validated before mapping:

Checks:

- missing columns
- extra columns
- empty rows
- header mismatch
- malformed data

Invalid rows:

- logged
- optionally skipped or flagged

⸻

4. Header Normalization

Improve consistency:

- trim whitespace
- lowercase headers
- deduplicate headers if needed

⸻

5. Error Handling Improvements

- row-level try/catch (not full file failure)
- structured error reporting:
  - row index
  - reason
  - raw data snapshot

Use centralized:

- ApplicationError
- ErrorCode.CsvRowInvalid
- ErrorCode.CsvStreamFailure

⸻

6. Performance Improvements

Replace:

string concatenation loop → O(n²)

With:

stream processing → O(n)

⸻

5. Implementation Steps

- 1. Introduce CSV streaming library (csv-parser or fast-csv)
- 2. Refactor extractDataFromCsv to use streams instead of buffer decoding
- 3. Implement RawCsvRow intermediate structure
- 4. Create CsvRowValidator utility
- 5. Extract mapping logic into separate CsvAssetMapperService
- 6. Add header normalization utility
- 7. Add row-level error handling and logging
- 8. Update ExtractionResult pipeline integration
- 9. Add tests for:
  - streaming ingestion
  - malformed CSV rows
  - large file handling
- 10. Update documentation

⸻

6. Verification Criteria (Tests)

- SCENARIO 1: Large CSV file (>50MB) is processed without memory overflow.
- SCENARIO 2: Streaming parser correctly processes CSV row by row.
- SCENARIO 3: Malformed rows are logged and do not crash entire pipeline.
- SCENARIO 4: Header normalization correctly maps inconsistent column names.
- SCENARIO 5: Row validation detects mismatched column counts.
- SCENARIO 6: Asset mapping service correctly transforms raw rows into structured records.
- SCENARIO 7: Extraction continues even if rows fail (partial success behavior).

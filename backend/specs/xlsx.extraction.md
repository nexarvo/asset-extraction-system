XLSX Extraction Pipeline Improvements (Streaming + Normalization) - Spec

1. Goal & Context

- Why: The current XLSX extraction implementation fully loads and parses entire workbooks into memory using xlsx.utils.sheet_to_json, which limits scalability and introduces correctness risks for large or inconsistent financial datasets.
- Goal: Improve XLSX processing to support memory-efficient row-level processing, schema normalization, validation, and separation of parsing vs domain mapping, aligning it with the overall ingestion architecture.

⸻

2. Scope & Boundaries

- In Scope:
  - Remove full in-memory sheet parsing as final output
  - Introduce row-level processing abstraction
  - Add normalization layer for headers
  - Introduce validation layer for rows
  - Separate parsing from asset extraction logic
  - Improve multi-sheet handling with explicit context
  - Improve memory efficiency for large XLSX files
  - Standardize output structure across CSV/XLSX pipelines
- Out of Scope:
  - PDF extraction changes
  - OCR pipeline changes
  - Database schema modifications
  - Frontend updates
  - Authentication or API changes

⸻

3. Constraints & Dependencies

- Tech stack:
  - NestJS
  - TypeScript (strict mode)
  - xlsx library (kept, but used only for low-level parsing)
  - Node.js
- Security:
  - Prevent memory exhaustion for large Excel files
  - Safe handling of malformed spreadsheets
- Dependencies:
  - Existing XlsxExtractionService
  - Existing ExtractedAssetRecord
  - Centralized logging (AppLoggerService)
  - Centralized error handling (ApplicationError)

⸻

4. Technical Requirements

API / Interface (No Change)

Input remains:

AssetFileInput {
filename: string;
mimeType: string;
buffer: Buffer;
}

Output remains:

ExtractionResult {
sourceFile: string;
fileType: SupportedFileType;
records: ExtractedAssetRecord[];
metadata: ExtractionMetadata;
}

⸻

Data Flow (Improved Architecture)

Workbook Buffer
↓
Sheet Reader (low-level parsing)
↓
Row Iterator (no full JSON conversion)
↓
Header Normalizer
↓
Row Validator
↓
RawRow Output
↓
Asset Mapping Service (domain layer)
↓
ExtractedAssetRecord[]

⸻

Data Model Additions

Introduce intermediate structure:

RawXlsxRow {
sheetName: string;
rowIndex: number;
headers: string[];
values: (string | number | null)[];
}

⸻

Business Logic Improvements

1. Remove Full Sheet JSON Conversion

Replace:

sheet_to_json()

With:

- row-by-row iteration using sheet range parsing

⸻

2. Introduce Row-Level Processing

Each row should be:

- processed independently
- validated before mapping
- enriched with sheet + row context

⸻

3. Header Normalization Layer

Standardize headers:

- trim whitespace
- lowercase normalization
- remove special characters
- optional alias mapping (e.g., “Asset Name” → “asset_name”)

⸻

4. Row Validation Layer

Validate:

- missing columns
- empty rows
- inconsistent row lengths
- invalid numeric values

Invalid rows:

- logged
- optionally skipped or flagged

⸻

5. Multi-Sheet Handling Improvement

Each sheet must be treated as:

- isolated dataset unit

Enhancements:

- maintain sheetName in every row
- avoid silent merging without context
- allow per-sheet validation

⸻

6. Separation of Concerns

Split responsibilities:

XLSX Parsing Layer

- reads workbook structure
- extracts raw rows only
- no business logic

Asset Mapping Layer

- converts raw rows → ExtractedAssetRecord
- applies domain rules
- handles transformation logic

⸻

7. Memory Optimization

Replace:

- full workbook JSON conversion

With:

- incremental row processing

Target behavior:
O(1) \text{ memory per row instead of } O(n) \text{ full sheet loading}

⸻

5. Implementation Steps

- 1. Remove sheet_to_json usage as primary extraction method
- 2. Implement low-level sheet row iterator
- 3. Introduce RawXlsxRow intermediate type
- 4. Create XlsxHeaderNormalizer utility
- 5. Add XlsxRowValidator service
- 6. Extract asset mapping into separate service layer
- 7. Preserve sheet-level metadata in all rows
- 8. Add row-level error handling with logging
- 9. Optimize memory usage for large XLSX files
- 10. Add tests:
  - large workbook handling
  - malformed rows
  - inconsistent headers
  - multi-sheet correctness
- 11. Update documentation for pipeline changes

⸻

6. Verification Criteria (Tests)

- SCENARIO 1: Large XLSX file is processed without memory spikes.
- SCENARIO 2: Rows are processed incrementally instead of full loading.
- SCENARIO 3: Malformed rows do not crash the pipeline.
- SCENARIO 4: Header normalization produces consistent field mappings.
- SCENARIO 5: Multi-sheet files preserve sheet context in all records.
- SCENARIO 6: Row validation detects inconsistent column lengths.
- SCENARIO 7: Asset mapping service correctly transforms raw rows.
- SCENARIO 8: Errors are logged via centralized logger with context.
- SCENARIO 9: Extraction output matches CSV pipeline structure.

XLSX Extraction Pipeline V2 (Streaming + Normalization) - Spec

1. Goal & Context

- Why:
  The current XLSX extraction implementation fully loads and parses entire workbooks into memory using xlsx.utils.sheet_to_json, which limits scalability, increases memory pressure, and introduces correctness risks for large or inconsistent financial datasets. The implementation also lacks row-level processing isolation, transactional persistence orchestration, and standardized ingestion behavior aligned with the CSV extraction pipeline.
- Goal:
  Build a memory-efficient XLSX ingestion pipeline that:
  - processes workbook rows incrementally
  - separates parsing, validation, mapping, and persistence concerns
  - standardizes extraction behavior with the CSV ingestion pipeline
  - supports transactional persistence boundaries
  - preserves sheet-level context and provenance
  - supports partial success behavior
  - extends the shared ExtractionPersistenceService without breaking existing CSV ingestion behavior

⸻

2. Scope & Boundaries

In Scope

- Remove full workbook JSON conversion as primary extraction mechanism
- Introduce row-level workbook processing
- Introduce streaming/incremental row iteration
- Add header normalization layer
- Add row validation layer
- Separate XLSX parsing from asset extraction logic
- Preserve sheet-level context in extraction records
- Improve memory efficiency for large workbooks
- Standardize extraction output structure with CSV pipeline
- Extend shared persistence orchestration
- Add transactional persistence support for XLSX extraction
- Add structured row-level error handling
- Add batch persistence support

Out of Scope

- PDF extraction changes
- OCR pipeline changes
- Reconciliation/canonical asset processing
- Frontend updates
- Queue architecture changes
- Distributed processing
- Database redesign outside extraction-related persistence

⸻

3. Constraints & Dependencies

Tech Stack

- NestJS
- TypeScript (strict mode)
- TypeORM
- PostgreSQL
- Node.js
- xlsx library (low-level parsing only)

Security

- Prevent excessive memory usage for large workbooks
- Safe handling of malformed spreadsheets
- Prevent invalid row persistence
- Structured error handling

Dependencies

- Existing extraction queue/worker pipeline
- Existing XlsxExtractionService
- Existing extraction entities/repositories
- Existing ExtractionPersistenceService
- Existing ApplicationError
- Existing ErrorCode
- Centralized logging (AppLoggerService)

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

Extraction Architecture

Workbook Buffer
↓
Workbook Reader
↓
Sheet Iterator
↓
Row Iterator
↓
Header Normalizer
↓
RawXlsxRow
↓
XlsxRowValidator
↓
XlsxAssetMapperService
↓
ExtractedAssetCandidate
↓
ExtractionPersistenceService
↓
Database

⸻

Data Model

No major schema redesign required.

The XLSX pipeline must reuse:

- extracted asset entities
- extracted field entities
- extraction error entities
- transactional persistence flow

already introduced in the CSV ingestion architecture.

⸻

Intermediate Types

RawXlsxRow

interface RawXlsxRow {
sheetName: string;
rowIndex: number;
headers: string[];
values: (string | number | null)[];
raw: Record<string, unknown>;
}

⸻

ParsedXlsxRow

interface ParsedXlsxRow {
sheetName: string;
rowIndex: number;
data: Record<string, string | number | null>;
}

⸻

ExtractedAssetCandidate

Shared extraction structure across CSV/XLSX pipelines.

interface ExtractedAssetCandidate {
rawAssetName?: string;
fields: ExtractedFieldCandidate[];
sourceRowIndex: number;
sourceSheetName?: string;
overallConfidence?: number;
}

⸻

Business Logic

⸻

1. Remove Full Workbook JSON Conversion

Replace:

sheet_to_json()

as the primary extraction mechanism.

Instead:

- iterate rows incrementally
- process rows independently
- avoid full workbook materialization into JSON

⸻

2. Row-Level Processing

Each row must:

- be processed independently
- preserve sheet context
- support row-level validation
- support row-level error handling

Rows must contain:

- sheet name
- row index
- normalized headers
- raw values

⸻

3. Header Normalization Layer

Introduce reusable normalization logic aligned with CSV ingestion.

Responsibilities:

- trim whitespace
- lowercase headers
- normalize separators
- remove duplicate spacing
- remove special characters
- support alias normalization

Example:

"Asset Name"
→
"asset_name"

Optional aliases:

"asset"
→
"asset_name"

⸻

4. Row Validation Layer

Introduce:

XlsxRowValidator

Responsibilities:

- validate required columns
- detect malformed rows
- detect inconsistent column counts
- validate numeric fields
- detect empty rows

Invalid rows:

- should not fail entire workbook extraction
- should be logged
- should optionally create extraction error records

⸻

5. Multi-Sheet Handling

Each sheet must be treated as an isolated dataset context.

Requirements:

- preserve sheetName on all extracted rows
- avoid silent merging of unrelated sheets
- allow independent validation per sheet
- support skipping empty or unsupported sheets

⸻

6. Separation of Concerns

⸻

XLSX Parsing Layer

Responsibilities:

- read workbook structure
- iterate sheets
- extract raw rows only
- emit normalized row structures

Must NOT:

- persist data
- apply business mapping
- manage transactions

⸻

Asset Mapping Layer

Introduce:

XlsxAssetMapperService

Responsibilities:

- map validated XLSX rows → extracted asset candidates
- apply business/domain mapping rules
- normalize field values
- enrich extraction metadata

Must NOT:

- persist data
- manage transactions

⸻

7. Shared Persistence Layer Integration

The XLSX ingestion pipeline must reuse and extend:

ExtractionPersistenceService

introduced in the CSV ingestion architecture.

⸻

Important Requirement

The persistence layer must remain:

- ingestion-format agnostic
- reusable across CSV/XLSX pipelines
- transactionally consistent

The XLSX implementation must NOT:

- duplicate persistence logic
- introduce separate transaction orchestration
- break existing CSV ingestion behavior

⸻

Persistence Responsibilities

ExtractionPersistenceService must:

- support XLSX-specific metadata
- preserve sheet-level provenance
- persist extracted assets
- persist extracted fields
- persist extraction errors
- support batch persistence
- support rollback on transactional failures

⸻

Transaction Boundary

Transactions must ONLY wrap:

- database persistence operations

Transactions must NOT include:

- workbook parsing
- row iteration
- normalization
- validation
- external service calls

⸻

Repository Constraints

Repositories remain thin CRUD abstractions.

Repositories must NOT:

- orchestrate workflows
- manage transactions
- call other repositories internally

Only:

ExtractionPersistenceService

should coordinate transactional writes.

⸻

8. Batch Persistence

To reduce excessive DB writes:

- persist extracted rows in batches
- avoid row-by-row database inserts
- periodically flush processed row batches

Recommended batch size:

- 100–1000 rows

⸻

9. Partial Success Behavior

Workbook extraction should support partial success.

Requirements:

- malformed rows should not fail entire workbook
- malformed sheets should not necessarily fail entire workbook
- valid rows should continue processing

Example:

Workbook:

- Sheet A → valid
- Sheet B → partially malformed
- Sheet C → empty
  Result:
- valid rows persisted
- invalid rows logged/skipped

⸻

10. Structured Error Handling

Structured row errors must include:

interface XlsxRowError {
sheetName: string;
rowIndex: number;
reason: string;
rawData?: Record<string, unknown>;
}

Use:

- ApplicationError
- ErrorCode.XlsxRowInvalid
- ErrorCode.XlsxParsingFailure

⸻

11. Memory Optimization

The workbook processor must:

- avoid full workbook JSON conversion
- process rows incrementally
- avoid accumulating entire sheets in memory
- clear processed batches after persistence

Target behavior:

O(1) memory per processed row batch

instead of:

O(n) full workbook loading

⸻

12. Output Standardization

CSV and XLSX extraction pipelines must produce:

- identical extraction candidate structures
- shared persistence flow
- shared validation behavior
- shared extraction result contracts

This ensures downstream ingestion stages remain file-format agnostic.

⸻

5. Implementation Steps

- 1. Remove sheet_to_json as the primary extraction mechanism
- 2. Implement low-level workbook/sheet row iterator
- 3. Introduce RawXlsxRow intermediate structure
- 4. Create XLSX header normalization utility
- 5. Create XlsxRowValidator
- 6. Create XlsxAssetMapperService
- 7. Preserve sheet metadata in all extracted rows
- 8. Extend shared ExtractionPersistenceService for XLSX support
- 9. Ensure CSV persistence behavior remains unchanged
- 10. Add transactional persistence support for XLSX extraction
- 11. Add batch persistence flow
- 12. Add row-level structured error handling
- 13. Add malformed sheet handling
- 14. Optimize memory usage for large workbooks
- 15. Add tests for:
  - large workbook handling
  - malformed rows
  - inconsistent headers
  - multi-sheet correctness
  - transactional rollback
  - partial success behavior
- 16. Standardize extraction outputs with CSV pipeline
- 17. Update extraction pipeline integration
- 18. Update documentation

⸻

6. Verification Criteria (Tests)

- SCENARIO 1: Large XLSX files are processed without major memory spikes.
- SCENARIO 2: Rows are processed incrementally instead of full workbook loading.
- SCENARIO 3: Workbook parsing does not materialize entire sheets into memory as JSON.
- SCENARIO 4: Malformed rows do not crash the extraction pipeline.
- SCENARIO 5: Header normalization produces consistent field mappings.
- SCENARIO 6: Multi-sheet files preserve sheet context correctly.
- SCENARIO 7: Validation layer detects malformed row structures.
- SCENARIO 8: Asset mapper correctly transforms rows into extracted asset candidates.
- SCENARIO 9: ExtractionPersistenceService supports XLSX ingestion without breaking CSV ingestion.
- SCENARIO 10: Transactional persistence rolls back failed XLSX persistence operations correctly.
- SCENARIO 11: Batch persistence reduces excessive database writes.
- SCENARIO 12: Partial workbook failures do not prevent valid rows from being persisted.
- SCENARIO 13: Structured extraction errors include sheet and row context.
- SCENARIO 14: CSV and XLSX pipelines produce standardized extraction outputs.

Here is an updated, stronger version of your spec incorporating the missing architectural correctness (layout preservation, structured extraction layer, and clearer separation of responsibilities).

⸻

Digital PDF Extraction Improvement (Layout-Aware Structured Extraction) - Spec

⸻

1. Goal & Context

- Why: The current implementation incorrectly treats PDF buffers as UTF-8 text and applies lossy sanitization + line splitting, which destroys layout structure (tables, columns, headers) and makes financial document extraction unreliable.
- Goal: Replace the current approach with a layout-aware PDF parsing pipeline that preserves positional information, supports structured document modeling, and enables downstream semantic/asset extraction with confidence + provenance tracking.

⸻

2. Scope & Boundaries

- In Scope:
  - Replace raw buffer-to-text conversion with proper PDF parsing (pdfjs-dist preferred)
  - Introduce layout-aware parsing (text items with coordinates)
  - Build structured document model (pages, blocks, text items)
  - Remove all regex-based sanitization and line-splitting logic
  - Introduce block + position-based grouping (not newline-based)
  - Preserve page + positional metadata for auditability
  - Prepare structured output for downstream extraction pipeline
  - Add error handling for malformed PDFs
  - Add logging for parsing progress per page
- Out of Scope:
  - OCR for scanned PDFs (handled separately)
  - XLSX/CSV pipeline changes
  - Frontend changes
  - Database schema changes
  - LLM prompt optimization
  - Deployment / infrastructure concerns

⸻

3. Constraints & Dependencies

- Tech stack:
  - NestJS
  - TypeScript (strict mode)
  - PDF parsing: pdfjs-dist (preferred) or pdf-parse (fallback)
  - Node.js Buffer handling
- Security:
  - Safe handling of large PDFs (memory-aware processing)
  - Avoid full-string materialization where possible
- Dependencies:
  - Existing DigitalPdfExtractionService
  - ExtractionResult, ExtractedAssetRecord
  - Centralized logger service
  - Centralized error handling system

⸻

4. Technical Requirements

API / Interface (No Change)

AssetFileInput {
filename: string;
mimeType: string;
buffer: Buffer;
}
ExtractionResult {
sourceFile: string;
fileType: SupportedFileType;
strategy: PdfExtractionStrategy;
records: ExtractedAssetRecord[];
metadata: ExtractionMetadata;
}

⸻

New Internal Data Model (Improved)

Layout-Aware Model (CRITICAL IMPROVEMENT)

PdfDocument {
pages: PdfPage[];
}
PdfPage {
pageNumber: number;
items: PdfTextItem[];
}
PdfTextItem {
text: string;
x: number;
y: number;
width?: number;
height?: number;
fontSize?: number;
}

Derived Structure Layer

TextBlock {
text: string;
type: 'paragraph' | 'header' | 'table' | 'footer' | 'unknown';
pageNumber: number;
boundingBox?: {
x: number;
y: number;
};
}

⸻

Business Logic Changes

1. Replace Raw UTF-8 Extraction (Critical Fix)

❌ Remove:

buffer.toString('utf8')

✔ Replace with:

- pdfjs-dist document loading
- page-wise extraction of text items

⸻

2. Introduce Layout-Aware PDF Parsing Layer

New function:

parsePdf(buffer): PdfDocument

Responsibilities:

- extract pages
- extract text items with coordinates
- preserve reading order using positional clustering
- avoid flattening text prematurely

⸻

3. Remove Lossy Sanitization

❌ Remove:

- regex character stripping
- whitespace collapsing
- newline-based normalization

✔ Instead:

- preserve raw extracted text
- normalize only inside block formation stage

⸻

4. Replace Line-Based Parsing (Major Fix)

❌ Remove:

text.split("\n")

✔ Replace with:

- spatial clustering of text items
- grouping by:
  - Y-axis proximity (rows)
  - X-axis alignment (columns)

⸻

5. Introduce Block Formation Layer (NEW CRITICAL LAYER)

buildTextBlocks(pages: PdfPage[]): TextBlock[]

Responsibilities:

- group text items into logical blocks
- detect:
  - paragraphs
  - headers (font size / position heuristics)
  - tables (grid alignment detection)
- preserve spatial relationships

⸻

6. Explicit Separation of Concerns

Pipeline must be strictly:

PDF Buffer
→ Layout Parser (pdfjs-dist)
→ Page + TextItem Model
→ Block Builder (spatial grouping)
→ Structured Document Output
→ Downstream Asset Extraction (NOT part of this service)

⸻

7. NO Asset Inference in This Layer

This service must NOT:

- extract assets
- infer values
- assign confidence scores

It ONLY produces:

structured document representation

⸻

8. Preserve Full Auditability

Each extracted unit must retain:

- page number
- coordinates (x/y)
- raw text
- derived block type

⸻

9. Improve Table Awareness (Layout-Based)

Instead of keyword detection:

❌ Remove:

- includes('|')
- includes('\t')

✔ Replace with:

- alignment-based detection using:
  - x-axis clustering
  - consistent row spacing

⸻

5. Implementation Steps

- 1. Replace pdf-parse usage with pdfjs-dist (preferred)
- 2. Implement parsePdf() returning PdfDocument with text items + coordinates
- 3. Remove all UTF-8 string conversion logic
- 4. Implement spatial clustering algorithm for grouping text items
- 5. Build buildTextBlocks() for layout-aware grouping
- 6. Remove all regex-based sanitization logic
- 7. Replace line-based parsing with block-based pipeline
- 8. Ensure service does NOT perform any semantic extraction
- 9. Add structured logging per page parsing
- 10. Add error handling for corrupted PDFs
- 11. Add tests for:
  - multi-column PDFs
  - table-heavy financial reports
  - large PDFs (>50MB)
  - malformed PDFs
- 12. Update documentation to reflect layout-aware architecture

⸻

6. Verification Criteria (Tests)

- SCENARIO 1: PDF is parsed into pages with correct text item coordinates.
- SCENARIO 2: Multi-column layouts preserve spatial ordering.
- SCENARIO 3: Tables are detected using layout grouping (not delimiters).
- SCENARIO 4: No UTF-8 corruption or string-based flattening occurs.
- SCENARIO 5: Line-based splitting is completely removed.
- SCENARIO 6: Large PDFs (>50MB) are processed without memory crash.
- SCENARIO 7: Page + coordinate metadata is preserved in output.
- SCENARIO 8: Corrupted PDFs fail gracefully with structured errors.
- SCENARIO 9: Output contains ONLY structured document data (no asset inference).

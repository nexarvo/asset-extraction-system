Digital PDF Extraction Improvement (Correct Parsing + Structured Extraction) - Spec

1. Goal & Context

- Why: The current implementation incorrectly treats PDF buffers as UTF-8 text and performs naive sanitization and line splitting, which leads to loss of structure, incorrect extraction, and inability to handle financial documents (tables, multi-column layouts, reports).
- Goal: Replace the current approach with a correct PDF parsing + structured extraction pipeline that preserves document structure, supports financial document complexity, and enables downstream asset extraction with confidence and provenance.

⸻

2. Scope & Boundaries

- In Scope:
  - Replace raw buffer-to-text conversion with proper PDF parsing
  - Introduce PDF parsing library integration (pdf-parse or pdfjs-dist)
  - Add structured document representation (pages, blocks, sections)
  - Remove naive UTF-8 conversion and regex sanitization approach
  - Introduce extraction of structured text blocks instead of raw lines
  - Prepare output for downstream asset extraction pipeline
  - Preserve page-level metadata for auditability
- Out of Scope:
  - OCR for scanned PDFs (handled separately)
  - XLSX/CSV pipeline changes
  - Frontend changes
  - Database schema changes
  - LLM prompt optimization
  - Deployment or infrastructure concerns

⸻

3. Constraints & Dependencies

- Tech stack:
  - NestJS
  - TypeScript (strict mode)
  - PDF parsing library:
    - Preferred: pdf-parse OR pdfjs-dist
  - Node.js Buffer handling
- Security:
  - Safe handling of large PDF buffers
  - Prevent memory overflow for large documents
- Dependencies:
  - Existing DigitalPdfExtractionService
  - Existing ExtractionResult and ExtractedAssetRecord
  - Centralized logging service
  - Centralized error handling system

⸻

4. Technical Requirements

API / Interface (No Change)

Input:

AssetFileInput {
filename: string;
mimeType: string;
buffer: Buffer;
}

Output (enhanced internally, same contract externally):

ExtractionResult {
sourceFile: string;
fileType: SupportedFileType;
strategy: PdfExtractionStrategy;
records: ExtractedAssetRecord[];
metadata: ExtractionMetadata;
}

⸻

New Internal Data Model

Introduce structured PDF representation:

PdfDocument {
pages: PdfPage[];
}
PdfPage {
pageNumber: number;
textBlocks: TextBlock[];
}
TextBlock {
text: string;
type: 'paragraph' | 'header' | 'table' | 'footer' | 'unknown';
position?: {
x: number;
y: number;
};
}

⸻

Business Logic Changes

1. Replace Raw UTF-8 Extraction

Remove:

buffer.toString('utf8')

Replace with:

- PDF parsing library extraction

⸻

2. Introduce PDF Parsing Layer

New function:

- parsePdf(buffer): PdfDocument

Responsibilities:

- extract pages
- extract text content per page
- preserve structure if available
- avoid flattening content prematurely

⸻

3. Remove Lossy Text Sanitization

Remove:

- regex-based character stripping
- whitespace collapsing

Instead:

- preserve raw extracted text
- normalize only at block level (if needed)

⸻

4. Structured Block Extraction

Convert parsed PDF into:

- page-based blocks
- logical sections

This enables:

- table detection
- header recognition
- section-based extraction

⸻

5. Replace Line-Based Mapping

Current:

text.split("\n")

Replace with:

- block-based mapping
- page-aware processing
- context-preserving transformation

⸻

6. Prepare for Asset Extraction Layer

This service should ONLY:

- extract structured text
- NOT infer assets

Downstream responsibility:

- asset detection
- value extraction
- confidence scoring

⸻

7. Preserve Auditability

Each extracted block must retain:

- page number
- source text
- block type
- positional metadata (if available)

⸻

5. Implementation Steps

- 1. Replace UTF-8 buffer conversion with PDF parsing library (pdf-parse or pdfjs-dist)
- 2. Implement parsePdf() function returning structured PdfDocument
- 3. Introduce PdfPage and TextBlock data structures
- 4. Remove regex-based sanitization logic
- 5. Replace mapTextToRecords with structured block mapping
- 6. Preserve page-level metadata in extraction result
- 7. Ensure service does NOT perform asset inference
- 8. Add error handling for malformed PDFs
- 9. Add logging for page-level parsing progress
- 10. Add tests for:
  - multi-page PDFs
  - table-heavy PDFs
  - malformed/corrupted PDFs
  - large document handling
- 11. Update documentation for PDF pipeline architecture

⸻

6. Verification Criteria (Tests)

- SCENARIO 1: Valid digital PDF is parsed into structured pages and blocks.
- SCENARIO 2: Multi-page PDFs preserve correct page ordering and metadata.
- SCENARIO 3: Tables and structured sections are not lost during parsing.
- SCENARIO 4: No UTF-8 corruption occurs during extraction.
- SCENARIO 5: Line-based splitting is fully removed from pipeline.
- SCENARIO 6: Large PDFs (>50MB) are processed without memory crashes.
- SCENARIO 7: Extraction output retains page-level provenance information.
- SCENARIO 8: Corrupted PDFs fail gracefully with structured errors.
- SCENARIO 9: Service only returns structured text (no asset inference).

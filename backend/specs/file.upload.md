File Upload & Ingestion System (Multipart) - Spec

1. Goal & Context

- Why: The system needs to support ingestion of heterogeneous document types (CSV, XLS/XLSX, born-digital PDF, scanned PDF) from users via a web frontend in a secure, efficient, and production-like manner. Base64-based uploads are inefficient and not suitable for large file processing or streaming-based systems.
- Goal: Enable secure, scalable, and efficient file uploads using multipart/form-data, ensuring files are streamed/buffered correctly into the backend and passed into the extraction pipeline with proper metadata tracking.

⸻

2. Scope & Boundaries

- In Scope:
  - File upload via multipart/form-data
  - Support for multiple file types:
    - CSV
    - XLS/XLSX
    - PDFs (digital + scanned)
  - NestJS file handling using interceptors (Multer-based)
  - File validation (mime type + basic sanity checks)
  - Conversion into internal AssetFileInput format
  - Passing file buffer into extraction pipeline
  - Basic error handling for invalid uploads
- Out of Scope:
  - Base64-based upload handling
  - Cloud storage integration (S3, GCS, etc.)
  - Authentication/authorization
  - Streaming file processing pipelines
  - Virus scanning / deep file inspection
  - Frontend implementation

⸻

3. Constraints & Dependencies

- Tech stack:
  - NestJS
  - TypeScript (strict mode)
  - Multer (via @nestjs/platform-express)
  - Node.js Buffer handling
- Security:
  - File size limits enforced at middleware level
  - MIME type validation
  - Reject malformed or empty files
- Dependencies:
  - NestJS file interceptor (Multer)
  - Existing extraction services:
    - CSV extraction service
    - XLSX extraction service
    - PDF extraction service

⸻

4. Technical Requirements

API / Interface

Upload Endpoints

POST /extractions/csv
POST /extractions/xlsx
POST /extractions/pdf

Request Format

- Content-Type: multipart/form-data

Example field:

- file: uploaded file (binary stream)

⸻

Internal File Representation

Convert uploaded file into:

AssetFileInput {
filename: string;
mimeType: string;
buffer: Buffer;
}

⸻

Data Model (No Change Required)

- Existing StoredExtraction model remains unchanged
- File ingestion does not require schema changes

⸻

Business Logic

Upload Flow

1. Controller receives multipart file via interceptor
2. File is validated:
   - exists
   - size > 0
   - allowed mime type
3. File converted into AssetFileInput
4. Routed to appropriate extraction service:
   - CSV → CsvExtractionService
   - XLSX → XlsxExtractionService
   - PDF → PdfExtractionService
5. Extraction result passed to repository for persistence

⸻

5. Implementation Steps

- 1. Add Multer-based file upload interceptor in NestJS
- 2. Replace Base64 request DTO with multipart file input
- 3. Implement file validation (size + mime type)
- 4. Convert uploaded file into AssetFileInput
- 5. Update controllers to accept @UploadedFile()
- 6. Ensure correct routing to extraction services
- 7. Add centralized error handling for invalid uploads
- 8. Add logging for upload lifecycle (start, success, failure)
- 9. Update tests for multipart upload flow

⸻

6. Verification Criteria (Tests)

- SCENARIO 1: CSV file uploaded via multipart is successfully parsed and extracted.
- SCENARIO 2: XLS/XLSX file uploaded via multipart is successfully processed.
- SCENARIO 3: PDF file uploaded via multipart is correctly routed to PDF extraction service.
- SCENARIO 4: Invalid file type is rejected with proper error response.
- SCENARIO 5: Empty or corrupted file upload is handled gracefully.
- SCENARIO 6: File buffer is correctly passed into extraction pipeline.

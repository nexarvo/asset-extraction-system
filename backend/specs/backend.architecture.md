Asset Extraction Backend Architecture - Spec

1. Goal & Context

- Why: Build a backend architecture for an asset extraction system capable of handling CSV, XLS/XLSX, born-digital PDFs, and scanned PDFs using a file-based architecture in NestJS.
- Goal: Create a scalable and maintainable backend structure with centralized logging, centralized error handling, strict TypeScript, extraction services, OCR integration, and clean separation of responsibilities.

⸻

2. Scope & Boundaries

- In Scope:
  - File-based backend architecture
  - NestJS backend structure
  - Strict TypeScript configuration
  - Extraction flow for:
    - CSV
    - XLS/XLSX
    - Born-digital PDF
    - Scanned PDF
  - Extraction factory pattern
  - PaddleOCR integration
  - Centralized logging
  - Centralized error handling
  - Error codes structure
  - Repository pattern
  - DTO structure
  - Utility types/interfaces
  - Service layer with micro-function decomposition
  - Try/catch based error handling
- Out of Scope:
  - Frontend implementation
  - Authentication/authorization
  - Deployment/infrastructure
  - AI prompt engineering
  - Database optimization
  - Queue systems
  - Feature-module architecture
  - Cloud OCR services

⸻

3. Constraints & Dependencies

- Tech stack:
  - NestJS
  - TypeScript (strict mode)
  - PaddleOCR
  - Node.js
- Security:
  - Centralized error handling
  - Controlled exception propagation
- Dependencies:
  - PaddleOCR runtime
  - PDF parsing libraries
  - CSV/XLSX parsing libraries

⸻

4. Technical Requirements

API/Interface

Directory Structure

/src
/controllers
/middlewares
/pipes
/services
/repositories
/models
/core
/utils
/dtos
/error-codes

⸻

Extraction Files

/services
extractCSV.ts
extractXLSX.ts
extractPDF.ts
extractDigitalPDF.ts
extractScannedPDF.ts

⸻

Factory Pattern

extractPDF.ts

- Responsible for determining PDF extraction strategy.
- Routes processing to:
  - extractDigitalPDF.ts
  - extractScannedPDF.ts

⸻

Service Structure

Each extraction service should expose a main public function.

Example:

extractDataFromCsv()

Requirements:

- Main function should remain manageable.
- Complex logic should be extracted into smaller private/helper functions.
- Repository calls should happen through repository layer only.

⸻

Types & Interfaces

All shared:

- interfaces
- types
- enums
- utility contracts

Should reside inside:

/utils

⸻

OCR

Use:

- PaddleOCR

Scanned PDF flow should utilize PaddleOCR for OCR extraction.

⸻

Logging

Implement centralized logging.

Requirements:

- Request logging
- Error logging
- Service-level logging
- Structured log format

Shared logging utilities should reside inside:

/core

⸻

Error Handling

Requirements:

- Centralized error handling
- Centralized error codes
- Try/catch usage in service layer
- Standardized error response structure

Directory:

/error-codes

Should include:

- error constants
- error mappings
- reusable application errors

⸻

Data Model

Repository layer should abstract:

- database access
- persistence logic
- retrieval logic

Models should reside inside:

/models

⸻

Business Logic

- Controllers should remain thin.
- Services should contain orchestration logic.
- Repositories should handle persistence only.
- Pipes should handle validation/transformation.
- Middlewares should handle request-level processing.
- Extraction services should delegate large operations into micro-functions.

⸻

5. Implementation Steps

- 1. Setup strict TypeScript configuration
- 2. Create backend directory structure
- 3. Setup centralized logging
- 4. Setup centralized error handling
- 5. Create error codes structure
- 6. Implement DTOs(Just create folder for now)
- 7. Implement repository layer(Just create folder for now)
- 8. Implement extraction services
- 9. Implement PDF extraction factory
- 10. Integrate PaddleOCR(Just create folder and dummy for now)
- 11. Add try/catch handling in services
- 12. Add utility types/interfaces
- 13. Create tests

⸻

6. Verification Criteria (Tests)

- SCENARIO 1: CSV extraction service processes structured CSV files successfully.
- SCENARIO 2: XLS/XLSX extraction service processes spreadsheet files successfully.
- SCENARIO 3: PDF factory correctly routes digital PDFs to digital extraction service.
- SCENARIO 4: PDF factory correctly routes scanned PDFs to OCR extraction service.
- SCENARIO 5: PaddleOCR integration extracts text from scanned PDFs.

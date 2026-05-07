Frontend Project Architecture & Folder Structure - Spec

1. Goal & Context

- Why:
  The frontend application will serve as the analyst/reviewer interface for the Asset Extraction & Reconciliation Platform. As the application grows to support ingestion workflows, extraction review, provenance inspection, validation handling, reconciliation visualization, and delta tracking, the project requires a scalable and maintainable architecture from the beginning.
- Goal:
  Establish a clean, scalable, feature-oriented frontend architecture that:
  - supports long-term maintainability
  - separates concerns clearly
  - standardizes application structure
  - enables scalable state management
  - supports reusable UI components
  - supports testing and future feature expansion
  - aligns with modern React application practices

⸻

2. Scope & Boundaries

In Scope

- Frontend folder structure
- Architectural conventions
- Shared utilities organization
- API layer organization
- Redux store structure
- Component organization
- Hook organization
- Routing/page organization
- Type organization
- Test organization
- Environment/config organization
- Shared constants organization

Out of Scope

- Backend implementation
- API contract implementation
- Authentication flows
- Design system implementation
- CI/CD configuration
- Styling framework decisions
- Component implementation details

⸻

3. Constraints & Dependencies

Tech Stack

- React
- TypeScript (strict mode)
- Redux Toolkit
- React Router
- Axios or Fetch API
- React Query (optional future enhancement)
- Jest/Vitest
- React Testing Library

Security

- No sensitive secrets in frontend code
- Environment-based configuration
- Centralized API error handling

Dependencies

- Backend extraction APIs
- Backend review APIs
- Backend reconciliation APIs

⸻

4. Technical Requirements

⸻

Frontend Architecture Principles

The frontend architecture should follow:

- separation of concerns
- modularity
- feature scalability
- reusable shared UI
- centralized state management
- predictable API communication
- strict typing
- isolated testability

⸻

Recommended Folder Structure

src/
│
├── pages/
├── components/
├── hooks/
├── store/
├── apis/
├── utils/
├── tests/
├── layouts/
├── routes/
├── types/
├── constants/
├── services/
├── providers/
├── assets/
├── styles/
├── config/
└── features/

⸻

Folder Responsibilities

⸻

/pages

Purpose

Contains route-level application pages/screens.

Each page represents:

- a navigable route
- top-level screen composition

Example

pages/
Dashboard/
UploadFiles/
ExtractionReview/
AssetDetails/
ValidationQueue/
ReconciliationReview/

Rules

Pages should:

- orchestrate UI sections
- call hooks/selectors
- compose components

Pages should NOT:

- contain heavy business logic
- contain direct API calls
- contain reusable UI logic

⸻

/components

Purpose

Reusable presentational UI components.

Example

components/
Button/
Modal/
Table/
FileUploader/
AssetCard/
ConfidenceBadge/
ValidationFlag/

Rules

Components should:

- remain reusable
- remain isolated
- receive props
- avoid global state coupling when possible

⸻

/hooks

Purpose

Reusable React hooks.

Example

hooks/
useFileUpload.ts
useExtractionPolling.ts
useDebounce.ts
useAssetFilters.ts

Rules

Hooks should:

- encapsulate reusable stateful logic
- abstract side effects
- avoid UI rendering concerns

⸻

/store

Purpose

Redux Toolkit store configuration and global state management.

Structure

store/
index.ts
rootReducer.ts
slices/
selectors/
middleware/

⸻

slices/

Feature-based Redux slices.

Example:

slices/
extraction.slice.ts
upload.slice.ts
review.slice.ts
assets.slice.ts

⸻

selectors/

Memoized state selectors.

⸻

middleware/

Custom Redux middleware.

Example:

- logging
- analytics
- error handling

⸻

/apis

Purpose

Raw HTTP client/API definitions.

Example

apis/
extraction.api.ts
assets.api.ts
review.api.ts

Rules

API layer should:

- contain HTTP request definitions only
- avoid UI logic
- avoid Redux logic

⸻

/services

Purpose

Application/domain-level orchestration services.

This folder is important and currently missing from your proposed structure.

Why Needed

apis/ should remain thin HTTP clients.

services/ handles:

- orchestration
- transformation
- polling coordination
- caching strategies
- business workflows

Example

services/
extraction.service.ts
review.service.ts
reconciliation.service.ts

⸻

/features

Purpose

Feature-oriented modular grouping.

Useful for scaling large applications.

Example

features/
extraction/
upload/
reconciliation/
review/

Each feature may internally contain:

- components
- hooks
- services
- tests
- slice logic

⸻

Important Note

You may initially use:

- global folders

and gradually migrate toward:

- feature-oriented modules

as the application grows.

⸻

/utils

Purpose

Pure reusable utility/helper functions.

Example

utils/
formatCurrency.ts
normalizeHeaders.ts
calculateConfidence.ts

Rules

Utilities should:

- be framework-independent
- contain no side effects
- remain deterministic

⸻

/types

Purpose

Shared TypeScript types/interfaces.

Example

types/
extraction.types.ts
asset.types.ts
api.types.ts

Rules

Avoid:

- duplicated interface definitions
- inline anonymous types everywhere

⸻

/constants

Purpose

Application-wide constants/enums.

Example

constants/
routes.ts
api.constants.ts
validation.constants.ts

⸻

/routes

Purpose

Centralized route definitions.

Example

routes/
AppRoutes.tsx
ProtectedRoute.tsx

⸻

/layouts

Purpose

Shared application layouts.

Example

layouts/
MainLayout.tsx
DashboardLayout.tsx

⸻

/providers

Purpose

Application-level providers/wrappers.

Example

providers/
ReduxProvider.tsx
ThemeProvider.tsx
QueryProvider.tsx

⸻

/config

Purpose

Environment/configuration management.

Example

config/
env.ts
api.config.ts

⸻

/styles

Purpose

Global styling structure.

Example

styles/
globals.css
variables.css

⸻

/assets

Purpose

Static frontend assets.

Example

assets/
icons/
images/
logos/

⸻

/tests

Purpose

Shared/global testing utilities.

Example

tests/
setup.ts
mocks/
fixtures/
utils/

⸻

Architecture Rules

⸻

Rule 1 — Separation of Concerns

Avoid mixing:

- UI
- API logic
- business orchestration
- state management

inside the same files.

⸻

Rule 2 — API Layer Must Stay Thin

apis/
should ONLY:

- send HTTP requests
- receive responses

No orchestration logic.

⸻

Rule 3 — Reusable Components First

Avoid:

pages/UploadPage.tsx

containing 1000+ lines of UI logic.

Extract reusable components.

⸻

Rule 4 — Feature Scalability

Architecture should support:

- extraction workflows
- reconciliation workflows
- review queues
- provenance inspection
- delta tracking

without folder chaos.

⸻

Rule 5 — Shared Typing

All API/domain contracts should be strongly typed.

Avoid:

any

throughout the application.

⸻

Rule 6 — Centralized Error Handling

API errors should:

- be normalized centrally
- avoid duplicated toast/error logic

⸻

Rule 7 — Testability

Business logic should remain:

- isolated
- testable
- deterministic

⸻

Suggested Initial Architecture

For your assignment scope, this is probably the best balance:

src/
pages/
components/
hooks/
store/
apis/
services/
utils/
types/
constants/
routes/
layouts/
tests/
config/

This keeps:

- simplicity
- scalability
- interview readability

without overengineering.

⸻

5. Implementation Steps

- 1. Create base src/ architecture
- 2. Add folder-level README/conventions if needed
- 3. Configure TypeScript path aliases
- 4. Configure Redux Toolkit store structure
- 5. Add centralized API client
- 6. Add base service layer structure
- 7. Add shared type definitions
- 8. Add route organization
- 9. Add provider architecture
- 10. Add testing utilities structure
- 11. Configure environment/config management
- 12. Add shared constants structure
- 13. Add reusable layout structure
- 14. Add linting/import organization rules
- 15. Document architecture conventions

⸻

6. Verification Criteria (Tests)

- SCENARIO 1: Pages remain isolated from raw API implementation details.
- SCENARIO 2: Shared components are reusable across multiple pages.
- SCENARIO 3: Redux state remains modular and feature-oriented.
- SCENARIO 4: API request logic is centralized in the apis/ layer.
- SCENARIO 5: Business orchestration logic resides in services/.
- SCENARIO 6: Shared hooks encapsulate reusable stateful behavior.
- SCENARIO 7: Type definitions are reusable across the application.
- SCENARIO 8: Folder structure remains maintainable as features scale.
- SCENARIO 9: Global configuration is centralized and environment-aware.
- SCENARIO 10: Test utilities support isolated component/service testing.

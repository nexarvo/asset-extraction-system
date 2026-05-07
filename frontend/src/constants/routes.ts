export const ROUTES = {
  HOME: '/',
  UPLOAD: '/upload',
  DOCUMENTS: '/documents',
  DASHBOARD: '/dashboard',
  EXTRACTION_REVIEW: '/extraction-review',
  ASSET_DETAILS: '/assets/:id',
  VALIDATION_QUEUE: '/validation-queue',
  RECONCILIATION: '/reconciliation',
  RECONCILIATION_DETAILS: '/reconciliation/:id',
  SETTINGS: '/settings',
} as const;

export type RouteKey = keyof typeof ROUTES;
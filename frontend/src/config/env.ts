export const env = {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME || 'Asset Extraction System',
  VITE_ENABLE_DEBUG: import.meta.env.VITE_ENABLE_DEBUG === 'true',
};
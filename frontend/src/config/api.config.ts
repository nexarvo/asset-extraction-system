import { env } from './env';

export const apiConfig = {
  baseURL: env.VITE_API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
};
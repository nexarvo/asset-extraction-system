import { registerAs } from '@nestjs/config';

export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  OLLAMA = 'ollama',
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  openai?: {
    apiKey: string;
  };
  anthropic?: {
    apiKey: string;
  };
  google?: {
    apiKey: string;
  };
  ollama?: {
    baseUrl: string;
  };
  timeout: number;
  maxRetries: number;
}

export const LLM_CONFIG_KEY = 'llm';

export const llmConfig = registerAs(LLM_CONFIG_KEY, () => ({
  provider: (process.env.LLM_PROVIDER as LLMProvider) || LLMProvider.OPENAI,
  model: process.env.LLM_MODEL || 'gpt-4.1',
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY || '',
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  },
  timeout: parseInt(process.env.LLM_TIMEOUT || '30000', 10),
  maxRetries: parseInt(process.env.LLM_MAX_RETRIES || '3', 10),
}));

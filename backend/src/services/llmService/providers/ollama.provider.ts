import { Injectable } from '@nestjs/common';
import type { LLMProvider } from '../interfaces/llm-provider.interface';
import type { LLMConfig } from '../../../core/config/llm.config';

@Injectable()
export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;

  constructor(config: LLMConfig) {
    this.baseUrl = config.ollama?.baseUrl || 'http://localhost:11434';
    this.model = config.model;
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        format: schema ? 'json' : undefined,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${error}`);
    }

    const data = (await response.json()) as { response: string };
    const text = data.response;

    if (!text) {
      throw new Error('Empty response from Ollama');
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error('Failed to parse Ollama response as JSON');
    }
  }
}

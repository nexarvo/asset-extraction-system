import { Injectable } from '@nestjs/common';
import { LLMProvider } from '../interfaces/llm-provider.interface';
import { LLMConfig } from '../../../core/config/llm.config';

@Injectable()
export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(private config: LLMConfig) {
    this.apiKey = config.anthropic?.apiKey || '';
    this.model = config.model;
    this.baseUrl = 'https://api.anthropic.com/v1';
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema?: unknown,
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        ...(schema ? {
          metadata: { schema: JSON.stringify(schema) },
        } : {}),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json() as { content: { text: string }[] };
    const text = data.content[0]?.text;

    if (!text) {
      throw new Error('Empty response from Anthropic');
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error('Failed to parse Anthropic response as JSON');
    }
  }
}
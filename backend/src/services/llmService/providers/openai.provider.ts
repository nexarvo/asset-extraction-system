import { Injectable } from '@nestjs/common';
import type { LLMProvider } from '../interfaces/llm-provider.interface';
import type { LLMConfig } from '../../../core/config/llm.config';

@Injectable()
export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: LLMConfig) {
    this.apiKey = config.openai?.apiKey || '';
    this.model = config.model;
    this.baseUrl = 'https://api.openai.com/v1';
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema?: unknown,
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: schema ? { type: 'json_object' } : undefined,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    try {
      return JSON.parse(content) as T;
    } catch {
      throw new Error('Failed to parse OpenAI response as JSON');
    }
  }
}

import { Injectable } from '@nestjs/common';
import type { LLMProvider } from '../interfaces/llm-provider.interface';
import type { LLMConfig } from '../../../core/config/llm.config';

@Injectable()
export class GoogleProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: LLMConfig) {
    this.apiKey = config.google?.apiKey || '';
    this.model = config.model;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema?: unknown,
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Google API key not configured');
    }

    const modelName = this.model.startsWith('gemini')
      ? this.model
      : `gemini-2.0-flash`;

    const response = await fetch(
      `${this.baseUrl}/models/${modelName}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            ...(schema
              ? {
                  responseSchema: schema,
                }
              : {}),
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API error: ${error}`);
    }

    const data = (await response.json()) as {
      candidates: { content: { parts?: { text: string }[] }[] }[];
    };
    const text = data.candidates[0]?.content?.[0]?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Empty response from Google');
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error('Failed to parse Google response as JSON');
    }
  }
}

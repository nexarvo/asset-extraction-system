import { Injectable } from '@nestjs/common';
import type { LLMProvider } from '../interfaces/llm-provider.interface';
import type { LLMConfig } from '../../../core/config/llm.config';
import { createLogger } from '../../../helpers/console-logger.helper';

@Injectable()
export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private logger = createLogger('OpenAIProvider');

  constructor(config: LLMConfig) {
    this.apiKey = config.openai?.apiKey || '';
    this.model = config.model;
    this.baseUrl = 'https://api.openai.com/v1';
    
    this.logger.info('OpenAIProvider initialized', {
      hasApiKey: !!this.apiKey,
      apiKeyPrefix: this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'none',
      model: this.model,
    });
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema?: unknown,
  ): Promise<T> {
    this.logger.info('generateStructuredOutput called', {
      promptLength: prompt.length,
      hasSchema: !!schema,
    });

    if (!this.apiKey) {
      this.logger.error('OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    this.logger.info('Calling OpenAI API', {
      model: this.model,
      endpoint: `${this.baseUrl}/chat/completions`,
    });

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

    this.logger.info('OpenAI API response received', {
      status: response.status,
      statusText: response.statusText,
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error('OpenAI API error', {
        status: response.status,
        error: error.substring(0, 500),
      });
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

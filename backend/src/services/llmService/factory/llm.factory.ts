import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMProvider } from '../interfaces/llm-provider.interface';
import { OpenAIProvider } from '../providers/openai.provider';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { GoogleProvider } from '../providers/google.provider';
import { OllamaProvider } from '../providers/ollama.provider';
import { LLMConfig, LLMProvider as ProviderEnum } from '../../../core/config/llm.config';

@Injectable()
export class LLMFactory {
  constructor(private configService: ConfigService) {}

  createProvider(): LLMProvider {
    const config = this.configService.get<LLMConfig>('llm');
    
    if (!config) {
      throw new Error('LLM configuration not found');
    }

    switch (config.provider) {
      case ProviderEnum.OPENAI:
        return new OpenAIProvider(config);
      case ProviderEnum.ANTHROPIC:
        return new AnthropicProvider(config);
      case ProviderEnum.GOOGLE:
        return new GoogleProvider(config);
      case ProviderEnum.OLLAMA:
        return new OllamaProvider(config);
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  }
}
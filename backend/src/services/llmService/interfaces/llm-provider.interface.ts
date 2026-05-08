export interface LLMProvider {
  generateStructuredOutput<T>(
    prompt: string,
    schema?: unknown,
  ): Promise<T>;
}
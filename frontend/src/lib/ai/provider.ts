import { AIProvider } from './types';
import { GeminiProvider } from './gemini-provider';

let defaultProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!defaultProvider) {
    defaultProvider = new GeminiProvider();
  }
  return defaultProvider;
}

export function setAIProvider(provider: AIProvider | null): void {
  defaultProvider = provider;
}

export * from './types';
export * from './errors';

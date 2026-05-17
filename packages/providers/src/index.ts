import type { Provider } from '@akw/db';
import type { ProviderAdapter } from './types.js';
import { openaiAdapter } from './openai.js';
import { anthropicAdapter } from './anthropic.js';
import { googleAdapter } from './google.js';
import { deepgramAdapter } from './deepgram.js';

const ADAPTERS: Record<Provider, ProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  google: googleAdapter,
  deepgram: deepgramAdapter,
};

export function getAdapter(provider: Provider): ProviderAdapter {
  return ADAPTERS[provider];
}

export * from './types.js';
export * from './pricing.js';

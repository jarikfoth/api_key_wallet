/**
 * Hardcoded pricing table (USD per 1M tokens, or per minute for audio).
 * Numbers are approximate as of mid-2026. Treat costs as best-effort estimates.
 * For sub-cent precision we use floats here; DB stores numeric(12,4) cents.
 */

type LlmRate = { in: number; out: number }; // $ per 1M tokens
type AudioRate = { perMinute: number };

const OPENAI: Record<string, LlmRate> = {
  'gpt-4o': { in: 2.5, out: 10 },
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4-turbo': { in: 10, out: 30 },
  'gpt-3.5-turbo': { in: 0.5, out: 1.5 },
  'o1': { in: 15, out: 60 },
  'o1-mini': { in: 3, out: 12 },
};

const ANTHROPIC: Record<string, LlmRate> = {
  'claude-opus-4-7': { in: 15, out: 75 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 0.8, out: 4 },
  'claude-3-5-sonnet-latest': { in: 3, out: 15 },
  'claude-3-5-haiku-latest': { in: 0.8, out: 4 },
  'claude-3-opus-latest': { in: 15, out: 75 },
};

const GOOGLE: Record<string, LlmRate> = {
  'gemini-1.5-pro': { in: 1.25, out: 5 },
  'gemini-1.5-flash': { in: 0.075, out: 0.3 },
  'gemini-2.0-flash': { in: 0.1, out: 0.4 },
  'gemini-2.0-flash-exp': { in: 0.1, out: 0.4 },
};

const DEEPGRAM: Record<string, AudioRate> = {
  'nova-2': { perMinute: 0.0043 },
  'nova-3': { perMinute: 0.0043 },
  'enhanced': { perMinute: 0.0145 },
  'base': { perMinute: 0.0125 },
};

function fallback(model: string | null, table: Record<string, LlmRate>): LlmRate {
  if (!model) return { in: 0, out: 0 };
  // Try exact, then prefix match.
  if (model in table) return table[model]!;
  for (const k of Object.keys(table)) {
    if (model.startsWith(k)) return table[k]!;
  }
  return { in: 0, out: 0 };
}

export function costForLlm(args: {
  provider: 'openai' | 'anthropic' | 'google';
  model: string | null;
  promptTokens: number;
  completionTokens: number;
}): number {
  const table =
    args.provider === 'openai' ? OPENAI : args.provider === 'anthropic' ? ANTHROPIC : GOOGLE;
  const rate = fallback(args.model, table);
  // $ per 1M tokens → cents per token
  const inCents = (rate.in / 1_000_000) * 100;
  const outCents = (rate.out / 1_000_000) * 100;
  return args.promptTokens * inCents + args.completionTokens * outCents;
}

export function costForDeepgram(args: { model: string | null; durationSeconds: number }): number {
  if (!args.model) return 0;
  let rate: AudioRate | undefined;
  if (args.model in DEEPGRAM) rate = DEEPGRAM[args.model];
  else
    for (const k of Object.keys(DEEPGRAM)) {
      if (args.model.startsWith(k)) {
        rate = DEEPGRAM[k];
        break;
      }
    }
  if (!rate) return 0;
  const minutes = args.durationSeconds / 60;
  return minutes * rate.perMinute * 100; // cents
}

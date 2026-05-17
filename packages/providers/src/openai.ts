import type { ProviderAdapter, ForwardRequest, ForwardResult, MeteringResult } from './types.js';
import { tapStream, readSseChunks, parseSseData } from './stream-tap.js';
import { costForLlm } from './pricing.js';

const OPENAI_BASE = 'https://api.openai.com';

export const openaiAdapter: ProviderAdapter = {
  name: 'openai',

  extractRequestedModel(body) {
    if (body && typeof body === 'object' && 'model' in body) {
      const m = (body as { model?: unknown }).model;
      return typeof m === 'string' ? m : null;
    }
    return null;
  },

  async forward({ req, subpath, rootKey }: ForwardRequest): Promise<ForwardResult> {
    const url = OPENAI_BASE + subpath + (new URL(req.url).search ?? '');

    // Clone request, swap auth header, ensure include_usage for streaming chat/completions
    const headers = new Headers(req.headers);
    headers.set('Authorization', `Bearer ${rootKey}`);
    headers.delete('host');

    let bodyToSend: BodyInit | null = null;
    let isStreaming = false;
    let modelHint: string | null = null;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const text = await req.text();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          isStreaming = Boolean(parsed?.stream);
          modelHint = typeof parsed?.model === 'string' ? parsed.model : null;
          if (isStreaming) {
            // Force include_usage so we can meter streamed responses
            parsed.stream_options = { ...(parsed.stream_options ?? {}), include_usage: true };
          }
          bodyToSend = JSON.stringify(parsed);
          headers.set('Content-Type', 'application/json');
          headers.set('Content-Length', String(new TextEncoder().encode(bodyToSend).length));
        } catch {
          bodyToSend = text;
        }
      }
    }

    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: bodyToSend,
      // @ts-expect-error duplex required by undici/Workers when streaming bodies
      duplex: 'half',
    });

    if (!upstream.body) {
      return {
        response: new Response(null, {
          status: upstream.status,
          headers: upstream.headers,
        }),
        metering: Promise.resolve(zeroMetering(modelHint)),
      };
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    if (isStreaming && contentType.includes('text/event-stream')) {
      const { toClient, toMeter } = tapStream(upstream.body);
      const metering = (async (): Promise<MeteringResult> => {
        let promptTokens = 0;
        let completionTokens = 0;
        let model = modelHint;
        for await (const chunk of readSseChunks(toMeter)) {
          for (const obj of parseSseData(chunk)) {
            const o = obj as {
              model?: string;
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };
            if (o.model) model = o.model;
            if (o.usage) {
              promptTokens = o.usage.prompt_tokens ?? promptTokens;
              completionTokens = o.usage.completion_tokens ?? completionTokens;
            }
          }
        }
        return {
          model,
          promptTokens,
          completionTokens,
          audioSeconds: null,
          costCents: costForLlm({
            provider: 'openai',
            model,
            promptTokens,
            completionTokens,
          }),
        };
      })();
      return {
        response: new Response(toClient, {
          status: upstream.status,
          headers: upstream.headers,
        }),
        metering,
      };
    }

    // Non-streaming JSON: read body, extract usage, return as-is.
    const buf = await upstream.arrayBuffer();
    let model = modelHint;
    let promptTokens = 0;
    let completionTokens = 0;
    try {
      const parsed = JSON.parse(new TextDecoder().decode(buf)) as {
        model?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      if (parsed.model) model = parsed.model;
      promptTokens = parsed.usage?.prompt_tokens ?? 0;
      completionTokens = parsed.usage?.completion_tokens ?? 0;
    } catch {
      /* opaque body */
    }
    return {
      response: new Response(buf, { status: upstream.status, headers: upstream.headers }),
      metering: Promise.resolve({
        model,
        promptTokens,
        completionTokens,
        audioSeconds: null,
        costCents: costForLlm({ provider: 'openai', model, promptTokens, completionTokens }),
      }),
    };
  },
};

function zeroMetering(model: string | null): MeteringResult {
  return {
    model,
    promptTokens: 0,
    completionTokens: 0,
    audioSeconds: null,
    costCents: 0,
  };
}

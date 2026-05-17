import type { ProviderAdapter, ForwardRequest, ForwardResult, MeteringResult } from './types.js';
import { tapStream, readSseChunks, parseSseData } from './stream-tap.js';
import { costForLlm } from './pricing.js';

const ANTHROPIC_BASE = 'https://api.anthropic.com';

export const anthropicAdapter: ProviderAdapter = {
  name: 'anthropic',

  extractRequestedModel(body) {
    if (body && typeof body === 'object' && 'model' in body) {
      const m = (body as { model?: unknown }).model;
      return typeof m === 'string' ? m : null;
    }
    return null;
  },

  async forward({ req, subpath, rootKey }: ForwardRequest): Promise<ForwardResult> {
    const url = ANTHROPIC_BASE + subpath + (new URL(req.url).search ?? '');
    const headers = new Headers(req.headers);
    headers.set('x-api-key', rootKey);
    headers.delete('authorization');
    headers.delete('host');
    if (!headers.has('anthropic-version')) {
      headers.set('anthropic-version', '2023-06-01');
    }

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
      // @ts-expect-error duplex required by Workers/undici
      duplex: 'half',
    });

    if (!upstream.body) {
      return {
        response: new Response(null, { status: upstream.status, headers: upstream.headers }),
        metering: Promise.resolve({
          model: modelHint,
          promptTokens: 0,
          completionTokens: 0,
          audioSeconds: null,
          costCents: 0,
        }),
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
              type?: string;
              message?: {
                model?: string;
                usage?: { input_tokens?: number; output_tokens?: number };
              };
              usage?: { input_tokens?: number; output_tokens?: number };
            };
            if (o.message?.model) model = o.message.model;
            if (o.message?.usage) {
              promptTokens = o.message.usage.input_tokens ?? promptTokens;
              completionTokens = o.message.usage.output_tokens ?? completionTokens;
            }
            if (o.usage) {
              // message_delta event includes incremental output_tokens
              if (o.usage.input_tokens != null) promptTokens = o.usage.input_tokens;
              if (o.usage.output_tokens != null) completionTokens = o.usage.output_tokens;
            }
          }
        }
        return {
          model,
          promptTokens,
          completionTokens,
          audioSeconds: null,
          costCents: costForLlm({
            provider: 'anthropic',
            model,
            promptTokens,
            completionTokens,
          }),
        };
      })();
      return {
        response: new Response(toClient, { status: upstream.status, headers: upstream.headers }),
        metering,
      };
    }

    const buf = await upstream.arrayBuffer();
    let model = modelHint;
    let promptTokens = 0;
    let completionTokens = 0;
    try {
      const parsed = JSON.parse(new TextDecoder().decode(buf)) as {
        model?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      if (parsed.model) model = parsed.model;
      promptTokens = parsed.usage?.input_tokens ?? 0;
      completionTokens = parsed.usage?.output_tokens ?? 0;
    } catch {
      /* opaque */
    }
    return {
      response: new Response(buf, { status: upstream.status, headers: upstream.headers }),
      metering: Promise.resolve({
        model,
        promptTokens,
        completionTokens,
        audioSeconds: null,
        costCents: costForLlm({ provider: 'anthropic', model, promptTokens, completionTokens }),
      }),
    };
  },
};

import type { ProviderAdapter, ForwardRequest, ForwardResult, MeteringResult } from './types.js';
import { tapStream, readSseChunks, parseSseData } from './stream-tap.js';
import { costForLlm } from './pricing.js';

const GOOGLE_BASE = 'https://generativelanguage.googleapis.com';

export const googleAdapter: ProviderAdapter = {
  name: 'google',

  extractRequestedModel(_body) {
    return null;
  },

  async forward({ req, subpath, rootKey }: ForwardRequest): Promise<ForwardResult> {
    // Gemini uses the model name in the URL path: /v1beta/models/<model>:generateContent
    const modelMatch = subpath.match(/\/models\/([^:/]+):/);
    const modelHint = modelMatch ? modelMatch[1]! : null;
    const isStreaming = subpath.includes(':streamGenerateContent');

    // Auth via header. Drop any inbound auth header.
    const headers = new Headers(req.headers);
    headers.set('x-goog-api-key', rootKey);
    headers.delete('authorization');
    headers.delete('host');

    const url = GOOGLE_BASE + subpath + (new URL(req.url).search ?? '');

    let bodyToSend: BodyInit | null = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      bodyToSend = await req.text();
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
    // Gemini streams via SSE when ?alt=sse, otherwise concatenated JSON.
    if (isStreaming && contentType.includes('text/event-stream')) {
      const { toClient, toMeter } = tapStream(upstream.body);
      const metering = (async (): Promise<MeteringResult> => {
        let promptTokens = 0;
        let completionTokens = 0;
        let model = modelHint;
        for await (const chunk of readSseChunks(toMeter)) {
          for (const obj of parseSseData(chunk)) {
            const o = obj as {
              modelVersion?: string;
              usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
            };
            if (o.modelVersion) model = o.modelVersion;
            if (o.usageMetadata) {
              promptTokens = o.usageMetadata.promptTokenCount ?? promptTokens;
              completionTokens = o.usageMetadata.candidatesTokenCount ?? completionTokens;
            }
          }
        }
        return {
          model,
          promptTokens,
          completionTokens,
          audioSeconds: null,
          costCents: costForLlm({
            provider: 'google',
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
        modelVersion?: string;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      if (parsed.modelVersion) model = parsed.modelVersion;
      promptTokens = parsed.usageMetadata?.promptTokenCount ?? 0;
      completionTokens = parsed.usageMetadata?.candidatesTokenCount ?? 0;
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
        costCents: costForLlm({ provider: 'google', model, promptTokens, completionTokens }),
      }),
    };
  },
};

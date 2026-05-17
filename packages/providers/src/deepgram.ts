import type { ProviderAdapter, ForwardRequest, ForwardResult, MeteringResult } from './types.js';
import { costForDeepgram } from './pricing.js';

const DEEPGRAM_BASE = 'https://api.deepgram.com';

export const deepgramAdapter: ProviderAdapter = {
  name: 'deepgram',

  extractRequestedModel(_body) {
    return null;
  },

  async forward({ req, subpath, rootKey }: ForwardRequest): Promise<ForwardResult> {
    const reqUrl = new URL(req.url);
    const url = DEEPGRAM_BASE + subpath + reqUrl.search;

    const headers = new Headers(req.headers);
    headers.set('Authorization', `Token ${rootKey}`);
    headers.delete('host');

    let bodyToSend: BodyInit | null = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      bodyToSend = req.body; // pass audio bytes through
    }

    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: bodyToSend,
      // @ts-expect-error duplex required when forwarding streaming body
      duplex: 'half',
    });

    if (!upstream.body) {
      return {
        response: new Response(null, { status: upstream.status, headers: upstream.headers }),
        metering: Promise.resolve({
          model: null,
          promptTokens: null,
          completionTokens: null,
          audioSeconds: null,
          costCents: 0,
        }),
      };
    }

    // Deepgram prerecorded /v1/listen returns JSON with metadata.duration (seconds).
    const buf = await upstream.arrayBuffer();
    let duration = 0;
    let model: string | null = reqUrl.searchParams.get('model');
    try {
      const parsed = JSON.parse(new TextDecoder().decode(buf)) as {
        metadata?: { duration?: number; model_info?: { name?: string } };
      };
      duration = parsed.metadata?.duration ?? 0;
      if (parsed.metadata?.model_info?.name) model = parsed.metadata.model_info.name;
    } catch {
      /* opaque body — e.g. WebSocket upgrade, /projects, etc. */
    }

    const cost = costForDeepgram({ model, durationSeconds: duration });

    const metering: MeteringResult = {
      model,
      promptTokens: null,
      completionTokens: null,
      audioSeconds: duration > 0 ? duration : null,
      costCents: cost,
    };

    return {
      response: new Response(buf, { status: upstream.status, headers: upstream.headers }),
      metering: Promise.resolve(metering),
    };
  },
};

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getAdapter, type Provider } from '@akw/providers';
import type { Env } from './env.js';
import { extractVirtualKey, lookupVirtualKey } from './auth.js';
import { decryptRootKeyForVirtual } from './vault.js';
import { recordUsage, isOverBudget, isModelAllowed } from './meter.js';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'] }));

app.get('/', (c) =>
  c.json({
    name: 'akw-proxy',
    version: '0.0.1',
    docs: 'https://wallet.your-domain/docs',
  }),
);

const VALID_PROVIDERS = new Set<Provider>(['openai', 'anthropic', 'google', 'deepgram']);

app.all('/:provider/*', async (c) => {
  const start = Date.now();
  const provider = c.req.param('provider') as Provider;

  if (!VALID_PROVIDERS.has(provider)) {
    return c.json({ error: 'unknown_provider', provider }, 404);
  }

  const virtualKey = extractVirtualKey(c.req.raw);
  if (!virtualKey) {
    return c.json(
      { error: 'missing_virtual_key', hint: 'Pass akw_live_* in Authorization or x-api-key.' },
      401,
    );
  }

  const vk = await lookupVirtualKey(c.env, virtualKey);
  if (!vk) {
    return c.json({ error: 'invalid_or_revoked_key' }, 401);
  }

  if (vk.provider !== provider) {
    return c.json(
      {
        error: 'provider_mismatch',
        key_provider: vk.provider,
        requested: provider,
      },
      403,
    );
  }

  if (isOverBudget(vk)) {
    return c.json({ error: 'budget_exceeded' }, 429);
  }

  // Parse body once to peek at model (for allowlist) — adapter will re-parse if needed
  const adapter = getAdapter(provider);
  let requestedModel: string | null = null;
  let bodyForAdapter: Request = c.req.raw;
  if (c.req.method === 'POST' || c.req.method === 'PUT' || c.req.method === 'PATCH') {
    const ct = c.req.header('content-type') ?? '';
    if (ct.includes('application/json')) {
      try {
        const text = await c.req.raw.clone().text();
        if (text) {
          const parsed = JSON.parse(text) as unknown;
          requestedModel = adapter.extractRequestedModel(parsed);
          // Rebuild the request so adapter can read body again.
          bodyForAdapter = new Request(c.req.raw.url, {
            method: c.req.method,
            headers: c.req.raw.headers,
            body: text,
          });
        }
      } catch {
        /* not JSON or unreadable — let adapter handle */
      }
    }
  }

  if (!isModelAllowed(vk, requestedModel)) {
    return c.json(
      {
        error: 'model_not_allowed',
        requested: requestedModel,
        allowed: vk.model_allowlist,
      },
      403,
    );
  }

  // Decrypt the root key.
  const rootKey = await decryptRootKeyForVirtual(c.env, vk.root_key_id);
  if (!rootKey) {
    return c.json({ error: 'root_key_unavailable' }, 503);
  }

  // Sub-path = everything after `/:provider`
  const fullPath = new URL(c.req.url).pathname;
  const subpath = fullPath.replace(new RegExp(`^/${provider}`), '') || '/';

  let result;
  try {
    result = await adapter.forward({
      req: bodyForAdapter,
      subpath,
      rootKey: rootKey.plaintext,
    });
  } catch (e) {
    console.error('adapter forward failed', e);
    return c.json({ error: 'upstream_failure', detail: String(e) }, 502);
  }

  // Schedule metering after the response completes (don't block returning to client).
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const m = await result.metering;
        await recordUsage({
          env: c.env,
          virtualKey: vk,
          metering: m,
          status: result.response.status,
          latencyMs: Date.now() - start,
        });
      } catch (e) {
        console.error('recordUsage failed', e);
      }
    })(),
  );

  return result.response;
});

export default app;

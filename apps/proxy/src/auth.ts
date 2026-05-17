/**
 * Virtual-key authentication for the proxy.
 *
 * Accepts the virtual key from:
 *   - Authorization: Bearer akw_live_...
 *   - x-api-key: akw_live_...    (Anthropic-style)
 *   - Authorization: Token akw_live_...    (Deepgram-style)
 */

import { sha256Hex } from '@akw/crypto';
import {
  createServiceClient,
  getVirtualKeyByHash,
  type VirtualKey,
} from '@akw/db';
import type { Env } from './env.js';

export function extractVirtualKey(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (auth) {
    const m =
      auth.match(/^Bearer\s+(akw_live_[A-Za-z0-9_]+)/i) ??
      auth.match(/^Token\s+(akw_live_[A-Za-z0-9_]+)/i);
    if (m) return m[1]!;
  }
  const xkey = req.headers.get('x-api-key');
  if (xkey?.startsWith('akw_live_')) return xkey;
  const xgoog = req.headers.get('x-goog-api-key');
  if (xgoog?.startsWith('akw_live_')) return xgoog;
  // Google sometimes uses ?key=... in URL
  const url = new URL(req.url);
  const k = url.searchParams.get('key');
  if (k?.startsWith('akw_live_')) return k;
  return null;
}

export async function lookupVirtualKey(
  env: Env,
  virtualKey: string,
): Promise<VirtualKey | null> {
  const hash = await sha256Hex(virtualKey);
  const db = createServiceClient({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const row = await getVirtualKeyByHash(db, hash);
  if (!row) return null;
  if (row.revoked_at) return null;
  return row;
}

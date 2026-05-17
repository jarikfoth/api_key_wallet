/**
 * After the upstream response has streamed (or completed) we:
 *   1. Atomically increment the virtual key's spend; if it would exceed cap,
 *      the row update returns null and we just record the event but mark it.
 *   2. Insert a usage_events row.
 */

import {
  createServiceClient,
  insertUsageEvent,
  tryConsumeBudget,
} from '@akw/db';
import type { MeteringResult } from '@akw/providers';
import type { VirtualKey } from '@akw/db';
import type { Env } from './env.js';

export async function recordUsage(args: {
  env: Env;
  virtualKey: VirtualKey;
  metering: MeteringResult;
  status: number;
  latencyMs: number;
}): Promise<void> {
  const { env, virtualKey, metering, status, latencyMs } = args;
  const db = createServiceClient({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (metering.costCents > 0) {
    try {
      await tryConsumeBudget(db, virtualKey.id, metering.costCents);
    } catch (e) {
      console.error('try_consume_budget failed', e);
    }
  }

  await insertUsageEvent(db, {
    virtual_key_id: virtualKey.id,
    user_id: virtualKey.user_id,
    vendor_app_id: virtualKey.vendor_app_id,
    provider: virtualKey.provider,
    model: metering.model,
    prompt_tokens: metering.promptTokens,
    completion_tokens: metering.completionTokens,
    audio_seconds: metering.audioSeconds,
    cost_cents: metering.costCents,
    status,
    latency_ms: latencyMs,
  });
}

/** Pre-flight check: is the virtual key over its monthly cap? */
export function isOverBudget(vk: VirtualKey): boolean {
  if (vk.budget_cents_per_month == null) return false;
  return vk.current_period_spend_cents >= vk.budget_cents_per_month;
}

/** Pre-flight: is the requested model in the allowlist (if one is set)? */
export function isModelAllowed(vk: VirtualKey, model: string | null): boolean {
  if (!vk.model_allowlist || vk.model_allowlist.length === 0) return true;
  if (!model) return true; // No model to check (e.g. some endpoints don't take one)
  return vk.model_allowlist.includes(model);
}

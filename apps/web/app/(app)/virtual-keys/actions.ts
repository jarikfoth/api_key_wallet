'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentUser, getServiceSupabase } from '@/lib/supabase/server';
import { generateVirtualKey } from '@/lib/keys';
import {
  PROVIDERS,
  type Provider,
  createVirtualKey,
  getRootKeyByProvider,
  revokeVirtualKey,
  logAudit,
} from '@akw/db';

const createSchema = z.object({
  provider: z.enum(PROVIDERS as [Provider, ...Provider[]]),
  label: z.string().min(1).max(64),
  budgetCentsPerMonth: z
    .string()
    .optional()
    .transform((v) => (v && v !== '' ? Number(v) : null))
    .pipe(z.number().int().min(0).max(100_000_00).nullable()), // up to $100k cap
  modelAllowlist: z
    .string()
    .optional()
    .transform((v) =>
      v && v.trim() !== ''
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : null,
    ),
});

export async function createVirtualKeyAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const parsed = createSchema.safeParse({
    provider: formData.get('provider'),
    label: String(formData.get('label') ?? '').trim(),
    budgetCentsPerMonth: formData.get('budgetCentsPerMonth') ?? undefined,
    modelAllowlist: formData.get('modelAllowlist') ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { provider, label, budgetCentsPerMonth, modelAllowlist } = parsed.data;

  const service = getServiceSupabase();
  const root = await getRootKeyByProvider(service, user.id, provider);
  if (!root) {
    return {
      ok: false as const,
      error: `Add a ${provider} root key first.`,
    };
  }

  const newKey = await generateVirtualKey(provider);
  await createVirtualKey(service, {
    user_id: user.id,
    root_key_id: root.id,
    vendor_app_id: null,
    provider,
    prefix: newKey.prefix,
    key_hash: newKey.hash,
    label,
    model_allowlist: modelAllowlist,
    budget_cents_per_month: budgetCentsPerMonth,
  });
  await logAudit(service, {
    user_id: user.id,
    action: 'virtual_key.created',
    metadata: { provider, label, has_budget: budgetCentsPerMonth != null },
  });
  revalidatePath('/virtual-keys');
  return { ok: true as const, secret: newKey.full };
}

export async function revokeVirtualKeyAction(virtualKeyId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const service = getServiceSupabase();
  const { data } = await service
    .from('virtual_keys')
    .select('user_id')
    .eq('id', virtualKeyId)
    .maybeSingle();
  if (!data || data.user_id !== user.id) {
    return { ok: false as const, error: 'Not found' };
  }
  await revokeVirtualKey(service, virtualKeyId);
  await logAudit(service, {
    user_id: user.id,
    action: 'virtual_key.revoked',
    metadata: { virtual_key_id: virtualKeyId },
  });
  revalidatePath('/virtual-keys');
  return { ok: true as const };
}

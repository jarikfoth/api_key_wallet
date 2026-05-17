'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentUser, getServiceSupabase } from '@/lib/supabase/server';
import { storeRootKey } from '@/lib/vault';
import { PROVIDERS, type Provider, deleteRootKey, logAudit } from '@akw/db';

const upsertSchema = z.object({
  provider: z.enum(PROVIDERS as [Provider, ...Provider[]]),
  apiKey: z.string().min(8).max(512),
  label: z.string().max(64).optional(),
});

export async function upsertRootKeyAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const parsed = upsertSchema.safeParse({
    provider: formData.get('provider'),
    apiKey: String(formData.get('apiKey') ?? '').trim(),
    label: (formData.get('label') as string | null) || undefined,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  await storeRootKey(user.id, parsed.data.provider, parsed.data.apiKey, parsed.data.label);
  await logAudit(getServiceSupabase(), {
    user_id: user.id,
    action: 'root_key.upserted',
    metadata: { provider: parsed.data.provider },
  });
  revalidatePath('/keys');
  return { ok: true as const };
}

export async function deleteRootKeyAction(rootKeyId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const service = getServiceSupabase();
  // Verify ownership before deleting (defense-in-depth — RLS would also block).
  const { data } = await service
    .from('root_keys')
    .select('user_id, provider')
    .eq('id', rootKeyId)
    .maybeSingle();
  if (!data || data.user_id !== user.id) {
    return { ok: false as const, error: 'Not found' };
  }
  await deleteRootKey(service, rootKeyId);
  await logAudit(service, {
    user_id: user.id,
    action: 'root_key.deleted',
    metadata: { provider: data.provider },
  });
  revalidatePath('/keys');
  return { ok: true as const };
}

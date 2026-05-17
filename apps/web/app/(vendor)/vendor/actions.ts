'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCurrentUser, getServiceSupabase } from '@/lib/supabase/server';
import { generateVendorCredentials } from '@/lib/keys';
import {
  createVendorApp,
  logAudit,
  PROVIDERS,
  type Provider,
} from '@akw/db';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

const createSchema = z.object({
  name: z.string().min(2).max(80),
  homepage_url: z.string().url().optional().or(z.literal('')),
  description: z.string().max(280).optional().or(z.literal('')),
  redirect_uris: z
    .string()
    .min(1)
    .transform((s) =>
      s
        .split(/[\n,]+/)
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url()).min(1)),
  allowed_scopes: z
    .array(z.enum(PROVIDERS as [Provider, ...Provider[]]))
    .min(1),
  logo_url: z.string().url().optional().or(z.literal('')),
});

export async function createVendorAppAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const scopes = formData.getAll('allowed_scopes') as Provider[];

  const parsed = createSchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    homepage_url: (formData.get('homepage_url') as string | null) || '',
    description: (formData.get('description') as string | null) || '',
    redirect_uris: String(formData.get('redirect_uris') ?? ''),
    allowed_scopes: scopes,
    logo_url: (formData.get('logo_url') as string | null) || '',
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const creds = await generateVendorCredentials();
  const service = getServiceSupabase();
  const inserted = await createVendorApp(service, {
    owner_user_id: user.id,
    name: parsed.data.name,
    slug: slugify(parsed.data.name) + '-' + Math.random().toString(36).slice(2, 6),
    client_id: creds.clientId,
    client_secret_hash: creds.clientSecretHash,
    redirect_uris: parsed.data.redirect_uris,
    allowed_scopes: parsed.data.allowed_scopes,
    logo_url: parsed.data.logo_url || null,
    homepage_url: parsed.data.homepage_url || null,
    description: parsed.data.description || null,
    // Auto-approve in MVP. Add a manual approval queue once we have abuse.
    approved_at: new Date().toISOString(),
  });
  await logAudit(service, {
    user_id: user.id,
    action: 'vendor_app.created',
    metadata: { vendor_app_id: inserted.id, name: inserted.name },
  });
  revalidatePath('/vendor');
  return {
    ok: true as const,
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    appId: inserted.id,
  };
}

'use server';

import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase/server';
import { logAudit } from '@akw/db';

const emailSchema = z.string().email().max(320);

export async function joinWaitlistAction(formData: FormData) {
  const parsed = emailSchema.safeParse(String(formData.get('email') ?? '').trim());
  if (!parsed.success) {
    return { ok: false as const, error: 'Please enter a valid email' };
  }
  const service = getServiceSupabase();
  await logAudit(service, {
    user_id: null,
    action: 'waitlist.signup',
    metadata: { email: parsed.data },
  });
  return { ok: true as const };
}

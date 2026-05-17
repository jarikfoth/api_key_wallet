'use client';

import { createBrowserClient } from '@supabase/ssr';
import { env } from '../env';

export function getBrowserSupabase() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}

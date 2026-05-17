/**
 * Hand-rolled DB types matching supabase/migrations/20260514000000_init.sql.
 * Replace with `supabase gen types typescript` output once the project is wired up.
 */

export type Provider = 'openai' | 'anthropic' | 'google' | 'deepgram';
export const PROVIDERS: Provider[] = ['openai', 'anthropic', 'google', 'deepgram'];

export interface UserDek {
  user_id: string;
  wrapped_dek: string; // base64
  dek_nonce: string; // base64
  mek_version: number;
  created_at: string;
}

export interface RootKey {
  id: string;
  user_id: string;
  provider: Provider;
  encrypted_key: string; // base64
  key_nonce: string; // base64
  label: string | null;
  created_at: string;
  rotated_at: string | null;
}

export interface VendorApp {
  id: string;
  owner_user_id: string | null;
  name: string;
  slug: string;
  client_id: string;
  client_secret_hash: string;
  redirect_uris: string[];
  allowed_scopes: Provider[];
  logo_url: string | null;
  homepage_url: string | null;
  description: string | null;
  created_at: string;
  approved_at: string | null;
}

/** Public-safe subset, exposed via the `vendor_apps_public` view. */
export interface VendorAppPublic {
  id: string;
  name: string;
  slug: string;
  client_id: string;
  redirect_uris: string[];
  allowed_scopes: Provider[];
  logo_url: string | null;
  homepage_url: string | null;
  description: string | null;
}

export interface VirtualKey {
  id: string;
  user_id: string;
  root_key_id: string;
  vendor_app_id: string | null;
  provider: Provider;
  prefix: string;
  key_hash: string;
  label: string;
  model_allowlist: string[] | null;
  budget_cents_per_month: number | null;
  current_period_spend_cents: number;
  current_period_started_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface OAuthAuthorization {
  id: string;
  vendor_app_id: string;
  user_id: string;
  code: string;
  code_challenge: string;
  code_challenge_method: 'S256';
  redirect_uri: string;
  scopes: Provider[];
  state: string | null;
  virtual_key_ids: string[] | null;
  consumed_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface UsageEvent {
  id: string;
  virtual_key_id: string;
  user_id: string;
  vendor_app_id: string | null;
  ts: string;
  provider: Provider;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  audio_seconds: number | null;
  cost_cents: number | null;
  status: number;
  latency_ms: number | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  ts: string;
}

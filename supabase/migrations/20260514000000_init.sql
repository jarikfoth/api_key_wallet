-- =============================================================================
-- API Key Wallet — initial schema
-- =============================================================================
-- Envelope-encrypted vault for AI provider API keys, with OAuth 2.0 + PKCE
-- for vendor integrations.
-- =============================================================================

-- pgcrypto for gen_random_uuid + digest()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- user_dek: per-user data encryption key, wrapped by the app-wide MEK
-- ---------------------------------------------------------------------------
create table public.user_dek (
  user_id        uuid primary key references auth.users on delete cascade,
  wrapped_dek    bytea not null,
  dek_nonce      bytea not null,
  mek_version    int not null default 1,
  created_at     timestamptz not null default now()
);

alter table public.user_dek enable row level security;

-- A user can read their own DEK row (the wrapped bytes are meaningless without MEK)
create policy "user_dek: self read" on public.user_dek
  for select using (auth.uid() = user_id);
-- Inserts/updates go through service role only.

-- ---------------------------------------------------------------------------
-- root_keys: encrypted root API keys for each provider, per user
-- ---------------------------------------------------------------------------
create table public.root_keys (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  provider        text not null check (provider in ('openai','anthropic','google','deepgram')),
  encrypted_key   bytea not null,
  key_nonce       bytea not null,
  label           text,
  created_at      timestamptz not null default now(),
  rotated_at      timestamptz,
  unique (user_id, provider)
);

create index root_keys_user_idx on public.root_keys (user_id);

alter table public.root_keys enable row level security;

-- Users can SELECT their own rows (sees encrypted bytes only, useless without DEK)
create policy "root_keys: self read" on public.root_keys
  for select using (auth.uid() = user_id);
-- Mutations only via service role (so the server can encrypt before writing)

-- ---------------------------------------------------------------------------
-- vendor_apps: registered vendor (third-party app) integrations
-- ---------------------------------------------------------------------------
create table public.vendor_apps (
  id                  uuid primary key default gen_random_uuid(),
  owner_user_id       uuid references auth.users on delete cascade,
  name                text not null,
  slug                text unique not null,
  client_id           text unique not null,
  client_secret_hash  text not null,
  redirect_uris       text[] not null,
  allowed_scopes      text[] not null,
  logo_url            text,
  homepage_url        text,
  description         text,
  created_at          timestamptz not null default now(),
  approved_at         timestamptz
);

create index vendor_apps_owner_idx on public.vendor_apps (owner_user_id);
create index vendor_apps_client_id_idx on public.vendor_apps (client_id);

alter table public.vendor_apps enable row level security;

-- Owner can manage their own vendor apps
create policy "vendor_apps: owner all" on public.vendor_apps
  for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

-- Public read of the safe subset of fields (used by /authorize to show vendor info on consent)
create view public.vendor_apps_public as
  select id, name, slug, client_id, redirect_uris, allowed_scopes, logo_url, homepage_url, description
  from public.vendor_apps
  where approved_at is not null;

grant select on public.vendor_apps_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- virtual_keys: per-user, per-vendor proxy keys
-- ---------------------------------------------------------------------------
create table public.virtual_keys (
  id                            uuid primary key default gen_random_uuid(),
  user_id                       uuid not null references auth.users on delete cascade,
  root_key_id                   uuid not null references public.root_keys on delete cascade,
  vendor_app_id                 uuid references public.vendor_apps on delete set null,
  provider                      text not null,
  prefix                        text not null,
  key_hash                      text not null unique,
  label                         text not null,
  model_allowlist               text[],
  budget_cents_per_month        int,
  current_period_spend_cents    bigint not null default 0,
  current_period_started_at     timestamptz not null default now(),
  revoked_at                    timestamptz,
  created_at                    timestamptz not null default now()
);

create index virtual_keys_user_idx on public.virtual_keys (user_id);
create index virtual_keys_root_idx on public.virtual_keys (root_key_id);
create index virtual_keys_vendor_idx on public.virtual_keys (vendor_app_id);
create index virtual_keys_hash_idx on public.virtual_keys (key_hash);

alter table public.virtual_keys enable row level security;

create policy "virtual_keys: self read" on public.virtual_keys
  for select using (auth.uid() = user_id);
create policy "virtual_keys: self revoke" on public.virtual_keys
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- oauth_authorizations: pending + consumed authorization codes for OAuth flow
-- ---------------------------------------------------------------------------
create table public.oauth_authorizations (
  id                      uuid primary key default gen_random_uuid(),
  vendor_app_id           uuid not null references public.vendor_apps on delete cascade,
  user_id                 uuid not null references auth.users on delete cascade,
  code                    text unique not null,
  code_challenge          text not null,
  code_challenge_method   text not null check (code_challenge_method = 'S256'),
  redirect_uri            text not null,
  scopes                  text[] not null,
  state                   text,
  virtual_key_ids         uuid[],
  consumed_at             timestamptz,
  expires_at              timestamptz not null,
  created_at              timestamptz not null default now()
);

create index oauth_auth_user_idx on public.oauth_authorizations (user_id);
create index oauth_auth_code_idx on public.oauth_authorizations (code);
create index oauth_auth_expires_idx on public.oauth_authorizations (expires_at);

alter table public.oauth_authorizations enable row level security;
-- All access via service role; users see their authorizations through aggregated views only.
create policy "oauth_authorizations: self read" on public.oauth_authorizations
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- usage_events: metadata-only record of every proxied request
-- DELIBERATELY NO prompt/response columns — only stats.
-- ---------------------------------------------------------------------------
create table public.usage_events (
  id                  uuid primary key default gen_random_uuid(),
  virtual_key_id      uuid not null references public.virtual_keys on delete cascade,
  user_id             uuid not null,
  vendor_app_id       uuid,
  ts                  timestamptz not null default now(),
  provider            text not null,
  model               text,
  prompt_tokens       int,
  completion_tokens   int,
  audio_seconds       numeric(10,2),
  cost_cents          numeric(12,4),
  status              int not null,
  latency_ms          int
);

create index usage_events_user_ts_idx on public.usage_events (user_id, ts desc);
create index usage_events_vkey_ts_idx on public.usage_events (virtual_key_id, ts desc);
create index usage_events_vendor_ts_idx on public.usage_events (vendor_app_id, ts desc);

alter table public.usage_events enable row level security;

create policy "usage_events: self read" on public.usage_events
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- audit_log: security-sensitive actions
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,
  action        text not null,
  metadata      jsonb,
  ip            inet,
  user_agent    text,
  ts            timestamptz not null default now()
);

create index audit_log_user_ts_idx on public.audit_log (user_id, ts desc);

alter table public.audit_log enable row level security;

create policy "audit_log: self read" on public.audit_log
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Atomic budget increment (single round-trip from the Worker)
-- Returns the new spend value, or NULL if the cap would be exceeded.
-- ---------------------------------------------------------------------------
create or replace function public.try_consume_budget(
  p_virtual_key_id uuid,
  p_cost_cents numeric
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_spend bigint;
  v_cap int;
begin
  update public.virtual_keys
    set current_period_spend_cents = current_period_spend_cents + (p_cost_cents * 100)::bigint
    where id = p_virtual_key_id
      and revoked_at is null
      and (budget_cents_per_month is null
           or current_period_spend_cents + (p_cost_cents * 100)::bigint <= budget_cents_per_month)
    returning current_period_spend_cents, budget_cents_per_month
    into v_new_spend, v_cap;
  return v_new_spend; -- NULL if no row updated (revoked or budget exceeded)
end;
$$;

grant execute on function public.try_consume_budget(uuid, numeric) to service_role;

-- ---------------------------------------------------------------------------
-- Cleanup helper: delete expired oauth_authorizations (cron from a Supabase edge fn later)
-- ---------------------------------------------------------------------------
create or replace function public.purge_expired_oauth_codes() returns void
language sql security definer set search_path = public as $$
  delete from public.oauth_authorizations where expires_at < now() - interval '5 minutes';
$$;

grant execute on function public.purge_expired_oauth_codes() to service_role;

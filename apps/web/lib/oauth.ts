/**
 * OAuth 2.0 + PKCE helpers (server-side).
 */

import 'server-only';
import type { Provider } from '@akw/db';

const VALID_PROVIDERS: Provider[] = ['openai', 'anthropic', 'google', 'deepgram'];

export interface AuthorizeQuery {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  code_challenge: string;
  code_challenge_method: string;
  state: string | null;
}

export interface AuthorizeQueryValidation {
  ok: true;
  scopes: Provider[];
  state: string | null;
}

export type AuthorizeError =
  | 'invalid_request'
  | 'unsupported_response_type'
  | 'unsupported_grant_type'
  | 'invalid_client'
  | 'invalid_grant'
  | 'invalid_redirect_uri'
  | 'invalid_scope'
  | 'invalid_pkce'
  | 'expired_code'
  | 'code_already_used'
  | 'server_error';

/** Validate the parsed query params from /authorize. */
export function parseAuthorizeParams(url: URL):
  | { ok: true; q: AuthorizeQuery }
  | { ok: false; error: AuthorizeError; description: string } {
  const get = (k: string) => url.searchParams.get(k);
  const q: AuthorizeQuery = {
    response_type: get('response_type') ?? '',
    client_id: get('client_id') ?? '',
    redirect_uri: get('redirect_uri') ?? '',
    scope: get('scope') ?? '',
    code_challenge: get('code_challenge') ?? '',
    code_challenge_method: get('code_challenge_method') ?? '',
    state: get('state'),
  };
  if (q.response_type !== 'code') {
    return { ok: false, error: 'unsupported_response_type', description: 'response_type must be "code"' };
  }
  if (!q.client_id) return { ok: false, error: 'invalid_request', description: 'client_id required' };
  if (!q.redirect_uri) return { ok: false, error: 'invalid_request', description: 'redirect_uri required' };
  if (!q.scope) return { ok: false, error: 'invalid_scope', description: 'scope required' };
  if (!q.code_challenge) return { ok: false, error: 'invalid_pkce', description: 'code_challenge required' };
  if (q.code_challenge_method !== 'S256')
    return { ok: false, error: 'invalid_pkce', description: 'code_challenge_method must be S256' };
  return { ok: true, q };
}

export function parseScopes(
  scope: string,
  allowed: Provider[],
): { ok: true; scopes: Provider[] } | { ok: false; invalid: string[] } {
  const requested = scope
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const invalid: string[] = [];
  const scopes: Provider[] = [];
  for (const r of requested) {
    if (!(VALID_PROVIDERS as string[]).includes(r)) {
      invalid.push(r);
      continue;
    }
    if (!allowed.includes(r as Provider)) {
      invalid.push(r);
      continue;
    }
    scopes.push(r as Provider);
  }
  if (invalid.length > 0) return { ok: false, invalid };
  return { ok: true, scopes };
}

/** Strict redirect-URI match. */
export function isRedirectUriAllowed(redirectUri: string, allowed: string[]): boolean {
  return allowed.includes(redirectUri);
}

/** Verify a PKCE S256 challenge against a verifier. */
export async function verifyPkce(verifier: string, challenge: string): Promise<boolean> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const b64 = bytesToBase64Url(new Uint8Array(hash));
  return timingSafeEqual(b64, challenge);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

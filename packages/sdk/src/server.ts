/**
 * Server-side SDK helpers — use these in your backend (Node, Bun, Deno, Workers).
 *
 * Typical flow:
 *
 *   // 1. When user clicks "Connect API Key Wallet" on your site:
 *   const { url, codeVerifier, state } = await startAuthorization({
 *     walletBaseUrl: 'https://wallet.akw.dev',
 *     clientId: process.env.AKW_CLIENT_ID,
 *     redirectUri: 'https://yourapp.com/callback',
 *     scopes: ['openai', 'anthropic', 'google', 'deepgram'],
 *   });
 *   // Stash codeVerifier+state in your session DB keyed by state, then:
 *   res.redirect(url);
 *
 *   // 2. When the user is redirected back to your `redirectUri`:
 *   const result = await exchangeCode({
 *     walletBaseUrl: 'https://wallet.akw.dev',
 *     code: req.query.code,
 *     codeVerifier: storedVerifier,
 *     clientId: process.env.AKW_CLIENT_ID,
 *     clientSecret: process.env.AKW_CLIENT_SECRET,
 *     redirectUri: 'https://yourapp.com/callback',
 *   });
 *   // result.keys.openai is now usable — store it for the user.
 */

import { generatePkcePair, randomUrlSafe } from './pkce.js';
import type {
  ExchangeResult,
  StartAuthorizationParams,
  StartAuthorizationResult,
} from './types.js';

export async function startAuthorization(
  params: StartAuthorizationParams,
): Promise<StartAuthorizationResult> {
  const { verifier, challenge } = await generatePkcePair();
  const state = params.state ?? randomUrlSafe(16);
  const u = new URL('/authorize', params.walletBaseUrl);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', params.clientId);
  u.searchParams.set('redirect_uri', params.redirectUri);
  u.searchParams.set('scope', params.scopes.join(' '));
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('state', state);
  return { url: u.toString(), codeVerifier: verifier, state };
}

export interface ExchangeParams {
  walletBaseUrl: string;
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export async function exchangeCode(params: ExchangeParams): Promise<ExchangeResult> {
  const res = await fetch(new URL('/api/oauth/token', params.walletBaseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: params.code,
      code_verifier: params.codeVerifier,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API Key Wallet token exchange failed (${res.status}): ${body}`);
  }
  return (await res.json()) as ExchangeResult;
}

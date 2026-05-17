/**
 * End-to-end smoke test for the OAuth + proxy flow.
 *
 * Prereqs:
 *   - .env configured
 *   - You've signed up via the web app
 *   - You've added at least one root API key (e.g. OpenAI) via /keys
 *   - You've registered a vendor app via /vendor/new (or run `seed:omi`)
 *
 * What this does:
 *   1. Pretends to be the vendor: generates PKCE pair, builds /authorize URL.
 *   2. You manually open the URL in a browser, approve, and copy the `code` from
 *      the redirected URL back into the prompt.
 *   3. Calls /api/oauth/token with the code + verifier — should return virtual keys.
 *   4. Pings the proxy with one of the returned keys.
 *
 * Run: pnpm --filter @akw/scripts smoke
 */

import { startAuthorization, exchangeCode } from '@apikeywallet/sdk/server';
import { createInterface } from 'node:readline/promises';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL ?? 'http://localhost:8787';

const clientId = process.env.AKW_TEST_CLIENT_ID;
const clientSecret = process.env.AKW_TEST_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Set AKW_TEST_CLIENT_ID and AKW_TEST_CLIENT_SECRET (from `seed:omi` or your vendor portal).');
  process.exit(1);
}

const redirectUri = 'http://localhost:3001/callback';

const { url, codeVerifier } = await startAuthorization({
  walletBaseUrl: APP_URL,
  clientId,
  redirectUri,
  scopes: ['openai'],
});

console.log('\n1. Open this URL in your browser (must be signed in already):\n');
console.log('   ' + url);
console.log('\n2. Approve. You will be redirected to a URL like:');
console.log(`   ${redirectUri}?code=akw_code_...&state=...`);
console.log('\n3. Copy the `code` param value here.\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });
const code = (await rl.question('code = ')).trim();
rl.close();

if (!code) {
  console.error('No code provided');
  process.exit(1);
}

const result = await exchangeCode({
  walletBaseUrl: APP_URL,
  code,
  codeVerifier,
  clientId,
  clientSecret,
  redirectUri,
});

console.log('\n✓ Token exchange succeeded\n');
console.log('keys:    ', result.keys);
console.log('base_url:', result.base_url);

const openaiKey = result.keys.openai;
if (!openaiKey) {
  console.log('No openai virtual key returned. Skipping proxy test.');
  process.exit(0);
}

console.log('\n4. Calling the proxy with the OpenAI virtual key...\n');
const proxyResp = await fetch(`${PROXY_URL}/openai/v1/chat/completions`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${openaiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Reply with exactly: "smoke test ok"' }],
    max_tokens: 20,
  }),
});

console.log('proxy status:', proxyResp.status);
console.log('proxy body:  ', await proxyResp.text());

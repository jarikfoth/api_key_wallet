import Link from 'next/link';

export default function IntegrateDocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-4 text-3xl font-semibold tracking-tight">For developers</h1>
      <p className="mb-8 text-zinc-600">
        Integrate the API Key Wallet button into your app's onboarding so your users never have
        to paste four different API keys again.
      </p>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">1. Register your app</h2>
        <p className="text-sm text-zinc-700">
          Sign in and create a vendor app on the{' '}
          <Link href="/vendor" className="underline">Vendor apps</Link> page. You'll get a{' '}
          <span className="kbd">client_id</span> and a one-time{' '}
          <span className="kbd">client_secret</span>.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">2. Install the SDK</h2>
        <pre className="overflow-x-auto rounded bg-zinc-900 p-4 text-sm text-zinc-100">
          <code>pnpm add @apikeywallet/sdk</code>
        </pre>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">3. Server: start the flow + exchange the code</h2>
        <pre className="mb-3 overflow-x-auto rounded bg-zinc-900 p-4 text-sm text-zinc-100">
          <code>{`// POST /api/wallet/start
import { startAuthorization } from '@apikeywallet/sdk/server';

export async function POST(req) {
  const { url, codeVerifier, state } = await startAuthorization({
    walletBaseUrl: 'https://wallet.akw.dev',
    clientId: process.env.AKW_CLIENT_ID,
    redirectUri: 'https://yourapp.com/auth/akw/callback',
    scopes: ['openai', 'anthropic', 'google', 'deepgram'],
  });

  // Stash codeVerifier + state in your session DB, keyed by state.
  await session.set(state, { codeVerifier });

  return Response.json({ url });
}`}</code>
        </pre>
        <pre className="overflow-x-auto rounded bg-zinc-900 p-4 text-sm text-zinc-100">
          <code>{`// GET /auth/akw/callback?code=...&state=...
import { exchangeCode } from '@apikeywallet/sdk/server';

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code')!;
  const state = url.searchParams.get('state')!;
  const { codeVerifier } = await session.get(state);

  const result = await exchangeCode({
    walletBaseUrl: 'https://wallet.akw.dev',
    code,
    codeVerifier,
    clientId: process.env.AKW_CLIENT_ID,
    clientSecret: process.env.AKW_CLIENT_SECRET,
    redirectUri: 'https://yourapp.com/auth/akw/callback',
  });

  // result.keys.openai is your virtual key.
  // result.base_url is where to point your AI SDKs.
  await db.users.update(userId, { walletKeys: result.keys, baseUrl: result.base_url });

  return Response.redirect('/onboarding/done');
}`}</code>
        </pre>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">4. Frontend: drop in the button</h2>
        <pre className="overflow-x-auto rounded bg-zinc-900 p-4 text-sm text-zinc-100">
          <code>{`import { APIKeyWalletButton } from '@apikeywallet/sdk/react';

export function Onboarding() {
  return (
    <APIKeyWalletButton startUrl="/api/wallet/start">
      Connect API Key Wallet
    </APIKeyWalletButton>
  );
}`}</code>
        </pre>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">5. Use the virtual keys</h2>
        <p className="mb-2 text-sm text-zinc-700">
          Point your AI SDKs at the proxy base URL. Each virtual key is provider-scoped — use the
          matching <span className="kbd">/openai</span>, <span className="kbd">/anthropic</span>,
          etc. path.
        </p>
        <pre className="overflow-x-auto rounded bg-zinc-900 p-4 text-sm text-zinc-100">
          <code>{`import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: user.walletKeys.openai,        // akw_live_o_...
  baseURL: user.baseUrl + '/openai/v1',  // https://proxy.akw.dev/openai/v1
});

const resp = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'hi' }],
});`}</code>
        </pre>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold">Security model</h2>
        <ul className="ml-4 list-disc space-y-1 text-sm text-zinc-700">
          <li>OAuth 2.0 authorization code flow + PKCE (S256) — required.</li>
          <li>Authorization codes are single-use, 60-second expiry, bound to PKCE challenge.</li>
          <li>
            Strict redirect URI match — register every URI you'll use (including localhost ports
            for local dev) on the vendor portal.
          </li>
          <li>Client secret is stored hashed; we'd never email it back to you.</li>
        </ul>
      </section>
    </main>
  );
}

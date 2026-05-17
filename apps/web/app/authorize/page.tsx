import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getCurrentUser,
  getServiceSupabase,
} from '@/lib/supabase/server';
import {
  getVendorAppByClientId,
  listRootKeys,
  type Provider,
} from '@akw/db';
import {
  parseAuthorizeParams,
  parseScopes,
  isRedirectUriAllowed,
} from '@/lib/oauth';
import { ConsentForm } from './ConsentForm';

export const dynamic = 'force-dynamic';

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Reconstruct a URL with these params so the parser works
  const url = new URL('https://placeholder/authorize');
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') url.searchParams.set(k, v);
    else if (Array.isArray(v) && v[0]) url.searchParams.set(k, v[0]);
  }

  const parsed = parseAuthorizeParams(url);
  if (!parsed.ok) {
    return (
      <ErrorBox title="Invalid authorization request" body={parsed.description} />
    );
  }
  const { q } = parsed;

  const user = await getCurrentUser();
  if (!user) {
    // Middleware should have redirected, but just in case.
    return <ErrorBox title="Sign in required" body="Sign in to authorize this vendor." />;
  }

  const service = getServiceSupabase();
  const vendor = await getVendorAppByClientId(service, q.client_id);
  if (!vendor) {
    return <ErrorBox title="Unknown vendor" body="No app is registered for that client_id." />;
  }
  if (!vendor.approved_at) {
    return <ErrorBox title="Vendor not approved" body="This vendor app is pending approval." />;
  }
  if (!isRedirectUriAllowed(q.redirect_uri, vendor.redirect_uris)) {
    return <ErrorBox title="Invalid redirect URI" body="That redirect URI isn't registered." />;
  }

  const scopeResult = parseScopes(q.scope, vendor.allowed_scopes);
  if (!scopeResult.ok) {
    return (
      <ErrorBox
        title="Invalid scopes"
        body={`These scopes aren't allowed for this vendor: ${scopeResult.invalid.join(', ')}`}
      />
    );
  }
  const scopes = scopeResult.scopes;

  // Which scopes does the user already have root keys for?
  const rootKeys = await listRootKeys(service, user.id);
  const present = new Set<Provider>(rootKeys.map((r) => r.provider));
  const missing = scopes.filter((s) => !present.has(s));

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <div className="card">
        <h1 className="mb-1 text-2xl font-semibold">Authorize {vendor.name}</h1>
        <p className="mb-6 text-sm text-zinc-600">
          <span className="font-medium">{vendor.name}</span> wants access to your API keys for the
          following providers. We'll generate scoped virtual keys for them — your real keys never
          leave your wallet.
        </p>

        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Requested scopes
          </h2>
          <ul className="space-y-1 text-sm">
            {scopes.map((s) => (
              <li key={s} className="flex items-center justify-between">
                <span className="font-mono">{s}</span>
                {present.has(s) ? (
                  <span className="text-xs text-green-700">ready</span>
                ) : (
                  <span className="text-xs text-amber-700">missing root key</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {missing.length > 0 ? (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="mb-2">
              You need to add root keys for: <strong>{missing.join(', ')}</strong>
            </p>
            <Link href="/keys" className="underline">
              Add them now →
            </Link>
          </div>
        ) : null}

        <ConsentForm
          vendorName={vendor.name}
          clientId={q.client_id}
          redirectUri={q.redirect_uri}
          scope={q.scope}
          codeChallenge={q.code_challenge}
          codeChallengeMethod={q.code_challenge_method}
          state={q.state}
          canApprove={missing.length === 0}
        />

        <p className="mt-4 text-center text-xs text-zinc-500">
          By approving, {vendor.name} will receive virtual keys it can use on your behalf. You can
          revoke them anytime from your dashboard.
        </p>
      </div>
    </main>
  );
}

function ErrorBox({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <div className="card">
        <h1 className="mb-2 text-xl font-semibold">{title}</h1>
        <p className="text-sm text-zinc-600">{body}</p>
      </div>
    </main>
  );
}

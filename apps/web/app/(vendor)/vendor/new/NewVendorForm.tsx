'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { PROVIDERS, type Provider } from '@akw/db';
import { createVendorAppAction } from '../actions';

export function NewVendorForm() {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{
    clientId: string;
    clientSecret: string;
    appId: string;
  } | null>(null);

  async function submit(formData: FormData) {
    setErr(null);
    setResult(null);
    const res = await createVendorAppAction(formData);
    if (res.ok) {
      setResult({ clientId: res.clientId, clientSecret: res.clientSecret, appId: res.appId });
    } else {
      setErr(res.error);
    }
  }

  if (result) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
        <p className="mb-3 text-sm font-medium text-amber-900">
          App registered. Save the client secret now — you won't see it again.
        </p>
        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-900">
              client_id
            </div>
            <code className="block overflow-x-auto rounded bg-white px-3 py-2 font-mono">
              {result.clientId}
            </code>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-900">
              client_secret
            </div>
            <code className="block overflow-x-auto rounded bg-white px-3 py-2 font-mono">
              {result.clientSecret}
            </code>
          </div>
        </div>
        <Link href="/vendor" className="mt-4 inline-block text-xs underline">
          Back to vendor apps →
        </Link>
      </div>
    );
  }

  return (
    <form
      action={(fd) => startTransition(() => submit(fd))}
      className="flex flex-col gap-4"
    >
      <div>
        <label className="label">App name (shown to users on consent)</label>
        <input name="name" required placeholder="Omi" className="input" />
      </div>
      <div>
        <label className="label">Description (optional, shown on consent screen)</label>
        <input
          name="description"
          maxLength={280}
          placeholder="Personal AI wearable that captures your conversations."
          className="input"
        />
      </div>
      <div>
        <label className="label">Homepage URL (optional)</label>
        <input name="homepage_url" type="url" placeholder="https://omi.me" className="input" />
      </div>
      <div>
        <label className="label">Logo URL (optional)</label>
        <input
          name="logo_url"
          type="url"
          placeholder="https://omi.me/logo.png"
          className="input"
        />
      </div>
      <div>
        <label className="label">Allowed scopes (providers your app will use)</label>
        <div className="flex flex-wrap gap-3">
          {PROVIDERS.map((p: Provider) => (
            <label key={p} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="allowed_scopes" value={p} className="rounded" />
              {p}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Redirect URIs (one per line)</label>
        <textarea
          name="redirect_uris"
          required
          rows={3}
          placeholder={'https://omi.me/auth/callback\nhttps://localhost:3001/callback'}
          className="input font-mono text-sm"
        />
      </div>
      <div>
        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Creating…' : 'Register app'}
        </button>
        {err && <p className="ml-3 inline text-sm text-red-600">{err}</p>}
      </div>
    </form>
  );
}

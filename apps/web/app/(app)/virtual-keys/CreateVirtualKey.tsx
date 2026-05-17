'use client';

import { useState, useTransition } from 'react';
import type { Provider } from '@akw/db';
import { createVirtualKeyAction } from './actions';
import { env } from '@/lib/env';

export function CreateVirtualKey({ providers }: { providers: Provider[] }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(formData: FormData) {
    setErr(null);
    setSecret(null);
    const res = await createVirtualKeyAction(formData);
    if (res.ok) setSecret(res.secret);
    else setErr(res.error);
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (secret) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
        <p className="mb-2 text-sm font-medium text-amber-900">
          Save this key now — you won't see it again.
        </p>
        <div className="mb-3 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded bg-white px-3 py-2 font-mono text-sm">
            {secret}
          </code>
          <button onClick={() => copy(secret)} className="btn-secondary">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mb-2 text-xs text-amber-900">
          Use this key with the proxy base URL:
        </p>
        <div className="mb-3 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded bg-white px-3 py-2 font-mono text-sm">
            {env.proxyUrl}
          </code>
          <button onClick={() => copy(env.proxyUrl)} className="btn-secondary">
            Copy
          </button>
        </div>
        <button onClick={() => setSecret(null)} className="text-xs underline">
          Create another key
        </button>
      </div>
    );
  }

  return (
    <form
      action={(fd) => startTransition(() => submit(fd))}
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
    >
      <div>
        <label className="label">Provider</label>
        <select name="provider" required className="input">
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Label (which app is this for?)</label>
        <input name="label" required placeholder="Cursor" className="input" />
      </div>
      <div>
        <label className="label">Monthly budget (USD, optional)</label>
        <input
          name="budgetCentsPerMonth"
          type="number"
          step="1"
          min="0"
          placeholder="e.g. 2000  (= $20)"
          className="input"
        />
        <p className="mt-1 text-xs text-zinc-500">Enter in cents. 2000 = $20.</p>
      </div>
      <div>
        <label className="label">Model allowlist (optional, comma-separated)</label>
        <input
          name="modelAllowlist"
          placeholder="gpt-4o-mini, gpt-4o"
          className="input"
        />
      </div>
      <div className="md:col-span-2">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Creating…' : 'Create virtual key'}
        </button>
        {err && <p className="ml-3 inline text-sm text-red-600">{err}</p>}
      </div>
    </form>
  );
}

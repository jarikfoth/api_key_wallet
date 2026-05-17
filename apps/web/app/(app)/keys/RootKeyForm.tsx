'use client';

import { useState, useTransition } from 'react';
import type { Provider, RootKey } from '@akw/db';
import { upsertRootKeyAction, deleteRootKeyAction } from './actions';

export function RootKeyForm({
  provider,
  placeholder,
  existing,
}: {
  provider: Provider;
  placeholder: string;
  existing: RootKey | null;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setMsg(null);
    setErr(null);
    const res = await upsertRootKeyAction(formData);
    if (res.ok) setMsg(existing ? 'Updated' : 'Saved');
    else setErr(res.error);
  }

  async function remove() {
    if (!existing) return;
    if (!confirm('Delete this root key? Any virtual keys derived from it will stop working.'))
      return;
    setMsg(null);
    setErr(null);
    const res = await deleteRootKeyAction(existing.id);
    if (!res.ok) setErr(res.error);
  }

  return (
    <form
      action={(fd) => startTransition(() => submit(fd))}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="provider" value={provider} />
      <input
        name="apiKey"
        type="password"
        autoComplete="off"
        required
        placeholder={existing ? '••••••••  (replace to rotate)' : placeholder}
        className="input font-mono text-sm"
        disabled={pending}
      />
      <div className="flex gap-2">
        <button type="submit" className="btn flex-1" disabled={pending}>
          {pending ? 'Saving…' : existing ? 'Rotate' : 'Save key'}
        </button>
        {existing && (
          <button
            type="button"
            onClick={() => startTransition(() => remove())}
            className="btn-secondary"
            disabled={pending}
          >
            Delete
          </button>
        )}
      </div>
      {msg && <p className="text-xs text-green-700">{msg}</p>}
      {err && <p className="text-xs text-red-600">{err}</p>}
    </form>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { joinWaitlistAction } from './actions';

export function WaitlistForm() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setErr(null);
    const res = await joinWaitlistAction(formData);
    if (res.ok) setDone(true);
    else setErr(res.error);
  }

  if (done) {
    return (
      <p className="text-sm text-zinc-700">
        You're on the list. We'll be in touch.
      </p>
    );
  }

  return (
    <form action={(fd) => startTransition(() => submit(fd))} className="flex gap-2">
      <input
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="input flex-1"
        disabled={pending}
      />
      <button type="submit" className="btn" disabled={pending}>
        {pending ? 'Joining…' : 'Join'}
      </button>
      {err && <p className="ml-2 self-center text-sm text-red-600">{err}</p>}
    </form>
  );
}

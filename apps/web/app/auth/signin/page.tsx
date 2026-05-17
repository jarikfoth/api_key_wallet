'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { env } from '@/lib/env';

export default function SignInPage() {
  const params = useSearchParams();
  const next = params.get('next') ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    const supabase = getBrowserSupabase();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${env.appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  async function signInWithMagicLink(e: FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${env.appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setStatus('error');
    } else {
      setStatus('sent');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="card">
        <h1 className="mb-1 text-2xl font-semibold">Sign in</h1>
        <p className="mb-6 text-sm text-zinc-600">to API Key Wallet</p>

        <button onClick={signInWithGoogle} className="btn-secondary mb-4 w-full">
          Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-400">
          <div className="h-px flex-1 bg-zinc-200" />
          or
          <div className="h-px flex-1 bg-zinc-200" />
        </div>

        <form onSubmit={signInWithMagicLink}>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input mb-3"
            disabled={status === 'sending' || status === 'sent'}
          />
          <button
            type="submit"
            disabled={status === 'sending' || status === 'sent'}
            className="btn w-full"
          >
            {status === 'sending'
              ? 'Sending…'
              : status === 'sent'
                ? 'Check your inbox'
                : 'Send magic link'}
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {status === 'sent' && (
          <p className="mt-3 text-sm text-zinc-600">
            We sent a link to <span className="font-mono">{email}</span>. Open it on this device to
            finish signing in.
          </p>
        )}
      </div>
    </main>
  );
}

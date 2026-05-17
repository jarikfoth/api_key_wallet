import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <header className="mb-12">
        <p className="mb-2 text-sm uppercase tracking-widest text-zinc-500">API Key Wallet</p>
        <h1 className="mb-4 text-4xl font-semibold tracking-tight text-zinc-900">
          One wallet for every AI API key.
        </h1>
        <p className="text-lg text-zinc-600">
          Connect your OpenAI, Anthropic, Google, and Deepgram keys once. Then sign in to any AI
          app with a single click — never paste four keys into four platforms again.
        </p>
      </header>

      <div className="mb-12 flex gap-3">
        <Link href="/auth/signin" className="btn">
          Get started
        </Link>
        <Link href="/docs" className="btn-secondary">
          For developers
        </Link>
      </div>

      <section className="card mb-6">
        <h2 className="mb-2 text-lg font-semibold">For users</h2>
        <p className="text-sm text-zinc-600">
          Add your root API keys once. Generate scoped virtual keys per app with budget caps. See
          which app spends what — all without your raw keys ever leaving the vault.
        </p>
      </section>

      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">For software builders</h2>
        <p className="text-sm text-zinc-600">
          Drop a <span className="kbd">{`<APIKeyWalletButton />`}</span> into your onboarding.
          Your users authorize once via OAuth 2.0 + PKCE; your server gets the virtual keys back.
          Zero key-paste friction for your users, zero raw-key liability for you.
        </p>
        <Link href="/docs/integrate" className="mt-3 inline-block text-sm font-medium underline">
          See integration docs →
        </Link>
      </section>
    </main>
  );
}

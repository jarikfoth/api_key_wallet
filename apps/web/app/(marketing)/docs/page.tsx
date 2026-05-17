import Link from 'next/link';

export default function UserDocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-4 text-3xl font-semibold tracking-tight">User guide</h1>
      <p className="mb-8 text-zinc-600">
        How to use API Key Wallet to manage your AI provider keys.
      </p>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">1. Add your root API keys</h2>
        <p className="text-sm text-zinc-700">
          Sign in, head to <Link href="/keys" className="underline">Root keys</Link>, and paste your
          real API keys for each provider. They're encrypted at rest with envelope encryption —
          our master key never touches your DB row, and your data encryption key lives only in
          memory during a request.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">2. Generate virtual keys per app</h2>
        <p className="mb-2 text-sm text-zinc-700">
          On the <Link href="/virtual-keys" className="underline">Virtual keys</Link> page, create a
          new virtual key for each app you use. Label it (e.g. "Cursor"), pick a provider, set a
          monthly budget cap, and optionally restrict which models the app can call.
        </p>
        <p className="text-sm text-zinc-700">
          You'll see the secret <span className="kbd">akw_live_…</span> exactly once — copy it
          immediately. We only store its hash.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">3. Configure your AI app to use it</h2>
        <p className="mb-2 text-sm text-zinc-700">
          In your AI app's settings, find "API key" and "base URL" (sometimes called "API endpoint"
          or "custom endpoint").
        </p>
        <ul className="ml-4 list-disc space-y-1 text-sm text-zinc-700">
          <li>
            <strong>API key:</strong> paste your <span className="kbd">akw_live_…</span> virtual
            key.
          </li>
          <li>
            <strong>Base URL:</strong> set to{' '}
            <span className="kbd">https://proxy.your-domain/openai</span> (or{' '}
            <span className="kbd">/anthropic</span>, <span className="kbd">/google</span>,{' '}
            <span className="kbd">/deepgram</span> depending on the provider).
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">Compatible apps</h2>
        <p className="mb-2 text-sm text-zinc-700">
          Any app that lets you override the API base URL works:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-sm text-zinc-700">
          <li>Cursor (Settings → Models → API URL)</li>
          <li>Continue (config.json → models[].apiBase)</li>
          <li>Cline / Aider</li>
          <li>Any OpenAI-SDK-compatible app</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold">Privacy</h2>
        <p className="text-sm text-zinc-700">
          We never read or store your prompts and responses. The proxy records only metadata:
          timestamp, virtual key, provider, model, token counts, cost, and HTTP status.
        </p>
      </section>
    </main>
  );
}

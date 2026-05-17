import { getCurrentUser, getServiceSupabase } from '@/lib/supabase/server';
import { listRootKeys, PROVIDERS, type Provider, type RootKey } from '@akw/db';
import { RootKeyForm } from './RootKeyForm';

export const dynamic = 'force-dynamic';

const PROVIDER_INFO: Record<Provider, { name: string; help: string; placeholder: string }> = {
  openai: {
    name: 'OpenAI',
    help: 'Create at platform.openai.com/api-keys',
    placeholder: 'sk-...',
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    help: 'Create at console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-...',
  },
  google: {
    name: 'Google (Gemini)',
    help: 'Create at aistudio.google.com/app/apikey',
    placeholder: 'AIza...',
  },
  deepgram: {
    name: 'Deepgram',
    help: 'Create at console.deepgram.com/project/.../keys',
    placeholder: '...',
  },
};

export default async function KeysPage() {
  const user = await getCurrentUser();
  const service = getServiceSupabase();
  const keys = await listRootKeys(service, user!.id);
  const byProvider: Partial<Record<Provider, RootKey>> = {};
  for (const k of keys) byProvider[k.provider] = k;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Root keys</h1>
      <p className="mb-6 text-sm text-zinc-600">
        These are the real API keys from each provider. They're encrypted at rest with your
        per-user data key (which is itself wrapped by our master key). We need them on hand to
        proxy requests for you — we never log your prompts.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PROVIDERS.map((p) => (
          <div key={p} className="card">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{PROVIDER_INFO[p].name}</h2>
              {byProvider[p] ? (
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                  Connected
                </span>
              ) : (
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  Not connected
                </span>
              )}
            </div>
            <p className="mb-3 text-xs text-zinc-500">{PROVIDER_INFO[p].help}</p>
            <RootKeyForm
              provider={p}
              placeholder={PROVIDER_INFO[p].placeholder}
              existing={byProvider[p] ?? null}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

import { getCurrentUser, getServiceSupabase } from '@/lib/supabase/server';
import { listVirtualKeys, listRootKeys, PROVIDERS } from '@akw/db';
import { CreateVirtualKey } from './CreateVirtualKey';
import { VirtualKeyTable } from './VirtualKeyTable';

export const dynamic = 'force-dynamic';

export default async function VirtualKeysPage() {
  const user = await getCurrentUser();
  const service = getServiceSupabase();
  const [virtualKeys, rootKeys] = await Promise.all([
    listVirtualKeys(service, user!.id),
    listRootKeys(service, user!.id),
  ]);
  const availableProviders = PROVIDERS.filter((p) => rootKeys.some((r) => r.provider === p));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Virtual keys</h1>
      <p className="mb-6 text-sm text-zinc-600">
        Generate scoped keys to paste into individual apps. Each key can have a monthly budget cap
        and a model allowlist.
      </p>

      <div className="mb-6 card">
        <h2 className="mb-3 text-lg font-semibold">Create a new virtual key</h2>
        {availableProviders.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Add a root key for at least one provider first on the{' '}
            <a className="underline" href="/keys">
              Root keys
            </a>{' '}
            page.
          </p>
        ) : (
          <CreateVirtualKey providers={availableProviders} />
        )}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Your virtual keys</h2>
      <VirtualKeyTable keys={virtualKeys} />
    </div>
  );
}

import Link from 'next/link';
import { getCurrentUser, getServiceSupabase } from '@/lib/supabase/server';
import { listVendorAppsByOwner } from '@akw/db';

export const dynamic = 'force-dynamic';

export default async function VendorAppsPage() {
  const user = await getCurrentUser();
  const service = getServiceSupabase();
  const apps = await listVendorAppsByOwner(service, user!.id);

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">Vendor apps</h1>
          <p className="text-sm text-zinc-600">
            Apps you've registered to use the <span className="kbd">{`<APIKeyWalletButton />`}</span>.
          </p>
        </div>
        <Link href="/vendor/new" className="btn">
          Register new app
        </Link>
      </div>

      {apps.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          No vendor apps registered yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {apps.map((app) => (
            <div key={app.id} className="card">
              <div className="mb-1 flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">{app.name}</h2>
                {app.approved_at ? (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    Approved
                  </span>
                ) : (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                    Pending
                  </span>
                )}
              </div>
              <p className="mb-3 text-sm text-zinc-600">{app.description}</p>
              <div className="space-y-1 text-xs text-zinc-500">
                <div>
                  <span className="font-medium">client_id:</span>{' '}
                  <code className="font-mono">{app.client_id}</code>
                </div>
                <div>
                  <span className="font-medium">scopes:</span>{' '}
                  {app.allowed_scopes.join(', ')}
                </div>
                <div>
                  <span className="font-medium">redirect_uris:</span>{' '}
                  {app.redirect_uris.length} configured
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from 'next/link';
import { getCurrentUser, getServiceSupabase } from '@/lib/supabase/server';
import {
  listRootKeys,
  listVirtualKeys,
  listRecentUsage,
  type UsageEvent,
  type VirtualKey,
} from '@akw/db';

export const dynamic = 'force-dynamic';

function fmtCents(n: number | null | undefined): string {
  if (!n) return '$0.00';
  return `$${(n / 100).toFixed(2)}`;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const service = getServiceSupabase();

  const [rootKeys, virtualKeys, recent] = await Promise.all([
    listRootKeys(service, user!.id),
    listVirtualKeys(service, user!.id),
    listRecentUsage(service, user!.id, 25),
  ]);

  const totalSpendCents = recent.reduce((sum, ev) => sum + Number(ev.cost_cents ?? 0), 0);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Dashboard</h1>
      <p className="mb-6 text-sm text-zinc-600">Welcome back, {user!.email}.</p>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Root keys connected" value={String(rootKeys.length)} />
        <StatCard
          label="Active virtual keys"
          value={String(virtualKeys.filter((k) => !k.revoked_at).length)}
        />
        <StatCard label="Recent spend (last 25 calls)" value={fmtCents(totalSpendCents)} />
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Virtual keys</h2>
          <Link href="/virtual-keys" className="text-sm text-zinc-600 hover:text-zinc-900">
            Manage →
          </Link>
        </div>
        {virtualKeys.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            No virtual keys yet. <Link href="/virtual-keys" className="underline">Create one</Link>.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left">Label</th>
                  <th className="px-4 py-2 text-left">Provider</th>
                  <th className="px-4 py-2 text-left">Spend</th>
                  <th className="px-4 py-2 text-left">Budget</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {virtualKeys.slice(0, 10).map((k) => (
                  <VirtualKeyRow key={k.id} k={k} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            Nothing yet. As your apps make requests through the proxy, they'll show up here.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left">When</th>
                  <th className="px-4 py-2 text-left">Provider</th>
                  <th className="px-4 py-2 text-left">Model</th>
                  <th className="px-4 py-2 text-left">Tokens</th>
                  <th className="px-4 py-2 text-left">Cost</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((ev: UsageEvent) => (
                  <tr key={ev.id} className="border-t border-zinc-100">
                    <td className="px-4 py-2 text-zinc-600">
                      {new Date(ev.ts).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">{ev.provider}</td>
                    <td className="px-4 py-2 font-mono text-xs">{ev.model ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-600">
                      {ev.prompt_tokens != null
                        ? `${ev.prompt_tokens} + ${ev.completion_tokens ?? 0}`
                        : ev.audio_seconds != null
                          ? `${ev.audio_seconds}s audio`
                          : '—'}
                    </td>
                    <td className="px-4 py-2">{fmtCents(Number(ev.cost_cents) * 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function VirtualKeyRow({ k }: { k: VirtualKey }) {
  const pct =
    k.budget_cents_per_month && k.budget_cents_per_month > 0
      ? Math.min(100, (k.current_period_spend_cents / k.budget_cents_per_month) * 100)
      : null;
  return (
    <tr className="border-t border-zinc-100">
      <td className="px-4 py-2 font-medium">{k.label}</td>
      <td className="px-4 py-2">{k.provider}</td>
      <td className="px-4 py-2">{fmtCents(k.current_period_spend_cents)}</td>
      <td className="px-4 py-2 text-zinc-600">
        {k.budget_cents_per_month ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded bg-zinc-100">
              <div className="h-full bg-zinc-900" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs">{fmtCents(k.budget_cents_per_month)}/mo</span>
          </div>
        ) : (
          <span className="text-xs">No cap</span>
        )}
      </td>
      <td className="px-4 py-2">
        {k.revoked_at ? (
          <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">Revoked</span>
        ) : (
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Active</span>
        )}
      </td>
    </tr>
  );
}

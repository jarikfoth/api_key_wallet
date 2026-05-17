'use client';

import { useTransition } from 'react';
import type { VirtualKey } from '@akw/db';
import { revokeVirtualKeyAction } from './actions';

function fmtCents(n: number | null | undefined): string {
  if (!n) return '$0.00';
  return `$${(n / 100).toFixed(2)}`;
}

export function VirtualKeyTable({ keys }: { keys: VirtualKey[] }) {
  const [pending, startTransition] = useTransition();

  if (keys.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
        No virtual keys yet.
      </p>
    );
  }

  function onRevoke(id: string) {
    if (!confirm('Revoke this virtual key? Apps using it will start failing immediately.'))
      return;
    startTransition(() => {
      void revokeVirtualKeyAction(id);
    });
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-2 text-left">Label</th>
            <th className="px-4 py-2 text-left">Provider</th>
            <th className="px-4 py-2 text-left">Prefix</th>
            <th className="px-4 py-2 text-left">Spend</th>
            <th className="px-4 py-2 text-left">Budget</th>
            <th className="px-4 py-2 text-left">Allowlist</th>
            <th className="px-4 py-2 text-left">Status</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id} className="border-t border-zinc-100">
              <td className="px-4 py-2 font-medium">{k.label}</td>
              <td className="px-4 py-2">{k.provider}</td>
              <td className="px-4 py-2 font-mono text-xs text-zinc-500">{k.prefix}…</td>
              <td className="px-4 py-2">{fmtCents(k.current_period_spend_cents)}</td>
              <td className="px-4 py-2 text-zinc-600">
                {k.budget_cents_per_month ? fmtCents(k.budget_cents_per_month) + '/mo' : '—'}
              </td>
              <td className="px-4 py-2 text-xs text-zinc-600">
                {k.model_allowlist?.join(', ') ?? 'all'}
              </td>
              <td className="px-4 py-2">
                {k.revoked_at ? (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                    Revoked
                  </span>
                ) : (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    Active
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-right">
                {!k.revoked_at && (
                  <button
                    onClick={() => onRevoke(k.id)}
                    disabled={pending}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

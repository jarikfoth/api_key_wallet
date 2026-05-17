'use client';

import { useState, useTransition } from 'react';
import { approveAuthorizationAction } from './actions';

export function ConsentForm(props: {
  vendorName: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string | null;
  canApprove: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function approve() {
    setErr(null);
    const res = await approveAuthorizationAction({
      clientId: props.clientId,
      redirectUri: props.redirectUri,
      scope: props.scope,
      codeChallenge: props.codeChallenge,
      codeChallengeMethod: props.codeChallengeMethod,
      state: props.state,
    });
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    window.location.href = res.redirectTo;
  }

  function deny() {
    const u = new URL(props.redirectUri);
    u.searchParams.set('error', 'access_denied');
    if (props.state) u.searchParams.set('state', props.state);
    window.location.href = u.toString();
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => startTransition(approve)}
        disabled={pending || !props.canApprove}
        className="btn flex-1"
      >
        {pending ? 'Authorizing…' : `Approve ${props.vendorName}`}
      </button>
      <button onClick={deny} disabled={pending} className="btn-secondary flex-1">
        Deny
      </button>
      {err && <p className="ml-2 self-center text-sm text-red-600">{err}</p>}
    </div>
  );
}

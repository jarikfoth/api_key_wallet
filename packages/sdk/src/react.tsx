'use client';

import { type CSSProperties, type ReactNode, useState } from 'react';

/**
 * Drop-in "Connect API Key Wallet" button for the vendor's app.
 *
 * The vendor's backend should expose `startUrl` (e.g. POST /api/wallet/start)
 * which:
 *   1. Calls `startAuthorization()` from @apikeywallet/sdk/server
 *   2. Stashes codeVerifier+state in their session/DB
 *   3. Returns `{ url }` for the browser to redirect to.
 *
 * Usage:
 *   <APIKeyWalletButton startUrl="/api/wallet/start">
 *     Connect API Key Wallet
 *   </APIKeyWalletButton>
 */
export function APIKeyWalletButton({
  startUrl,
  children,
  style,
  className,
}: {
  startUrl: string;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    try {
      const res = await fetch(startUrl, { method: 'POST' });
      if (!res.ok) throw new Error(`Start endpoint returned ${res.status}`);
      const { url } = (await res.json()) as { url?: string };
      if (!url) throw new Error('Start endpoint did not return a url');
      window.location.href = url;
    } catch (e) {
      setLoading(false);
      // eslint-disable-next-line no-alert
      alert(`Failed to start wallet authorization: ${(e as Error).message}`);
    }
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={loading}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        borderRadius: 8,
        background: '#0a0a0a',
        color: 'white',
        fontWeight: 600,
        fontSize: 14,
        border: 'none',
        cursor: loading ? 'wait' : 'pointer',
        ...style,
      }}
    >
      <KeyIcon />
      <span>{children ?? 'Connect API Key Wallet'}</span>
    </button>
  );
}

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2l-9.5 9.5" />
      <circle cx="6.5" cy="17.5" r="4.5" />
      <path d="M15 6l3 3" />
    </svg>
  );
}

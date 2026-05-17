import Link from 'next/link';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            API Key Wallet
          </Link>
          <div className="flex gap-4 text-sm text-zinc-600">
            <Link href="/docs">Users</Link>
            <Link href="/docs/integrate">Developers</Link>
            <Link href="/auth/signin" className="font-medium text-zinc-900">
              Sign in
            </Link>
          </div>
        </div>
      </nav>
      <div>{children}</div>
    </div>
  );
}

import Link from 'next/link';

export function Nav({ email }: { email?: string | null }) {
  return (
    <nav className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            API Key Wallet
          </Link>
          <div className="hidden gap-4 text-sm text-zinc-600 sm:flex">
            <Link href="/dashboard" className="hover:text-zinc-900">
              Dashboard
            </Link>
            <Link href="/keys" className="hover:text-zinc-900">
              Root keys
            </Link>
            <Link href="/virtual-keys" className="hover:text-zinc-900">
              Virtual keys
            </Link>
            <Link href="/vendor" className="hover:text-zinc-900">
              Vendor apps
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {email && <span className="hidden text-zinc-500 sm:inline">{email}</span>}
          <form action="/auth/signout" method="POST">
            <button className="text-zinc-600 hover:text-zinc-900">Sign out</button>
          </form>
        </div>
      </div>
    </nav>
  );
}

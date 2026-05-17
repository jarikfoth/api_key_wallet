import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/server';
import { Nav } from '@/components/Nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');

  return (
    <div className="min-h-screen">
      <Nav email={user.email} />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

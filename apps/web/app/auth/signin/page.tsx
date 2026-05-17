import { Suspense } from 'react';
import { SignInForm } from './SignInForm';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Suspense fallback={<div className="card">Loading…</div>}>
        <SignInForm />
      </Suspense>
    </main>
  );
}

import { WaitlistForm } from './WaitlistForm';

export default function WaitlistPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <h1 className="mb-3 text-3xl font-semibold tracking-tight">Join the waitlist</h1>
      <p className="mb-6 text-zinc-600">
        We're rolling out invites in batches. Drop your email and we'll let you in soon.
      </p>
      <div className="card">
        <WaitlistForm />
      </div>
    </main>
  );
}

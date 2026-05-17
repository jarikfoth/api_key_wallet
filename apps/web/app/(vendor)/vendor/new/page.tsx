import { NewVendorForm } from './NewVendorForm';

export default function NewVendorAppPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Register a vendor app</h1>
      <p className="mb-6 text-sm text-zinc-600">
        Configure how users will see your app on the consent screen and where to redirect them
        after they authorize.
      </p>
      <div className="card">
        <NewVendorForm />
      </div>
    </div>
  );
}

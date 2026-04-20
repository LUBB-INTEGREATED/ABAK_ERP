import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="card-abak">
      <h1 className="text-2xl font-bold text-abak-blue mb-2">Register</h1>
      <p className="text-muted-foreground mb-6">Create a new ABAK ERP account.</p>
      <form className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-dark-text mb-1">
            Full name
          </label>
          <input
            id="name"
            type="text"
            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-abak-blue"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-dark-text mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-abak-blue"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-dark-text mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-abak-blue"
          />
        </div>
        <button type="button" className="btn-primary w-full">
          Create account
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground text-center">
        Already have an account?{' '}
        <Link href="/login" className="text-abak-blue font-medium hover:underline">
          Sign in
        </Link>
      </p>
      <p className="mt-2 text-xs text-muted-foreground text-center">
        Placeholder — real auth lands in issue #005.
      </p>
    </div>
  );
}

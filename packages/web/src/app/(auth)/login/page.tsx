import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="card-abak">
      <h1 className="text-2xl font-bold text-abak-blue mb-2">Login</h1>
      <p className="text-muted-foreground mb-6">Sign in to your ABAK ERP account.</p>
      <form className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-dark-text mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@abak.com.sa"
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
            placeholder="••••••••"
            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-abak-blue"
          />
        </div>
        <button type="button" className="btn-primary w-full">
          Sign in
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground text-center">
        No account?{' '}
        <Link href="/register" className="text-abak-blue font-medium hover:underline">
          Register
        </Link>
      </p>
      <p className="mt-2 text-xs text-muted-foreground text-center">
        Placeholder — real auth lands in issue #005.
      </p>
    </div>
  );
}

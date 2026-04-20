'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-off-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-destructive mb-4">Something went wrong</h1>
        <p className="text-muted-foreground mb-6">{error.message}</p>
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
      </div>
    </main>
  );
}

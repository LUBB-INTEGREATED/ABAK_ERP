export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold text-abak-blue">You are offline</h1>
        <p className="mt-3 text-muted-foreground">
          ABAK ERP needs a connection for live data. Reconnect and refresh the
          page to continue.
        </p>
      </div>
    </main>
  );
}

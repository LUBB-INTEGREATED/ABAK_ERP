'use client';

// Placeholder — the sales "My Requests" list is rebuilt in SALES-1 on top of
// the thin-RFQ hooks (STEP 0). The old mega-list wired the removed lifecycle
// endpoints (RV-8) and is intentionally stubbed here to keep the build green.
export default function RfqsListPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-sm text-muted-foreground">
        طلباتي — قيد إعادة البناء (SALES-1).
      </p>
    </main>
  );
}

'use client';

// Placeholder — the sales tracker is rebuilt in SALES-2 (single-scroll tracker
// on the thin-RFQ + derived display status). The old 772-line mega-screen wired
// the removed assign/prep/dispatch/outcome endpoints (RV-8) and is stubbed here
// to keep the build green after the STEP-0 hook retarget.
export default function RfqDetailPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-sm text-muted-foreground">
        تتبّع الطلب — قيد إعادة البناء (SALES-2).
      </p>
    </main>
  );
}

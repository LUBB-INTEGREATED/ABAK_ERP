'use client';

import { QuotationsShell } from '@/components/quotations/quotations-shell';

// QP-1 — Quotations module. The department pipeline (Board) + the flat List live
// inside one route under <QuotationsShell>. Sales never reaches here (their
// surface is /rfqs); the board's actions are permission-gated.
export default function QuotesPage() {
  return <QuotationsShell />;
}

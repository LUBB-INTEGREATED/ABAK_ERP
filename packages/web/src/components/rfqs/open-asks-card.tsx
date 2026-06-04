'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Paperclip, MapPin, Loader2, FileText } from 'lucide-react';
import {
  useRfqDocRequests,
  useUpdateRfqDocRequest,
  useRfqSiteVisitRequests,
  useUpdateRfqSiteVisitRequest,
  type RfqDocRequest,
  type RfqSiteVisitRequest,
} from '@/lib/hooks/use-rfq-assignments';
import { useUploadFile } from '@/lib/hooks/use-files';
import { DetailSection } from '@/components/detail/detail-shell';

// SALES-3 — the Open Asks responder. The one place the whole sales surface
// exists for: the pricing team blocks on the rep for a document or a site
// visit, and the rep clears it here. Resolving an ask flips it PENDING→RESOLVED,
// which drops the rfq's openAskCount (the list "Needs you" chip + this card).

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // mirror the API cap (RV-3/RV-4)
const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf';

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocAskRow({ rfqId, ask }: { rfqId: string; ask: RfqDocRequest }) {
  const t = useTranslations('rfq.tracker.asks');
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const upload = useUploadFile();
  const update = useUpdateRfqDocRequest(rfqId);
  const busy = upload.isPending || update.isPending;

  function pick(f: File | null) {
    setError(null);
    if (!f) return setFile(null);
    if (f.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      return setError(t('doc.tooBig'));
    }
    if (!ACCEPT.split(',').includes(f.type)) {
      setFile(null);
      return setError(t('doc.badType'));
    }
    setFile(f);
  }

  async function submit() {
    setError(null);
    try {
      let attachmentUrl: string | undefined;
      if (file) attachmentUrl = (await upload.mutateAsync(file)).url;
      await update.mutateAsync({
        requestId: ask.id,
        status: 'RESOLVED',
        ...(attachmentUrl ? { attachmentUrl } : {}),
        ...(note.trim() ? { response: note.trim() } : {}),
      });
    } catch {
      setError(t('error'));
    }
  }

  return (
    <li className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
      <div className="flex items-start gap-3">
        <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              {t('doc.label')}
            </p>
            <p className="text-sm font-medium text-foreground">
              {ask.description}
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />

          {file ? (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate" dir="ltr">
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {humanSize(file.size)}
              </span>
              <button
                type="button"
                onClick={() => pick(null)}
                disabled={busy}
                className="ms-auto text-xs text-muted-foreground hover:text-foreground"
              >
                {t('doc.clear')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-50"
            >
              <Paperclip className="h-4 w-4" />
              {t('doc.attach')}
            </button>
          )}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('doc.notePlaceholder')}
            rows={2}
            dir="auto"
            disabled={busy}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={busy || (!file && !note.trim())}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-abak-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {upload.isPending
              ? t('doc.uploading')
              : update.isPending
                ? t('saving')
                : t('doc.markProvided')}
          </button>
        </div>
      </div>
    </li>
  );
}

function SiteVisitAskRow({
  rfqId,
  ask,
}: {
  rfqId: string;
  ask: RfqSiteVisitRequest;
}) {
  const t = useTranslations('rfq.tracker.asks');
  const [when, setWhen] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const update = useUpdateRfqSiteVisitRequest(rfqId);
  const busy = update.isPending;
  const ready = Boolean(when && name.trim() && phone.trim());

  async function confirm() {
    setError(null);
    try {
      await update.mutateAsync({
        requestId: ask.id,
        status: 'RESOLVED',
        scheduledAt: new Date(when).toISOString(),
        accessContactName: name.trim(),
        accessContactPhone: phone.trim(),
      });
    } catch {
      setError(t('error'));
    }
  }

  return (
    <li className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              {t('visit.label')}
            </p>
            <p className="text-sm font-medium text-foreground">{ask.purpose}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                {t('visit.when')}
              </span>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                disabled={busy}
                dir="ltr"
                className="block min-h-[44px] w-full rounded-md border bg-background px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                {t('visit.contactName')}
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('visit.contactNamePlaceholder')}
                disabled={busy}
                dir="auto"
                className="block min-h-[44px] w-full rounded-md border bg-background px-3 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                {t('visit.contactPhone')}
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                disabled={busy}
                dir="ltr"
                className="block min-h-[44px] w-full rounded-md border bg-background px-3 text-sm"
              />
            </label>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            type="button"
            onClick={confirm}
            disabled={busy || !ready}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-abak-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? t('saving') : t('visit.confirm')}
          </button>
        </div>
      </div>
    </li>
  );
}

export function OpenAsksCard({ rfqId }: { rfqId: string }) {
  const t = useTranslations('rfq.tracker.asks');
  const { data: docs = [] } = useRfqDocRequests(rfqId);
  const { data: visits = [] } = useRfqSiteVisitRequests(rfqId);

  const pendingDocs = docs.filter((d) => d.status === 'PENDING');
  const pendingVisits = visits.filter((v) => v.status === 'PENDING');
  const total = pendingDocs.length + pendingVisits.length;

  // Self-hiding: no open asks → the section doesn't exist. The tracker stays
  // calm until the pricing team actually needs something.
  if (total === 0) return null;

  return (
    <DetailSection
      title={t('title', { count: total })}
      description={t('subtitle')}
      className="border-amber-300"
    >
      <ul className="space-y-3">
        {pendingDocs.map((ask) => (
          <DocAskRow key={ask.id} rfqId={rfqId} ask={ask} />
        ))}
        {pendingVisits.map((ask) => (
          <SiteVisitAskRow key={ask.id} rfqId={rfqId} ask={ask} />
        ))}
      </ul>
    </DetailSection>
  );
}

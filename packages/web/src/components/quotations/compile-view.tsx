'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Star,
  Loader2,
  Trash2,
  GitMerge,
  RotateCcw,
  Plus,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  useQuoteSections,
  useRequestSectionRevision,
  useAddRequirement,
  useDeleteRequirement,
  useDedupRequirements,
  useSubmitQuote,
} from '@/lib/hooks/use-quotes';
import type { Quote, QuoteSection, QuoteRequirement } from '@/lib/types/quote';

// QP-6 — the §14 Lead Reviewer compile view. Role-gated to mirror the
// fail-closed backend: a co-pricer can add/edit requirements + see all sections
// read-only; the LEAD (leadSection.pricerId) additionally requests revisions on
// co-pricer sections, dedups requirements, and submits for approval (enabled
// only when every section is SUBMITTED_TO_LEAD). Owns the §14 submit so the
// quote-detail page suppresses its generic submit for sectioned quotes.

function subtotalOf(s: QuoteSection): number {
  return s.items.reduce((sum, it) => sum + it.subtotal, 0);
}

export function CompileView({
  quote,
  currentUserId,
}: {
  quote: Quote;
  currentUserId: string | undefined;
}) {
  const t = useTranslations('quotations.compile');
  const locale = useLocale();
  const sectionsQ = useQuoteSections(quote.id);
  const sections = sectionsQ.data ?? [];

  const leadSection = sections.find((s) => s.isLead);
  // RV3b-3: the §14 submit gate only engages when a lead section is designated
  // (the lead-reviewer model). A leadless (manual) sectioned quote submits via
  // the generic header button instead.
  const hasLead = !!leadSection;
  const isLead = !!currentUserId && leadSection?.pricerId === currentUserId;
  const isPricer =
    !!currentUserId && sections.some((s) => s.pricerId === currentUserId);
  const editable = quote.status === 'DRAFT';
  const submitted = sections.filter(
    (s) => s.status === 'SUBMITTED_TO_LEAD',
  ).length;
  const allSubmitted = sections.length > 0 && submitted === sections.length;

  if (sectionsQ.isLoading) {
    return <div className="h-32 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-abak-blue">{t('title')}</h2>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {t('progress', { done: submitted, total: sections.length })}
        </span>
      </div>

      {!isPricer && (
        <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
          {t('readOnlyNote')}
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {sections.map((s) => (
          <SectionCard
            key={s.id}
            section={s}
            quoteId={quote.id}
            locale={locale}
            isLead={isLead}
            editable={editable}
            mine={!!currentUserId && s.pricerId === currentUserId}
          />
        ))}
      </div>

      <RequirementsPanel
        quote={quote}
        canEdit={isPricer && editable}
        canDedup={isLead && editable}
      />

      {editable && (
        <SubmitBar
          quoteId={quote.id}
          isLead={isLead}
          allSubmitted={allSubmitted}
          hasLead={hasLead}
        />
      )}
    </div>
  );
}

function SectionCard({
  section,
  quoteId,
  locale,
  isLead,
  editable,
  mine,
}: {
  section: QuoteSection;
  quoteId: string;
  locale: string;
  isLead: boolean;
  editable: boolean;
  mine: boolean;
}) {
  const t = useTranslations('quotations.compile');
  const requestRevision = useRequestSectionRevision(quoteId);
  const [revising, setRevising] = useState(false);
  const [note, setNote] = useState('');

  const pricerName = section.pricer
    ? [section.pricer.firstName, section.pricer.lastName]
        .filter(Boolean)
        .join(' ') || section.pricer.email
    : t('noPricer');
  const submitted = section.status === 'SUBMITTED_TO_LEAD';
  const deptName =
    (locale === 'ar' ? section.department?.nameAr : section.department?.name) ??
    section.department?.name ??
    section.departmentId;

  async function sendBack() {
    try {
      await requestRevision.mutateAsync({
        sectionId: section.id,
        note: note.trim() || undefined,
      });
      toast.success(t('revisionToast'));
      setRevising(false);
      setNote('');
    } catch (err) {
      toast.error(errMessage(err, t('actionFailed')));
    }
  }

  // The lead may bounce a SUBMITTED co-pricer (non-lead) section back to DRAFT.
  const canRequestRevision = isLead && !section.isLead && submitted && editable;

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        mine ? 'border-abak-blue/40 bg-abak-blue/5' : 'bg-card',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {section.isLead && (
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
          )}
          {deptName}
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium',
            submitted
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700',
          )}
        >
          {submitted ? t('statusSubmitted') : t('statusDraft')}
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate">
          {t('pricerLabel')}: {pricerName}
          {mine && ` · ${t('mySection')}`}
        </span>
        <span dir="ltr" className="font-medium text-foreground">
          {subtotalOf(section).toLocaleString(
            locale === 'ar' ? 'ar-SA' : 'en-US',
          )}{' '}
          SAR
        </span>
      </div>

      {section.items.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {section.items.slice(0, 4).map((it) => (
            <li key={it.id} className="flex justify-between gap-2">
              <span className="truncate">{it.description}</span>
              <span dir="ltr">{it.subtotal.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}

      {canRequestRevision && !revising && (
        <button
          type="button"
          onClick={() => setRevising(true)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t('requestRevision')}
        </button>
      )}
      {canRequestRevision && revising && (
        <div className="mt-2 space-y-2">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('revisionNotePlaceholder')}
            dir="auto"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRevising(false);
                setNote('');
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              onClick={sendBack}
              disabled={requestRevision.isPending}
            >
              {requestRevision.isPending && (
                <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
              )}
              {t('sendBack')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RequirementsPanel({
  quote,
  canEdit,
  canDedup,
}: {
  quote: Quote;
  canEdit: boolean;
  canDedup: boolean;
}) {
  const t = useTranslations('quotations.compile');
  const add = useAddRequirement(quote.id);
  const del = useDeleteRequirement(quote.id);
  const dedup = useDedupRequirements(quote.id);
  const [text, setText] = useState('');
  const [type, setType] = useState<'DOCUMENT' | 'NOTE'>('NOTE');
  const [selected, setSelected] = useState<string[]>([]);

  const requirements = quote.requirements ?? [];

  async function onAdd() {
    if (!text.trim()) return;
    try {
      await add.mutateAsync({ type, text: text.trim() });
      setText('');
      toast.success(t('addedToast'));
    } catch (err) {
      toast.error(errMessage(err, t('actionFailed')));
    }
  }

  async function onDelete(id: string) {
    try {
      await del.mutateAsync(id);
      setSelected((s) => s.filter((x) => x !== id));
    } catch (err) {
      toast.error(errMessage(err, t('actionFailed')));
    }
  }

  async function onMerge() {
    if (selected.length < 2) return;
    try {
      await dedup.mutateAsync({
        keepId: selected[0],
        mergeIds: selected.slice(1),
      });
      setSelected([]);
      toast.success(t('mergedToast'));
    } catch (err) {
      toast.error(errMessage(err, t('actionFailed')));
    }
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('requirementsTitle')}</h3>
        {canDedup && selected.length >= 2 && (
          <Button size="sm" onClick={onMerge} disabled={dedup.isPending}>
            {dedup.isPending ? (
              <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <GitMerge className="me-1 h-3.5 w-3.5" />
            )}
            {t('mergeSelected', { count: selected.length })}
          </Button>
        )}
      </div>

      {canDedup && requirements.length > 1 && (
        <p className="mb-2 text-xs text-muted-foreground">{t('dedupHint')}</p>
      )}

      {requirements.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('emptyReqs')}</p>
      ) : (
        <ul className="space-y-1.5">
          {requirements.map((r) => (
            <RequirementRow
              key={r.id}
              req={r}
              t={t}
              canEdit={canEdit}
              canDedup={canDedup}
              checked={selected.includes(r.id)}
              onToggle={() =>
                setSelected((s) =>
                  s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id],
                )
              }
              onDelete={() => onDelete(r.id)}
            />
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'DOCUMENT' | 'NOTE')}
            className="input-base h-9 w-28"
            aria-label={t('typeLabel')}
          >
            <option value="NOTE">{t('typeNote')}</option>
            <option value="DOCUMENT">{t('typeDocument')}</option>
          </select>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('reqTextPlaceholder')}
            dir="auto"
            className="input-base h-9 min-w-[12rem] flex-1"
          />
          <Button size="sm" onClick={onAdd} disabled={add.isPending}>
            {add.isPending ? (
              <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="me-1 h-3.5 w-3.5" />
            )}
            {t('addRequirement')}
          </Button>
        </div>
      )}
    </div>
  );
}

function RequirementRow({
  req,
  t,
  canEdit,
  canDedup,
  checked,
  onToggle,
  onDelete,
}: {
  req: QuoteRequirement;
  t: ReturnType<typeof useTranslations>;
  canEdit: boolean;
  canDedup: boolean;
  checked: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded border bg-background/60 px-2 py-1.5 text-xs">
      {canDedup && (
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-3.5 w-3.5"
          aria-label={t('selectForMerge')}
        />
      )}
      <span
        className={cn(
          'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
          req.type === 'DOCUMENT'
            ? 'bg-sky-100 text-sky-700'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {req.type === 'DOCUMENT' ? t('typeDocument') : t('typeNote')}
      </span>
      <span className="flex-1 truncate" dir="auto">
        {req.text}
      </span>
      {req.isShared && (
        <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
          {t('sharedBadge')}
        </span>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('deleteReq')}
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

function SubmitBar({
  quoteId,
  isLead,
  allSubmitted,
  hasLead,
}: {
  quoteId: string;
  isLead: boolean;
  allSubmitted: boolean;
  hasLead: boolean;
}) {
  const t = useTranslations('quotations.compile');
  const submit = useSubmitQuote(quoteId);
  // RV3b-3: only the lead-reviewer model shows the §14 submit; a leadless
  // (manual) sectioned quote submits via the page's generic header button.
  if (!hasLead) return null;

  const blocked = !isLead || !allSubmitted;
  const hint = !isLead
    ? t('submitLeadHint')
    : !allSubmitted
      ? t('submitGateHint')
      : undefined;

  async function onSubmit() {
    try {
      await submit.mutateAsync({});
      toast.success(t('submitToast'));
    } catch (err) {
      toast.error(errMessage(err, t('actionFailed')));
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <Button onClick={onSubmit} disabled={blocked || submit.isPending}>
        {submit.isPending ? (
          <Loader2 className="me-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="me-2 h-4 w-4" />
        )}
        {t('submitForApproval')}
      </Button>
    </div>
  );
}

function errMessage(err: unknown, fallback: string): string {
  const message =
    (err as { response?: { data?: { message?: string | string[] } } })?.response
      ?.data?.message ?? fallback;
  return Array.isArray(message) ? message.join(', ') : String(message);
}

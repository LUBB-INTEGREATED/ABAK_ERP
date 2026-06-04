'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Star, StarOff, Loader2, Info } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { useRfq, useStartPricing } from '@/lib/hooks/use-rfqs';
import {
  useCreateRfqAssignment,
  useDepartments,
} from '@/lib/hooks/use-rfq-assignments';
import { useDepartmentMembers } from '@/lib/hooks/use-departments';
import type { RfqListItem } from '@/lib/types/rfq';
import { cn } from '@/lib/utils';

// QP-3 (RV-6) + QP-3-fix (RV2-1) — the Accept+Assign seam. One row per
// department the RFQ was routed to (requestedCategoryIds); the manager picks WHO
// prices each + exactly one ⭐ Lead. Confirm writes the assignments then fires
// startPricing, which mints the Draft Quote, flips rfq→PRICING, and routes the
// lead to the quote. First row assigned auto-becomes lead; toggling a star
// clears the others (the single-lead invariant the backend also enforces).
//
// RV2-1 fix: the pricer picker no longer hits GET /users (which a Department
// Manager can't read). Each row folds its section's ServiceCategory → the owning
// real Department (via the category's `departmentId`) and lists THAT department's
// members through GET /departments/:id/members (perm rfq:assign_pricers).

type RowState = { assignee: string; lead: boolean };

// RV3b-4: a category can link to >1 Department. Carry ALL owning department ids
// (deterministically ordered by the serializer) so the picker can fall back to
// the next one when the manager doesn't manage the primary (listMembers 403s).
type DeptRow = { id: string; name: string; departmentIds: string[] };

export function AcceptAssignSheet({
  rfq,
  open,
  onClose,
}: {
  rfq: RfqListItem;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('quotations.accept');
  const locale = useLocale();
  const router = useRouter();

  const detail = useRfq(rfq.id);
  const { data: cats = [] } = useDepartments();
  const create = useCreateRfqAssignment(rfq.id);
  const startPricing = useStartPricing(rfq.id);

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [busy, setBusy] = useState(false);

  const categoryIds = detail.data?.requestedCategoryIds ?? [];
  const deptRows: DeptRow[] = useMemo(
    () =>
      categoryIds.map((id) => {
        const cat = cats.find((c) => c.id === id);
        const departmentIds =
          cat?.departmentIds && cat.departmentIds.length > 0
            ? cat.departmentIds
            : cat?.departmentId
              ? [cat.departmentId]
              : [];
        return {
          id,
          name: (locale === 'ar' ? cat?.nameAr : cat?.name) ?? cat?.name ?? id,
          departmentIds,
        };
      }),
    [categoryIds, cats, locale],
  );

  function setAssignee(catId: string, assignee: string) {
    setRows((prev) => {
      const anyLead = Object.values(prev).some((r) => r.lead);
      return {
        ...prev,
        [catId]: { assignee, lead: prev[catId]?.lead ?? !anyLead },
      };
    });
  }

  function setLead(catId: string) {
    setRows((prev) => {
      const next: Record<string, RowState> = {};
      for (const [k, v] of Object.entries(prev))
        next[k] = { ...v, lead: k === catId };
      if (!next[catId]) next[catId] = { assignee: '', lead: true };
      return next;
    });
  }

  const allAssigned =
    deptRows.length > 0 && deptRows.every((d) => rows[d.id]?.assignee);
  const leadCount = Object.values(rows).filter((r) => r.lead).length;
  const canConfirm = allAssigned && leadCount === 1 && !busy;

  async function confirm() {
    if (!canConfirm) return;
    setBusy(true);
    try {
      for (const d of deptRows) {
        const r = rows[d.id];
        if (!r?.assignee) continue;
        await create.mutateAsync({
          departmentId: d.id,
          assigneeId: r.assignee,
          isLeadPricer: r.lead,
        });
      }
      const { quoteId, quoteNumber } = await startPricing.mutateAsync();
      toast.success(t('toastSuccess', { quote: quoteNumber }));
      onClose();
      router.push(`/quotes/${quoteId}`);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('toastFailed');
      toast.error(Array.isArray(message) ? message.join(', ') : message);
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>
            <span className="font-mono" dir="ltr">
              {rfq.rfqNumber}
            </span>{' '}
            · {rfq.client?.companyName ?? rfq.client?.contactName ?? '—'}
            <span className="mt-1 block">{t('consequence')}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 py-4">
          <p className="text-xs font-medium text-muted-foreground">
            {t('deptsHeading')}
          </p>

          {detail.isLoading ? (
            <div className="h-24 animate-pulse rounded bg-muted" />
          ) : deptRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noDepts')}</p>
          ) : (
            deptRows.map((d) => (
              <DeptPricerRow
                key={d.id}
                row={d}
                state={rows[d.id]}
                busy={busy}
                onAssignee={(u) => setAssignee(d.id, u)}
                onLead={() => setLead(d.id)}
              />
            ))
          )}

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t('leadRule')}
          </p>
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-[44px] rounded-md border px-4 text-sm font-medium hover:bg-muted/40"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            title={!allAssigned ? t('assignAllHint') : undefined}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-abak-blue px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('confirm')}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DeptPricerRow({
  row,
  state,
  busy,
  onAssignee,
  onLead,
}: {
  row: DeptRow;
  state: RowState | undefined;
  busy: boolean;
  onAssignee: (userId: string) => void;
  onLead: () => void;
}) {
  const t = useTranslations('quotations.accept');
  // RV3b-4: walk the owning departments in order; if the caller can't list a
  // department's members (403/error), fall back to the next one before giving up.
  const [deptIdx, setDeptIdx] = useState(0);
  const departmentId = row.departmentIds[deptIdx] ?? null;
  const members = useDepartmentMembers(departmentId);
  useEffect(() => {
    if (members.isError && deptIdx < row.departmentIds.length - 1) {
      setDeptIdx((i) => i + 1);
    }
  }, [members.isError, deptIdx, row.departmentIds.length]);

  const memberName = (m: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    isManager: boolean;
  }) => {
    const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;
    return m.isManager ? `${name} · ${t('managerTag')}` : name;
  };

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{row.name}</span>
        <button
          type="button"
          onClick={onLead}
          disabled={busy}
          aria-pressed={state?.lead ?? false}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs',
            state?.lead
              ? 'bg-amber-100 font-semibold text-amber-900'
              : 'text-muted-foreground hover:bg-muted/50',
          )}
        >
          {state?.lead ? (
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
          ) : (
            <StarOff className="h-3.5 w-3.5" />
          )}
          {state?.lead ? t('lead') : t('makeLead')}
        </button>
      </div>

      {!departmentId ? (
        <p className="text-xs italic text-muted-foreground">{t('noDept')}</p>
      ) : members.isLoading ? (
        <div className="h-10 animate-pulse rounded bg-muted" />
      ) : members.isError ? (
        <p className="text-xs text-rose-600">{t('membersError')}</p>
      ) : (members.data?.length ?? 0) === 0 ? (
        <p className="text-xs italic text-muted-foreground">{t('noMembers')}</p>
      ) : (
        <select
          value={state?.assignee ?? ''}
          onChange={(e) => onAssignee(e.target.value)}
          disabled={busy}
          dir="auto"
          className="input-base min-h-[40px] w-full"
          aria-label={t('pickPricer')}
        >
          <option value="" disabled>
            {t('pickPricer')}
          </option>
          {members.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {memberName(m)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

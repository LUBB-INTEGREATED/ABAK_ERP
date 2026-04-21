'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Check,
  CircleDollarSign,
  FileText,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useCommercialConfirmations,
  useFinanceStats,
  useInvoices,
  usePayments,
  useValidateCommercialConfirmation,
  useValidatePayment,
} from '@/lib/hooks/use-finance';
import type {
  CommercialConfirmation,
  InvoiceStatus,
  Payment,
  PaymentValidationStatus,
} from '@/lib/types/finance';
import { cn } from '@/lib/utils';

type GateAction = 'VALIDATED' | 'REJECTED';

async function runWithToast<T>(t: (k: string) => string, fn: () => Promise<T>) {
  try {
    await fn();
    toast.success(t('common.success'));
    return true;
  } catch (err) {
    const msg =
      (err as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message ?? t('errors.generic');
    toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    return false;
  }
}

export default function FinancePage() {
  const t = useTranslations();
  const { data: stats } = useFinanceStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-abak-blue">
          {t('finance.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('finance.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label={t('finance.kpi.pendingConfirmations')}
          value={stats?.pendingConfirmations ?? 0}
          accent="text-amber-600"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <Kpi
          label={t('finance.kpi.pendingPayments')}
          value={stats?.pendingPayments ?? 0}
          accent="text-sky-600"
          icon={<CircleDollarSign className="h-4 w-4" />}
        />
        <Kpi
          label={t('finance.kpi.overdueInvoices')}
          value={stats?.overdueInvoices ?? 0}
          accent="text-rose-600"
          icon={<FileText className="h-4 w-4" />}
        />
        <Kpi
          label={t('finance.kpi.totalCollected')}
          value={
            stats
              ? `${stats.totalCollected.toLocaleString()} ${t('units.sar')}`
              : '—'
          }
          accent="text-emerald-600"
          icon={<Check className="h-4 w-4" />}
        />
      </div>

      <Tabs defaultValue="commercial" className="space-y-4">
        <TabsList>
          <TabsTrigger value="commercial">
            {t('finance.tabs.commercial')}
            {stats && stats.pendingConfirmations > 0 && (
              <span className="ms-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                {stats.pendingConfirmations}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="payments">
            {t('finance.tabs.payments')}
            {stats && stats.pendingPayments > 0 && (
              <span className="ms-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                {stats.pendingPayments}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoices">
            {t('finance.tabs.invoices')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="commercial">
          <CommercialConfirmationsTab />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoicesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number | string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className={accent}>{icon}</span>
          {label}
        </div>
        <div className={cn('mt-1 text-2xl font-semibold tabular-nums', accent)}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Commercial confirmations tab ───────────────────────────────

function CommercialConfirmationsTab() {
  const t = useTranslations();
  const pending = useCommercialConfirmations('PENDING');
  const decided = useCommercialConfirmations();
  const validate = useValidateCommercialConfirmation();

  const [actionOpen, setActionOpen] = useState<null | {
    confirmation: CommercialConfirmation;
    action: GateAction;
  }>(null);
  const [note, setNote] = useState('');

  async function submit() {
    if (!actionOpen) return;
    const ok = await runWithToast(t, () =>
      validate.mutateAsync({
        id: actionOpen.confirmation.id,
        status: actionOpen.action,
        note: note.trim() || undefined,
      }),
    );
    if (ok) {
      setActionOpen(null);
      setNote('');
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('finance.commercial.pendingHeading')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.isLoading ? (
            <div className="text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : !pending.data || pending.data.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t('finance.commercial.emptyPending')}
            </div>
          ) : (
            <ul className="divide-y">
              {pending.data.map((c) => (
                <ConfirmationRow
                  key={c.id}
                  confirmation={c}
                  onAction={(action) => {
                    setActionOpen({ confirmation: c, action });
                    setNote('');
                  }}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {decided.data &&
        decided.data.filter((c) => c.validationStatus !== 'PENDING').length >
          0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('finance.commercial.decidedHeading')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {decided.data
                  .filter((c) => c.validationStatus !== 'PENDING')
                  .map((c) => (
                    <ConfirmationRow key={c.id} confirmation={c} readOnly />
                  ))}
              </ul>
            </CardContent>
          </Card>
        )}

      <Dialog
        open={!!actionOpen}
        onOpenChange={(o) => !o && setActionOpen(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionOpen?.action === 'VALIDATED'
                ? t('finance.commercial.validate')
                : t('finance.commercial.reject')}
            </DialogTitle>
            <DialogDescription>
              {actionOpen?.action === 'VALIDATED'
                ? t('finance.commercial.confirmValidate')
                : t('finance.commercial.confirmReject')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="note">
              {t('finance.commercial.validationNote')}
            </Label>
            <Textarea
              id="note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              {t('finance.commercial.validationNoteHint')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={submit}
              disabled={
                validate.isPending ||
                (actionOpen?.action === 'REJECTED' && note.trim().length < 5)
              }
              variant={
                actionOpen?.action === 'VALIDATED' ? 'default' : 'destructive'
              }
            >
              {actionOpen?.action === 'VALIDATED'
                ? t('finance.commercial.validate')
                : t('finance.commercial.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConfirmationRow({
  confirmation,
  onAction,
  readOnly,
}: {
  confirmation: CommercialConfirmation;
  onAction?: (action: GateAction) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations();
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono text-xs text-abak-blue">
            {confirmation.quote.quoteNumber}
          </span>
          <span className="truncate font-medium">
            {confirmation.quote.title}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {confirmation.quote.client.companyName ??
              confirmation.quote.client.contactName}
          </span>
          <span>·</span>
          <span className="font-mono">
            {confirmation.contractValue.toLocaleString()} {t('units.sar')}
          </span>
          <span>·</span>
          <span>{confirmation.confirmedAt.slice(0, 10)}</span>
          <span className="rounded-full border px-2 py-0.5 text-[10px]">
            {confirmation.type}
          </span>
        </div>
        {confirmation.validationNote && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            {confirmation.validationNote}
          </div>
        )}
      </div>

      {readOnly ? (
        <StatusBadge status={confirmation.validationStatus} />
      ) : (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={() => onAction?.('VALIDATED')}
            className="h-8"
          >
            <Check className="me-1 h-3.5 w-3.5" />
            {t('finance.commercial.validate')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.('REJECTED')}
            className="h-8 text-destructive"
          >
            <X className="me-1 h-3.5 w-3.5" />
            {t('finance.commercial.reject')}
          </Button>
        </div>
      )}
    </li>
  );
}

function StatusBadge({ status }: { status: PaymentValidationStatus }) {
  const t = useTranslations();
  const map: Record<PaymentValidationStatus, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    VALIDATED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-rose-100 text-rose-800',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        map[status],
      )}
    >
      {t(`finance.payment.status.${status}`)}
    </span>
  );
}

// ─── Payments tab ───────────────────────────────────────────────

function PaymentsTab() {
  const t = useTranslations();
  const pending = usePayments({ validationStatus: 'PENDING' });
  const all = usePayments({ pageSize: 50 });
  const validate = useValidatePayment();

  const [actionOpen, setActionOpen] = useState<null | {
    payment: Payment;
    action: GateAction;
  }>(null);
  const [note, setNote] = useState('');

  async function submit() {
    if (!actionOpen) return;
    const ok = await runWithToast(t, () =>
      validate.mutateAsync({
        id: actionOpen.payment.id,
        status: actionOpen.action,
        note: note.trim() || undefined,
      }),
    );
    if (ok) {
      setActionOpen(null);
      setNote('');
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('finance.payment.pendingHeading')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.isLoading ? (
            <div className="text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : !pending.data || pending.data.data.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t('finance.payment.emptyPending')}
            </div>
          ) : (
            <ul className="divide-y">
              {pending.data.data.map((p) => (
                <PaymentRow
                  key={p.id}
                  payment={p}
                  onAction={(action) => {
                    setActionOpen({ payment: p, action });
                    setNote('');
                  }}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {all.data && all.data.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('finance.payment.heading')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 text-start">#</th>
                    <th className="py-2 text-start">
                      {t('finance.payment.po')}
                    </th>
                    <th className="py-2 text-start">
                      {t('finance.commercial.client')}
                    </th>
                    <th className="py-2 text-end">
                      {t('finance.payment.amount')}
                    </th>
                    <th className="py-2 text-start">
                      {t('finance.payment.method')}
                    </th>
                    <th className="py-2 text-start">
                      {t('finance.payment.receivedAt')}
                    </th>
                    <th className="py-2 text-start">
                      {t('common.statusLabel')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {all.data.data.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">
                        {p.paymentNumber}
                      </td>
                      <td className="py-2 font-mono text-xs">
                        {p.po.poNumber}
                      </td>
                      <td className="py-2">
                        {p.client.companyName ?? p.client.contactName}
                      </td>
                      <td className="py-2 text-end font-mono">
                        {p.amount.toLocaleString()} {t('units.sar')}
                      </td>
                      <td className="py-2 text-xs">
                        {t(`finance.payment.methodLabel.${p.method}`)}
                      </td>
                      <td className="py-2 text-xs">
                        {p.receivedAt.slice(0, 10)}
                      </td>
                      <td className="py-2">
                        <StatusBadge status={p.validationStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!actionOpen}
        onOpenChange={(o) => !o && setActionOpen(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionOpen?.action === 'VALIDATED'
                ? t('finance.payment.validate')
                : t('finance.payment.reject')}
            </DialogTitle>
            <DialogDescription>
              {actionOpen?.payment && (
                <>
                  {actionOpen.payment.amount.toLocaleString()} {t('units.sar')}{' '}
                  · {actionOpen.payment.po.poNumber}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="note">
              {t('finance.commercial.validationNote')}
            </Label>
            <Textarea
              id="note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={submit}
              disabled={
                validate.isPending ||
                (actionOpen?.action === 'REJECTED' && note.trim().length < 5)
              }
              variant={
                actionOpen?.action === 'VALIDATED' ? 'default' : 'destructive'
              }
            >
              {actionOpen?.action === 'VALIDATED'
                ? t('finance.payment.validate')
                : t('finance.payment.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentRow({
  payment,
  onAction,
}: {
  payment: Payment;
  onAction: (action: GateAction) => void;
}) {
  const t = useTranslations();
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono text-xs text-abak-blue">
            {payment.paymentNumber}
          </span>
          <span className="font-semibold">
            {payment.amount.toLocaleString()} {t('units.sar')}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {payment.client.companyName ?? payment.client.contactName}
          </span>
          <span>·</span>
          <span className="font-mono">{payment.po.poNumber}</span>
          {payment.invoice && (
            <>
              <span>·</span>
              <span className="font-mono">{payment.invoice.invoiceNumber}</span>
            </>
          )}
          <span>·</span>
          <span>{t(`finance.payment.methodLabel.${payment.method}`)}</span>
          <span>·</span>
          <span>{payment.receivedAt.slice(0, 10)}</span>
        </div>
        {payment.referenceNumber && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Ref: {payment.referenceNumber}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button size="sm" onClick={() => onAction('VALIDATED')} className="h-8">
          <Check className="me-1 h-3.5 w-3.5" />
          {t('finance.payment.validate')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-destructive"
          onClick={() => onAction('REJECTED')}
        >
          <X className="me-1 h-3.5 w-3.5" />
          {t('finance.payment.reject')}
        </Button>
      </div>
    </li>
  );
}

// ─── Invoices tab ───────────────────────────────────────────────

const INVOICE_BADGE: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-800',
  ISSUED: 'bg-sky-100 text-sky-800',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  OVERDUE: 'bg-rose-100 text-rose-800',
  CANCELLED: 'bg-zinc-300 text-zinc-800',
  REFUNDED: 'bg-indigo-100 text-indigo-800',
};

function InvoicesTab() {
  const t = useTranslations();
  const { data, isLoading } = useInvoices({ pageSize: 50 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t('finance.invoice.heading')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">
            {t('common.loading')}
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t('common.empty')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 text-start">
                    {t('finance.invoice.number')}
                  </th>
                  <th className="py-2 text-start">
                    {t('finance.commercial.client')}
                  </th>
                  <th className="py-2 text-end">
                    {t('finance.invoice.subtotal')}
                  </th>
                  <th className="py-2 text-end">{t('finance.invoice.tax')}</th>
                  <th className="py-2 text-end">
                    {t('finance.invoice.total')}
                  </th>
                  <th className="py-2 text-start">
                    {t('finance.invoice.dueDate')}
                  </th>
                  <th className="py-2 text-start">{t('common.statusLabel')}</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-2">
                      {inv.client.companyName ?? inv.client.contactName}
                    </td>
                    <td className="py-2 text-end font-mono">
                      {inv.subtotal.toLocaleString()}
                    </td>
                    <td className="py-2 text-end font-mono">
                      {inv.taxAmount.toLocaleString()}
                    </td>
                    <td className="py-2 text-end font-mono font-semibold">
                      {inv.totalAmount.toLocaleString()} {t('units.sar')}
                    </td>
                    <td className="py-2 text-xs">{inv.dueDate.slice(0, 10)}</td>
                    <td className="py-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium',
                          INVOICE_BADGE[inv.status],
                        )}
                      >
                        {t(`finance.invoice.status.${inv.status}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Briefcase, CheckCircle2, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useAvailablePurchaseOrders,
  useCreateProject,
  useEligiblePms,
} from '@/lib/hooks/use-projects';
import { cn } from '@/lib/utils';

const DEFAULT_TEMPLATE = [
  { code: 'INITIATION', durationDays: 7 },
  { code: 'KICKOFF', durationDays: 5 },
  { code: 'EXECUTION', durationDays: 45 },
  { code: 'REVIEW', durationDays: 10 },
  { code: 'SUBMISSION', durationDays: 7 },
  { code: 'REVISIONS', durationDays: 14 },
  { code: 'CLOSURE', durationDays: 7 },
] as const;

export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const create = useCreateProject();
  const { data: pos, isLoading: posLoading } = useAvailablePurchaseOrders(open);
  const { data: pms, isLoading: pmsLoading } = useEligiblePms(open);

  const [poId, setPoId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pmId, setPmId] = useState('');
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [expectedEnd, setExpectedEnd] = useState('');
  const [seedPhases, setSeedPhases] = useState(true);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPoId('');
      setTitle('');
      setDescription('');
      setPmId('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setExpectedEnd('');
      setSeedPhases(true);
    }
  }, [open]);

  // Auto-fill title from quote title when PO selected
  const selectedPo = useMemo(
    () => pos?.find((p) => p.id === poId),
    [pos, poId],
  );
  useEffect(() => {
    if (selectedPo && !title) {
      setTitle(selectedPo.quote?.title ?? '');
    }
  }, [selectedPo, title]);

  const phasePreview = useMemo(() => {
    if (!startDate) return [];
    const start = new Date(startDate);
    const rows: {
      code: (typeof DEFAULT_TEMPLATE)[number]['code'];
      start: Date;
      end: Date;
    }[] = [];
    let cursor = new Date(start);
    for (const p of DEFAULT_TEMPLATE) {
      const end = new Date(cursor);
      end.setDate(end.getDate() + p.durationDays);
      rows.push({ code: p.code, start: new Date(cursor), end: new Date(end) });
      cursor = end;
    }
    return rows;
  }, [startDate]);

  const canSubmit =
    poId.trim().length > 0 &&
    title.trim().length >= 3 &&
    pmId.trim().length > 0 &&
    startDate.trim().length > 0;

  async function onSubmit() {
    try {
      const project = await create.mutateAsync({
        poId,
        title: title.trim(),
        description: description.trim() || undefined,
        pmId,
        startDate: new Date(startDate).toISOString(),
        expectedEndDate: expectedEnd
          ? new Date(expectedEnd).toISOString()
          : undefined,
        skipDefaultPhases: !seedPhases,
      });
      toast.success(t('common.success'));
      onOpenChange(false);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('errors.generic');
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('project.dialog.newTitle')}</DialogTitle>
          <DialogDescription>
            {t('project.dialog.newSubtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2 max-h-[65vh] overflow-y-auto pr-2">
          {/* Left column — form */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="po">{t('project.dialog.selectPo')}</Label>
              {posLoading ? (
                <div className="text-xs text-muted-foreground">
                  {t('common.loading')}
                </div>
              ) : !pos || pos.length === 0 ? (
                <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                  {t('project.dialog.noAvailablePos')}
                </div>
              ) : (
                <div className="space-y-1 max-h-44 overflow-y-auto rounded-md border p-1">
                  {pos.map((po) => (
                    <button
                      key={po.id}
                      type="button"
                      onClick={() => setPoId(po.id)}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-md p-2 text-start text-sm transition-colors',
                        poId === po.id
                          ? 'bg-abak-blue/10 ring-1 ring-abak-blue/40'
                          : 'hover:bg-muted/60',
                      )}
                    >
                      <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="font-mono text-xs text-abak-blue">
                          {po.poNumber}
                        </span>
                        <span className="mx-1 text-muted-foreground">·</span>
                        <span className="truncate">
                          {po.client.companyName ?? po.client.contactName}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {po.quote?.quoteNumber && (
                            <span className="font-mono">
                              {po.quote.quoteNumber}
                            </span>
                          )}
                          <span>
                            {po.contractValue.toLocaleString()} {t('units.sar')}
                          </span>
                        </span>
                      </span>
                      {poId === po.id && (
                        <CheckCircle2 className="h-4 w-4 text-abak-blue" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {t('project.dialog.poHint')}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="title">{t('project.dialog.projectTitle')}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('project.dialog.projectTitlePlaceholder')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">
                {t('project.dialog.description')}
              </Label>
              <Textarea
                id="description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pm">{t('project.dialog.pmLabel')}</Label>
              <select
                id="pm"
                value={pmId}
                onChange={(e) => setPmId(e.target.value)}
                className="input-base"
                disabled={pmsLoading}
              >
                <option value="">
                  {pmsLoading
                    ? t('common.loading')
                    : t('project.dialog.pmPlaceholder')}
                </option>
                {pms?.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {`${pm.firstName ?? ''} ${pm.lastName ?? ''}`.trim() ||
                      pm.email}{' '}
                    — {pm.role.replace(/_/g, ' ').toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start">{t('project.dialog.startDate')}</Label>
                <Input
                  id="start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end">{t('project.dialog.expectedEnd')}</Label>
                <Input
                  id="end"
                  type="date"
                  value={expectedEnd}
                  onChange={(e) => setExpectedEnd(e.target.value)}
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm">
              <Checkbox
                checked={seedPhases}
                onCheckedChange={(v) => setSeedPhases(v === true)}
              />
              <span className="flex-1">
                <span className="block font-medium">
                  {t('project.dialog.seedPhases')}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t('project.dialog.seedPhasesHint')}
                </span>
              </span>
            </label>
          </div>

          {/* Right column — live preview */}
          <div className="space-y-3">
            {selectedPo && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center gap-2 font-mono text-xs text-abak-blue">
                  <FileText className="h-3.5 w-3.5" />
                  {selectedPo.poNumber}
                </div>
                <div className="mt-1 font-medium">
                  {selectedPo.quote?.title ?? '—'}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {selectedPo.client.companyName ??
                    selectedPo.client.contactName}
                </div>
                <div className="mt-1 text-xs">
                  <span className="text-muted-foreground">
                    {t('project.dialog.contractValue')}:
                  </span>{' '}
                  <span className="font-semibold">
                    {selectedPo.contractValue.toLocaleString()} {t('units.sar')}
                  </span>
                </div>
              </div>
            )}

            {seedPhases && (
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">
                    {t('project.dialog.phasePreview')}
                  </span>
                  <span>7 × {t('phase.daysUnit')}</span>
                </div>
                <ol className="space-y-1.5">
                  {phasePreview.map((row, idx) => (
                    <li
                      key={row.code}
                      className="flex items-center gap-3 rounded-md border bg-white p-2 text-xs"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-abak-blue/10 text-[10px] font-semibold text-abak-blue">
                        {idx + 1}
                      </span>
                      <span className="flex-1 font-medium">
                        {t(`phase.code.${row.code}`)}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {row.start.toISOString().slice(5, 10)} →{' '}
                        {row.end.toISOString().slice(5, 10)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit || create.isPending}>
            {create.isPending
              ? t('common.loading')
              : t('project.dialog.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

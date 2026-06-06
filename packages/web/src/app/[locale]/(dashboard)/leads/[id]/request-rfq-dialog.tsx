'use client';

import { useMemo, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useServices, type ServiceOption } from '@/lib/hooks/use-leads';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';
import type { Lead } from '@/lib/types/lead';

type RequestRfqResult = {
  data: { rfqId: string; rfqNumber: string; clientId: string; leadId: string };
};

/**
 * One-click "Request RFQ" from a lead (CORRECTED_CLIENT_JOURNEY Activity B).
 * The user picks services from the catalog (multi-select); the departments that
 * will price the RFQ are derived from those services' categories — no manual
 * department picking. Submitting auto-qualifies the lead, ensures a client +
 * opportunity, and creates the RFQ.
 */
export function RequestRfqDialog({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('leads.requestRfq');
  const queryClient = useQueryClient();
  const { data: services } = useServices();
  const [projectScope, setProjectScope] = useState(lead.serviceDetails ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const isAr = locale === 'ar';
  const svcLabel = (s: ServiceOption) =>
    (isAr ? s.nameAr : s.nameEn) || s.name;
  const catLabel = (c: ServiceOption['category']) =>
    (isAr ? c.nameAr : c.name) || c.name;

  // Services grouped by category for display.
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; services: ServiceOption[] }
    >();
    (services ?? []).forEach((s) => {
      const cat = s.category;
      if (!map.has(cat.id))
        map.set(cat.id, { id: cat.id, name: catLabel(cat), services: [] });
      map.get(cat.id)!.services.push(s);
    });
    return [...map.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, locale]);

  // Departments involved = distinct categories of the selected services.
  const involvedDepartments = useMemo(() => {
    const map = new Map<string, string>();
    (services ?? []).forEach((s) => {
      if (selected.has(s.id)) map.set(s.category.id, catLabel(s.category));
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, selected, locale]);

  const valid = selected.size >= 1 && projectScope.trim().length >= 10;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!valid) return;
    setSubmitting(true);
    try {
      const chosen = (services ?? []).filter((s) => selected.has(s.id));
      const departmentIds = involvedDepartments.map((d) => d.id);
      // serviceType kept for backward-compat: a readable summary of the picks.
      const serviceType = chosen.map((s) => s.name).join(' + ');
      const { data } = await apiClient.post<RequestRfqResult>(
        `/leads/${lead.id}/request-rfq`,
        {
          serviceType,
          projectScope: projectScope.trim(),
          departmentIds,
        },
      );
      const res = data.data;
      toast.success(t('successToast', { rfqNumber: res.rfqNumber }));
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onOpenChange(false);
      router.push(`/rfqs/${res.rfqId}`);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('errorToast');
      toast.error(Array.isArray(message) ? message.join(', ') : String(message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description', { leadNumber: lead.leadNumber })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('servicesLabel')}</Label>
            <p className="text-xs text-muted-foreground">{t('servicesHint')}</p>
            {!services ? (
              <p className="text-sm text-muted-foreground">
                {t('loadingServices')}
              </p>
            ) : grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noServices')}</p>
            ) : (
              <div className="max-h-56 space-y-3 overflow-y-auto rounded-md border border-border p-3">
                {grouped.map((cat) => (
                  <div key={cat.id} className="space-y-1.5">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {cat.name}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {cat.services.map((s) => {
                        const on = selected.has(s.id);
                        return (
                          <button
                            type="button"
                            key={s.id}
                            onClick={() => toggle(s.id)}
                            aria-pressed={on}
                            className={cn(
                              'rounded-full border px-3 py-1.5 text-sm transition',
                              on
                                ? 'border-abak-blue bg-abak-blue text-white'
                                : 'border-input bg-background hover:border-abak-blue',
                            )}
                          >
                            {on ? '✓ ' : ''}
                            {svcLabel(s)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectScope">{t('scopeLabel')}</Label>
            <Textarea
              id="projectScope"
              rows={3}
              placeholder={t('scopePlaceholder')}
              value={projectScope}
              onChange={(event) => setProjectScope(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('departmentsLabel')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('departmentsHint')}
            </p>
            {involvedDepartments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('departmentsEmpty')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {involvedDepartments.map((d) => (
                  <span
                    key={d.id}
                    className="rounded-full border border-abak-blue/30 bg-abak-blue/5 px-3 py-1.5 text-sm text-abak-blue"
                  >
                    {d.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {!valid && (
          <p className="text-xs text-muted-foreground">
            {t('validationPrefix')}{' '}
            {[
              selected.size < 1 ? t('hintSelectService') : null,
              projectScope.trim().length < 10 ? t('hintAddScope') : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={!valid || submitting}>
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

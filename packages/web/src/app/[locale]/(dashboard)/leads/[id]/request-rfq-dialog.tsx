'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useServices } from '@/lib/hooks/use-leads';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Lead } from '@/lib/types/lead';

type RequestRfqResult = {
  data: { rfqId: string; rfqNumber: string; clientId: string; leadId: string };
};

/**
 * One-click "Request RFQ" from a lead (CORRECTED_CLIENT_JOURNEY Activity B).
 * Picking the departments is the most consequential field — it becomes the
 * per-department structure the manager assigns pricers to. Submitting
 * auto-qualifies the lead, ensures a client + opportunity, and creates the RFQ.
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
  const queryClient = useQueryClient();
  const { data: services } = useServices();
  const [serviceType, setServiceType] = useState('');
  const [projectScope, setProjectScope] = useState(lead.serviceDetails ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Distinct service categories = the "departments" that price a section.
  const departments = useMemo(() => {
    const map = new Map<string, string>();
    (services ?? []).forEach((s) => {
      if (s.category) map.set(s.category.id, s.category.name);
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [services]);

  const valid =
    serviceType.trim().length >= 3 &&
    projectScope.trim().length >= 10 &&
    selected.size >= 1;

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
      const { data } = await apiClient.post<RequestRfqResult>(
        `/leads/${lead.id}/request-rfq`,
        {
          serviceType: serviceType.trim(),
          projectScope: projectScope.trim(),
          departmentIds: [...selected],
        },
      );
      const res = data.data;
      toast.success(
        `${res.rfqNumber} created · lead qualified — assigned to the department manager(s) for triage`,
      );
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onOpenChange(false);
      router.push(`/rfqs/${res.rfqId}`);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to request RFQ';
      toast.error(
        Array.isArray(message) ? message.join(', ') : String(message),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request an RFQ</DialogTitle>
          <DialogDescription>
            Submitting this will qualify {lead.leadNumber}, create the client if
            needed, and open an RFQ for the departments you pick below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="serviceType">Service type</Label>
            <Input
              id="serviceType"
              placeholder="e.g. Architectural + Surveying + Safety"
              value={serviceType}
              onChange={(event) => setServiceType(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectScope">Project scope / brief</Label>
            <Textarea
              id="projectScope"
              rows={3}
              placeholder="Short brief of what the client needs (min 10 chars)."
              value={projectScope}
              onChange={(event) => setProjectScope(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Departments to price this RFQ{' '}
              <span className="text-muted-foreground">
                (pick every department that will price a section)
              </span>
            </Label>
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Loading departments…
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {departments.map((d) => {
                  const on = selected.has(d.id);
                  return (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => toggle(d.id)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-sm transition',
                        on
                          ? 'border-abak-blue bg-abak-blue text-white'
                          : 'border-input bg-background hover:border-abak-blue',
                      )}
                    >
                      {on ? '✓ ' : ''}
                      {d.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || submitting}>
            {submitting ? 'Requesting…' : 'Request RFQ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

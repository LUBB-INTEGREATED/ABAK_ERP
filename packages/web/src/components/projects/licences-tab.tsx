'use client';

/**
 * Licences tab on the project detail page.
 *
 * Added 2026-05-21 per the process correction. Government licences are
 * project-scoped resources — each row carries the portal name + URL,
 * the request ID returned by the portal, applied/issued dates, and the
 * status. When a licence is wired to a phase as a dependency, the phase
 * cannot start until the licence flips to ISSUED — the project enters
 * PAUSED state and paused time is excluded from slip math.
 *
 * Anyone with project access can click the portal URL to manually check
 * the application's status on the portal (no portal API integration in
 * MVP). The Last-Checked timestamp on each row tells the team how stale
 * the local view is.
 *
 * See docs/CORRECTED_CLIENT_JOURNEY.md §5 + flows/b3-licence-lifecycle.md.
 */

import { useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  type Licence,
  type LicenceStatus,
  useCreateLicence,
  useProjectLicences,
  useUpdateLicence,
} from '@/lib/hooks/use-licences';

type ProjectPhaseLite = {
  id: string;
  name: string;
};

const STATUS_LABELS: Record<LicenceStatus, string> = {
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Under review',
  ISSUED: 'Issued',
  REJECTED: 'Rejected',
};

function statusTone(status: LicenceStatus) {
  switch (status) {
    case 'ISSUED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'REJECTED':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'UNDER_REVIEW':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'APPLIED':
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function statusIcon(status: LicenceStatus) {
  switch (status) {
    case 'ISSUED':
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case 'REJECTED':
      return <XCircle className="h-3.5 w-3.5" />;
    case 'UNDER_REVIEW':
      return <AlertTriangle className="h-3.5 w-3.5" />;
    case 'APPLIED':
    default:
      return <Clock className="h-3.5 w-3.5" />;
  }
}

export function LicencesTab({
  projectId,
  phases,
}: {
  projectId: string;
  phases: ProjectPhaseLite[];
}) {
  const { data: licences = [], isLoading } = useProjectLicences(projectId);
  const [addOpen, setAddOpen] = useState(false);

  const blocking = licences.filter(
    (l) => l.status !== 'ISSUED' && l.blockedPhases.length > 0,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base font-semibold">
              Government licences
            </CardTitle>
            <CardDescription>
              Project-scoped. Add the licence when applying on the portal; track
              status here. Wire it to a phase to hard-block that phase from
              starting until it's issued.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add licence
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : licences.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No licences on this project yet. Add the first one when you file
              the application on Balady / Salama / MODON / etc.
            </p>
          ) : (
            <ul className="space-y-3">
              {licences.map((licence) => (
                <LicenceRow
                  key={licence.id}
                  licence={licence}
                  projectId={projectId}
                  phases={phases}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {blocking.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-900">
                Project paused — waiting on{' '}
                {blocking.length === 1
                  ? '1 licence'
                  : `${blocking.length} licences`}
                .
              </p>
              <p className="mt-0.5 text-amber-800">
                Phases dependent on non-issued licences are hard-blocked from
                starting. Pause time is excluded from slip math.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <AddLicenceSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        projectId={projectId}
        phases={phases}
      />
    </div>
  );
}

function LicenceRow({
  licence,
  projectId,
  phases,
}: {
  licence: Licence;
  projectId: string;
  phases: ProjectPhaseLite[];
}) {
  const update = useUpdateLicence(projectId, licence.id);
  const [editing, setEditing] = useState(false);

  async function changeStatus(status: LicenceStatus) {
    if (status === licence.status) return;
    if (status === 'REJECTED') {
      const reason = window.prompt(
        'Reason for rejection (required to record):',
      );
      if (!reason) return;
      try {
        await update.mutateAsync({ status, rejectionReason: reason });
        toast.success('Licence marked rejected.');
      } catch {
        toast.error('Failed to update licence.');
      }
      return;
    }
    try {
      await update.mutateAsync({ status });
      toast.success(
        status === 'ISSUED'
          ? 'Licence issued — dependent phases unblocked.'
          : 'Status updated.',
      );
    } catch {
      toast.error('Failed to update licence.');
    }
  }

  return (
    <li className="rounded-md border bg-card p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-semibold">{licence.name}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {licence.portalName}
            </span>
            {licence.requestId && (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {licence.requestId}
                </span>
              </>
            )}
            <span
              className={`ms-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${statusTone(
                licence.status,
              )}`}
            >
              {statusIcon(licence.status)}
              {STATUS_LABELS[licence.status]}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Applied {format(new Date(licence.appliedDate), 'PP')}</span>
            {licence.issuedDate && (
              <span>Issued {format(new Date(licence.issuedDate), 'PP')}</span>
            )}
            {licence.lastCheckedAt && (
              <span>
                Last checked{' '}
                {formatDistanceToNowStrict(new Date(licence.lastCheckedAt), {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>

          {licence.blockedPhases.length > 0 && (
            <p className="text-xs">
              <span className="font-medium">Blocks: </span>
              <span className="text-muted-foreground">
                {licence.blockedPhases.map((p) => p.name).join(', ')}
              </span>
            </p>
          )}

          {licence.rejectionReason && (
            <p className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">
              Rejection: {licence.rejectionReason}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          {licence.portalUrl && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="w-full md:w-auto"
            >
              <a
                href={licence.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open on portal
              </a>
            </Button>
          )}
          <Select
            value={licence.status}
            onValueChange={(v) => changeStatus(v as LicenceStatus)}
          >
            <SelectTrigger className="h-8 w-full md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as LicenceStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            className="w-full md:w-auto"
          >
            Edit dependencies
          </Button>
        </div>
      </div>

      {editing && (
        <EditDependenciesSheet
          open={editing}
          onOpenChange={setEditing}
          projectId={projectId}
          licence={licence}
          phases={phases}
        />
      )}
    </li>
  );
}

function AddLicenceSheet({
  open,
  onOpenChange,
  projectId,
  phases,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  phases: ProjectPhaseLite[];
}) {
  const mutation = useCreateLicence(projectId);
  const [name, setName] = useState('');
  const [portalName, setPortalName] = useState('Balady');
  const [portalUrl, setPortalUrl] = useState('');
  const [requestId, setRequestId] = useState('');
  const [appliedDate, setAppliedDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState('');
  const [selectedPhaseIds, setSelectedPhaseIds] = useState<Set<string>>(
    new Set(),
  );

  function togglePhase(id: string) {
    setSelectedPhaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (name.trim().length < 2) {
      toast.error('Add a licence name.');
      return;
    }
    if (portalName.trim().length < 1) {
      toast.error('Add the portal name.');
      return;
    }
    try {
      await mutation.mutateAsync({
        name: name.trim(),
        portalName: portalName.trim(),
        portalUrl: portalUrl.trim() || undefined,
        requestId: requestId.trim() || undefined,
        appliedDate,
        notes: notes.trim() || undefined,
        blockedPhaseIds: Array.from(selectedPhaseIds),
      });
      toast.success('Licence added.');
      setName('');
      setPortalUrl('');
      setRequestId('');
      setNotes('');
      setSelectedPhaseIds(new Set());
      onOpenChange(false);
    } catch {
      toast.error('Failed to add licence.');
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add licence</SheetTitle>
          <SheetDescription>
            Record the application you just filed on the government portal. You
            can wire it to phases below to hard-block phase start until the
            licence is issued.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="lic-name">Licence name *</Label>
            <Input
              id="lic-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Building Permit, Civil Defense Approval"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lic-portal">Portal *</Label>
              <Input
                id="lic-portal"
                value={portalName}
                onChange={(e) => setPortalName(e.target.value)}
                list="portal-options"
                className="mt-1"
              />
              <datalist id="portal-options">
                <option value="Balady" />
                <option value="Salama Gateway" />
                <option value="HCIS" />
                <option value="MODON" />
                <option value="Etimad" />
                <option value="Fursa" />
                <option value="Subdivision platform" />
              </datalist>
            </div>
            <div>
              <Label htmlFor="lic-applied">Applied date *</Label>
              <Input
                id="lic-applied"
                type="date"
                value={appliedDate}
                onChange={(e) => setAppliedDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="lic-url">Portal URL (optional)</Label>
            <Input
              id="lic-url"
              type="url"
              value={portalUrl}
              onChange={(e) => setPortalUrl(e.target.value)}
              placeholder="https://balady.gov.sa/…"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              The team will click this to check status on the portal.
            </p>
          </div>

          <div>
            <Label htmlFor="lic-req">Request ID (if returned)</Label>
            <Input
              id="lic-req"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              placeholder="e.g. BLDG-PRM-7821"
              className="mt-1 font-mono"
            />
          </div>

          {phases.length > 0 && (
            <div>
              <Label>Block phases until issued</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick phases that cannot start until this licence is issued.
              </p>
              <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
                {phases.map((phase) => (
                  <label
                    key={phase.id}
                    className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPhaseIds.has(phase.id)}
                      onChange={() => togglePhase(phase.id)}
                    />
                    <span className="text-sm">{phase.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="lic-notes">Notes</Label>
            <Textarea
              id="lic-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Add licence'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function EditDependenciesSheet({
  open,
  onOpenChange,
  projectId,
  licence,
  phases,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  licence: Licence;
  phases: ProjectPhaseLite[];
}) {
  const update = useUpdateLicence(projectId, licence.id);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(licence.blockedPhases.map((p) => p.id)),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    try {
      await update.mutateAsync({ blockedPhaseIds: Array.from(selected) });
      toast.success('Dependencies updated.');
      onOpenChange(false);
    } catch {
      toast.error('Failed to update dependencies.');
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit phase dependencies</SheetTitle>
          <SheetDescription>
            Pick the phases that cannot start until{' '}
            <strong>{licence.name}</strong> is issued.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 max-h-80 space-y-1 overflow-y-auto rounded-md border p-2">
          {phases.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No phases on this project yet.
            </p>
          ) : (
            phases.map((phase) => (
              <label
                key={phase.id}
                className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selected.has(phase.id)}
                  onChange={() => toggle(phase.id)}
                />
                <span className="text-sm">{phase.name}</span>
              </label>
            ))
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={update.isPending}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

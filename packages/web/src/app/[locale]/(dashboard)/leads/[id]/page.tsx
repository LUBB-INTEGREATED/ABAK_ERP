'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Pencil,
  Repeat2,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  LeadPriorityBadge,
  LeadStatusBadge,
  SlaStatusBadge,
} from '@/components/ui/entity-status-badges';
import { useDeleteLead, useLead } from '@/lib/hooks/use-leads';
import { CHANNEL_LABELS } from '@/lib/lead-ui';
import type { Lead } from '@/lib/types/lead';
import { StatusDialog } from './status-dialog';
import { AssignDialog } from './assign-dialog';
import { EditDialog } from './edit-dialog';
import { ConvertLeadDialog } from './convert-dialog';

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { data: lead, isLoading, isError, error } = useLead(id);
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const deleteMutation = useDeleteLead(id);

  if (isLoading) {
    return <DetailSkeleton />;
  }
  if (isError || !lead) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-10 text-center text-destructive">
            {error instanceof Error ? error.message : 'Lead not found.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  async function deleteLead() {
    try {
      await deleteMutation.mutateAsync();
      toast.success('Lead archived');
      router.push('/leads');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to delete';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <Card>
        <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-mono text-sm text-muted-foreground">
              {lead.leadNumber}
            </div>
            <h1 className="text-2xl font-bold text-abak-blue">
              {lead.contactName}
            </h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {lead.companyName ?? 'Individual contact'}
              {lead.isReturningClient && (
                <span className="ml-2 inline-flex items-center gap-1 text-abak-gold">
                  <BadgeCheck className="h-3.5 w-3.5" /> Returning
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LeadStatusBadge status={lead.status} size="md" />
            <LeadPriorityBadge priority={lead.priority} dot size="md" />
            <SlaStatusBadge status={lead.slaStatus} dot size="md" />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setStatusOpen(true)}>
          <ArrowRight className="mr-2 h-4 w-4" /> Change status
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />{' '}
          {lead.assignedToId ? 'Reassign' : 'Assign'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
        {!['DISQUALIFIED', 'TENDER_WON', 'TENDER_LOST'].includes(
          lead.status,
        ) && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setConvertOpen(true)}
          >
            <Repeat2 className="mr-2 h-4 w-4" /> تحويل إلى عميل
          </Button>
        )}
        {lead.clientId && (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/clients/${lead.clientId}`}>Open client →</Link>
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Archive
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Contact">
          <Row label="Phone" value={lead.phone} />
          <Row label="Alt phone" value={lead.alternatePhone} />
          <Row label="Email" value={lead.email} />
        </Section>

        <Section title="Service request">
          <Row label="Service" value={lead.service?.name} />
          <Row label="Details" value={lead.serviceDetails} />
          <Row label="Location" value={lead.projectLocation} />
          <Row label="Size" value={lead.projectSize} />
          <Row
            label="Budget"
            value={
              lead.budget !== null
                ? `${lead.budget.toLocaleString()} SAR`
                : null
            }
          />
          <Row label="Timeline" value={lead.timeline} />
        </Section>

        <Section title="Channel">
          <Row label="Channel" value={CHANNEL_LABELS[lead.channel]} />
          <Row label="Source" value={lead.source} />
          <Row label="Reference" value={lead.referenceNumber} />
          <ChannelSpecific lead={lead} />
        </Section>

        <Section title="Assignment & SLA">
          <Row
            label="Assignee"
            value={
              lead.assignedTo
                ? [lead.assignedTo.firstName, lead.assignedTo.lastName]
                    .filter(Boolean)
                    .join(' ') || lead.assignedTo.email
                : 'Unassigned'
            }
          />
          <Row
            label="Assigned at"
            value={lead.assignedAt ? formatDate(lead.assignedAt) : null}
          />
          <Row
            label="Response due"
            value={lead.slaResponseDue ? formatDate(lead.slaResponseDue) : null}
          />
          <Row
            label="First response"
            value={
              lead.firstResponseAt ? formatDate(lead.firstResponseAt) : null
            }
          />
        </Section>

        <Section title="Qualification">
          <Row
            label="Score"
            value={
              lead.qualificationScore !== null
                ? `${lead.qualificationScore} / 100`
                : null
            }
          />
          <Row label="Notes" value={lead.qualificationNotes} />
          {lead.lostReason && (
            <Row label="Lost reason" value={lead.lostReason} />
          )}
        </Section>

        <Section title="Audit">
          <Row label="Created" value={formatDate(lead.createdAt)} />
          <Row label="Updated" value={formatDate(lead.updatedAt)} />
          {lead.closedAt && (
            <Row label="Closed" value={formatDate(lead.closedAt)} />
          )}
        </Section>
      </div>

      <StatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        leadId={lead.id}
        currentStatus={lead.status}
      />
      <AssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        leadId={lead.id}
        currentAssigneeId={lead.assignedToId}
      />
      <EditDialog open={editOpen} onOpenChange={setEditOpen} lead={lead} />
      <ConvertLeadDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        lead={lead}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive lead?</DialogTitle>
            <DialogDescription>
              The lead stays in the database but is hidden from the list. This
              is reversible by support only.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteLead}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Archiving…' : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/leads"
      className="inline-flex items-center gap-1 text-sm text-abak-blue hover:underline"
    >
      <ArrowLeft className="h-4 w-4" /> Back to leads
    </Link>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">
        {value && value !== '' ? value : '—'}
      </span>
    </div>
  );
}

function ChannelSpecific({ lead }: { lead: Lead }) {
  switch (lead.channel) {
    case 'GOVERNMENT_TENDER':
      return (
        <>
          <Row label="Etimad #" value={lead.etimadNumber} />
          <Row label="Fursa #" value={lead.fursaNumber} />
          <Row
            label="Tender deadline"
            value={lead.tenderDeadline ? formatDate(lead.tenderDeadline) : null}
          />
        </>
      );
    case 'REFERRAL':
      return (
        <>
          <Row label="Referred by" value={lead.referredBy} />
          <Row label="Referrer phone" value={lead.referrerPhone} />
          <Row label="Referrer company" value={lead.referrerCompany} />
        </>
      );
    case 'SOCIAL_MEDIA':
      return (
        <>
          <Row label="Platform" value={lead.socialPlatform} />
          <Row label="Profile" value={lead.socialProfile} />
        </>
      );
    case 'GOOGLE_MAPS':
      return (
        <>
          <Row label="Maps link" value={lead.mapsLink} />
          <Row
            label="Left review?"
            value={
              lead.mapsReview === null ? null : lead.mapsReview ? 'Yes' : 'No'
            }
          />
        </>
      );
    default:
      return null;
  }
}

function formatDate(iso: string) {
  return format(new Date(iso), 'PPp');
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="h-32 w-full animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-40 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

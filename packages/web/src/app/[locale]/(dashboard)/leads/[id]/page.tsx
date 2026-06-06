'use client';

import { useParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowRight,
  BadgeCheck,
  ExternalLink,
  FileSearch,
  MoreHorizontal,
  Pencil,
  Repeat2,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LeadPriorityBadge,
  LeadStatusBadge,
  SlaStatusBadge,
} from '@/components/ui/entity-status-badges';
import {
  DetailBody,
  DetailError,
  DetailHeader,
  DetailRail,
  DetailSection,
  DetailSkeleton,
  Field,
  FieldGrid,
} from '@/components/detail/detail-shell';
import { useDeleteLead, useLead } from '@/lib/hooks/use-leads';
import { CHANNEL_LABELS } from '@/lib/lead-ui';
import type { Lead } from '@/lib/types/lead';
import { StatusDialog } from './status-dialog';
import { AssignDialog } from './assign-dialog';
import { EditDialog } from './edit-dialog';
import { ConvertLeadDialog } from './convert-dialog';
import { RequestRfqDialog } from './request-rfq-dialog';
import { CommunicationsLog } from '@/components/leads/communications-log';

const TERMINAL = ['DISQUALIFIED', 'TENDER_WON', 'TENDER_LOST'];
const BACK_HREF = '/leads';

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('detail');
  const tLead = useTranslations('leadDetail');
  const id = params.id;
  const { data: lead, isLoading, isError, error } = useLead(id);
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [rfqOpen, setRfqOpen] = useState(false);
  const deleteMutation = useDeleteLead(id);

  if (isLoading) return <DetailSkeleton />;
  if (isError || !lead) {
    return (
      <DetailError
        backHref={BACK_HREF}
        backLabel={t('backToLeads')}
        message={error instanceof Error ? error.message : t('leadNotFound')}
      />
    );
  }

  async function deleteLead() {
    try {
      await deleteMutation.mutateAsync();
      toast.success(t('leadArchived'));
      router.push('/leads');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('failedToDelete');
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  const canRfq = !TERMINAL.includes(lead.status);
  const canConvert = !lead.clientId && canRfq;
  const assigneeName = lead.assignedTo
    ? [lead.assignedTo.firstName, lead.assignedTo.lastName]
        .filter(Boolean)
        .join(' ') || lead.assignedTo.email
    : t('unassigned');

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref={BACK_HREF}
        backLabel={t('backToLeads')}
        eyebrow={lead.leadNumber}
        title={lead.contactName}
        subtitle={
          <span className="inline-flex items-center gap-2">
            {lead.companyName ?? t('individualContact')}
            {lead.isReturningClient && (
              <span className="inline-flex items-center gap-1 text-abak-gold">
                <BadgeCheck className="h-3.5 w-3.5" /> {t('returning')}
              </span>
            )}
          </span>
        }
        badges={
          <>
            <LeadStatusBadge status={lead.status} size="md" />
            <LeadPriorityBadge priority={lead.priority} dot size="md" />
            <SlaStatusBadge status={lead.slaStatus} dot size="md" />
          </>
        }
        primary={
          canRfq ? (
            <Button size="sm" onClick={() => setRfqOpen(true)}>
              <FileSearch className="me-2 h-4 w-4" /> {t('requestRfq')}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStatusOpen(true)}>
              <ArrowRight className="me-2 h-4 w-4 rtl:rotate-180" />{' '}
              {t('changeStatus')}
            </Button>
          )
        }
        actions={
          <>
            {canRfq && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatusOpen(true)}
              >
                <ArrowRight className="me-2 h-4 w-4 rtl:rotate-180" />{' '}
                {t('changeStatus')}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAssignOpen(true)}
            >
              <UserPlus className="me-2 h-4 w-4" />{' '}
              {lead.assignedToId ? t('reassign') : t('assign')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="me-2 h-4 w-4" /> {t('edit')}
            </Button>
            {canConvert && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConvertOpen(true)}
              >
                <Repeat2 className="me-2 h-4 w-4" /> {tLead('convertToClient')}
              </Button>
            )}
          </>
        }
        menu={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                aria-label={t('moreActions')}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {lead.clientId && (
                <DropdownMenuItem asChild>
                  <Link href={`/clients/${lead.clientId}`}>
                    <ExternalLink className="me-2 h-4 w-4" /> {t('openClient')}
                  </Link>
                </DropdownMenuItem>
              )}
              {lead.clientId && <DropdownMenuSeparator />}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="me-2 h-4 w-4" /> {t('archiveLead')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <DetailBody
        rail={
          <>
            <DetailRail title={t('atAGlance')}>
              <FieldGrid cols={1}>
                <Field label={t('assignee')}>{assigneeName}</Field>
                <Field label={t('channel')}>
                  {CHANNEL_LABELS[lead.channel]}
                </Field>
                <Field
                  label={t('estimatedBudget')}
                  emphasis="money"
                  value={
                    lead.budget !== null
                      ? `${lead.budget.toLocaleString()} SAR`
                      : null
                  }
                />
                <Field
                  label={t('qualificationScore')}
                  emphasis="strong"
                  value={
                    lead.qualificationScore !== null
                      ? `${lead.qualificationScore} / 100`
                      : null
                  }
                />
                <Field
                  label={t('slaResponseDue')}
                  emphasis="strong"
                  value={lead.slaResponseDue ? fmt(lead.slaResponseDue) : null}
                />
                <Field
                  label={t('firstResponse')}
                  value={
                    lead.firstResponseAt ? fmt(lead.firstResponseAt) : null
                  }
                />
              </FieldGrid>
            </DetailRail>

            <DetailRail title={t('contact')}>
              <FieldGrid cols={1}>
                <Field label={t('phone')} emphasis="mono" value={lead.phone} />
                <Field
                  label={t('altPhone')}
                  emphasis="mono"
                  value={lead.alternatePhone}
                />
                <Field label={t('email')} value={lead.email} />
              </FieldGrid>
            </DetailRail>

            <DetailRail title={t('record')}>
              <FieldGrid cols={1}>
                <Field
                  label={t('created')}
                  emphasis="muted"
                  value={fmt(lead.createdAt)}
                />
                <Field
                  label={t('updated')}
                  emphasis="muted"
                  value={fmt(lead.updatedAt)}
                />
                {lead.assignedAt && (
                  <Field
                    label={t('assigned')}
                    emphasis="muted"
                    value={fmt(lead.assignedAt)}
                  />
                )}
                {lead.closedAt && (
                  <Field
                    label={t('closed')}
                    emphasis="muted"
                    value={fmt(lead.closedAt)}
                  />
                )}
              </FieldGrid>
            </DetailRail>
          </>
        }
      >
        <CommunicationsLog leadId={lead.id} />

        <DetailSection title={t('serviceRequest')}>
          <FieldGrid>
            <Field label={t('service')} value={lead.service?.name} />
            <Field label={t('location')} value={lead.projectLocation} />
            <Field label={t('city')} value={lead.city} />
            <Field label={t('district')} value={lead.district} />
            <Field label={t('projectSize')} value={lead.projectSize} />
            <Field label={t('timeline')} value={lead.timeline} />
            <Field
              label={t('budget')}
              emphasis="money"
              value={
                lead.budget !== null
                  ? `${lead.budget.toLocaleString()} SAR`
                  : null
              }
            />
            <Field
              label={t('details')}
              className="sm:col-span-2"
              value={lead.serviceDetails}
            />
          </FieldGrid>
        </DetailSection>

        <DetailSection title={t('leadSource')}>
          <FieldGrid>
            <Field label={t('channel')} value={CHANNEL_LABELS[lead.channel]} />
            <Field label={t('source')} value={lead.source} />
            <Field
              label={t('reference')}
              emphasis="mono"
              value={lead.referenceNumber}
            />
            <ChannelSpecificFields lead={lead} />
          </FieldGrid>
        </DetailSection>

        {(lead.qualificationNotes || lead.lostReason) && (
          <DetailSection title={t('qualification')}>
            <FieldGrid cols={1}>
              <Field label={t('notes')} value={lead.qualificationNotes} />
              {lead.lostReason && (
                <Field label={t('lostReason')} value={lead.lostReason} />
              )}
            </FieldGrid>
          </DetailSection>
        )}
      </DetailBody>

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
      <RequestRfqDialog open={rfqOpen} onOpenChange={setRfqOpen} lead={lead} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('archiveLeadTitle')}</DialogTitle>
            <DialogDescription>{t('archiveLeadDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={deleteLead}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t('archiving') : t('archive')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChannelSpecificFields({ lead }: { lead: Lead }) {
  const t = useTranslations('detail');
  switch (lead.channel) {
    case 'REFERRAL':
      return (
        <>
          <Field label={t('referredBy')} value={lead.referredBy} />
          <Field
            label={t('referrerPhone')}
            emphasis="mono"
            value={lead.referrerPhone}
          />
          <Field label={t('referrerCompany')} value={lead.referrerCompany} />
        </>
      );
    case 'SOCIAL_MEDIA':
      return (
        <>
          <Field label={t('platform')} value={lead.socialPlatform} />
          <Field label={t('profile')} value={lead.socialProfile} />
        </>
      );
    case 'GOOGLE_MAPS':
      return (
        <>
          <Field label={t('mapsLink')} value={lead.mapsLink} />
          <Field
            label={t('leftReview')}
            value={
              lead.mapsReview === null
                ? null
                : lead.mapsReview
                  ? t('yes')
                  : t('no')
            }
          />
        </>
      );
    default:
      return null;
  }
}

function fmt(iso: string) {
  return format(new Date(iso), 'PPp');
}

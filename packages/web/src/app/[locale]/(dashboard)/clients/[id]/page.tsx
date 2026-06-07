'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  BadgeCheck,
  MessageSquare,
  CalendarCheck,
  StickyNote,
  Pencil,
  Trash2,
  Phone,
  MapPin,
  Building2,
  Wallet,
  MoreHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClientClassificationBadge,
  ClientStatusBadge,
  FollowUpStatusBadge,
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
  RailStat,
} from '@/components/detail/detail-shell';
import { cn } from '@/lib/utils';
import {
  useArchiveClient,
  useClient,
  useClientInteractions,
  useClientFollowUps,
  useClientNotes,
} from '@/lib/hooks/use-clients';
import { type Client, type NoteTag } from '@/lib/types/client';
import { useEnumLabel } from '@/lib/i18n/enum-labels';
import { isForbiddenError } from '@/lib/api-client';
import { NoAccess } from '@/components/auth/no-access';
import { ClassifyDialog } from './classify-dialog';
import { EditClientDialog } from './edit-dialog';
import { InteractionDialog } from './interaction-dialog';
import { FollowUpDialog } from './follow-up-dialog';
import { CloseFollowUpDialog } from './close-follow-up-dialog';
import { NoteDialog } from './note-dialog';

const BACK_HREF = '/clients';

const NOTE_BADGE: Record<NoteTag, string> = {
  GENERAL: 'bg-zinc-100 text-zinc-600',
  IMPORTANT: 'bg-abak-blue/10 text-abak-blue',
  ISSUE: 'bg-rose-100 text-rose-700',
  OPPORTUNITY: 'bg-abak-gold/20 text-abak-gold',
};

function useDateLocale() {
  const locale = useLocale();
  return locale === 'ar' ? arLocale : undefined;
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('clients.detail');
  const td = useTranslations('detail');
  const locale = useLocale();
  const dateLocale = useDateLocale();
  const numLocale = locale === 'ar' ? 'ar-SA' : 'en-US';
  const id = params.id;
  const { data: client, isLoading, isError, error } = useClient(id);
  const archive = useArchiveClient(id);

  const [editOpen, setEditOpen] = useState(false);
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  if (isLoading) return <DetailSkeleton />;
  // A 403 = the record belongs to another owner/team (scope IS enforced) — show
  // a friendly no-access page, never the raw "Request failed with status code 403"
  // axios string (FE-5 / RBAC-P2-1).
  if (isForbiddenError(error)) {
    return <NoAccess variant="record" />;
  }
  if (isError || !client) {
    return (
      <DetailError
        backHref={BACK_HREF}
        backLabel={t('backToList')}
        message={error instanceof Error ? error.message : t('notFound')}
      />
    );
  }

  async function onArchive() {
    try {
      await archive.mutateAsync();
      toast.success(t('archived'));
      router.push('/clients');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('archiveFailed');
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  const initials = client.contactName
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const manager = client.accountManager
    ? [client.accountManager.firstName, client.accountManager.lastName]
        .filter(Boolean)
        .join(' ') || client.accountManager.email
    : t('unassigned');

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref={BACK_HREF}
        backLabel={t('backToList')}
        eyebrow={client.clientNumber}
        title={
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-abak-blue/10 text-base font-semibold text-abak-blue">
              {initials}
            </span>
            <span className="truncate">{client.contactName}</span>
          </span>
        }
        subtitle={
          <span className="inline-flex items-center gap-2">
            {client.companyName ?? t('individualContact')}
            {client.classificationManual && (
              <span className="inline-flex items-center gap-1 text-abak-gold">
                <BadgeCheck className="h-3.5 w-3.5" /> {t('locked')}
              </span>
            )}
          </span>
        }
        badges={
          <>
            <ClientStatusBadge status={client.status} size="md" />
            <ClientClassificationBadge
              classification={client.classification}
              size="md"
            />
            {client.satisfactionScore !== null && (
              <Badge variant="outline">
                {t('satisfaction', { score: client.satisfactionScore })}
              </Badge>
            )}
          </>
        }
        primary={
          <Button size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="me-2 h-4 w-4" /> {t('edit')}
          </Button>
        }
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setClassifyOpen(true)}
          >
            {t('reclassify')}
          </Button>
        }
        menu={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                aria-label={td('moreActions')}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="me-2 h-4 w-4" /> {t('archive')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <DetailBody
        rail={
          <DetailRail title={td('atAGlance')}>
            <RailStat
              label={t('lifetimeValueLabel')}
              value={`${client.lifetimeValue.toLocaleString(numLocale)} SAR`}
              tone="success"
            />
            <FieldGrid cols={1}>
              <Field label={t('accountManager')}>{manager}</Field>
              <Field label={t('cardCompany')}>
                <ClientClassificationBadge
                  classification={client.classification}
                  size="md"
                />
              </Field>
              <Field label={t('phone')} emphasis="mono" value={client.phone} />
              <Field label={t('email')} value={client.email} />
              <Field
                label={t('createdAt')}
                emphasis="muted"
                value={format(new Date(client.createdAt), 'PPp', {
                  locale: dateLocale,
                })}
              />
            </FieldGrid>
          </DetailRail>
        }
      >
        <Tabs defaultValue="profile">
          <TabsList className="w-full flex-wrap">
            <TabsTrigger value="profile">{t('tabProfile')}</TabsTrigger>
            <TabsTrigger value="interactions">
              {t('tabInteractions')}
              {client._count?.interactions
                ? ` (${client._count.interactions})`
                : ''}
            </TabsTrigger>
            <TabsTrigger value="follow-ups">
              {t('tabFollowUps')}
              {client._count?.followUps ? ` (${client._count.followUps})` : ''}
            </TabsTrigger>
            <TabsTrigger value="notes">
              {t('tabNotes')}
              {client._count?.notes ? ` (${client._count.notes})` : ''}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <ProfileTab client={client} />
          </TabsContent>
          <TabsContent value="interactions" className="mt-4">
            <InteractionsTab
              clientId={client.id}
              onAdd={() => setInteractionOpen(true)}
            />
          </TabsContent>
          <TabsContent value="follow-ups" className="mt-4">
            <FollowUpsTab
              clientId={client.id}
              onAdd={() => setFollowUpOpen(true)}
            />
          </TabsContent>
          <TabsContent value="notes" className="mt-4">
            <NotesTab clientId={client.id} onAdd={() => setNoteOpen(true)} />
          </TabsContent>
        </Tabs>
      </DetailBody>

      <EditClientDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
      />
      <ClassifyDialog
        open={classifyOpen}
        onOpenChange={setClassifyOpen}
        client={client}
      />
      <InteractionDialog
        open={interactionOpen}
        onOpenChange={setInteractionOpen}
        clientId={client.id}
      />
      <FollowUpDialog
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        clientId={client.id}
      />
      <NoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        clientId={client.id}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('archiveTitle')}</DialogTitle>
            <DialogDescription>{t('archiveDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t('archiveCancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={onArchive}
              disabled={archive.isPending}
            >
              {archive.isPending ? t('archiving') : t('archive')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileTab({ client }: { client: Client }) {
  const t = useTranslations('clients.detail');
  const locale = useLocale();
  const dateLocale = useDateLocale();
  const numLocale = locale === 'ar' ? 'ar-SA' : 'en-US';

  const manager = client.accountManager
    ? [client.accountManager.firstName, client.accountManager.lastName]
        .filter(Boolean)
        .join(' ') || client.accountManager.email
    : t('unassigned');

  return (
    <div className="space-y-6">
      <DetailSection title={t('cardContact')} icon={Phone}>
        <FieldGrid>
          <Field label={t('phone')} emphasis="mono" value={client.phone} />
          <Field
            label={t('altPhone')}
            emphasis="mono"
            value={client.alternatePhone}
          />
          <Field label={t('email')} value={client.email} />
          <Field label={t('website')} value={client.website} />
        </FieldGrid>
      </DetailSection>

      <DetailSection title={t('cardAddress')} icon={MapPin}>
        <FieldGrid>
          <Field label={t('line1')} value={client.addressLine1} />
          <Field label={t('line2')} value={client.addressLine2} />
          <Field label={t('city')} value={client.city} />
          <Field label={t('region')} value={client.region} />
          <Field label={t('country')} value={client.country} />
          <Field label={t('postal')} value={client.postalCode} />
        </FieldGrid>
      </DetailSection>

      <DetailSection title={t('cardCompany')} icon={Building2}>
        <FieldGrid>
          <Field
            label={t('commercialRegLabel')}
            emphasis="mono"
            value={client.commercialRegistration}
          />
          <Field label={t('taxIdLabel')} emphasis="mono" value={client.taxId} />
        </FieldGrid>
      </DetailSection>

      <DetailSection title={t('cardAccount')} icon={Wallet}>
        <FieldGrid>
          <Field label={t('accountManager')}>{manager}</Field>
          <Field
            label={t('lifetimeValueLabel')}
            emphasis="money"
            value={`${client.lifetimeValue.toLocaleString(numLocale)} SAR`}
          />
          <Field
            label={t('creditLimitLabel')}
            emphasis="money"
            value={
              client.creditLimit !== null
                ? `${client.creditLimit.toLocaleString(numLocale)} SAR`
                : null
            }
          />
          <Field label={t('paymentTermsLabel')} value={client.paymentTerms} />
          <Field
            label={t('lastInteraction')}
            value={
              client.lastInteractionAt
                ? formatDistanceToNow(new Date(client.lastInteractionAt), {
                    addSuffix: true,
                    locale: dateLocale,
                  })
                : null
            }
          />
          <Field
            label={t('createdAt')}
            value={format(new Date(client.createdAt), 'PPp', {
              locale: dateLocale,
            })}
          />
        </FieldGrid>
      </DetailSection>
    </div>
  );
}

function InteractionsTab({
  clientId,
  onAdd,
}: {
  clientId: string;
  onAdd: () => void;
}) {
  const t = useTranslations('clients.detail');
  const interactionTypeLabel = useEnumLabel('interactionType');
  const directionLabel = useEnumLabel('interactionDirection');
  const dateLocale = useDateLocale();
  const { data, isLoading } = useClientInteractions(clientId);
  return (
    <DetailSection
      title={t('tabInteractions')}
      icon={MessageSquare}
      action={
        <Button size="sm" onClick={onAdd}>
          <MessageSquare className="me-2 h-4 w-4" /> {t('logInteraction')}
        </Button>
      }
    >
      <div className="space-y-3">
        {isLoading && (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        )}
        {!isLoading && data?.data.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t('noInteractionsLogged')}
          </p>
        )}
        <ol className="relative space-y-3 border-s ps-4">
          {data?.data.map((interaction) => (
            <li key={interaction.id} className="relative">
              <span className="absolute -start-[23px] top-2 h-3 w-3 rounded-full bg-abak-blue" />
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{interaction.subject}</div>
                      <div className="text-xs text-muted-foreground">
                        {interactionTypeLabel(interaction.type)}
                        {interaction.direction
                          ? ` · ${directionLabel(interaction.direction)}`
                          : ''}
                        {interaction.durationMinutes
                          ? ` · ${interaction.durationMinutes}m`
                          : ''}
                        {' · '}
                        {format(new Date(interaction.occurredAt), 'PPp', {
                          locale: dateLocale,
                        })}
                      </div>
                    </div>
                    {interaction.author && (
                      <span className="text-xs text-muted-foreground">
                        {t('by')}{' '}
                        {[
                          interaction.author.firstName,
                          interaction.author.lastName,
                        ]
                          .filter(Boolean)
                          .join(' ') || interaction.author.email}
                      </span>
                    )}
                  </div>
                  {interaction.summary && (
                    <p className="mt-2 text-sm">{interaction.summary}</p>
                  )}
                  {(interaction.location ||
                    interaction.outcome ||
                    interaction.nextAction) && (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {interaction.location && (
                        <div>
                          {t('location')}: {interaction.location}
                        </div>
                      )}
                      {interaction.outcome && (
                        <div>
                          {t('outcomeLabel')}: {interaction.outcome}
                        </div>
                      )}
                      {interaction.nextAction && (
                        <div>
                          {t('nextAction')}: {interaction.nextAction}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </DetailSection>
  );
}

function FollowUpsTab({
  clientId,
  onAdd,
}: {
  clientId: string;
  onAdd: () => void;
}) {
  const t = useTranslations('clients.detail');
  const followUpTypeLabel = useEnumLabel('followUpType');
  const dateLocale = useDateLocale();
  const { data, isLoading } = useClientFollowUps(clientId);
  const [closingId, setClosingId] = useState<string | null>(null);

  return (
    <DetailSection
      title={t('tabFollowUps')}
      icon={CalendarCheck}
      action={
        <Button size="sm" onClick={onAdd}>
          <CalendarCheck className="me-2 h-4 w-4" /> {t('scheduleFollowUp')}
        </Button>
      }
    >
      <div className="space-y-3">
        {isLoading && (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        )}
        {!isLoading && data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t('noFollowUpsScheduled')}
          </p>
        )}
        <ul className="space-y-2">
          {data?.map((followUp) => {
            const canClose =
              followUp.status !== 'COMPLETED' &&
              followUp.status !== 'CANCELLED';
            return (
              <li key={followUp.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-3 py-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{followUp.title}</span>
                        <FollowUpStatusBadge status={followUp.status} />
                        <Badge variant="outline">
                          {followUpTypeLabel(followUp.type)}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t('due', {
                          date: format(new Date(followUp.dueAt), 'PPp', {
                            locale: dateLocale,
                          }),
                        })}
                        {followUp.assignedTo && (
                          <>
                            {' · '}
                            {[
                              followUp.assignedTo.firstName,
                              followUp.assignedTo.lastName,
                            ]
                              .filter(Boolean)
                              .join(' ') || followUp.assignedTo.email}
                          </>
                        )}
                      </div>
                      {followUp.description && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {followUp.description}
                        </p>
                      )}
                      {followUp.outcome && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('outcomeLabel')}: {followUp.outcome}
                        </p>
                      )}
                    </div>
                    {canClose && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setClosingId(followUp.id)}
                      >
                        {t('close')}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>

        <CloseFollowUpDialog
          open={closingId !== null}
          onOpenChange={(open) => {
            if (!open) setClosingId(null);
          }}
          followUpId={closingId ?? ''}
          clientId={clientId}
        />
      </div>
    </DetailSection>
  );
}

function NotesTab({
  clientId,
  onAdd,
}: {
  clientId: string;
  onAdd: () => void;
}) {
  const t = useTranslations('clients.detail');
  const noteTagLabel = useEnumLabel('noteTag');
  const dateLocale = useDateLocale();
  const { data, isLoading } = useClientNotes(clientId);
  return (
    <DetailSection
      title={t('tabNotes')}
      icon={StickyNote}
      action={
        <Button size="sm" onClick={onAdd}>
          <StickyNote className="me-2 h-4 w-4" /> {t('addNote')}
        </Button>
      }
    >
      <div className="space-y-3">
        {isLoading && (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        )}
        {!isLoading && data?.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('noNotesYet')}</p>
        )}
        <ul className="space-y-3">
          {data?.map((note) => (
            <li key={note.id}>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <Badge
                      className={cn('border-transparent', NOTE_BADGE[note.tag])}
                    >
                      {noteTagLabel(note.tag)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(note.createdAt), {
                        addSuffix: true,
                        locale: dateLocale,
                      })}
                      {note.author &&
                        ` · ${
                          [note.author.firstName, note.author.lastName]
                            .filter(Boolean)
                            .join(' ') || note.author.email
                        }`}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {note.body}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </DetailSection>
  );
}

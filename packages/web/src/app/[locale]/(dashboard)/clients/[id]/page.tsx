'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BadgeCheck,
  MessageSquare,
  CalendarCheck,
  StickyNote,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Globe,
  BadgeDollarSign,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClientClassificationBadge,
  ClientStatusBadge,
  FollowUpStatusBadge,
} from '@/components/ui/entity-status-badges';
import { cn } from '@/lib/utils';
import {
  useArchiveClient,
  useClient,
  useClientInteractions,
  useClientFollowUps,
  useClientNotes,
} from '@/lib/hooks/use-clients';
import {
  FOLLOW_UP_TYPE_LABELS,
  INTERACTION_TYPE_LABELS,
  NOTE_TAG_LABELS,
  type Client,
  type NoteTag,
} from '@/lib/types/client';
import { ClassifyDialog } from './classify-dialog';
import { EditClientDialog } from './edit-dialog';
import { InteractionDialog } from './interaction-dialog';
import { FollowUpDialog } from './follow-up-dialog';
import { CloseFollowUpDialog } from './close-follow-up-dialog';
import { NoteDialog } from './note-dialog';

const NOTE_BADGE: Record<NoteTag, string> = {
  GENERAL: 'bg-zinc-100 text-zinc-600',
  IMPORTANT: 'bg-abak-blue/10 text-abak-blue',
  ISSUE: 'bg-rose-100 text-rose-700',
  OPPORTUNITY: 'bg-abak-gold/20 text-abak-gold',
};

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { data: client, isLoading, isError, error } = useClient(id);
  const archive = useArchiveClient(id);

  const [editOpen, setEditOpen] = useState(false);
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="h-32 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }
  if (isError || !client) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-10 text-center text-destructive">
            {error instanceof Error ? error.message : 'Client not found.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  async function onArchive() {
    try {
      await archive.mutateAsync();
      toast.success('Client archived');
      router.push('/clients');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to archive';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <Card>
        <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-abak-blue/10 text-lg font-semibold text-abak-blue">
              {client.contactName
                .split(' ')
                .map((part) => part.charAt(0))
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
            <div>
              <div className="font-mono text-sm text-muted-foreground">
                {client.clientNumber}
              </div>
              <h1 className="text-2xl font-bold text-abak-blue">
                {client.contactName}
              </h1>
              <div className="mt-1 text-sm text-muted-foreground">
                {client.companyName ?? 'Individual contact'}
                {client.classificationManual && (
                  <span className="ml-2 inline-flex items-center gap-1 text-abak-gold">
                    <BadgeCheck className="h-3.5 w-3.5" /> Locked
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ClientClassificationBadge
              classification={client.classification}
              size="md"
            />
            <ClientStatusBadge status={client.status} size="md" />
            {client.satisfactionScore !== null && (
              <Badge variant="outline">
                Satisfaction {client.satisfactionScore}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setClassifyOpen(true)}
        >
          Reclassify
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Archive
        </Button>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="w-full flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="interactions">
            Interactions
            {client._count?.interactions
              ? ` (${client._count.interactions})`
              : ''}
          </TabsTrigger>
          <TabsTrigger value="follow-ups">
            Follow-ups
            {client._count?.followUps ? ` (${client._count.followUps})` : ''}
          </TabsTrigger>
          <TabsTrigger value="notes">
            Notes
            {client._count?.notes ? ` (${client._count.notes})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab client={client} />
        </TabsContent>
        <TabsContent value="interactions">
          <InteractionsTab
            clientId={client.id}
            onAdd={() => setInteractionOpen(true)}
          />
        </TabsContent>
        <TabsContent value="follow-ups">
          <FollowUpsTab
            clientId={client.id}
            onAdd={() => setFollowUpOpen(true)}
          />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab clientId={client.id} onAdd={() => setNoteOpen(true)} />
        </TabsContent>
      </Tabs>

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
            <DialogTitle>Archive client?</DialogTitle>
            <DialogDescription>
              The client stays in the database but disappears from the active
              list. Interactions and follow-ups stay intact for audit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onArchive}
              disabled={archive.isPending}
            >
              {archive.isPending ? 'Archiving…' : 'Archive'}
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
      href="/clients"
      className="inline-flex items-center gap-1 text-sm text-abak-blue hover:underline"
    >
      <ArrowLeft className="h-4 w-4" /> Back to clients
    </Link>
  );
}

function ProfileTab({ client }: { client: Client }) {
  const manager = client.accountManager
    ? [client.accountManager.firstName, client.accountManager.lastName]
        .filter(Boolean)
        .join(' ') || client.accountManager.email
    : 'Unassigned';

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row icon={Phone} label="Phone" value={client.phone} />
          <Row label="Alt phone" value={client.alternatePhone} />
          <Row icon={Mail} label="Email" value={client.email} />
          <Row icon={Globe} label="Website" value={client.website} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row icon={MapPin} label="Line 1" value={client.addressLine1} />
          <Row label="Line 2" value={client.addressLine2} />
          <Row label="City" value={client.city} />
          <Row label="Region" value={client.region} />
          <Row label="Country" value={client.country} />
          <Row label="Postal" value={client.postalCode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row
            label="Commercial registration"
            value={client.commercialRegistration}
          />
          <Row label="Tax ID" value={client.taxId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Account manager" value={manager} />
          <Row
            icon={BadgeDollarSign}
            label="Lifetime value"
            value={`${client.lifetimeValue.toLocaleString()} SAR`}
          />
          <Row
            label="Credit limit"
            value={
              client.creditLimit !== null
                ? `${client.creditLimit.toLocaleString()} SAR`
                : null
            }
          />
          <Row label="Payment terms" value={client.paymentTerms} />
          <Row
            label="Last interaction"
            value={
              client.lastInteractionAt
                ? formatDistanceToNow(new Date(client.lastInteractionAt), {
                    addSuffix: true,
                  })
                : null
            }
          />
          <Row
            label="Created"
            value={format(new Date(client.createdAt), 'PPp')}
          />
        </CardContent>
      </Card>
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
  const { data, isLoading } = useClientInteractions(clientId);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={onAdd}>
          <MessageSquare className="mr-2 h-4 w-4" /> Log interaction
        </Button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && data?.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No interactions logged yet.
        </p>
      )}
      <ol className="relative space-y-3 border-l pl-4">
        {data?.data.map((interaction) => (
          <li key={interaction.id} className="relative">
            <span className="absolute -left-[23px] top-2 h-3 w-3 rounded-full bg-abak-blue" />
            <Card>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{interaction.subject}</div>
                    <div className="text-xs text-muted-foreground">
                      {INTERACTION_TYPE_LABELS[interaction.type]}
                      {interaction.direction
                        ? ` · ${interaction.direction}`
                        : ''}
                      {interaction.durationMinutes
                        ? ` · ${interaction.durationMinutes}m`
                        : ''}
                      {' · '}
                      {format(new Date(interaction.occurredAt), 'PPp')}
                    </div>
                  </div>
                  {interaction.author && (
                    <span className="text-xs text-muted-foreground">
                      by{' '}
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
                      <div>Location: {interaction.location}</div>
                    )}
                    {interaction.outcome && (
                      <div>Outcome: {interaction.outcome}</div>
                    )}
                    {interaction.nextAction && (
                      <div>Next: {interaction.nextAction}</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FollowUpsTab({
  clientId,
  onAdd,
}: {
  clientId: string;
  onAdd: () => void;
}) {
  const { data, isLoading } = useClientFollowUps(clientId);
  const [closingId, setClosingId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={onAdd}>
          <CalendarCheck className="mr-2 h-4 w-4" /> Schedule follow-up
        </Button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No follow-ups scheduled.
        </p>
      )}
      <ul className="space-y-2">
        {data?.map((followUp) => {
          const canClose =
            followUp.status !== 'COMPLETED' && followUp.status !== 'CANCELLED';
          return (
            <li key={followUp.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-3 py-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{followUp.title}</span>
                      <FollowUpStatusBadge status={followUp.status} />
                      <Badge variant="outline">
                        {FOLLOW_UP_TYPE_LABELS[followUp.type]}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Due {format(new Date(followUp.dueAt), 'PPp')}
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
                        Outcome: {followUp.outcome}
                      </p>
                    )}
                  </div>
                  {canClose && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setClosingId(followUp.id)}
                    >
                      إغلاق
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
  );
}

function NotesTab({
  clientId,
  onAdd,
}: {
  clientId: string;
  onAdd: () => void;
}) {
  const { data, isLoading } = useClientNotes(clientId);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={onAdd}>
          <StickyNote className="mr-2 h-4 w-4" /> Add note
        </Button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
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
                    {NOTE_TAG_LABELS[note.tag]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(note.createdAt), {
                      addSuffix: true,
                    })}
                    {note.author &&
                      ` · ${
                        [note.author.firstName, note.author.lastName]
                          .filter(Boolean)
                          .join(' ') || note.author.email
                      }`}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{note.body}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className="text-right font-medium">
        {value && value !== '' ? value : '—'}
      </span>
    </div>
  );
}

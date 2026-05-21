'use client';

/**
 * Communications log timeline + "Log communication" sheet for a Lead.
 *
 * Added 2026-05-21 as part of the process correction. The Sales Person is
 * the single thread-of-record for the client; every call/WhatsApp/email/
 * meeting/site visit is logged here. See docs/CORRECTED_CLIENT_JOURNEY.md
 * §A "Capture & grow a lead" and personas/sales-rep.md.
 *
 * Norman notes:
 * - The Log button sits top-right of the card. It's the primary CTA on this
 *   surface — not hidden in a sub-tab (closes the gulf of execution).
 * - The channel picker is a segmented control: 1 tap reveals the affordance.
 * - Date/actor defaults to now + current user — knowledge in the world, not
 *   in the head.
 * - Inline "Schedule follow-up" toggle: one screen, two outcomes; the follow-
 *   up is a side-effect of the log entry, not a separate task.
 * - Timeline shows channel icon + actor + relative time + first 80 chars
 *   with expand — closes the gulf of evaluation per-entry.
 */

import { useMemo, useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import {
  CalendarClock,
  Mail,
  MessageCircle,
  Phone,
  PlusCircle,
  ScrollText,
  Users,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useLeadInteractions,
  useLogLeadInteraction,
  type InteractionType,
  type LeadInteraction,
  type LogLeadInteractionBody,
} from '@/lib/hooks/use-leads';

type ChannelOption = {
  value: InteractionType;
  label: string;
  icon: typeof Phone;
};

const CHANNEL_OPTIONS: ChannelOption[] = [
  { value: 'CALL', label: 'Call', icon: Phone },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle },
  { value: 'EMAIL', label: 'Email', icon: Mail },
  { value: 'MEETING', label: 'Meeting', icon: Users },
  { value: 'SITE_VISIT', label: 'Site visit', icon: ScrollText },
  { value: 'OFFICE_VISIT', label: 'Office visit', icon: Users },
  { value: 'NOTE', label: 'Note', icon: ScrollText },
];

const CHANNEL_LABEL_BY_VALUE: Record<InteractionType, string> = {
  CALL: 'Call',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  MEETING: 'Meeting',
  SITE_VISIT: 'Site visit',
  OFFICE_VISIT: 'Office visit',
  NOTE: 'Note',
  COMPLAINT: 'Complaint',
  QUOTE_SENT_EVENT: 'Quote sent',
  CONTRACT_SIGNED: 'Contract signed',
};

function getChannelIcon(type: InteractionType) {
  const opt = CHANNEL_OPTIONS.find((o) => o.value === type);
  return opt?.icon ?? ScrollText;
}

function displayActor(actor: LeadInteraction['author']): string {
  if (!actor) return 'System';
  const name = [actor.firstName, actor.lastName].filter(Boolean).join(' ');
  return name || actor.email;
}

function lastContactLabel(items: LeadInteraction[] | undefined) {
  if (!items || items.length === 0) return null;
  const most = items[0]; // already sorted desc by API
  return formatDistanceToNowStrict(new Date(most.occurredAt), {
    addSuffix: true,
  });
}

export function CommunicationsLog({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const { data: entries = [], isLoading } = useLeadInteractions(leadId);

  const lastContact = useMemo(() => lastContactLabel(entries), [entries]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base font-semibold">
            Communications log
          </CardTitle>
          <CardDescription>
            {lastContact
              ? `Last contact: ${lastContact}`
              : 'No contact logged yet — the clock is ticking.'}
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Log communication
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Loading timeline…
          </p>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No entries yet. Log every call, WhatsApp, email, meeting, or site
            visit so the next person on this lead has full context.
          </p>
        ) : (
          <ol className="space-y-3">
            {entries.map((entry) => (
              <TimelineRow key={entry.id} entry={entry} />
            ))}
          </ol>
        )}
      </CardContent>

      <LogSheet leadId={leadId} open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function TimelineRow({ entry }: { entry: LeadInteraction }) {
  const Icon = getChannelIcon(entry.type);
  const time = new Date(entry.occurredAt);
  return (
    <li className="flex gap-3 rounded-md border bg-card p-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold">
            {CHANNEL_LABEL_BY_VALUE[entry.type] ?? entry.type}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {displayActor(entry.author)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground" title={format(time, 'PPPpp')}>
            {formatDistanceToNowStrict(time, { addSuffix: true })}
          </span>
        </div>
        <p className="mt-1 text-sm">{entry.subject}</p>
        {entry.summary && (
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {entry.summary}
          </p>
        )}
        {entry.followUpDate && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-abak-blue">
            <CalendarClock className="h-3.5 w-3.5" />
            Follow-up: {format(new Date(entry.followUpDate), 'PP')}
          </div>
        )}
        {entry.nextAction && (
          <p className="mt-1 text-xs text-muted-foreground">
            Next: {entry.nextAction}
          </p>
        )}
      </div>
    </li>
  );
}

function LogSheet({
  leadId,
  open,
  onOpenChange,
}: {
  leadId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const mutation = useLogLeadInteraction(leadId);
  const [type, setType] = useState<InteractionType>('CALL');
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [scheduleFollowUp, setScheduleFollowUp] = useState(true);
  const [followUpDate, setFollowUpDate] = useState(() => defaultFollowUpDate());

  function reset() {
    setType('CALL');
    setSubject('');
    setSummary('');
    setScheduleFollowUp(true);
    setFollowUpDate(defaultFollowUpDate());
  }

  async function submit() {
    if (subject.trim().length < 2) {
      toast.error('Add a brief subject (at least 2 characters).');
      return;
    }
    const body: LogLeadInteractionBody = {
      type,
      subject: subject.trim(),
    };
    if (summary.trim()) body.summary = summary.trim();
    if (scheduleFollowUp && followUpDate)
      body.followUpDate = new Date(followUpDate).toISOString();
    try {
      await mutation.mutateAsync(body);
      toast.success('Communication logged');
      reset();
      onOpenChange(false);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to log';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Log communication</SheetTitle>
          <SheetDescription>
            Every contact with the prospect — call, WhatsApp, email, meeting,
            site visit — belongs on this timeline. The next person to touch this
            lead reads it first.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <div>
            <Label>Channel</Label>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {CHANNEL_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition-colors ${
                      selected
                        ? 'border-abak-blue bg-abak-blue/10 text-abak-blue'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="comms-subject">Subject *</Label>
            <Input
              id="comms-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Initial discovery call — interested in supervision"
              className="mt-1"
              maxLength={160}
            />
          </div>

          <div>
            <Label htmlFor="comms-summary">Notes (optional)</Label>
            <Textarea
              id="comms-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What was discussed, what was promised, what they need next…"
              className="mt-1"
              rows={4}
            />
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="schedule-followup"
                checked={scheduleFollowUp}
                onCheckedChange={(v) => setScheduleFollowUp(v === true)}
              />
              <Label
                htmlFor="schedule-followup"
                className="cursor-pointer text-sm font-medium"
              >
                Schedule follow-up
              </Label>
            </div>
            {scheduleFollowUp && (
              <div className="mt-3">
                <Input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  min={today()}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Inline reminder — appears on your follow-up queue.
                </p>
              </div>
            )}
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
            {mutation.isPending ? 'Logging…' : 'Log communication'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function defaultFollowUpDate() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

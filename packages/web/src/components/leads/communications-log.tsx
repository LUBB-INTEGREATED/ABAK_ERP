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
import { useTranslations } from 'next-intl';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useLeadInteractions,
  useLogLeadInteraction,
  type InteractionType,
  type LeadInteraction,
  type LogLeadInteractionBody,
} from '@/lib/hooks/use-leads';

/**
 * Standardised contact outcomes (BR-03: every interaction must capture an
 * outcome). The value sent to the API is the i18n key so it round-trips
 * stably across locales; the timeline localises it back via t().
 */
const OUTCOME_OPTIONS = [
  'outcomeInterested',
  'outcomeNotInterested',
  'outcomeNoAnswer',
  'outcomeCallbackRequested',
  'outcomeMeetingScheduled',
  'outcomeQuoteRequested',
  'outcomeInfoSent',
  'outcomeFollowUpNeeded',
  'outcomeWon',
  'outcomeLost',
  'outcomeOther',
] as const;

type ChannelOption = {
  value: InteractionType;
  labelKey: string;
  icon: typeof Phone;
};

const CHANNEL_OPTIONS: ChannelOption[] = [
  { value: 'CALL', labelKey: 'channelCall', icon: Phone },
  { value: 'WHATSAPP', labelKey: 'channelWhatsapp', icon: MessageCircle },
  { value: 'EMAIL', labelKey: 'channelEmail', icon: Mail },
  { value: 'MEETING', labelKey: 'channelMeeting', icon: Users },
  { value: 'SITE_VISIT', labelKey: 'channelSiteVisit', icon: ScrollText },
  { value: 'OFFICE_VISIT', labelKey: 'channelOfficeVisit', icon: Users },
  { value: 'NOTE', labelKey: 'channelNote', icon: ScrollText },
];

const CHANNEL_LABEL_KEY_BY_VALUE: Record<InteractionType, string> = {
  CALL: 'channelCall',
  WHATSAPP: 'channelWhatsapp',
  EMAIL: 'channelEmail',
  MEETING: 'channelMeeting',
  SITE_VISIT: 'channelSiteVisit',
  OFFICE_VISIT: 'channelOfficeVisit',
  NOTE: 'channelNote',
  COMPLAINT: 'channelComplaint',
  QUOTE_SENT_EVENT: 'channelQuoteSent',
  CONTRACT_SIGNED: 'channelContractSigned',
};

function getChannelIcon(type: InteractionType) {
  const opt = CHANNEL_OPTIONS.find((o) => o.value === type);
  return opt?.icon ?? ScrollText;
}

function displayActor(
  actor: LeadInteraction['author'],
  systemLabel: string,
): string {
  if (!actor) return systemLabel;
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
  const t = useTranslations('comms');
  const [open, setOpen] = useState(false);
  const { data: entries = [], isLoading } = useLeadInteractions(leadId);

  const lastContact = useMemo(() => lastContactLabel(entries), [entries]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base font-semibold">
            {t('title')}
          </CardTitle>
          <CardDescription>
            {lastContact
              ? t('lastContact', { time: lastContact })
              : t('noContactYet')}
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <PlusCircle className="me-2 h-4 w-4" />
          {t('logCommunication')}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('loadingTimeline')}
          </p>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('emptyTimeline')}
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
  const t = useTranslations('comms');
  const Icon = getChannelIcon(entry.type);
  const time = new Date(entry.occurredAt);
  const channelLabelKey = CHANNEL_LABEL_KEY_BY_VALUE[entry.type];
  return (
    <li className="flex gap-3 rounded-md border bg-card p-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold">
            {channelLabelKey ? t(channelLabelKey) : entry.type}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {displayActor(entry.author, t('system'))}
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
        {entry.outcome && (
          <span className="mt-2 inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            {outcomeLabel(entry.outcome, t)}
          </span>
        )}
        {entry.followUpDate && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-abak-blue">
            <CalendarClock className="h-3.5 w-3.5" />
            {t('followUp', {
              date: format(new Date(entry.followUpDate), 'PP'),
            })}
          </div>
        )}
        {entry.nextAction && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('nextPrefix', { action: entry.nextAction })}
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
  const t = useTranslations('comms');
  const td = useTranslations('detail');
  const mutation = useLogLeadInteraction(leadId);
  const [type, setType] = useState<InteractionType>('CALL');
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [outcome, setOutcome] = useState('');
  const [scheduleFollowUp, setScheduleFollowUp] = useState(true);
  const [followUpDate, setFollowUpDate] = useState(() => defaultFollowUpDate());

  function reset() {
    setType('CALL');
    setSubject('');
    setSummary('');
    setOutcome('');
    setScheduleFollowUp(true);
    setFollowUpDate(defaultFollowUpDate());
  }

  async function submit() {
    if (subject.trim().length < 2) {
      toast.error(t('subjectError'));
      return;
    }
    // BR-03: outcome is mandatory on every logged contact.
    if (!outcome) {
      toast.error(t('outcomeError'));
      return;
    }
    const body: LogLeadInteractionBody = {
      type,
      subject: subject.trim(),
      outcome,
    };
    if (summary.trim()) body.summary = summary.trim();
    if (scheduleFollowUp && followUpDate)
      body.followUpDate = new Date(followUpDate).toISOString();
    try {
      await mutation.mutateAsync(body);
      toast.success(t('logged'));
      reset();
      onOpenChange(false);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('logFailed');
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* p-0 + an explicit scroll region + sticky footer so the save button is
          always reachable, even on short (≤650px) viewports (QA P0-3 / P2-6). */}
      <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-6 pb-4">
          <SheetTitle>{t('logCommunication')}</SheetTitle>
          <SheetDescription>{t('sheetDescription')}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div>
            <Label>{td('channel')}</Label>
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
                    <span>{t(opt.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="comms-subject">{t('subjectLabel')}</Label>
            <Input
              id="comms-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('subjectPlaceholder')}
              className="mt-1"
              maxLength={160}
            />
          </div>

          <div>
            <Label htmlFor="comms-summary">{t('notesLabel')}</Label>
            <Textarea
              id="comms-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={t('notesPlaceholder')}
              className="mt-1"
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="comms-outcome">{t('outcomeLabel')}</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger id="comms-outcome" className="mt-1">
                <SelectValue placeholder={t('outcomePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {t(opt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                {t('scheduleFollowUp')}
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
                  {t('followUpHint')}
                </p>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="mt-0 border-t bg-background p-6 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {td('cancel')}
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? t('logging') : t('logCommunication')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Localise a stored outcome. New entries store the i18n key
 * (e.g. "outcomeInterested"); legacy/free-text outcomes are shown verbatim.
 */
function outcomeLabel(
  value: string,
  t: ReturnType<typeof useTranslations>,
): string {
  return (OUTCOME_OPTIONS as readonly string[]).includes(value)
    ? t(value)
    : value;
}

function defaultFollowUpDate() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

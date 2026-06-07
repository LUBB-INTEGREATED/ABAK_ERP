'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  UserPlus,
  DoorOpen,
  Phone,
  Repeat2,
  Share2,
  Globe,
  MapPin,
  Bot,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  findDuplicateLeads,
  useCreateLead,
  useServices,
  useUsers,
  type DuplicateLead,
} from '@/lib/hooks/use-leads';
import {
  LEAD_CHANNELS,
  LEAD_PRIORITIES,
  PRIORITY_LABELS,
  type LeadChannel,
  type LeadPriority,
} from '@/lib/types/lead';

const CHANNEL_ICONS: Record<LeadChannel, LucideIcon> = {
  REFERRAL: UserPlus,
  WALK_IN: DoorOpen,
  PHONE: Phone,
  EXISTING_CLIENT_REPEAT: Repeat2,
  SOCIAL_MEDIA: Share2,
  WEBSITE: Globe,
  GOOGLE_MAPS: MapPin,
  AI_CHATBOT: Bot,
  OTHER: MoreHorizontal,
};

const SAUDI_PHONE = /^(\+9665|05)\d{8}$/;

// Saudi administrative regions — same list as the new-client form. The Lead
// model has no structured `region` column, so the value is folded into the
// human-readable `projectLocation` and carried forward there (the structured
// Client.region is set later when the client is edited). (CRM-3 / BUG-P1-8).
const SAUDI_REGIONS = [
  'الرياض',
  'مكة المكرمة',
  'المدينة المنورة',
  'القصيم',
  'المنطقة الشرقية',
  'عسير',
  'تبوك',
  'حائل',
  'الحدود الشمالية',
  'جازان',
  'نجران',
  'الباحة',
  'الجوف',
];

const baseSchema = z.object({
  contactName: z.string().min(2, 'Contact name is required').max(120),
  companyName: z.string().max(160).optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().regex(SAUDI_PHONE, 'Use Saudi format (+9665… or 05…)'),
  alternatePhone: z.string().optional().or(z.literal('')),
  source: z.string().optional().or(z.literal('')),
  serviceId: z.string().optional().or(z.literal('')),
  serviceDetails: z.string().optional().or(z.literal('')),
  projectLocation: z.string().optional().or(z.literal('')),
  projectSize: z.string().optional().or(z.literal('')),
  budget: z
    .string()
    .optional()
    .refine((value) => !value || Number.isFinite(Number(value)), {
      message: 'Budget must be a number',
    }),
  timeline: z.string().optional().or(z.literal('')),
  priority: z.enum(LEAD_PRIORITIES),
  assignedToId: z.string().optional().or(z.literal('')),
  initialNotes: z.string().optional().or(z.literal('')),

  etimadNumber: z.string().optional().or(z.literal('')),
  fursaNumber: z.string().optional().or(z.literal('')),
  tenderDeadline: z.string().optional().or(z.literal('')),

  referredBy: z.string().optional().or(z.literal('')),
  referrerPhone: z.string().optional().or(z.literal('')),
  referrerCompany: z.string().optional().or(z.literal('')),

  socialPlatform: z.string().optional().or(z.literal('')),
  socialProfile: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (value) =>
        !value ||
        /^https?:\/\//.test(value) ||
        /^@?[a-zA-Z0-9._-]+$/.test(value),
      { message: 'Paste a URL or a handle' },
    ),

  mapsLink: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((value) => !value || /^https?:\/\//.test(value), {
      message: 'Google Maps link must start with http(s)://',
    }),
  mapsReview: z.enum(['YES', 'NO', 'UNKNOWN']).optional(),

  // BPD channel-specific fields
  region: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  district: z.string().optional().or(z.literal('')),
  referralSourceType: z.string().optional().or(z.literal('')),
  expectedBudgetRange: z.string().optional().or(z.literal('')),
  clientUrgency: z.string().optional().or(z.literal('')),
  socialUsername: z.string().optional().or(z.literal('')),
  relatedCampaign: z.string().optional().or(z.literal('')),
  webSource: z.string().optional().or(z.literal('')),
  mapContactMethod: z.string().optional().or(z.literal('')),
  mapHowFoundUs: z.string().optional().or(z.literal('')),
  // Government tender extra
  tenderPlatform: z.string().optional().or(z.literal('')),
  tenderTitle: z.string().optional().or(z.literal('')),
  tenderCategory: z.string().optional().or(z.literal('')),
  participationDecision: z.string().optional().or(z.literal('')),
  skipReason: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof baseSchema>;

const DEFAULT_VALUES: FormValues = {
  contactName: '',
  companyName: '',
  email: '',
  phone: '',
  alternatePhone: '',
  source: '',
  serviceId: '',
  serviceDetails: '',
  projectLocation: '',
  projectSize: '',
  budget: '',
  timeline: '',
  priority: 'MEDIUM',
  assignedToId: '',
  initialNotes: '',
  etimadNumber: '',
  fursaNumber: '',
  tenderDeadline: '',
  referredBy: '',
  referrerPhone: '',
  referrerCompany: '',
  socialPlatform: '',
  socialProfile: '',
  mapsLink: '',
  mapsReview: 'UNKNOWN',
  // BPD channel-specific fields
  region: '',
  city: '',
  district: '',
  referralSourceType: '',
  expectedBudgetRange: '',
  clientUrgency: '',
  socialUsername: '',
  relatedCampaign: '',
  webSource: '',
  mapContactMethod: '',
  mapHowFoundUs: '',
  tenderPlatform: '',
  tenderTitle: '',
  tenderCategory: '',
  participationDecision: '',
  skipReason: '',
};

const DRAFT_KEY = 'lead_draft';
const DRAFT_KEY_PREFIX = 'abak-erp:lead-draft:';
const AUTO_SAVE_MS = 30_000;

function channelRequirements(
  channel: LeadChannel,
): { requireEither: readonly string[]; label: string } | null {
  const map: Partial<
    Record<LeadChannel, { requireEither: readonly string[]; label: string }>
  > = {
    REFERRAL: {
      requireEither: ['referredBy'],
      label: 'Referrer name',
    },
    SOCIAL_MEDIA: {
      requireEither: ['socialPlatform'],
      label: 'Platform',
    },
    GOOGLE_MAPS: {
      requireEither: ['mapsLink'],
      label: 'Google Maps link',
    },
  };
  return map[channel] ?? null;
}

function toSubmitPayload(
  channel: LeadChannel,
  values: FormValues,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    channel,
    contactName: values.contactName.trim(),
    phone: values.phone.trim(),
    priority: values.priority,
  };

  const optional = (
    key: keyof FormValues,
    override?: string,
  ): string | undefined => {
    const raw = (values[key] ?? '').toString().trim();
    if (!raw) return undefined;
    return override ?? raw;
  };

  const companyName = optional('companyName');
  const email = optional('email');
  const alternatePhone = optional('alternatePhone');
  const source = optional('source');
  const serviceId = optional('serviceId');
  const serviceDetails = optional('serviceDetails');
  const projectLocation = optional('projectLocation');
  const projectSize = optional('projectSize');
  const timeline = optional('timeline');
  const assignedToId = optional('assignedToId');
  const initialNotes = optional('initialNotes');

  if (companyName) payload.companyName = companyName;
  if (email) payload.email = email;
  if (alternatePhone) payload.alternatePhone = alternatePhone;
  if (source) payload.source = source;
  if (serviceId) payload.serviceId = serviceId;
  if (serviceDetails) payload.serviceDetails = serviceDetails;
  if (projectLocation) payload.projectLocation = projectLocation;
  if (projectSize) payload.projectSize = projectSize;
  if (timeline) payload.timeline = timeline;
  if (assignedToId) payload.assignedToId = assignedToId;
  if (initialNotes) payload.initialNotes = initialNotes;

  if (values.budget && values.budget.trim()) {
    payload.budget = Number(values.budget);
  }

  // Region + city + district for all channels.
  // The API persists `city`/`district` (they ride through to the Client on
  // convert), but the Lead model has NO dedicated `region` column — so the
  // selected region is ALWAYS folded into the human-readable `projectLocation`
  // ("الموقع") so it is never silently lost. If the user typed a free-text
  // location we append the region to it rather than dropping it. (CRM-3 /
  // BUG-P1-8)
  const region = optional('region');
  const city = optional('city');
  const district = optional('district');
  if (city) payload.city = city;
  if (district) payload.district = district;

  const composedLocation = [region, city, district].filter(Boolean).join(' — ');
  if (projectLocation && composedLocation) {
    payload.projectLocation = `${projectLocation} (${composedLocation})`;
  } else if (composedLocation) {
    payload.projectLocation = composedLocation;
  }

  switch (channel) {
    case 'REFERRAL': {
      const by = optional('referredBy');
      const rp = optional('referrerPhone');
      const rc = optional('referrerCompany');
      const refSourceType = optional('referralSourceType');
      const budgetRange = optional('expectedBudgetRange');
      const urgency = optional('clientUrgency');
      if (by) payload.referredBy = by;
      if (rp) payload.referrerPhone = rp;
      if (rc) payload.referrerCompany = rc;
      if (refSourceType) payload.referralSourceType = refSourceType;
      if (budgetRange) payload.expectedBudgetRange = budgetRange;
      if (urgency) payload.clientUrgency = urgency;
      break;
    }
    case 'SOCIAL_MEDIA': {
      const plat = optional('socialPlatform');
      const prof = optional('socialProfile');
      const username = optional('socialUsername');
      const campaign = optional('relatedCampaign');
      if (plat) payload.socialPlatform = plat;
      if (prof) payload.socialProfile = prof;
      if (username) payload.socialUsername = username;
      if (campaign) payload.relatedCampaign = campaign;
      break;
    }
    case 'WEBSITE': {
      const webSrc = optional('webSource');
      if (webSrc) payload.webSource = webSrc;
      break;
    }
    case 'GOOGLE_MAPS': {
      const link = optional('mapsLink');
      const contactMethod = optional('mapContactMethod');
      const howFoundUs = optional('mapHowFoundUs');
      if (link) payload.mapsLink = link;
      if (values.mapsReview === 'YES') payload.mapsReview = true;
      if (values.mapsReview === 'NO') payload.mapsReview = false;
      if (contactMethod) payload.mapContactMethod = contactMethod;
      if (howFoundUs) payload.mapHowFoundUs = howFoundUs;
      break;
    }
    default:
      break;
  }

  return payload;
}

export default function NewLeadPage() {
  const router = useRouter();
  const tNew = useTranslations('leadNew');
  const tChannels = useTranslations('leads.channels');
  const [channel, setChannel] = useState<LeadChannel>('WEBSITE');
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  // CRM-4 / BUG-P2-4 — duplicate-phone warning before create.
  const [duplicates, setDuplicates] = useState<DuplicateLead[]>([]);
  const [dupOpen, setDupOpen] = useState(false);
  const [dupChecking, setDupChecking] = useState(false);
  const pendingSubmit = useRef<{ values: FormValues; reopen?: boolean } | null>(
    null,
  );
  const form = useForm<FormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onBlur',
  });
  const services = useServices();
  const users = useUsers();
  const createLead = useCreateLead();

  const draftKey = `${DRAFT_KEY_PREFIX}${channel}`;

  // Check for global lead_draft on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const globalDraft = window.localStorage.getItem(DRAFT_KEY);
    if (globalDraft) {
      setShowDraftBanner(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(draftKey);
    if (!raw) {
      form.reset(DEFAULT_VALUES);
      return;
    }
    try {
      form.reset({ ...DEFAULT_VALUES, ...(JSON.parse(raw) as FormValues) });
    } catch {
      form.reset(DEFAULT_VALUES);
    }
  }, [draftKey, form]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const interval = setInterval(() => {
      const values = form.getValues();
      window.localStorage.setItem(draftKey, JSON.stringify(values));
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ channel, ...values }),
      );
    }, AUTO_SAVE_MS);
    return () => clearInterval(interval);
  }, [draftKey, channel, form]);

  function restoreDraft() {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as FormValues & { channel?: LeadChannel };
      if (saved.channel) setChannel(saved.channel);
      const { channel: _ch, ...rest } = saved;
      form.reset({ ...DEFAULT_VALUES, ...rest });
      toast.success('تم استرجاع المسودة');
    } catch {
      toast.error('فشل استرجاع المسودة');
    }
    setShowDraftBanner(false);
  }

  function discardDraft() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DRAFT_KEY);
    }
    setShowDraftBanner(false);
  }

  const activeUsers =
    users.data?.filter((user) => user.status === 'ACTIVE') ?? [];

  const serviceOptions = useMemo(() => services.data ?? [], [services.data]);

  // Actually create the lead (called after the duplicate gate is cleared).
  async function doCreate(values: FormValues, reopen?: boolean) {
    try {
      const lead = await createLead.mutateAsync(
        toSubmitPayload(channel, values),
      );
      toast.success(`${lead.leadNumber} created`);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftKey);
        window.localStorage.removeItem(DRAFT_KEY);
      }
      setShowDraftBanner(false);
      if (reopen) {
        form.reset(DEFAULT_VALUES);
      } else {
        router.push(`/leads/${lead.id}`);
      }
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to create lead';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  async function onSubmit(values: FormValues, reopen?: boolean) {
    const channelReq = channelRequirements(channel);
    if (channelReq) {
      const satisfied = channelReq.requireEither.some((field) => {
        const v = (values as Record<string, unknown>)[field];
        return v != null && String(v).trim().length > 0;
      });
      if (!satisfied) {
        toast.error(`${channelReq.label} is required for this channel`);
        return;
      }
    }

    // CRM-4 / BUG-P2-4 — warn on a likely duplicate (same phone/email in the
    // last 30 days) BEFORE creating, instead of silently auto-linking.
    setDupChecking(true);
    try {
      const found = await findDuplicateLeads({
        phone: values.phone.trim() || undefined,
        email: values.email?.trim() || undefined,
      });
      if (found.length > 0) {
        setDuplicates(found);
        pendingSubmit.current = { values, reopen };
        setDupOpen(true);
        return; // wait for the user's choice in the modal
      }
    } catch {
      // Duplicate check is non-blocking — if it fails, fall through to create.
    } finally {
      setDupChecking(false);
    }

    await doCreate(values, reopen);
  }

  function continueDespiteDuplicate() {
    const pending = pendingSubmit.current;
    setDupOpen(false);
    pendingSubmit.current = null;
    if (pending) void doCreate(pending.values, pending.reopen);
  }

  function clearForm() {
    form.reset(DEFAULT_VALUES);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(draftKey);
      window.localStorage.removeItem(DRAFT_KEY);
    }
    setShowDraftBanner(false);
    toast.success('Draft cleared');
  }

  return (
    <div className="space-y-6">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1 text-sm text-abak-blue hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      {showDraftBanner && (
        <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-600" />
          <span className="flex-1 text-amber-800">
            يوجد مسودة محفوظة — هل تريد استرجاعها؟
          </span>
          <Button size="sm" variant="outline" onClick={restoreDraft}>
            استرجاع
          </Button>
          <Button size="sm" variant="ghost" onClick={discardDraft}>
            {tNew('discard')}
          </Button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-abak-blue">{tNew('heading')}</h1>
        <p className="text-sm text-muted-foreground">{tNew('subheading')}</p>
      </div>

      <div>
        <Label className="text-base font-semibold text-foreground">
          {tNew('channelLabel')}
        </Label>
        <p className="mb-3 mt-0.5 text-sm text-muted-foreground">
          {tNew('channelHint')}
        </p>
        <div
          role="radiogroup"
          aria-label={tNew('channelLabel')}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3"
        >
          {LEAD_CHANNELS.map((ch) => {
            const Icon = CHANNEL_ICONS[ch];
            const active = channel === ch;
            return (
              <button
                type="button"
                key={ch}
                role="radio"
                aria-checked={active}
                onClick={() => setChannel(ch)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border p-3 text-start text-sm transition',
                  active
                    ? 'border-abak-blue bg-abak-blue/5 font-medium text-abak-blue ring-1 ring-abak-blue'
                    : 'border-input text-foreground hover:border-abak-blue/50 hover:bg-muted/50',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-abak-blue' : 'text-muted-foreground',
                  )}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span>{tChannels(ch)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form
        className="space-y-6"
        onSubmit={form.handleSubmit((values) => onSubmit(values, false))}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              form={form}
              name="contactName"
              label="Contact name"
              required
            />
            <TextField form={form} name="companyName" label="Company" />
            <TextField
              form={form}
              name="phone"
              label="Phone"
              placeholder="+966501234567"
              required
            />
            <TextField
              form={form}
              name="alternatePhone"
              label="Alternate phone"
            />
            <TextField form={form} name="email" label="Email" type="email" />
            <TextField
              form={form}
              name="projectLocation"
              label="Project location"
            />
            <div className="space-y-2">
              <Label>المنطقة</Label>
              <Select
                value={form.watch('region') || ''}
                onValueChange={(value) => form.setValue('region', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المنطقة" />
                </SelectTrigger>
                <SelectContent>
                  {SAUDI_REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TextField
              form={form}
              name="city"
              label="المدينة"
              placeholder="الرياض"
            />
            <TextField
              form={form}
              name="district"
              label="الحي"
              placeholder="العليا"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Service request</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Service</Label>
              <Select
                value={form.watch('serviceId') || ''}
                onValueChange={(value) => form.setValue('serviceId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a service (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {serviceOptions.map((svc) => (
                    <SelectItem key={svc.id} value={svc.id}>
                      {svc.name}{' '}
                      <span className="text-xs text-muted-foreground">
                        ({svc.code})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TextField
              form={form}
              name="projectSize"
              label="Project size"
              placeholder="5000 sqm"
            />
            <TextField
              form={form}
              name="budget"
              label="Budget (SAR)"
              type="number"
            />
            <TextField
              form={form}
              name="timeline"
              label="Timeline"
              placeholder="6 months"
            />
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="serviceDetails">Details</Label>
              <Textarea
                id="serviceDetails"
                rows={3}
                {...form.register('serviceDetails')}
              />
            </div>
          </CardContent>
        </Card>

        <ChannelSpecificCard channel={channel} form={form} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Routing</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={form.watch('priority')}
                onValueChange={(value) =>
                  form.setValue('priority', value as LeadPriority)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select
                value={form.watch('assignedToId') || ''}
                onValueChange={(value) => form.setValue('assignedToId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {activeUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {[user.firstName, user.lastName]
                        .filter(Boolean)
                        .join(' ') || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TextField
              form={form}
              name="source"
              label="Source label"
              placeholder="e.g. Etimad Platform"
            />
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="initialNotes">Initial notes</Label>
              <Textarea
                id="initialNotes"
                rows={3}
                {...form.register('initialNotes')}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={clearForm}>
            Clear draft
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={createLead.isPending || dupChecking}
            onClick={form.handleSubmit((values) => onSubmit(values, true))}
          >
            Submit & create another
          </Button>
          <Button type="submit" disabled={createLead.isPending || dupChecking}>
            {(createLead.isPending || dupChecking) && (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            )}
            {dupChecking ? tNew('dupChecking') : 'Create lead'}
          </Button>
        </div>
      </form>

      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              {tNew('dupTitle')}
            </DialogTitle>
            <DialogDescription>{tNew('dupDescription')}</DialogDescription>
          </DialogHeader>

          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {duplicates.map((dup) => (
              <li
                key={dup.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="font-mono text-xs text-abak-blue">
                      {dup.leadNumber}
                    </span>
                    <span className="truncate">{dup.contactName}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {dup.companyName ? `${dup.companyName} · ` : ''}
                    {tNew('dupCreatedAt', {
                      date: new Date(dup.createdAt).toLocaleDateString(),
                    })}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setDupOpen(false);
                    router.push(`/leads/${dup.id}`);
                  }}
                >
                  {tNew('dupOpenExisting')}
                </Button>
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDupOpen(false)}
            >
              {tNew('dupCancel')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={continueDespiteDuplicate}
            >
              {tNew('dupContinue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TextField({
  form,
  name,
  label,
  type,
  placeholder,
  required,
}: {
  form: UseFormReturn<FormValues>;
  name: keyof FormValues;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const error = form.formState.errors[name]?.message as string | undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={String(name)}>
        {label}
        {required && <span className="ms-0.5 text-destructive">*</span>}
      </Label>
      <Input
        id={String(name)}
        type={type ?? 'text'}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        {...form.register(name)}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SelectField({
  label,
  value,
  onValueChange,
  placeholder,
  children,
  required,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="ms-0.5 text-destructive">*</span>}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? 'اختر…'} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function ChannelSpecificCard({
  channel,
  form,
}: {
  channel: LeadChannel;
  form: UseFormReturn<FormValues>;
}) {
  switch (channel) {
    case 'REFERRAL':
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">تفاصيل الإحالة</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="نوع مصدر الإحالة"
              value={form.watch('referralSourceType') ?? ''}
              onValueChange={(v) => form.setValue('referralSourceType', v)}
            >
              <SelectItem value="PERSONAL_CONTACT">معرفة شخصية</SelectItem>
              <SelectItem value="PREVIOUS_CLIENT">عميل سابق</SelectItem>
              <SelectItem value="PARTNER">شريك</SelectItem>
              <SelectItem value="CONSULTANT">استشاري</SelectItem>
              <SelectItem value="EMPLOYEE">موظف</SelectItem>
            </SelectField>
            <TextField
              form={form}
              name="referredBy"
              label="اسم المُحيل"
              required
            />
            <TextField form={form} name="referrerPhone" label="هاتف المُحيل" />
            <TextField
              form={form}
              name="referrerCompany"
              label="شركة المُحيل"
            />
            <SelectField
              label="النطاق التقديري للميزانية"
              value={form.watch('expectedBudgetRange') ?? ''}
              onValueChange={(v) => form.setValue('expectedBudgetRange', v)}
            >
              <SelectItem value="LESS_50K">أقل من 50,000</SelectItem>
              <SelectItem value="50K_200K">50,000 – 200,000</SelectItem>
              <SelectItem value="200K_500K">200,000 – 500,000</SelectItem>
              <SelectItem value="500K_PLUS">أكثر من 500,000</SelectItem>
              <SelectItem value="UNKNOWN">غير محدد</SelectItem>
            </SelectField>
            <SelectField
              label="إلحاحية العميل"
              value={form.watch('clientUrgency') ?? ''}
              onValueChange={(v) => form.setValue('clientUrgency', v)}
            >
              <SelectItem value="NO_URGENCY">لا توجد إلحاحية</SelectItem>
              <SelectItem value="WITHIN_1_MONTH">خلال شهر</SelectItem>
              <SelectItem value="URGENT">عاجل</SelectItem>
            </SelectField>
          </CardContent>
        </Card>
      );
    case 'SOCIAL_MEDIA':
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              تفاصيل التواصل الاجتماعي
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="المنصة"
              value={form.watch('socialPlatform') ?? ''}
              onValueChange={(v) => form.setValue('socialPlatform', v)}
              required
            >
              <SelectItem value="Instagram">إنستغرام</SelectItem>
              <SelectItem value="X">إكس (تويتر)</SelectItem>
              <SelectItem value="LinkedIn">لينكد إن</SelectItem>
              <SelectItem value="TikTok">تيك توك</SelectItem>
              <SelectItem value="YouTube">يوتيوب</SelectItem>
              <SelectItem value="Snapchat">سناب شات</SelectItem>
            </SelectField>
            <TextField
              form={form}
              name="socialUsername"
              label="اسم المستخدم / الملف الشخصي"
              placeholder="@username"
            />
            <TextField
              form={form}
              name="socialProfile"
              label="رابط الملف الشخصي"
              placeholder="https://…"
            />
            <TextField
              form={form}
              name="relatedCampaign"
              label="الحملة / المنشور المرتبط"
              placeholder="CAM-2026-…"
            />
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="initialNotes">
                ملخص الرسالة <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="initialNotes"
                rows={3}
                {...form.register('initialNotes')}
              />
            </div>
          </CardContent>
        </Card>
      );
    case 'WEBSITE':
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">تفاصيل الموقع / البريد</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="المصدر"
              value={form.watch('webSource') ?? ''}
              onValueChange={(v) => form.setValue('webSource', v)}
            >
              <SelectItem value="CONTACT_FORM">نموذج التواصل</SelectItem>
              <SelectItem value="DIRECT_EMAIL">بريد مباشر</SelectItem>
              <SelectItem value="WHATSAPP_BUSINESS">واتساب بزنس</SelectItem>
            </SelectField>
            <TextField
              form={form}
              name="email"
              label="البريد الإلكتروني"
              type="email"
              required
            />
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="initialNotes">
                محتوى الرسالة <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="initialNotes"
                rows={3}
                {...form.register('initialNotes')}
              />
            </div>
          </CardContent>
        </Card>
      );
    case 'GOOGLE_MAPS':
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">تفاصيل جوجل ماب</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="طريقة التواصل"
              value={form.watch('mapContactMethod') ?? ''}
              onValueChange={(v) => form.setValue('mapContactMethod', v)}
            >
              <SelectItem value="GOOGLE_MAPS_MESSAGE">
                رسالة جوجل ماب
              </SelectItem>
              <SelectItem value="PHONE_CALL">مكالمة هاتفية</SelectItem>
              <SelectItem value="WHATSAPP_DIRECT">واتساب مباشر</SelectItem>
            </SelectField>
            <SelectField
              label="كيف وجدنا؟"
              value={form.watch('mapHowFoundUs') ?? ''}
              onValueChange={(v) => form.setValue('mapHowFoundUs', v)}
            >
              <SelectItem value="GOOGLE_SEARCH">بحث جوجل</SelectItem>
              <SelectItem value="GOOGLE_MAPS">خرائط جوجل</SelectItem>
              <SelectItem value="RECOMMENDATION">توصية</SelectItem>
            </SelectField>
            <TextField
              form={form}
              name="mapsLink"
              label="رابط الخريطة"
              placeholder="https://maps.google.com/…"
            />
            <div className="space-y-2">
              <Label>ترك تقييماً؟</Label>
              <Select
                value={form.watch('mapsReview') ?? 'UNKNOWN'}
                onValueChange={(value) =>
                  form.setValue('mapsReview', value as 'YES' | 'NO' | 'UNKNOWN')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNKNOWN">غير معروف</SelectItem>
                  <SelectItem value="YES">نعم</SelectItem>
                  <SelectItem value="NO">لا</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="initialNotes">
                ملخص الرسالة / المكالمة{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="initialNotes"
                rows={3}
                {...form.register('initialNotes')}
              />
            </div>
          </CardContent>
        </Card>
      );
    case 'WALK_IN':
    default:
      return null;
  }
}

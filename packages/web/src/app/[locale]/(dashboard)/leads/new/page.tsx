'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreateLead, useServices, useUsers } from '@/lib/hooks/use-leads';
import {
  CHANNEL_LABELS,
  LEAD_CHANNELS,
  LEAD_PRIORITIES,
  PRIORITY_LABELS,
  type LeadChannel,
  type LeadPriority,
} from '@/lib/types/lead';

const SAUDI_PHONE = /^(\+9665|05)\d{8}$/;

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

function channelRequirements(channel: LeadChannel) {
  return {
    GOVERNMENT_TENDER: {
      requireEither: ['etimadNumber', 'fursaNumber'] as const,
      label: 'Tender reference (Etimad or Fursa)',
    },
    REFERRAL: {
      requireEither: ['referredBy'] as const,
      label: 'Referrer name',
    },
    SOCIAL_MEDIA: {
      requireEither: ['socialPlatform'] as const,
      label: 'Platform',
    },
    GOOGLE_MAPS: {
      requireEither: ['mapsLink'] as const,
      label: 'Google Maps link',
    },
    WALK_IN: null,
    WEBSITE: null,
  }[channel];
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

  // City + district for all channels
  const city = optional('city');
  const district = optional('district');
  if (city) payload.city = city;
  if (district) payload.district = district;

  switch (channel) {
    case 'GOVERNMENT_TENDER': {
      const etimad = optional('etimadNumber');
      const fursa = optional('fursaNumber');
      const deadline = optional('tenderDeadline');
      const tenderPlatform = optional('tenderPlatform');
      const tenderTitle = optional('tenderTitle');
      const tenderCategory = optional('tenderCategory');
      const participationDecision = optional('participationDecision');
      const skipReason = optional('skipReason');
      if (etimad) payload.etimadNumber = etimad;
      if (fursa) payload.fursaNumber = fursa;
      if (deadline) payload.tenderDeadline = new Date(deadline).toISOString();
      if (tenderPlatform) payload.source = tenderPlatform;
      if (tenderTitle) payload.projectLocation = tenderTitle;
      if (tenderCategory) payload.referralSourceType = tenderCategory;
      if (participationDecision)
        payload.qualificationNotes = participationDecision;
      if (skipReason) payload.lostReason = skipReason;
      break;
    }
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
  const [channel, setChannel] = useState<LeadChannel>('WEBSITE');
  const [showDraftBanner, setShowDraftBanner] = useState(false);
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

  async function onSubmit(values: FormValues, reopen?: boolean) {
    const channelReq = channelRequirements(channel);
    if (channelReq) {
      const satisfied = channelReq.requireEither.some((field) =>
        (values[field] ?? '').toString().trim(),
      );
      if (!satisfied) {
        toast.error(`${channelReq.label} is required for this channel`);
        return;
      }
    }

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
            تجاهل
          </Button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-abak-blue">New lead</h1>
        <p className="text-sm text-muted-foreground">
          Pick the channel the opportunity came through, then fill in the
          details.
        </p>
      </div>

      <Tabs
        value={channel}
        onValueChange={(value) => setChannel(value as LeadChannel)}
      >
        <TabsList className="w-full flex-wrap">
          {LEAD_CHANNELS.map((ch) => (
            <TabsTrigger key={ch} value={ch} className="flex-1">
              {CHANNEL_LABELS[ch]}
            </TabsTrigger>
          ))}
        </TabsList>

        {LEAD_CHANNELS.map((ch) => (
          <TabsContent key={ch} value={ch} />
        ))}
      </Tabs>

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
            disabled={createLead.isPending}
            onClick={form.handleSubmit((values) => onSubmit(values, true))}
          >
            Submit & create another
          </Button>
          <Button type="submit" disabled={createLead.isPending}>
            {createLead.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create lead
          </Button>
        </div>
      </form>
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
        {required && <span className="ml-0.5 text-destructive">*</span>}
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
        {required && <span className="ml-0.5 text-destructive">*</span>}
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
  const participationDecision = form.watch('participationDecision');

  switch (channel) {
    case 'GOVERNMENT_TENDER':
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              تفاصيل المناقصة الحكومية
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="المنصة"
              value={form.watch('tenderPlatform') ?? ''}
              onValueChange={(v) => form.setValue('tenderPlatform', v)}
              required
            >
              <SelectItem value="Etimad">اعتماد</SelectItem>
              <SelectItem value="Fursa">فرصة</SelectItem>
              <SelectItem value="OTHER">أخرى</SelectItem>
            </SelectField>
            <TextField form={form} name="etimadNumber" label="رقم اعتماد" />
            <TextField form={form} name="fursaNumber" label="رقم فرصة" />
            <TextField
              form={form}
              name="tenderTitle"
              label="عنوان المناقصة"
              required
            />
            <SelectField
              label="فئة المناقصة"
              value={form.watch('tenderCategory') ?? ''}
              onValueChange={(v) => form.setValue('tenderCategory', v)}
            >
              <SelectItem value="Architecture">معمارية</SelectItem>
              <SelectItem value="Civil">مدني</SelectItem>
              <SelectItem value="MEP">MEP</SelectItem>
              <SelectItem value="Supervision">إشراف</SelectItem>
              <SelectItem value="Survey">مساحة</SelectItem>
              <SelectItem value="Other">أخرى</SelectItem>
            </SelectField>
            <TextField
              form={form}
              name="tenderDeadline"
              label="موعد التقديم"
              type="datetime-local"
              required
            />
            <TextField
              form={form}
              name="budget"
              label="القيمة التقديرية (ريال)"
              type="number"
            />
            <SelectField
              label="قرار المشاركة"
              value={form.watch('participationDecision') ?? ''}
              onValueChange={(v) => form.setValue('participationDecision', v)}
            >
              <SelectItem value="PENDING">قيد الدراسة</SelectItem>
              <SelectItem value="PARTICIPATE">المشاركة</SelectItem>
              <SelectItem value="SKIP">الانسحاب</SelectItem>
            </SelectField>
            {participationDecision === 'SKIP' && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="skipReason">سبب الانسحاب</Label>
                <Textarea
                  id="skipReason"
                  rows={3}
                  {...form.register('skipReason')}
                />
              </div>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="serviceDetails">ملخص النطاق التقني</Label>
              <Textarea
                id="serviceDetails"
                rows={3}
                {...form.register('serviceDetails')}
              />
            </div>
          </CardContent>
        </Card>
      );
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

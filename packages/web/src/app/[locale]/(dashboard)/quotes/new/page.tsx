'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Loader2,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { useClientsList } from '@/lib/hooks/use-clients';
import { useCreateQuote } from '@/lib/hooks/use-quotes';
import { useDepartments } from '@/lib/hooks/use-rfq-assignments';
import { useAdminServices } from '@/lib/hooks/use-services';

interface MethodologyDraft {
  description: string;
  steps: string[];
  deliverable: string;
}

interface GanttDraft {
  startDay: number;
  durationDays: number;
  categoryTone?: string;
}

interface LineItem {
  serviceId?: string;
  departmentId?: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPct?: number;
  notes?: string;
  methodology?: MethodologyDraft;
  gantt?: GanttDraft;
}

interface Milestone {
  description: string;
  percentage: number;
  daysFromStart?: number;
  notes?: string;
}

const DEFAULT_ITEM: LineItem = {
  description: '',
  quantity: 1,
  unitPrice: 0,
  discountPct: 0,
};

const DEFAULT_MILESTONE: Milestone = {
  description: '',
  percentage: 0,
};

function calcItemTotal(item: LineItem) {
  const subtotal = item.quantity * item.unitPrice;
  return subtotal * (1 - (item.discountPct ?? 0) / 100);
}

function calcTotals(
  items: LineItem[],
  discountType: 'FIXED' | 'PERCENTAGE',
  discountValue: number,
  taxRate: number,
) {
  const subtotal = items.reduce((s, i) => s + calcItemTotal(i), 0);
  const discountAmount =
    discountType === 'PERCENTAGE'
      ? subtotal * (discountValue / 100)
      : discountValue;
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxAmount = afterDiscount * (taxRate / 100);
  return {
    subtotal,
    discountAmount,
    taxAmount,
    total: afterDiscount + taxAmount,
  };
}

function sar(v: number) {
  return v.toLocaleString('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 2,
  });
}

export default function NewQuotePage() {
  const router = useRouter();
  const { mutateAsync: create, isPending } = useCreateQuote();

  const { data: clientsData } = useClientsList({ limit: 200 });
  const { data: services } = useAdminServices(false);
  const { data: departments = [] } = useDepartments();

  // Step 1 — Basic info
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [deliveryTimeline, setDeliveryTimeline] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Step 1 — Technical scope (optional)
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [assumptions, setAssumptions] = useState('');
  const [numberOfRevisions, setNumberOfRevisions] = useState('');

  // Step 2 — Line items
  const [items, setItems] = useState<LineItem[]>([{ ...DEFAULT_ITEM }]);
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENTAGE'>(
    'FIXED',
  );
  const [discountValue, setDiscountValue] = useState(0);
  const [taxRate, setTaxRate] = useState(15);

  // Step 3 — Milestones
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestoneTemplate, setMilestoneTemplate] = useState('');

  const [step, setStep] = useState<1 | 2 | 3>(1);
  // Per-item expand state for the methodology + gantt editors
  // (default collapsed so the long list stays scannable).
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpanded = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const clients = clientsData?.data ?? [];
  const totals = calcTotals(items, discountType, discountValue, taxRate);
  const milestoneSum = milestones.reduce((s, m) => s + m.percentage, 0);

  // ── Item helpers ──────────────────────────────────────────────────
  function addItem() {
    setItems((prev) => [...prev, { ...DEFAULT_ITEM }]);
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateItem<K extends keyof LineItem>(
    i: number,
    key: K,
    value: LineItem[K],
  ) {
    setItems((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, [key]: value } : item)),
    );
  }
  function autofillFromService(i: number, serviceId: string) {
    const svc = services?.find((s) => s.id === serviceId);
    if (!svc) return;
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === i
          ? {
              ...item,
              serviceId,
              description: svc.name,
              unit: svc.unit ?? '',
              unitPrice: svc.basePrice ?? item.unitPrice,
            }
          : item,
      ),
    );
  }

  // ── Milestone helpers ─────────────────────────────────────────────
  function addMilestone() {
    setMilestones((prev) => [...prev, { ...DEFAULT_MILESTONE }]);
  }
  function removeMilestone(i: number) {
    setMilestones((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateMilestone<K extends keyof Milestone>(
    i: number,
    key: K,
    value: Milestone[K],
  ) {
    setMilestones((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, [key]: value } : m)),
    );
  }
  function distributeEvenly() {
    if (milestones.length === 0) return;
    const pct = Math.floor(100 / milestones.length);
    const remainder = 100 - pct * milestones.length;
    setMilestones((prev) =>
      prev.map((m, i) => ({
        ...m,
        percentage: i === 0 ? pct + remainder : pct,
      })),
    );
  }

  function applyMilestoneTemplate(template: string) {
    setMilestoneTemplate(template);
    switch (template) {
      case 'TWO':
        setMilestones([
          { description: 'دفعة مقدمة', percentage: 50, daysFromStart: 0 },
          { description: 'دفعة التسليم', percentage: 50 },
        ]);
        break;
      case 'THREE':
        setMilestones([
          { description: 'دفعة أولى', percentage: 30, daysFromStart: 0 },
          { description: 'دفعة ثانية', percentage: 40 },
          { description: 'دفعة ثالثة', percentage: 30 },
        ]);
        break;
      case 'FOUR':
        setMilestones([
          { description: 'الدفعة الأولى', percentage: 25, daysFromStart: 0 },
          { description: 'الدفعة الثانية', percentage: 25 },
          { description: 'الدفعة الثالثة', percentage: 25 },
          { description: 'الدفعة الرابعة', percentage: 25 },
        ]);
        break;
      case 'CUSTOM':
        setMilestones([{ ...DEFAULT_MILESTONE }]);
        break;
      default:
        break;
    }
  }

  // ── Submit ────────────────────────────────────────────────────────
  async function handleSubmit() {
    const payload: Record<string, unknown> = {
      clientId,
      title,
      description: description || undefined,
      validUntil: validUntil || undefined,
      deliveryTimeline: deliveryTimeline || undefined,
      paymentTerms: paymentTerms || undefined,
      termsAndConditions: termsAndConditions || undefined,
      internalNotes: internalNotes || undefined,
      scopeOfWork: scopeOfWork || undefined,
      deliverables: deliverables || undefined,
      exclusions: exclusions || undefined,
      assumptions: assumptions || undefined,
      numberOfRevisions: numberOfRevisions
        ? Number(numberOfRevisions)
        : undefined,
      discountType,
      discountValue,
      taxRate,
      items: items.map((item, idx) => ({
        ...item,
        position: idx,
      })),
      milestones: milestones.length > 0 ? milestones : undefined,
    };
    const quote = await create(payload);
    router.push(`/quotes/${quote.id}`);
  }

  const canProceed1 = clientId.trim() !== '' && title.trim().length >= 2;
  const canProceed2 =
    items.length > 0 &&
    items.every(
      (i) => i.description.trim() && i.unitPrice >= 0 && i.quantity > 0,
    );
  const canSubmit =
    canProceed1 &&
    canProceed2 &&
    (milestones.length === 0 || Math.round(milestoneSum * 100) / 100 === 100);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/quotes" className="hover:text-foreground">
          عروض الأسعار
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">عرض سعر جديد</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[
          { n: 1 as const, label: 'المعلومات الأساسية' },
          { n: 2 as const, label: 'البنود' },
          { n: 3 as const, label: 'دفعات السداد' },
        ].map(({ n, label }, idx, arr) => (
          <div key={n} className="flex items-center gap-2">
            <button
              onClick={() => {
                if (
                  n < step ||
                  (n === 2 && canProceed1) ||
                  (n === 3 && canProceed2)
                )
                  setStep(n);
              }}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                step === n
                  ? 'bg-primary text-primary-foreground'
                  : step > n
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {n}
            </button>
            <span
              className={`text-sm ${step === n ? 'font-semibold' : 'text-muted-foreground'}`}
            >
              {label}
            </span>
            {idx < arr.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Basic Info ──────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>المعلومات الأساسية</CardTitle>
            <CardDescription>بيانات العميل وتفاصيل العرض</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client">
                  العميل <span className="text-red-500">*</span>
                </Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger id="client">
                    <SelectValue placeholder="اختر العميل..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.companyName
                          ? `${c.companyName} — ${c.contactName}`
                          : c.contactName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="title">
                  عنوان العرض <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: تصميم معماري لمبنى سكني"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="description">وصف مختصر</Label>
                <Textarea
                  id="description"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف العمل المطلوب..."
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="scopeOfWork">نطاق العمل</Label>
                <Textarea
                  id="scopeOfWork"
                  rows={3}
                  value={scopeOfWork}
                  onChange={(e) => setScopeOfWork(e.target.value)}
                  placeholder="صف نطاق العمل المشمول في هذا العرض..."
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="deliverables">المخرجات والتسليمات</Label>
                <Textarea
                  id="deliverables"
                  rows={3}
                  value={deliverables}
                  onChange={(e) => setDeliverables(e.target.value)}
                  placeholder="اذكر المخرجات والتسليمات المتوقعة..."
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="exclusions">
                  المستثنيات{' '}
                  <span className="text-muted-foreground text-xs">
                    (اختياري)
                  </span>
                </Label>
                <Textarea
                  id="exclusions"
                  rows={2}
                  value={exclusions}
                  onChange={(e) => setExclusions(e.target.value)}
                  placeholder="ما الذي لا يشمله العرض..."
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="assumptions">
                  الافتراضات والشروط{' '}
                  <span className="text-muted-foreground text-xs">
                    (اختياري)
                  </span>
                </Label>
                <Textarea
                  id="assumptions"
                  rows={2}
                  value={assumptions}
                  onChange={(e) => setAssumptions(e.target.value)}
                  placeholder="الافتراضات التي يقوم عليها العرض..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="numberOfRevisions">
                  عدد جولات المراجعة{' '}
                  <span className="text-muted-foreground text-xs">
                    (اختياري)
                  </span>
                </Label>
                <Input
                  id="numberOfRevisions"
                  type="number"
                  min={0}
                  value={numberOfRevisions}
                  onChange={(e) => setNumberOfRevisions(e.target.value)}
                  placeholder="مثال: 2"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="validUntil">صالح حتى</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="delivery">مدة التنفيذ</Label>
                <Input
                  id="delivery"
                  value={deliveryTimeline}
                  onChange={(e) => setDeliveryTimeline(e.target.value)}
                  placeholder="مثال: 90 يوم عمل"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="paymentTerms">شروط السداد</Label>
                <Input
                  id="paymentTerms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="مثال: 30 يوم من تاريخ الفاتورة"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="terms">الشروط والأحكام</Label>
                <Input
                  id="terms"
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  placeholder="اختياري"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notes">ملاحظات داخلية</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="ملاحظات لا تظهر للعميل..."
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button disabled={!canProceed1} onClick={() => setStep(2)}>
                التالي: البنود
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Line Items ──────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>بنود عرض السعر</CardTitle>
            <CardDescription>
              أضف الخدمات والمنتجات المشمولة في العرض
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Items table */}
            <div className="space-y-3">
              {items.map((item, i) => (
                <div
                  key={i}
                  className="rounded-lg border bg-card p-4 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-sm font-semibold text-primary">
                      البند {i + 1}
                    </span>
                    {items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeItem(i)}
                        aria-label="حذف البند"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  {/* Section 1 — Service definition (department + service + description) */}
                  <section className="space-y-3">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      الخدمة
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">القسم</Label>
                        <Select
                          value={item.departmentId ?? ''}
                          onValueChange={(v) =>
                            updateItem(i, 'departmentId', v)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر القسم..." />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.nameAr ?? d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">الخدمة *</Label>
                        <Select
                          value={item.serviceId ?? ''}
                          onValueChange={(v) => {
                            if (v) autofillFromService(i, v);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر خدمة..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(services ?? []).map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">الوصف</Label>
                      <Input
                        placeholder="وصف البند"
                        value={item.description}
                        onChange={(e) =>
                          updateItem(i, 'description', e.target.value)
                        }
                      />
                    </div>
                  </section>

                  {/* Section 2 — Pricing (qty + unit + price + discount, in a 4-col band) */}
                  <section className="space-y-3 border-t border-border pt-3">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      التسعير
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">الكمية *</Label>
                        <Input
                          className="num"
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(i, 'quantity', Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">الوحدة</Label>
                        <Input
                          placeholder="م², ساعة، ..."
                          value={item.unit ?? ''}
                          onChange={(e) =>
                            updateItem(i, 'unit', e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">سعر الوحدة (ريال) *</Label>
                        <Input
                          className="num"
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(i, 'unitPrice', Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">خصم البند (%)</Label>
                        <Input
                          className="num"
                          type="number"
                          min={0}
                          max={100}
                          value={item.discountPct ?? 0}
                          onChange={(e) =>
                            updateItem(i, 'discountPct', Number(e.target.value))
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-baseline justify-end gap-2 pt-1">
                      <span className="text-xs text-muted-foreground">
                        إجمالي البند
                      </span>
                      <span className="num text-base font-semibold text-primary">
                        {sar(calcItemTotal(item))}
                      </span>
                    </div>
                  </section>

                  {/* Section 3 — Notes (optional, full-width) */}
                  <section className="space-y-1.5 border-t border-border pt-3">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      ملاحظات
                    </h3>
                    <Input
                      placeholder="ملاحظات إضافية لهذا البند..."
                      value={item.notes ?? ''}
                      onChange={(e) => updateItem(i, 'notes', e.target.value)}
                    />
                  </section>

                  {/* Methodology + Gantt toggle — collapsed by default to keep
                      the list scannable for small quotes. Methodology renders
                      on page 5 of the PDF; gantt on page 6. */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => toggleExpanded(i)}
                    >
                      {expanded.has(i) ? (
                        <ChevronUp className="me-1 h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="me-1 h-3.5 w-3.5" />
                      )}
                      منهجية + Gantt
                    </Button>
                    {item.methodology && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                        <ClipboardList className="h-3 w-3" />
                        منهجية
                      </span>
                    )}
                    {item.gantt && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700">
                        <CalendarRange className="h-3 w-3" />
                        Gantt: يوم {item.gantt.startDay} +{' '}
                        {item.gantt.durationDays}يوم
                      </span>
                    )}
                  </div>

                  {expanded.has(i) && (
                    <MethodologyGanttEditor
                      methodology={item.methodology}
                      gantt={item.gantt}
                      onMethodologyChange={(m) =>
                        updateItem(i, 'methodology', m)
                      }
                      onGanttChange={(g) => updateItem(i, 'gantt', g)}
                    />
                  )}
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="me-1 h-3.5 w-3.5" />
              إضافة بند
            </Button>

            <hr className="border-border" />

            {/* Discount + Tax */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>نوع الخصم الإجمالي</Label>
                <Select
                  value={discountType}
                  onValueChange={(v) =>
                    setDiscountType(v as 'FIXED' | 'PERCENTAGE')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">مبلغ ثابت (ريال)</SelectItem>
                    <SelectItem value="PERCENTAGE">نسبة مئوية (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>
                  قيمة الخصم {discountType === 'PERCENTAGE' ? '(%)' : '(ريال)'}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>نسبة الضريبة (VAT %)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">المجموع قبل الخصم</span>
                <span>{sar(totals.subtotal)}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>الخصم</span>
                  <span>- {sar(totals.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>ضريبة القيمة المضافة ({taxRate}%)</span>
                <span>{sar(totals.taxAmount)}</span>
              </div>
              <hr className="border-border" />
              <div className="flex justify-between text-base font-bold">
                <span>الإجمالي</span>
                <span>{sar(totals.total)}</span>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                السابق
              </Button>
              <Button disabled={!canProceed2} onClick={() => setStep(3)}>
                التالي: دفعات السداد
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* (Methodology + Gantt editor lives at the bottom of the file as
          a reusable subcomponent — see MethodologyGanttEditor.) */}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>جدول دفعات السداد</CardTitle>
            <CardDescription>
              اختياري — إذا تركتها فارغة سيتم إرسال العرض بدون جدول سداد. يجب أن
              تكون المجموع 100%.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Payment schedule template selector */}
            <div className="space-y-1.5">
              <Label>قالب جدول السداد</Label>
              <Select
                value={milestoneTemplate}
                onValueChange={applyMilestoneTemplate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر قالباً أو أضف الدفعات يدوياً..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TWO">
                    50% مقدم + 50% عند التسليم (قسطان)
                  </SelectItem>
                  <SelectItem value="THREE">
                    30% + 40% + 30% (ثلاثة أقساط)
                  </SelectItem>
                  <SelectItem value="FOUR">
                    25% × 4 (أربعة أقساط متساوية)
                  </SelectItem>
                  <SelectItem value="CUSTOM">مخصص</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {milestones.length > 0 && (
              <div className="space-y-2">
                {milestones.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2"
                  >
                    <div className="flex-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Input
                        className="h-8 text-xs"
                        placeholder="وصف الدفعة"
                        value={m.description}
                        onChange={(e) =>
                          updateMilestone(i, 'description', e.target.value)
                        }
                      />
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-8 text-xs"
                          type="number"
                          min={0}
                          max={100}
                          placeholder="%"
                          value={m.percentage}
                          onChange={(e) =>
                            updateMilestone(
                              i,
                              'percentage',
                              Number(e.target.value),
                            )
                          }
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                      <Input
                        className="h-8 text-xs"
                        type="number"
                        min={0}
                        placeholder="يوم من البداية"
                        value={m.daysFromStart ?? ''}
                        onChange={(e) =>
                          updateMilestone(
                            i,
                            'daysFromStart',
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                      />
                      <Input
                        className="h-8 text-xs"
                        placeholder="ملاحظات"
                        value={m.notes ?? ''}
                        onChange={(e) =>
                          updateMilestone(i, 'notes', e.target.value)
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeMilestone(i)}
                    >
                      <Minus className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                ))}

                {/* Milestone total indicator */}
                <div
                  className={`text-xs font-medium ${
                    Math.round(milestoneSum * 100) / 100 === 100
                      ? 'text-green-600'
                      : 'text-red-500'
                  }`}
                >
                  المجموع: {milestoneSum.toFixed(1)}%{' '}
                  {Math.round(milestoneSum * 100) / 100 !== 100 &&
                    '(يجب أن يساوي 100%)'}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addMilestone}>
                <Plus className="me-1 h-3.5 w-3.5" />
                إضافة دفعة
              </Button>
              {milestones.length > 1 && (
                <Button variant="outline" size="sm" onClick={distributeEvenly}>
                  توزيع متساوٍ
                </Button>
              )}
            </div>

            {/* Final totals reminder */}
            <div className="rounded-lg border bg-muted/50 p-3 text-sm">
              <div className="flex justify-between font-bold">
                <span>إجمالي العرض</span>
                <span>{sar(totals.total)}</span>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                السابق
              </Button>
              <Button
                disabled={!canSubmit || isPending}
                onClick={() => void handleSubmit()}
              >
                {isPending ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : null}
                إنشاء العرض
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// MethodologyGanttEditor — collapsible per-line panel.
//
// Renders into the canonical PDF (methodology = page 5, gantt = page 6).
// The "Add" buttons explicitly create the optional records so the pricer
// doesn't accidentally save an empty methodology/gantt; the "Remove" link
// clears it back to undefined.
// ────────────────────────────────────────────────────────────────────

function MethodologyGanttEditor({
  methodology,
  gantt,
  onMethodologyChange,
  onGanttChange,
}: {
  methodology?: MethodologyDraft;
  gantt?: GanttDraft;
  onMethodologyChange: (m: MethodologyDraft | undefined) => void;
  onGanttChange: (g: GanttDraft | undefined) => void;
}) {
  return (
    <div className="grid gap-3 rounded-md border bg-background p-3 md:grid-cols-2">
      {/* Methodology */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">
            <ClipboardList className="me-1 inline h-3.5 w-3.5" />
            المنهجية (صفحة 5 من PDF)
          </Label>
          {methodology ? (
            <button
              type="button"
              onClick={() => onMethodologyChange(undefined)}
              className="text-[11px] text-rose-500 hover:underline"
            >
              إزالة
            </button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() =>
                onMethodologyChange({
                  description: '',
                  steps: [''],
                  deliverable: '',
                })
              }
            >
              <Plus className="me-1 h-3 w-3" />
              إضافة منهجية
            </Button>
          )}
        </div>

        {methodology && (
          <div className="space-y-2">
            <Textarea
              rows={3}
              className="text-xs"
              placeholder="وصف منهجية تنفيذ هذا البند..."
              value={methodology.description}
              onChange={(e) =>
                onMethodologyChange({
                  ...methodology,
                  description: e.target.value,
                })
              }
            />

            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                الخطوات
              </Label>
              {methodology.steps.map((step, si) => (
                <div key={si} className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground w-4">
                    {si + 1}.
                  </span>
                  <Input
                    className="h-7 flex-1 text-xs"
                    placeholder={`الخطوة ${si + 1}`}
                    value={step}
                    onChange={(e) => {
                      const next = [...methodology.steps];
                      next[si] = e.target.value;
                      onMethodologyChange({ ...methodology, steps: next });
                    }}
                  />
                  {methodology.steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = methodology.steps.filter(
                          (_, idx) => idx !== si,
                        );
                        onMethodologyChange({ ...methodology, steps: next });
                      }}
                      className="text-rose-400 hover:text-rose-600"
                      aria-label="حذف الخطوة"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] text-muted-foreground"
                onClick={() =>
                  onMethodologyChange({
                    ...methodology,
                    steps: [...methodology.steps, ''],
                  })
                }
              >
                <Plus className="me-1 h-3 w-3" />
                إضافة خطوة
              </Button>
            </div>

            <Input
              className="h-7 text-xs"
              placeholder="المخرج (deliverable) المتوقع"
              value={methodology.deliverable}
              onChange={(e) =>
                onMethodologyChange({
                  ...methodology,
                  deliverable: e.target.value,
                })
              }
            />
          </div>
        )}
      </div>

      {/* Gantt */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">
            <CalendarRange className="me-1 inline h-3.5 w-3.5" />
            Gantt (صفحة 6 من PDF)
          </Label>
          {gantt ? (
            <button
              type="button"
              onClick={() => onGanttChange(undefined)}
              className="text-[11px] text-rose-500 hover:underline"
            >
              إزالة
            </button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() =>
                onGanttChange({
                  startDay: 0,
                  durationDays: 7,
                  categoryTone: '#2d7ad1',
                })
              }
            >
              <Plus className="me-1 h-3 w-3" />
              إضافة بلوك Gantt
            </Button>
          )}
        </div>

        {gantt && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px] text-muted-foreground">
                  يبدأ يوم
                </Label>
                <Input
                  className="h-7 text-xs"
                  type="number"
                  min={0}
                  value={gantt.startDay}
                  onChange={(e) =>
                    onGanttChange({
                      ...gantt,
                      startDay: Math.max(0, Number(e.target.value)),
                    })
                  }
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px] text-muted-foreground">
                  المدة (أيام)
                </Label>
                <Input
                  className="h-7 text-xs"
                  type="number"
                  min={1}
                  value={gantt.durationDays}
                  onChange={(e) =>
                    onGanttChange({
                      ...gantt,
                      durationDays: Math.max(1, Number(e.target.value)),
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-0.5">
              <Label className="text-[11px] text-muted-foreground">
                لون التصنيف
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={gantt.categoryTone ?? '#2d7ad1'}
                  onChange={(e) =>
                    onGanttChange({ ...gantt, categoryTone: e.target.value })
                  }
                  className="h-7 w-12 rounded border bg-transparent"
                />
                <Input
                  className="h-7 flex-1 text-xs font-mono"
                  value={gantt.categoryTone ?? '#2d7ad1'}
                  onChange={(e) =>
                    onGanttChange({ ...gantt, categoryTone: e.target.value })
                  }
                />
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              المعاينة في الـ PDF: شريط ملوّن من اليوم {gantt.startDay} إلى{' '}
              {gantt.startDay + gantt.durationDays}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

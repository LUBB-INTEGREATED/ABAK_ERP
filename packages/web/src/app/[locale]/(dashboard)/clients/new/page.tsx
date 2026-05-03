'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateClient } from '@/lib/hooks/use-clients';
import { useUsers } from '@/lib/hooks/use-leads';
import {
  CLIENT_TYPES,
  CLIENT_TYPE_LABELS,
  type ClientType,
} from '@/lib/types/client';

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

export default function NewClientPage() {
  const router = useRouter();
  const mutation = useCreateClient();
  const users = useUsers();
  const activeUsers = users.data?.filter((u) => u.status === 'ACTIVE') ?? [];

  const [contactName, setContactName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [clientType, setClientType] = useState<ClientType | ''>('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [commercialRegistration, setCommercialRegistration] = useState('');
  const [taxId, setTaxId] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [accountManagerId, setAccountManagerId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (contactName.trim().length < 2) {
      next.contactName = 'الاسم مطلوب (حرفان على الأقل)';
    }
    if (!clientType) {
      next.clientType = 'نوع العميل مطلوب';
    }
    if (!phone.trim()) {
      next.phone = 'رقم الهاتف مطلوب';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!validate()) return;

    const body: Record<string, unknown> = {
      contactName: contactName.trim(),
      clientType: clientType as ClientType,
      phone: phone.trim(),
    };
    if (companyName.trim()) body.companyName = companyName.trim();
    if (alternatePhone.trim()) body.alternatePhone = alternatePhone.trim();
    if (email.trim()) body.email = email.trim();
    if (website.trim()) body.website = website.trim();
    if (city.trim()) body.city = city.trim();
    if (region) body.region = region;
    if (addressLine1.trim()) body.addressLine1 = addressLine1.trim();
    if (commercialRegistration.trim())
      body.commercialRegistration = commercialRegistration.trim();
    if (taxId.trim()) body.taxId = taxId.trim();
    if (paymentTerms.trim()) body.paymentTerms = paymentTerms.trim();
    if (creditLimit.trim() && Number.isFinite(Number(creditLimit))) {
      body.creditLimit = Number(creditLimit);
    }
    if (accountManagerId) body.accountManagerId = accountManagerId;

    try {
      const client = await mutation.mutateAsync(body);
      toast.success(`تم إنشاء العميل ${client.clientNumber}`);
      router.push(`/clients/${client.id}`);
    } catch (error) {
      const apiBody = (error as { response?: { data?: unknown } })?.response
        ?.data;
      if (
        apiBody &&
        typeof apiBody === 'object' &&
        'message' in apiBody &&
        (apiBody as { message?: { existingClientId?: string } }).message
          ?.existingClientId
      ) {
        const msg = (apiBody as { message: { existingClientId: string } })
          .message;
        toast.error('يوجد عميل مسجل بهذا الهاتف أو البريد الإلكتروني');
        router.push(`/clients/${msg.existingClientId}`);
        return;
      }
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'فشل إنشاء العميل';
      toast.error(
        Array.isArray(message) ? message.join(', ') : String(message),
      );
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-abak-blue hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> العودة إلى العملاء
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-abak-blue">عميل جديد</h1>
        <p className="text-sm text-muted-foreground">
          أدخل بيانات العميل الجديد. الحقول المميزة بـ * مطلوبة.
        </p>
      </div>

      <div className="space-y-6">
        {/* Contact info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">بيانات التواصل</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldWrapper
              id="contactName"
              label="اسم جهة الاتصال"
              required
              error={errors.contactName}
            >
              <Input
                id="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                aria-invalid={Boolean(errors.contactName)}
              />
            </FieldWrapper>

            <FieldWrapper
              id="clientType"
              label="نوع العميل"
              required
              error={errors.clientType}
            >
              <Select
                value={clientType}
                onValueChange={(value) => setClientType(value as ClientType)}
              >
                <SelectTrigger
                  id="clientType"
                  aria-invalid={Boolean(errors.clientType)}
                >
                  <SelectValue placeholder="اختر نوع العميل" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {CLIENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>

            <FieldWrapper id="companyName" label="اسم الشركة / المنشأة">
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </FieldWrapper>

            <FieldWrapper
              id="phone"
              label="رقم الهاتف"
              required
              error={errors.phone}
            >
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+966501234567"
                aria-invalid={Boolean(errors.phone)}
              />
            </FieldWrapper>

            <FieldWrapper id="alternatePhone" label="رقم هاتف بديل">
              <Input
                id="alternatePhone"
                value={alternatePhone}
                onChange={(e) => setAlternatePhone(e.target.value)}
              />
            </FieldWrapper>

            <FieldWrapper id="email" label="البريد الإلكتروني">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FieldWrapper>

            <FieldWrapper id="website" label="الموقع الإلكتروني">
              <Input
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </FieldWrapper>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">العنوان</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldWrapper id="addressLine1" label="العنوان">
              <Input
                id="addressLine1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
              />
            </FieldWrapper>

            <FieldWrapper id="city" label="المدينة">
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="الرياض"
              />
            </FieldWrapper>

            <FieldWrapper id="region" label="المنطقة">
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger id="region">
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
            </FieldWrapper>
          </CardContent>
        </Card>

        {/* Company & Account */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              البيانات التجارية والحساب
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldWrapper id="commercialRegistration" label="السجل التجاري">
              <Input
                id="commercialRegistration"
                value={commercialRegistration}
                onChange={(e) => setCommercialRegistration(e.target.value)}
              />
            </FieldWrapper>

            <FieldWrapper id="taxId" label="الرقم الضريبي">
              <Input
                id="taxId"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
              />
            </FieldWrapper>

            <FieldWrapper id="paymentTerms" label="شروط الدفع">
              <Input
                id="paymentTerms"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="30 يوم"
              />
            </FieldWrapper>

            <FieldWrapper id="creditLimit" label="حد الائتمان (ريال)">
              <Input
                id="creditLimit"
                type="number"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
              />
            </FieldWrapper>

            <FieldWrapper id="accountManagerId" label="مدير الحساب">
              <Select
                value={accountManagerId}
                onValueChange={setAccountManagerId}
              >
                <SelectTrigger id="accountManagerId">
                  <SelectValue placeholder="غير محدد" />
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
            </FieldWrapper>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/clients')}
            disabled={mutation.isPending}
          >
            إلغاء
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            إنشاء عميل
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldWrapper({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

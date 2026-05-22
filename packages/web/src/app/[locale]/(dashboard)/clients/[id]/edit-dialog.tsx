'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateClient } from '@/lib/hooks/use-clients';
import type { Client } from '@/lib/types/client';

export function EditClientDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
}) {
  const t = useTranslations('clients.editDialog');
  const [contactName, setContactName] = useState(client.contactName);
  const [companyName, setCompanyName] = useState(client.companyName ?? '');
  const [phone, setPhone] = useState(client.phone);
  const [email, setEmail] = useState(client.email ?? '');
  const [website, setWebsite] = useState(client.website ?? '');
  const [city, setCity] = useState(client.city ?? '');
  const [region, setRegion] = useState(client.region ?? '');
  const [paymentTerms, setPaymentTerms] = useState(client.paymentTerms ?? '');
  const [creditLimit, setCreditLimit] = useState(
    client.creditLimit !== null ? String(client.creditLimit) : '',
  );
  const [commercialRegistration, setCommercialRegistration] = useState(
    client.commercialRegistration ?? '',
  );
  const [taxId, setTaxId] = useState(client.taxId ?? '');
  const [addressLine1, setAddressLine1] = useState(client.addressLine1 ?? '');

  const mutation = useUpdateClient(client.id);

  async function submit() {
    const body: Record<string, unknown> = {
      contactName: contactName.trim(),
      companyName: companyName.trim() || null,
      phone: phone.trim(),
      email: email.trim() || null,
      website: website.trim() || null,
      city: city.trim() || null,
      region: region.trim() || null,
      addressLine1: addressLine1.trim() || null,
      paymentTerms: paymentTerms.trim() || null,
      commercialRegistration: commercialRegistration.trim() || null,
      taxId: taxId.trim() || null,
    };
    if (creditLimit.trim()) {
      const parsed = Number(creditLimit);
      if (Number.isFinite(parsed)) body.creditLimit = parsed;
    } else {
      body.creditLimit = null;
    }

    try {
      await mutation.mutateAsync(body);
      toast.success(t('updated'));
      onOpenChange(false);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('failed');
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t('title', { clientNumber: client.clientNumber })}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            id="contactName"
            label={t('contactName')}
            value={contactName}
            onChange={setContactName}
          />
          <Field
            id="companyName"
            label={t('company')}
            value={companyName}
            onChange={setCompanyName}
          />
          <Field
            id="phone"
            label={t('phone')}
            value={phone}
            onChange={setPhone}
          />
          <Field
            id="email"
            label={t('email')}
            type="email"
            value={email}
            onChange={setEmail}
          />
          <Field
            id="website"
            label={t('website')}
            value={website}
            onChange={setWebsite}
          />
          <Field
            id="addressLine1"
            label={t('address')}
            value={addressLine1}
            onChange={setAddressLine1}
          />
          <Field id="city" label={t('city')} value={city} onChange={setCity} />
          <Field
            id="region"
            label={t('region')}
            value={region}
            onChange={setRegion}
          />
          <Field
            id="taxId"
            label={t('taxId')}
            value={taxId}
            onChange={setTaxId}
          />
          <Field
            id="cr"
            label={t('commercialReg')}
            value={commercialRegistration}
            onChange={setCommercialRegistration}
          />
          <Field
            id="creditLimit"
            label={t('creditLimit')}
            type="number"
            value={creditLimit}
            onChange={setCreditLimit}
          />
          <Field
            id="paymentTerms"
            label={t('paymentTerms')}
            value={paymentTerms}
            onChange={setPaymentTerms}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? t('saving') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type ?? 'text'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

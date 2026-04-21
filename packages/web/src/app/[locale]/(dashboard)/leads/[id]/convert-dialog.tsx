'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { useCreateClient } from '@/lib/hooks/use-clients';
import type { Lead } from '@/lib/types/lead';

export function ConvertLeadDialog({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
}) {
  const router = useRouter();
  const [contactName, setContactName] = useState(lead.contactName);
  const [companyName, setCompanyName] = useState(lead.companyName ?? '');
  const [phone, setPhone] = useState(lead.phone);
  const [email, setEmail] = useState(lead.email ?? '');
  const [city, setCity] = useState(lead.projectLocation ?? '');
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const mutation = useCreateClient();

  async function submit() {
    setDuplicateId(null);
    try {
      const client = await mutation.mutateAsync({
        contactName: contactName.trim(),
        companyName: companyName.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        city: city.trim() || undefined,
        fromLeadId: lead.id,
      });
      toast.success(`Client ${client.clientNumber} created`);
      onOpenChange(false);
      router.push(`/clients/${client.id}`);
    } catch (error) {
      const body = (error as { response?: { data?: unknown } })?.response?.data;
      if (
        body &&
        typeof body === 'object' &&
        'message' in body &&
        (body as { message?: { existingClientId?: string } }).message
          ?.existingClientId
      ) {
        const msg = (body as { message: { existingClientId: string } }).message;
        setDuplicateId(msg.existingClientId);
        toast.message('Duplicate found — review below');
        return;
      }
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to convert';
      toast.error(
        Array.isArray(message) ? message.join(', ') : String(message),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert lead to client</DialogTitle>
          <DialogDescription>
            Pre-filled from {lead.leadNumber}. Adjust anything the client form
            will need, then create the record. The lead will be marked CONVERTED
            and linked to the new client.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contactName">Contact</Label>
            <Input
              id="contactName"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">Company</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </div>
        </div>

        {duplicateId && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            A client with this phone or email already exists.{' '}
            <Link
              href={`/clients/${duplicateId}`}
              className="font-medium text-abak-blue hover:underline"
            >
              Open the existing record →
            </Link>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Converting…' : 'Convert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

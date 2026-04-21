'use client';

import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateLead } from '@/lib/hooks/use-leads';
import { LEAD_PRIORITIES, PRIORITY_LABELS } from '@/lib/types/lead';
import type { Lead, LeadPriority } from '@/lib/types/lead';

export function EditDialog({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
}) {
  const [contactName, setContactName] = useState(lead.contactName);
  const [companyName, setCompanyName] = useState(lead.companyName ?? '');
  const [email, setEmail] = useState(lead.email ?? '');
  const [phone, setPhone] = useState(lead.phone);
  const [priority, setPriority] = useState<LeadPriority>(lead.priority);
  const [projectLocation, setProjectLocation] = useState(
    lead.projectLocation ?? '',
  );
  const [budget, setBudget] = useState<string>(
    lead.budget !== null ? String(lead.budget) : '',
  );
  const [timeline, setTimeline] = useState(lead.timeline ?? '');
  const [serviceDetails, setServiceDetails] = useState(
    lead.serviceDetails ?? '',
  );
  const [qualificationScore, setQualificationScore] = useState<string>(
    lead.qualificationScore !== null ? String(lead.qualificationScore) : '',
  );
  const [qualificationNotes, setQualificationNotes] = useState(
    lead.qualificationNotes ?? '',
  );

  const mutation = useUpdateLead(lead.id);

  async function submit() {
    const payload: Record<string, unknown> = {
      contactName: contactName.trim(),
      companyName: companyName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim(),
      priority,
      projectLocation: projectLocation.trim() || null,
      timeline: timeline.trim() || null,
      serviceDetails: serviceDetails.trim() || null,
      qualificationNotes: qualificationNotes.trim() || null,
    };

    if (budget.trim()) {
      const parsed = Number(budget);
      if (Number.isFinite(parsed)) payload.budget = parsed;
    } else {
      payload.budget = null;
    }

    if (qualificationScore.trim()) {
      const parsed = Number(qualificationScore);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 100) {
        payload.qualificationScore = parsed;
      }
    }

    try {
      await mutation.mutateAsync(payload as Partial<Lead>);
      toast.success('Lead updated');
      onOpenChange(false);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to update lead';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit lead {lead.leadNumber}</DialogTitle>
          <DialogDescription>
            Update contact, service, and qualification fields.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contactName">Contact name</Label>
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
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as LeadPriority)}
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
            <Label htmlFor="projectLocation">Project location</Label>
            <Input
              id="projectLocation"
              value={projectLocation}
              onChange={(event) => setProjectLocation(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget">Budget (SAR)</Label>
            <Input
              id="budget"
              type="number"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeline">Timeline</Label>
            <Input
              id="timeline"
              value={timeline}
              onChange={(event) => setTimeline(event.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="serviceDetails">Service details</Label>
            <Textarea
              id="serviceDetails"
              value={serviceDetails}
              onChange={(event) => setServiceDetails(event.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qualificationScore">Qualification score</Label>
            <Input
              id="qualificationScore"
              type="number"
              min={0}
              max={100}
              value={qualificationScore}
              onChange={(event) => setQualificationScore(event.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="qualificationNotes">Qualification notes</Label>
            <Textarea
              id="qualificationNotes"
              value={qualificationNotes}
              onChange={(event) => setQualificationNotes(event.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

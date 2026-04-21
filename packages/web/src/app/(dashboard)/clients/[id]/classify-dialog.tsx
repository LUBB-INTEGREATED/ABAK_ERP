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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClassifyClient } from '@/lib/hooks/use-clients';
import {
  CLASSIFICATION_LABELS,
  CLIENT_CLASSIFICATIONS,
  type Client,
  type ClientClassification,
} from '@/lib/types/client';

export function ClassifyDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
}) {
  const [classification, setClassification] = useState<ClientClassification>(
    client.classification,
  );
  const [manual, setManual] = useState<boolean>(client.classificationManual);
  const mutation = useClassifyClient(client.id);

  async function submit() {
    try {
      await mutation.mutateAsync({ classification, manual });
      toast.success('Classification updated');
      onOpenChange(false);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to update';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reclassify</DialogTitle>
          <DialogDescription>
            Locking the classification prevents the auto-classifier from
            changing it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Classification</Label>
            <Select
              value={classification}
              onValueChange={(value) =>
                setClassification(value as ClientClassification)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_CLASSIFICATIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CLASSIFICATION_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="manual"
              type="checkbox"
              checked={manual}
              onChange={(event) => setManual(event.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="manual">Lock from auto-reclassify</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

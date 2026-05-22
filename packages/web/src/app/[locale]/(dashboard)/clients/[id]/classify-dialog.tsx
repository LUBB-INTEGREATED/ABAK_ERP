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
  CLIENT_CLASSIFICATIONS,
  type Client,
  type ClientClassification,
} from '@/lib/types/client';
import { useEnumLabel } from '@/lib/i18n/enum-labels';

export function ClassifyDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
}) {
  const t = useTranslations('clients.classifyDialog');
  const classificationLabel = useEnumLabel('clientClassification');
  const [classification, setClassification] = useState<ClientClassification>(
    client.classification,
  );
  const [manual, setManual] = useState<boolean>(client.classificationManual);
  const mutation = useClassifyClient(client.id);

  async function submit() {
    try {
      await mutation.mutateAsync({ classification, manual });
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('classification')}</Label>
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
                    {classificationLabel(c)}
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
            <Label htmlFor="manual">{t('lockManual')}</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? t('saving') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

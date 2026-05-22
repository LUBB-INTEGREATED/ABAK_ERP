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
import { Textarea } from '@/components/ui/textarea';
import { useAddNote } from '@/lib/hooks/use-clients';
import { NOTE_TAGS, type NoteTag } from '@/lib/types/client';
import { useEnumLabel } from '@/lib/i18n/enum-labels';

export function NoteDialog({
  open,
  onOpenChange,
  clientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}) {
  const t = useTranslations('clients.noteDialog');
  const tagLabel = useEnumLabel('noteTag');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState<NoteTag>('GENERAL');
  const mutation = useAddNote(clientId);

  async function submit() {
    if (!body.trim()) {
      toast.error(t('bodyRequired'));
      return;
    }
    try {
      await mutation.mutateAsync({ body: body.trim(), tag });
      toast.success(t('added'));
      onOpenChange(false);
      setBody('');
      setTag('GENERAL');
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
            <Label>{t('tag')}</Label>
            <Select
              value={tag}
              onValueChange={(value) => setTag(value as NoteTag)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTE_TAGS.map((tagValue) => (
                  <SelectItem key={tagValue} value={tagValue}>
                    {tagLabel(tagValue)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">{t('body')}</Label>
            <Textarea
              id="body"
              rows={5}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
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

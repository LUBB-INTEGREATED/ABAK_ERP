'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { formatDate } from 'shared-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useCreateHoliday,
  useDeleteHoliday,
  useHolidays,
} from '@/lib/hooks/use-holidays';

export default function HolidaysPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { data, isLoading } = useHolidays();
  const create = useCreateHoliday();
  const remove = useDeleteHoliday();

  const [form, setForm] = useState({
    date: '',
    nameAr: '',
    nameEn: '',
    isRecurring: false,
  });

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await create.mutateAsync(form);
      setForm({ date: '', nameAr: '', nameEn: '', isRecurring: false });
      toast.success(t('common.success'));
    } catch {
      toast.error(t('errors.generic'));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-abak-blue">
          {t('holidays.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('holidays.subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('holidays.addNew')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onAdd}
            className="grid gap-3 md:grid-cols-5 md:items-end"
          >
            <label className="text-sm md:col-span-1">
              <span className="mb-1 block font-medium">
                {t('holidays.date')}
              </span>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="input-base"
              />
            </label>
            <label className="text-sm md:col-span-1">
              <span className="mb-1 block font-medium">
                {t('holidays.nameAr')}
              </span>
              <input
                type="text"
                required
                value={form.nameAr}
                onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                className="input-base"
              />
            </label>
            <label className="text-sm md:col-span-1">
              <span className="mb-1 block font-medium">
                {t('holidays.nameEn')}
              </span>
              <input
                type="text"
                required
                value={form.nameEn}
                onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                className="input-base"
              />
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-1">
              <input
                type="checkbox"
                checked={form.isRecurring}
                onChange={(e) =>
                  setForm({ ...form, isRecurring: e.target.checked })
                }
              />
              <span>{t('holidays.recurring')}</span>
            </label>
            <Button type="submit" disabled={create.isPending}>
              {t('common.save')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="divide-y">
          {isLoading && (
            <div className="py-4 text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          )}
          {!isLoading && data?.length === 0 && (
            <div className="py-4 text-sm text-muted-foreground">
              {t('common.empty')}
            </div>
          )}
          {data?.map((h) => (
            <div
              key={h.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
            >
              <div className="min-w-[10rem] font-mono">
                {formatDate(h.date, {
                  locale: locale === 'ar' ? 'ar' : 'en',
                  calendar: 'both',
                })}
              </div>
              <div className="flex-1">
                {locale === 'ar' ? h.nameAr : h.nameEn}
                <span className="ms-2 text-xs text-muted-foreground">
                  {locale === 'ar' ? h.nameEn : h.nameAr}
                </span>
              </div>
              {h.isRecurring && (
                <span className="badge-active">{t('holidays.recurring')}</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove.mutate({ id: h.id })}
                disabled={remove.isPending}
              >
                {t('common.delete')}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

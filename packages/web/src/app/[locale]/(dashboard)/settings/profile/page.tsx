'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  formatCurrency,
  formatDate,
  type AppLocale,
  type NumeralSystem as SharedNumeralSystem,
} from 'shared-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMyProfile, useUpdateProfile } from '@/lib/hooks/use-profile';
import type {
  CalendarDisplay,
  NumeralSystem,
  PreferredLanguage,
} from '@/lib/types/profile';
import { useRouter } from '@/i18n/navigation';

const TIMEZONES = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Qatar',
  'Asia/Bahrain',
  'Asia/Muscat',
  'Africa/Cairo',
  'UTC',
];

export default function ProfileSettingsPage() {
  const locale = useLocale();
  const t = useTranslations();
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();
  const router = useRouter();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    preferredLanguage: 'ar' as PreferredLanguage,
    calendarDisplay: 'BOTH' as CalendarDisplay,
    numeralSystem: 'LATIN' as NumeralSystem,
    timezone: 'Asia/Riyadh',
    notificationQuietHoursStart: 22,
    notificationQuietHoursEnd: 7,
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      phone: profile.phone ?? '',
      preferredLanguage: profile.preferredLanguage,
      calendarDisplay: profile.calendarDisplay,
      numeralSystem: profile.numeralSystem,
      timezone: profile.timezone,
      notificationQuietHoursStart: profile.notificationQuietHoursStart ?? 22,
      notificationQuietHoursEnd: profile.notificationQuietHoursEnd ?? 7,
    });
  }, [profile]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const next = await updateProfile.mutateAsync(form);
      toast.success(t('profile.saveSuccess'));
      if (next.preferredLanguage !== locale) {
        router.refresh();
      }
    } catch {
      toast.error(t('profile.saveFailed'));
    }
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const previewLocale: AppLocale = form.preferredLanguage;
  const previewNumerals: SharedNumeralSystem =
    form.numeralSystem === 'ARABIC_INDIC' ? 'arabic-indic' : 'latin';
  const previewCalendar =
    form.calendarDisplay === 'GREGORIAN'
      ? 'gregorian'
      : form.calendarDisplay === 'HIJRI'
        ? 'hijri'
        : 'both';
  const today = formatDate(new Date(), {
    locale: previewLocale,
    calendar: previewCalendar,
    numerals: previewNumerals,
  });
  const sampleAmount = formatCurrency(125000, {
    locale: previewLocale,
    numerals: previewNumerals,
  });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-abak-blue">
          {t('profile.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('profile.subtitle')}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('profile.personalHeading')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Field label={t('profile.firstName')}>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                className="input-base"
              />
            </Field>
            <Field label={t('profile.lastName')}>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                className="input-base"
              />
            </Field>
            <Field label={t('profile.phone')}>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                className="input-base"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('profile.localizationHeading')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label={t('profile.language')}>
              <select
                value={form.preferredLanguage}
                onChange={(e) =>
                  set('preferredLanguage', e.target.value as PreferredLanguage)
                }
                className="input-base"
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </Field>
            <Field label={t('profile.calendar')}>
              <select
                value={form.calendarDisplay}
                onChange={(e) =>
                  set('calendarDisplay', e.target.value as CalendarDisplay)
                }
                className="input-base"
              >
                <option value="GREGORIAN">
                  {t('profile.calendarGregorian')}
                </option>
                <option value="HIJRI">{t('profile.calendarHijri')}</option>
                <option value="BOTH">{t('profile.calendarBoth')}</option>
              </select>
            </Field>
            <Field label={t('profile.numerals')}>
              <select
                value={form.numeralSystem}
                onChange={(e) =>
                  set('numeralSystem', e.target.value as NumeralSystem)
                }
                className="input-base"
              >
                <option value="LATIN">{t('profile.numeralsLatin')}</option>
                <option value="ARABIC_INDIC">
                  {t('profile.numeralsArabicIndic')}
                </option>
              </select>
            </Field>
            <Field label={t('profile.timezone')}>
              <select
                value={form.timezone}
                onChange={(e) => set('timezone', e.target.value)}
                className="input-base"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </Field>
            <div className="md:col-span-2">
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {t('profile.todayPreview')}
                  </span>
                  <span className="font-medium">{today}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {t('profile.sampleAmount')}
                  </span>
                  <span className="font-medium">{sampleAmount}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('profile.notificationsHeading')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label={t('profile.quietHoursStart')}>
              <input
                type="number"
                min={0}
                max={23}
                value={form.notificationQuietHoursStart}
                onChange={(e) =>
                  set(
                    'notificationQuietHoursStart',
                    Number(e.target.value) || 0,
                  )
                }
                className="input-base"
              />
            </Field>
            <Field label={t('profile.quietHoursEnd')}>
              <input
                type="number"
                min={0}
                max={23}
                value={form.notificationQuietHoursEnd}
                onChange={(e) =>
                  set('notificationQuietHoursEnd', Number(e.target.value) || 0)
                }
                className="input-base"
              />
            </Field>
            <p className="md:col-span-2 text-xs text-muted-foreground">
              {t('profile.quietHoursHelper')}
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-dark-text">{label}</span>
      {children}
    </label>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useResetSetting,
  useSettings,
  useUpdateSetting,
} from '@/lib/hooks/use-settings';
import type { SystemSetting } from '@/lib/types/settings';

const CATEGORY_ORDER = [
  'sla',
  'pipeline',
  'crm',
  'approval',
  'commission',
  'finance',
  'localization',
  'notifications',
  'assignment',
  'other',
] as const;

export default function AdminSettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const t = useTranslations();
  const locale = useLocale();

  const grouped = useMemo(() => {
    const map: Record<string, SystemSetting[]> = {};
    (settings ?? []).forEach((s) => {
      const key = s.category ?? 'other';
      (map[key] ||= []).push(s);
    });
    return map;
  }, [settings]);

  const categories = CATEGORY_ORDER.filter((c) => grouped[c]?.length);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-abak-blue">
          {t('adminSettings.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('adminSettings.subtitle')}
        </p>
      </div>
      {categories.map((cat) => (
        <Card key={cat}>
          <CardHeader>
            <CardTitle className="text-base">
              {t(`adminSettings.category.${cat}`)}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {grouped[cat].map((s) => (
              <SettingRow key={s.key} setting={s} locale={locale} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SettingRow({
  setting,
  locale,
}: {
  setting: SystemSetting;
  locale: string;
}) {
  const t = useTranslations();
  const update = useUpdateSetting();
  const reset = useResetSetting();
  const [draft, setDraft] = useState(setting.value);

  const label =
    locale === 'ar'
      ? (setting.labelAr ?? setting.key)
      : (setting.labelEn ?? setting.key);
  const description =
    locale === 'ar' ? setting.descriptionAr : setting.descriptionEn;

  const dirty = draft !== setting.value;

  async function save() {
    try {
      await update.mutateAsync({ key: setting.key, value: draft });
      toast.success(t('adminSettings.saveSuccess'));
    } catch {
      toast.error(t('adminSettings.saveFailed'));
    }
  }

  async function onReset() {
    try {
      const next = await reset.mutateAsync({ key: setting.key });
      setDraft(next.value);
      toast.success(t('adminSettings.saveSuccess'));
    } catch {
      toast.error(t('adminSettings.saveFailed'));
    }
  }

  return (
    <div className="py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-dark-text">{label}</div>
          <div className="font-mono text-xs text-muted-foreground">
            {setting.key}
          </div>
          {description && (
            <div className="mt-1 text-xs text-muted-foreground">
              {description}
            </div>
          )}
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {setting.defaultValue != null && (
              <span className="rounded border px-1.5 py-0.5">
                {t('adminSettings.default')}: {setting.defaultValue}
              </span>
            )}
            {setting.minValue != null && (
              <span className="rounded border px-1.5 py-0.5">
                {t('adminSettings.min')}: {setting.minValue}
              </span>
            )}
            {setting.maxValue != null && (
              <span className="rounded border px-1.5 py-0.5">
                {t('adminSettings.max')}: {setting.maxValue}
              </span>
            )}
            {setting.editableByRoles.length > 0 && (
              <span className="rounded border px-1.5 py-0.5">
                {t('adminSettings.editable')}:{' '}
                {setting.editableByRoles.join(', ')}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ValueEditor setting={setting} value={draft} onChange={setDraft} />
          <Button
            size="sm"
            onClick={save}
            disabled={!dirty || update.isPending}
          >
            {t('common.save')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReset}
            disabled={reset.isPending || setting.defaultValue == null}
          >
            {t('adminSettings.resetToDefault')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ValueEditor({
  setting,
  value,
  onChange,
}: {
  setting: SystemSetting;
  value: string;
  onChange: (v: string) => void;
}) {
  if (setting.type === 'BOOLEAN') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-base w-28"
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (setting.type === 'NUMBER') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={setting.minValue ?? undefined}
        max={setting.maxValue ?? undefined}
        className="input-base w-32"
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-base w-48"
    />
  );
}

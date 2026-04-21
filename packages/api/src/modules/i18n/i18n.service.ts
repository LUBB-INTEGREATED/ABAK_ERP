import { Injectable } from '@nestjs/common';
import { ar } from './catalogs/ar';
import { en } from './catalogs/en';

export type AppLocale = 'ar' | 'en' | 'ar-SA';

const catalogs = {
  ar,
  'ar-SA': ar,
  en,
} as const;

function normalize(locale: string | undefined | null): 'ar' | 'en' {
  if (!locale) return 'ar';
  const lower = locale.toLowerCase();
  if (lower.startsWith('ar')) return 'ar';
  return 'en';
}

function resolve(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catalog: any,
  key: string,
): string | undefined {
  const parts = key.split('.');
  let node = catalog;
  for (const part of parts) {
    if (node == null) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    params[name] != null ? String(params[name]) : `{${name}}`,
  );
}

@Injectable()
export class I18nService {
  translate(
    key: string,
    locale: string | undefined,
    params?: Record<string, string | number>,
  ): string {
    const normalized = normalize(locale);
    const raw = resolve(catalogs[normalized], key);
    if (raw) return interpolate(raw, params);
    const fallback = normalized === 'ar' ? resolve(en, key) : undefined;
    return fallback ? interpolate(fallback, params) : key;
  }

  t(
    key: string,
    locale: string | undefined,
    params?: Record<string, string | number>,
  ): string {
    return this.translate(key, locale, params);
  }
}

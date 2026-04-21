'use client';

import { useTransition } from 'react';
import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { routing } from '@/i18n/routing';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({
  variant = 'inline',
  className,
}: {
  variant?: 'inline' | 'sidebar';
  className?: string;
}) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const t = useTranslations();

  function switchTo(nextLocale: (typeof routing.locales)[number]) {
    if (nextLocale === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  if (variant === 'sidebar') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg bg-white/5 p-1 text-xs',
          className,
        )}
      >
        {routing.locales.map((loc) => (
          <button
            key={loc}
            type="button"
            onClick={() => switchTo(loc)}
            disabled={pending}
            className={cn(
              'flex-1 rounded-md px-2 py-1 transition-colors disabled:opacity-50',
              loc === locale
                ? 'bg-white/20 font-semibold'
                : 'text-white/70 hover:bg-white/10',
            )}
          >
            {loc === 'ar' ? 'العربية' : 'English'}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center gap-1 rounded-md border p-1', className)}
      aria-label={t('common.language')}
    >
      <Languages className="h-4 w-4 shrink-0 text-muted-foreground" />
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => switchTo(loc)}
          disabled={pending}
          className={cn(
            'rounded px-2 py-0.5 text-xs transition-colors disabled:opacity-50',
            loc === locale
              ? 'bg-abak-blue text-white'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {loc === 'ar' ? 'العربية' : 'English'}
        </button>
      ))}
    </div>
  );
}

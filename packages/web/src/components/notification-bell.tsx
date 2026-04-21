'use client';

import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '@/lib/hooks/use-notifications';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const t = useTranslations();
  const { data: count = 0 } = useUnreadCount();
  const { data: notifications } = useNotifications(false, 10);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t('notifications.bell')}
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t('notifications.title')}</span>
          {count > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="text-[11px] text-abak-blue hover:underline"
            >
              {t('notifications.markAllRead')}
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {!notifications || notifications.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            {t('notifications.empty')}
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                asChild
                className="cursor-pointer flex-col items-stretch gap-1 p-3"
                onClick={() => {
                  if (!n.readAt) markRead.mutate({ id: n.id });
                }}
              >
                <Link href={n.deepLink ?? '/notifications'}>
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        'text-xs font-medium',
                        !n.readAt && 'text-abak-blue',
                      )}
                    >
                      {n.subject}
                    </span>
                    {!n.readAt && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground line-clamp-2">
                    {n.body}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {n.createdAt.slice(0, 16).replace('T', ' ')}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="justify-center text-xs">
          <Link href="/notifications">{t('notifications.viewAll')}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

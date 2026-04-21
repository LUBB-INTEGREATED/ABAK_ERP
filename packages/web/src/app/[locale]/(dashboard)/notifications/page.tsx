'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '@/lib/hooks/use-notifications';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const t = useTranslations();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data: notifications, isLoading } = useNotifications(unreadOnly, 100);
  const { data: count = 0 } = useUnreadCount();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-abak-blue">
            {t('notifications.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('notifications.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={unreadOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUnreadOnly(!unreadOnly)}
          >
            {unreadOnly
              ? `${t('notifications.unread')} · ${count}`
              : t('notifications.all')}
          </Button>
          {count > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAll.mutate()}
            >
              <Check className="me-2 h-4 w-4" />
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-muted-foreground" />
            {t('notifications.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t('notifications.empty')}
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.deepLink ?? '#'}
                    onClick={() => {
                      if (!n.readAt) markRead.mutate({ id: n.id });
                    }}
                    className={cn(
                      'block py-3 transition-colors hover:bg-muted/40',
                      !n.readAt && 'bg-abak-blue/5',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            'flex items-center gap-2 text-sm',
                            !n.readAt
                              ? 'font-semibold text-abak-blue'
                              : 'text-dark-text',
                          )}
                        >
                          {!n.readAt && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                          )}
                          {n.subject}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {n.body}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-[10px] text-muted-foreground">
                          {n.createdAt.slice(0, 16).replace('T', ' ')}
                        </span>
                        <div className="mt-0.5">
                          <span className="rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {n.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

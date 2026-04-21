'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setVisible(false));

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  if (!visible || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      setVisible(false);
      setDeferred(null);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
      <span className="text-sm">Install ABAK ERP for faster access</span>
      <Button size="sm" onClick={install}>
        Install
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setVisible(false)}>
        Dismiss
      </Button>
    </div>
  );
}

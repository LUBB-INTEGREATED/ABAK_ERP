'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker registration failed:', error);
      });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);

  return null;
}

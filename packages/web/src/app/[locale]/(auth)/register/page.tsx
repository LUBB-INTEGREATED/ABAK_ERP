'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/auth';
import { Link, useRouter } from '@/i18n/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const t = useTranslations();

  function field<K extends keyof typeof form>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        phone: form.phone || undefined,
      });
      router.replace('/dashboard');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('auth.registerFailed');
      setError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card-abak">
      <h1 className="mb-2 text-2xl font-bold text-abak-blue">
        {t('auth.registerTitle')}
      </h1>
      <p className="mb-6 text-muted-foreground">{t('auth.registerSubtitle')}</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="firstName"
              className="mb-1 block text-sm font-medium text-dark-text"
            >
              {t('auth.firstNameLabel')}
            </label>
            <input
              id="firstName"
              type="text"
              value={form.firstName}
              onChange={field('firstName')}
              className="w-full rounded-md border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-abak-blue"
            />
          </div>
          <div>
            <label
              htmlFor="lastName"
              className="mb-1 block text-sm font-medium text-dark-text"
            >
              {t('auth.lastNameLabel')}
            </label>
            <input
              id="lastName"
              type="text"
              value={form.lastName}
              onChange={field('lastName')}
              className="w-full rounded-md border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-abak-blue"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-dark-text"
          >
            {t('auth.emailLabel')}
          </label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={field('email')}
            className="w-full rounded-md border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-abak-blue"
          />
        </div>
        <div>
          <label
            htmlFor="phone"
            className="mb-1 block text-sm font-medium text-dark-text"
          >
            {t('auth.phoneLabel')}
          </label>
          <input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={field('phone')}
            className="w-full rounded-md border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-abak-blue"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-dark-text"
          >
            {t('auth.passwordLabel')}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={field('password')}
            className="w-full rounded-md border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-abak-blue"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading ? t('auth.submittingRegister') : t('auth.submitRegister')}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.alreadyHaveAccount')}{' '}
        <Link
          href="/login"
          className="font-medium text-abak-blue hover:underline"
        >
          {t('auth.signInLink')}
        </Link>
      </p>
    </div>
  );
}

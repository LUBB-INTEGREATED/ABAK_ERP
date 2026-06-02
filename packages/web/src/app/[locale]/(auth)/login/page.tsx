'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/auth';
import { Link, useRouter } from '@/i18n/navigation';

const DEMO_ACCOUNTS = [
  {
    role: 'CEO / Super Admin',
    name: 'عبدالله محسن',
    email: 'abdullah.mohsen@abak.com.sa',
    emoji: '👑',
    bgColor:
      'bg-amber-50 hover:bg-amber-100/80 text-amber-900 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/50',
  },
  {
    role: 'Sales Representative',
    name: 'غادة العتيبي',
    email: 'ghadah@abak.com.sa',
    emoji: '💼',
    bgColor:
      'bg-sky-50 hover:bg-sky-100/80 text-sky-900 border-sky-200 dark:bg-sky-950/20 dark:text-sky-300 dark:border-sky-900/50',
  },
  {
    role: 'Sales Manager',
    name: 'هيثم محمدي',
    email: 'haitham@abak.com.sa',
    emoji: '📊',
    bgColor:
      'bg-indigo-50 hover:bg-indigo-100/80 text-indigo-900 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-300 dark:border-indigo-900/50',
  },
  {
    role: 'Department Manager',
    name: 'حسن صلاح',
    email: 'hassan@abak.com.sa',
    emoji: '🏢',
    bgColor:
      'bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/50',
  },
  {
    role: 'Architectural Pricer',
    name: 'عبد الغني الموفق',
    email: 'abdulghani.almuwafiq@abak.com.sa',
    emoji: '📐',
    bgColor:
      'bg-purple-50 hover:bg-purple-100/80 text-purple-900 border-purple-200 dark:bg-purple-950/20 dark:text-purple-300 dark:border-purple-900/50',
  },
  {
    role: 'Surveying Pricer',
    name: 'علاء احمد',
    email: 'alaa.ahmed@abak.com.sa',
    emoji: '🛰️',
    bgColor:
      'bg-cyan-50 hover:bg-cyan-100/80 text-cyan-900 border-cyan-200 dark:bg-cyan-950/20 dark:text-cyan-300 dark:border-cyan-900/50',
  },
  {
    role: 'Safety Pricer',
    name: 'عمر ربابعة',
    email: 'omar@abak.com.sa',
    emoji: '🛡️',
    bgColor:
      'bg-teal-50 hover:bg-teal-100/80 text-teal-900 border-teal-200 dark:bg-teal-950/20 dark:text-teal-300 dark:border-teal-900/50',
  },
  {
    role: 'Finance Officer',
    name: 'أحمد العبيري',
    email: 'accounting@abak.com.sa',
    emoji: '💰',
    bgColor:
      'bg-rose-50 hover:bg-rose-100/80 text-rose-900 border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/50',
  },
  {
    role: 'Executive Viewer',
    name: 'صالح الشهري',
    email: 'salshehri@abak.com.sa',
    emoji: '👁️',
    bgColor:
      'bg-slate-50 hover:bg-slate-100/80 text-slate-900 border-slate-200 dark:bg-slate-950/20 dark:text-slate-300 dark:border-slate-900/50',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('admin@abak.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const t = useTranslations();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('auth.loginFailed');
      setError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  }

  const handleDemoClick = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setHighlight(true);
    setTimeout(() => setHighlight(false), 800);
  };

  return (
    <div className="card-abak">
      <h1 className="mb-2 text-2xl font-bold text-abak-blue">
        {t('auth.loginTitle')}
      </h1>
      <p className="mb-6 text-muted-foreground">{t('auth.loginSubtitle')}</p>

      <form onSubmit={onSubmit} className="space-y-4">
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
            className={`w-full rounded-md border px-3 py-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-abak-blue ${
              highlight
                ? 'border-abak-blue ring-2 ring-abak-blue bg-abak-blue/5 scale-[1.01]'
                : 'border-border'
            }`}
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.passwordPlaceholder')}
            className={`w-full rounded-md border px-3 py-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-abak-blue ${
              highlight
                ? 'border-abak-blue ring-2 ring-abak-blue bg-abak-blue/5 scale-[1.01]'
                : 'border-border'
            }`}
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
          className={`btn-primary w-full disabled:opacity-50 transition-all duration-300 ${
            highlight
              ? 'scale-[1.02] shadow-md shadow-primary/20 brightness-110'
              : ''
          }`}
        >
          {loading ? t('auth.submittingLogin') : t('auth.submitLogin')}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.noAccount')}{' '}
        <Link
          href="/register"
          className="font-medium text-abak-blue hover:underline"
        >
          {t('auth.registerLink')}
        </Link>
      </p>

      {/* Quick Demo Sandboxes */}
      <div className="mt-8 border-t border-border/60 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            ⚡ Quick Test Sandbox Logins
          </h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
            Password: Password123!
          </span>
        </div>

        <div className="max-h-[220px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-border">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => handleDemoClick(acc.email)}
              className={`w-full flex items-center justify-between p-2 rounded-lg border text-left text-xs transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 ${acc.bgColor}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{acc.emoji}</span>
                <div>
                  <span className="font-semibold block">{acc.name}</span>
                  <span className="text-[10px] opacity-80 block font-mono">
                    {acc.email}
                  </span>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/40 dark:bg-black/20 font-bold border border-white/20 whitespace-nowrap">
                {acc.role}
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t('auth.devCredentials')}
      </p>
    </div>
  );
}

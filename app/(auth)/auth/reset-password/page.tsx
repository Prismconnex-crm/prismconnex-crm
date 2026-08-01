import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function ResetPasswordPage() {
  const t = useTranslations('auth.resetPassword');

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('title')}
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('description')}</p>
        <div className="mt-6">
          <Link href="/auth/sign-in" className="font-semibold text-blue-600 hover:text-blue-500">
            {t('actions.return')}
          </Link>
        </div>
      </div>
    </div>
  );
}

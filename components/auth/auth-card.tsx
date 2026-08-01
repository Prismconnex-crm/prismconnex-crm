import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Shared shell for the sign-in / sign-up screens.
 *
 * The `(auth)` route group has no layout of its own, so each page previously
 * repeated its own full-screen wrapper. This centralises the dark surface,
 * the centred card and the Prismconnex wordmark.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0E1A] px-4 py-8 sm:px-6">
      <div className="absolute left-[10%] top-[12%] h-72 w-72 rounded-full bg-indigo-600/10 blur-[120px]" />
      <div className="absolute bottom-[15%] right-[8%] h-80 w-80 rounded-full bg-purple-600/10 blur-[140px]" />

      <div className="relative z-10 w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center">
          <span className="text-[26px] font-bold tracking-tight text-white">
            Prism
            <span className="bg-gradient-to-r from-indigo-500 to-cyan-500 bg-clip-text font-extrabold text-transparent">
              connex
            </span>
          </span>
        </Link>

        <div className="rounded-2xl border border-[#22304A] bg-[#111B2E] p-6 shadow-2xl sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-[22px] font-bold tracking-tight text-white sm:text-2xl">{title}</h1>
            {subtitle ? <p className="mt-1.5 text-[13px] text-slate-400">{subtitle}</p> : null}
          </div>

          {children}
        </div>

        {footer ? <div className="mt-6 text-center text-[13px] text-slate-400">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Red banner used for request-level (non-field) errors. */
export function AuthErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-[13px] text-red-400"
    >
      {message}
    </div>
  );
}

/**
 * Green banner for confirmations such as "You have been signed out".
 *
 * The project has no toast system (@radix-ui/react-toast is a dependency but
 * nothing mounts a Toaster), so confirmations reuse the banner pattern already
 * established by AuthErrorBanner. role="status" rather than "alert" so screen
 * readers announce it politely instead of interrupting.
 */
export function AuthSuccessBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="mb-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-[13px] text-emerald-400"
    >
      {message}
    </div>
  );
}

/** "or continue with" rule between the credential form and the social buttons. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-[#22304A]" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-[#111B2E] px-3 text-[11px] uppercase tracking-wide text-slate-500">
          {label}
        </span>
      </div>
    </div>
  );
}

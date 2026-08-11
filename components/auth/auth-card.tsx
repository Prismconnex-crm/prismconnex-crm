/**
 * Presentational pieces shared by the auth forms.
 *
 * This file used to also export `AuthCard`, the single-column shell both auth
 * pages wrapped themselves in. That shell was replaced by the two-column
 * `AuthShell` (`components/auth/auth-shell.tsx`), which is now the only
 * wrapper for `/auth/sign-in` and `/auth/sign-up`; the banners and the divider
 * below survive unchanged because the forms still use them.
 */

/**
 * The primary auth action — Sign In and Create Account.
 *
 * Both buttons previously carried a byte-identical class string, duplicated
 * across two files, which is how the page ended up with an accent that had to
 * be changed in more than one place. It is defined once here instead.
 *
 * Every colour resolves through the `brand` token (`--brand` in
 * app/globals.css, #005C9D), which is the same value the Login / Sign Up tabs
 * and the light-mode logo use — that shared token is what makes the three read
 * as one design system rather than three near-identical blues.
 *
 * The token is theme-invariant, so the fill needs no `dark:` variant; only the
 * focus-ring offset does, because that tracks the page background behind it
 * (#FFFFFF light, #0A0E1A dark).
 */
export const AUTH_PRIMARY_BUTTON_CLASSES =
  'flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 dark:focus:ring-offset-[#0A0E1A]';

/** Red banner used for request-level (non-field) errors. */
export function AuthErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
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
      className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
    >
      {message}
    </div>
  );
}

/**
 * "or continue with" rule between the credential form and the social buttons.
 *
 * The label sits on an opaque swatch punched out of the rule, so its
 * background has to match the surface behind it — the AuthShell form column,
 * which is `#FFFFFF` in light and `#0A0E1A` in dark (it was `#111B2E` while the
 * form lived inside a card). Both must be listed: a swatch pinned to one theme
 * would show as a solid block across the rule in the other.
 */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-slate-200 dark:border-[#22304A]" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-3 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-[#0A0E1A] dark:text-slate-500">
          {label}
        </span>
      </div>
    </div>
  );
}

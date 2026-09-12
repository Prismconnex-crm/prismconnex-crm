import { localizePathname } from "@/lib/locale";
import type { Locale } from "@/types";

export const FORCE_SIGN_IN_QUERY_PARAM = "forceSignIn";
export const FORCE_SIGN_IN_QUERY_VALUE = "1";
export const TRADE_SHOW_TICKET_SIGN_IN_HREF = `/auth/sign-in?${FORCE_SIGN_IN_QUERY_PARAM}=${FORCE_SIGN_IN_QUERY_VALUE}`;

/**
 * Marks a sign-in visit that follows a REJECTED session cookie, as opposed to
 * the trade show ticket CTA above, which forces the form for a user whose
 * session is perfectly valid.
 *
 * The two need separate flags because escaping the loop described below also
 * means clearing the dead cookie, and clearing it on every `forceSignIn=1`
 * visit would sign out the ticket buyer who only wanted to switch accounts.
 */
export const SESSION_EXPIRED_QUERY_PARAM = "sessionExpired";
export const SESSION_EXPIRED_QUERY_VALUE = "1";
export const EXPIRED_SESSION_SIGN_IN_HREF = `/auth/sign-in?${SESSION_EXPIRED_QUERY_PARAM}=${SESSION_EXPIRED_QUERY_VALUE}`;

export function hasExpiredSessionFlag(searchParams: URLSearchParams) {
  return searchParams.get(SESSION_EXPIRED_QUERY_PARAM) === SESSION_EXPIRED_QUERY_VALUE;
}

export function shouldForceSignIn(searchParams: URLSearchParams) {
  return (
    searchParams.get(FORCE_SIGN_IN_QUERY_PARAM) === FORCE_SIGN_IN_QUERY_VALUE ||
    hasExpiredSessionFlag(searchParams)
  );
}

/**
 * `session` is cookie PRESENCE, not validity — this runs in middleware, which
 * never verifies the JWT. The server guards under /app and /onboarding do
 * verify it, so a stale cookie means the two disagree: this function sends
 * /auth/sign-in to the dashboard, and the guard sends the dashboard straight
 * back, which is an infinite redirect (ERR_TOO_MANY_REDIRECTS) that locks the
 * user out with no way back to the form.
 *
 * The guards therefore redirect to EXPIRED_SESSION_SIGN_IN_HREF rather than to
 * a bare /auth/sign-in, which makes `forceSignIn` true here and lets the form
 * render; middleware then expires the cookie so the next visit is clean.
 */
export function resolveAuthRedirect({
  pathnameWithoutLocale,
  locale,
  session,
  onboarded,
  forceSignIn,
}: {
  pathnameWithoutLocale: string;
  locale: Locale;
  session: boolean;
  onboarded: boolean;
  forceSignIn: boolean;
}) {
  const isAppRoute = pathnameWithoutLocale.startsWith("/app");
  const isOnboarding = pathnameWithoutLocale.startsWith("/onboarding");
  const isSignIn = pathnameWithoutLocale.startsWith("/auth/sign-in");

  if ((isAppRoute || isOnboarding) && !session) {
    return "/auth/sign-in";
  }

  // ── ONBOARDING DISABLED ──────────────────────────────────────────────
  // Signed-in users go straight to the dashboard; the onboarding flow is
  // parked, not removed (page + components are still in the repo).
  // TO RE-ENABLE: delete the redirect below and uncomment the block after it.
  // App routes are not locale-prefixed, so return the plain path here
  // (matching the isSignIn rule below) — localizing it 404s.
  if (session && isOnboarding) {
    return "/app/dashboard";
  }

  // if (session && !onboarded && isAppRoute) {
  //   return localizePathname("/onboarding", locale);
  // }
  // ─────────────────────────────────────────────────────────────────────

  if (session && isSignIn && !forceSignIn) {
    return "/app/dashboard";
  }

  return null;
}

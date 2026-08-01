import { localizePathname } from "@/lib/locale";
import type { Locale } from "@/types";

export const FORCE_SIGN_IN_QUERY_PARAM = "forceSignIn";
export const FORCE_SIGN_IN_QUERY_VALUE = "1";
export const TRADE_SHOW_TICKET_SIGN_IN_HREF = `/auth/sign-in?${FORCE_SIGN_IN_QUERY_PARAM}=${FORCE_SIGN_IN_QUERY_VALUE}`;

export function shouldForceSignIn(searchParams: URLSearchParams) {
  return searchParams.get(FORCE_SIGN_IN_QUERY_PARAM) === FORCE_SIGN_IN_QUERY_VALUE;
}

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

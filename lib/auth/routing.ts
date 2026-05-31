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

  if (session && !onboarded && isAppRoute) {
    return localizePathname("/onboarding", locale);
  }

  if (session && isSignIn && !forceSignIn) {
    return "/app/dashboard";
  }

  return null;
}

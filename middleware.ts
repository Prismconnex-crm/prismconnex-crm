import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  defaultLocale,
  getLocaleFromPathname,
  getPathLocaleSegment,
  isLocalizedRoute,
  localizePathname,
  normalizeLocale,
  stripLocaleFromPathname,
} from "@/lib/locale";
import { resolveAuthRedirect, shouldForceSignIn } from "@/lib/auth/routing";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const localeSegment = getPathLocaleSegment(pathname);
  const localeFromPath = getLocaleFromPathname(pathname);
  const locale =
    localeFromPath ??
    normalizeLocale(request.cookies.get("pc_locale")?.value) ??
    normalizeLocale(request.cookies.get("pcx_locale")?.value) ??
    defaultLocale;
  const pathnameWithoutLocale = stripLocaleFromPathname(pathname);
  const session = request.cookies.get("pcx_session")?.value;
  const onboarded = request.cookies.get("pcx_onboarded")?.value === "true";
  const forceSignIn = shouldForceSignIn(request.nextUrl.searchParams);

  if (localeFromPath && localeSegment !== localeFromPath && isLocalizedRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = localizePathname(pathnameWithoutLocale, localeFromPath);

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set("pc_locale", localeFromPath, { path: "/", maxAge: 60 * 60 * 24 * 180 });
    response.cookies.set("pcx_locale", localeFromPath, { path: "/", maxAge: 60 * 60 * 24 * 180 });
    return response;
  }

  if (!localeFromPath && isLocalizedRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = localizePathname(pathname, locale);

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set("pc_locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 180 });
    response.cookies.set("pcx_locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 180 });
    return response;
  }

  const redirectPath = resolveAuthRedirect({
    pathnameWithoutLocale,
    locale,
    session: Boolean(session),
    onboarded,
    forceSignIn,
  });

  if (redirectPath) {
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pcx-locale", locale);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.cookies.set("pc_locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 180 });
  response.cookies.set("pcx_locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 180 });

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

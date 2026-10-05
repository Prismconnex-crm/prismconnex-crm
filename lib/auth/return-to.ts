/**
 * Where to send a visitor after sign-in, when a page asked them to sign in first (an exhibitor's details,
 * say): `/auth/sign-in?returnTo=/en-US/find-shows/<event>?exhibitor=…`.
 *
 * Only a path on this site is ever followed — never another origin, a protocol-relative `//host`, a
 * backslash trick or a control character — so the parameter cannot be turned into an open redirect. The
 * auth pages themselves are refused too, so a return can never loop back into the form. Anything else
 * falls back to the usual destination.
 */
import { FORCE_SIGN_IN_QUERY_PARAM, FORCE_SIGN_IN_QUERY_VALUE } from '@/lib/auth/routing';

export const RETURN_TO_QUERY_PARAM = 'returnTo';
/** Holds a validated return path across the OAuth provider round-trip (httpOnly, 10 minutes). */
export const RETURN_TO_COOKIE = 'pcx_return_to';

// Built from a string so the literal holds no control characters itself.
const CONTROL_CHARACTERS = new RegExp('[\\u0000-\\u001f\\u007f]');

export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || value.length > 2000) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || CONTROL_CHARACTERS.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value, 'https://prismconnex.invalid');
  } catch {
    return null;
  }
  // Resolution must not have left the site (e.g. "/\t/evil.example" style tricks normalised away above).
  if (url.origin !== 'https://prismconnex.invalid') return null;
  if (/^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(?:auth|api)(?:\/|$)/.test(url.pathname)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The existing sign-in page, asked to return here afterwards. `forceSignIn` keeps the form showing for a visitor whose cookie the server already rejected. */
export function signInHrefReturningTo(returnTo: string) {
  const safe = safeReturnTo(returnTo);
  const params = new URLSearchParams({ [FORCE_SIGN_IN_QUERY_PARAM]: FORCE_SIGN_IN_QUERY_VALUE });
  if (safe) params.set(RETURN_TO_QUERY_PARAM, safe);
  return `/auth/sign-in?${params.toString()}`;
}

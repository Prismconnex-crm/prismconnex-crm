/**
 * Email-domain extraction for sign-up company detection.
 *
 * Pure and dependency-free so it can run in the browser (the sign-up form calls
 * it before deciding whether a lookup is worth a request) and on the server
 * (the by-domain route re-validates rather than trusting the query string).
 */

/**
 * One host label: alphanumeric, inner hyphens allowed, no leading/trailing
 * hyphen. Repeated with a dot separator, so at least one dot is required —
 * "localhost" is not a company domain.
 */
const HOST_LABEL = "[a-z0-9](?:[a-z0-9-]*[a-z0-9])?";
const DOMAIN_PATTERN = new RegExp(`^${HOST_LABEL}(?:\\.${HOST_LABEL})+$`);

/**
 * Mailbox providers where the domain describes the mailbox, not an employer.
 * Without this, john@gmail.com would be offered "Gmail"/"Google" as his
 * company. Kept deliberately short — these are the providers that actually
 * show up in this project's Indian and international signups; an unknown
 * provider simply produces a lookup that misses, which is a no-op.
 */
const FREE_EMAIL_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "ymail.com",
  "outlook.com",
  "outlook.in",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "zoho.com",
  "zohomail.com",
  "mail.com",
  "gmx.com",
  "gmx.de",
  "rediffmail.com",
  "rediff.com",
  "yandex.com",
  "yandex.ru",
  "fastmail.com",
  "tutanota.com",
  "hushmail.com",
]);

/**
 * Returns the lowercased domain of an email address, or null when the input
 * is not far enough along to have one.
 *
 * Split on the LAST "@" — RFC 5321 allows a quoted local part containing "@",
 * and splitting on the first would yield a broken host.
 */
export function extractEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");

  // No "@", nothing before it (no local part), or nothing after it.
  if (at <= 0 || at === trimmed.length - 1) {
    return null;
  }

  // A fully qualified name may carry a trailing root dot; "google.com." and
  // "google.com" are the same host.
  const domain = trimmed.slice(at + 1).replace(/\.$/, "");

  return DOMAIN_PATTERN.test(domain) ? domain : null;
}

/** True when the domain belongs to a personal mailbox provider. */
export function isFreeEmailProvider(domain: string): boolean {
  return FREE_EMAIL_PROVIDERS.has(domain.trim().toLowerCase());
}

/**
 * The domain worth looking a company up by, or null.
 *
 * This is the single entry point the sign-up form uses: it folds "is this a
 * usable domain" and "would this domain be misleading" into one answer, so a
 * null result always means "do not look anything up".
 */
export function companyDomainFromEmail(email: string): string | null {
  const domain = extractEmailDomain(email);
  if (!domain || isFreeEmailProvider(domain)) {
    return null;
  }
  return domain;
}

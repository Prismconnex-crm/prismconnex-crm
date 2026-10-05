/**
 * Whether an official exhibitor page (a profile, a directory, a platform's sign-in) may be shown inside a
 * Prismconnex frame, read from what the official site itself says: its X-Frame-Options and its CSP
 * frame-ancestors, and whether it answers with a sign-in. Nothing is bypassed — a page that refuses to be
 * framed is not framed; Prismconnex says so in-app instead of sending the visitor away.
 *
 *  - `allowed`: the site sets no framing restriction that excludes Prismconnex.
 *  - `blocked`: it forbids framing (or keeps the page behind its own sign-in); `reason` says which.
 *  - `unknown`: it could not be checked (bot protection, refusal, server error, timeout). That is not a refusal:
 *    the viewer tries the original address in its frame and the browser decides, with the address to copy
 *    beside it in case the site does refuse (components/find-shows/official-page-view.tsx). `reason` says why.
 */
export type FrameVerdict = { frame: 'allowed' | 'blocked' | 'unknown'; reason: string | null };

/**
 * How the official-page viewer shows a verdict: `frame` a confirmed page, `try-frame` an unconfirmed one (the
 * browser decides; the address stays beside it), `fallback` a confirmed refusal (explained, address to copy).
 */
export function officialViewMode(frame: FrameVerdict['frame']): 'frame' | 'try-frame' | 'fallback' {
  if (frame === 'allowed') return 'frame';
  if (frame === 'unknown') return 'try-frame';
  return 'fallback';
}

/** Why a page could not be checked: Prismconnex then cannot confirm the official site allows framing. */
export const UNCHECKED = {
  botWall: 'The official site answered with bot protection, so Prismconnex could not confirm that it allows its pages to be shown inside other websites.',
  unreachable: 'The official site could not be reached to confirm that it allows its pages to be shown inside other websites.',
};

const LOGIN_PAGE = /\/(?:wp-login\.php|login|log-in|signin|sign-in|sso|auth(?:orize)?|account\/login|users?\/sign_in)(?:[/?.]|$)|[?&](?:redirect_to|returnurl|return_to)=/i;

/** CSP frame-ancestors sources, when the policy states any. */
function frameAncestors(csp: string | undefined) {
  if (!csp) return null;
  for (const directive of csp.split(/[;,]/)) {
    const [name, ...sources] = directive.trim().split(/\s+/);
    if (name?.toLowerCase() === 'frame-ancestors') return sources.map((source) => source.toLowerCase());
  }
  return null;
}

/** Whether a CSP source expression admits the given origin ("https://app.example", "*.example", "https:", "*"). */
function sourceAdmits(source: string, origin: URL) {
  if (source === '*') return true;
  if (source === `${origin.protocol}`) return true;
  const match = source.replace(/^'|'$/g, '').match(/^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.)?([^/:]+)(?::(\d+|\*))?/i);
  if (!match || source.startsWith("'")) return false;
  const [, scheme, wildcard, host, port] = match;
  if (scheme && `${scheme}:` !== origin.protocol) return false;
  if (port && port !== '*' && port !== (origin.port || (origin.protocol === 'https:' ? '443' : '80'))) return false;
  return wildcard ? origin.hostname.endsWith(`.${host}`) : origin.hostname === host;
}

export function frameVerdict(
  answer: { status: number; url: string; headers: Record<string, string>; challenged?: boolean },
  prismconnexOrigin: string
): FrameVerdict {
  if (answer.challenged || answer.status === 202 || answer.status === 429) return { frame: 'unknown', reason: UNCHECKED.botWall };
  if (answer.status === 401 || LOGIN_PAGE.test(answer.url)) {
    return { frame: 'blocked', reason: 'The official site shows this page only to visitors signed in there.' };
  }
  if (answer.status === 403) return { frame: 'unknown', reason: UNCHECKED.botWall };
  if (answer.status === 404 || answer.status === 410) return { frame: 'blocked', reason: 'The official site no longer has this page.' };
  if (answer.status >= 500) return { frame: 'unknown', reason: UNCHECKED.unreachable };

  const origin = new URL(prismconnexOrigin);
  const ancestors = frameAncestors(answer.headers['content-security-policy']);
  // frame-ancestors takes precedence over X-Frame-Options where both are sent.
  if (ancestors) {
    const admitted = ancestors.some((source) => sourceAdmits(source, origin));
    return admitted
      ? { frame: 'allowed', reason: null }
      : { frame: 'blocked', reason: 'The official site does not allow its pages to be shown inside other websites (Content-Security-Policy).' };
  }
  const xfo = (answer.headers['x-frame-options'] ?? '').trim().toLowerCase();
  if (xfo === 'deny' || xfo === 'sameorigin' || xfo.startsWith('allow-from')) {
    return { frame: 'blocked', reason: 'The official site does not allow its pages to be shown inside other websites (X-Frame-Options).' };
  }
  return { frame: 'allowed', reason: null };
}

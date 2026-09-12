import { classify } from '@/lib/assistant/classify';

/**
 * Cross-intent routing between the Companies and Events "Find anything" boxes.
 *
 * A question typed into one page's box often belongs to the other page —
 * "list 100 IT companies in India" asked on Events, "medical events in
 * Hamburg" asked on Companies. Rather than answering it badly in place, the
 * box hands the sentence to the page that owns that data and lets *that* page
 * run its own ask flow: same rail, same chips, same Recent list.
 *
 * The decision is deterministic — it reuses the assistant's signal scorer
 * (lib/assistant/classify), so there is no model call, no API key and no
 * latency between pressing Enter and the page changing. Signal words live once
 * in lib/assistant/signals.ts and already feed the assistant router, so the
 * two cannot drift apart.
 *
 * The bias is deliberately towards staying put: a handoff that guesses wrong
 * is far more disruptive than an in-place answer that is merely broad, because
 * it throws away the filters the user is looking at. So the other domain has
 * to win clearly (MIN_MARGIN) before the page moves.
 */

/** The two pages that participate in cross-routing. People is not migrated. */
export type SearchDomain = 'companies' | 'events';

export type CrossIntentDecision =
  | { kind: 'stay'; reason: 'no-signal' | 'same-domain' | 'too-close' | 'other-entity' }
  | { kind: 'handoff'; target: SearchDomain; confidence: number };

/**
 * How far ahead the other domain must be, as a share of its own score, before
 * the question is worth moving pages for. 0.34 means it needs roughly half as
 * much again as the current page scored: "companies exhibiting at SaaStr" —
 * which scores for both — stays where it was typed.
 */
const MIN_MARGIN = 0.34;

/** The query-string key carrying a handed-off question to the destination. */
export const ASK_PARAM = 'ask';
/** Which page sent it. Informational — kept so the URL explains itself. */
export const ASK_FROM_PARAM = 'from';

const ROUTES: Record<SearchDomain, string> = {
  companies: '/app/companies',
  events: '/app/events',
};

function other(domain: SearchDomain): SearchDomain {
  return domain === 'companies' ? 'events' : 'companies';
}

/**
 * Decides whether `question`, typed on the `current` page, belongs elsewhere.
 *
 * A `people` win is treated as "stay": the People page still runs the legacy
 * assistant path, so there is nothing to hand off to, and answering in place
 * is better than a dead end.
 */
export function decideCrossIntent(question: string, current: SearchDomain): CrossIntentDecision {
  const trimmed = question.trim();
  if (!trimmed) return { kind: 'stay', reason: 'no-signal' };

  const { scores, winner } = classify(trimmed);
  if (!winner) return { kind: 'stay', reason: 'no-signal' };
  if (winner === current) return { kind: 'stay', reason: 'same-domain' };
  if (winner === 'people') return { kind: 'stay', reason: 'other-entity' };

  const target = other(current);
  const theirs = scores[target];
  const mine = scores[current];
  if (theirs <= 0) return { kind: 'stay', reason: 'no-signal' };

  // Measured against the winner's own score rather than the total, so a long
  // sentence that mentions both domains once does not read as decisive.
  const margin = (theirs - mine) / theirs;
  if (margin < MIN_MARGIN) return { kind: 'stay', reason: 'too-close' };

  return { kind: 'handoff', target, confidence: Math.min(1, margin) };
}

/**
 * Words that lean events but are too ambiguous to score outright.
 *
 * "companies in Berlin in March" is a company question with a date in it, so
 * these must not move the main score — they only break an exact tie, which is
 * the one case where there is nothing better to go on.
 */
const EVENT_TIEBREAKERS =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|q[1-4]|organiser|organizer|venue|booth|20\d\d)\b/i;

/** Ambiguous words that lean companies, used the same way. */
const COMPANY_TIEBREAKERS = /\b(categor(?:y|ies)|headcount|employees|revenue|domain|firmographics?)\b/i;

/**
 * Picks a page for a question asked somewhere that owns no data of its own —
 * the Dashboard's "Ask anything" box, which always routes and never answers.
 *
 * Unlike `decideCrossIntent` there is no "stay" to fall back on, so this always
 * commits. The main signal scores decide; only an exact tie consults the
 * ambiguous word lists, and a question with no signal at all lands on Companies
 * — the larger dataset, and the one the box's own placeholder describes.
 */
export function classifyAskDomain(question: string): {
  domain: SearchDomain;
  /** 0 when the choice was a coin flip, 1 when only one domain scored. */
  confidence: number;
} {
  const trimmed = question.trim();
  if (!trimmed) return { domain: 'companies', confidence: 0 };

  const { scores } = classify(trimmed);
  const companies = scores.companies;
  const events = scores.events;

  if (companies === events) {
    const leansEvents = EVENT_TIEBREAKERS.test(trimmed);
    const leansCompanies = COMPANY_TIEBREAKERS.test(trimmed);
    if (leansEvents && !leansCompanies) return { domain: 'events', confidence: 0 };
    return { domain: 'companies', confidence: 0 };
  }

  const domain: SearchDomain = events > companies ? 'events' : 'companies';
  const top = Math.max(companies, events);
  return { domain, confidence: Math.min(1, (top - Math.min(companies, events)) / top) };
}

/** The destination URL for a handoff, question included. */
export function buildHandoffUrl(
  target: SearchDomain,
  question: string,
  /** Where the question was typed. Informational — kept so the URL explains itself. */
  from: SearchDomain | 'dashboard'
): string {
  const params = new URLSearchParams({
    [ASK_PARAM]: question,
    [ASK_FROM_PARAM]: from,
  });
  return `${ROUTES[target]}?${params.toString()}`;
}

/**
 * Reads a handed-off question out of the current URL and removes it in the
 * same breath.
 *
 * The strip is what makes consumption one-shot: both the hero and the compact
 * panel can be mounted at once (they cross-fade), and React may run a mount
 * effect twice, but only the first caller sees a value. It also means a
 * refresh re-runs nothing, while a *new* handoff — which arrives with the
 * parameter back in the URL — still works. A module-level "already consumed"
 * flag could not do either: it would survive the client-side navigation and
 * swallow the second handoff of a session.
 *
 * Only the handoff keys are dropped; anything else on the query string (the
 * Events rail serialises its whole state there) is left untouched.
 */
export function takePendingAsk(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const question = params.get(ASK_PARAM)?.trim();
  if (!question) return null;

  params.delete(ASK_PARAM);
  params.delete(ASK_FROM_PARAM);
  const rest = params.toString();
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`
  );

  return question;
}

/**
 * The Exhibitors tab's state in an event page's address, for any event: which tab, the search, the A–Z
 * letter and — on the way back from sign-in — the exhibitor whose details were asked for.
 *
 *   /en-US/find-shows/<event>?tab=exhibitors&q=hotel&letter=S&exhibitor=<card id>
 *
 * A visitor who is not signed in and asks for an exhibitor's details is sent to the existing sign-in page
 * with this address as its return; Back or a cancelled sign-in lands on the same address without the
 * exhibitor, so the tab and its filters come back but no details open until the visitor has signed in.
 */
import { ALPHABET } from './exhibitors';

export const EXHIBITORS_TAB = 'exhibitors';
const KEYS = { tab: 'tab', query: 'q', letter: 'letter', exhibitor: 'exhibitor' } as const;

export type ExhibitorsContext = { query: string; letter: string | null; exhibitorId: string | null };

/** The Exhibitors state an address carries (nothing when it carries none). */
export function readExhibitorsContext(search: string): ExhibitorsContext {
  const params = new URLSearchParams(search);
  const letter = params.get(KEYS.letter);
  return {
    query: (params.get(KEYS.query) ?? '').slice(0, 200),
    letter: letter && ALPHABET.includes(letter) ? letter : null,
    exhibitorId: params.get(KEYS.exhibitor) || null,
  };
}

/** The event page's address with the Exhibitors tab open and this state; other parameters are kept. */
export function exhibitorsContextUrl(pathname: string, search: string, context: { query?: string; letter?: string | null; exhibitorId?: string | null }) {
  const params = new URLSearchParams(search);
  for (const key of Object.values(KEYS)) params.delete(key);
  params.set(KEYS.tab, EXHIBITORS_TAB);
  if (context.query) params.set(KEYS.query, context.query);
  if (context.letter) params.set(KEYS.letter, context.letter);
  if (context.exhibitorId) params.set(KEYS.exhibitor, context.exhibitorId);
  return `${pathname}?${params.toString()}`;
}

/** The same address without the exhibitor to open: once its details are open (or refused), a reload or Back must not reopen them. */
export function withoutExhibitor(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  params.delete(KEYS.exhibitor);
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}

import { emptyEventFilters } from '@/types/events';
import type { FindShowEvent } from '@/types/find-shows';
import { filterEventList } from './filters';

/** How many events the composer offers while typing. */
export const SUGGESTION_LIMIT = 8;

const NO_FAVOURITES: ReadonlySet<string> = new Set<string>();

/**
 * Live typeahead for the assistant composer.
 *
 * The composer is a chat box: it only does anything on Enter, and what it sends
 * goes to the model, so a partial word like "b" produced nothing at all until a
 * whole recognisable question had been typed. These suggestions put the plain
 * name lookup back underneath it — typing "b" lists B-named shows immediately,
 * while the box still submits to the assistant for anything that isn't just a
 * name.
 *
 * Deliberately built on `filterEventList` rather than a second matcher: that
 * function already does word-prefix matching and already ranks name matches
 * above location-only ones, so the dropdown and the filter rail can never
 * disagree about what "b" means. All this adds is the empty-query guard and the
 * cap.
 */
export function suggestEvents(
  events: readonly FindShowEvent[],
  query: string,
  limit: number = SUGGESTION_LIMIT
): FindShowEvent[] {
  if (!query.trim()) return [];
  return filterEventList(events, emptyEventFilters(), query, NO_FAVOURITES).slice(0, limit);
}

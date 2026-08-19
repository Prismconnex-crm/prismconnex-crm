"use client";

import { EventsInlineRows } from '@/components/events/events-inline-rows';
import type { EventQueryState } from '@/lib/events/filters';
import { emptyEventFilters, type EventFilters } from '@/types/events';
import type { FindShowEvent } from '@/types/find-shows';
import type { PageBinding } from '../types';

/** The liked/target sets and toggles the Events page already owns. */
export type EventRowContext = {
  likedIds: ReadonlySet<string>;
  targetIds: ReadonlySet<string>;
  onToggleLike(slug: string): void;
  onToggleTarget(slug: string): void;
};

const EMPTY_CONTEXT: EventRowContext = {
  likedIds: new Set(),
  targetIds: new Set(),
  onToggleLike: () => {},
  onToggleTarget: () => {},
};

export const eventsBinding: PageBinding<EventQueryState, EventRowContext> = {
  entity: 'events',
  route: '/app/events',

  emptyFilters() {
    return { filters: emptyEventFilters(), search: '' };
  },

  /**
   * The nested `filters` object is merged PER KEY over the incoming object's own
   * keys — never `{...current.filters, ...incoming.filters}`.
   *
   * That spread looks equivalent and is not: a caller that builds `incoming`
   * from `emptyEventFilters()` carries an empty array for every dimension, so
   * the spread would silently clear every filter the user set by hand in the
   * rail. Iterating the incoming object's own keys replaces exactly what the
   * caller named — including an explicit `[]`, which is a real clear.
   *
   * `search` is replaced only when supplied.
   */
  applyFilters(current, incoming) {
    const filters = { ...current.filters };
    if (incoming.filters) {
      for (const key of Object.keys(incoming.filters) as (keyof EventFilters)[]) {
        (filters[key] as unknown) = incoming.filters[key];
      }
    }
    return {
      filters,
      search: incoming.search !== undefined ? incoming.search : current.search,
    };
  },

  renderRows(rows, context) {
    const ctx = context ?? EMPTY_CONTEXT;
    return (
      <EventsInlineRows
        events={rows as FindShowEvent[]}
        likedIds={ctx.likedIds}
        targetIds={ctx.targetIds}
        onToggleLike={ctx.onToggleLike}
        onToggleTarget={ctx.onToggleTarget}
      />
    );
  },
};

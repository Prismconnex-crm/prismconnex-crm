"use client";

import { PeopleResultsTable } from '@/components/people/people-results-table';
import { paramsToFilters, serializePeopleQuery } from '@/lib/people/filters';
import { emptyPeopleFilters, type PeopleFilters, type Person } from '@/types/people';
import type { PageBinding } from '../types';

/** The handlers and selection state the People page already owns. */
export type PeopleRowContext = {
  selectedIds: ReadonlySet<string>;
  savedIds: ReadonlySet<string>;
  onToggleSelect(id: string): void;
  onToggleSaved(person: Person): void;
  onOpenPerson(person: Person): void;
};

const EMPTY_CONTEXT: PeopleRowContext = {
  selectedIds: new Set(),
  savedIds: new Set(),
  onToggleSelect: () => {},
  onToggleSaved: () => {},
  onOpenPerson: () => {},
};

/**
 * Replace-the-conflicting-key semantics live here rather than in shared code
 * because the shapes differ per entity: people's filters are array-valued,
 * events' are nested under `filters`. A generic merge would have to guess.
 */
export const peopleBinding: PageBinding<PeopleFilters, PeopleRowContext> = {
  entity: 'people',
  route: '/app/people',

  emptyFilters: emptyPeopleFilters,

  applyFilters(current, incoming) {
    // Only keys actually present in `incoming` are replaced — an absent key
    // leaves the user's own filter alone, while an explicit [] clears it.
    return { ...current, ...incoming };
  },

  /**
   * Delegates to the codec the People page already reads and writes
   * (people-section.tsx: "URL as the single source of truth"), exactly as the
   * events binding delegates to the Events rail's scheme.
   *
   * An opaque base64 blob was specified here on the belief that People had no
   * URL scheme. It does — and a second representation of the same state on the
   * same page is precisely the drift the events decision exists to prevent:
   * the panel and the rail would each believe a different set of filters.
   *
   * paramsToFilters also validates against the closed vocabulary, so a value
   * invented by the model or typed into the address bar is dropped rather than
   * queried.
   */
  serializeFilters: serializePeopleQuery,
  parseFilters: paramsToFilters,

  renderRows(rows, context) {
    // EMPTY_CONTEXT is a defensive default for a page that forgets to pass one;
    // the controls are then inert, which is why every page must pass a real one.
    const ctx = context ?? EMPTY_CONTEXT;
    return (
      <PeopleResultsTable
        people={rows as Person[]}
        selectedIds={ctx.selectedIds as Set<string>}
        savedIds={ctx.savedIds as Set<string>}
        onToggleSelect={ctx.onToggleSelect}
        onToggleSaved={ctx.onToggleSaved}
        onOpenPerson={ctx.onOpenPerson}
      />
    );
  },
};

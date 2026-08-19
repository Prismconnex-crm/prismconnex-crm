"use client";

import { PeopleResultsTable } from '@/components/people/people-results-table';
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

"use client";

import { PeopleResultsTable } from '@/components/people/people-results-table';
import { emptyPeopleFilters, type PeopleFilters, type Person } from '@/types/people';
import type { PageBinding } from '../types';

/**
 * Replace-the-conflicting-key semantics live here rather than in shared code
 * because the shapes differ per entity: people's filters are array-valued,
 * the events ask-path's are scalar. A generic merge would have to guess.
 */
export const peopleBinding: PageBinding<PeopleFilters> = {
  entity: 'people',
  route: '/app/people',

  emptyFilters: emptyPeopleFilters,

  applyFilters(current, incoming) {
    // Only keys actually present in `incoming` are replaced — an absent key
    // leaves the user's own filter alone, while an explicit [] clears it.
    return { ...current, ...incoming };
  },

  renderRows(rows) {
    return (
      <PeopleResultsTable
        people={rows as Person[]}
        selectedIds={new Set<string>()}
        savedIds={new Set<string>()}
        onToggleSelect={() => {}}
        onToggleSaved={() => {}}
        onOpenPerson={() => {}}
      />
    );
  },
};

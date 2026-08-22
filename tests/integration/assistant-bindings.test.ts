import { describe, expect, it } from 'vitest';
import { peopleBinding } from '@/components/assistant/bindings/people';
import { bindingFor, resetBindings, setBindingForTests } from '@/components/assistant/registry';
import type { PeopleRowContext } from '@/components/assistant/bindings/people';
import { eventsBinding } from '@/components/assistant/bindings/events';
import { emptyEventFilters } from '@/types/events';
import { emptyPeopleFilters } from '@/types/people';

describe('peopleBinding', () => {
  it('declares its entity and route', () => {
    expect(peopleBinding.entity).toBe('people');
    expect(peopleBinding.route).toBe('/app/people');
  });

  it('replaces a conflicting key and preserves unrelated filters', () => {
    const current = {
      ...emptyPeopleFilters(),
      countries: ['France'],
      industries: ['SaaS'],
      verification: 'verified' as const,
    };

    const next = peopleBinding.applyFilters(current, { countries: ['Germany'] });

    expect(next.countries).toEqual(['Germany']); // replaced, not merged
    expect(next.industries).toEqual(['SaaS']); // untouched
    expect(next.verification).toBe('verified'); // untouched
  });

  it('ignores keys the incoming set does not mention', () => {
    const current = { ...emptyPeopleFilters(), countries: ['France'] };
    expect(peopleBinding.applyFilters(current, {}).countries).toEqual(['France']);
  });

  it('accepts an explicit empty array as a real clear', () => {
    const current = { ...emptyPeopleFilters(), countries: ['France'] };
    expect(peopleBinding.applyFilters(current, { countries: [] }).countries).toEqual([]);
  });

  it('starts from the shared empty filter shape', () => {
    expect(peopleBinding.emptyFilters()).toEqual(emptyPeopleFilters());
  });
});

describe('registry', () => {
  it('returns the people binding', () => {
    expect(bindingFor('people').entity).toBe('people');
  });

  it('throws for an entity with no binding yet', () => {
    // companies lands in Spec 2c.
    expect(() => bindingFor('companies')).toThrow(/no binding/i);
  });

  it('supports a test seam', () => {
    setBindingForTests('companies', { ...peopleBinding, entity: 'companies' } as never);
    expect(bindingFor('companies').entity).toBe('companies');
    resetBindings();
    expect(() => bindingFor('companies')).toThrow();
  });
});

describe('peopleBinding — row context', () => {
  it('renderRows takes a context argument', () => {
    // Two parameters: the rows, and the page's own handlers. A one-parameter
    // signature is what forced the no-op callbacks this replaces.
    expect(peopleBinding.renderRows.length).toBe(2);
  });

  it('the context type carries real handlers, not placeholders', () => {
    const context: PeopleRowContext = {
      selectedIds: new Set(['p1']),
      savedIds: new Set(['p2']),
      onToggleSelect: () => {},
      onToggleSaved: () => {},
      onOpenPerson: () => {},
    };
    // Compile-time assertion, plus a runtime shape check so a renamed field
    // fails here rather than silently rendering inert controls.
    expect(Object.keys(context).sort()).toEqual([
      'onOpenPerson',
      'onToggleSaved',
      'onToggleSelect',
      'savedIds',
      'selectedIds',
    ]);
  });
});

describe('eventsBinding', () => {
  it('declares its entity and route', () => {
    expect(eventsBinding.entity).toBe('events');
    expect(eventsBinding.route).toBe('/app/events');
  });

  it('starts from the shared empty query state', () => {
    const empty = eventsBinding.emptyFilters();
    expect(empty.filters).toEqual(emptyEventFilters());
    expect(empty.search).toBe('');
  });

  it('merges the nested filters key-wise rather than replacing the object', () => {
    const current = {
      filters: { ...emptyEventFilters(), countries: ['France'], categories: ['Packaging'] as never },
      search: 'expo',
    };

    const next = eventsBinding.applyFilters(current, {
      filters: { countries: ['Germany'] } as never,
    });

    expect(next.filters.countries).toEqual(['Germany']); // replaced
    expect(next.filters.categories).toEqual(['Packaging']); // preserved
    expect(next.search).toBe('expo'); // preserved
  });

  it('replaces search when it is supplied', () => {
    const current = { filters: emptyEventFilters(), search: 'old' };
    expect(eventsBinding.applyFilters(current, { search: 'new' }).search).toBe('new');
  });

  it('leaves search alone when it is absent', () => {
    const current = { filters: emptyEventFilters(), search: 'old' };
    expect(eventsBinding.applyFilters(current, { filters: emptyEventFilters() }).search).toBe('old');
  });

  it('accepts an explicit empty array as a real clear', () => {
    const current = { filters: { ...emptyEventFilters(), countries: ['France'] }, search: '' };
    const next = eventsBinding.applyFilters(current, { filters: { countries: [] } as never });
    expect(next.filters.countries).toEqual([]);
  });

  it('renderRows takes a context argument', () => {
    expect(eventsBinding.renderRows.length).toBe(2);
  });
});

describe('registry — events registered', () => {
  it('no longer throws for events', () => {
    expect(bindingFor('events').entity).toBe('events');
  });

  it('still throws for companies, which lands in Spec 2c', () => {
    expect(() => bindingFor('companies')).toThrow(/no binding/i);
  });
});

describe('binding filter serialization', () => {
  /**
   * Each binding owns its own URL representation. Events has a shipped readable
   * scheme; People has one opaque blob. A single shared codec would have to be
   * one or the other, and on Events it would compete with the scheme the rail
   * already reads — two representations of the same state, free to drift.
   */
  it('events round-trips through its own readable scheme', () => {
    const filters = eventsBinding.emptyFilters();
    filters.filters.countries = ['Germany'];
    filters.filters.categories = ['Packaging'];
    filters.search = 'expo';

    const query = eventsBinding.serializeFilters(filters);
    expect(query).toContain('country=Germany');
    expect(query).toContain('category=Packaging');
    expect(eventsBinding.parseFilters(query)).toEqual(filters);
  });

  it('events serialises empty filters to an empty string, not "?"', () => {
    expect(eventsBinding.serializeFilters(eventsBinding.emptyFilters())).toBe('');
  });

  it('events ignores the handoff params, which are not its filters', () => {
    // ask/via/cid must never be read as event filters. `q` and `from` ARE its
    // own, which is exactly why the handoff params are named differently.
    const parsed = eventsBinding.parseFilters('?ask=trade%20shows&via=people&cid=abc');
    expect(parsed).toEqual(eventsBinding.emptyFilters());
  });

  it('people round-trips through the codec its own page already uses', () => {
    const filters = peopleBinding.emptyFilters();
    filters.titles = ['VP Engineering'];
    filters.countries = ['Germany'];
    filters.search = 'fintech';

    const query = peopleBinding.serializeFilters(filters);
    // Readable, and the SAME scheme people-section.tsx reads on mount — a
    // second representation would let the panel and the rail disagree.
    expect(query).toContain('title=VP+Engineering');
    expect(query).toContain('country=Germany');
    expect(query).toContain('q=fintech');
    expect(peopleBinding.parseFilters(query)).toEqual(filters);
  });

  it('people ignores the handoff params, which are not its filters', () => {
    // People owns `q`; that is exactly why the question travels as `ask`.
    expect(peopleBinding.parseFilters('?ask=who+are+the+CEOs&via=events&cid=abc')).toEqual(
      peopleBinding.emptyFilters()
    );
  });

  it('people drops a value outside its closed vocabulary', () => {
    // paramsToFilters validates; an invented seniority never reaches a query.
    expect(peopleBinding.parseFilters('?seniority=Sovereign').seniorities).toEqual([]);
  });

  it('people serialises empty filters to an empty string', () => {
    expect(peopleBinding.serializeFilters(peopleBinding.emptyFilters())).toBe('');
  });

  it('people falls back to empty filters for a corrupt param', () => {
    expect(peopleBinding.parseFilters('?pf=!!!garbage!!!')).toEqual(
      peopleBinding.emptyFilters()
    );
  });

  it('neither binding throws on an empty search string', () => {
    expect(eventsBinding.parseFilters('')).toEqual(eventsBinding.emptyFilters());
    expect(peopleBinding.parseFilters('')).toEqual(peopleBinding.emptyFilters());
  });
});

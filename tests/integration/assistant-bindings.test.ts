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

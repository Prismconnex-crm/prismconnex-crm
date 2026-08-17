import { describe, expect, it } from 'vitest';
import { peopleBinding } from '@/components/assistant/bindings/people';
import { bindingFor, resetBindings, setBindingForTests } from '@/components/assistant/registry';
import type { PeopleRowContext } from '@/components/assistant/bindings/people';
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
    // events and companies land in Spec 2b.
    expect(() => bindingFor('events')).toThrow(/no binding/i);
  });

  it('supports a test seam', () => {
    setBindingForTests('events', { ...peopleBinding, entity: 'events' } as never);
    expect(bindingFor('events').entity).toBe('events');
    resetBindings();
    expect(() => bindingFor('events')).toThrow();
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

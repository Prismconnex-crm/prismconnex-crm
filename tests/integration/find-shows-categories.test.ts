import { describe, expect, it } from 'vitest';
import {
  classifyFindShowEvent,
  FIND_SHOW_CATEGORIES,
  matchesCategorySearch,
} from '../../lib/find-shows/categories';
import {
  findShowCategoryOptions,
  findShowEvents,
  findShowsCategories,
} from '../../lib/find-shows/catalog';
import { filterFindShowEvents } from '../../lib/find-shows/search-events';
import type { FindShowFilters } from '../../types/find-shows';

const baseFilters: FindShowFilters = {
  query: '',
  region: 'All Regions',
  country: '',
  category: 'All Categories',
  startMonth: '',
  endMonth: '',
};

describe('find shows categories — taxonomy', () => {
  it('has only individual categories: no combined "A & B" labels', () => {
    for (const category of FIND_SHOW_CATEGORIES) {
      expect(category).not.toMatch(/&| and /i);
    }
  });

  it('splits every former combined bucket and adds the IT family', () => {
    for (const category of [
      'Technology',
      'Electronics',
      'Manufacturing',
      'Engineering',
      'Construction',
      'Building',
      'Medical',
      'Healthcare',
      'Food',
      'Beverage',
      'Energy',
      'Environment',
      'Plastics',
      'Rubber',
      'Textiles',
      'Fashion',
      'Security',
      'Safety',
      'Information Technology',
      'Cybersecurity',
      'Cloud Computing',
    ]) {
      expect(FIND_SHOW_CATEGORIES).toContain(category);
    }
  });

  it('has no duplicates, case-insensitively', () => {
    const lowered = findShowsCategories.map((category) => category.toLowerCase());
    expect(new Set(lowered).size).toBe(lowered.length);
  });

  it('lists "All Categories" first, then strictly A-Z', () => {
    const [first, ...rest] = findShowCategoryOptions.map((option) => option.label);
    expect(first).toBe('All Categories');
    expect(rest).toEqual([...rest].sort((left, right) => left.localeCompare(right, 'en')));
    expect(rest).toHaveLength(FIND_SHOW_CATEGORIES.length);
  });
});

describe('find shows categories — classification', () => {
  const tags = (name: string, description = '') => classifyFindShowEvent(name, description);

  it('tags IT events: conferences, software, SaaS, cloud, DevOps, AI, cybersecurity', () => {
    expect(tags('CIO SUMMIT', 'Conference for IT leaders')).toContain('Information Technology');
    expect(tags('DEVWEEK', 'Software developers and DevOps teams')).toContain(
      'Information Technology'
    );
    expect(tags('AI EXPO', 'Artificial intelligence and machine learning')).toContain(
      'Information Technology'
    );
    expect(tags('SAAS NORTH', 'The SaaS conference')).toContain('Cloud Computing');
  });

  it('multi-tags an event and adds umbrella categories', () => {
    const cloudSecurity = tags(
      'CLOUD & CYBER SECURITY EXPO',
      'Data centres, cloud computing and cyber security'
    );
    expect(cloudSecurity).toEqual(
      expect.arrayContaining([
        'Cloud Computing',
        'Cybersecurity',
        'Information Technology',
        'Technology',
      ])
    );
    // No category is ever repeated.
    expect(new Set(cloudSecurity).size).toBe(cloudSecurity.length);
  });

  it('keeps each half of a former bucket to its own events', () => {
    expect(tags('SEMICON WEST', 'Semiconductor supply chain')).toEqual(
      expect.arrayContaining(['Electronics', 'Technology'])
    );
    expect(tags('SEMICON WEST', 'Semiconductor supply chain')).not.toContain(
      'Information Technology'
    );
    expect(tags('ENGINEERING SUMMIT', 'Mechanical engineering conference')).toContain(
      'Engineering'
    );
    expect(tags('BAUMA', 'Construction machinery')).toContain('Construction');
    expect(tags('BAUMA', 'Construction machinery')).not.toContain('Building');
    expect(tags('BUILDEX', 'Building materials, architecture and infrastructure')).toEqual([
      'Building',
    ]);
    expect(tags('CAFE SHOW', 'Coffee and tea')).toEqual(['Beverage']);
  });

  it('puts the name ahead of the description when choosing the primary category', () => {
    expect(tags('MEDICA', 'Medical technology, including hospital IT')[0]).toBe('Medical');
  });

  it('matches whole words only, avoiding the old substring false positives', () => {
    // "gas" in Las Vegas, "oil" in olive oil, "tea" in steam, "building" in team building.
    expect(tags('ROCK N ROLL MARATHON', 'Run through Las Vegas')).toEqual(['General']);
    expect(tags('OLIVE OIL FAIR', 'Extra virgin olive oil')).not.toContain('Energy');
    expect(tags('STEAMPUNK FESTIVAL', 'Steam engines and costumes')).not.toContain('Beverage');
    expect(tags('LEADERSHIP DAY', 'Team building workshops')).not.toContain('Building');
    expect(tags('SNMMI', 'Nuclear medicine congress')).not.toContain('Energy');
  });

  it('classifies inventory-style fairs by their name only', () => {
    expect(tags('CITY GUN SHOW', 'Handguns, self-defense, safety, hi-tech gadgets')).toEqual([
      'General',
    ]);
    expect(tags('STUDENT FAIR', 'Courses in medicine, engineering and IT')).toEqual(['General']);
  });

  it('falls back to General when nothing matches', () => {
    expect(tags('ART BRUSSELS', 'Contemporary art fair')).toEqual(['General']);
  });
});

describe('find shows categories — dropdown search', () => {
  const search = (query: string) =>
    FIND_SHOW_CATEGORIES.filter((category) => matchesCategorySearch(category, query));

  it('matches individual category names by word prefix', () => {
    expect(search('tech')).toEqual(['Information Technology', 'Technology']);
    expect(search('comp')).toEqual(['Cloud Computing']);
    expect(search('cyber')).toEqual(['Cybersecurity']);
    expect(search('build')).toEqual(['Building']);
    expect(search('Engineering')).toEqual(['Engineering']);
  });

  it('matches initials, and never fuzzy subsequences', () => {
    // A subsequence search would also hit Agriculture and Security.
    expect(search('it')).toEqual(['Information Technology']);
    expect(search('cc')).toEqual(['Cloud Computing']);
  });

  it('shows everything for an empty query', () => {
    expect(search('  ')).toEqual([...FIND_SHOW_CATEGORIES]);
  });
});

describe('find shows categories — catalog filtering', () => {
  it('tags every catalog event with known, unique categories, primary first', () => {
    for (const event of findShowEvents) {
      expect(event.categories.length).toBeGreaterThan(0);
      expect(new Set(event.categories).size).toBe(event.categories.length);
      expect(event.primaryCategory).toBe(event.categories[0]);
      for (const category of event.categories) {
        expect(FIND_SHOW_CATEGORIES).toContain(category);
      }
    }
  });

  it('shows exactly the events tagged with the selected category', () => {
    for (const category of FIND_SHOW_CATEGORIES) {
      const expected = findShowEvents.filter((event) => event.categories.includes(category));
      const result = filterFindShowEvents(findShowEvents, { ...baseFilters, category });

      expect(result).toHaveLength(expected.length);
      expect(result.every((event) => event.categories.includes(category))).toBe(true);
    }
  });

  it('gives every category at least one real event', () => {
    for (const category of FIND_SHOW_CATEGORIES) {
      expect(
        findShowEvents.some((event) => event.categories.includes(category)),
        category
      ).toBe(true);
    }
  });

  it('composes the category with region, country, month range and search', () => {
    const filters: FindShowFilters = {
      ...baseFilters,
      category: 'Information Technology',
      region: 'Europe',
      country: 'Germany',
      startMonth: '2026-09',
      endMonth: '2027-12',
      query: 'expo',
    };
    const result = filterFindShowEvents(findShowEvents, filters);

    expect(result.length).toBeGreaterThan(0);
    for (const event of result) {
      expect(event.categories).toContain('Information Technology');
      expect(event.region).toBe('Europe');
      expect(event.country).toBe('Germany');
      // Dates overlap the range (a show starting in August and ending in September counts).
      expect(event.endMonth >= '2026-09' && event.startMonth <= '2027-12').toBe(true);
    }

    // Narrowing by a second filter never adds events.
    const withoutQuery = filterFindShowEvents(findShowEvents, { ...filters, query: '' });
    expect(withoutQuery.length).toBeGreaterThanOrEqual(result.length);
  });

  it('includes every specialist show under its umbrella category', () => {
    const itEvents = new Set(
      filterFindShowEvents(findShowEvents, {
        ...baseFilters,
        category: 'Information Technology',
      })
    );
    for (const specialist of ['Cybersecurity', 'Cloud Computing'] as const) {
      for (const event of filterFindShowEvents(findShowEvents, {
        ...baseFilters,
        category: specialist,
      })) {
        expect(itEvents.has(event)).toBe(true);
      }
    }
  });
});

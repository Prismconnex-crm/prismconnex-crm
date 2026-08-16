import { describe, expect, it } from 'vitest';
import { computePeopleStats, loadPeople, peopleVocabulary } from '@/lib/people/data';
import {
  BUYING_INTENTS,
  DATA_SOURCES,
  DEPARTMENTS,
  HEADCOUNT_BANDS,
  SENIORITIES,
  VERIFICATION_STATUSES,
} from '@/types/people';

const people = loadPeople();

describe('people seed', () => {
  it('holds exactly 2418 records with unique ids', () => {
    expect(people).toHaveLength(2418);
    expect(new Set(people.map((person) => person.id)).size).toBe(2418);
  });

  it('populates every closed vocabulary', () => {
    for (const [key, vocab] of [
      ['seniority', SENIORITIES],
      ['department', DEPARTMENTS],
      ['companyHeadcount', HEADCOUNT_BANDS],
      ['verification', VERIFICATION_STATUSES],
      ['source', DATA_SOURCES],
      ['buyingIntent', BUYING_INTENTS],
    ] as const) {
      const present = new Set(people.map((person) => person[key] as string));
      for (const value of vocab) {
        expect(present.has(value), `${key} missing ${value}`).toBe(true);
      }
    }
  });

  it('gives every open vocabulary at least 20 distinct members', () => {
    const vocabulary = peopleVocabulary();
    expect(vocabulary.titles.length).toBeGreaterThanOrEqual(20);
    expect(vocabulary.companies.length).toBeGreaterThanOrEqual(20);
    expect(vocabulary.countries.length).toBeGreaterThanOrEqual(20);
    expect(vocabulary.locations.length).toBeGreaterThanOrEqual(20);
    expect(vocabulary.industries.length).toBeGreaterThanOrEqual(20);
    expect(vocabulary.keywords.length).toBeGreaterThanOrEqual(20);
  });

  it('keeps every record structurally valid', () => {
    for (const person of people) {
      expect(person.confidence).toBeGreaterThanOrEqual(0);
      expect(person.confidence).toBeLessThanOrEqual(100);
      expect(person.platformScore).toBeGreaterThanOrEqual(0);
      expect(person.platformScore).toBeLessThanOrEqual(100);
      expect(person.workEmail).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
      expect(person.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(person.keywords.length).toBeGreaterThan(0);
    }
  });

  it('contains the worked example the chat is specced against', () => {
    const matches = people.filter(
      (person) =>
        person.country === 'Germany' &&
        person.verification === 'verified' &&
        person.title.toLowerCase().includes('marketing manager')
    );
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe('computePeopleStats', () => {
  it('reports a mean confidence that renders as 84% (Good)', () => {
    const stats = computePeopleStats(people);
    expect(stats.total).toBe(2418);
    expect(stats.avgConfidence).toBe(84);
    expect(stats.lastFetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(stats.sources.length).toBeGreaterThan(0);
  });

  it('handles an empty set without dividing by zero', () => {
    const stats = computePeopleStats([]);
    expect(stats.total).toBe(0);
    expect(stats.avgConfidence).toBe(0);
  });
});

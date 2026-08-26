import seed from '../../data/people-seed.json';
import type { DataSource, Person, PeopleStats } from '@/types/people';

/**
 * Typed access to the committed People dataset, plus the derived indexes the
 * rail and the query parser need. Everything is memoised at module scope: the
 * seed is immutable, so the work is done once per process.
 *
 * Imported directly as JSON, matching `lib/find-shows/catalog.ts`.
 */

const PEOPLE = seed as Person[];

export function loadPeople(): Person[] {
  return PEOPLE;
}

export type PeopleVocabulary = {
  titles: string[];
  companies: string[];
  countries: string[];
  locations: string[];
  industries: string[];
  keywords: string[];
};

let vocabularyCache: PeopleVocabulary | null = null;

/** Distinct open-vocabulary values, sorted longest-first for phrase matching. */
export function peopleVocabulary(): PeopleVocabulary {
  if (vocabularyCache) return vocabularyCache;

  const collect = (values: string[]) =>
    Array.from(new Set(values.filter(Boolean))).sort(
      (left, right) => right.length - left.length || left.localeCompare(right)
    );

  vocabularyCache = {
    titles: collect(PEOPLE.map((person) => person.title)),
    companies: collect(PEOPLE.map((person) => person.company)),
    countries: collect(PEOPLE.map((person) => person.country)),
    locations: collect(PEOPLE.map((person) => person.location)),
    industries: collect(PEOPLE.map((person) => person.industry)),
    keywords: collect(PEOPLE.flatMap((person) => person.keywords)),
  };
  return vocabularyCache;
}

export function computePeopleStats(people: readonly Person[]): PeopleStats {
  if (people.length === 0) {
    return { total: 0, avgConfidence: 0, lastFetchedAt: '', sources: [] };
  }

  const totalConfidence = people.reduce((sum, person) => sum + person.confidence, 0);
  const lastFetchedAt = people.reduce(
    (latest, person) => (person.fetchedAt > latest ? person.fetchedAt : latest),
    people[0].fetchedAt
  );
  const sources = Array.from(new Set(people.map((person) => person.source))) as DataSource[];

  return {
    total: people.length,
    avgConfidence: Math.round(totalConfidence / people.length),
    lastFetchedAt,
    sources,
  };
}

import {
  findShowCountries,
  findShowEvents,
  findShowsCategories,
  findShowsRegions,
} from '@/lib/find-shows/catalog';
import type { EventVocabulary } from '@/lib/events/nl-query';

/**
 * The catalog-derived vocabularies the deterministic parser matches against.
 *
 * Split out from lib/events/nl-query so that module stays pure and importable
 * without pulling in the 10 MB seed JSON — the parser takes its vocabularies as
 * an argument, and only this file knows where they come from.
 *
 * Built once at module load, which is also when the catalog itself is built.
 */

/** Multi-word phrases first: matching is longest-first, so order here is free. */
function distinct(values: readonly string[], minLength: number): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === '?' || trimmed.length < minLength) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return Array.from(seen.values());
}

/**
 * Cities and organizers are open sets of a few thousand entries each. The
 * parser scans them linearly per question, so they are capped at the values
 * that actually carry events — a one-event city is not worth the scan, and
 * matching it would more often be a false positive on a common word.
 */
function byFrequency(values: readonly string[], minCount: number, minLength: number): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === '?' || trimmed.length < minLength) continue;
    const key = trimmed.toLowerCase();
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { label: trimmed, count: 1 });
  }

  return Array.from(counts.values())
    .filter((entry) => entry.count >= minCount)
    .sort((left, right) => right.count - left.count)
    .map((entry) => entry.label);
}

/**
 * The catalog's actual date span. An empty date search is far more often a
 * question outside this window than a genuinely empty one, so the answer names
 * it rather than guessing at "a few years".
 */
export const eventCoverage: { from: string; to: string } | null = (() => {
  let from = '';
  let to = '';
  for (const event of findShowEvents) {
    if (!event.startDate) continue;
    if (!from || event.startDate < from) from = event.startDate;
    if (!to || event.endDate > to) to = event.endDate;
  }
  return from && to ? { from, to } : null;
})();

export const eventVocabulary: EventVocabulary = {
  // Closed sets. "All Regions"/"All Categories" are UI placeholders and are
  // skipped by the parser itself.
  regions: findShowsRegions,
  categories: findShowsCategories,
  countries: distinct(findShowCountries, 3),
  // 3+ events, and at least 4 characters: short city names ("Ely", "Ise") match
  // inside ordinary words far more often than they identify a real venue.
  cities: byFrequency(
    findShowEvents.map((event) => event.city),
    3,
    4
  ),
  organizers: byFrequency(
    findShowEvents.map((event) => event.organizer),
    2,
    4
  ),
};

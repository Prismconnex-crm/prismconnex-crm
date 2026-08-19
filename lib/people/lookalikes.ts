import type { Person } from '@/types/people';

/**
 * "AI Lookalikes" without a model call: weighted overlap on the five
 * dimensions that actually predict a comparable buyer. Deterministic, so the
 * same seed always produces the same ranking and the tests can assert order.
 *
 * The weights are deliberately a single exported object — they are the whole
 * definition of the feature, and unit-tested as such. They sum to 1, so a
 * score is directly readable as "how alike, 0 to 1".
 */
export const LOOKALIKE_WEIGHTS = {
  seniority: 0.25,
  department: 0.3,
  industry: 0.2,
  headcount: 0.15,
  country: 0.1,
} as const;

export function lookalikeScore(seed: Person, candidate: Person): number {
  let score = 0;
  if (seed.seniority === candidate.seniority) score += LOOKALIKE_WEIGHTS.seniority;
  if (seed.department === candidate.department) score += LOOKALIKE_WEIGHTS.department;
  if (seed.industry === candidate.industry) score += LOOKALIKE_WEIGHTS.industry;
  if (seed.companyHeadcount === candidate.companyHeadcount) score += LOOKALIKE_WEIGHTS.headcount;
  if (seed.country === candidate.country) score += LOOKALIKE_WEIGHTS.country;
  return score;
}

export function rankLookalikes(
  people: readonly Person[],
  seedId: string,
  limit = 50
): Person[] {
  const seed = people.find((person) => person.id === seedId);
  if (!seed) return [];

  return people
    .filter((person) => person.id !== seedId)
    .map((person) => ({ person, score: lookalikeScore(seed, person) }))
    // Ties break on id so a redraw never reshuffles equally-similar rows.
    .sort(
      (left, right) =>
        right.score - left.score || left.person.id.localeCompare(right.person.id)
    )
    .slice(0, limit)
    .map((entry) => entry.person);
}

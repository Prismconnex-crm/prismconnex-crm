import { describe, expect, it } from 'vitest';
import { LOOKALIKE_WEIGHTS, lookalikeScore, rankLookalikes } from '@/lib/people/lookalikes';
import type { Person } from '@/types/people';

function makePerson(overrides: Partial<Person> & { id: string }): Person {
  return {
    firstName: 'Sarah',
    lastName: 'Miller',
    title: 'Marketing Manager',
    seniority: 'Manager',
    department: 'Marketing',
    company: 'NovaAI',
    companyDomain: 'novaai.de',
    companyHeadcount: '51-200',
    industry: 'Artificial Intelligence',
    country: 'Germany',
    location: 'Berlin, Germany',
    workEmail: 'sarah.miller@novaai.de',
    phone: null,
    linkedinUrl: null,
    verification: 'verified',
    confidence: 91,
    platformScore: 98,
    source: 'user_import',
    keywords: ['automation'],
    buyingIntent: 'high',
    fetchedAt: '2026-02-01',
    lastActiveAt: '2026-08-01',
    ...overrides,
  };
}

const seed = makePerson({ id: 'seed' });

describe('lookalikeScore', () => {
  it('scores an identical profile as 1', () => {
    expect(lookalikeScore(seed, makePerson({ id: 'twin' }))).toBe(1);
  });

  it('scores a profile sharing nothing as 0', () => {
    const opposite = makePerson({
      id: 'opposite',
      seniority: 'Entry',
      department: 'Legal',
      industry: 'Mining',
      companyHeadcount: '5000+',
      country: 'Japan',
    });
    expect(lookalikeScore(seed, opposite)).toBe(0);
  });

  it('weights each dimension as declared', () => {
    const sameDepartmentOnly = makePerson({
      id: 'dept',
      seniority: 'Entry',
      industry: 'Mining',
      companyHeadcount: '5000+',
      country: 'Japan',
    });
    expect(lookalikeScore(seed, sameDepartmentOnly)).toBeCloseTo(LOOKALIKE_WEIGHTS.department, 10);
  });

  it('weights sum to exactly 1 so scores stay in range', () => {
    const total = Object.values(LOOKALIKE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe('rankLookalikes', () => {
  const people = [
    seed,
    makePerson({ id: 'twin' }),
    makePerson({ id: 'near', country: 'France' }),
    makePerson({
      id: 'far',
      seniority: 'Entry',
      department: 'Legal',
      industry: 'Mining',
      companyHeadcount: '5000+',
      country: 'Japan',
    }),
  ];

  it('excludes the seed from its own results', () => {
    expect(rankLookalikes(people, 'seed').map((person) => person.id)).not.toContain('seed');
  });

  it('ranks by descending similarity', () => {
    expect(rankLookalikes(people, 'seed').map((person) => person.id)).toEqual([
      'twin',
      'near',
      'far',
    ]);
  });

  it('is deterministic across repeated calls', () => {
    const first = rankLookalikes(people, 'seed').map((person) => person.id);
    const second = rankLookalikes(people, 'seed').map((person) => person.id);
    expect(first).toEqual(second);
  });

  it('honours the limit', () => {
    expect(rankLookalikes(people, 'seed', 2)).toHaveLength(2);
  });

  it('returns an empty list for an unknown seed id', () => {
    expect(rankLookalikes(people, 'nobody')).toEqual([]);
  });

  it('breaks ties by id so ordering is stable', () => {
    const tied = [seed, makePerson({ id: 'b' }), makePerson({ id: 'a' })];
    expect(rankLookalikes(tied, 'seed').map((person) => person.id)).toEqual(['a', 'b']);
  });
});

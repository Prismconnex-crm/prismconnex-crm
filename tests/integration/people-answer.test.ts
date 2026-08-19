import { describe, expect, it } from 'vitest';
import { buildPeopleAnswer } from '@/lib/people/answer';
import { emptyPeopleFilters, type PeopleFilters, type Person } from '@/types/people';

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

function withFilters(overrides: Partial<PeopleFilters>): PeopleFilters {
  return { ...emptyPeopleFilters(), ...overrides };
}

const matches = [
  makePerson({ id: 'p1' }),
  makePerson({ id: 'p2', company: 'CloudForge', confidence: 85 }),
  makePerson({ id: 'p3', company: 'CloudForge', verification: 'needs_verification', confidence: 60 }),
];

describe('buildPeopleAnswer', () => {
  it('leads with the real total, not the page size', () => {
    const answer = buildPeopleAnswer({
      question: 'verified marketing managers in Germany',
      filters: withFilters({ verification: 'verified', countries: ['Germany'] }),
      matches,
      total: 214,
    });
    expect(answer).toContain('214');
  });

  it('names how the question was read', () => {
    const answer = buildPeopleAnswer({
      question: 'verified marketing managers in Germany',
      filters: withFilters({
        titles: ['Marketing Manager'],
        verification: 'verified',
        countries: ['Germany'],
      }),
      matches,
      total: 214,
    });
    expect(answer).toContain('Germany');
    expect(answer).toContain('Marketing Manager');
  });

  it('reports verified share and average confidence over the matches', () => {
    const answer = buildPeopleAnswer({
      question: 'anything',
      filters: emptyPeopleFilters(),
      matches,
      total: 3,
    });
    expect(answer).toContain('2 have a verified work email');
    expect(answer).toMatch(/average confidence (?:is )?79%/);
  });

  it('mentions the most common companies', () => {
    const answer = buildPeopleAnswer({
      question: 'anything',
      filters: emptyPeopleFilters(),
      matches,
      total: 3,
    });
    expect(answer).toContain('CloudForge');
  });

  it('gives the specced empty-state sentence when nothing matches', () => {
    const answer = buildPeopleAnswer({
      question: 'verified marketing managers in Atlantis',
      filters: withFilters({ verification: 'verified', minConfidence: 90 }),
      matches: [],
      total: 0,
    });
    expect(answer).toContain('No contacts match');
    expect(answer).toContain('verification');
    expect(answer).toContain('confidence');
  });

  it('never emits snake_case enum values', () => {
    const answer = buildPeopleAnswer({
      question: 'unverified licensed records',
      filters: withFilters({ verification: 'needs_verification', sources: ['licensed_dataset'] }),
      matches,
      total: 12,
    });
    expect(answer).not.toContain('needs_verification');
    expect(answer).not.toContain('licensed_dataset');
  });

  it('is a single trimmed paragraph-set with no trailing whitespace', () => {
    const answer = buildPeopleAnswer({
      question: 'anything',
      filters: emptyPeopleFilters(),
      matches,
      total: 3,
    });
    expect(answer).toBe(answer.trim());
    expect(answer.length).toBeGreaterThan(0);
  });
});

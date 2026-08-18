import { describe, expect, it } from 'vitest';
import { classify } from '@/lib/assistant/classify';
import type { AssistantEntity } from '@/lib/assistant/types';

describe('classify — entity resolution', () => {
  const cases: Array<[string, AssistantEntity]> = [
    // Plain, unambiguous.
    ['what conferences are in Berlin next month', 'events'],
    ['show me SaaS companies in Germany', 'companies'],
    ['find me VPs of marketing', 'people'],
    ['upcoming expos in Q1', 'events'],
    ['startups with 50-200 employees', 'companies'],
    ['verified contacts with email', 'people'],

    // The deliverable noun wins over the qualifier.
    ['companies exhibiting at SaaStr', 'companies'],
    ['events where NovaAI is exhibiting', 'events'],
    ['CMOs at companies attending Web Summit', 'people'],
    ['find me people at companies going to Web Summit', 'people'],
    ['show me trade shows where Siemens has a booth', 'events'],
  ];

  it.each(cases)('classifies %j as %s', (message, expected) => {
    expect(classify(message).winner).toBe(expected);
  });

  it('returns a null winner when no signal is present', () => {
    const result = classify('hello there');
    expect(result.winner).toBeNull();
    expect(result.margin).toBe(0);
  });

  it('reports a narrow margin when two entities tie', () => {
    // "companies" and "contacts" are both head-weighted deliverable nouns.
    const result = classify('companies and contacts');
    expect(result.margin).toBeLessThan(0.34);
  });

  it('reports a clear margin for an unambiguous question', () => {
    expect(classify('what trade shows are happening in Munich').margin).toBeGreaterThan(0.5);
  });

  it('is case-insensitive', () => {
    expect(classify('SHOW ME COMPANIES IN FRANCE').winner).toBe('companies');
  });

  it('matches multi-word signals', () => {
    expect(classify('list trade shows in Paris').winner).toBe('events');
  });

  it('does not match a signal inside a longer word', () => {
    // "leader" must not match the people signal "lead".
    expect(classify('leader').winner).toBeNull();
  });
});

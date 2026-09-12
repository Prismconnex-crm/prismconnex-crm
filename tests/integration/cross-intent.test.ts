import { describe, expect, it } from 'vitest';
import { buildHandoffUrl, classifyAskDomain, decideCrossIntent } from '@/lib/search/cross-intent';

describe('decideCrossIntent', () => {
  it('hands a company question typed on Events over to Companies', () => {
    const decision = decideCrossIntent('List 100 IT companies in India', 'events');
    expect(decision).toMatchObject({ kind: 'handoff', target: 'companies' });
  });

  it('hands an event question typed on Companies over to Events', () => {
    const decision = decideCrossIntent(
      'Medical & Healthcare events in Germany Hamburg April 2027',
      'companies'
    );
    expect(decision).toMatchObject({ kind: 'handoff', target: 'events' });
  });

  it('stays put when the question already belongs to the current page', () => {
    expect(decideCrossIntent('fintech companies in India', 'companies').kind).toBe('stay');
    expect(decideCrossIntent('packaging expos in Asia-Pacific', 'events').kind).toBe('stay');
  });

  it('stays put when both domains are mentioned', () => {
    // Answering "companies exhibiting at SaaStr" on Events would be wrong, but
    // so would throwing away the rail the user is looking at on a near-tie.
    expect(decideCrossIntent('companies exhibiting at trade shows', 'companies').kind).toBe('stay');
  });

  it('stays put on a question with no signal at all', () => {
    expect(decideCrossIntent('India', 'companies')).toEqual({ kind: 'stay', reason: 'no-signal' });
    expect(decideCrossIntent('   ', 'events')).toEqual({ kind: 'stay', reason: 'no-signal' });
  });

  it('stays put when the winner is People, which has nothing to hand off to', () => {
    expect(decideCrossIntent('CTOs and decision makers', 'companies').kind).toBe('stay');
  });

  it('encodes the question into the destination URL', () => {
    expect(buildHandoffUrl('events', 'expos in Germany & Austria', 'companies')).toBe(
      '/app/events?ask=expos+in+Germany+%26+Austria&from=companies'
    );
  });
});

describe('classifyAskDomain (Dashboard router)', () => {
  it('routes a company question to Companies', () => {
    expect(classifyAskDomain('List 100 IT companies in India').domain).toBe('companies');
  });

  it('routes an event question to Events', () => {
    expect(
      classifyAskDomain('Medical & Healthcare events in Germany Hamburg April 2027').domain
    ).toBe('events');
  });

  it('always commits — there is no "stay" on a page that owns no data', () => {
    for (const question of ['India', 'top 20', 'anything at all', '']) {
      expect(['companies', 'events']).toContain(classifyAskDomain(question).domain);
    }
  });

  it('falls back to Companies when nothing scores', () => {
    expect(classifyAskDomain('India')).toEqual({ domain: 'companies', confidence: 0 });
  });

  it('breaks an exact tie with the ambiguous word lists', () => {
    // No signal word on either side, so the month is all there is to go on.
    expect(classifyAskDomain('anything in April 2027').domain).toBe('events');
  });

  it('keeps a date from overriding a real signal word', () => {
    // "April 2027" is an events tiebreaker, but it never gets consulted:
    // "companies" scores outright, so a dated company question stays put.
    expect(classifyAskDomain('companies in Hamburg founded before April 2027').domain).toBe(
      'companies'
    );
  });

  it('reports zero confidence for a coin flip and non-zero for a clear win', () => {
    expect(classifyAskDomain('India').confidence).toBe(0);
    expect(classifyAskDomain('trade shows in Hamburg').confidence).toBeGreaterThan(0);
  });
});

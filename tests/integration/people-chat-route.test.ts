import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/people/chat/route';
import {
  createPeopleChatStream,
  resetPeopleRateLimiter,
  type PeopleChatEvent,
} from '@/lib/people/chat-stream';

function post(body: unknown, ip = '10.0.0.1') {
  return new Request('http://localhost/api/people/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  }) as never;
}

async function readEvents(stream: ReadableStream<Uint8Array> | null): Promise<PeopleChatEvent[]> {
  if (!stream) return [];
  const text = await new Response(stream).text();
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as PeopleChatEvent);
}

beforeEach(() => {
  resetPeopleRateLimiter();
});

describe('POST /api/people/chat', () => {
  it('emits filters, then results, then tokens, then done — in that order', async () => {
    const response = await POST(post({ message: 'verified marketing managers in Germany' }));
    expect(response.status).toBe(200);

    const events = await readEvents(response.body);
    const types = events.map((event) => event.type);

    expect(types[0]).toBe('filters');
    expect(types[1]).toBe('results');
    expect(types).toContain('token');
    expect(types[types.length - 1]).toBe('done');
    // No prose may precede the results.
    expect(types.indexOf('token')).toBeGreaterThan(types.indexOf('results'));
  });

  it('parses the question into filters and chips', async () => {
    const events = await readEvents(
      (await POST(post({ message: 'verified marketing managers in Germany' }))).body
    );
    const first = events[0];

    expect(first.type).toBe('filters');
    if (first.type !== 'filters') throw new Error('expected filters event');
    expect(first.filters.verification).toBe('verified');
    expect(first.filters.countries).toEqual(['Germany']);
    expect(first.chips.map((chip) => `${chip.label}: ${chip.value}`)).toContain(
      'Verification: Verified'
    );
  });

  it('caps the inline results at 10 while reporting the true total', async () => {
    const events = await readEvents((await POST(post({ message: 'verified contacts' }))).body);
    const results = events.find((event) => event.type === 'results');

    expect(results?.type).toBe('results');
    if (results?.type !== 'results') throw new Error('expected results event');
    expect(results.results.length).toBeLessThanOrEqual(10);
    expect(results.total).toBeGreaterThan(10);
  });

  it('answers with no ANTHROPIC_API_KEY set', async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const events = await readEvents(
        (await POST(post({ message: 'verified marketing managers in Germany' }))).body
      );
      const prose = events
        .filter((event) => event.type === 'token')
        .map((event) => (event.type === 'token' ? event.text : ''))
        .join('');

      expect(prose.length).toBeGreaterThan(0);
      expect(prose).toContain('Found');
      expect(events[events.length - 1].type).toBe('done');
    } finally {
      if (original === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = original;
    }
  });

  it('narrows using the filters already applied in the rail', async () => {
    const wide = await readEvents((await POST(post({ message: 'managers' }))).body);
    const narrow = await readEvents(
      (
        await POST(
          post({
            message: 'managers',
            activeFilters: { countries: ['Germany'] },
          })
        )
      ).body
    );

    const totalOf = (events: PeopleChatEvent[]) => {
      const results = events.find((event) => event.type === 'results');
      return results?.type === 'results' ? results.total : -1;
    };

    expect(totalOf(narrow)).toBeGreaterThan(0);
    expect(totalOf(narrow)).toBeLessThan(totalOf(wide));
  });

  it('streams the empty-result message rather than erroring', async () => {
    const events = await readEvents(
      (await POST(post({ message: 'contacts in Atlantis with >= 90% confidence' }))).body
    );
    const results = events.find((event) => event.type === 'results');
    const prose = events
      .filter((event) => event.type === 'token')
      .map((event) => (event.type === 'token' ? event.text : ''))
      .join('');

    if (results?.type !== 'results') throw new Error('expected results event');
    expect(results.results).toEqual([]);
    expect(prose).toContain('No contacts match');
    expect(events[events.length - 1].type).toBe('done');
  });

  it('rejects an empty message with 400', async () => {
    expect((await POST(post({ message: '   ' }))).status).toBe(400);
    expect((await POST(post({}))).status).toBe(400);
  });

  it('rate limits a burst from one IP', async () => {
    let limited = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await POST(post({ message: 'verified contacts' }, '10.0.0.99'));
      const events = await readEvents(response.body);
      const error = events.find((event) => event.type === 'error');
      if (error?.type === 'error' && error.code === 'rate_limited') {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });

  it('does not rate limit a different IP', async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await readEvents((await POST(post({ message: 'verified contacts' }, '10.0.0.50'))).body);
    }
    const events = await readEvents(
      (await POST(post({ message: 'verified contacts' }, '10.0.0.51'))).body
    );
    expect(events.some((event) => event.type === 'error')).toBe(false);
  });
});

describe('createPeopleChatStream', () => {
  it('falls back to templated prose when the generator fails mid-flight', async () => {
    async function* halfBrokenGenerator() {
      yield 'Partial answer';
      throw new Error('upstream 401');
    }

    const events = await readEvents(
      createPeopleChatStream({
        message: 'verified marketing managers in Germany',
        generateAnswer: () => halfBrokenGenerator(),
      })
    );

    const prose = events
      .filter((event) => event.type === 'token')
      .map((event) => (event.type === 'token' ? event.text : ''))
      .join('');

    // The partial text survives, the templated answer completes it, and the
    // user sees an answer rather than an error.
    expect(prose).toContain('Partial answer');
    expect(prose).toContain('Found');
    expect(events.some((event) => event.type === 'error')).toBe(false);
    expect(events[events.length - 1].type).toBe('done');
  });

  it('falls back when the generator fails before emitting anything', async () => {
    async function* deadGenerator(): AsyncIterable<string> {
      throw new Error('upstream 401');
      // eslint-disable-next-line no-unreachable
      yield '';
    }

    const events = await readEvents(
      createPeopleChatStream({
        message: 'verified contacts',
        generateAnswer: () => deadGenerator(),
      })
    );

    const prose = events
      .filter((event) => event.type === 'token')
      .map((event) => (event.type === 'token' ? event.text : ''))
      .join('');

    expect(prose).toContain('Found');
    expect(events[events.length - 1].type).toBe('done');
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/assistant/chat/route';
import { resetAssistantRateLimiter } from '@/lib/assistant/rate-limit';
import { adapterFor, resetAdapters, setAdapterForTests } from '@/lib/assistant/registry';
import type { AssistantEvent } from '@/lib/assistant/types';

function post(body: unknown, ip = '10.0.0.1') {
  return new Request('http://localhost/api/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  }) as never;
}

async function read(stream: ReadableStream<Uint8Array> | null): Promise<AssistantEvent[]> {
  if (!stream) return [];
  const text = await new Response(stream).text();
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as AssistantEvent);
}

beforeEach(() => {
  resetAssistantRateLimiter();
  // The suite must never dial a database. Companies is the only adapter with a
  // real backend, so its search is stubbed at the registry seam.
  const real = adapterFor('companies');
  setAdapterForTests('companies', {
    ...real,
    search: async () => ({ rows: [], total: null }),
  } as never);
});

afterEach(() => {
  resetAdapters();
});

describe('POST /api/assistant/chat', () => {
  it('streams NDJSON with a route event first', async () => {
    const response = await POST(post({ message: 'people in Germany', currentPage: 'people' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/x-ndjson');

    const events = await read(response.body);
    expect(events[0].type).toBe('route');
    expect(events[events.length - 1].type).toBe('done');
  });

  it('rejects a missing message', async () => {
    const response = await POST(post({ currentPage: 'people' }));
    expect(response.status).toBe(400);
  });

  it('rejects an unknown currentPage', async () => {
    const response = await POST(post({ message: 'hi', currentPage: 'invoices' }));
    expect(response.status).toBe(400);
  });

  it('defaults currentPage to companies when it is absent', async () => {
    const response = await POST(post({ message: 'hello' }));
    expect(response.status).toBe(200);
    const events = await read(response.body);
    const first = events[0];
    if (first.type !== 'route') throw new Error('expected route event');
    expect(first.targetEntity).toBe('companies');
  });

  it('delivers a rate-limit refusal as a stream event, not an HTTP error', async () => {
    let last: Response | null = null;
    for (let i = 0; i < 22; i += 1) {
      last = await POST(post({ message: 'people in Germany', currentPage: 'people' }, '10.9.9.9'));
    }
    expect(last?.status).toBe(200);

    const events = await read(last?.body ?? null);
    const error = events.find((e) => e.type === 'error');
    if (error?.type !== 'error') throw new Error('expected a rate_limited error event');
    expect(error.code).toBe('rate_limited');
  });
});

import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/events/search/route';

function post(body: unknown) {
  return new Request('http://localhost/api/events/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

describe('POST /api/events/search', () => {
  it('returns the first page of matches', async () => {
    const response = await POST(post({ filters: { country: 'France' }, page: 1 }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.events).toHaveLength(25);
    expect(json.totalMatched).toBeGreaterThan(25);
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(25);
  });

  it('pages without overlapping the previous page', async () => {
    const first = await (await POST(post({ filters: { country: 'France', limit: 10 }, page: 1 }))).json();
    const second = await (await POST(post({ filters: { country: 'France', limit: 10 }, page: 2 }))).json();

    const firstSlugs = new Set(first.events.map((event: { slug: string }) => event.slug));
    for (const event of second.events) {
      expect(firstSlugs.has(event.slug)).toBe(false);
    }
  });

  it('uses the requested limit as the page size', async () => {
    const response = await POST(post({ filters: { country: 'France', limit: 50 }, page: 1 }));
    const json = await response.json();
    expect(json.pageSize).toBe(50);
    expect(json.events).toHaveLength(50);
  });

  it('returns an empty page past the end without erroring', async () => {
    const response = await POST(post({ filters: { country: 'France', limit: 10 }, page: 9999 }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.events).toHaveLength(0);
    expect(json.totalMatched).toBeGreaterThan(0);
  });

  it('rejects a page below 1', async () => {
    const response = await POST(post({ filters: { country: 'France' }, page: 0 }));
    expect(response.status).toBe(400);
  });

  it('rejects a missing filters object', async () => {
    const response = await POST(post({ page: 1 }));
    expect(response.status).toBe(400);
  });
});

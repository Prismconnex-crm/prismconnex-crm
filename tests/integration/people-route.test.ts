import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/people/route';

function get(query: string) {
  return new Request(`http://localhost/api/people${query}`) as never;
}

describe('GET /api/people', () => {
  it('returns a first page with dataset-wide stats', async () => {
    const response = await GET(get(''));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(25);
    expect(json.results).toHaveLength(25);
    expect(json.total).toBe(2418);
    expect(json.totalPages).toBe(Math.ceil(2418 / 25));
    expect(json.stats.total).toBe(2418);
    expect(json.stats.avgConfidence).toBe(84);
  });

  it('filters by country and verification together', async () => {
    const response = await GET(get('?country=Germany&verification=verified'));
    const json = await response.json();

    expect(json.total).toBeGreaterThan(0);
    expect(json.total).toBeLessThan(2418);
    for (const person of json.results) {
      expect(person.country).toBe('Germany');
      expect(person.verification).toBe('verified');
    }
  });

  it('answers the spec worked example with rows', async () => {
    const response = await GET(get('?title=Marketing%20Manager&verification=verified&country=Germany'));
    const json = await response.json();
    expect(json.total).toBeGreaterThan(0);
  });

  it('keeps stats dataset-wide while total is the filtered count', async () => {
    const json = await (await GET(get('?country=Germany'))).json();
    expect(json.stats.total).toBe(2418);
    expect(json.total).toBeLessThan(2418);
  });

  it('returns facet counts for every filter group', async () => {
    const json = await (await GET(get(''))).json();
    for (const key of [
      'titles', 'seniorities', 'departments', 'companies', 'locations', 'countries',
      'headcounts', 'industries', 'keywords', 'buyingIntents', 'sources', 'verification',
    ]) {
      expect(Array.isArray(json.facets[key]), `${key} facet missing`).toBe(true);
      expect(json.facets[key].length, `${key} facet empty`).toBeGreaterThan(0);
    }
  });

  it('pages without overlapping the previous page', async () => {
    const first = await (await GET(get('?pageSize=10&page=1'))).json();
    const second = await (await GET(get('?pageSize=10&page=2'))).json();

    const firstIds = new Set(first.results.map((person: { id: string }) => person.id));
    for (const person of second.results) {
      expect(firstIds.has(person.id)).toBe(false);
    }
  });

  it('returns an empty page past the end without erroring', async () => {
    const response = await GET(get('?pageSize=10&page=99999'));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.results).toEqual([]);
    expect(json.total).toBe(2418);
  });

  it('returns an empty result set rather than an error when nothing matches', async () => {
    const json = await (await GET(get('?country=Atlantis'))).json();
    expect(json.total).toBe(0);
    expect(json.results).toEqual([]);
    expect(json.totalPages).toBe(0);
  });

  it('clamps pageSize to at most 100', async () => {
    const json = await (await GET(get('?pageSize=5000'))).json();
    expect(json.pageSize).toBe(100);
    expect(json.results).toHaveLength(100);
  });

  it('rejects a page below 1', async () => {
    const response = await GET(get('?page=0'));
    expect(response.status).toBe(400);
  });

  it('ranks by similarity when a lookalike seed is supplied', async () => {
    const seedId = (await (await GET(get('?pageSize=1'))).json()).results[0].id;
    const json = await (await GET(get(`?lookalike=${seedId}&pageSize=5`))).json();

    expect(json.results.map((person: { id: string }) => person.id)).not.toContain(seedId);
    expect(json.results.length).toBeGreaterThan(0);
  });
});

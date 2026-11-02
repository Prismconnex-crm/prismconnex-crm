import { beforeEach, describe, expect, it, vi } from 'vitest';

// Only the session and the Prisma client are faked; the route handlers are real.
const mocks = vi.hoisted(() => ({
  getSessionPayload: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock('@/lib/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session')>()),
  getSessionPayload: mocks.getSessionPayload,
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    eventExhibitor: { count: mocks.count, findMany: mocks.findMany, findUnique: mocks.findUnique },
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  },
}));

import { GET as list } from '@/app/api/exhibitors/route';
import { GET as profile } from '@/app/api/exhibitors/[id]/route';

const SLUG = 'aapex-las-vegas-nv-2026-11-03';
const get = (query: string) => list(new Request(`http://localhost/api/exhibitors?${query}`));

function row(i: number) {
  return {
    id: `ex${i}`,
    eventSlug: SLUG,
    companyName: `Company ${i}`,
    logoUrl: null,
    standNumber: `A${i}`,
    sourceDetailUrl: `https://example.com/ex/${i}`,
    sourceDirectoryUrl: null,
    websiteUrl: null,
    country: null,
    phone: null,
    companyLinkedInUrl: null,
    description: null,
    categories: [],
    firstName: null,
    lastName: null,
    designation: null,
    email: null,
    personLinkedInUrl: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionPayload.mockResolvedValue({ sub: 'u1', email: 'demo@prismconnex.com' });
  mocks.count.mockResolvedValue(50);
  mocks.findMany.mockResolvedValue(Array.from({ length: 24 }, (_, i) => row(i)));
});

describe('GET /api/exhibitors', () => {
  it('refuses a signed-out caller without touching the database', async () => {
    mocks.getSessionPayload.mockResolvedValue(null);
    const res = await get(`eventSlug=${SLUG}&page=1`);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/sign in/i);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it('reads only the opened event, 24 a page by default', async () => {
    const res = await get(`eventSlug=${SLUG}&page=2`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const args = mocks.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ eventSlug: SLUG });
    expect(args.skip).toBe(24);
    expect(args.take).toBe(24);
    expect(body.items).toHaveLength(24);
    expect(body.totalPages).toBe(3);
    expect(body.imported).toBe(50);
  });

  it('searches company names within the event and keeps the event total as `imported`', async () => {
    mocks.count.mockImplementation(({ where }) => Promise.resolve(where.OR ? 3 : where.NOT ? 0 : 50));
    const body = await (await get(`eventSlug=${SLUG}&page=1&q=bosch`)).json();
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.eventSlug).toBe(SLUG);
    expect(where.OR).toContainEqual({ companyName: { contains: 'bosch', mode: 'insensitive' } });
    expect(body.totalCount).toBe(3);
    expect(body.imported).toBe(50);
  });

  it('sorts by name ascending by default and descending on request, with a stable tiebreak', async () => {
    await get(`eventSlug=${SLUG}&page=1`);
    expect(mocks.findMany.mock.calls[0][0].orderBy).toEqual([{ companyName: 'asc' }, { id: 'asc' }]);

    const body = await (await get(`eventSlug=${SLUG}&page=1&dir=desc`)).json();
    expect(mocks.findMany.mock.calls[1][0].orderBy).toEqual([{ companyName: 'desc' }, { id: 'desc' }]);
    expect(body.dir).toBe('desc');
  });

  it('treats an unknown direction as ascending', async () => {
    await get(`eventSlug=${SLUG}&page=1&dir=sideways`);
    expect(mocks.findMany.mock.calls[0][0].orderBy[0]).toEqual({ companyName: 'asc' });
  });

  it('still requires an event slug', async () => {
    expect((await get('page=1')).status).toBe(400);
  });
});

describe('GET /api/exhibitors/[id]', () => {
  it('refuses a signed-out caller', async () => {
    mocks.getSessionPayload.mockResolvedValue(null);
    const res = await profile(new Request('http://localhost/api/exhibitors/ex1'), { params: { id: 'ex1' } });
    expect(res.status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('serves a signed-in caller', async () => {
    mocks.findUnique.mockResolvedValue(row(1));
    const res = await profile(new Request('http://localhost/api/exhibitors/ex1'), { params: { id: 'ex1' } });
    expect(res.status).toBe(200);
  });
});

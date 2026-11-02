import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RETURN_TO_QUERY_PARAM, safeReturnTo, signInHrefReturningTo } from '@/lib/auth/return-to';
import { crmExhibitorDetailsPath, readReturnedExhibitor, withoutReturnedExhibitor } from '@/lib/exhibitors/crm-return';
import { findShowEvents } from '@/lib/find-shows/catalog';

// Only the session and the Prisma client are faked; the resolve route is real.
const mocks = vi.hoisted(() => ({ getSessionPayload: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() }));

vi.mock('@/lib/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session')>()),
  getSessionPayload: mocks.getSessionPayload,
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: { eventExhibitor: { findFirst: mocks.findFirst, findMany: mocks.findMany } },
}));

import { GET as resolve } from '@/app/api/exhibitors/resolve/route';

const AAPEX = 'aapex-las-vegas-nv-2026-11-03';
const PROFILE = 'https://aapex2026.mapyourshow.com/8_0/exhibitor/exhibitor-details.cfm?exhid=26731';

/** Where the sign-in page sends the visitor afterwards, as it reads its own address. */
const afterSignIn = (href: string) => safeReturnTo(new URL(href, 'https://prismconnex.example').searchParams.get(RETURN_TO_QUERY_PARAM));

describe('public "View details" → sign-in → CRM event page', () => {
  it('lands on the CRM event, Exhibitors tab, carrying the exact exhibitor — never the public page', () => {
    const path = crmExhibitorDetailsPath(AAPEX, { profileUrl: PROFILE, name: '360insights' })!;
    const back = afterSignIn(signInHrefReturningTo(path))!;
    expect(back).toBe(path);
    const url = new URL(back, 'https://prismconnex.example');
    expect(url.pathname).toBe(`/app/events/${AAPEX}`);
    expect(url.pathname).not.toMatch(/find-shows/);
    expect(url.searchParams.get('tab')).toBe('Exhibitors');
    expect(readReturnedExhibitor(url.search)).toEqual({ profileUrl: PROFILE, name: '360insights' });
  });

  it('works for every catalog event', () => {
    for (const event of findShowEvents) {
      const path = crmExhibitorDetailsPath(event.slug, { name: 'Acme GmbH' });
      expect(path, event.slug).not.toBeNull();
      expect(afterSignIn(signInHrefReturningTo(path!))).toBe(path);
    }
  });

  it('refuses an event slug or exhibitor that does not check out', () => {
    expect(crmExhibitorDetailsPath('../admin', { name: 'Acme' })).toBeNull();
    expect(crmExhibitorDetailsPath('AAPEX 2026', { name: 'Acme' })).toBeNull();
    expect(crmExhibitorDetailsPath(AAPEX, {})).toBeNull();
    expect(crmExhibitorDetailsPath(AAPEX, { name: '   ' })).toBeNull();
    expect(crmExhibitorDetailsPath(AAPEX, { name: 'x'.repeat(201) })).toBeNull();
    // A non-web profile link is dropped; the name alone still makes the address.
    const path = crmExhibitorDetailsPath(AAPEX, { profileUrl: 'javascript:alert(1)', name: 'Acme' })!;
    expect(readReturnedExhibitor(new URL(path, 'https://x.example').search)).toEqual({ profileUrl: null, name: 'Acme' });
  });

  it('reads nothing from an address without a valid exhibitor, and strips only the exhibitor', () => {
    expect(readReturnedExhibitor('?tab=Exhibitors')).toBeNull();
    expect(readReturnedExhibitor('?exhibitorUrl=ftp://x.example/a')).toBeNull();
    expect(withoutReturnedExhibitor('/app/events/x', '?tab=Exhibitors&exhibitorUrl=https%3A%2F%2Fa.example&exhibitorName=A&page=2')).toBe(
      '/app/events/x?tab=Exhibitors&page=2'
    );
    expect(withoutReturnedExhibitor('/app/events/x', '?exhibitorName=A')).toBe('/app/events/x');
  });
});

describe('GET /api/exhibitors/resolve', () => {
  const get = (query: string) => resolve(new Request(`http://localhost/api/exhibitors/resolve?${query}`));
  const row = { id: 'crm-1', eventSlug: AAPEX, companyName: '360insights', sourceDetailUrl: PROFILE, categories: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionPayload.mockResolvedValue({ sub: 'u1' });
    mocks.findFirst.mockResolvedValue(null);
    mocks.findMany.mockResolvedValue([]);
  });

  it('refuses a signed-out caller without touching the database', async () => {
    mocks.getSessionPayload.mockResolvedValue(null);
    expect((await get(`eventSlug=${AAPEX}&exhibitorName=360insights`)).status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('validates the event and the exhibitor', async () => {
    expect((await get('eventSlug=../x&exhibitorName=A')).status).toBe(400);
    expect((await get(`eventSlug=${AAPEX}`)).status).toBe(400);
  });

  it('matches the directory profile URL within the event first', async () => {
    mocks.findFirst.mockResolvedValue(row);
    const body = await (await get(`eventSlug=${AAPEX}&exhibitorUrl=${encodeURIComponent(PROFILE)}&exhibitorName=360insights`)).json();
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { eventSlug: AAPEX, sourceDetailUrl: PROFILE } });
    expect(body).toMatchObject({ matchedBy: 'profile', exhibitor: { id: 'crm-1', name: '360insights' } });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('falls back to a name that names exactly one row of the event', async () => {
    mocks.findMany.mockResolvedValueOnce([row]);
    const body = await (await get(`eventSlug=${AAPEX}&exhibitorUrl=${encodeURIComponent('https://other.example/p/1')}&exhibitorName=360insights`)).json();
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ eventSlug: AAPEX, nameKey: '360insights' });
    expect(body).toMatchObject({ matchedBy: 'name', exhibitor: { id: 'crm-1' } });
  });

  it('never guesses between two rows with the same name', async () => {
    mocks.findMany.mockResolvedValue([row, { ...row, id: 'crm-2' }]);
    const body = await (await get(`eventSlug=${AAPEX}&exhibitorName=360insights`)).json();
    expect(body).toEqual({ exhibitor: null, matchedBy: null });
  });
});

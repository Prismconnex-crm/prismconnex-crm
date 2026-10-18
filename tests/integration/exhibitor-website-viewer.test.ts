import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), fetcher: vi.fn() }));

vi.mock('@/lib/db/prisma', () => ({ prisma: { eventExhibitor: { findUnique: mocks.findUnique } } }));
vi.mock('@/lib/find-shows/floor-plan-discovery', () => ({ httpFetcher: mocks.fetcher }));

import { GET } from '@/app/api/exhibitors/frame/route';
import { officialViewMode } from '@/lib/find-shows/official-frame';
import {
  closedWebsiteViewer,
  exhibitorViewerUrl,
  knownFrameRefusal,
  openWebsiteViewer,
  safeWebsiteUrl,
  usesInAppWebsiteViewer,
} from '@/lib/exhibitors/website-viewer';

const AAPEX = 'aapex-las-vegas-nv-2026-11-03';
const PROFILE = 'https://aapex2026.mapyourshow.com/8_0/exhibitor/exhibitor-details.cfm?exhid=24231';
const DIRECTORY = 'https://aapex2026.mapyourshow.com/8_0/explore/exhibitor-gallery.cfm?featured=false';

describe('in-app website viewer: scope', () => {
  it('is on for AAPEX only; every other event keeps its external link', () => {
    expect(usesInAppWebsiteViewer(AAPEX)).toBe(true);
    expect(usesInAppWebsiteViewer('bett-show-london-2027-01-20')).toBe(false);
    expect(usesInAppWebsiteViewer('aapex-las-vegas-nv-2025-11-04')).toBe(false);
  });
});

describe('in-app website viewer: URL validation', () => {
  it('accepts plain http and https addresses', () => {
    expect(safeWebsiteUrl('https://www.bosch.com/')).toBe('https://www.bosch.com/');
    expect(safeWebsiteUrl('  http://example.com/path?q=1  ')).toBe('http://example.com/path?q=1');
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///C:/Windows/win.ini',
    'blob:https://example.com/123',
    'ftp://example.com/',
    'vbscript:msgbox(1)',
    'https://user:secret@example.com/',
    'www.example.com',
    '/relative/path',
    '',
    '   ',
  ])('rejects %j', (raw) => {
    expect(safeWebsiteUrl(raw)).toBeNull();
  });

  it('knows Map Your Show refuses framing, on any of its subdomains, and nothing else', () => {
    expect(knownFrameRefusal(PROFILE)).toMatch(/Content-Security-Policy/);
    expect(knownFrameRefusal('https://mapyourshow.com/')).not.toBeNull();
    expect(knownFrameRefusal('https://www.bosch.com/')).toBeNull();
    expect(knownFrameRefusal('https://notmapyourshow.com/')).toBeNull();
  });

  it('rejects null and undefined', () => {
    expect(safeWebsiteUrl(null)).toBeNull();
    expect(safeWebsiteUrl(undefined)).toBeNull();
  });

  it('shows the same page the link opened before: website → profile → directory, skipping unsafe ones', () => {
    expect(exhibitorViewerUrl({ website: 'https://www.bosch.com/', profileUrl: PROFILE, directoryUrl: DIRECTORY })).toBe('https://www.bosch.com/');
    expect(exhibitorViewerUrl({ website: null, profileUrl: PROFILE, directoryUrl: DIRECTORY })).toBe(PROFILE);
    expect(exhibitorViewerUrl({ website: 'javascript:alert(1)', profileUrl: PROFILE })).toBe(PROFILE);
    expect(exhibitorViewerUrl({ website: null, profileUrl: null, directoryUrl: DIRECTORY })).toBe(DIRECTORY);
    expect(exhibitorViewerUrl({ website: 'data:x', profileUrl: 'javascript:x', directoryUrl: null })).toBeNull();
  });
});

describe('in-app website viewer: opening and closing', () => {
  it('opens on the exhibitor, with its name and address for the header', () => {
    expect(openWebsiteViewer({ id: 'row-1', name: 'ABA USA LLC', website: null, profileUrl: PROFILE })).toEqual({
      exhibitorId: 'row-1',
      name: 'ABA USA LLC',
      url: PROFILE,
    });
  });

  it('stays closed for an exhibitor without a safe address', () => {
    expect(openWebsiteViewer({ id: 'row-2', name: 'Nowhere Inc', website: 'javascript:alert(1)' })).toBeNull();
  });

  it('closing is the closed state, holding nothing of the tab (search, sort, scroll stay in the list)', () => {
    expect(closedWebsiteViewer).toBeNull();
  });
});

describe('in-app website viewer: framing decision and fallback', () => {
  const request = (id: string | null) =>
    new Request(`http://localhost:3000/api/exhibitors/frame${id === null ? '' : `?id=${encodeURIComponent(id)}`}`);
  const row = (overrides: Record<string, unknown> = {}) => ({
    eventSlug: AAPEX,
    websiteUrl: null,
    sourceDetailUrl: PROFILE,
    sourceDirectoryUrl: DIRECTORY,
    ...overrides,
  });
  const answer = (status: number, headers: Record<string, string> = {}, url = PROFILE) => ({ status, url, headers, body: '' });
  let n = 0;
  // Each test frames a fresh address so the route's short verdict cache never answers for another test.
  const freshSite = () => `https://exhibitor-${(n += 1)}.example.com/`;

  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.fetcher.mockReset();
  });

  it('frames a site that sets no framing restriction', async () => {
    const site = freshSite();
    mocks.findUnique.mockResolvedValue(row({ websiteUrl: site }));
    mocks.fetcher.mockResolvedValue(answer(200, {}, site));
    const body = await (await GET(request('row-1'))).json();
    expect(body).toEqual({ url: site, frame: 'allowed', reason: null });
    expect(officialViewMode(body.frame)).toBe('frame');
    expect(mocks.fetcher).toHaveBeenCalledWith(site, expect.anything());
  });

  it('falls back (no empty frame) when the site sends X-Frame-Options', async () => {
    const site = freshSite();
    mocks.findUnique.mockResolvedValue(row({ websiteUrl: site }));
    mocks.fetcher.mockResolvedValue(answer(200, { 'x-frame-options': 'SAMEORIGIN' }, site));
    const body = await (await GET(request('row-1'))).json();
    expect(body.frame).toBe('blocked');
    expect(body.reason).toMatch(/X-Frame-Options/);
    expect(officialViewMode(body.frame)).toBe('fallback');
  });

  it("falls back when the site's CSP frame-ancestors excludes Prismconnex", async () => {
    const site = freshSite();
    mocks.findUnique.mockResolvedValue(row({ websiteUrl: site }));
    mocks.fetcher.mockResolvedValue(answer(200, { 'content-security-policy': "frame-ancestors 'self' https://partner.example" }, site));
    const body = await (await GET(request('row-1'))).json();
    expect(body.frame).toBe('blocked');
    expect(body.reason).toMatch(/Content-Security-Policy/);
  });

  it("explains at once for AAPEX's Map Your Show profiles, whose verified CSP refusal servers cannot see", async () => {
    mocks.findUnique.mockResolvedValue(row());
    const body = await (await GET(request('row-1'))).json();
    expect(body).toEqual({ url: PROFILE, frame: 'blocked', reason: expect.stringMatching(/Content-Security-Policy/) });
    expect(officialViewMode(body.frame)).toBe('fallback');
    // Known, so the site is not even asked.
    expect(mocks.fetcher).not.toHaveBeenCalled();
  });

  it("tries the frame, with the fallback ready, when bot protection hides an unknown site's answer", async () => {
    const site = freshSite();
    mocks.findUnique.mockResolvedValue(row({ websiteUrl: site }));
    mocks.fetcher.mockResolvedValue(answer(202, {}, site));
    const body = await (await GET(request('row-1'))).json();
    expect(body.frame).toBe('unknown');
    expect(officialViewMode(body.frame)).toBe('try-frame');
  });

  it('tries the frame when the site cannot be reached from the server', async () => {
    const site = freshSite();
    mocks.findUnique.mockResolvedValue(row({ websiteUrl: site }));
    mocks.fetcher.mockRejectedValue(new Error('timed out after 12s'));
    const body = await (await GET(request('row-1'))).json();
    expect(body.frame).toBe('unknown');
  });

  it('only ever checks the stored address; an unsafe stored website falls back to the profile', async () => {
    mocks.findUnique.mockResolvedValue(row({ websiteUrl: 'javascript:alert(1)' }));
    const body = await (await GET(request('row-1'))).json();
    expect(body.url).toBe(PROFILE);
    expect(mocks.fetcher).not.toHaveBeenCalledWith('javascript:alert(1)', expect.anything());
  });

  it('answers 404 for exhibitors of other events, and never fetches anything for them', async () => {
    mocks.findUnique.mockResolvedValue(row({ eventSlug: 'bett-show-london-2027-01-20', websiteUrl: 'https://example.com/' }));
    expect((await GET(request('bett-row'))).status).toBe(404);
    expect(mocks.fetcher).not.toHaveBeenCalled();
  });

  it('answers 404 when no stored address is safe, and 400 without an id', async () => {
    mocks.findUnique.mockResolvedValue(row({ websiteUrl: 'data:x', sourceDetailUrl: 'javascript:x', sourceDirectoryUrl: null }));
    expect((await GET(request('row-1'))).status).toBe(404);
    mocks.findUnique.mockResolvedValue(null);
    expect((await GET(request('missing'))).status).toBe(404);
    expect((await GET(request(null))).status).toBe(400);
    expect(mocks.fetcher).not.toHaveBeenCalled();
  });
});

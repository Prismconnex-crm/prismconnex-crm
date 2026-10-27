import { describe, expect, it } from 'vitest';
import { exhibitorTabLayout } from '@/lib/exhibitors/tab-layout';
import { findShowEventsBySlug } from '@/lib/find-shows/catalog';

const AAPEX = 'aapex-las-vegas-nv-2026-11-03';
const BETT = 'bett-show-london-2027-01-20';

describe('CRM Exhibitors tab layout', () => {
  it('BETT keeps its grid and Companies-page profile', () => {
    expect(exhibitorTabLayout(findShowEventsBySlug[BETT])).toEqual({ grid: 'bett', inAppViewer: false });
  });

  it('AAPEX gets the shared event grid with the in-app website viewer', () => {
    expect(exhibitorTabLayout(findShowEventsBySlug[AAPEX])).toEqual({ grid: 'event', inAppViewer: true });
  });

  it('every other catalog event gets the same shared grid, without the viewer', () => {
    const others = Object.values(findShowEventsBySlug).filter((event) => event.slug !== AAPEX && event.name !== 'BETT SHOW');
    expect(others.length).toBeGreaterThan(11_000);
    const layouts = new Set(others.map((event) => JSON.stringify(exhibitorTabLayout(event))));
    expect(Array.from(layouts)).toEqual([JSON.stringify({ grid: 'event', inAppViewer: false })]);
  });

  it("chooses the viewer by AAPEX's slug, so another AAPEX edition keeps external links", () => {
    expect(exhibitorTabLayout({ name: 'AAPEX', slug: 'aapex-las-vegas-nv-2027-11-02' })).toEqual({ grid: 'event', inAppViewer: false });
  });

  it('the catalog AAPEX record carries the real AAPEX details the header shows', () => {
    const event = findShowEventsBySlug[AAPEX];
    expect(event).toMatchObject({ name: 'AAPEX', startDate: '2026-11-03', organizer: 'William T. Glasgow, Inc.' });
    expect(event.venue).toMatch(/Venetian/);
  });
});

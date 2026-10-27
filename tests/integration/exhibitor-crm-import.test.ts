import { describe, expect, it } from 'vitest';
import { CrmImportRefused, crmRowsFromRecord } from '../../lib/find-shows/exhibitor-crm-import';
import { withCatalogueLinks, withCleanCards, withDisplayLogos, type ExhibitorRecord } from '../../lib/find-shows/exhibitor-resolver';
import type { ExhibitorCard, ExhibitorDirectory } from '../../lib/find-shows/exhibitors';

const AAPEX = 'aapex-las-vegas-nv-2026-11-03';
const DIRECTORY_URL = 'https://aapex2026.mapyourshow.com/8_0/explore/exhibitor-gallery.cfm?featured=false';
const profile = (id: string) => `https://aapex2026.mapyourshow.com/8_0/exhibitor/exhibitor-details.cfm?exhid=${id}`;

function card(id: string, name: string, extra: Partial<ExhibitorCard> = {}): ExhibitorCard {
  return { id, name, logoUrl: null, booths: [], description: null, profileUrl: profile(id), access: 'public', ...extra };
}

/** AAPEX's stored record as the Find Shows Exhibitors tab keeps it (shape of the real store entry). */
function aapexRecord(cards: ExhibitorCard[], overrides: Partial<ExhibitorDirectory> = {}): ExhibitorRecord {
  const verified = {
    status: 'VERIFIED_LIST',
    source: { platform: 'map-your-show', platformLabel: 'Map Your Show', editionLabel: 'AAPEX 2026', directoryUrl: DIRECTORY_URL, loginUrl: null, foundOn: 'https://www.aapexshow.com/' },
    exhibitors: cards,
    reason: null,
    total: cards.length,
    checkedAt: '2026-10-09T12:37:12.058Z',
    ...overrides,
  } as unknown as ExhibitorDirectory;
  return {
    key: 'aapexshow.com|las vegas|2026-11-03',
    edition: { name: 'AAPEX', startDate: '2026-11-03', city: 'Las Vegas, NV', website: 'http://www.aapexshow.com', slugs: [AAPEX] },
    verified,
    lastAttempt: { ...verified, exhibitors: [] },
  };
}

const cards = [
  card('26731', '360insights', { booths: ['V732'], description: '360insights is a partner engagement and business optimization company.' }),
  card('24231', 'ABA USA LLC', { logoUrl: 'https://aapex2026.mapyourshow.com/logos/24231.png', booths: ['V2273'] }),
  card('2001', 'Bosch', { booths: ['V3216', 'V7024'] }),
];

describe('AAPEX public exhibitors → CRM EventExhibitor rows', () => {
  it('maps every public card to one row keyed by its official profile page', () => {
    const rows = crmRowsFromRecord(AAPEX, aapexRecord(cards));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      eventSlug: AAPEX,
      companyName: '360insights',
      nameKey: '360insights',
      logoUrl: null,
      sourceDetailUrl: profile('26731'),
      sourceDirectoryUrl: DIRECTORY_URL,
      standNumber: 'V732',
      description: '360insights is a partner engagement and business optimization company.',
      source: 'map-your-show',
    });
    expect(rows[2].standNumber).toBe('V3216, V7024');
  });

  it('shows exactly what the public tab shows: same names, booths, descriptions and proxied logos', () => {
    const record = aapexRecord(cards);
    const publicCards = withDisplayLogos(withCleanCards(withCatalogueLinks(record.verified!)), AAPEX).exhibitors;
    const rows = crmRowsFromRecord(AAPEX, record);
    expect(rows.map((row) => [row.companyName, row.logoUrl, row.sourceDetailUrl, row.description])).toEqual(
      publicCards.map((c) => [c.name, c.logoUrl, c.profileUrl, c.description])
    );
    expect(rows[1].logoUrl).toBe(`/api/find-shows/exhibitors/logo?slug=${AAPEX}&id=24231`);
  });

  it('never fabricates website, country or contacts the directory does not publish', () => {
    for (const row of crmRowsFromRecord(AAPEX, aapexRecord(cards))) {
      expect(row).not.toHaveProperty('websiteUrl');
      expect(row).not.toHaveProperty('country');
      expect(row).not.toHaveProperty('email');
    }
  });

  it('yields each profile once, so a re-run upserts the same keys instead of adding rows', () => {
    const twice = [...cards, card('26731', '360insights', { booths: ['V732'] })];
    const rows = crmRowsFromRecord(AAPEX, aapexRecord(twice));
    expect(new Set(rows.map((row) => row.sourceDetailUrl)).size).toBe(rows.length);
    expect(crmRowsFromRecord(AAPEX, aapexRecord(cards))).toEqual(crmRowsFromRecord(AAPEX, aapexRecord(cards)));
  });

  it('keeps two official listings of one company name as two rows (different profiles)', () => {
    const rows = crmRowsFromRecord(AAPEX, aapexRecord([card('17799', 'EndeavorB2B'), card('321', 'EndeavorB2B')]));
    expect(rows.map((row) => row.sourceDetailUrl)).toEqual([profile('17799'), profile('321')]);
  });

  it('refuses rather than imports when there is nothing verified for this event', () => {
    expect(() => crmRowsFromRecord(AAPEX, null)).toThrow(CrmImportRefused);
    const otherEdition = { ...aapexRecord(cards), edition: { ...aapexRecord(cards).edition, slugs: ['aapex-las-vegas-nv-2025-11-04'] } };
    expect(() => crmRowsFromRecord(AAPEX, otherEdition)).toThrow(/belongs to aapex-las-vegas-nv-2025-11-04/);
    const notVerified = { ...aapexRecord(cards), verified: null };
    expect(() => crmRowsFromRecord(AAPEX, notVerified)).toThrow(/no verified public exhibitor list/);
    const loginOnly = aapexRecord([], { status: 'LOGIN_REQUIRED_DIRECTORY' } as Partial<ExhibitorDirectory>);
    expect(() => crmRowsFromRecord(AAPEX, loginOnly)).toThrow(CrmImportRefused);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { findShowEvents, findShowStats } from '../../lib/find-shows/catalog';
import { getSeedFindShowAsset } from '../../lib/find-shows/eventseye';
import { getFindShowAvatarUrl, getFindShowGradient } from '../../lib/find-shows/presentation';

describe('find shows catalog', () => {
  it('keeps a deduplicated 695-event catalog across the UK, Germany, and USA', () => {
    expect(findShowEvents).toHaveLength(695);
    expect(findShowStats.totalEvents).toBe(695);
    expect(findShowStats.ukEvents).toBe(385);
    expect(findShowStats.germanyEvents).toBe(10);
    expect(findShowStats.usaEvents).toBe(300);
    expect(findShowStats.countries).toBe(3);
    expect(new Set(findShowEvents.map((event) => event.slug)).size).toBe(695);
    expect(
      new Set(findShowEvents.map((event) => `${event.name}|${event.city}|${event.startDate}`)).size
    ).toBe(695);
    expect(
      new Set(
        findShowEvents
          .map((event) => event.seedAsset.eventseyeUrl)
          .filter((value): value is string => Boolean(value))
      ).size
    ).toBe(685);
    expect(new Set(findShowEvents.map((event) => event.country))).toEqual(
      new Set(['Germany', 'United Kingdom', 'United States'])
    );
    expect(
      findShowEvents.filter(
        (event) =>
          event.country === 'United Kingdom' &&
          event.seedAsset.eventseyeUrl &&
          event.seedAsset.bannerUrl &&
          event.seedAsset.logoUrl
      )
    ).toHaveLength(385);
    expect(
      findShowEvents.filter(
        (event) =>
          event.country === 'United States' &&
          event.seedAsset.eventseyeUrl &&
          event.seedAsset.bannerUrl &&
          event.seedAsset.logoUrl
      )
    ).toHaveLength(300);
  });

  it('normalizes exact and approximate dates, placeholder locations, and mapped categories', () => {
    const polymers = findShowEvents.find((event) => event.name === 'POLYMERS IN FLOORING EUROPE');
    const euroguss = findShowEvents.find((event) => event.name === 'EUROGUSS');
    const scottishMotorcycleShow = findShowEvents.find(
      (event) => event.name === 'THE SCOTTISH MOTORCYCLE SHOW'
    );
    const oncologyProfessionalCare = findShowEvents.find(
      (event) => event.name === 'ONCOLOGY PROFESSIONAL CARE'
    );
    const photonexEurope = findShowEvents.find((event) => event.name === 'PHOTONEX EUROPE');
    const savannahRvExpo = findShowEvents.find((event) => event.name === 'SAVANNAH RV EXPO');

    expect(polymers?.startDate).toBe('2025-12-09');
    expect(polymers?.endDate).toBe('2025-12-10');
    expect(polymers?.venue).toBe('Venue to be announced');
    expect(polymers?.categories).toContain('Plastics & Rubber');

    expect(euroguss?.displayDate).toBe('13 - 15 Jan 2026');
    expect(euroguss?.categories).toContain('Manufacturing & Engineering');

    expect(scottishMotorcycleShow?.categories).toContain('Automotive');
    expect(oncologyProfessionalCare?.startDate).toBe('2026-05-01');
    expect(oncologyProfessionalCare?.endDate).toBe('2026-05-31');
    expect(oncologyProfessionalCare?.displayDate).toBe('May 2026 (TBC)');
    expect(photonexEurope?.city).toBe('City to be announced');
    expect(photonexEurope?.country).toBe('United Kingdom');
    expect(photonexEurope?.venue).toBe('Venue to be announced');
    expect(savannahRvExpo?.country).toBe('United States');
    expect(savannahRvExpo?.region).toBe('Americas');
    expect(savannahRvExpo?.city).toBe('Savannah, GA');
  });

  it('builds stable fallback media helpers for every event', () => {
    for (const event of findShowEvents) {
      expect(getFindShowGradient(event.slug)).toContain('linear-gradient');
      expect(getFindShowAvatarUrl(event.name)).toContain('ui-avatars.com');
    }
  });

  it('returns persisted Eventseye media for imported events without a live fetch', async () => {
    const importedEvent = findShowEvents.find(
      (event) => event.name === 'HRC - HOTEL, RESTAURANT & CATERING'
    );

    expect(importedEvent?.seedAsset.eventseyeUrl).toBeTruthy();

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    try {
      const asset = getSeedFindShowAsset(importedEvent!.slug);
      expect(asset).toEqual(importedEvent?.seedAsset);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

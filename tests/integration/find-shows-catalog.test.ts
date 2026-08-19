import { describe, expect, it, vi } from 'vitest';
import { findShowEvents, findShowStats } from '../../lib/find-shows/catalog';
import { getSeedFindShowAsset } from '../../lib/find-shows/eventseye';
import { getFindShowAvatarUrl, getFindShowGradient } from '../../lib/find-shows/presentation';

describe('find shows catalog', () => {
  // Counts are derived from the seed data rather than hardcoded: the catalog
  // grows every time a country is imported, and pinning totals here only ever
  // produced false failures. What must hold regardless of size is that the
  // catalog is deduplicated and that findShowStats agrees with findShowEvents.
  it('keeps a deduplicated catalog whose stats match the event list', () => {
    const countries = new Set(findShowEvents.map((event) => event.country));

    expect(findShowEvents.length).toBeGreaterThan(0);

    // No duplicates: one entry per slug, and per name/city/start-date triple.
    expect(new Set(findShowEvents.map((event) => event.slug)).size).toBe(findShowEvents.length);
    expect(
      new Set(findShowEvents.map((event) => `${event.name}|${event.city}|${event.startDate}`)).size
    ).toBe(findShowEvents.length);

    // Stats are a projection of the same list, so they must not drift from it.
    expect(findShowStats.totalEvents).toBe(findShowEvents.length);
    expect(findShowStats.countries).toBe(countries.size);
    expect(findShowStats.ukEvents).toBe(
      findShowEvents.filter((event) => event.country === 'United Kingdom').length
    );
    expect(findShowStats.germanyEvents).toBe(
      findShowEvents.filter((event) => event.country === 'Germany').length
    );
    expect(findShowStats.usaEvents).toBe(
      findShowEvents.filter((event) => event.country === 'United States').length
    );

    // The three originally-imported countries must stay represented.
    for (const country of ['Germany', 'United Kingdom', 'United States']) {
      expect(countries.has(country)).toBe(true);
    }

    // Every event carries its persisted Eventseye asset bag.
    for (const event of findShowEvents) {
      expect(event.seedAsset).toBeDefined();
    }
  });

  // Fixtures come from the Aug 2026 - Jul 2027 eventseye import. They are named
  // shows rather than indexes so a failure says which normalisation broke, and
  // they were chosen to cover one case each: an exact numeric range, an
  // approximate month-only date, a missing venue, and category mapping.
  it('normalizes exact and approximate dates, placeholder venues, and mapped categories', () => {
    const aghaMelbourne = findShowEvents.find((event) => event.name === 'AGHA GIFT FAIRS - MELBOURNE');
    const argusCriticalMinerals = findShowEvents.find(
      (event) => event.name === 'ARGUS AUSTRALIA CRITICAL MINERALS FORUM'
    );
    const opalExhibition = findShowEvents.find((event) => event.name === 'AUSTRALIAN OPAL EXHIBITION');
    const blackHat = findShowEvents.find((event) => event.name === 'BLACK HAT USA');

    // Exact range: "08/01/2026" plus a 5-day duration becomes a real span.
    expect(aghaMelbourne?.startDate).toBe('2026-08-01');
    expect(aghaMelbourne?.endDate).toBe('2026-08-05');
    expect(aghaMelbourne?.displayDate).toBe('01 - 05 Aug 2026');
    expect(aghaMelbourne?.city).toBe('Melbourne');

    // Month-only date: spans the whole month and is labelled as provisional.
    expect(argusCriticalMinerals?.startDate).toBe('2026-08-01');
    expect(argusCriticalMinerals?.endDate).toBe('2026-08-31');
    expect(argusCriticalMinerals?.displayDate).toBe('Aug 2026 (TBC)');

    // The seed's "?" venue placeholder is rendered, never shown raw.
    expect(opalExhibition?.venue).toBe('Venue to be announced');
    expect(opalExhibition?.categories).toContain('Textiles & Fashion');

    // Keyword mapping from the show name and description.
    expect(blackHat?.categories).toContain('Security & Safety');
    expect(blackHat?.country).toBe('United States');
    expect(blackHat?.region).toBe('Americas');
  });

  it('builds stable fallback media helpers for every event', () => {
    for (const event of findShowEvents) {
      expect(getFindShowGradient(event.slug)).toContain('linear-gradient');
      expect(getFindShowAvatarUrl(event.name)).toContain('ui-avatars.com');
    }
  });

  it('returns persisted Eventseye media for imported events without a live fetch', async () => {
    const importedEvent = findShowEvents.find(
      (event) => event.name === 'AGHA GIFT FAIRS - MELBOURNE'
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

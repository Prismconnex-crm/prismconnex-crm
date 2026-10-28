import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import registryFile from '@/data/find-shows-card-images.json';
import { findShowEvents, findShowEventsBySlug } from '@/lib/find-shows/catalog';
import { searchFindShowEvents } from '@/lib/find-shows/search-events';
import { DEFAULT_FILTERS } from '@/lib/find-shows/results-state';
import {
  cardImageEntryProblem,
  getCardImageEntries,
  getFindShowCardCover,
  heroCoverBandBottom,
  type CardImageEntry,
} from '@/lib/find-shows/card-image-registry';

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

/** Width and height from a PNG, JPEG, WebP or AVIF header. */
function imageSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.readUInt32BE(0) === 0x89504e47) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    for (let offset = 2; offset < buffer.length; ) {
      const marker = buffer[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  if (buffer.toString('ascii', 8, 12) === 'WEBP' && buffer.toString('ascii', 12, 16) === 'VP8 ') {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  const ispe = buffer.indexOf('ispe');
  if (ispe > 0) return { width: buffer.readUInt32BE(ispe + 8), height: buffer.readUInt32BE(ispe + 12) };
  return null;
}

const argentinaEvents = searchFindShowEvents(findShowEvents, {
  ...DEFAULT_FILTERS,
  region: 'Americas',
  country: 'Argentina',
});

describe('find shows card images', () => {
  it('loads every entry in the data file — none is silently dropped', () => {
    const problems = (registryFile.entries as CardImageEntry[])
      .map((entry) => [entry.slug, cardImageEntryProblem(entry)])
      .filter(([, problem]) => problem);
    expect(problems).toEqual([]);
    expect(getCardImageEntries()).toHaveLength(registryFile.entries.length);
  });

  it('only holds entries for real catalog events, checked against their current edition', () => {
    for (const entry of getCardImageEntries()) {
      const event = findShowEventsBySlug[entry.slug];
      expect(event, entry.slug).toBeDefined();
      expect(event.name).toBe(entry.eventName);
      expect(event.startDate).toBe(entry.catalogStartDate);
    }
    const slugs = getCardImageEntries().map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('gives every Argentina event a verified image or the fallback', () => {
    expect(argentinaEvents).toHaveLength(21);
    for (const event of argentinaEvents) {
      expect(getFindShowCardCover(event.slug), event.slug).not.toBeNull();
    }
  });

  it('stores each verified image locally, at the dimensions recorded for it', () => {
    for (const entry of getCardImageEntries()) {
      if (entry.status !== 'verified') continue;
      const file = path.join(PUBLIC_DIR, entry.imagePath);
      expect(fs.existsSync(file), entry.imagePath).toBe(true);
      expect(imageSize(fs.readFileSync(file)), entry.imagePath).toEqual({ width: entry.width, height: entry.height });
    }
  });

  it('never shares one image between different events', () => {
    const eventByImage = new Map<string, string>();
    for (const entry of getCardImageEntries()) {
      if (entry.status !== 'verified') continue;
      // Two editions of the same event may share their organizer's image.
      const owner = eventByImage.get(entry.imagePath) ?? entry.eventName;
      expect(owner, entry.imagePath).toBe(entry.eventName);
      eventByImage.set(entry.imagePath, entry.eventName);
    }
  });

  it('labels previous-edition images and leaves unreviewed events unchanged', () => {
    expect(getFindShowCardCover('circular-plastics-packaging-south-and-central-america-buenos-aires-2027-05-01')).toMatchObject({
      status: 'image',
      editionLabel: 'SCAPET 2026',
    });
    expect(getFindShowCardCover('fithep-latam-buenos-aires-2027-05-30')).toMatchObject({ status: 'image', editionLabel: null });
    expect(getFindShowCardCover('argentina-hydrocarbons-buenos-aires-2026-10-21')).toEqual({ status: 'fallback' });
    expect(getFindShowCardCover('no-such-event')).toBeNull();
  });

  it('ends the detail hero artwork above the title, and drops it where the title leaves no room', () => {
    // One line on desktop; two ("EXPO" / "MEDICAL") on a phone, below the 64px logo either way.
    expect(heroCoverBandBottom('EXPO MEDICAL')).toEqual({ mobile: 24 + 72 + 12, desktop: 32 + 64 + 12 });
    // Six lines on a phone (as rendered at 390px), three on the narrowest (tablet) hero.
    expect(heroCoverBandBottom('CIRCULAR PLASTICS PACKAGING SOUTH & CENTRAL AMERICA')).toEqual({
      mobile: null,
      desktop: 32 + 120 + 12,
    });
  });

  it('gives only the flagged artwork the intrinsic hero layout', () => {
    const intrinsic = getCardImageEntries()
      .filter((entry) => getFindShowCardCover(entry.slug)?.status === 'image')
      .filter((entry) => (getFindShowCardCover(entry.slug) as { heroLayout: string }).heroLayout === 'intrinsic')
      .map((entry) => entry.slug)
      .sort();
    expect(intrinsic).toEqual([
      'argentina-gold-silver-and-copper-buenos-aires-2026-12-01',
      'expo-medical-buenos-aires-2026-09-23',
      'lithium-in-the-south-american-region-san-fernando-del-valle-de-catamarca-2026-10-07',
    ]);
    expect(getFindShowCardCover('batev-buenos-aires-2027-06-01')).toMatchObject({ heroLayout: 'band' });
    const logo = getCardImageEntries().find((entry) => entry.status === 'verified' && entry.kind === 'logo')!;
    expect(cardImageEntryProblem({ ...logo, heroLayout: 'intrinsic' } as CardImageEntry)).toMatch(/only artwork/);
  });

  it('rejects an entry without evidence or with a remote image path', () => {
    const valid = getCardImageEntries().find((entry) => entry.status === 'verified')!;
    expect(cardImageEntryProblem({ ...valid, attribution: ' ' } as CardImageEntry)).toMatch(/attribution/);
    expect(cardImageEntryProblem({ ...valid, imagePath: 'https://example.com/a.jpg' } as CardImageEntry)).toMatch(/imagePath/);
    expect(
      cardImageEntryProblem({ slug: 'x', eventName: 'X', catalogStartDate: '2027-01-01', status: 'no-official-image', reason: '', verifiedOn: '2026-10-24' })
    ).toMatch(/reason/);
  });
});

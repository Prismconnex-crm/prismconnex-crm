/**
 * Hand-verified event cover images (data/find-shows-card-images.json), shown
 * in the event page's hero banner (components/find-shows/event-hero-background.tsx).
 * Listing cards keep the one design every country shares and don't use them.
 *
 * The Eventseye `bannerUrl` in the seed is a venue photo shared by every show
 * at that venue, so it can't stand in for an event. This registry holds images
 * a reviewer tied to one event from its official site or organizer page, kept
 * as local files under public/images/find-shows/covers. An event checked and
 * found to have no usable official image gets a `no-official-image` entry, so
 * its banner keeps the gradient rather than an automatic pick.
 *
 * Entries are checked when the module loads and an invalid one is dropped (the
 * banner then resolves as it did before the registry), so a bad edit to the
 * JSON can't put a broken or unlabelled image on a page.
 */
import registryFile from '../../data/find-shows-card-images.json';

export type CardImageKind = 'photo' | 'artwork' | 'logo';
export type CardHeroLayout = 'band' | 'intrinsic';

type VerifiedCardImageEntry = {
  slug: string;
  eventName: string;
  /** The catalog edition the entry was checked against; a new edition gets a new slug. */
  catalogStartDate: string;
  status: 'verified';
  /** A photo gets a blurred copy of itself behind it; artwork and logos sit on `background`. */
  kind: CardImageKind;
  background?: string;
  /**
   * Artwork only. "intrinsic" gives the artwork the top of the detail hero at
   * its own aspect ratio, with the title below it, instead of the band above
   * the title, for artwork that band would shrink past legibility.
   */
  heroLayout?: CardHeroLayout;
  /** Path under public/, served from the app's own origin. */
  imagePath: string;
  /** Where the local file was copied from. */
  sourceImageUrl: string;
  width: number;
  height: number;
  sourcePageUrl: string;
  /** What on the source page (or in the image) ties it to this event. */
  attribution: string;
  previousEdition: boolean;
  /** Shown on a previous-edition image, e.g. "SCAPET 2026" or "Past edition". */
  editionLabel?: string;
  verifiedOn: string;
};

type MissingCardImageEntry = {
  slug: string;
  eventName: string;
  catalogStartDate: string;
  status: 'no-official-image';
  /** Which official sources were checked and why none gave a usable image. */
  reason: string;
  verifiedOn: string;
};

export type CardImageEntry = VerifiedCardImageEntry | MissingCardImageEntry;

/** What the event page's banner draws for a reviewed event. */
export type FindShowCardCover =
  | {
      status: 'image';
      src: string;
      width: number;
      height: number;
      kind: CardImageKind;
      background: string | null;
      heroLayout: CardHeroLayout;
      /** Set only for a previous-edition image. */
      editionLabel: string | null;
    }
  | { status: 'fallback' };

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Why an entry can't be used, or null when it's valid. */
export function cardImageEntryProblem(entry: CardImageEntry): string | null {
  if (!entry.slug || !entry.eventName) return 'missing slug or event name';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.catalogStartDate)) return 'catalogStartDate is not YYYY-MM-DD';
  if (entry.status === 'no-official-image') return entry.reason?.trim() ? null : 'no reason recorded for the missing image';
  if (entry.status !== 'verified') return `unknown status "${(entry as { status: string }).status}"`;
  if (!/^\/images\/find-shows\/covers\/[\w.-]+\.(?:jpe?g|png|webp|avif)$/.test(entry.imagePath)) {
    return 'imagePath is not a file under /images/find-shows/covers';
  }
  if (!entry.sourceImageUrl.startsWith('http') || !entry.sourcePageUrl.startsWith('http')) return 'source URLs must be absolute';
  if (!entry.attribution.trim()) return 'no attribution evidence recorded';
  if (!(entry.width > 0) || !(entry.height > 0)) return 'missing image dimensions';
  if (!['photo', 'artwork', 'logo'].includes(entry.kind)) return `unknown kind "${entry.kind}"`;
  if (entry.kind !== 'photo' && !HEX_COLOR.test(entry.background ?? '')) return 'artwork and logos need a #rrggbb background';
  if (entry.heroLayout !== undefined && !['band', 'intrinsic'].includes(entry.heroLayout)) return `unknown heroLayout "${entry.heroLayout}"`;
  if (entry.heroLayout === 'intrinsic' && entry.kind !== 'artwork') return 'only artwork can use the intrinsic hero layout';
  if (entry.previousEdition && !entry.editionLabel?.trim()) return 'a previous-edition image needs an editionLabel';
  return null;
}

const entries = (registryFile.entries as CardImageEntry[]).filter((entry) => {
  const problem = cardImageEntryProblem(entry);
  if (problem) console.warn(`[find-shows card images] skipping ${entry.slug || '(no slug)'}: ${problem}`);
  return !problem;
});

const entriesBySlug = new Map(entries.map((entry) => [entry.slug, entry]));

export function getCardImageEntries(): readonly CardImageEntry[] {
  return entries;
}

/** Lines `text` wraps onto at `charsPerLine`, breaking between words. */
function estimateLines(text: string, charsPerLine: number) {
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const needed = used ? used + 1 + word.length : word.length;
    if (used && needed > charsPerLine) {
      lines += 1;
      used = word.length;
    } else {
      used = needed;
    }
  }
  return lines;
}

// The detail hero's title block: p-6 / md:p-8 padding, a 64px logo beside a
// text-3xl (36px lines) / md:text-4xl (40px lines) black uppercase title.
// Characters per line are for the narrowest hero at each breakpoint
// (a 390px phone; a 768px tablet), so a wider screen only over-reserves.
const HERO_TITLE = {
  mobile: { padding: 24, lineHeight: 36, charsPerLine: 10 },
  desktop: { padding: 32, lineHeight: 40, charsPerLine: 22 },
} as const;
const HERO_HEIGHT = 288;
const HERO_BAND_TOP = { mobile: 20, desktop: 24 };
/** Below this the artwork would be too small to read, so it isn't drawn. */
const MIN_BAND_HEIGHT = 72;

/**
 * Where the detail hero's artwork band ends (px from the hero's bottom) so it
 * sits above the event's title, per breakpoint; null where the title leaves
 * too little room for the artwork to be legible.
 */
export function heroCoverBandBottom(eventName: string): { mobile: number | null; desktop: number | null } {
  const bottomFor = (key: 'mobile' | 'desktop') => {
    const { padding, lineHeight, charsPerLine } = HERO_TITLE[key];
    const titleHeight = Math.max(estimateLines(eventName, charsPerLine) * lineHeight, 64);
    const bottom = padding + titleHeight + 12;
    return HERO_HEIGHT - HERO_BAND_TOP[key] - bottom >= MIN_BAND_HEIGHT ? bottom : null;
  };
  return { mobile: bottomFor('mobile'), desktop: bottomFor('desktop') };
}

/**
 * The cover for this event: its verified image, the fallback for an event
 * checked and found to have none, or null for an event not reviewed yet
 * (whose banner falls through to the hero registry and automatic resolver).
 */
export function getFindShowCardCover(slug: string): FindShowCardCover | null {
  const entry = entriesBySlug.get(slug);
  if (!entry) return null;
  if (entry.status === 'no-official-image') return { status: 'fallback' };
  return {
    status: 'image',
    src: entry.imagePath,
    width: entry.width,
    height: entry.height,
    kind: entry.kind,
    background: entry.background ?? null,
    heroLayout: entry.heroLayout ?? 'band',
    editionLabel: entry.previousEdition ? entry.editionLabel ?? null : null,
  };
}

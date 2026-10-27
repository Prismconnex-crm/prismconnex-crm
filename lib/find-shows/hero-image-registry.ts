/**
 * Hand-verified banner photos (data/find-shows-hero-images.json), looked up
 * before the automatic resolver in event-hero-image.ts.
 *
 * The automatic resolver can only use what a page's markup says about an
 * image. The registry holds photos a reviewer tied to the event and edition
 * from the source page's own text or the image content — including photos of
 * a previous edition, which the banner labels with their own year so they are
 * never passed off as the current one.
 *
 * Entries are checked when the module loads and an invalid one is dropped
 * (the event then falls through to the automatic resolver), so a bad edit to
 * the JSON can't put a broken or unlabelled photo on a page.
 */
import registryFile from '../../data/find-shows-hero-images.json';
import denylistFile from '../../data/find-shows-hero-image-denylist.json';
import { isFetchableUrl, MIN_HERO_WIDTH, type HeroImage } from './event-hero-image';

export type HeroRegistryEntry = {
  slug: string;
  eventName: string;
  /** The catalog edition the entry was verified against; a new edition gets a new slug. */
  catalogStartDate: string;
  status: 'verified';
  imageUrl: string;
  width: number;
  height: number;
  sourcePageUrl: string;
  /** What on the source page (or in the image) ties the photo to this event and edition. */
  attribution: string;
  editionYear: number;
  previousEdition: boolean;
  /** Short event name and year shown on a previous-edition photo, e.g. "MALMS 2026". */
  editionLabel: string;
  verifiedOn: string;
};

/** A banner photo, with the edition it shows when that isn't the current one. */
export type FindShowHeroImage = HeroImage & {
  /** Set only for a previous-edition photo, e.g. "MALMS 2026". */
  previousEditionLabel?: string;
};

// Same shape limits as the automatic resolver: narrower or squarer photos soften or crop badly in the 3.5:1 banner.
const MIN_ASPECT = 1.25;
const MAX_ASPECT = 3.5;

/** Why an entry can't be used, or null when it's valid. */
export function registryEntryProblem(entry: HeroRegistryEntry): string | null {
  if (!entry.slug || !entry.eventName) return 'missing slug or event name';
  if (entry.status !== 'verified') return `status is "${entry.status}", not "verified"`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.catalogStartDate)) return 'catalogStartDate is not YYYY-MM-DD';
  if (!entry.imageUrl.startsWith('https://') || !isFetchableUrl(entry.imageUrl)) return 'imageUrl is not a public https URL';
  if (!entry.sourcePageUrl.startsWith('http') || !isFetchableUrl(entry.sourcePageUrl)) return 'sourcePageUrl is not a public URL';
  if (!entry.attribution.trim()) return 'no attribution evidence recorded';
  if (!(entry.width >= MIN_HERO_WIDTH) || !(entry.height > 0)) return `image is narrower than ${MIN_HERO_WIDTH}px`;
  const aspect = entry.width / entry.height;
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) return `aspect ratio ${aspect.toFixed(2)} is outside ${MIN_ASPECT}-${MAX_ASPECT}`;

  const catalogYear = Number(entry.catalogStartDate.slice(0, 4));
  if (!Number.isInteger(entry.editionYear) || entry.editionYear > catalogYear) return 'editionYear is after the catalog edition';
  if (entry.previousEdition) {
    if (entry.editionYear >= catalogYear) return 'a previous-edition photo must be from an earlier year than the catalog edition';
    if (!entry.editionLabel.includes(String(entry.editionYear))) return 'editionLabel must name the photo\'s own year';
  } else if (entry.editionYear !== catalogYear) {
    return 'a current-edition photo must be from the catalog edition\'s year';
  }
  return null;
}

const entries = (registryFile.entries as HeroRegistryEntry[]).filter((entry) => {
  const problem = registryEntryProblem(entry);
  if (problem) console.warn(`[find-shows hero registry] skipping ${entry.slug || '(no slug)'}: ${problem}`);
  return !problem;
});

const entriesBySlug = new Map(entries.map((entry) => [entry.slug, entry]));

export function getHeroRegistryEntries(): readonly HeroRegistryEntry[] {
  return entries;
}

// Query parameters of a signed CDN link (CloudFront, S3, GCS). The CDN re-signs
// the same file daily, so a denied image must not come back with a fresh signature.
const SIGNED_URL_PARAM = /^(?:expires|signature|key-pair-id|policy|x-amz-.+|x-goog-.+)$/i;

/** The image a URL points at, ignoring a rotating signature. */
function deniedImageKey(imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    for (const name of Array.from(url.searchParams.keys())) if (SIGNED_URL_PARAM.test(name)) url.searchParams.delete(name);
    return url.toString();
  } catch {
    return imageUrl;
  }
}

const deniedImages = new Set((denylistFile.entries as { imageUrl: string }[]).map((entry) => deniedImageKey(entry.imageUrl)));

/**
 * Images the automatic resolver must never use: reviewed in the resolver
 * audit as unrelated, unsuitable, unloadable when embedded, or shared by
 * different shows. Registry entries are verified separately and not affected.
 */
export function isDeniedHeroImage(imageUrl: string) {
  return deniedImages.has(deniedImageKey(imageUrl));
}

type HeroImageClaims = { claim(imageUrl: string, showKey: string): void; isShared(imageUrl: string): boolean };

/**
 * The last check on an automatically found photo before it is shown: never a
 * denylisted image, and never one another show has also resolved to. The
 * claim is recorded first, so when a second show finds the same photo, both
 * fall back to the gradient on their next render.
 */
export function screenAutomaticHeroImage(image: HeroImage | null, showKey: string, claims: HeroImageClaims): HeroImage | null {
  if (!image || isDeniedHeroImage(image.url)) return null;
  claims.claim(image.url, showKey);
  return claims.isShared(image.url) ? null : image;
}

/** The verified photo for this event page, or null when it has none. */
export function getRegisteredHeroImage(slug: string): FindShowHeroImage | null {
  const entry = entriesBySlug.get(slug);
  if (!entry) return null;
  return {
    url: entry.imageUrl,
    width: entry.width,
    height: entry.height,
    ...(entry.previousEdition ? { previousEditionLabel: entry.editionLabel } : {}),
  };
}

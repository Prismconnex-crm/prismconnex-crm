import { getFindShowHeroImage } from '@/lib/find-shows/eventseye';
import { getFindShowGradient } from '@/lib/find-shows/presentation';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { getFindShowCardCover, heroCoverBandBottom, type FindShowCardCover } from '@/lib/find-shows/card-image-registry';
import { FallbackImage } from '@/components/find-shows/fallback-image';

/**
 * Full-banner gradient: the Suspense fallback while the hero photo resolves,
 * the base under the photo (so a photo that fails in the browser reveals it
 * rather than a broken-image icon), and the whole banner for events without
 * a suitable photo.
 *
 * Eventseye's venue/logo thumbnails (~100-160px) are deliberately never shown
 * here: stretched across the ~1024px banner they are blurry, and as a small
 * inset card they don't match the full-bleed banner design.
 */
export function EventHeroGradient({ slug }: { slug: string }) {
  return <div className="absolute inset-0" style={{ backgroundImage: getFindShowGradient(slug) }} />;
}

/**
 * The event's reviewed cover (lib/find-shows/card-image-registry.ts) as the banner.
 *
 * A photo covers the banner edge to edge, centred, like the automatic photos.
 * Artwork and logos carry dates and wordmarks that cropping would cut, so they
 * are drawn whole (`object-contain`) in the band above the title, on their own
 * background colour (artwork with a blurred copy of itself behind). The band
 * ends above the title, which wraps onto more lines on a phone. Each image
 * is a FallbackImage, so a file that fails to load leaves the gradient.
 */
function EventHeroCover({
  cover,
  eventName,
}: {
  cover: Extract<FindShowCardCover, { status: 'image' }>;
  eventName: string;
}) {
  const label = cover.editionLabel === 'Past edition' ? null : cover.editionLabel;
  const band = heroCoverBandBottom(eventName);
  const alt = cover.editionLabel ? `${eventName} — image from a previous edition` : `${eventName} cover`;

  return (
    <>
      {cover.kind === 'photo' ? (
        <FallbackImage sources={[cover.src]} alt={alt} fetchPriority="high" className="absolute inset-0 size-full object-cover object-center">
          <div className="absolute inset-0 bg-slate-950/30" />
        </FallbackImage>
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: cover.background ?? undefined }}>
          {/* Not behind a logo: a blurred white wordmark turns the brand colour grey. */}
          {cover.kind === 'artwork' ? (
            <FallbackImage
              sources={[cover.src]}
              alt=""
              className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl"
            />
          ) : null}
          {/* Ends above the title at each breakpoint; where a long title leaves
              no legible room (a phone, mostly) only the backdrop is shown. */}
          <div
            className={cn(
              'absolute inset-x-5 top-5 bottom-[var(--band-bottom)] md:top-6 md:bottom-[var(--band-bottom-md)]',
              band.mobile === null && 'hidden',
              band.desktop === null ? 'md:hidden' : 'md:block'
            )}
            style={{ '--band-bottom': `${band.mobile ?? 0}px`, '--band-bottom-md': `${band.desktop ?? 0}px` } as CSSProperties}
          >
            <FallbackImage
              sources={[cover.src]}
              alt={alt}
              fetchPriority="high"
              className={`size-full object-contain object-center ${cover.kind === 'logo' ? 'p-2 md:p-4' : ''}`}
            />
          </div>
        </div>
      )}
      {cover.editionLabel ? (
        <div className="absolute right-4 top-4 z-10 max-w-[calc(100%-2rem)] truncate rounded-full bg-slate-950/60 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
          {cover.kind === 'photo' ? 'Previous edition photo' : 'Previous edition'}
          {label ? ` · ${label}` : ''}
        </div>
      ) : null}
    </>
  );
}

/**
 * The top of the detail hero for artwork with `heroLayout: "intrinsic"`: the
 * whole artwork at its own aspect ratio, above the title rather than behind it,
 * so neither the title nor the bottom gradient covers any of it. Fills the
 * width up to 512px, centred on its blurred backdrop, so it doesn't dominate
 * a wide hero. The <img> box is the image itself: it can't be cropped or
 * stretched. In normal flow, so the hero grows to fit it.
 */
export function EventHeroIntrinsicArtwork({
  cover,
  eventName,
}: {
  cover: Extract<FindShowCardCover, { status: 'image' }>;
  eventName: string;
}) {
  const label = cover.editionLabel === 'Past edition' ? null : cover.editionLabel;
  const alt = cover.editionLabel ? `${eventName} — image from a previous edition` : `${eventName} cover`;

  return (
    <>
      <div className="absolute inset-0" style={{ backgroundColor: cover.background ?? undefined }}>
        <FallbackImage sources={[cover.src]} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/40 to-transparent" />
      <div className="relative flex justify-center px-5 pt-5 md:px-8 md:pt-8">
        <FallbackImage
          sources={[cover.src]}
          alt={alt}
          width={cover.width}
          height={cover.height}
          fetchPriority="high"
          className="block h-auto w-full max-w-lg object-contain shadow-lg"
        />
      </div>
      {cover.editionLabel ? (
        <div className="absolute right-4 top-4 z-10 max-w-[calc(100%-2rem)] truncate rounded-full bg-slate-950/60 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
          Previous edition{label ? ` · ${label}` : ''}
        </div>
      ) : null}
    </>
  );
}

/**
 * The event's own photo, covering the whole banner edge to edge. A plain
 * <img> rather than next/image: the host varies per event, and allowing
 * every host in next.config's remotePatterns would turn /_next/image into
 * an open proxy — and the photo is already measured to be at least as wide
 * as the banner, so the optimizer could only scale it down, which the
 * browser does anyway.
 */
export async function EventHeroBackground({
  slug,
  website,
  eventName,
}: {
  slug: string;
  website: string | null;
  eventName: string;
}) {
  // A reviewed cover (the official image tied to this event) comes first; an
  // event reviewed as having no official image keeps the gradient rather than
  // an automatic pick the review already passed over.
  const cover = getFindShowCardCover(slug);
  if (cover) {
    return (
      <>
        <EventHeroGradient slug={slug} />
        {cover.status === 'image' ? <EventHeroCover cover={cover} eventName={eventName} /> : null}
      </>
    );
  }

  const hero = await getFindShowHeroImage(slug, website).catch(() => null);
  const previousEdition = hero?.previousEditionLabel;

  return (
    <>
      <EventHeroGradient slug={slug} />
      {hero ? (
        <FallbackImage
          sources={[hero.url]}
          alt={previousEdition ? `${eventName} — photo from ${previousEdition}` : `${eventName} banner`}
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover"
        >
          {/* Even dim across the whole photo, under the page's bottom gradient:
              light event artwork (e.g. a white campaign cover) would otherwise
              wash out the white title. Inside FallbackImage so it goes with the
              photo if that fails, rather than darkening the gradient. */}
          <div className="absolute inset-0 bg-slate-950/30" />
          {/* A photo of an earlier edition says which one, so it's never taken
              for the upcoming show. Top right, clear of the logo and title. */}
          {previousEdition ? (
            <div className="absolute right-4 top-4 z-10 max-w-[calc(100%-2rem)] truncate rounded-full bg-slate-950/60 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
              Previous edition photo · {previousEdition}
            </div>
          ) : null}
        </FallbackImage>
      ) : null}
    </>
  );
}

import { getFindShowHeroImage } from '@/lib/find-shows/eventseye';
import { getFindShowGradient } from '@/lib/find-shows/presentation';
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

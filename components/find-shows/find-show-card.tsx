'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFindShowGradient, getFindShowInitials } from '@/lib/find-shows/presentation';
import { marketingCardInteractiveClass } from '@/components/landing/marketing-card-hover';
import { HighlightText } from '@/components/find-shows/highlight-text';
import type { FindShowAsset, FindShowEvent } from '@/types/find-shows';

/**
 * The circular event mark.
 *
 * Eventseye logos are mostly wide wordmark GIFs (131×14 is common), so they are
 * drawn `object-contain` inside a box inset 15% on every side: a square that
 * small fits within the circle at any aspect ratio, so no logo is ever clipped.
 * Once a logo loads at 2:1 or wider the box widens to 84%; a 2:1 image in it is
 * at most 84%×42%, whose corners still sit inside the circle, and a thin
 * wordmark reads noticeably larger than it would squeezed into the square.
 * The circle stays white in dark mode because the GIFs are drawn for a white
 * page. A banner used in place of a logo is a photo, so it fills the circle
 * instead. With no image, or once one fails to load, it shows local initials
 * over the event's gradient.
 */
function FindShowLogo({
  name,
  asset,
  gradientSeed,
}: {
  name: string;
  asset?: FindShowAsset;
  gradientSeed: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [wideSrc, setWideSrc] = useState<string | null>(null);
  const src = asset?.logoUrl ?? asset?.bannerUrl ?? null;
  const isPhoto = !asset?.logoUrl && Boolean(asset?.bannerUrl);
  const showImage = src !== null && failedSrc !== src;

  return (
    <div
      className={cn(
        'relative size-16 shrink-0 overflow-hidden rounded-full shadow-sm ring-1 ring-slate-200/80 sm:size-20 dark:ring-white/10',
        showImage ? 'bg-white' : 'flex items-center justify-center'
      )}
      style={showImage ? undefined : { backgroundImage: getFindShowGradient(gradientSeed) }}
    >
      {showImage ? (
        <div
          className={cn(
            'absolute transition-transform duration-500 ease-out group-hover:scale-105',
            isPhoto ? 'inset-0' : wideSrc === src ? 'inset-x-[8%] inset-y-[15%]' : 'inset-[15%]'
          )}
        >
          <Image
            src={src}
            alt={`${name} logo`}
            fill
            sizes="(min-width: 640px) 80px, 64px"
            onError={() => setFailedSrc(src)}
            onLoad={(loadEvent) => {
              const { naturalWidth, naturalHeight } = loadEvent.currentTarget;
              if (naturalHeight > 0 && naturalWidth / naturalHeight >= 2) setWideSrc(src);
            }}
            className={isPhoto ? 'object-cover' : 'object-contain'}
          />
        </div>
      ) : (
        <span
          aria-hidden="true"
          className="select-none text-lg font-black tracking-tight text-white/95 sm:text-xl"
        >
          {getFindShowInitials(name)}
        </span>
      )}
    </div>
  );
}

export function FindShowCard({
  event,
  asset,
  detailHref,
  searchQuery = '',
}: {
  event: FindShowEvent;
  asset?: FindShowAsset;
  detailHref: string;
  /** Active free-text query; matching text is marked in the name and location. */
  searchQuery?: string;
}) {
  const location = [event.city, event.country].filter(Boolean).join(', ');
  // Six catalog events have no website; their ticket link falls back to the
  // detail page, which carries the registration flow, rather than to "#".
  const ticketHref = event.website || detailHref;
  const ticketIsExternal = Boolean(event.website);

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm transition-all duration-300 hover:shadow-xl sm:p-5 dark:border-white/[0.08] dark:bg-[#0f1729]/95 dark:shadow-none dark:hover:bg-[#151e32]',
        marketingCardInteractiveClass
      )}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Reserves two lines so the meta rows and footers line up across a row. */}
          <h3
            title={event.name}
            className="line-clamp-2 min-h-[2.5em] break-words text-[15px] font-bold leading-[1.25] text-slate-950 sm:text-base sm:leading-[1.25] dark:text-white"
          >
            <HighlightText text={event.name} query={searchQuery} anywhere />
          </h3>

          <dl className="mt-3 space-y-1.5 text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
            <div className="flex min-w-0 items-center gap-2">
              <dt className="sr-only">Date</dt>
              <CalendarDays aria-hidden="true" className="size-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
              <dd className="truncate tabular-nums">{event.displayDate}</dd>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <dt className="sr-only">Location</dt>
              <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
              <dd className="truncate" title={location}>
                <HighlightText text={event.city} query={searchQuery} />
                {event.city && event.country ? ', ' : null}
                <HighlightText text={event.country} query={searchQuery} />
              </dd>
            </div>
          </dl>
        </div>

        <FindShowLogo
          name={event.name}
          asset={asset}
          gradientSeed={`${event.slug}-${event.primaryCategory}`}
        />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3.5 dark:border-white/[0.06]">
        <a
          href={ticketHref}
          target={ticketIsExternal ? '_blank' : undefined}
          rel={ticketIsExternal ? 'noopener noreferrer' : undefined}
          aria-label={`Buy tickets for ${event.name}${ticketIsExternal ? ' (opens in a new tab)' : ''}`}
          className={cn(
            'group/ticket relative inline-flex h-9 shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-4 text-xs font-bold tracking-[0.01em] transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:focus-visible:ring-offset-[#0f1729]',
            'border-slate-900/10 bg-slate-950 text-white shadow-[0_8px_20px_rgba(15,23,42,0.14)] hover:border-cyan-400/35 hover:bg-[linear-gradient(135deg,#0891b2,#2563eb)] hover:shadow-[0_14px_28px_rgba(37,99,235,0.22)]',
            'dark:border-white/10 dark:bg-white/[0.06] dark:hover:border-cyan-300/40 dark:hover:bg-[linear-gradient(135deg,rgba(34,211,238,0.88),rgba(59,130,246,0.92))] dark:hover:text-slate-950 dark:hover:shadow-[0_16px_30px_rgba(14,165,233,0.24)]'
          )}
        >
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_62%)] opacity-0 transition-opacity duration-300 group-hover/ticket:opacity-100" />
          <Ticket aria-hidden="true" className="relative z-[1] size-3.5 shrink-0" />
          <span className="relative z-[1] whitespace-nowrap">Buy Ticket</span>
        </a>

        <Link
          href={detailHref}
          aria-label={`View details for ${event.name}`}
          className="group/details inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-1 text-[13px] font-bold text-cyan-600 transition-colors hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 dark:text-cyan-400 dark:hover:text-indigo-300"
        >
          View Details
          <ArrowRight
            aria-hidden="true"
            className="size-3.5 transition-transform duration-200 group-hover/details:translate-x-0.5 motion-reduce:transition-none"
          />
        </Link>
      </div>
    </article>
  );
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, MapPin, Ticket } from 'lucide-react';
import { TRADE_SHOW_TICKET_SIGN_IN_HREF } from '@/lib/auth/routing';
import { cn } from '@/lib/utils';
import { getFindShowAvatarUrl, getFindShowGradient } from '@/lib/find-shows/presentation';
import { marketingCardInteractiveClass } from '@/components/landing/marketing-card-hover';
import type { FindShowAsset, FindShowEvent } from '@/types/find-shows';

export function FindShowCard({
  event,
  asset,
  detailHref,
}: {
  event: FindShowEvent;
  asset?: FindShowAsset;
  detailHref: string;
}) {
  const gradient = getFindShowGradient(`${event.slug}-${event.primaryCategory}`);
  const logoUrl = asset?.logoUrl ?? (asset?.bannerUrl ? asset.bannerUrl : getFindShowAvatarUrl(event.name));
  const ticketButtonClass = cn(
    'group/ticket relative inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 overflow-hidden rounded-full border px-3 py-2 text-[11px] font-bold tracking-[0.01em] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white hover:-translate-y-0.5 sm:min-h-[40px] sm:text-xs dark:focus-visible:ring-offset-[#0f1729]',
    'border-slate-900/10 bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] hover:border-cyan-400/35 hover:bg-[linear-gradient(135deg,#0891b2,#2563eb)] hover:shadow-[0_16px_30px_rgba(37,99,235,0.22)]',
    'dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:hover:border-cyan-300/40 dark:hover:bg-[linear-gradient(135deg,rgba(34,211,238,0.88),rgba(59,130,246,0.92))] dark:hover:text-slate-950 dark:hover:shadow-[0_18px_32px_rgba(14,165,233,0.24)]'
  );
  const buyTicketLabel = (
    <>
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_62%)] opacity-0 transition-opacity duration-300 group-hover/ticket:opacity-100" />
      <Ticket className="relative z-[1] size-3.5 shrink-0" />
      <span className="relative z-[1] truncate">Buy Ticket</span>
    </>
  );

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white/95 p-4 shadow-sm transition-all duration-300 hover:shadow-xl dark:border-white/[0.08] dark:bg-[#0f1729]/95 dark:shadow-none dark:hover:bg-[#151e32]',
        marketingCardInteractiveClass
      )}
    >
      <div className="flex flex-1 gap-4">
        {/* Left Side: Text Details */}
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="line-clamp-2 text-sm font-bold leading-tight text-slate-950 dark:text-white sm:text-base">
            {event.name}
          </h3>
          
          <div className="mt-2.5 space-y-2">
            <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500 dark:text-slate-400">
              <CalendarDays className="size-3.5 shrink-0 text-slate-400" />
              <span>{event.displayDate}</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500 dark:text-slate-400">
              <MapPin className="size-3.5 shrink-0 text-slate-400" />
              <span className="truncate">
                {event.city}, {event.country}
              </span>
            </div>
          </div>
        </div>

        <div className="flex w-[88px] shrink-0 flex-col items-end pt-1 sm:w-[92px]">
          <div className="relative size-20 overflow-hidden rounded-full border border-slate-200/50 bg-slate-50 shadow-inner dark:border-white/10 dark:bg-white/5">
            <Image
              src={logoUrl}
              alt={`${event.name} logo`}
              fill
              sizes="80px"
              className={cn(
                "object-cover transition-transform duration-500 group-hover:scale-110",
                !asset?.logoUrl && asset?.bannerUrl && "brightness-95"
              )}
            />
            {/* Fallback gradient if no logo/banner */}
            {!asset?.logoUrl && !asset?.bannerUrl && (
              <div className="absolute inset-0" style={{ backgroundImage: gradient }} />
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-white/[0.05]">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={event.website || '#'}
            target={event.website ? '_blank' : undefined}
            rel={event.website ? 'noopener noreferrer' : undefined}
            className={cn(ticketButtonClass, 'sm:w-auto sm:min-w-[118px]')}
            aria-label={`Buy tickets for ${event.name}`}
          >
            {buyTicketLabel}
          </a>

          <Link
            href={detailHref}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-cyan-600 transition-colors hover:text-indigo-600 dark:text-cyan-400 dark:hover:text-indigo-400"
          >
            View Details
            <svg 
              className="size-3.5 transition-transform group-hover:translate-x-0.5" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}

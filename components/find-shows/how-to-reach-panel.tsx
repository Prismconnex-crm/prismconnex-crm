'use client';

import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  Bus,
  CableCar,
  CarTaxiFront,
  ChevronDown,
  ExternalLink,
  Footprints,
  Info,
  Loader2,
  MapPin,
  Navigation,
  Plane,
  RotateCw,
  Ship,
  Star,
  TrainFront,
  TrainFrontTunnel,
  TramFront,
} from 'lucide-react';
import { mapDirectionsUrl, mapPlaceUrl } from '@/lib/find-shows/venue-travel';
import type {
  HotelOption,
  HotelStarRating,
  TransitMode,
  TransitStop,
  TravelInfo,
  TravelPlace,
  TravelSource,
} from '@/types/venue-travel';

type IconType = ComponentType<{ className?: string }>;

const MODE_META: Record<TransitMode, { label: string; icon: IconType }> = {
  bus: { label: 'Bus', icon: Bus },
  train: { label: 'Train', icon: TrainFront },
  metro: { label: 'Metro', icon: TrainFrontTunnel },
  subway: { label: 'Subway / Metro', icon: TrainFrontTunnel },
  tram: { label: 'Tram', icon: TramFront },
  'light-rail': { label: 'Light rail', icon: TrainFront },
  ferry: { label: 'Ferry', icon: Ship },
  'cable-car': { label: 'Cable car', icon: CableCar },
  other: { label: 'Transit', icon: MapPin },
};

const STAR_GROUPS: HotelStarRating[] = [5, 4, 3];

/**
 * One travel section as a compact accordion row: card, icon badge and title,
 * with a chevron; its content renders below the heading only while open.
 */
function CollapsibleSection({
  id,
  icon: Icon,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: IconType;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const contentId = `how-to-reach-${id}`;
  return (
    <section className="rounded-3xl border border-slate-200/70 bg-slate-50/50 dark:border-white/[0.08] dark:bg-white/[0.02]">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex w-full items-center gap-3 rounded-3xl px-4 py-2.5 text-left text-sm font-bold uppercase tracking-[0.14em] text-slate-700 transition-colors hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-200 dark:hover:text-indigo-300 sm:px-5"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">{title}</span>
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`}
          />
        </button>
      </h3>
      {open ? (
        <div id={contentId} className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function Unavailable({ children = 'Information unavailable for this location.' }: { children?: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl border border-dashed border-slate-300/80 px-4 py-3 text-sm text-slate-500 dark:border-white/[0.12] dark:text-slate-400">
      <Info className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-white/[0.06] dark:bg-[#0b1120]">
      {children}
    </div>
  );
}

function ActionLink({ href, icon: Icon, children }: { href: string; icon: IconType; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-white/[0.1] dark:text-slate-200 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
    >
      <Icon className="size-3.5" />
      {children}
    </a>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex flex-wrap gap-2">{children}</div>;
}

function Sources({ sources, prefix = 'Source' }: { sources: TravelSource[]; prefix?: string }) {
  return (
    <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
      {prefix}:{' '}
      {sources.map((source, index) => (
        <span key={`${source.url}-${index}`}>
          {index > 0 ? ' · ' : null}
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
            {source.label}
          </a>
        </span>
      ))}
    </p>
  );
}

function Detail({ icon: Icon, children }: { icon: IconType; children: ReactNode }) {
  return (
    <p className="mt-1.5 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" />
      <span>{children}</span>
    </p>
  );
}

function StopCard({ stop, venue }: { stop: TransitStop; venue: TravelPlace }) {
  const { label, icon: ModeIcon } = MODE_META[stop.mode];
  return (
    <Card>
      <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        <ModeIcon className="size-3.5" />
        {stop.network ?? label}
      </p>
      <p className="mt-1 font-semibold text-slate-900 dark:text-white">{stop.place.name}</p>
      {stop.routes?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {stop.routes.map((route) => (
            <span
              key={route}
              className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
            >
              {route}
            </span>
          ))}
        </div>
      ) : null}
      {stop.distance ? <Detail icon={MapPin}>{stop.distance}</Detail> : null}
      {stop.walking ? <Detail icon={Footprints}>{stop.walking}</Detail> : null}
      {stop.note ? <Detail icon={Info}>{stop.note}</Detail> : null}
      <Actions>
        <ActionLink href={mapPlaceUrl(stop.place)} icon={MapPin}>
          View on Map
        </ActionLink>
        <ActionLink href={mapDirectionsUrl(venue, stop.place)} icon={Navigation}>
          Get Directions
        </ActionLink>
      </Actions>
      <Sources sources={stop.sources} />
    </Card>
  );
}

function HotelCard({ hotel, venue }: { hotel: HotelOption; venue: TravelPlace }) {
  return (
    <Card>
      <p className="font-semibold text-slate-900 dark:text-white">{hotel.place.name}</p>
      {hotel.stars ? (
        <p className="mt-1 flex items-center gap-0.5" aria-label={`${hotel.stars}-star hotel`}>
          {Array.from({ length: hotel.stars }, (_, index) => (
            <Star key={index} className="size-3.5 fill-amber-400 text-amber-400" />
          ))}
        </p>
      ) : null}
      {hotel.place.address ? <Detail icon={MapPin}>{hotel.place.address}</Detail> : null}
      {hotel.distance ? <Detail icon={Footprints}>{hotel.distance}</Detail> : null}
      {hotel.note ? <Detail icon={Info}>{hotel.note}</Detail> : null}
      <Actions>
        <ActionLink href={mapPlaceUrl(hotel.place)} icon={ExternalLink}>
          View Hotel
        </ActionLink>
        <ActionLink href={mapDirectionsUrl(venue, hotel.place)} icon={Navigation}>
          Get Directions
        </ActionLink>
      </Actions>
      <Sources sources={hotel.sources} />
    </Card>
  );
}

function HotelGroup({ title, hotels, venue }: { title: string; hotels: HotelOption[]; venue: TravelPlace }) {
  if (!hotels.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{title}</p>
      <div className="space-y-3">
        {hotels.map((hotel) => (
          <HotelCard key={`${hotel.place.name}-${hotel.place.address ?? ''}`} hotel={hotel} venue={venue} />
        ))}
      </div>
    </div>
  );
}

type SectionId = 'flight' | 'bus' | 'public-transport' | 'taxi';

/**
 * The How to Reach layout for every event: the venue block, always visible,
 * then the four transport sections as accordion rows — all closed at first, one
 * open at a time, the open one closing when clicked again. Content comes from
 * the event's own `info`; a section with nothing verified shows its
 * "Information unavailable" state rather than being hidden.
 */
export function HowToReachView({ info, onRetry }: { info: TravelInfo; onRetry?: () => void }) {
  const venue = info.venue;
  const located = info.reference !== 'none';
  const [openSection, setOpenSection] = useState<SectionId | null>(null);

  const sections: { id: SectionId; icon: IconType; title: string; content: ReactNode }[] = [
    {
      id: 'flight',
      icon: Plane,
      title: 'By Flight',
      content: (
        <>
          {info.airports.length ? (
            info.airports.map((airport) => (
              <Card key={`${airport.place.name}-${airport.code ?? ''}`}>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {airport.place.name}
                  {airport.code ? (
                    <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">
                      {airport.code}
                    </span>
                  ) : null}
                </p>
                {airport.city ? <Detail icon={Info}>{airport.city}</Detail> : null}
                {airport.distance ? <Detail icon={MapPin}>{airport.distance}</Detail> : null}
                {airport.travelInfo ? <Detail icon={Info}>{airport.travelInfo}</Detail> : null}
                <Actions>
                  <ActionLink href={mapPlaceUrl(airport.place)} icon={ExternalLink}>
                    View Airport
                  </ActionLink>
                  <ActionLink href={mapDirectionsUrl(venue, airport.place)} icon={Navigation}>
                    Get Directions
                  </ActionLink>
                </Actions>
                <Sources sources={airport.sources} />
              </Card>
            ))
          ) : (
            <Unavailable />
          )}
        </>
      ),
    },
    {
      id: 'bus',
      icon: Bus,
      title: 'By Bus',
      content: (
        <>
          {info.buses.length ? (
            info.buses.map((stop) => <StopCard key={`${stop.place.name}-${stop.network ?? ''}`} stop={stop} venue={venue} />)
          ) : (
            <Unavailable />
          )}
        </>
      ),
    },
    {
      id: 'public-transport',
      icon: TrainFront,
      title: 'Public Transport',
      content: (
        <>
          {info.publicTransport.length ? (
            info.publicTransport.map((stop) => (
              <StopCard key={`${stop.mode}-${stop.place.name}`} stop={stop} venue={venue} />
            ))
          ) : (
            <Unavailable />
          )}
        </>
      ),
    },
    {
      id: 'taxi',
      icon: CarTaxiFront,
      title: 'Taxi / Rideshare',
      content: (
        <>
          {info.taxi?.points.length ? (
            <Card>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {info.taxi.points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <CarTaxiFront className="mt-0.5 size-4 shrink-0 text-slate-400" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <Sources sources={info.taxi.sources} />
            </Card>
          ) : (
            <Unavailable />
          )}
        </>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-white">{venue.name}</span>
          {venue.address ? <span className="block text-slate-500 dark:text-slate-400">{venue.address}</span> : null}
        </p>
        {located || venue.address ? (
          <ActionLink href={mapPlaceUrl(venue)} icon={MapPin}>
            View venue on map
          </ActionLink>
        ) : null}
      </div>

      {info.notices.map((notice) => (
        <Unavailable key={notice}>{notice}</Unavailable>
      ))}
      {info.retryable && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-white/[0.1] dark:text-slate-200 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
        >
          <RotateCw className="size-3.5" />
          Try again
        </button>
      ) : null}

      <div className="space-y-2.5">
        {sections.map((section) => (
          <CollapsibleSection
            key={section.id}
            id={section.id}
            icon={section.icon}
            title={section.title}
            open={openSection === section.id}
            onToggle={() => setOpenSection((current) => (current === section.id ? null : section.id))}
          >
            {section.content}
          </CollapsibleSection>
        ))}
      </div>

      {info.attribution.length ? <Sources sources={info.attribution} prefix="Map data" /> : null}
    </div>
  );
}

/**
 * The Nearby Hotels tab: the hotel groups that used to sit in the How to Reach
 * accordion, rendered from the same `info` — 5, 4, 3 star, then unrated.
 */
export function NearbyHotelsView({ info }: { info: TravelInfo }) {
  const venue = info.venue;
  const unratedHotels = info.hotels.filter((hotel) => !hotel.stars);

  return (
    <div className="space-y-5">
      {info.hotels.length ? (
        <div className="space-y-5">
          {STAR_GROUPS.map((stars) => (
            <HotelGroup
              key={stars}
              title={`${stars} Star`}
              hotels={info.hotels.filter((hotel) => hotel.stars === stars)}
              venue={venue}
            />
          ))}
          <HotelGroup title="Rating not published" hotels={unratedHotels} venue={venue} />
        </div>
      ) : (
        <Unavailable />
      )}

      {info.attribution.length ? <Sources sources={info.attribution} prefix="Map data" /> : null}
    </div>
  );
}

type LoadState = { status: 'loading' } | { status: 'ready'; info: TravelInfo } | { status: 'error' };

/**
 * One travel lookup per event, shared by the How to Reach and Nearby Hotels
 * tabs so switching between them neither refetches nor flashes the spinner.
 * A failed lookup is dropped from the cache so the next attempt refetches.
 */
const travelRequests = new Map<string, Promise<TravelInfo>>();

function loadTravelInfo(slug: string): Promise<TravelInfo> {
  let request = travelRequests.get(slug);
  if (!request) {
    request = fetch(`/api/find-shows/travel?slug=${encodeURIComponent(slug)}`).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<TravelInfo>;
    });
    request.catch(() => travelRequests.delete(slug));
    travelRequests.set(slug, request);
  }
  return request;
}

/**
 * Radix mounts a tab's content only while it is open, so the travel lookup
 * runs when either travel tab is first opened, for this event only.
 */
function useTravelInfo(slug: string) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    loadTravelInfo(slug)
      .then((info) => active && setState({ status: 'ready', info }))
      .catch(() => active && setState({ status: 'error' }));
    return () => {
      active = false;
    };
  }, [slug, attempt]);

  const retry = () => {
    travelRequests.delete(slug);
    setAttempt((current) => current + 1);
  };

  return { state, retry };
}

function TravelPanel({
  slug,
  loadingLabel,
  children,
}: {
  slug: string;
  loadingLabel: string;
  children: (info: TravelInfo, retry: () => void) => ReactNode;
}) {
  const { state, retry } = useTravelInfo(slug);

  if (state.status === 'loading') {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-slate-200/70 px-4 py-6 text-sm text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
        <Loader2 className="size-4 animate-spin" />
        {loadingLabel}
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="space-y-3">
        <Unavailable>Travel information could not be loaded. Please try again shortly.</Unavailable>
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-white/[0.1] dark:text-slate-200 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
        >
          <RotateCw className="size-3.5" />
          Try again
        </button>
      </div>
    );
  }
  return <>{children(state.info, retry)}</>;
}

/** The How to Reach tab: venue block plus the four transport sections. */
export function HowToReachPanel({ slug }: { slug: string }) {
  return (
    <TravelPanel slug={slug} loadingLabel="Finding airports and transport near the venue…">
      {(info, retry) => <HowToReachView info={info} onRetry={retry} />}
    </TravelPanel>
  );
}

/** The Nearby Hotels tab. */
export function NearbyHotelsPanel({ slug }: { slug: string }) {
  return (
    <TravelPanel slug={slug} loadingLabel="Finding hotels near the venue…">
      {(info) => <NearbyHotelsView info={info} />}
    </TravelPanel>
  );
}

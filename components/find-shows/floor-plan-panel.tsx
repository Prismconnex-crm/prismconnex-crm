'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Info, Loader2, Map as MapIcon, RotateCw } from 'lucide-react';
import type { FindShowFloorPlan } from '@/lib/find-shows/floor-plan';
import type { FloorPlanStatus, FloorPlanTrace } from '@/lib/find-shows/floor-plan-discovery';
import { PdfPlanViewer } from './pdf-plan-viewer';
import { FramePlanViewer, ImagePlanViewer } from './plan-viewer-frame';

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300/80 p-8 text-center dark:border-white/[0.12]">
      <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
        <Info className="size-4 shrink-0" />
        {children}
      </p>
    </div>
  );
}

const linkClass =
  'inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-white/[0.1] dark:text-slate-200 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300';

/**
 * A verified plan, the same for every event: the edition's dates, "Open floor
 * plan", and the plan itself in the zoomable frame (−, Fit, +) — a PDF drawn
 * with pdf.js, an image, or the organizer's interactive plan/plan page when it
 * may be framed. A page that refuses framing is linked instead.
 */
function FloorPlanView({ floorPlan, eventName, editionDate }: { floorPlan: FindShowFloorPlan; eventName: string; editionDate?: string }) {
  const view = floorPlan.viewUrl ?? floorPlan.url;
  const title = `${eventName} floor plan`;
  const framed = (floorPlan.kind === 'interactive' || floorPlan.kind === 'page') && floorPlan.embeddable;
  return (
    <div className="space-y-4 rounded-3xl border border-slate-200/70 bg-slate-50/50 p-5 dark:border-white/[0.08] dark:bg-white/[0.02] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <MapIcon className="size-4 shrink-0 text-indigo-500" />
          {/* The dates printed on the plan, else the edition's dates from the catalog. */}
          <span>{floorPlan.edition ?? editionDate ?? 'Official floor plan'}</span>
        </p>
        <a href={floorPlan.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <ExternalLink className="size-3.5" />
          Open floor plan
        </a>
      </div>

      {floorPlan.note ? <p className="text-xs text-slate-500 dark:text-slate-400">{floorPlan.note}</p> : null}

      {floorPlan.kind === 'pdf' ? <PdfPlanViewer url={view} title={title} /> : null}
      {floorPlan.kind === 'image' ? <ImagePlanViewer src={view} title={title} /> : null}
      {framed ? <FramePlanViewer src={floorPlan.url} title={title} /> : null}
      {(floorPlan.kind === 'page' || floorPlan.kind === 'interactive') && !framed ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          The organizer publishes the floor plan on its own page, which can’t be shown inside this one. Use “Open floor plan” to view it.
        </p>
      ) : null}

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Source:{' '}
        <a href={floorPlan.source.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
          {floorPlan.source.label}
        </a>
      </p>
    </div>
  );
}

// --- Debug view (development: add ?floorPlanDebug=1, or =fresh to search again) --------

function DebugRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}

const decisionClass = {
  accepted: 'text-emerald-600 dark:text-emerald-400',
  rejected: 'text-rose-600 dark:text-rose-400',
  unchecked: 'text-slate-400',
} as const;

function FloorPlanDebug({ trace, cached }: { trace: FloorPlanTrace; cached?: boolean }) {
  const { event } = trace;
  return (
    <details open className="mt-4 rounded-2xl border border-amber-300/70 bg-amber-50/60 p-4 text-[11px] leading-relaxed text-slate-700 dark:border-amber-400/30 dark:bg-amber-500/[0.06] dark:text-slate-300">
      <summary className="cursor-pointer text-xs font-bold text-amber-700 dark:text-amber-300">
        Floor-plan discovery debug — {trace.outcome}: {trace.outcomeReason}
      </summary>
      <dl className="mt-3 space-y-1">
        <DebugRow label="Event" value={event.name} />
        <DebugRow label="Year / dates" value={`${event.year} · ${event.dates}`} />
        <DebugRow label="City" value={`${event.city}${event.country ? `, ${event.country}` : ''}`} />
        <DebugRow label="Venue" value={event.venue || '—'} />
        <DebugRow label="Organizer" value={event.organizer || '—'} />
        <DebugRow label="Official URL" value={event.website} />
        <DebugRow label="Official sites" value={[...trace.officialSites, ...trace.relatedSites.map((site) => `${site.site} (${site.role})`)].join(', ')} />
        {event.otherCitiesOnSite.length ? <DebugRow label="Other cities" value={event.otherCitiesOnSite.join(', ')} /> : null}
        <DebugRow
          label="Effort"
          value={`${trace.pagesFetched} pages/lookups, ${trace.candidatesChecked} candidates, ${(trace.ms / 1000).toFixed(1)} s${cached ? ' (cached result)' : ''} · ${trace.checkedAt}`}
        />
      </dl>

      <p className="mt-4 font-bold">Search queries ({trace.queries.length})</p>
      <ul className="mt-1 space-y-0.5">
        {trace.queries.map((query) => (
          <li key={query.query} className="break-words">
            {query.query} → {query.error ? <span className="text-rose-600">{query.error}</span> : `${query.results} results, ${query.used.length} official used, ${query.ignored} non-official ignored`}
          </li>
        ))}
        {!trace.queries.length ? <li className="text-slate-400">none (web search disabled)</li> : null}
      </ul>

      <p className="mt-4 font-bold">Candidates ({trace.candidates.length})</p>
      <ul className="mt-1 space-y-2">
        {trace.candidates.map((candidate, index) => (
          <li key={`${candidate.url}-${index}`} className="break-words">
            <span className={`font-semibold uppercase ${decisionClass[candidate.decision]}`}>{candidate.decision}</span>{' '}
            <span className="text-slate-400">[{candidate.kind}]</span>{' '}
            <a href={candidate.url} target="_blank" rel="noopener noreferrer" className="underline">
              {candidate.url}
            </a>
            <br />
            <span>{candidate.reason}</span>
            {candidate.evidence.length ? <span className="text-slate-500"> — {candidate.evidence.join('; ')}</span> : null}
            <br />
            <span className="text-slate-400">
              via {candidate.via} · found on {candidate.foundOn}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 font-bold">Sources checked ({trace.sources.length})</p>
      <ul className="mt-1 space-y-0.5">
        {trace.sources.map((source, index) => (
          <li key={`${source.url}-${index}`} className="break-words">
            <span className={source.status === 'ok' ? 'text-emerald-600' : source.status === 'error' ? 'text-rose-600' : 'text-slate-400'}>{source.status}</span>{' '}
            <span className="text-slate-400">[{source.via}]</span> {source.url} — {source.note}
            {source.ms !== undefined ? <span className="text-slate-400"> ({source.ms} ms)</span> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

type Loaded = { status: FloorPlanStatus; floorPlan: FindShowFloorPlan | null; trace?: FloorPlanTrace; cached?: boolean };
type LoadState = { status: 'loading' } | { status: 'ready'; result: Loaded };

/** ?floorPlanDebug=1 shows the discovery trace; =fresh also searches again instead of using the cache. */
function debugParams() {
  if (typeof window === 'undefined') return '';
  const mode = new URLSearchParams(window.location.search).get('floorPlanDebug');
  return mode === 'fresh' ? '&debug=1&fresh=1' : mode ? '&debug=1' : '';
}

/**
 * The Floor Plan tab. Radix mounts a tab's content only while it is open, so
 * the lookup runs when the tab is first opened, for this event only. It says
 * none has been published only when the official sources were searched through
 * without finding a verified plan; a search that could not finish says so.
 */
export function FloorPlanPanel({ slug, eventName, editionDate }: { slug: string; eventName: string; editionDate?: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Bumped by "Try again": asks the server to search an unsettled edition again now.
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    const retry = retries > 0 ? '&retry=1' : '';
    fetch(`/api/find-shows/floor-plan?slug=${encodeURIComponent(slug)}${retry}${debugParams()}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { status: 'NETWORK_ERROR', floorPlan: null }))
      .then((result: Loaded) => setState({ status: 'ready', result }))
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setState({ status: 'ready', result: { status: 'NETWORK_ERROR', floorPlan: null } });
      });
    return () => controller.abort();
  }, [slug, retries]);

  if (state.status === 'loading') {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-slate-200/70 px-4 py-6 text-sm text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
        <Loader2 className="size-4 animate-spin" />
        Looking for the official floor plan…
      </p>
    );
  }
  const { result } = state;
  return (
    <>
      {result.floorPlan ? (
        <FloorPlanView floorPlan={result.floorPlan} eventName={eventName} editionDate={editionDate} />
      ) : result.status === 'VERIFIED_NO_PLAN' ? (
        <Notice>No floor plan has been published for this event yet.</Notice>
      ) : (
        // DISCOVERY_INCOMPLETE, NETWORK_ERROR, DOWNLOAD_FAILED: unsettled, never "none published".
        <div className="space-y-3 rounded-2xl border border-dashed border-slate-300/80 p-8 text-center dark:border-white/[0.12]">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Info className="size-4 shrink-0" />
            We couldn’t finish checking the organizer’s website for a floor plan.
          </p>
          <div>
            <button type="button" onClick={() => setRetries((count) => count + 1)} className={linkClass}>
              <RotateCw className="size-3.5" />
              Try again
            </button>
          </div>
        </div>
      )}
      {result.trace ? <FloorPlanDebug trace={result.trace} cached={result.cached} /> : null}
    </>
  );
}

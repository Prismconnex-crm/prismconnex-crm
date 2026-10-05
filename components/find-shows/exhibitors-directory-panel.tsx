'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Globe, Info, Loader2, Lock, MapPin, RotateCw, Search, Store, X } from 'lucide-react';
import { ExhibitorDetailDialog, ExhibitorLogo } from './exhibitor-detail-dialog';
import { OfficialPageDialog, type OfficialPageTarget } from './official-page-view';
import { signInHrefReturningTo } from '@/lib/auth/return-to';
import { exhibitorsContextUrl, readExhibitorsContext, withoutExhibitor } from '@/lib/find-shows/exhibitor-return';
import {
  ALPHABET,
  filterCards,
  letterCounts,
  type ExhibitorCard,
  type ExhibitorDirectory,
} from '@/lib/find-shows/exhibitors';

const PAGE_SIZE = 48;

const linkClass =
  'inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-white/[0.1] dark:text-slate-200 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300';

const cardClass =
  'group flex h-full w-full min-w-0 flex-col gap-3 rounded-2xl border border-slate-200/60 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-white/[0.06] dark:bg-[#0b1120] dark:hover:border-indigo-400/40';

/** The count block the tab always opens with: the directory's count once known, else the catalog's. */
function Summary({ count, fallbackCount }: { count: number | null; fallbackCount: number | null }) {
  const shown = count ?? fallbackCount;
  return (
    <div className="flex items-center gap-4">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
        <Store className="size-7" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Exhibiting Companies</p>
        <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{shown ? shown.toLocaleString() : 'TBA'}</p>
      </div>
    </div>
  );
}

function Notice({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-slate-300/80 p-6 text-center dark:border-white/[0.12]">
      <p className="inline-flex items-start gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>{children}</span>
      </p>
      {action ? <div className="flex justify-center">{action}</div> : null}
    </div>
  );
}

function CardBody({ card }: { card: ExhibitorCard }) {
  return (
    <>
      <ExhibitorLogo card={card} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="break-words text-sm font-bold leading-snug text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
          {card.name}
        </p>
        {card.booths.length ? (
          <p className="flex items-start gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <MapPin className="mt-px size-3.5 shrink-0" />
            <span className="break-words">Booth {card.booths.join(', ')}</span>
          </p>
        ) : null}
        {card.description ? (
          <p className="line-clamp-3 break-words text-xs leading-relaxed text-slate-600 dark:text-slate-300">{card.description}</p>
        ) : null}
      </div>
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">
        View details <ChevronRight className="size-3" />
      </span>
    </>
  );
}

/**
 * One exhibitor, from any platform. "View details" opens its details inside Prismconnex
 * (ExhibitorDetailDialog); only the dialog's explicit official-profile button leaves the app.
 */
function ExhibitorTile({ card, onOpen }: { card: ExhibitorCard; onOpen: (card: ExhibitorCard) => void }) {
  return (
    <button type="button" onClick={() => onOpen(card)} className={cardClass} aria-haspopup="dialog" aria-label={`${card.name} — view details`}>
      <CardBody card={card} />
    </button>
  );
}

/** Whether the visitor is signed in to Prismconnex, asked of the existing session endpoint (the cookie is httpOnly). */
async function isSignedIn() {
  try {
    return (await fetch('/api/auth/me', { cache: 'no-store' })).ok;
  } catch {
    return false;
  }
}

function DirectoryView({ slug, directory, onOfficial }: { slug: string; directory: ExhibitorDirectory; onOfficial: (target: OfficialPageTarget) => void }) {
  const router = useRouter();
  // Search, letter and the exhibitor to open, when the address carries them (back from sign-in, or Back from it).
  // This view renders only on the client, after the list has loaded, so reading the address here is safe.
  const [initial] = useState(() => readExhibitorsContext(window.location.search));
  const [query, setQuery] = useState(initial.query);
  const [letter, setLetter] = useState<string | null>(initial.letter);
  const [visible, setVisible] = useState(PAGE_SIZE);
  // The exhibitor whose details are open. The list stays mounted behind them, so closing returns to it as it was.
  const [detailCard, setDetailCard] = useState<ExhibitorCard | null>(null);
  const signedIn = useRef(false);
  const { exhibitors, source } = directory;

  const counts = useMemo(() => letterCounts(exhibitors), [exhibitors]);
  const matches = useMemo(() => filterCards(exhibitors, { query, letter }), [exhibitors, query, letter]);
  useEffect(() => setVisible(PAGE_SIZE), [query, letter]);

  /**
   * "View details", for any exhibitor of any event: signed-in visitors see the details at once; anyone else
   * goes through the existing Prismconnex sign-in, which returns to this event with this exhibitor and these
   * filters, and the details open there. Back or a cancelled sign-in returns to the same list, details closed.
   */
  const openDetails = async (card: ExhibitorCard) => {
    if (signedIn.current || (await isSignedIn())) {
      signedIn.current = true;
      setDetailCard(card);
      return;
    }
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, '', exhibitorsContextUrl(pathname, search, { query, letter }));
    router.push(signInHrefReturningTo(exhibitorsContextUrl(pathname, search, { query, letter, exhibitorId: card.id })));
  };

  // Back from sign-in with an exhibitor to open: open it once the session is confirmed, and drop it from the
  // address so a reload or Back does not reopen it. Without a session (sign-in cancelled) nothing opens.
  useEffect(() => {
    if (!initial.exhibitorId) return;
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, '', withoutExhibitor(pathname, search));
    const card = exhibitors.find((item) => item.id === initial.exhibitorId);
    if (!card) return;
    let live = true;
    isSignedIn().then((ok) => {
      if (live && ok) {
        signedIn.current = true;
        setDetailCard(card);
      }
    });
    return () => {
      live = false;
    };
    // Once, for the address this view was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const letterClass = (active: boolean, disabled: boolean) =>
    `flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-xs font-bold transition-colors ${
      active
        ? 'bg-indigo-600 text-white'
        : disabled
          ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
          : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300'
    }`;

  return (
    <div className="space-y-4">
      {directory.total || directory.partial ? (
        <p className="flex items-start gap-2 rounded-2xl bg-indigo-50 px-4 py-3 text-xs leading-relaxed text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200">
          <Info className="mt-px size-4 shrink-0" />
          <span>
            {directory.total
              ? `Showing the first ${exhibitors.length.toLocaleString()} of ${directory.total.toLocaleString()} exhibitors the official directory publishes.`
              : `Showing the first ${exhibitors.length.toLocaleString()} exhibitors; the official directory lists more.`}{' '}
            {source ? (
              <button type="button" onClick={() => onOfficial({ kind: 'directory' })} className="font-semibold underline underline-offset-2">
                See the full list
              </button>
            ) : null}
          </span>
        </p>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search exhibitors by company name"
          aria-label="Search exhibitors by company name"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/[0.1] dark:bg-[#0b1120] dark:text-white"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {/* A–Z wraps onto more lines on a phone rather than scrolling the page sideways. */}
      <div role="group" aria-label="Browse exhibitors alphabetically" className="flex flex-wrap gap-1">
        <button type="button" onClick={() => setLetter(null)} className={letterClass(letter === null, false)} aria-pressed={letter === null}>
          All
        </button>
        {ALPHABET.map((item) => (
          <button
            key={item}
            type="button"
            disabled={!counts[item]}
            onClick={() => setLetter(letter === item ? null : item)}
            className={letterClass(letter === item, !counts[item])}
            aria-pressed={letter === item}
            aria-label={item === '#' ? 'Names starting with a digit or symbol' : `Names starting with ${item}`}
          >
            {item}
          </button>
        ))}
      </div>

      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400" aria-live="polite">
        {matches.length === exhibitors.length
          ? `${exhibitors.length.toLocaleString()} exhibitors`
          : `${matches.length.toLocaleString()} of ${exhibitors.length.toLocaleString()} exhibitors`}
      </p>

      {matches.length ? (
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          {matches.slice(0, visible).map((card) => (
            <ExhibitorTile key={card.id} card={card} onOpen={openDetails} />
          ))}
        </div>
      ) : (
        <Notice
          action={
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setLetter(null);
              }}
              className={linkClass}
            >
              Clear filters
            </button>
          }
        >
          No exhibitors match {query ? `“${query}”` : 'this letter'}.
        </Notice>
      )}

      {matches.length > visible ? (
        <div className="flex justify-center">
          <button type="button" onClick={() => setVisible((current) => current + PAGE_SIZE)} className={linkClass}>
            Show more ({(matches.length - visible).toLocaleString()} more)
          </button>
        </div>
      ) : null}

      {source ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500">
          <span>
            Source: {source.editionLabel} · {source.platformLabel}
          </span>
          <button type="button" onClick={() => onOfficial({ kind: 'directory' })} className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
            Official directory <Globe className="size-3" />
          </button>
        </p>
      ) : null}

      <ExhibitorDetailDialog slug={slug} card={detailCard} source={source} onClose={() => setDetailCard(null)} />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-4" aria-busy="true">
      <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="size-4 animate-spin" />
        Finding official exhibitors…
      </p>
      <div className="h-11 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]" />
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-2xl border border-slate-200/60 p-4 dark:border-white/[0.06]">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]" />
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-white/[0.04]" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100 dark:bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}

type LoadState = { status: 'loading' } | { status: 'ready'; directory: ExhibitorDirectory } | { status: 'error' };
type ApiAnswer = ExhibitorDirectory & { pending?: boolean };

/** While the server is still searching, ask again this often, for up to this long. */
const POLL_MS = 4_000;
const MAX_WAIT_MS = 4 * 60_000;

const FAILED_MESSAGE = 'We couldn’t finish checking the official exhibitor directory. Please try again.';

/**
 * The Exhibitors tab: the edition's official exhibitor directory as cards —
 * logo, name, booth, short description — with search and A–Z browsing, each
 * card opening the exhibitor's official profile. Radix mounts a tab's content
 * only while it is open, so opening the tab is what looks the directory up:
 * the server answers from its per-edition store, or searches the official
 * sites now. A search that outlasts one request answers `pending`; the tab
 * keeps showing "Finding official exhibitors…" and asks again until it ends.
 */
export function ExhibitorsDirectoryPanel({ slug, fallbackCount }: { slug: string; fallbackCount: number | null }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // An official page (directory, sign-in) shown inside Prismconnex: no link here opens a tab or leaves the app.
  const [official, setOfficial] = useState<OfficialPageTarget | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState({ status: 'loading' });

    const ask = (retry: boolean) => {
      const url = `/api/find-shows/exhibitors?slug=${encodeURIComponent(slug)}${retry ? '&retry=1' : ''}`;
      fetch(url, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json() as Promise<ApiAnswer>;
        })
        .then((answer) => {
          if (answer.pending) {
            if (Date.now() - started > MAX_WAIT_MS) setState({ status: 'error' });
            else timer = setTimeout(() => ask(false), POLL_MS);
            return;
          }
          setState({ status: 'ready', directory: answer });
        })
        .catch((error: Error) => {
          if (error.name !== 'AbortError') setState({ status: 'error' });
        });
    };
    // "Try again" asks the server to search again after an unfinished check.
    ask(attempt > 0);
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [slug, attempt]);

  const retry = (
    <button type="button" onClick={() => setAttempt((current) => current + 1)} className={linkClass}>
      <RotateCw className="size-3.5" />
      Try again
    </button>
  );

  const directory = state.status === 'ready' ? state.directory : null;
  const listed = directory?.status === 'VERIFIED_LIST' ? directory.total ?? directory.exhibitors.length : null;

  return (
    <div className="space-y-5 rounded-3xl border border-slate-200/70 bg-slate-50/50 p-4 dark:border-white/[0.08] dark:bg-white/[0.02] sm:p-6">
      <Summary count={listed} fallbackCount={fallbackCount} />
      <div className="border-t border-slate-200/60 pt-5 dark:border-white/[0.08]">
        {state.status === 'loading' ? <SkeletonGrid /> : null}
        {state.status === 'error' || directory?.status === 'DISCOVERY_INCOMPLETE' ? <Notice action={retry}>{FAILED_MESSAGE}</Notice> : null}
        {directory?.status === 'VERIFIED_LIST' ? <DirectoryView slug={slug} directory={directory} onOfficial={setOfficial} /> : null}
        {directory?.status === 'LOGIN_REQUIRED_DIRECTORY' && directory.source ? (
          <Notice
            action={
              <button type="button" onClick={() => setOfficial({ kind: 'login' })} className={linkClass}>
                <Lock className="size-3.5" />
                Log in on {directory.source.platformLabel} to view exhibitors
              </button>
            }
          >
            The official exhibitor directory for {directory.source.editionLabel} is only available to signed-in users on {directory.source.platformLabel}.
          </Notice>
        ) : null}
        {directory?.status === 'VERIFIED_EMPTY_DIRECTORY' ? (
          <Notice
            action={
              directory.source ? (
                <button type="button" onClick={() => setOfficial({ kind: 'directory' })} className={linkClass}>
                  <Globe className="size-3.5" />
                  Official directory
                </button>
              ) : undefined
            }
          >
            Official exhibitor directory found, but exhibitors have not been published yet.
          </Notice>
        ) : null}
        {directory?.status === 'OFFICIAL_DIRECTORY_LINK' && directory.source ? (
          <Notice
            action={
              <button type="button" onClick={() => setOfficial({ kind: 'directory' })} className={linkClass}>
                <Globe className="size-3.5" />
                Open the official exhibitor directory
              </button>
            }
          >
            The official exhibitor directory for {directory.source.editionLabel} is on the organizer’s website; its exhibitors could not be listed here.
          </Notice>
        ) : null}
        {directory?.status === 'NO_VERIFIED_DIRECTORY' ? <Notice>Official exhibitor information is not available yet.</Notice> : null}
      </div>
      <OfficialPageDialog
        slug={slug}
        target={official}
        title={official?.kind === 'login' && directory?.source ? `Sign in on ${directory.source.platformLabel}` : 'Official exhibitor directory'}
        onClose={() => setOfficial(null)}
      />
    </div>
  );
}

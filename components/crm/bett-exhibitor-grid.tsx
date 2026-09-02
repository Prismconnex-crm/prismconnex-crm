"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink, Globe2, MapPin, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Exhibitor } from "@/types/exhibitors";
import { ExhibitorContactModal } from "./exhibitor-contact-modal";

/**
 * BETT-only exhibitor browser: a card grid instead of the shared vertical list.
 * Server-paginated through /api/exhibitors (page/pageSize/q/sort), with page and
 * pageSize mirrored into the URL so a refresh restores the same view.
 *
 * Every card is an external anchor — clicking one opens the exhibitor's own site
 * in a new tab and never navigates inside the CRM.
 */

/** Last-resort target when an exhibitor published no site and no directory page. */
const BETT_DIRECTORY_FALLBACK = "https://uk.bettshow.com/solution-providers";

const PAGE_SIZE_OPTIONS = [24, 48, 96];
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 96;

type SortKey = "name" | "stand" | "country";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  stand: "Stand",
  country: "Country",
};

type ExhibitorPage = {
  items: Exhibitor[];
  totalCount: number;
  imported: number;
  withWebsiteCount: number;
  totalPages: number;
};

/** website -> this exhibitor's directory page -> the event directory -> BETT's. */
function exhibitorHref(ex: Exhibitor) {
  return ex.website || ex.profileUrl || ex.directoryUrl || BETT_DIRECTORY_FALLBACK;
}

function prettyDomain(url: string | null | undefined) {
  if (!url) return null;
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "");
}

function readNumberParam(params: URLSearchParams, key: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(params.get(key) ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Page buttons with ellipsis: 1 … 4 5 [6] 7 8 … 14 */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const candidates = [1, total, current, current - 1, current + 1];
  if (current <= 3) candidates.push(2, 3, 4);
  if (current >= total - 2) candidates.push(total - 3, total - 2, total - 1);
  const sorted = candidates
    .filter((p, i) => p >= 1 && p <= total && candidates.indexOf(p) === i)
    .sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function BettExhibitorGrid({ eventSlug, expected }: { eventSlug: string; expected?: number | null }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<SortKey>("name");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  // The URL is only readable on the client, so state is restored after mount and
  // fetching waits for it — seeding during render would break hydration.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPage(readNumberParam(params, "page", 1, 1, 10_000));
    setPageSize(readNumberParam(params, "pageSize", DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE));
    const urlSort = params.get("sort");
    if (urlSort === "stand" || urlSort === "country" || urlSort === "name") setSort(urlSort);
    const urlQuery = params.get("q") ?? "";
    setQueryInput(urlQuery);
    setQuery(urlQuery);
    setReady(true);
  }, []);

  // The exhibitor whose contact card is open; null closes the modal.
  const [selected, setSelected] = useState<Exhibitor | null>(null);
  const [data, setData] = useState<ExhibitorPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Debounce typing so each keystroke doesn't hit the API.
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      setQuery((prev) => {
        if (prev === queryInput) return prev;
        setPage(1);
        return queryInput;
      });
    }, 300);
    return () => clearTimeout(id);
  }, [queryInput, ready]);

  // Mirror state into the URL without a Next navigation — the page around the
  // grid must stay exactly as it is.
  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (query) params.set("q", query);
    else params.delete("q");
    if (sort !== "name") params.set("sort", sort);
    else params.delete("sort");
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [page, pageSize, query, sort, ready]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      eventSlug,
      page: String(page),
      pageSize: String(pageSize),
      sort,
    });
    if (query) params.set("q", query);

    fetch(`/api/exhibitors?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (json.error) throw new Error(json.error);
        setData({
          items: json.items ?? [],
          totalCount: json.totalCount ?? 0,
          imported: json.imported ?? 0,
          withWebsiteCount: json.withWebsiteCount ?? 0,
          totalPages: json.totalPages ?? 1,
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load exhibitors");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [eventSlug, page, pageSize, query, sort, ready]);

  // Scroll back to the top of the grid on page change, but not on first paint.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  const totalPages = data?.totalPages ?? 1;
  const goTo = useCallback(
    (next: number) => setPage(Math.min(Math.max(1, next), Math.max(1, totalPages))),
    [totalPages]
  );

  // Clamp down if a filter shrank the result set below the current page.
  useEffect(() => {
    if (data && page > data.totalPages) setPage(data.totalPages);
  }, [data, page]);

  const items = data?.items ?? [];
  const rangeStart = data && data.totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = data ? Math.min(page * pageSize, data.totalCount) : 0;

  return (
    <div className="space-y-5">
      {/* ── Header: counts + search + sort ─────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Users className="size-5 text-indigo-500" />
          <h2 className="text-[16px] font-black text-slate-900 dark:text-white">Exhibitors</h2>
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-black text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
            Imported: {(data?.imported ?? 0).toLocaleString()}
          </span>
          {expected ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-400">
              Expected: {expected.toLocaleString()}
            </span>
          ) : null}
          {data?.withWebsiteCount ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              Official sites: {data.withWebsiteCount.toLocaleString()}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search exhibitors..."
              className="h-9 w-[220px] rounded-full border border-slate-200 bg-white/70 pl-9 pr-3 text-[12px] font-medium text-slate-900 outline-none backdrop-blur transition-colors focus:border-indigo-500 dark:border-[#22304A] dark:bg-[#0B1220]/70 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setSort((prev) => (prev === "name" ? "stand" : prev === "stand" ? "country" : "name"));
              setPage(1);
            }}
            className="flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-4 text-[12px] font-bold text-slate-600 backdrop-blur transition-colors hover:border-indigo-300 dark:border-[#22304A] dark:bg-[#111B2E]/70 dark:text-slate-400"
          >
            <ArrowUpDown className="size-3.5" />
            Sort: {SORT_LABELS[sort]}
          </button>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            aria-label="Cards per page"
            className="h-9 rounded-full border border-slate-200 bg-white/70 px-3 text-[12px] font-bold text-slate-600 outline-none backdrop-blur focus:border-indigo-500 dark:border-[#22304A] dark:bg-[#111B2E]/70 dark:text-slate-400"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────── */}
      <div ref={gridRef} className="scroll-mt-24">
        {error ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center dark:border-[#22304A] dark:bg-[#111B2E]">
            <p className="text-[15px] font-black text-slate-900 dark:text-white">Could not load exhibitors</p>
            <p className="mt-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">{error}</p>
          </div>
        ) : loading ? (
          <ExhibitorGridSkeleton count={pageSize > 24 ? 24 : pageSize} />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white py-16 dark:border-[#22304A] dark:bg-[#111B2E]">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
              <Search className="size-7 text-indigo-500" />
            </div>
            <p className="text-[15px] font-black text-slate-900 dark:text-white">
              {query ? `No exhibitors match “${query}”` : "No exhibitors imported yet"}
            </p>
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQueryInput("");
                  setQuery("");
                  setPage(1);
                }}
                className="h-9 rounded-full border border-slate-200 px-5 text-[12px] font-bold text-slate-600 hover:border-indigo-300 dark:border-[#22304A] dark:text-slate-300"
              >
                Clear search
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {items.map((ex) => (
              <ExhibitorCard key={ex.id} exhibitor={ex} onSelect={setSelected} />
            ))}
          </div>
        )}
      </div>

      {/* ── Paginator ──────────────────────────────────────────────────── */}
      {!error && data && data.totalCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-[#22304A]">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {data.totalCount.toLocaleString()}
            {query ? " matching" : ""} exhibitors
          </p>

          <nav aria-label="Exhibitor pages" className="flex items-center gap-1.5">
            <PagerButton onClick={() => goTo(page - 1)} disabled={page <= 1} aria-label="Previous page">
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">Prev</span>
            </PagerButton>

            {pageWindow(page, totalPages).map((entry, i) =>
              entry === "gap" ? (
                <span key={`gap-${i}`} className="px-1 text-[12px] font-bold text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  onClick={() => goTo(entry)}
                  aria-current={entry === page ? "page" : undefined}
                  className={cn(
                    "h-9 min-w-9 rounded-xl px-3 text-[12px] font-black transition-all",
                    entry === page
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 dark:bg-indigo-500"
                      : "border border-slate-200 bg-white/70 text-slate-600 backdrop-blur hover:border-indigo-300 hover:text-indigo-600 dark:border-[#22304A] dark:bg-[#111B2E]/70 dark:text-slate-400 dark:hover:text-indigo-300"
                  )}
                >
                  {entry}
                </button>
              )
            )}

            <PagerButton onClick={() => goTo(page + 1)} disabled={page >= totalPages} aria-label="Next page">
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="size-4" />
            </PagerButton>
          </nav>
        </div>
      ) : null}

      <ExhibitorContactModal exhibitor={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function PagerButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      {...props}
      className="flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white/70 px-3 text-[12px] font-bold text-slate-600 backdrop-blur transition-all hover:border-indigo-300 hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-40 dark:border-[#22304A] dark:bg-[#111B2E]/70 dark:text-slate-400 dark:hover:text-indigo-300"
    >
      {children}
    </button>
  );
}

/**
 * One exhibitor tile. The whole card is a single external anchor, so a click
 * anywhere on it — including the "Visit website" row — leaves the CRM page
 * untouched and opens the exhibitor's site in a new tab.
 */
function ExhibitorCard({
  exhibitor,
  onSelect,
}: {
  exhibitor: Exhibitor;
  onSelect: (exhibitor: Exhibitor) => void;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const href = exhibitorHref(exhibitor);
  const domain = prettyDomain(exhibitor.website);

  return (
    // Was an <a> straight to the exhibitor's site. The card now opens the
    // contact modal instead, and the website moved to the pill at the bottom,
    // which is a real link and stops the click from bubbling. Same classes and
    // markup as before, so the grid is visually unchanged.
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(exhibitor)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(exhibitor);
        }
      }}
      title={`View ${exhibitor.name} contact details`}
      className="cursor-pointer group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/70 hover:shadow-[0_18px_45px_-18px_rgba(79,70,229,0.55)] dark:border-[#22304A] dark:bg-[#111B2E]/70 dark:hover:border-indigo-400/50 dark:hover:shadow-[0_18px_45px_-18px_rgba(99,102,241,0.65)]"
    >
      {/* Neon sheen, only on hover */}
      <span className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <span className="pointer-events-none absolute -inset-16 -z-10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_60%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Logo */}
      <div className="flex h-24 items-center justify-center rounded-xl border border-slate-100 bg-white dark:border-[#22304A]/70 dark:bg-[#0B1220]">
        {exhibitor.logoUrl && !logoFailed ? (
          <img
            src={exhibitor.logoUrl}
            alt={`${exhibitor.name} logo`}
            loading="lazy"
            className="max-h-[76px] max-w-[86%] object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span className="text-[28px] font-black uppercase tracking-tight text-indigo-500/40">
            {exhibitor.name.substring(0, 3)}
          </span>
        )}
      </div>

      {/* Name */}
      <p className="mt-3 line-clamp-2 text-[13px] font-black leading-snug text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
        {exhibitor.name}
      </p>

      {/* Stand + country */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {exhibitor.stand ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200/70 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-black text-indigo-600 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300">
            <MapPin className="size-2.5" />
            {exhibitor.stand}
          </span>
        ) : null}
        {exhibitor.country ? (
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{exhibitor.country}</span>
        ) : null}
      </div>

      {/* Website */}
      <div className="mt-auto pt-3">
        {domain ? (
          <p className="flex items-center gap-1.5 truncate text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <Globe2 className="size-3 shrink-0 text-indigo-400" />
            <span className="truncate">{domain}</span>
          </p>
        ) : (
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500">No official site published</p>
        )}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          title={
            exhibitor.website
              ? `Open ${exhibitor.name} official website`
              : "No official site published — opens the show directory"
          }
          className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white/60 py-1.5 text-[11px] font-black text-indigo-600 transition-all group-hover:border-indigo-400/60 group-hover:bg-indigo-50 dark:border-[#22304A] dark:bg-[#0B1220]/60 dark:text-indigo-300 dark:group-hover:border-indigo-400/40 dark:group-hover:bg-indigo-500/10"
        >
          {exhibitor.website ? "Visit website" : "Open show directory"}
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}

function ExhibitorGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-slate-200 bg-white/60 p-4 backdrop-blur dark:border-[#22304A] dark:bg-[#111B2E]/60"
        >
          <div className="h-24 rounded-xl bg-slate-100 dark:bg-[#0B1220]" />
          <div className="mt-3 h-3 w-4/5 rounded bg-slate-100 dark:bg-[#0B1220]" />
          <div className="mt-2 h-3 w-1/2 rounded bg-slate-100 dark:bg-[#0B1220]" />
          <div className="mt-4 h-7 rounded-xl bg-slate-100 dark:bg-[#0B1220]" />
        </div>
      ))}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Bookmark, ChevronDown, Filter, UploadCloud, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PeopleFilterSidebar } from "@/components/people/people-filter-sidebar";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { peopleBinding } from "@/components/assistant/bindings/people";
import { PeopleResultsTable } from "@/components/people/people-results-table";
import { PeopleBulkToolbar } from "@/components/people/people-bulk-toolbar";
import { PeopleDetailSlideover } from "@/components/people/people-detail-slideover";
import { useSavedPeople } from "@/lib/people/saved-store";
import { paramsToFilters, serializePeopleQuery, type PeopleFacets } from "@/lib/people/filters";
import { SOURCE_LABELS } from "@/lib/people/vocabulary";
import {
  emptyPeopleFilters,
  type PeopleFilters,
  type PeopleStats,
  type Person,
} from "@/types/people";

/**
 * The People AI Explorer.
 *
 * A thin composition root: the URL query string is the single source of truth
 * for filters, so the rail and the chat cannot disagree — the rail writes to
 * it, a chat reply's "Apply filters" writes to it, and the chat reads it as
 * `activeFilters` on every send.
 *
 * Layout matches /app/companies exactly: xl:grid-cols-[360px_1fr].
 */

const EMPTY_FACETS: PeopleFacets = {
  titles: [], seniorities: [], departments: [], companies: [], locations: [],
  countries: [], headcounts: [], industries: [], keywords: [], buyingIntents: [],
  sources: [], verification: [],
};

const PAGE_SIZE = 25;

export function PeopleSection() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [filters, setFilters] = useState<PeopleFilters>(emptyPeopleFilters());
  const [tab, setTab] = useState<"people" | "saved">("people");
  const [view, setView] = useState<"chat" | "results">("chat");
  const [page, setPage] = useState(1);

  const [results, setResults] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<PeopleFacets>(EMPTY_FACETS);
  const [stats, setStats] = useState<PeopleStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openPerson, setOpenPerson] = useState<Person | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { saved, toggle: toggleSaved, isSaved } = useSavedPeople();

  // --- URL as the single source of truth -----------------------------------

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters(paramsToFilters(params));
    setTab(params.get("tab") === "saved" ? "saved" : "people");
    setView(params.get("view") === "results" ? "results" : "chat");
    const urlPage = Number(params.get("page") ?? "1");
    setPage(Number.isInteger(urlPage) && urlPage > 0 ? urlPage : 1);
    setIsHydrated(true);
  }, []);

  // history.replaceState rather than router.replace: this only needs to keep
  // the address bar shareable, and avoids re-running the RSC payload on every
  // checkbox click. Skipped until the URL has been read, so the first paint
  // cannot blank out an incoming shared link. (Same call as events-section.tsx.)
  useEffect(() => {
    if (!isHydrated) return;
    const query = serializePeopleQuery(filters, {
      tab: tab === "saved" ? "saved" : "",
      view: view === "results" ? "results" : "",
      page: page > 1 ? String(page) : "",
    });
    window.history.replaceState(null, "", `${window.location.pathname}${query}`);
  }, [filters, tab, view, page, isHydrated]);

  // The drawer overlays the page; letting the body scroll behind it makes the
  // rail feel detached on touch devices.
  useEffect(() => {
    if (!isDrawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isDrawerOpen]);

  // --- Data ----------------------------------------------------------------

  useEffect(() => {
    if (!isHydrated) return;
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const query = serializePeopleQuery(filters, {
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });
        const response = await fetch(`/api/people${query}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed (${response.status})`);

        const data = await response.json();
        if (cancelled) return;

        setResults(Array.isArray(data.results) ? data.results : []);
        setTotal(typeof data.total === "number" ? data.total : 0);
        setFacets(data.facets ?? EMPTY_FACETS);
        setStats(data.stats ?? null);
        setLoadError(null);
      } catch (error) {
        if ((error as Error).name === "AbortError" || cancelled) return;
        setLoadError("Unable to load contacts. Please refresh the page.");
        setResults([]);
        setTotal(0);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filters, page, isHydrated]);

  // --- Handlers ------------------------------------------------------------

  const applyFilters = useCallback((next: PeopleFilters) => {
    setFilters(next);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(emptyPeopleFilters());
    setPage(1);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const rows = tab === "saved" ? saved : results;

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((current) =>
      current.size === rows.length ? new Set() : new Set(rows.map((person) => person.id))
    );
  }, [rows]);

  const savedIds = useMemo(() => new Set(saved.map((person) => person.id)), [saved]);

  const lookalikeSeed = useMemo(
    () =>
      filters.lookalikeSeedId
        ? (results.find((person) => person.id === filters.lookalikeSeedId) ?? null)
        : null,
    [filters.lookalikeSeedId, results]
  );

  const headerCount = stats?.total ?? 0;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[24px] font-bold tracking-tight text-slate-900 dark:text-white">
            People
            <span className="text-[12px] font-medium tracking-normal text-slate-500 dark:text-slate-400">
              {headerCount.toLocaleString()} contacts
            </span>
          </h1>
          <p className="text-[13px] text-slate-900 dark:text-slate-400">
            Search contacts, verify emails, and move people into CRM workflows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Below 1024px the rail becomes a drawer behind this button. */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:hidden dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A]"
          >
            <Filter className="size-4" />
            Filters
          </button>
          <button className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A]">
            <UploadCloud className="size-4" />
            Import CSV/XLSX
          </button>
          <button className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A]">
            Export
            <ChevronDown className="size-4 text-slate-400" />
          </button>
        </div>
      </motion.div>

      {/* Tabs — same pill style as Companies | Saved Companies */}
      <div className="flex w-fit items-center gap-1 rounded-[12px] border border-slate-200 bg-white p-1 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
        {([
          { key: "people", label: "People", icon: Users },
          { key: "saved", label: "Saved People", icon: Bookmark },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-all",
              tab === key
                ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-[#0B1220]"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#16233A] dark:hover:text-white"
            )}
          >
            <Icon className="size-4" />
            {label}
            {key === "saved" && saved.length > 0 ? (
              <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white dark:bg-indigo-500">
                {saved.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Slim data-source strip, between the header and the two panels. */}
      <div className="flex flex-col items-center gap-6 rounded-[12px] border border-slate-200 bg-white px-5 py-3 shadow-sm md:flex-row dark:border-[#22304A] dark:bg-[#111B2E]">
        <div className="flex w-full flex-1 flex-col justify-center border-slate-200 md:border-r md:pr-6 dark:border-[#22304A]">
          <p className="mb-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
            Data source
          </p>
          <div className="flex items-center gap-2">
            <UploadCloud className="size-4 text-indigo-500" />
            <p className="truncate text-[14px] font-semibold text-slate-900 dark:text-white">
              {stats && stats.sources.length > 0
                ? stats.sources.map((source) => SOURCE_LABELS[source] ?? source).join(" / ")
                : "—"}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col justify-center border-slate-200 md:w-auto md:border-r md:pr-6 dark:border-[#22304A]">
          <p className="mb-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
            Last Fetched
          </p>
          <p className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-900 dark:text-white">
            <Activity className="size-3.5 text-emerald-500" />
            {stats?.lastFetchedAt || "—"}
          </p>
        </div>
        <div className="flex w-full flex-1 flex-col justify-center">
          <p className="mb-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400">
            Avg. Confidence
            <span className="ml-2 font-mono font-semibold text-slate-900 dark:text-white">
              {stats?.avgConfidence ?? 0}%
            </span>
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#16233A]">
            <div
              className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
              style={{ width: `${stats?.avgConfidence ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {loadError}
        </div>
      ) : null}

      {/* The Saved tab replaces BOTH columns — neither filters nor questions
          apply to a hand-curated list. */}
      {tab === "saved" ? (
        <div className="space-y-3">
          {saved.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
              <Bookmark className="size-12 text-slate-400 dark:text-slate-500" />
              <p className="mt-4 text-[18px] font-bold text-slate-900 dark:text-white">
                No saved people yet
              </p>
              <p className="mt-2 max-w-md text-[14px] text-slate-500 dark:text-slate-400">
                Save contacts from the results table to keep them here.
              </p>
            </div>
          ) : (
            <>
              <PeopleBulkToolbar
                selectedCount={selectedIds.size}
                totalCount={saved.length}
                allSelected={selectedIds.size === saved.length}
                onToggleSelectAll={toggleSelectAll}
                onVerifyEmails={() => undefined}
                onAddToSequence={() => undefined}
                onMerge={() => undefined}
              />
              <PeopleResultsTable
                people={saved}
                selectedIds={selectedIds}
                savedIds={savedIds}
                onToggleSelect={toggleSelect}
                onToggleSaved={toggleSaved}
                onOpenPerson={setOpenPerson}
              />
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[360px_1fr] 2xl:grid-cols-[390px_1fr]">
          {/* LEFT — hidden below lg, where it becomes the drawer below. Between
              lg and xl the grid is still one column, so it stacks above the
              chat exactly as the Companies rail does at those widths. */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="hidden flex-col lg:flex"
          >
            <PeopleFilterSidebar
              filters={filters}
              facets={facets}
              resultCount={total}
              lookalikeSeed={lookalikeSeed}
              onFiltersChange={applyFilters}
              onClear={clearFilters}
            />
          </motion.div>

          {/* RIGHT */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="flex flex-col"
          >
            <AssistantPanel
              currentPage="people"
              activeFilters={filters as unknown as Record<string, unknown>}
              rowContext={{
                selectedIds,
                savedIds,
                onToggleSelect: toggleSelect,
                onToggleSaved: toggleSaved,
                onOpenPerson: setOpenPerson,
              }}
              onGoBack={(entity, sourceFilters) => {
                // Spec 2a only binds People, so a back-jump can only land
                // here; the events and companies routes arrive in Spec 2b.
                if (entity === "people" && sourceFilters) {
                  applyFilters(
                    peopleBinding.applyFilters(filters, sourceFilters as Partial<PeopleFilters>)
                  );
                }
              }}
            />
          </motion.div>
        </div>
      )}

      {/* Filters drawer, below lg. */}
      {isDrawerOpen ? (
        <>
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-slate-900/30 backdrop-blur-[2px] lg:hidden dark:bg-black/50"
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-0 top-0 z-50 h-full w-full max-w-[360px] overflow-y-auto bg-white p-3 shadow-2xl lg:hidden dark:bg-[#0B1220]"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-bold text-slate-900 dark:text-white">Filters</span>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-[#22304A]"
              >
                <X className="size-4" />
              </button>
            </div>
            <PeopleFilterSidebar
              filters={filters}
              facets={facets}
              resultCount={total}
              lookalikeSeed={lookalikeSeed}
              onFiltersChange={applyFilters}
              onClear={clearFilters}
            />
          </motion.div>
        </>
      ) : null}

      <PeopleDetailSlideover
        person={openPerson}
        isSaved={openPerson ? isSaved(openPerson.id) : false}
        onClose={() => setOpenPerson(null)}
        onToggleSaved={toggleSaved}
        onFindSimilar={(person) => {
          applyFilters({ ...filters, lookalikeSeedId: person.id });
          setOpenPerson(null);
        }}
      />
    </div>
  );
}

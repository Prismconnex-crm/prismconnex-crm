# Event Catalog Results in the Companies Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render natural-language event search results in the Companies tab using the Events page's Event Catalog table, with Location / Dates / Category as labelled columns and paging through all matches.

**Architecture:** `/api/companies/ask` already calls Claude once to extract `filters` from the query and returns page 1. A new non-LLM route `/api/events/search` replays those same filters with an `offset` so Prev/Next never re-invokes the model. A new `EventCatalogPanel` component reproduces the 7-column table from `events-section.tsx` and shares the Events page's `localStorage` like/target keys.

**Tech Stack:** Next.js 14 App Router, TypeScript, Zod, Tailwind, framer-motion, lucide-react, vitest (node env).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-29-companies-event-catalog-results-design.md`
- Branch: `feat/companies-event-catalog-results`
- Run one-shot tests with `npx vitest run` — **never** bare `npm test` (watch mode).
- `@/` alias = repo root. Tests live in `tests/integration/`, node environment.
- Do **not** install dependencies, run builds, seeds, or benchmarks (disk-space constraint in CLAUDE.md). `@anthropic-ai/sdk@^0.115.0` is already installed.
- Do **not** touch `prisma/dev.db` or run any SQLite command. This feature reads only `data/find-shows-seed.json` via `lib/find-shows/catalog.ts`.
- Model stays `claude-opus-4-8` with `output_config: { effort: "low" }` and no `thinking` block. Do not change the model.
- Tailwind convention: explicit dark-mode hex tokens (`dark:bg-[#111B2E]`, borders `dark:border-[#22304A]`) and bracketed font sizes (`text-[13px]`).
- API routes here are intentionally **not** tenant-scoped — the show catalog is shared discovery data.
- `MAX_LIMIT` stays 50. `DEFAULT_LIMIT` becomes 25.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/find-shows/filter-events.ts` | **Modify.** Pure catalog matching. Gains `offset` support, 25 default, `logoUrl` in output. |
| `models/event-query.ts` | **Modify.** Zod schemas + DTOs. Gains `offset`, `logoUrl`, `eventSearchSchema`. |
| `app/api/events/search/route.ts` | **Create.** Non-LLM paging controller. |
| `services/event-query.service.ts` | **Modify.** One system-prompt line for "all categories". |
| `app/api/companies/ask/route.ts` | **Modify.** Distinguish missing-key from transient failure. |
| `components/crm/event-catalog-panel.tsx` | **Create.** The 7-column table. |
| `components/crm/event-results-panel.tsx` | **Delete.** Replaced by the above. |
| `components/crm/companies-section.tsx` | **Modify.** Full-width branch, search-input extraction, paging handlers. |
| `tests/integration/event-query-filter.test.ts` | **Modify.** Paging tests. |
| `tests/integration/event-search-route.test.ts` | **Create.** Route handler tests. |

---

## Task 1: Paging and `logoUrl` in the pure matcher

**Files:**
- Modify: `models/event-query.ts:22-56`
- Modify: `lib/find-shows/filter-events.ts:5,25-85`
- Test: `tests/integration/event-query-filter.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `EventFilters` gains `offset?: number | null` (int, min 0).
  - `EventResult` gains `logoUrl: string | null`.
  - `filterEvents(filters: EventFilters): { events: EventResult[]; totalMatched: number }` — unchanged signature, now honours `filters.offset`.
  - `DEFAULT_LIMIT = 25`, `MAX_LIMIT = 50`.

- [ ] **Step 1: Update the existing default-limit test to the new value**

`tests/integration/event-query-filter.test.ts` currently asserts the old default of 12 at lines 24-28. Replace that whole `it(...)` block with:

```ts
  it('caps results at the default limit but reports the true total', () => {
    const { events, totalMatched } = filterEvents({ country: 'Germany' });
    expect(events).toHaveLength(25);
    expect(totalMatched).toBeGreaterThan(25);
  });
```

- [ ] **Step 2: Add the failing paging tests**

Append these to the existing `describe('filterEvents', ...)` block in `tests/integration/event-query-filter.test.ts`, immediately before its closing `});`:

```ts
  it('defaults to 25 results per page when no limit is given', () => {
    const { events } = filterEvents({ country: 'France' });
    expect(events).toHaveLength(25);
  });

  it('honours an explicit limit of 50', () => {
    const { events } = filterEvents({ country: 'France', limit: 50 });
    expect(events).toHaveLength(50);
  });

  it('clamps a limit above MAX_LIMIT down to 50', () => {
    // filterEvents is a pure function — the Zod max(50) only guards the route
    // boundary, so an oversized limit can reach here and must be clamped.
    const { events } = filterEvents({ country: 'France', limit: 999 });
    expect(events).toHaveLength(50);
  });

  it('offset slices a later page without overlapping the first', () => {
    const first = filterEvents({ country: 'France', limit: 10 });
    const second = filterEvents({ country: 'France', limit: 10, offset: 10 });

    expect(first.events).toHaveLength(10);
    expect(second.events).toHaveLength(10);

    const firstSlugs = new Set(first.events.map((event) => event.slug));
    for (const event of second.events) {
      expect(firstSlugs.has(event.slug)).toBe(false);
    }
  });

  it('reports the same totalMatched on every page of a filter set', () => {
    const first = filterEvents({ country: 'France', limit: 10 });
    const third = filterEvents({ country: 'France', limit: 10, offset: 20 });
    expect(third.totalMatched).toBe(first.totalMatched);
  });

  it('returns an empty page when offset runs past the end', () => {
    const { events, totalMatched } = filterEvents({
      country: 'France',
      offset: 100000,
    });
    expect(events).toHaveLength(0);
    expect(totalMatched).toBeGreaterThan(0);
  });

  it('finds every trade show in France when no category is set', () => {
    const { totalMatched } = filterEvents({ country: 'France', category: null });
    expect(totalMatched).toBe(1306);
  });

  it('exposes the seed logo url on each result', () => {
    const { events } = filterEvents({ country: 'France', limit: 5 });
    for (const event of events) {
      expect(event).toHaveProperty('logoUrl');
    }
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/integration/event-query-filter.test.ts`

Expected: FAIL. The 25-default tests fail with `expected length 12 to be 25`; the offset tests fail because `offset` is not applied (second page equals first); `logoUrl` fails with the property missing.

- [ ] **Step 4: Add `offset` to the filters schema and `logoUrl` to the result type**

In `models/event-query.ts`, inside `eventFiltersSchema` (currently ending at the `limit` line, ~line 34), add an `offset` field directly after `limit`:

```ts
  limit: z.number().int().min(1).max(50).nullable().optional(),
  offset: z.number().int().min(0).nullable().optional(),
});
```

Then replace the `EventResult` type (currently `Pick<FindShowEvent, ...>` at ~lines 44-56) with:

```ts
/** A trimmed-down event shaped for the results panel. */
export type EventResult = Pick<
  FindShowEvent,
  | 'slug'
  | 'name'
  | 'city'
  | 'country'
  | 'venue'
  | 'organizer'
  | 'displayDate'
  | 'startDate'
  | 'website'
  | 'primaryCategory'
> & {
  /** Flattened from `seedAsset.logoUrl` so the panel needs no nested access. */
  logoUrl: string | null;
};
```

- [ ] **Step 5: Apply offset and the new default in the matcher**

In `lib/find-shows/filter-events.ts`, change the default constant at line 5:

```ts
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
```

Then replace the return block at the end of `filterEvents` (currently lines 68-84) with:

```ts
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(filters.offset ?? 0, 0);

  return {
    totalMatched: matched.length,
    events: matched.slice(offset, offset + limit).map((event) => ({
      slug: event.slug,
      name: event.name,
      city: event.city,
      country: event.country,
      venue: event.venue,
      organizer: event.organizer,
      displayDate: event.displayDate,
      startDate: event.startDate,
      website: event.website,
      primaryCategory: event.primaryCategory,
      logoUrl: event.seedAsset.logoUrl,
    })),
  };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/integration/event-query-filter.test.ts`

Expected: PASS, all tests green (the original 13 plus 8 new).

If `expect(totalMatched).toBe(1306)` fails, the seed data has changed since the spec was written. Read the actual number from the failure output and update the assertion to match — do not change the filter logic to chase the number.

- [ ] **Step 7: Commit**

```bash
git add models/event-query.ts lib/find-shows/filter-events.ts tests/integration/event-query-filter.test.ts
git commit -m "feat: add offset paging and logoUrl to event catalog filtering"
```

---

## Task 2: Non-LLM paging route

**Files:**
- Modify: `models/event-query.ts` (append `eventSearchSchema`)
- Create: `app/api/events/search/route.ts`
- Test: `tests/integration/event-search-route.test.ts`

**Interfaces:**
- Consumes: `eventFiltersSchema`, `EventFilters`, `EventResult`, `filterEvents` from Task 1.
- Produces:
  - `eventSearchSchema` — Zod object `{ filters: EventFilters; page: number }`, `page` int min 1 default 1.
  - `POST /api/events/search` → `200 { events: EventResult[], totalMatched: number, page: number, pageSize: number }`, or `400` on invalid body.

- [ ] **Step 1: Write the failing route tests**

Create `tests/integration/event-search-route.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/events/search/route';

function post(body: unknown) {
  return new Request('http://localhost/api/events/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

describe('POST /api/events/search', () => {
  it('returns the first page of matches', async () => {
    const response = await POST(post({ filters: { country: 'France' }, page: 1 }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.events).toHaveLength(25);
    expect(json.totalMatched).toBeGreaterThan(25);
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(25);
  });

  it('pages without overlapping the previous page', async () => {
    const first = await (await POST(post({ filters: { country: 'France', limit: 10 }, page: 1 }))).json();
    const second = await (await POST(post({ filters: { country: 'France', limit: 10 }, page: 2 }))).json();

    const firstSlugs = new Set(first.events.map((event: { slug: string }) => event.slug));
    for (const event of second.events) {
      expect(firstSlugs.has(event.slug)).toBe(false);
    }
  });

  it('uses the requested limit as the page size', async () => {
    const response = await POST(post({ filters: { country: 'France', limit: 50 }, page: 1 }));
    const json = await response.json();
    expect(json.pageSize).toBe(50);
    expect(json.events).toHaveLength(50);
  });

  it('returns an empty page past the end without erroring', async () => {
    const response = await POST(post({ filters: { country: 'France', limit: 10 }, page: 9999 }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.events).toHaveLength(0);
    expect(json.totalMatched).toBeGreaterThan(0);
  });

  it('rejects a page below 1', async () => {
    const response = await POST(post({ filters: { country: 'France' }, page: 0 }));
    expect(response.status).toBe(400);
  });

  it('rejects a missing filters object', async () => {
    const response = await POST(post({ page: 1 }));
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/integration/event-search-route.test.ts`

Expected: FAIL — the module `@/app/api/events/search/route` does not exist.

- [ ] **Step 3: Add the request schema**

Append to `models/event-query.ts`, directly after the `eventFiltersSchema` / `EventFilters` block:

```ts
/**
 * Body for the non-LLM paging route. The client replays the filters Claude
 * already extracted, so Prev/Next never costs another model call.
 */
export const eventSearchSchema = z.object({
  filters: eventFiltersSchema,
  page: z.number().int().min(1).default(1),
});

export type EventSearchInput = z.infer<typeof eventSearchSchema>;
```

- [ ] **Step 4: Write the route**

Create `app/api/events/search/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { filterEvents } from '@/lib/find-shows/filter-events';
import { ApiError } from '@/lib/http/errors';
import { jsonError, jsonOk } from '@/lib/http/response';
import { validateBody } from '@/lib/http/validate';
import { eventSearchSchema } from '@/models/event-query';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

/**
 * Pages through trade-show matches with NO model call. The client sends back
 * the filters `/api/companies/ask` already extracted, so only the first page
 * of a query costs an API call.
 *
 * Like /api/companies, this route is intentionally NOT tenant-scoped — the
 * trade-show catalog is a shared discovery dataset, not workspace data.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filters, page } = validateBody(eventSearchSchema, body);

    const pageSize = Math.min(filters.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const { events, totalMatched } = filterEvents({
      ...filters,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return jsonOk({ events, totalMatched, page, pageSize });
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error);
    }
    console.error('[events/search]', error);
    return jsonError(error);
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/integration/event-search-route.test.ts`

Expected: PASS, 6 tests.

- [ ] **Step 6: Run the whole suite for regressions**

Run: `npx vitest run`

Expected: PASS. Report any pre-existing failures rather than fixing them — they are outside this plan's scope.

- [ ] **Step 7: Commit**

```bash
git add models/event-query.ts app/api/events/search/route.ts tests/integration/event-search-route.test.ts
git commit -m "feat: add non-LLM event paging route"
```

---

## Task 3: Surface a missing API key, and teach the prompt "all categories"

**Files:**
- Modify: `services/event-query.service.ts:26-36`
- Modify: `app/api/companies/ask/route.ts:16-20`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `/api/companies/ask` returns `503 { intent: 'unavailable', reason: 'missing_api_key' }` when `ANTHROPIC_API_KEY` is unset. Task 5 renders that `reason`.

- [ ] **Step 1: Add the "all categories" instruction to the system prompt**

In `services/event-query.service.ts`, inside `buildSystemPrompt`, the returned array currently ends with the two lines starting `'Set a field to null whenever...'` and `'Never invent or name specific events...'`. Insert one line between them so the array reads:

```ts
    'Set a field to null whenever the query does not constrain it. Do not guess a country from a city unless you are confident (London -> United Kingdom is fine; Springfield is not).',
    'A query that says "all categories", "any category", "under all the category" or similar is explicitly asking NOT to filter by industry — set category to null. Never pick an enum value to represent "all".',
    'Never invent or name specific events — you only produce filters.',
```

- [ ] **Step 2: Return a machine-readable reason for the missing key**

In `app/api/companies/ask/route.ts`, replace the `isConfigured()` guard block (lines 16-20) with:

```ts
    if (!isConfigured()) {
      // Surfaced in the UI rather than silently falling back: a dormant
      // feature with no explanation is indistinguishable from a broken one.
      return jsonOk(
        { intent: 'unavailable' as const, reason: 'missing_api_key' as const },
        503
      );
    }
```

- [ ] **Step 3: Verify the route still compiles and tests pass**

Run: `npx vitest run`

Expected: PASS, unchanged from Task 2. There is no test for the prompt string — it is a behavioural instruction to the model, verified manually in Task 5's smoke test.

- [ ] **Step 4: Commit**

```bash
git add services/event-query.service.ts app/api/companies/ask/route.ts
git commit -m "feat: surface missing ANTHROPIC_API_KEY and handle 'all categories' queries"
```

---

## Task 4: The Event Catalog panel

**Files:**
- Create: `components/crm/event-catalog-panel.tsx`
- Delete: `components/crm/event-results-panel.tsx`

**Interfaces:**
- Consumes: `EventResult` (with `logoUrl`) and `EventFilters` from Task 1.
- Produces: `EventCatalogPanel`, a client component with this exact props type:

```ts
export type EventCatalogPanelProps = {
  query: string;
  answer: string;
  filters: EventFilters;
  events: EventResult[];
  totalMatched: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onClear: () => void;
};
```

- [ ] **Step 1: Create the panel**

Create `components/crm/event-catalog-panel.tsx`. This mirrors the Events page table at `components/crm/events-section.tsx:1092-1222` — same columns, same tokens, same `localStorage` keys.

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Calendar, Check, Heart, MapPin, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventFilters, EventResult } from "@/models/event-query";

export type EventCatalogPanelProps = {
  query: string;
  answer: string;
  filters: EventFilters;
  events: EventResult[];
  totalMatched: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onClear: () => void;
};

/** Chips describing how the query was interpreted, so a misread is obvious. */
function filterChips(filters: EventFilters): string[] {
  const chips: string[] = [];

  const where = [filters.city, filters.country].filter(Boolean).join(", ");
  if (where) chips.push(where);
  else if (filters.region && filters.region !== "All Regions") chips.push(filters.region);

  chips.push(
    filters.category && filters.category !== "All Categories"
      ? filters.category
      : "All Categories"
  );

  if (filters.monthFrom) {
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const from = months[filters.monthFrom - 1];
    const to = months[(filters.monthTo ?? filters.monthFrom) - 1];
    chips.push(from === to ? from : `${from}–${to}`);
  }
  if (filters.year) chips.push(String(filters.year));
  if (filters.keyword) chips.push(`"${filters.keyword}"`);
  if (filters.limit) chips.push(`${filters.limit} requested`);

  return chips;
}

export function EventCatalogPanel({
  query,
  answer,
  filters,
  events,
  totalMatched,
  page,
  pageSize,
  isLoading,
  onPageChange,
  onClear,
}: EventCatalogPanelProps) {
  const router = useRouter();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [targetIds, setTargetIds] = useState<Set<string>>(new Set());

  // Same keys the Events page uses, so a like here shows up there.
  useEffect(() => {
    const savedLiked = localStorage.getItem("pc_liked_events");
    const savedTarget = localStorage.getItem("pc_target_events");
    if (savedLiked) setLikedIds(new Set(JSON.parse(savedLiked)));
    if (savedTarget) setTargetIds(new Set(JSON.parse(savedTarget)));
  }, []);

  const toggleLike = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("pc_liked_events", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const toggleTarget = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("pc_target_events", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));
  const firstShown = totalMatched === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = (page - 1) * pageSize + events.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]"
    >
      {/* Header: Claude's summary + how the query was interpreted */}
      <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-3 dark:border-[#22304A]">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-slate-900 dark:text-white">{answer}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            Trade shows matching &ldquo;{query}&rdquo;
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {filterChips(filters).map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={onClear}
          className="inline-flex shrink-0 items-center gap-1 rounded-[8px] border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-[#16233A]"
        >
          <X className="size-3" />
          Clear
        </button>
      </div>

      {events.length === 0 && !isLoading ? (
        <div className="px-6 py-16 text-center">
          <Calendar className="mx-auto size-10 text-slate-400 dark:text-slate-500" />
          <p className="mt-3 text-[13px] font-bold text-slate-900 dark:text-white">
            No matching shows
          </p>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            Try a broader location, or drop the date range.
          </p>
        </div>
      ) : (
        <div className={cn("overflow-x-auto", isLoading && "opacity-50")}>
          <table className="w-full text-left text-[12px]">
            <thead className="bg-slate-50 dark:bg-[#0B1220]">
              <tr className="border-b border-slate-200 text-slate-500 dark:border-[#22304A] dark:text-[#9CA3AF]">
                <th className="w-8 px-4 py-4 text-center text-[10px] font-black uppercase tracking-[0.1em]">❤️</th>
                <th className="w-16 px-4 py-4 text-center text-[10px] font-black uppercase tracking-[0.1em]">Logo</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.1em]">Event Details</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.1em]">Location</th>
                <th className="w-32 px-4 py-4 text-[10px] font-black uppercase tracking-[0.1em]">Dates</th>
                <th className="hidden w-32 px-4 py-4 text-[10px] font-black uppercase tracking-[0.1em] md:table-cell">Category</th>
                <th className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-[0.1em]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#22304A]">
              {events.map((event) => {
                const isLiked = likedIds.has(event.slug);
                const isTargeted = targetIds.has(event.slug);
                return (
                  <tr
                    key={event.slug}
                    onClick={() => router.push(`/app/events/${event.slug}`)}
                    className={cn(
                      "group cursor-pointer transition-all duration-200 hover:bg-slate-50 dark:hover:bg-[#16233A]/40",
                      isTargeted && "bg-indigo-50/20 shadow-inner dark:bg-indigo-500/5"
                    )}
                  >
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={(e) => toggleLike(e, event.slug)}
                        className="group/heart relative p-1 transition-transform active:scale-75"
                        aria-label={isLiked ? "Unlike event" : "Like event"}
                      >
                        <Heart
                          className={cn(
                            "size-5 transition-all duration-300",
                            isLiked
                              ? "scale-110 fill-red-500 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                              : "text-slate-300 group-hover/heart:text-red-400 dark:text-[#22304A]"
                          )}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="mx-auto flex size-11 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 transition-transform group-hover:scale-105 dark:border-[#22304A] dark:bg-[#0B1220]">
                        {event.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={event.logoUrl} alt="" className="size-full object-contain" />
                        ) : (
                          <span className="text-[14px] font-black uppercase text-indigo-500/40">
                            {event.name.substring(0, 2)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="line-clamp-1 text-[14px] font-black text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                          {event.name}
                        </span>
                        {event.organizer && event.organizer !== "?" ? (
                          <span className="line-clamp-1 text-[11px] font-bold uppercase tracking-tight text-slate-500 dark:text-[#9CA3AF]">
                            {event.organizer}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center gap-2 text-[12px] font-bold text-slate-600 dark:text-[#E5E7EB]">
                        <MapPin className="size-3.5 text-slate-400 transition-colors group-hover:text-indigo-500" />
                        {event.city}, {event.country}
                      </div>
                      {event.venue && event.venue !== "?" ? (
                        <div className="mt-0.5 flex items-center gap-2 pl-[22px] text-[11px] text-slate-400 dark:text-slate-500">
                          <Building2 className="size-3 shrink-0" />
                          <span className="line-clamp-1">{event.venue}</span>
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center gap-2 text-[12px] font-black text-slate-600 dark:text-[#E5E7EB]">
                        <Calendar className="size-3.5 text-indigo-500/60" />
                        {event.displayDate}
                      </div>
                    </td>
                    <td className="hidden px-4 py-4 md:table-cell">
                      <span className="inline-flex rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-[#9CA3AF]">
                        {event.primaryCategory}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={(e) => toggleTarget(e, event.slug)}
                        className={cn(
                          "relative h-8 overflow-hidden rounded-lg px-4 text-[10px] font-black uppercase tracking-[0.1em] transition-all",
                          isTargeted
                            ? "border border-indigo-200/50 bg-slate-100 text-indigo-600 dark:bg-[#0B1220] dark:text-indigo-400"
                            : "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95"
                        )}
                      >
                        {isTargeted ? (
                          <span className="flex items-center gap-1.5 focus:outline-none">
                            <Check className="size-3" /> Targeted
                          </span>
                        ) : (
                          "Add To target events"
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer: counts + paging */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-4 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:border-[#22304A] dark:bg-[#0B1220]/50 dark:text-[#9CA3AF]">
        <span>
          Showing {firstShown}–{lastShown} of {totalMatched.toLocaleString()} events
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1 || isLoading}
            className="h-9 rounded-xl border border-slate-200 bg-white px-4 font-black text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-[#E5E7EB] dark:hover:bg-[#16233A]"
          >
            Prev
          </button>
          <div className="flex items-center gap-2 text-[14px]">
            <span className="font-black text-indigo-600 dark:text-indigo-400">{page}</span>
            <span className="opacity-20">/</span>
            <span>{totalPages}</span>
          </div>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="h-9 rounded-xl border border-slate-200 bg-white px-4 font-black text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-[#E5E7EB] dark:hover:bg-[#16233A]"
          >
            Next
          </button>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Delete the old panel**

```bash
git rm components/crm/event-results-panel.tsx
```

If git reports the file is untracked, use `rm components/crm/event-results-panel.tsx` instead.

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`

Expected: exactly one category of error — `components/crm/companies-section.tsx` cannot resolve `@/components/crm/event-results-panel`. That is expected and fixed in Task 5. Any *other* error in `event-catalog-panel.tsx` must be fixed before committing.

- [ ] **Step 4: Commit**

```bash
git add components/crm/event-catalog-panel.tsx
git commit -m "feat: add Event Catalog panel matching the Events page table"
```

---

## Task 5: Wire the panel into the Companies tab at full width

**Files:**
- Modify: `components/crm/companies-section.tsx` — imports (~line 30), `EventSearchState` (lines 40-45), `runAsk` (lines 842-887), render branch (lines 1106-1107, 1412-1425)

**Interfaces:**
- Consumes: `EventCatalogPanel` + `EventCatalogPanelProps` (Task 4), `POST /api/events/search` (Task 2), the `reason: 'missing_api_key'` field (Task 3).
- Produces: final user-visible behaviour. Nothing downstream depends on it.

- [ ] **Step 1: Swap the import**

In `components/crm/companies-section.tsx`, replace line 30:

```tsx
import { EventResultsPanel } from "@/components/crm/event-results-panel";
```

with:

```tsx
import { EventCatalogPanel } from "@/components/crm/event-catalog-panel";
```

Then extend the `EventFilters` / `EventResult` type import. Find the existing `import type { EventResult } ...` line (or add one) so it reads:

```tsx
import type { EventFilters, EventResult } from "@/models/event-query";
```

- [ ] **Step 2: Carry filters and paging in the search state**

Replace the `EventSearchState` type at lines 40-45 with:

```tsx
type EventSearchState = {
  query: string;
  answer: string;
  filters: EventFilters;
  events: EventResult[];
  totalMatched: number;
  page: number;
  pageSize: number;
};
```

- [ ] **Step 3: Add the unavailable-notice state**

Directly after the `const [isAsking, setIsAsking] = useState(false);` line (line 634), add:

```tsx
  // Set when /api/companies/ask reports no ANTHROPIC_API_KEY, so the UI can
  // explain why an event question did nothing instead of failing silently.
  const [askUnavailable, setAskUnavailable] = useState(false);
```

- [ ] **Step 4: Update `runAsk` to store filters and detect the missing key**

Replace the whole `runAsk` callback (lines 842-887) with:

```tsx
  const runAsk = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim();
      if (query.length < 2) return;

      setIsAsking(true);
      setAskUnavailable(false);
      try {
        const response = await fetch("/api/companies/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: query }),
        });

        const result = await response.json().catch(() => null);

        if (!response.ok) {
          // A missing API key is a configuration problem worth surfacing.
          // Everything else (rate limit, overload, network) stays silent and
          // falls back to the existing prefix search.
          if (response.status === 503 && result?.reason === "missing_api_key") {
            setAskUnavailable(true);
          }
          setEventSearch(null);
          return;
        }

        if (result.intent === "events") {
          setEventSearch({
            query,
            answer: result.answer,
            filters: result.filters,
            events: result.events,
            totalMatched: result.totalMatched,
            page: 1,
            pageSize: result.events.length || (result.filters?.limit ?? 25),
          });
          setSelectedCompanyId(null);
          setIsDetailView(false);
          return;
        }

        setEventSearch(null);
        if (result.intent === "companies" && result.name && result.name !== query) {
          setCompanySearch(result.name);
          resetCompanyPagination();
        }
      } catch {
        // Network failure — leave the prefix search in charge.
        setEventSearch(null);
      } finally {
        setIsAsking(false);
      }
    },
    [resetCompanyPagination]
  );
```

- [ ] **Step 5: Add the paging handler**

Directly after `runAsk`, add:

```tsx
  /**
   * Pages through matches by replaying the filters Claude already extracted.
   * Deliberately hits /api/events/search, not /ask — no model call per page.
   */
  const handleEventPageChange = useCallback(
    async (nextPage: number) => {
      if (!eventSearch || nextPage < 1 || isAsking) return;

      setIsAsking(true);
      try {
        const response = await fetch("/api/events/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filters: eventSearch.filters, page: nextPage }),
        });
        if (!response.ok) return;

        const result = await response.json();
        setEventSearch((prev) =>
          prev
            ? {
                ...prev,
                events: result.events,
                totalMatched: result.totalMatched,
                page: result.page,
                pageSize: result.pageSize,
              }
            : prev
        );
      } catch {
        // Keep the current page on a network failure.
      } finally {
        setIsAsking(false);
      }
    },
    [eventSearch, isAsking]
  );
```

- [ ] **Step 6: Give the event results the full page width**

The Companies layout is a `360px | 1fr` grid whose left column holds the search box. Collapsing to one column keeps the search box reachable while giving the table the whole width.

Replace line 1107:

```tsx
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[360px_1fr] 2xl:grid-cols-[390px_1fr]">
```

with:

```tsx
      <div
        className={cn(
          "grid grid-cols-1 items-stretch gap-5",
          // Event results take the whole width — the 7-column catalog table
          // needs the same room it gets on the Events page.
          !eventSearch && "xl:grid-cols-[360px_1fr] 2xl:grid-cols-[390px_1fr]"
        )}
      >
```

- [ ] **Step 7: Hide the company filter body while event results are showing**

Inside the left column's card (the `<div className="flex h-full flex-col rounded-[14px] ...">` at line 1114), the search input block ends at line 1141 with the closing `</p>` of the hint text. Everything after it is company filtering, which is irrelevant to event results.

Wrap that remainder: find line 1143, which opens the filter row:

```tsx
            <div className="mt-4 flex flex-wrap items-center gap-2">
```

and change it to:

```tsx
            <div className={cn("mt-4 flex flex-wrap items-center gap-2", eventSearch && "hidden")}>
```

Then add the unavailable notice directly after the hint paragraph at line 1141:

```tsx
            {askUnavailable ? (
              <p className="mt-2 rounded-[8px] border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                Event search is unavailable — ANTHROPIC_API_KEY is not configured.
              </p>
            ) : null}
```

Locate every other direct child of that card that renders company filtering (the filter dropdown panels and the saved-companies list) and apply the same `eventSearch && "hidden"` treatment via `cn`. Read lines 1143-1400 to identify them; do not guess. The rule: anything that is not the search input, the hint, or the unavailable notice gets hidden when `eventSearch` is set.

- [ ] **Step 8: Render the new panel**

Replace the `EventResultsPanel` block (lines 1412-1425) with:

```tsx
          {!isDetailView && eventSearch ? (
            <div className="flex-1 overflow-y-auto pr-1">
              <EventCatalogPanel
                query={eventSearch.query}
                answer={eventSearch.answer}
                filters={eventSearch.filters}
                events={eventSearch.events}
                totalMatched={eventSearch.totalMatched}
                page={eventSearch.page}
                pageSize={eventSearch.pageSize}
                isLoading={isAsking}
                onPageChange={handleEventPageChange}
                onClear={() => {
                  setEventSearch(null);
                  setCompanySearch("");
                  resetCompanyPagination();
                }}
              />
            </div>
          ) : !isDetailView && !hasActiveCriteria ? (
```

The right column also carries `xl:absolute xl:inset-0` positioning (line 1411) sized for the two-column grid. When `eventSearch` is set the grid is single-column, so that absolute positioning must not apply. Change line 1409 from:

```tsx
          className="flex flex-col min-h-[600px] xl:min-h-0 xl:relative"
```

to:

```tsx
          className={cn("flex flex-col", !eventSearch && "min-h-[600px] xl:min-h-0 xl:relative")}
```

and line 1411 from:

```tsx
          <div className="flex h-full w-full flex-col xl:absolute xl:inset-0">
```

to:

```tsx
          <div className={cn("flex h-full w-full flex-col", !eventSearch && "xl:absolute xl:inset-0")}>
```

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`

Expected: clean — no errors. The `event-results-panel` resolution error from Task 4 is now gone.

- [ ] **Step 10: Run the full test suite**

Run: `npx vitest run`

Expected: PASS.

- [ ] **Step 11: Manual smoke test**

Start the dev server (`npm run dev`) and confirm `ANTHROPIC_API_KEY` is set in `.env`. In the Companies tab, type each query and press Enter:

| Query | Expected |
|---|---|
| `can you provide me list of 50 events on location of France under all the category` | Full-width catalog table, 50 rows, chips read `France` · `All Categories` · `50 requested`, footer `Showing 1–50 of 1,306 events` |
| (then click Next) | Rows 51–100, page indicator `2 / 27`, no visible latency, **no** new model call |
| `shows in London UK next March` | Chips read `London, United Kingdom` · `All Categories` · `Mar` |
| `Infosys` | No event panel; falls back to company prefix search |
| (click a row) | Navigates to `/app/events/<slug>` |
| (click a heart, then open the Events page) | The same show is hearted there |

Then unset `ANTHROPIC_API_KEY`, restart, and re-run the France query: the amber "Event search is unavailable" notice appears and the company search still works.

Stop the dev server when finished.

- [ ] **Step 12: Commit**

```bash
git add components/crm/companies-section.tsx
git commit -m "feat: render event results as a full-width Event Catalog in the Companies tab"
```

---

## Self-Review Notes

Checked against the spec:

- **Spec coverage** — every row of the spec's Files table maps to a task: `filter-events.ts` / `event-query.ts` → Task 1; `api/events/search` → Task 2; `event-query.service.ts` + `api/companies/ask` → Task 3; `event-catalog-panel.tsx` + deletion of `event-results-panel.tsx` → Task 4; `companies-section.tsx` → Task 5; tests → Tasks 1 and 2.
- **Type consistency** — `EventResult.logoUrl` (Task 1) is consumed by the panel's logo cell (Task 4). `EventFilters.offset` (Task 1) is set by the route (Task 2), never by the panel. `eventSearchSchema` returns `{ events, totalMatched, page, pageSize }` (Task 2), matching exactly what `handleEventPageChange` destructures (Task 5) and what `EventCatalogPanelProps` declares (Task 4).
- **Known soft spot** — Task 5 Step 7 cannot enumerate every filter block to hide without reading the 250-line region first, so it states the rule rather than the line numbers. This is the one step requiring judgement; everything else is literal.
- **Deliberately unchanged** — `describeResults` still says "Showing the first N". With paging the footer now carries the authoritative count, so the sentence is redundant but not wrong. Left alone to keep the diff focused; the spec does not require changing it.

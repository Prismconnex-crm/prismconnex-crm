# Event Catalog results in the Companies tab

**Date:** 2026-07-29

Builds on [2026-07-24-companies-event-search-design.md](./2026-07-24-companies-event-search-design.md),
which added natural-language event search to the Companies search box. That work
classifies the query and matches the catalog correctly; this work fixes how the
matches are presented and makes the feature reachable.

## Goal

Asking the Companies search box an event question — "can you provide me list of
50 events on location of France under all the category" — returns the matching
trade shows rendered as the **Event Catalog card from the Events page**, with
Location, Dates and Category each a labelled column rather than a compact list.

## Problems with the current state

1. **`ANTHROPIC_API_KEY` is absent from `.env`**, so `/api/companies/ask` returns
   503 and the UI silently falls back to company prefix search. Typing an event
   question does nothing visible, and nothing explains why.
2. **`event-results-panel.tsx` does not resemble the Events page.** It is a
   compact list: no logo, no like control, no target action, category styled
   differently, and no column headers naming Location / Dates / Category.
3. **No paging.** `filterEvents` slices to a single page and the panel says
   "narrow the search for more specific results". "France" matches 1,306 events;
   there is no way to reach event 51.

## Decisions

| Decision | Rationale |
|---|---|
| Keep Claude for query parsing; the key gets added to `.env` | Handles arbitrary phrasing. A local parser was considered and rejected — the flexibility is the point of the feature. |
| Paging replays filters against a **non-LLM** route | One model call per query, not per page. Claude already returns `filters`; the client replays them. |
| Full Event Catalog replica, not a shared component | Matches the Events page exactly. Extracting a shared component would mean refactoring the 1,227-line `events-section.tsx`, which is out of scope here. |
| Honour an explicit count as the **page size** | "50 events" shows 50 and pages 50 at a time; the instruction is respected and the remaining 1,256 stay reachable. |
| Event results take the **full page width** | The 7-column table needs the room the Events page gives it. The 360px company filter rail is hidden until Clear. |
| Missing API key is now **visible**, not silent | A dormant feature with no explanation is indistinguishable from a broken one. Transient failures still fall back quietly. |

## Flow

```
Companies search box (Enter)
  → POST /api/companies/ask { q }              ← Claude call, ONCE per query
      → { intent:"events", answer, filters, events[], totalMatched }
  → render EventCatalogPanel, full width

Prev / Next
  → POST /api/events/search { filters, page }  ← NO Claude call
      → filterEvents(filters, offset) → { events[], totalMatched }
```

In-memory filtering over the 9,771-record catalog is sub-millisecond, so paging
is instant and costs nothing.

## Files

| File | Change |
|---|---|
| `components/crm/event-catalog-panel.tsx` | **New.** The 7-column table; replaces `event-results-panel.tsx`, which is deleted. |
| `app/api/events/search/route.ts` | **New.** Controller: `validateBody` → `filterEvents` → `jsonOk`. Not tenant-scoped, same rationale as `/api/companies`. |
| `models/event-query.ts` | Add `logoUrl` to `EventResult`; add `offset` to `eventFiltersSchema`; add `eventSearchSchema` for the paging route. |
| `lib/find-shows/filter-events.ts` | `DEFAULT_LIMIT` 12 → 25; honour `offset` when slicing. `MAX_LIMIT` stays 50. |
| `components/crm/companies-section.tsx` | Render the panel outside the `xl:grid-cols-[360px_1fr]` grid at full width; hold `filters` in `EventSearchState` for paging; wire Prev/Next. |
| `services/event-query.service.ts` | System-prompt line mapping "all categories" → `category: null`. |
| `app/api/companies/ask/route.ts` | Distinguish missing-key (surfaced) from transient failure (silent fallback). |
| `tests/integration/event-query-filter.test.ts` | Extend with paging tests. |

## The panel

Columns, matching `events-section.tsx:1092` exactly:

| ❤️ | Logo | Event Details | Location | Dates | Category | Action |
|---|---|---|---|---|---|---|
| toggles `pc_liked_events` | `seedAsset.logoUrl`, initials fallback | name + organizer | 📍 city, country | 📅 `displayDate` | badge | Add To target |

Styling reuses the Events page tokens (`dark:bg-[#111B2E]`, borders `#22304A`,
bracketed font sizes). Row click routes to `/app/events/<slug>`.

Likes and targets read and write the same `localStorage` keys the Events page
uses (`pc_liked_events`, `pc_target_events`), so hearting a show in the
Companies tab shows up on the Events page.

**Header strip** above the table keeps Claude's summary line ("Found 1,306 trade
shows in France.") and adds chips for the resolved filters — `France` ·
`All Categories` · `50 requested`. This makes the interpretation visible, so a
misread query is obvious without reading the rows.

**Footer:** `Showing 50 of 1,306 events` with Prev / Next.

## Error handling

| Condition | Behaviour |
|---|---|
| `ANTHROPIC_API_KEY` unset (503 from `/ask`) | Inline strip: "Event search is unavailable — ANTHROPIC_API_KEY is not configured." Company prefix search still works. |
| Rate limit, overload, network failure | Silent fallback to company prefix search, as today. Transient and self-correcting. |
| Claude returns malformed filters | 500 via `InternalServerError`; client falls back silently. |
| Paging route receives filters that match nothing | Empty state in the panel, not an error. |

## Model configuration

`claude-opus-4-8` with `output_config: { effort: "low" }` and no `thinking`
block. Verified current: the ID is valid and `effort` inside `output_config` is
the GA shape. Omitting `thinking` on Opus 4.8 means no thinking, which is what
extraction wants — this is deliberate, not an oversight. `claude-opus-5` is the
newer default but would be a behaviour change; not part of this work.

## Tests

Extending `tests/integration/event-query-filter.test.ts` (13 tests today). Pure
functions only — no model calls.

- `offset` slices correctly; consecutive pages do not overlap
- absent `limit` yields 25 per page
- `limit: 50` yields 50; `limit` above `MAX_LIMIT` clamps to 50
- France + `category: null` reports `totalMatched: 1306`
- `offset` beyond `totalMatched` returns an empty page, not an error
- `totalMatched` is stable across pages of the same filter set

## Out of scope

- Extracting a shared table component used by both pages
- Multi-category queries ("packaging **and** plastics expos")
- Saving an event query, or exporting results
- Switching to `claude-opus-5`

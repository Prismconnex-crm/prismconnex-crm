# Assistant Events Migration — Design

**Date:** 2026-08-17
**Status:** Approved, ready for planning
**Scope:** Migrate the Events page onto the shared assistant panel. Second of the
three UI specs; Companies migrates in Spec 2c.

**Depends on:**
- `2026-08-17-assistant-entity-router-design.md` (Spec 1, shipped)
- `2026-08-17-assistant-shared-conversation-design.md` (Spec 2a, shipped)

## Problem

Spec 2a built the shared conversation and migrated People. Events still runs its
own AI stack: `components/events/events-ai-search.tsx` calls
`/api/ai/event-query` for filters, and `EventListView` makes a second call to
`/api/ai/event-answer` for prose. Its conversation dies on navigation and it
cannot participate in a handoff.

Underneath that sits a duplication the router was built to remove. **Two
parallel event-filter stacks exist:**

| Stack | Shape | Consumer |
|---|---|---|
| `types/events.ts` `EventFilters` + `EventQueryState` | **array-valued** (`countries: string[]`, ISO `dateFrom`/`dateTo`) | the Explorer rail, URL-serialized |
| `models/event-query.ts` `EventFilters` | **scalar** (`country: string`, `monthFrom`/`monthTo`/`year`) | `filterEvents()` in `lib/find-shows` |

Spec 1's events adapter chose the scalar one, because that is what
`filterEvents()` accepts. But the array-valued stack is the actual Events UI,
and `lib/events/` already mirrors `lib/people/` almost exactly —
`filterEventList`, `computeEventFacets`, `buildEventFilterChips`,
`parseEventQueryState`/`serializeEventQueryState`. The adapter bypassed all of
it.

## Goals

- The Events page answers through `/api/assistant/chat` and shares the
  conversation with People.
- One event-filter stack backs both the rail and the assistant.
- `events-section.tsx` (1029 lines) split along its existing component seams.
- The two `/api/ai/*` routes and the People chat transport Spec 2a orphaned are
  deleted.

## Non-goals (Spec 2c)

- Migrating Companies, and decomposing `companies-section.tsx` (1746 lines, of
  which `CompaniesSection` alone is 1204 with ~25 `useState`).
- Removing the Companies page's **inline event results**. Companies today calls
  `/api/companies/ask` and, when the answer is events, `/api/events/search` to
  page through them without leaving the page. Migrating it replaces that with
  navigation — a product change, decided and owned by Spec 2c.
- Deleting `/api/companies/ask`, `/api/events/search`,
  `services/event-query.service.ts`, `models/event-query.ts` and
  `lib/find-shows/filter-events.ts`. Companies still calls them.

## Decisions

### The events adapter is rewritten onto `lib/events`

Its filter type becomes **`EventQueryState`** (`{filters, search}`), not bare
`EventFilters`, for two reasons: `filterEventList(events, filters, search,
favourites)` takes search separately from filters, and `EventQueryState` is
exactly what the Explorer rail holds and what `serializeEventQueryState` writes
to the URL. The binding therefore becomes an identity pass-through.

| Member | Before (find-shows) | After (lib/events) |
|---|---|---|
| `emptyFilters` | ten scalar nulls | `{filters: emptyEventFilters(), search: ''}` |
| `parseLocally` | message → `keyword` | message → `search` |
| `search` | `filterEvents(scalar)` | `filterEventList(findShowEvents, filters, search, EMPTY_FAVOURITES)`, then slice |
| `chips` | hand-rolled five-key list | `buildEventFilterChips(filters, search)`, mapping `id` → `key` |
| `describe` | `describeResults` | `buildEventAnswer` (new) |
| `carryOver` | scalar assignment | array union, mirroring the people adapter |

The alternative — mapping scalar to array inside the binding — was rejected: it
is lossy in reverse (a rail with two countries selected cannot round-trip into a
single-country schema) and would keep both stacks alive indefinitely.

### `dateFrom`/`dateTo` replace `monthFrom`/`monthTo`/`year`

The array-valued shape uses ISO bounds, and `lib/events/filters.ts` already
ships `isValidIsoDate`, `dateRangeForPreset` and `matchDatePreset`. So "next
spring" resolves to a real range the rail can render as a chip, instead of three
loose integers the rail has no field for. The system prompt already gives the
model today's date.

### `favouritesOnly` is omitted from the tool schema

Favourites live in browser `localStorage` (`readSlugSet` in the events section),
so the server has none: the adapter passes an empty set and the flag could never
match. Exposing it to the model would let it set a filter that silently does
nothing, which is worse than not offering it. The rail's own favourites toggle
is untouched and keeps working client-side.

**Known limitation:** the assistant cannot answer "which of my favourites are in
March". Moving favourites server-side would fix it and is out of scope.

### `lib/events/answer.ts` is new

`lib/events/` has `filters.ts` and `chips.ts` but no answer builder; Events gets
its prose from `describeResults` in the find-shows module that Spec 2c deletes.
`buildEventAnswer({question, state, matches, total})` mirrors
`lib/people/answer.ts`.

It must satisfy the Spec 1 adapter contract: **never emit a bare `0` when
`total` is null.** Recompute rather than coerce, as the people and events
adapters already do.

### `PageBinding` gains a row context

Spec 2a's people binding renders `PeopleResultsTable` with `onToggleSelect={()
=> {}}`, `onToggleSaved={() => {}}`, `onOpenPerson={() => {}}` — visible
controls that do nothing. That was a shortcut taken to ship the binding, and it
is worse than omitting the controls.

`PageBinding` becomes `PageBinding<F, C = unknown>` with `renderRows(rows,
context: C)`. `AssistantPanel` takes a `rowContext` prop from the page and
forwards it opaquely; each page passes its own shape and its own binding knows
that shape. The panel stays entity-agnostic, exactly as it already is for
filters.

- People passes `{selectedIds, savedIds, onToggleSelect, onToggleSaved, onOpenPerson}`.
- Events passes `{likedIds, targetIds, onToggleLike, onToggleTarget}`.

### Events renders compact inline rows, not its full table

`PeopleResultsTable` is chat-friendly. `EventsResultsTable` is page-level: it
requires `totalMatched`, `page`, `pageSize`, `onPageChange`, `chips`,
`onRemoveChip`, `onClearAll`, and would render a pagination bar and a second
chip row *inside* a message bubble, duplicating the chips the turn already
shows.

So the events binding renders a new `EventsInlineRows` (~60 lines: logo, name,
city, date, category, like/target toggles). Events and People stay identical at
the adapter layer and differ only in what an inline row looks like, which is
genuinely per-entity.

### A handoff always lands on `/app/events`

`PageBinding.route` is a single string, and `/app/target-events` is a display
mode (`EventsSection mode="target"`), not a distinct entity. A user who asks an
events question from the target-events view arrives at the all-events view.
Stated as a limitation rather than modelled.

## Architecture

**Split** — `components/crm/events-section.tsx` becomes a ~40-line router:

```
components/events/
  event-detail-view.tsx       255 lines, moved unchanged
  exhibitor-detail-view.tsx   135 lines, moved unchanged
  ticket-booking-view.tsx     235 lines, moved unchanged
  event-list-view.tsx         306 lines → the only one that changes
```

`EventListView` loses its `question` / `answer` / `isAnswering` state and its
`/api/ai/event-answer` call: the panel streams prose now.

**New and changed files:**

| File | Change |
|---|---|
| `lib/assistant/adapters/events.ts` | rewritten onto `EventQueryState` |
| `lib/events/answer.ts` | new — `buildEventAnswer` |
| `components/assistant/types.ts` | `PageBinding<F, C>` gains `renderRows(rows, context)` |
| `components/assistant/assistant-panel.tsx` | new `rowContext` prop, forwarded |
| `components/assistant/assistant-message.tsx` | forwards `rowContext` to the binding |
| `components/assistant/bindings/events.tsx` | new |
| `components/assistant/bindings/people.tsx` | real callbacks instead of no-ops |
| `components/assistant/registry.ts` | register the events binding |
| `components/events/events-inline-rows.tsx` | new |
| `components/crm/people-section.tsx` | pass `rowContext` |

## Data flow — the handoff finally completes

Spec 2a could not exercise a real navigation, because only People had a
binding. With the events binding registered:

```
User on /app/people: "what trade shows are happening in Munich"
  POST /api/assistant/chat { currentPage: 'people' }
  <- route { targetEntity: 'events', action: 'navigate', interpretedFilters }
  <- token "That's a question about events…"  <- done        (no results)
  reducer sets pendingHandoff; provider calls router.push('/app/events')
  AppShell stays mounted, so the thread is intact on arrival
  EventListView applies presetFilters via the events binding, shows the bar
  POST /api/assistant/chat { currentPage: 'events', forceEntity: 'events', presetFilters }
  <- route (answer_inline) / filters / results / token… / suggestions / done
```

Both halves already work in isolation — verified over HTTP during Spec 2a. This
spec joins them.

## Error handling

No new error surfaces. Everything inherits Spec 2a's ladder: a malformed frame
is skipped, a stream ending without `done` keeps the partial answer and offers
retry, an abort completes silently, a non-2xx marks the turn failed, and a
failed phase two leaves the bar up with the error in the thread.

Two events-specific cases:

| Failure | Behaviour |
|---|---|
| A handoff targets an entity whose binding is missing | Already guarded by `hasBinding`; after this spec only Companies is unbound, and Spec 2c removes the last case |
| `filterEventList` throws on a malformed date bound | Caught by the stream's `search_failed` path; `isValidIsoDate` rejects bad input before it reaches the filter |

## Testing

Vitest, `tests/integration`, node environment. **No new dependency** — no
jsdom, React Testing Library or Playwright, per `CLAUDE.md`.

1. **Rewritten events adapter** — the six events cases in
   `assistant-adapters.test.ts` rewritten for the array shape, plus the
   parametrized **contract suite passing unchanged**. That suite is the real
   signal the adapter boundary survived the rewrite.
2. **`events-answer.test.ts`** — new, mirroring `people-answer.test.ts`: real
   counts, the empty result, and no bare `0` when `total` is null.
3. **Events binding** — new block in `assistant-bindings.test.ts`: nested
   `applyFilters` replaces `filters.countries` while preserving
   `filters.categories` and `search`.
4. **`PageBinding` context** — the people binding's block gains a case
   asserting `renderRows` receives and uses the context rather than no-ops.
5. **Deletion safety** — each removal preceded by a grep proving zero
   references.

`event-filters.test.ts` is **kept permanently**: it covers
`lib/events/filters.ts` and `chips.ts`, the stack the adapter moves onto.

### Known coverage gap

Unchanged from Spec 2a: rendering, provider re-renders and `router.push` are not
unit-tested. The full cross-page handoff — which this spec makes possible for
the first time — is verified by running the app, not by a test.

## Teardown

Deleted in dependency order, each provably unreferenced when removed:

```
app/api/ai/event-query/route.ts          ← events-ai-search.tsx was the only caller
app/api/ai/event-answer/route.ts         ← event-list-view was the only caller
services/ai-event-query.service.ts
models/ai-event-query.ts
components/events/events-ai-search.tsx   ← replaced by AssistantPanel
app/api/people/chat/route.ts             ← orphaned by Spec 2a
lib/people/chat-stream.ts
components/people/use-people-chat.ts
components/people/people-chat-panel.tsx
components/people/people-message.tsx     ← only consumer is people-chat-panel
tests/integration/people-chat-route.test.ts
```

**Surviving until Spec 2c** (Companies calls them): `/api/companies/ask`,
`/api/events/search`, `services/event-query.service.ts`,
`models/event-query.ts`, `lib/find-shows/filter-events.ts`, and their tests
`companies-ask-route`, `event-search-route`, `event-query-filter`.

**Surviving permanently**: every other `lib/people/*` module — `data`,
`filters`, `parse-query`, `answer`, `chips`, `lookalikes`, `vocabulary`,
`saved-store`. The people adapter depends on them; only the chat transport dies.

## Follow-on work

**Spec 2c:** migrate Companies onto the panel; decompose
`companies-section.tsx`; add the companies binding; replace inline event results
with navigation; delete the five remaining legacy modules and their tests.

**Unscheduled:** `target_entity: "mixed"` and `cross_reference`, still blocked
on a linking key between the three datasets. Server-side favourites, which would
let the assistant answer questions about a user's saved shows.

# Instant trade-show search on the Events page (no model call)

**Date:** 2026-08-01
**Status:** Approved for planning

## Problem

Asking a trade-show question on the Events Explorer returns an empty table.

Two separate causes, both verified against the running system:

1. **The configured `ANTHROPIC_API_KEY` is rejected.** A direct call to
   `api.anthropic.com` with the key from `.env.local` returns
   `401 authentication_error — "API key is invalid."` The key is well-formed
   (108 chars, `sk-ant-api03-…`, no stray whitespace, identical in `.env` and
   `.env.local`) and was never committed to git, so this is not a
   leak-revocation — the server simply does not recognise it. Every call from
   `/api/ai/event-query` therefore fails and the route degrades.

   The Companies tab appears unaffected only because
   `app/api/companies/ask/route.ts` returns a non-200 on the same 401 and its
   client silently falls back to prefix search on company names. It is not
   using the model either.

2. **The degraded path cannot answer a normal question.** `keywordFallback`
   (`services/ai-event-query.service.ts:52`) takes the three longest
   non-stopword tokens and puts them in `filters.keywords`. Keywords are
   AND-ed with `.every()` against each event's `searchText`
   (`lib/events/filters.ts:183`). For *"plastics trade shows in Europe in Q1
   2026"* the fallback produces `["plastics", "europe", "2026"]`.

   Measured against the real catalog (9,771 events):

   | Keywords AND-ed | Matches |
   |---|---|
   | `plastics` | 359 |
   | `europe` | 196 |
   | `2026` | **1** |
   | `plastics` + `europe` | 25 |
   | `plastics` + `europe` + `2026` | **0** |

   The year is what empties the table. `searchText` is built from name, city,
   country, venue, organizer and categories — **it contains no dates** — so
   `2026` matches a single event by coincidence and the `.every()` collapses
   the set to nothing. Note `europe` is *not* a dead term (196 matches: it
   occurs in event names and category text), and `plastics` + `europe` alone
   would have returned a perfectly reasonable 25 rows.

Cause 2 is the one that makes the feature useless, and it is fixable today
without any credential.

## Goal

Typing a trade-show question into the Events Explorer search box fills the
results table immediately, with no network round trip and no API key.

Explicitly **out of scope**: obtaining a working API key, and the
grounded-prose answer above the table (dropped — see Decisions).

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Where translation happens | In the browser | All 9,771 events are already in the client bundle and `filterEventList` already runs client-side. A route would add a round trip for no gain. |
| Response shape | List only | Requested behaviour is "result should be fetched immediately in the form of list". Removing the second `/api/ai/event-answer` call removes the only remaining network wait. |
| Fate of the model path | Kept, unwired | `app/api/ai/event-query/route.ts` and `extractEventFilters` are left untouched so re-enabling Claude later is a one-line change in the component. |

## Design

### New module — `lib/events/parse-query.ts`

One exported pure function, free of React and of the Claude SDK so it can be
unit-tested and shared between the client and the API route (matching the
existing convention in `lib/events/filters.ts`):

```ts
export function parseEventQuery(
  prompt: string,
  today?: Date
): EventQueryResponse   // { filters, explanation, suggestedFollowUps }
```

`today` is injectable so date rules are testable against a fixed clock.

It returns the same `EventQueryResponse` shape the model path returns, so no
consumer needs to know which produced it.

#### Stage 1 — dates (regex, consumed from the prompt)

Applied in this order; the first match wins and its span is removed from the
prompt so later stages cannot re-read it as a place name:

| Pattern | Result |
|---|---|
| `between <date> and <date>`, `<date> to <date>` | explicit bounds |
| `Q1`–`Q4` with optional year | quarter bounds; bare quarter resolves to the next occurrence |
| `<month> <year>`, `next <month>`, `in <month>` | that calendar month; a bare month resolves forward |
| `this year`, `next year`, `this month`, `next month` | calendar bounds |
| `next 30 days`, `next 3 months`, `next 6 months` | delegates to the existing `dateRangeForPreset` |
| `spring`/`summer`/`autumn`/`fall`/`winter` | Mar–May / Jun–Aug / Sep–Nov / Dec–Feb |
| a bare 4-digit year, 2020–2100, not already consumed above | that whole calendar year |

The bare-year rule is load-bearing, not a nicety: it is what stops `2026`
reaching Stage 5, and an unconsumed year is the single most destructive
keyword the current fallback can emit (1 match out of 9,771).

Bounds are emitted as inclusive `YYYY-MM-DD` strings and validated with the
existing `isValidIsoDate` before being returned. If `dateFrom > dateTo` the
pair is swapped.

#### Stage 2 — vocabulary, longest match wins

A single candidate list of `{ phrase, dimension, value }` is built **once** at
module load and memoised:

| Dimension | Source | Approx. size |
|---|---|---|
| `regions` | `findShowsRegions` minus `All Regions`, plus aliases `APAC`, `asia pacific`, `middle east` | 4 + aliases |
| `categories` | `findShowsCategories` minus `All Categories` | 13 |
| `categories` | the `categoryRules` keyword table already in `catalog.ts` (`plastic` → `Plastics & Rubber`, …) | ~50 |
| `countries` | `findShowCountries`, plus aliases `UK`, `USA`, `US`, `UAE` | ~200 |
| `cities` | distinct `city` values across `findShowEvents` | 1,401 |
| `organizers` | distinct `organizer` values, excluding `?`, length ≥ 4 | 2,600 |

Candidates are sorted by phrase length descending and matched greedily against
the normalised prompt; each match consumes its span. Sorting by length is what
makes `Messe Frankfurt` win over `Frankfurt`, without needing a hand-tuned
precedence order between cities and organizers.

Two matching rules:

- Phrases are matched on **word boundaries**, not raw substrings. The
  `categoryRules` table contains short entries such as `die`, `gas`, `oil` and
  `tool`; a substring match would fire them on *diesel*, *Glasgow* and
  *Toolangi*.
- Matching uses the existing `normalize()` from `lib/events/filters.ts`, so
  accents and case behave the same way here as they do in the filter engine.

The `categoryRules` table is currently module-private in `catalog.ts` and will
be exported as `findShowCategoryRules`. It is reused rather than rewritten
because it is the same table that assigns categories to events, so the query
vocabulary and the data vocabulary cannot drift apart.

#### Stage 3 — explicit "no industry filter"

`all categories`, `any category`, `any industry`, `all industries` and
`across all sectors` clear `categories` and suppress Stage 2 category matching
for the rest of the prompt. Without this, "shows in all categories" matches the
literal category vocabulary and filters to something the user asked *not* to
filter by. (The model prompt already carries this rule; the local path needs
its own copy.)

#### Stage 4 — favourites

`my saved`, `my liked`, `favourite(s)`, `targeted`, `shortlisted` → `favouritesOnly: true`.

#### Stage 5 — leftovers to keywords, guarded

Remaining tokens are lowercased, stripped of the existing `STOPWORDS` set
(which already covers *show*, *shows*, *event*, *expo*, *fair*, *exhibition*,
*conference* and friends), and filtered to length > 3.

Surviving tokens are then admitted **one at a time, cheapest guard first**:

1. **Occurrence guard** — drop the token outright if it appears in no event's
   `searchText`. O(1) against a lazily-built, memoised `Set` of every word
   token in the catalog.
2. **Collapse guard** — tentatively add the token to the filters, re-run
   `filterEventList`, and **drop it if the match count falls to zero**. Keep it
   only if the narrowed set is still non-empty.

Guard 1 alone is *not sufficient*, which the measurements above demonstrate:
`2026` occurs in exactly one event, so it passes an occurrence check and still
empties the table when AND-ed with anything else. Guard 2 is what actually
holds the invariant **"a question that matches something never renders an
empty table"**.

At most 3 keywords are kept, preserving the current behaviour. Cost is at most
three extra `filterEventList` passes.

#### Output

- `filters` — a complete `EventFilters` (every field present, `emptyEventFilters()` as the base).
- `explanation` — one sentence naming what was read, e.g. *"Showing Plastics & Rubber shows in Europe between 1 Jan 2026 and 31 Mar 2026."* Non-empty in all cases; falls back to *"Showing all events — nothing specific to filter on."*
- `suggestedFollowUps` — up to 3, deterministic, each formed by appending one unused refinement to the **original prompt** so that re-parsing the suggestion standalone reproduces the intended narrowing (the existing UI calls `runQuery(suggestion)`, which replaces state wholesale). Rules: if no date bound, append *"in the next 3 months"*; if neither region nor country, append *"in \<top region\>"*; if no category, append *"in \<top category\>"*. Omitted entirely when the match set is empty.

To rank "top region" and "top category", and to decide whether to suggest
anything at all, the parser resolves its own filters against the catalog by
calling the existing `filterEventList(findShowEvents, filters, '', new Set())`
and `computeEventFacets` from `lib/events/filters.ts`. This keeps suggestions
honest — it will not offer a refinement that leads to an empty table. The
function stays pure and deterministic; it reads the static catalog, holds no
state, and performs no I/O.

### Performance

Stage 2 is ~4,300 boundary-matched `includes` calls against a prompt capped at
500 characters; Stage 5 is a `Set` lookup plus at most three `filterEventList`
passes (one per admitted keyword). Ranking follow-ups adds one more
`filterEventList` pass (9,771 events) and one `computeEventFacets` pass
(5 dimensions × 9,771) — at most five passes total. A pass measured **138 ms
for five passes** in a cold vitest run against the real catalog. All of it runs
once per submitted question, on a
catalog already in memory, and is comfortably within a frame — the section
already runs `filterEventList` and `computeEventFacets` on every keystroke in
the sidebar's `useMemo`s today. No new data is loaded and the 27 GB SQLite
companies dataset is not touched.

### Wiring

| File | Change |
|---|---|
| `lib/events/parse-query.ts` | **New.** The module above. |
| `lib/find-shows/catalog.ts` | Export `categoryRules` as `findShowCategoryRules`. No behaviour change. |
| `components/events/events-ai-search.tsx` | Replace the `fetch('/api/ai/event-query')` call in `runQuery` with `parseEventQuery`. Drop the `degraded` state and its amber "ANTHROPIC_API_KEY is not configured" banner — there is no longer a request that can degrade. Keep the chips, the recent-query store and the follow-up row. `isAsking` stays but is now momentary. |
| `components/crm/events-section.tsx` | Remove the `/api/ai/event-answer` effect and the `answer` / `isAnswering` state, and the props that carry them into `EventsAiSearch`. `question` is still recorded so a query can be restored from the recent list. |
| `services/ai-event-query.service.ts` | `keywordFallback` delegates to `parseEventQuery`, so the server-side degraded path improves too. |
| `app/api/ai/event-query/route.ts`, `extractEventFilters`, `models/ai-event-query.ts` | **Unchanged.** |
| `app/api/ai/event-answer/route.ts`, `answerFromRows` | **Unchanged**, but no longer called from the UI. |

### Empty results

An over-constrained question can still match nothing, and the parser does not
widen filters to avoid that — it reports what the user asked for.
`EventsResultsTable` already renders an empty state with
the active chips and a "clear all" action, which is the correct affordance —
the user can see exactly which constraint to drop. The Stage 5 guard makes the
*accidental* empty case (a dead keyword AND-ed in) go away; a genuine
"no plastics shows in Iceland next week" stays empty, correctly.

## Testing

New `tests/integration/event-query-parse.test.ts`, run with `npx vitest run`
(node environment, `@/` alias, per the existing suite):

**Unit — one case per rule, with a fixed `today`:**
- each date pattern in Stage 1, including the bare-quarter and bare-month forward resolution, and the `dateFrom > dateTo` swap
- region aliases (`APAC` → `Asia-Pacific`)
- category via the direct name and via a `categoryRules` keyword
- longest-match-wins: `"Messe Frankfurt"` yields an organizer, not the city `Frankfurt`
- word-boundary safety: `"diesel"` does not yield `Manufacturing & Engineering` via the `die` rule
- `"all categories"` clears rather than sets `categories`
- favourites phrases set `favouritesOnly`
- a bare year (`"shows in 2026"`) becomes a date range and **never** appears in `keywords`
- occurrence guard: a nonsense token (`"zzzqqq"`) is dropped from `keywords`
- collapse guard: a token that occurs but would zero the set (the `2026` case,
  asserted directly by feeding `keywords: ["plastics","europe","2026"]` past
  Stage 1) is dropped, and the surviving filters still match > 0 events

**Regression — the reported bug, asserted end-to-end against the real catalog:**
for each of *"plastics trade shows in Europe in Q1 2026"*, *"packaging expos in
India next year"* and *"medical trade fairs in Germany"*, feed
`parseEventQuery` into `filterEventList(findShowEvents, …)` and assert the
result is **non-empty** and that every returned event satisfies the parsed
constraint (region/category/country as applicable). The first of these is the
exact query measured at 0 matches today, so it fails against `keywordFallback`
and passes against `parseEventQuery` — pin it with that comment.

The existing `tests/integration/event-filters.test.ts` must continue to pass
unchanged.

## Follow-ups (not in this change)

- **Move the API key out of `.env`.** Line 1 of the tracked `.env` reads
  `Antropic Api key : sk-ant-…`. It is invalid dotenv syntax so it has no
  effect, but `.env` is git-tracked against a GitHub remote — one `git add .`
  publishes the key. The correct copy already exists in the gitignored
  `.env.local`; the `.env` line should simply be deleted.
- **Obtain a working key**, then re-enable the model path on top of this
  parser, with `parseEventQuery` as its fallback.
- **`/api/companies/ask` fails invisibly.** A 401 degrades to prefix search
  with no signal, which is what made a dead key look like a working one. It
  should surface the failure the way the Events route does.

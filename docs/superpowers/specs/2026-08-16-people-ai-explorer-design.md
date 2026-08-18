# People AI Explorer — filter rail, streaming chat, results view

**Date:** 2026-08-16
**Status:** Approved 2026-08-16 — decisions 5 (Saved People in `localStorage`) and
6 (confidence chips, not a slider) confirmed by the owner
**Supersedes:** `2026-08-01-people-explorer-design.md`

## Problem

`/app/people` does not match `/app/companies`, and nothing on it is wired.

Verified against the code on disk and against the running app on 2026-08-16:

1. **The layout is mirrored the wrong way.** The rendered HTML of `/app/companies`
   uses `xl:grid-cols-[360px_1fr]` (stepping to `390px` at the wider breakpoint) —
   filters left, content right. `/app/people` uses `xl:grid-cols-[1fr_360px]` —
   content left, a permanently docked person-detail card right.
2. **There is no People data and no People API.** `GET /api/people` and
   `POST /api/people/chat` both return 404. `app/api/people/` does not exist.
3. **The page is entirely mock.** `components/crm/people-section.tsx` is 462 lines
   rendering 7 hardcoded contacts from a module-level `contactsList` array. The
   badge `2,418 contacts` at `people-section.tsx:49` is a string literal counting
   nothing. All five filter controls are static `<button>` elements.
4. **The Prisma `Contact` model cannot back the requested facets.**
   `prisma/schema.prisma:193` carries only `firstName, lastName, email, title,
   verified, companyId`. The requested rail needs confidence, source, seniority,
   department, industry, headcount, keywords, buying intent and platform score.
5. **The shared search primitives already exist.** Commit `83d119d` extracted
   `components/search/ai-search-panel.tsx`, `filter-accordion.tsx`,
   `filter-chips.tsx` and `query-store.ts`. `AiSearchPanel` already implements the
   requested empty state: gradient sparkle badge, gradient-bordered textarea,
   circular `ArrowUp` send button, Enter-to-send / Shift+Enter-newline, and
   `Recent | Saved` tabs backed by `useQueryStore`. `CompactSearchBar` in the same
   file is its collapsed form.
6. **Companies does not consume those primitives.** Its "Find anything" hero is an
   inline duplicate at `components/crm/enriched-leads-finder-panel.tsx:206`. Only
   `components/events/*` imports `components/search/*`.

## Goal

Typing *"verified marketing managers in Germany"* into the right-hand panel fills
a results table immediately, answers in prose, shows how the question was read as
chips, and ticks the left rail to match — with filter state in the URL so the
search is shareable.

Explicitly **out of scope**: repairing the Companies/Events AI, de-duplicating
Companies' inline hero, persisting contacts to Postgres, wiring Import/Export,
and implementing the bulk actions' side effects (the toolbar ships wired to
selection state, but Verify/Sequence/Merge are follow-ups).

## Decisions

These four were settled with the owner before drafting; each overrides the
superseded spec where they conflict.

1. **Data — generated committed seed.** `scripts/generate-people-seed.mjs` writes
   `data/people-seed.json` (2,418 records, ~1.5 MB, committed). Served through
   `app/api/people/route.ts`. No schema migration, no database, no seed run.
2. **Chat — local parser with graceful LLM upgrade.** `/api/people/chat` always
   parses the question into filters locally and can always answer from templated
   prose over real counts. When a working `ANTHROPIC_API_KEY` is present it
   upgrades the prose to a streamed Claude call. **The wire format is identical
   either way**, so the client never branches and the panel is never dead.
3. **"View all N results" — the right panel switches mode.** The right column
   carries a `Chat | Results` switch. `View all` flips it to a full paginated
   table; the chat thread is preserved underneath. No third column.
4. **The four uncommitted route deletions stay untouched.**
   `app/api/ai/event-answer`, `app/api/ai/event-query`, `app/api/companies/ask`
   and `app/api/events/search` remain deleted. `companies-section.tsx:856` and
   `:915` still fetch two of them, so the Companies AI is broken; that is the
   owner's call to resolve separately. Nothing in this change depends on them.

Two further calls, made in drafting and flagged for the reviewer:

5. **Saved People persists to `localStorage`**, mirroring `query-store.ts` — not to
   a `SavedPerson` Prisma model. Companies uses a table (`/api/saved-companies`),
   but adding one contradicts decision 1. Behind `lib/people/saved-store.ts`, so
   swapping to an API later is a one-file change.
6. **Confidence ships as `≥50% / ≥70% / ≥90%` chips**, not a slider, matching the
   pill style used elsewhere in the rail.

### Environment note

`ANTHROPIC_API_KEY` lives in **`.env.local`**, not `.env`. A prior session
recorded that key being rejected with a 401 on 2026-08-04. Decision 2 is
therefore protection against an *invalid* key, not merely a missing one: the
degraded path must be triggered by a failed call, not only by an absent variable.

Unrelated but worth recording, since it is the pattern one would otherwise copy:
`app/api/companies/route.ts:2` imports `prisma` and queries the Postgres
`DiscoveryCompany` table. **CLAUDE.md is stale** where it says `/api/companies`
reads SQLite via `lib/db/sqlite-companies.ts`.

## Data

`scripts/generate-people-seed.mjs` uses a seeded PRNG so output is byte-identical
across runs and tests are stable. It asserts its own distributions before
writing, so every facet is populated and the header stats are real.

```ts
type Person = {
  id: string;
  firstName: string; lastName: string;
  title: string; seniority: Seniority; department: Department;
  company: string; companyDomain: string;
  companyHeadcount: HeadcountBand; industry: string;
  country: string; location: string;
  workEmail: string; phone: string | null; linkedinUrl: string | null;
  verification: "verified" | "needs_verification" | "invalid";
  confidence: number;      // 0-100
  platformScore: number;   // 0-100
  source: "user_import" | "licensed_dataset" | "enrichment";
  keywords: string[];
  buyingIntent: "high" | "medium" | "low" | "none";
  fetchedAt: string;       // ISO
  lastActiveAt: string;    // ISO
};
```

Constraints: total exactly 2,418 (the number already on screen); mean confidence
≈ 84 so the data-source strip reads `84% (Good)`; every closed vocabulary in
`types/people.ts` has at least 20 members represented.

The file is the only generated artefact. It lives in `data/`, never in a temp
directory, and nothing is written to `C:`.

## Filters

Fourteen groups, in the order requested. Each is a `FilterAccordion` from
`components/search/filter-accordion.tsx`; the multi-select ones use
`FacetOptionList`, which already provides live counts, a search box for long
lists, pinned selections and a "Show N more" step.

| # | Group | Control | Values |
|---|---|---|---|
| 1 | AI Lookalikes | seed picker | ranked similarity to a chosen person |
| 2 | Verification Status | single-select | All / Verified / Needs verification / Invalid |
| 3 | Confidence Score | single-select | ≥50% / ≥70% / ≥90% |
| 4 | Data Source | multi | User import / Licensed dataset / Enrichment |
| 5 | Job Title | multi + search | distinct titles |
| 6 | Seniority | multi | closed vocabulary |
| 7 | Department | multi | closed vocabulary |
| 8 | Company | multi + search | distinct companies |
| 9 | Location | multi + search | city/region |
| 10 | Country | multi + search | closed vocabulary |
| 11 | Employee Headcount | multi | 1-10 … 5000+ |
| 12 | Industry | multi + search | distinct industries |
| 13 | Keywords | multi + search | tag vocabulary |
| 14 | Buying Intent | multi | High / Medium / Low / None |

Above them sits the search input (`Search people, or ask about contacts...`) with
helper text `Press Enter to ask — e.g. "verified marketing managers in Germany"`,
then an `All` chip row. A sticky footer inside the panel holds `Clear all` and the
active-filter count.

**AI Lookalikes** is defined concretely, with no model call: pick a seed contact
(from the rail's picker or the detail slide-over's "Find similar"), then score
every other person on weighted overlap of seniority, department, industry,
headcount band and country. Returns a ranked list; the weights live in
`lib/people/lookalikes.ts` and are unit-tested.

## Logic modules

Pure, synchronous and framework-free, so the client may import them directly for
zero-latency typing while the route wraps the same functions for parity.

| File | Responsibility |
|---|---|
| `types/people.ts` | `Person`, `PeopleFilters`, closed vocabularies, `emptyPeopleFilters`, `hasAnyPeopleFilter` |
| `lib/people/data.ts` | Typed seed loader + memoized facet indexes |
| `lib/people/filters.ts` | `applyFilters`, `facetCounts`, `filtersToParams`, `paramsToFilters` |
| `lib/people/vocabulary.ts` | Country / seniority / department / verification aliases |
| `lib/people/parse-query.ts` | Natural language → `PeopleFilters` |
| `lib/people/chips.ts` | `PeopleFilters` → `QueryChip[]` |
| `lib/people/answer.ts` | Templated prose from filters + real counts |
| `lib/people/lookalikes.ts` | Similarity scoring |
| `lib/people/saved-store.ts` | Saved People, `localStorage` |

## API

### `GET /api/people`

Query params are the `PeopleFilters` serialisation plus `page` and `pageSize`.

```jsonc
{
  "results": [ /* Person[] */ ],
  "total": 214, "totalPages": 9,
  "facets": { "country": [{ "value": "Germany", "count": 214 }] /* … */ },
  "stats": { "total": 2418, "avgConfidence": 84,
             "lastFetchedAt": "2026-02-01", "sources": ["user_import", "licensed_dataset"] }
}
```

`facets` drives the rail's live counts; `stats` drives the header badge and the
data-source strip, so no number on the page is hardcoded.

### `POST /api/people/chat`

Body `{ message, conversationId, activeFilters, page }`. Responds as a
`ReadableStream` of newline-delimited JSON:

```
{"type":"filters","filters":{…},"chips":[…]}   ← instant local parse
{"type":"results","results":[…10],"total":214} ← table fills
{"type":"token","text":"Found 214 verified…"}  ← prose streams in
{"type":"done"}
{"type":"error","code":"rate_limited","message":"…"}
```

Filters and results are emitted **before** prose so the table never waits on the
answer. With no usable key the tokens come from `lib/people/answer.ts` in chunks;
with one they come from `@anthropic-ai/sdk` (already a dependency — no install).
A failed or 401'd call falls back to the templated stream mid-flight rather than
erroring.

Both routes follow the repo's controller shape — `validateBody()` → service →
`jsonOk`/`jsonError` from `lib/http/` — and use `UnauthorizedError` from
`lib/http/errors.ts` rather than bare `Error`, per the CLAUDE.md gotcha. Like
`/api/companies`, they are deliberately **not** tenant-scoped: the seed is a
shared discovery dataset, not workspace data.

Rate limiting is an in-memory per-IP token bucket emitting
`{"type":"error","code":"rate_limited"}`.

## UI

### Shell — `components/crm/people-section.tsx`

Rewritten as a thin composition root: header (title + live count badge, subtitle
`Search contacts, verify emails, and move people into CRM workflows.`, `Import
CSV/XLSX` and `Export` buttons), the `People | Saved People` tab row, the slim
data-source strip, then the two columns at
`xl:grid-cols-[360px_1fr] 2xl:grid-cols-[390px_1fr]` — matching Companies exactly.

### New components — `components/people/`

| File | Responsibility |
|---|---|
| `people-filter-sidebar.tsx` | 14 accordions, `All` chip row, sticky Clear-all footer |
| `people-chat-panel.tsx` | empty ⇄ thread states, `Chat \| Results` mode switch |
| `people-message.tsx` | answer + chips + `Apply filters` + capped inline table |
| `people-results-table.tsx` | shared cell renderers |
| `people-bulk-toolbar.tsx` | Select all / Verify emails / Add to Sequence / Merge / "N selected" |
| `people-detail-slideover.tsx` | right-hand slide-over |
| `use-people-chat.ts` | `{ messages, isStreaming, error, send, retry, stop }` |

`people-results-table.tsx` serves both the capped 10-row inline table and the
full Results view, so cell rendering cannot drift between them. Cells carry over
from the current page: avatar + name/title, Platform Score (star), Company, Work
Email, Status badge (emerald `Verified` / amber `Needs verify`), Confidence bar.

### Reuse

Used unchanged: `FilterAccordion`, `FacetOptionList`, `FilterChips`,
`AiSearchPanel` (empty state), `CompactSearchBar` (pinned composer),
`useQueryStore`, `relativeTime`.

Two additive changes to shared files, neither altering Events or Companies
behaviour:

- `SavedQueryKind` in `query-store.ts` gains `"people_query"`.
- `AiSearchPanel` gains an optional `defaultTab?: TabKey` prop, so People's empty
  state can show `Recent` expanded. It currently starts collapsed. `TabKey` is
  declared but **not exported** at `ai-search-panel.tsx:26`; it must be exported
  for the prop to be usable by callers.

People uses the **shared** `AiSearchPanel`, not a copy of Companies' inline hero.

### The `Saved People` tab

Selecting `Saved People` replaces **both** columns with a single full-width
`people-results-table.tsx` over the saved set from `lib/people/saved-store.ts`,
plus the bulk toolbar and an empty state (`No saved people yet — save contacts
from the results table`). Rows are saved via a star control in the results table
and in the detail slide-over. The rail and chat are hidden rather than disabled,
because neither filters nor questions apply to a hand-curated list. The tab is
reflected in the URL as `?tab=saved`.

### Import and Export

`Import CSV/XLSX` and `Export` are carried over from the current header as
**presentational only**, matching their present state — this change does not wire
them. `app/api/import/` and `app/api/export/[resource]/` exist but target
workspace resources, not the unscoped seed, so connecting them requires deciding
where imported contacts persist. That decision belongs to the follow-up that
promotes People to a persisted model.

### Detail slide-over

Clicking a row opens a right-hand slide-over — replacing today's docked third
column — carrying Add to CRM, Add to Sequence, work email, country, phone, title,
LinkedIn URL and the Source / Fetched / Confidence block. Dismissed by Escape,
backdrop click or the close button; focus is trapped while open and restored to
the originating row on close.

## State

`PeopleFilters` lives in the URL query string as the single source of truth, read
with `useSearchParams` and written with `router.replace` so filter changes do not
flood browser history. The rail writes to it; `Apply filters` on a chat message
writes to it; `use-people-chat` reads it as `activeFilters` on every send. One
direction of truth means the two panels cannot disagree — this is what makes the
bidirectional requirement hold without a sync effect.

`?tab=`, `?view=chat|results` and `?page=` ride along, so a shared link restores
the exact view.

## Edge cases

| Case | Behaviour |
|---|---|
| No matches | `No contacts match — try relaxing verification or confidence`, plus a **Relax filters** action dropping exactly those two facets |
| Request failed | Error bubble with **Retry**, backed by `retry()` |
| Rate limited | Distinct message with a countdown; no retry button until it elapses |
| Stream interrupted | Partial answer retained, marked incomplete, Retry offered |
| LLM 401 / unavailable | Silent fallback to templated prose — the user sees an answer, not an error |
| Empty seed / load failure | Rail and table render an explanatory empty state rather than throwing |

## Responsive & theming

Below `1024px` the rail becomes a framer-motion drawer behind a **Filters** button
in the header, with a backdrop and body-scroll lock; the chat takes full width.
The results table scrolls horizontally inside its own container so the page body
never does.

All surfaces use the existing paired tokens — `bg-white dark:bg-[#111B2E]`,
`border-slate-200 dark:border-[#22304A]`, inner `dark:bg-[#0B1220]`, hover
`dark:bg-[#16233A]`, `rounded-[10px]`/`[12px]`/`[16px]`, bracketed font sizes,
indigo accent — so Light, Dark and System all work. Every surface gets its dark
token; none is left to inherit.

## Testing

Vitest, node environment, in `tests/integration/`. Run one-shot with
`npx vitest run` — **not** `npm test`, which is watch mode.

| File | Covers |
|---|---|
| `people-filters.test.ts` | each of the 14 facets, combinations, facet counts, `filters ⇄ params` round-trip |
| `people-parse-query.test.ts` | `"verified marketing managers in Germany"` and the alias/plural cases |
| `people-lookalikes.test.ts` | ranking determinism, seed excluded from its own results |
| `people-route.test.ts` | `GET /api/people` filtering, paging, `stats`/`facets` shape |
| `people-chat-route.test.ts` | event **ordering** (`filters` → `results` → `token` → `done`), empty results, rate limit, no-key path, mid-flight LLM failure |

`tests/integration/event-filters.test.ts` must still pass unchanged.

## Constraints

- **No new dependencies.** `@anthropic-ai/sdk` is already installed.
- **Nothing heavy.** No `db:seed`, no `sqlite:optimize`, no benchmarks, no build.
  This feature touches no database.
- **`data/people-seed.json` (~1.5 MB) is the only generated artefact**, and it
  lives in the repo, not on `C:`.
- **Events and Companies are not modified**, beyond the two additive changes to
  `components/search/*`.

## Acceptance

1. `/app/people` renders filters left / chat right at
   `xl:grid-cols-[360px_1fr]`, visually matching `/app/companies`.
2. The header badge, data-source strip and every facet count come from
   `/api/people`. The string `2,418` appears in no component.
3. Asking *"verified marketing managers in Germany"* streams an answer, shows
   `Title contains: Marketing Manager`, `Verification: Verified`,
   `Country: Germany` as chips, and renders matching rows — **with no API key
   set**.
4. `Apply filters` ticks the left rail; changing the rail changes what the next
   message is sent as `activeFilters`; both are reflected in the URL.
5. `View all N results` switches the right panel to the paginated Results view
   and back, with the chat thread intact.
6. Clicking a row opens the slide-over; Escape closes it and restores focus.
7. Starring a row moves it into `Saved People`, which survives a page reload.
8. Below 1024px the rail is a drawer and the chat is full width.
9. The page is correct in Light, Dark and System.
10. `npx vitest run` passes, including the untouched Events suite.

## Follow-ups (not in this change)

- Wire the bulk actions' side effects (Verify emails, Add to Sequence, Merge).
- Decide the fate of the four deleted AI routes and the dead fetches at
  `companies-section.tsx:856` / `:915`.
- Move Companies' inline hero onto the shared `AiSearchPanel`.
- Promote Saved People from `localStorage` to a persisted model.
- Correct CLAUDE.md's stale SQLite description of `/api/companies`.

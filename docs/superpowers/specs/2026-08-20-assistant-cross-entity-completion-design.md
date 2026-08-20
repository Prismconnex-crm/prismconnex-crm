# Cross-Entity Assistant Completion — Design

**Date:** 2026-08-20
**Status:** Approved, ready for planning
**Scope:** The umbrella for "one AI search panel on all three pages, with
cross-entity routing". Fully specifies Phase 1 (model credential status),
Phase 3 (Spec 3b — the Companies migration) and Phase 4 (cache, query log,
enum guard). Phase 2 is `2026-08-18-assistant-entity-aware-panel-design.md`
(Spec 3a) and is **not** re-specified here.

**Depends on:** `2026-08-17-assistant-entity-router-design.md` (Spec 1, shipped),
`2026-08-17-assistant-shared-conversation-design.md` (Spec 2a, shipped),
`2026-08-17-assistant-events-migration-design.md` (Spec 2b, shipped),
`2026-08-18-assistant-entity-aware-panel-design.md` (Spec 3a, approved, unbuilt).

## Problem

The request that prompted this spec described building the cross-entity
assistant from scratch. Most of it already exists: the router (Spec 1), the
shared conversation (2a) and the Events migration (2b) all shipped, and Spec 3a
is designed. Rebuilding would have discarded twelve passing test files and
duplicated the routing engine.

What is actually missing falls into three groups.

**The credential status is wrong, not the credential plumbing.**
`isConfigured()` in `lib/assistant/route.ts:25` is `Boolean(process.env.ANTHROPIC_API_KEY)`.
The key is read server-side only and is never bundled — that part is already
correct. But the key currently in `.env.local` is *present and rejected*: a live
call returns `401 authentication_error, "API key is invalid."` Because the check
only asks whether the variable is non-empty, the app reports "configured", the
call then fails, and `components/crm/companies-section.tsx:1232` renders
"Event search is unavailable — ANTHROPIC_API_KEY is not configured." The message
names the wrong cause and sends the reader to the wrong file. This is the same
failure shape as the `SUPABASE_ANON_KEY=""` incident earlier the same day, and
the remedy is the same: say which thing is actually broken.

**Companies is still on the legacy path.** `components/assistant/registry.ts`
carries `// companies lands in Spec 2c` and `hasBinding('companies')` is false,
so the navigation effect in `assistant-provider.tsx` returns early for every
handoff targeting companies. The Companies page instead runs an inline
trade-show pane against `/api/events/search`. That pane is the box that shows the
misleading key error.

**Three non-functional requirements have no implementation.** There is no
response cache, nothing logs the parsed tool JSON for later review, and nothing
stops the model emitting a region or category that does not exist in the facet
lists. The prompt asks for valid values; nothing enforces it.

## Goals

- A credential check that distinguishes *unset* from *rejected*, and says so.
- Companies mounted on the same panel, conversation and router as People and
  Events, with its legacy routes deleted.
- Filter values the model invents dropped before they reach a query.
- Identical question + facet state answered from cache for five minutes.
- Every query recorded with its parsed JSON so bad parses can be reviewed.
- Each phase independently shippable and green on its own.

## Non-goals

- **Re-specifying Spec 3a.** URL-backed filter state and the handoff UX for
  People and Events are designed in `2026-08-18-assistant-entity-aware-panel-design.md`.
  This spec sequences it as Phase 2 and depends on it; it does not restate it.
- **A new panel component.** `AiSearchPanel` already exists in
  `components/search/ai-search-panel.tsx` as a presentational shell taking
  `title`/`kind`/`onSubmit`. `AssistantPanel` wraps it. Neither is renamed and no
  `entity`-prop variant is introduced — that name is taken, and the wrapper
  already carries entity awareness.
- **A new endpoint.** `POST /api/assistant/chat` and its NDJSON stream stay as
  they are. No `/api/ai/search` is added.
- **Changing the model.** `lib/assistant/route.ts` stays on `claude-sonnet-5`.
  Classification sits in front of every answer behind a 4-second timeout, so it
  is latency-sensitive; swapping the model is a behaviour change that does not
  belong to this work.
- **Restructuring the contract into one nested three-entity object.** See the
  first decision below.
- **Obtaining a valid API key.** Out of the repo's control. Phase 1 makes its
  absence legible; it cannot make it work.

## Decisions

### The per-entity tool contract stays; four fields are added

The router forces exactly one tool per entity (`route_to_events`,
`route_to_companies`, `route_to_people`), and each adapter owns its own filter
type. An adapter therefore cannot return another entity's rows — the property
`CLAUDE.md` credits with preventing wrong-entity answers.

The alternative considered was a single tool returning
`{target_entity, filters: {events, companies, people}}`. It was rejected: it
makes `target_entity: "events"` with a populated `filters.people` a
representable state, so a class of bug currently impossible becomes merely
discouraged, and it would require rewriting all three adapters and their tests.

Each entity's `input_schema` instead gains the four fields the current contract
lacks:

| Field | Type | Source |
|---|---|---|
| `search_text` | `string` | model |
| `explanation` | `string` | model, one sentence |
| `needs_clarification` | `boolean` | model |
| `clarifying_question` | `string \| null` | model, non-null iff the above is true |

`entity` continues to come from *which tool fired*, never from a model-supplied
field, and `confidence` continues to be computed from the agreement of the two
classifiers rather than self-reported.

### The credential check returns a status, not a boolean

New `lib/assistant/model-config.ts`, the single reader for `ANTHROPIC_API_KEY`,
mirroring what `lib/supabase/config.ts` does for Supabase:

```
type ModelCredentialStatus =
  | { state: 'ok' }
  | { state: 'missing' }
  | { state: 'invalid'; detail: string }   // set 401 by the last live call
```

`missing` is decided by reading the variable — trimmed, so a whitespace-only
value counts as unset, matching the Supabase reader's definition.

`invalid` cannot be known without calling the API, so it is *observed*: the
route catches `Anthropic.AuthenticationError` and records the status in a
process-local cell that the next request reads. The cell is cleared whenever a
call succeeds, so replacing the key recovers without a restart. This is
deliberately not a startup probe — the app must boot without network.

Both states produce the same user-visible behaviour (keyword fallback) and
different diagnostics:

| State | Server log | Admin banner |
|---|---|---|
| `missing` | `ANTHROPIC_API_KEY is not set` | "AI search is falling back to keyword search: ANTHROPIC_API_KEY is not set." |
| `invalid` | `ANTHROPIC_API_KEY was rejected (401)` | "AI search is falling back to keyword search: the configured ANTHROPIC_API_KEY was rejected by Anthropic (401). The variable is set — the key itself is not valid." |

### The banner is admin-only, and absence of the banner is not absence of the fallback

Visibility is gated on `resolveTenant()` returning role `ADMIN`
(`lib/rbac/authorize.ts`). Every other role sees keyword results with no notice
at all — the results are still correct, merely not model-ranked. The gate is
evaluated server-side and the banner text is only included in the response for
admins, so a non-admin cannot read it out of the payload.

### Invented filter values are dropped, not passed through

New `lib/assistant/enum-guard.ts`. Each adapter already knows its facet lists;
the guard takes a parsed filter object and the allowed values, and returns the
object with unknown members of enum-typed list fields removed, plus the list of
what it dropped.

Two rules make it safe to apply unconditionally:

- Only **closed** fields are guarded — `region`, `country`, `category`,
  `seniority`, and the like. Open text (`keywords`, `search_text`) and id lists
  (`attending_event_ids`, `company_ids`) pass through untouched, because their
  valid set is not enumerable up front.
- Dropping is silent to the query but **not** to the log: every dropped value is
  recorded by Phase 4's query log, since a model repeatedly inventing the same
  region is a prompt bug worth seeing.

The facet lists are also injected into the system prompt, as the request asked.
The prompt is the request; the guard is the guarantee.

### The cache key includes the facet state, and only successes are cached

New `lib/assistant/cache.ts`, process-local `Map` with a 5-minute TTL, in the
style of `lib/assistant/rate-limit.ts` (no new dependency, no shared store).

Key: `hash(entity + normalized question + serialized facet state)`. The facet
state must be in the key because the same words asked against a different
already-applied filter set are a different question — omitting it is how a cache
starts returning stale answers to refinements.

Only successful classifications are cached. A fallback result is never cached,
so restoring a valid key takes effect on the next question rather than after the
TTL expires.

### Companies gets a filter codec of its own

`lib/events/filters.ts` and `lib/people/filters.ts` already provide "pure
filtering, faceting and URL (de)serialisation". Companies has no equivalent, so
Phase 3 adds `lib/companies/filters.ts` following those two exactly. No shared
`url-state.ts` is introduced — that would duplicate two working modules to
accommodate a third.

## Phases

Each phase is independently shippable and leaves the suite green.

### Phase 1 — Credential status (no dependencies)

`lib/assistant/model-config.ts`, the observed-401 cell, the admin-gated banner,
and replacement of the hardcoded string at `companies-section.tsx:1232` with the
real status. Ships first because it is small and makes the currently-visible
error tell the truth. Does not require Spec 3a.

### Phase 2 — Spec 3a, as already designed

Implement `2026-08-18-assistant-entity-aware-panel-design.md`: URL-backed filter
state for People and Events, `sourceFilters` populated rather than hardcoded
`null` (`conversation-reducer.ts:98`), and the handoff UX. Phase 3 depends on it,
because a Companies migration onto a panel whose filter state does not survive
navigation would have to be redone.

### Phase 3 — Spec 3b, the Companies migration

`lib/companies/filters.ts`; `components/assistant/bindings/companies.tsx`;
registration in `components/assistant/registry.ts` (removing the
`// companies lands in Spec 2c` hole so `hasBinding('companies')` is true).

Then the deletions, which are only safe once the binding exists:
`app/api/companies/ask/`, `app/api/events/search/`,
`services/event-query.service.ts`, and the inline trade-show pane in
`components/crm/companies-section.tsx`.

This phase satisfies the acceptance criterion.

### Phase 4 — Cache, query log, enum guard

`lib/assistant/cache.ts`, `lib/assistant/query-log.ts`,
`lib/assistant/enum-guard.ts`, wired into `lib/assistant/route.ts`. Last because
each is an addition to a path the earlier phases leave settled.

## Data flow — the acceptance case

Asked on `/app/companies`: *"which shows are in Germany in Q1"*.

1. `POST /api/assistant/chat` with `{message, currentPage: 'companies'}`.
2. Cache lookup on `hash('companies' + question + facet state)` — miss.
3. Deterministic classifier and model classifier both run; `route_to_events`
   fires; confidence comes from their agreement.
4. `enum-guard` drops any `region`/`country` not in the Events facet lists.
5. Query log records the question, the parsed JSON and anything dropped.
6. Response: `action: 'navigate'`, `entity: 'events'`, filters, `explanation`.
7. Client encodes the filters with the Events codec and pushes
   `/app/events?region=Europe&country=Germany&date_from=…&date_to=…`.
8. Events reads its filters from the URL on first render, so the sidebar
   checkboxes and the rows are correct on first paint. No unfiltered flash,
   because nothing needs to be fetched before the filters are known.
9. Phase two re-sends with `forceEntity: 'events'`, which skips both classifiers
   and makes a navigate→navigate bounce unrepresentable.
10. The panel — mounted in `app-shell.tsx`, so it survived the navigation —
    shows the explanation and an Undo restoring the previous query string via
    the existing `goBackTarget()`.

## Error handling

| Condition | Behaviour |
|---|---|
| Key unset | Keyword fallback; server log; admin banner ("not set") |
| Key rejected (401) | Keyword fallback; server log; admin banner ("rejected") |
| Classification timeout (4s) | Existing deterministic classifier result stands |
| Rate limit exceeded | Existing token bucket; `retryAfterSeconds` returned |
| Model returns no tool call | `null` classification; deterministic result stands |
| `needs_clarification` | Panel renders `clarifying_question`; no navigation, no filters applied |
| Invented filter value | Dropped by the guard; recorded in the query log |

Cache and log failures are non-fatal by construction: a cache miss is
indistinguishable from a cold start, and a log write that throws is caught and
swallowed rather than failing a user's question.

## Testing

The suite must not need a live key — model calls are swapped via
`setAdapterForTests` / `resetAdapters` (`lib/assistant/registry.ts`), as the
existing twelve assistant test files already do.

| Test | Asserts |
|---|---|
| Schema validation | Each entity tool schema accepts a valid payload and rejects a malformed one, including `clarifying_question` non-null iff `needs_clarification` |
| Enum-value guard | Invented `region`/`category` dropped; open text and id lists untouched; dropped values reported |
| Routing decision | Cross-page question yields `navigate` with the right entity; `forceEntity` prevents the bounce |
| URL round-trip | `filters → params → filters` is identity for all three entities, including empty and multi-value cases |
| Cache | Identical question + facet state hits; changed facet state misses; expiry after 5 min; fallback results never cached |
| Credential status | `missing` for unset and whitespace-only; `invalid` after an observed 401; recovery to `ok` after a success |
| Admin gating | Banner text present for `ADMIN`, absent from the payload for every other role |

## Risks

**The key is invalid today.** Phases 1–4 can all be built and tested without a
working key, because the tests mock the model. But the live model path —
real tool use, real streaming — stays unverified until a valid key is present.
Phase 1 makes that state legible rather than fixing it; do not read a green
suite as evidence that live classification works.

**Phase 2 is someone else's spec.** Spec 3a is approved but unbuilt and unplanned.
If it changes during planning, Phase 3's assumptions about where filter state
lives change with it.

**Deleting the legacy routes is one-way within a phase.** `/api/events/search`
has exactly one caller (the Companies pane) and `/api/companies/ask` likewise;
both deletions land in Phase 3 *after* the binding is registered, so the page is
never without a working search. `CLAUDE.md` records that a previous merge
silently resurrected a comparable set of deleted Events files — if these
reappear, it is a merge resolution, not a feature.

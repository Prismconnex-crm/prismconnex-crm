# Assistant Shared Conversation — Design

**Date:** 2026-08-17
**Status:** Approved, ready for planning
**Scope:** The shared conversation layer, with People as its first consumer.
First of the two UI specs; Companies and Events migrate in Spec 2b.

**Depends on:** `2026-08-17-assistant-entity-router-design.md` (Spec 1, shipped —
`lib/assistant/`, `POST /api/assistant/chat`).

## Problem

Spec 1 built a router that decides which entity a question belongs to and
returns a navigation handoff when the answer lives on another page. Nothing
consumes it. The three pages still run three separate panels against four legacy
routes, and each panel's conversation dies when the user leaves the page — so
the handoff the router emits has nowhere to land.

## Goals

- One conversation that survives navigation between Companies, Events and People.
- A shared panel whose thread and streaming behaviour are written once.
- A navigation handoff the user can see and undo.
- People migrated onto `/api/assistant/chat` end to end, proving the layer.

## Non-goals (Spec 2b)

- Migrating Companies and Events, and splitting `companies-section.tsx` (1746
  lines) and `events-section.tsx` (1029 lines).
- Reconciling the two `EventFilters` types for the Explorer rail.
- Deleting the four legacy AI routes and their services and tests.

Spec 2a leaves all five legacy routes working and deletes none of them:
`/api/companies/ask`, `/api/ai/event-query`, `/api/ai/event-answer`,
`/api/events/search` and `/api/people/chat`. The last of those stops being
called once People is migrated, but it is removed in Spec 2b with the rest so
that a single spec owns the teardown.

## Decisions

### The provider lives in AppShell, so no serialization is needed for navigation

`app/(app)/app/layout.tsx` renders `AppShell` around `[...slug]/page.tsx`. In the
App Router a layout persists across navigations within its segment, so moving
from `/app/companies` to `/app/events` swaps only the page child — `AppShell`
stays mounted.

A context provider inside `AppShell` therefore survives the handoff with plain
React state. The localStorage round-trip Spec 1 assumed would be necessary is
not.

### Phase two of a handoff must not re-classify

Spec 1's `navigate` branch emits no `results` and ends the stream, so the target
page re-runs the query. If that second request classifies from scratch it can
disagree with the first: Companies routes to Events, Events routes back to
Companies, forever. At 0.75 confidence — the band where the two classifiers
already only weakly agree — this is likely, not hypothetical.

So phase two is not a fresh question. The client already holds
`interpretedFilters` from the `route` event and re-sends with the decision
attached:

```
POST /api/assistant/chat
{ message, currentPage: 'events', forceEntity: 'events', presetFilters: { ... } }
```

When `forceEntity` is present the endpoint skips both classifiers and goes
straight to `answer_inline`. The loop becomes structurally impossible rather
than guarded by a counter, and a cross-page question costs exactly one
classification instead of two.

**This requires a Spec 1 server change** — two optional body fields and a preset
path through `createAssistantStream`. It is the only server work in Spec 2a.

### Incoming filters replace conflicting keys

A new question's filters overwrite the same keys on the target page; unrelated
filters the user set by hand survive. Asking for Germany while the rail holds
France should show Germany — but silently discarding an industry filter the user
chose would be equally wrong.

This lives in each `PageBinding`, not in shared code, because the shapes differ:
people's filters are array-valued (`countries: string[]`), the events ask-path's
are scalar (`country: string`). A generic merge would have to guess; ten obvious
lines per binding would not.

### Logic lives outside components, because components cannot be tested here

The repo has no jsdom, no happy-dom, no React Testing Library and no Playwright,
and vitest runs `environment: 'node'`. Adding them conflicts with the
disk-space rule in `CLAUDE.md`.

Rather than ship untested behaviour, the behaviour moves out of React: a pure
reducer, pure filter application, pure handoff resolution, a pure session
mirror. Components become thin wiring. This is better structure regardless, and
it makes the stream-handling paths — interrupted streams, aborts, malformed
frames — reachable from a node test for the first time.

### AiSearchPanel is kept, not rewritten

`components/search/ai-search-panel.tsx` (517 lines) already owns the hero, the
compact search bar and the Recent/Saved cards, and is the one piece all three
pages genuinely share today. `AssistantPanel` wraps it and adds the thread.

## Architecture

```
components/assistant/
  assistant-provider.tsx    context; owns messages, streaming, previousEntity, pendingHandoff
  conversation-reducer.ts   PURE: (state, AssistantEvent) -> state; SETS pendingHandoff
  use-assistant-chat.ts     fetch + NDJSON read loop; generalized from use-people-chat.ts
  handoff.ts                PURE: READS pendingHandoff -> the phase-two request
                            body and the "go back" target. Sets nothing.
  session-mirror.ts         PURE: serialize and restore a thread
  assistant-panel.tsx       thread; delegates rows to a binding
  assistant-message.tsx     generalized from people-message.tsx
  handoff-bar.tsx           "Moved from Companies — go back"
  registry.ts               bindingFor(entity)
  bindings/
    people.tsx              the only binding in Spec 2a
```

Server change: `app/api/assistant/chat/route.ts` and `lib/assistant/stream.ts`
accept `forceEntity` and `presetFilters`.

### The binding

The client twin of Spec 1's `EntityAdapter`:

```ts
type PageBinding<F> = {
  entity: AssistantEntity;
  route: string;                                       // "/app/people"
  emptyFilters(): F;
  /** Incoming keys replace conflicting ones; unrelated current filters survive. */
  applyFilters(current: F, incoming: Partial<F>): F;
  renderRows(rows: unknown[], ctx: RowContext): ReactNode;
};
```

**An invariant keeps the panel entity-agnostic:** it only ever renders rows whose
entity equals the current page, because a `navigate` turn carries no `results`
event at all. `renderRows` can always delegate to `bindingFor(currentPage)` with
no risk of handing Person rows to an events table. Spec 1's server-side
guarantee is what earns the client this simplification.

### Conversation state

```ts
type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  entity: AssistantEntity | null;
  action: RouteAction | null;
  confidence: number | null;
  filters: unknown | null;
  chips: FilterChip[];
  droppedFilters: string[];
  rows: unknown[];
  total: number | null;
  suggestions: string[];
  isComplete: boolean;
  error: { code: string; message: string } | null;
};

type ConversationState = {
  messages: AssistantMessage[];
  isStreaming: boolean;
  error: string | null;
  previousEntity: AssistantEntity | null;
  pendingHandoff: {
    from: AssistantEntity;
    to: AssistantEntity;
    /** The source page's own filters, so "go back" restores what was there. */
    sourceFilters: unknown;
    presetFilters: unknown;
    message: string;
  } | null;
};
```

`total` is `number | null`, carrying Spec 1's companies constraint into the UI:
the panel must render an absent count rather than "0 results".

`pendingHandoff.sourceFilters` snapshots the *source* page's filters, not the
translated ones — otherwise "go back" would return the user to a page whose rail
had been rewritten by a question they have since undone.

### Data flow, cross-page question

```
User on Companies: "what conferences are in Berlin"
  POST /api/assistant/chat { message, currentPage: 'companies', activeFilters }
  <- route  { targetEntity: 'events', action: 'navigate', interpretedFilters }
  <- token  "That's a question about events — opening Events…"
  <- done
  reducer sets pendingHandoff; provider calls router.push('/app/events')
  AppShell stays mounted, so the thread is intact on arrival
  Events page applies presetFilters via its binding, renders the handoff bar
  POST /api/assistant/chat { message, currentPage: 'events', forceEntity: 'events', presetFilters }
  <- route (answer_inline) / filters / results / token… / suggestions / done
```

Phase two is issued by the provider on arrival, not by the page, so a page that
forgets to trigger it cannot leave the user staring at a handoff line with no
answer.

## Error handling

Spec 1 guarantees a valid NDJSON stream at HTTP 200 for every assistant problem,
so the client's error surface is small. It keeps the four behaviours already in
`use-people-chat.ts`:

| Failure | Behaviour |
|---|---|
| Malformed NDJSON frame | skipped; the read continues |
| Stream ends without `done` | partial answer kept, marked `interrupted`, retry offered |
| Abort (user navigated or hit stop) | message marked complete, no error shown |
| Non-2xx or missing body | message marked failed with `request_failed`, retry offered |

Two are new:

| Failure | Behaviour |
|---|---|
| Phase two of a handoff fails | the bar stays, the thread shows the error and offers retry; the user is on the right page either way |
| `sessionStorage` unreadable or corrupt | start with an empty thread rather than throwing, matching `query-store.ts` |

`retry` keeps the existing semantics: drop the failed exchange so the thread does
not accumulate dead turns.

## Testing

Vitest, `tests/integration`, node environment. No new dependencies. No network.

1. **`assistant-reducer.test.ts`** — a table of NDJSON frame sequences:
   route → filters → results → token → suggestions → done builds the expected
   message; a `navigate` route produces `pendingHandoff` and no rows; a
   `confirm` route produces suggestions and no rows; an `error` frame marks the
   message failed; a stream ending without `done` marks it `interrupted`.
2. **`assistant-handoff.test.ts`** — **the bounce test.** A `navigate` decision
   must produce a follow-up request carrying `forceEntity`; a reducer fed a
   `forceEntity` response must never produce another `pendingHandoff`. This
   pins the infinite-loop hazard as an executable check.
3. **`assistant-bindings.test.ts`** — `applyFilters` replaces conflicting keys
   and preserves unrelated ones, for the array-valued people shape; `route` and
   `entity` agree.
4. **`assistant-session-mirror.test.ts`** — a thread round-trips through
   serialize/restore; a corrupt payload yields an empty thread rather than
   throwing.
5. **`assistant-force-entity.test.ts`** — server-side: `forceEntity` skips both
   classifiers (asserted with a classifier spy that must not be called) and
   yields `action: 'answer_inline'` for the named entity.

### Known coverage gap

Rendering is not tested: that the provider re-renders, that the handoff bar
appears, that `router.push` fires. Verifying those needs jsdom or Playwright,
neither of which is installed. They are checked by running the app. This is a
stated limitation, not an oversight.

## Follow-on work

**Spec 2b:** migrate Companies and Events onto the panel; split
`companies-section.tsx` and `events-section.tsx`; add the events and companies
bindings; reconcile the single-valued `AskEventFilters` with the array-valued
`EventFilters`/`EventQueryState` that drives the Explorer rail; delete
`/api/companies/ask`, `/api/ai/event-query`, `/api/ai/event-answer`,
`/api/events/search` and `/api/people/chat` with their services and tests.

**Unscheduled:** `target_entity: "mixed"` and `cross_reference`, still blocked on
a linking key between the three datasets.

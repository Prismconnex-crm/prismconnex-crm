# Assistant Entity Router — Design

**Date:** 2026-08-17
**Status:** Approved, ready for planning
**Scope:** Spec 1 of 2. Routing engine only — no UI changes.

## Problem

The same assistant is embedded on Companies, Events and People. Each page has its
own backend and its own idea of what the user is asking about:

| Page | Entry point | Service |
|---|---|---|
| Companies | `POST /api/companies/ask` | `services/event-query.service.ts` |
| Events | `POST /api/ai/event-query`, `/api/ai/event-answer` | `services/ai-event-query.service.ts` |
| People | `POST /api/people/chat` (NDJSON) | `lib/people/*` |

A question typed on the wrong page gets answered with the wrong entity's data —
an events question answered from company records, a people question answered
from the event catalog. That is the failure mode this work exists to prevent.

`services/event-query.service.ts` already solves a two-way version of this: a
Claude tool call that classifies between `filter_events` and `search_companies`
and extracts filters, with the model explicitly forbidden from naming events
("you only produce filters"). This design generalises that proven pattern to
three entities rather than inventing a new one.

## Source rules referenced

This design implements a routing specification supplied by the product owner.
Rules cited by number below are:

- **Rule 1** — never answer an events question with company data, or a people
  question with event data. Route instead.
- **Rule 2** — carry filter context across the handoff.
- **Rule 4** — never invent records; every fact comes from a tool result.
- **Rule 5** — below 0.6 confidence, do not auto-navigate; ask instead.
- **Rule 7** — follow-up messages inherit the previous turn's entity unless the
  new message signals a different one.

## Goals

- Classify every message into `companies | events | people` before answering.
- Answer inline when the target entity matches the current page.
- Return a navigation handoff with translated filters when it does not.
- Ask for confirmation when confidence is genuinely low.
- Keep working with no `ANTHROPIC_API_KEY` — degrade in quality, never in
  availability.

## Non-goals (deferred)

- **`target_entity: "mixed"` and `cross_reference`.** Cross-entity joins
  ("companies exhibiting at SaaStr, filtered by event attended") need a linking
  key between the event, company and people datasets. None exists today. The
  field stays in the wire format, always `null`.
- **UI.** The shared conversation store, navigation handoff and converting the
  Companies and Events panels to streaming are Spec 2.
- **Retiring the existing routes.** All four existing AI routes keep working,
  untouched.

## Decisions

Recorded with reasoning, because each closes off an alternative that will look
attractive again later.

### The model extracts filters; it never sees rows

One Claude call classifies and fills filters. The server runs the search locally
against real data and feeds counts plus a ≤10-row sample back for prose.

The alternative — an agentic loop where the model calls `search_events`,
receives rows, and chains further calls — was rejected. Filter extraction makes
inventing a record *structurally impossible* rather than merely forbidden by the
prompt, and costs one round-trip instead of three to five. Both existing
services already work this way.

### `total` is `number | null`

`COUNT(*)` on the 27 GB companies SQLite dataset is too slow, so `/api/companies`
deliberately returns `total: null` and the UI pages by cursor. The adapter
interface must type this honestly. Prose templates must handle null without
emitting "0 results" — a confident report of zero companies is worse than no
number at all.

### Confidence is computed, not self-reported

The model is never asked how confident it is. LLM self-reported confidence is
poorly calibrated and would sit near 0.9 for almost every input, meaning the
confirm-gate would effectively never fire. Instead, two independent classifiers
run on every message and their agreement produces the number. See
[Classification](#classification-and-confidence).

### Signal words live in one file

`lib/assistant/signals.ts` feeds both the system prompt and the deterministic
classifier. A single source of truth prevents the two from drifting apart when
someone later adds a signal word to the prompt only.

### `/api/companies` query logic gets extracted

The raw SQL in `app/api/companies/route.ts` moves to `lib/companies/search.ts`
so the companies adapter can call it directly rather than over HTTP. The route
becomes a thin caller. This is forced by the design, not opportunistic
refactoring; no other existing code is restructured.

## Architecture

```
lib/assistant/
  types.ts        AssistantEntity, RouteDecision, AssistantEvent, EntityAdapter<F>
  signals.ts      the three signal-word lists — one source of truth
  classify.ts     deterministic scorer: (message) -> { scores, winner, margin }
  route.ts        model classifier (Claude, 3 tools) wrapping the classify.ts fallback
  registry.ts     entity -> adapter lookup
  stream.ts       NDJSON assembly, generalised from lib/people/chat-stream.ts
  rate-limit.ts   token bucket, extracted from chat-stream.ts
  adapters/
    people.ts     wraps lib/people/{data,filters,parse-query,answer}
    events.ts     wraps lib/find-shows/filter-events
    companies.ts  wraps lib/companies/search (extracted, see Decisions)

app/api/assistant/chat/route.ts   POST, NDJSON, not tenant-scoped
```

Not tenant-scoped, consistent with `/api/companies` and `/api/people` — these
are shared discovery datasets, not workspace data.

### The adapter boundary

```ts
type Signal = { word: string; weight?: number };  // weight defaults to 1

type EntityAdapter<F> = {
  entity: AssistantEntity;
  signals: readonly Signal[];              // classifier + prompt source
  filterSchema: JSONSchema;                // tool input_schema for this entity
  emptyFilters(): F;
  parseLocally(message: string, base: F): F;
  carryOver(foreign: Record<string, unknown>): { filters: Partial<F>; dropped: string[] };
  search(filters: F, page: number): Promise<{ rows: unknown[]; total: number | null }>;
  chips(filters: F): FilterChip[];
  describe(filters: F, total: number | null): string;
  suggest(filters: F, total: number | null): string[];
};
```

Each adapter owns one entity's filter type, parser, search and prose, and knows
nothing about the other two. `route.ts` knows the three entities exist but
nothing about their filter shapes.

This is the load-bearing boundary: a wrong-entity answer becomes impossible to
express, because the events adapter physically cannot return a `Person`. Rule 1
is enforced by types rather than by prompt text.

### Event filter shape

Two event filter systems exist: `lib/events/filters.ts` (`EventQueryState`,
drives the Explorer rail) and `lib/find-shows/filter-events.ts` (`EventFilters`,
drives the AI ask path). The adapter emits `EventFilters`, because that is what
`filterEvents()` consumes and what the existing AI path already produces.
Reconciling the two for the Explorer rail is a UI concern, deferred to Spec 2.

## Classification and confidence

Both classifiers run on every message. The deterministic one is not merely a
no-key fallback — its agreement or disagreement with the model is what produces
a confidence number worth gating on.

### Deterministic scorer

Signal hits per entity, with two positional rules encoding the spec's
tie-breakers:

- **Deliverable position wins.** A signal in head position — first content word,
  or immediately after `find me` / `show me` / `list` / `who are` — scores 3×.
  This resolves "companies exhibiting at SaaStr" to companies.
- **Qualifier position demotes.** A signal following `at` / `attending` /
  `exhibiting at` / `based in` / `working at` scores 0.3×. In the same sentence,
  "SaaStr" sits behind `at`, so events loses despite a strong hit.

Returns `{ scores: Record<AssistantEntity, number>, winner, margin }`, where
`margin` is winner minus runner-up, normalised to 0–1.

### Model classifier

One Claude call. Three tools — `route_to_events`, `route_to_companies`,
`route_to_people` — each carrying that entity's filter JSON Schema as
`input_schema`. The model picks a tool and fills filters in one shot. It sees no
data and is asked for no confidence score. Aborts at 4 seconds.

Model id: `claude-sonnet-5`. This also resolves an existing inconsistency —
`event-query.service.ts` uses `claude-opus-4-8` while `chat-stream.ts` uses
`claude-sonnet-5`. Classification is a short structured task; Sonnet is the
right tier and the cheaper one.

### Confidence table

| Model vs. deterministic | Margin | Confidence | Action |
|---|---|---|---|
| Agree | clear | 0.95 | route |
| Agree | narrow | 0.75 | route |
| Disagree | any | 0.45 | confirm |
| No key | clear | 0.70 | route |
| No key | narrow | 0.40 | confirm |
| No signal at all | — | 1.00 | `current_page`, conversational |

Disagreement is the honest ambiguity signal: two independent methods reading one
sentence differently is exactly what Rule 5's confirm-gate exists to catch.
"Salesforce events" — deterministic favours events on the head noun, the model
may favour companies on the proper noun — lands at 0.45 and asks.

### Context carry-over

`activeFilters` from the source page are translated through an explicit map
(`country → country`, `location → location`, `industry ↔ category`). Anything
without a counterpart on the target schema is **dropped, never guessed**, and
reported back in `droppedFilters` so the UI can say what it lost rather than
losing it silently.

### Follow-ups

The request body carries `previousEntity`. When a message produces no signal
above threshold for any entity, the previous entity wins over `current_page`.
This is what keeps "show me more" on events after an events answer.

## Wire format

NDJSON, adopting the format `lib/people/chat-stream.ts` already proves.

```ts
type AssistantEvent =
  | { type: 'route';    targetEntity: AssistantEntity;
                        action: 'answer_inline' | 'navigate' | 'confirm';
                        confidence: number; handoffMessage: string;
                        interpretedFilters: unknown; droppedFilters: string[];
                        crossReference: null;
                        degraded?: 'missing_api_key' | 'model_error' | 'no_tool_call' }
  | { type: 'filters';  chips: FilterChip[] }
  | { type: 'results';  rows: unknown[]; total: number | null }
  | { type: 'token';    text: string }
  | { type: 'suggestions'; items: string[] }
  | { type: 'done' }
  | { type: 'error';    code: string; message: string }
```

**`route` is always the first event, emitted before any search runs.** The
client needs the navigate/stay decision synchronously — it cannot wait behind a
companies query to learn it should be on a different page. This ordering
guarantee is what the feature rests on.

Per action:

- **`answer_inline`** — `route`, `filters`, `results`, `token`…, `suggestions`, `done`
- **`navigate`** — `route`, `token`… (handoff line only), `done`.
  **No `results` event, ever.** Rule 1 enforced at the stream level rather than
  left to the model's discretion.
- **`confirm`** — `route`, `suggestions` (both readings offered), `done`. No
  search runs; an ambiguous question should not cost a query.

`suggestions` are produced by `adapter.suggest()` — templated, a fixed function
of filters and result count. They cost nothing and cannot hallucinate a
suggestion leading nowhere.

## Error handling

A degradation ladder. The route never returns a non-2xx for an assistant
problem, following the precedent already written into
`app/api/ai/event-query/route.ts`.

| Failure | Behaviour | Signalled as |
|---|---|---|
| No API key | deterministic classify + templated prose | `degraded: 'missing_api_key'` |
| Model errors or exceeds 4 s | same fallback | `degraded: 'model_error'` |
| Model returns no tool call | same fallback | `degraded: 'no_tool_call'` |
| Model dies mid-prose | complete the answer from template | existing `chat-stream.ts` behaviour, retained |
| Rate limited | single `error` event, HTTP 200 | `code: 'rate_limited'` |
| Adapter search throws | `error` event naming the entity | `code: 'search_failed'` |

The 4-second abort matters: classification sits in front of everything, so a
hanging model call would freeze the panel. Routing slightly worse, instantly, is
the better trade.

Rate limiting reuses the existing in-memory per-IP token bucket (capacity 20,
refill 0.5/s), extracted unchanged from `chat-stream.ts`.

## Testing

Vitest, `tests/integration`, node environment, `@/` alias — matching existing
convention. **Zero API calls in the suite.**

The model is injected the way `chat-stream.ts` already injects `generateAnswer`:
`createAssistantStream({ classify?, generateAnswer? })`. Tests pass stubs;
production passes the real implementations. No network mocking library required.

1. **`classify.test.ts`** — a table of ~40 labelled questions against the pure
   scorer. Every example from the routing spec becomes a row: deliverable-beats-
   qualifier, "events where NovaAI is exhibiting", "CMOs at companies attending
   Web Summit", carry-over "what events are happening there?", "show me more",
   and the no-signal conversational case. Produces a regression number, so a
   later edit to `signals.ts` that drops accuracy is immediately visible.
2. **`confidence.test.ts`** — one case per row of the confidence table,
   including both rows that must produce `confirm`.
3. **Adapter contract suite** — one parametrized suite run against all three
   adapters: `parseLocally` round-trips, `search` respects its filters, `total`
   is `number | null`, and `describe()` never emits "0 results" when `total` is
   null. That last assertion pins the companies-dataset trap.
4. **Stream ordering** — `route` arrives first; `navigate` emits zero `results`
   events; `confirm` never calls `adapter.search` (asserted with a spy). Rule 1
   as an executable check.
5. **Degradation ladder** — five cases, each asserting a valid stream still
   terminates with `done` or `error`.
6. **Carry-over** — Germany on companies → events keeps `country`; an
   untranslatable filter appears in `droppedFilters`.

### Known coverage gap

The companies adapter cannot be integration-tested on the current machine:
`prisma/dev.db` is 4 KB, not the 27 GB discovery dataset. It is tested against a
seam with a fake row source. Its real SQL path remains covered by the existing
`/api/companies` tests. This is a stated limitation, not an oversight.

## Follow-on work (Spec 2)

Shared conversation store spanning the three pages; the panel staying open
through navigation with `handoffMessage` rendered as an assistant turn;
converting the Companies and Events panels to read NDJSON; reconciling
`EventFilters` with `EventQueryState` for the Explorer rail; eventual retirement
of the four legacy AI routes.

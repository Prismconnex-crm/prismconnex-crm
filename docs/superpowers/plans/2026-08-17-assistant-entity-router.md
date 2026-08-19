# Assistant Entity Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a routing engine that classifies every assistant message into `companies | events | people` before answering, so a question typed on the wrong page routes to the right one instead of being answered from the wrong dataset.

**Architecture:** One NDJSON endpoint, `POST /api/assistant/chat`, sits in front of three `EntityAdapter` implementations that each wrap an existing search stack. Two classifiers — a deterministic signal-word scorer and a Claude tool call — run on every message; their agreement produces a computed confidence used to pick between answering inline, handing off to another page, and asking for clarification. No UI changes; the four existing AI routes keep working untouched.

**Tech Stack:** TypeScript, Next.js 14 App Router (route handlers), `@anthropic-ai/sdk`, Zod, Vitest (node environment).

**Spec:** `docs/superpowers/specs/2026-08-17-assistant-entity-router-design.md`

## Global Constraints

- **Zero network calls in the test suite.** Every test injects a stubbed classifier and answer generator. No Postgres instance, no `ANTHROPIC_API_KEY`, no mocking library.
- **Never return a non-2xx for an assistant problem.** Missing key, model error, rate limit and junk output all degrade to a valid NDJSON stream at HTTP 200. Follows the precedent in `app/api/ai/event-query/route.ts`.
- **`route` is always the first NDJSON event**, emitted before any search runs.
- **`action: 'navigate'` must never emit a `results` event.** This is the core failure mode the feature prevents.
- **Model id is `claude-sonnet-5`** for all model calls added by this plan.
- **Model call abort: 4000 ms.** On timeout, fall back to the deterministic classifier.
- **`total` is `number | null`.** Companies always returns `null`. Prose must never render "0 results" when `total` is null.
- **Do not modify** `app/api/companies/ask/route.ts`, `app/api/ai/event-query/route.ts`, `app/api/ai/event-answer/route.ts`, `app/api/events/search/route.ts`, or `app/api/people/chat/route.ts`. They stay working.
- **Do not run** `npm run db:seed`, `npm run sqlite:optimize`, or any benchmark script. Disk-space constraint in `CLAUDE.md`.
- **Import the Anthropic SDK dynamically** (`await import('@anthropic-ai/sdk')`) with a type-only static import, exactly as `services/event-query.service.ts` does. A bare static import breaks webpack module resolution for the entire dev compilation.
- Run one-shot tests with `npx vitest run <path>`. Never `npm test` (watch mode).

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `lib/assistant/types.ts` | `AssistantEntity`, `Signal`, `FilterChip`, `RouteDecision`, `AssistantEvent`, `EntityAdapter<F>` |
| `lib/assistant/signals.ts` | The three signal-word lists + head/qualifier phrase lists. One source of truth. |
| `lib/assistant/classify.ts` | Pure deterministic scorer |
| `lib/assistant/confidence.ts` | Pure confidence + action resolution |
| `lib/assistant/carry-over.ts` | Cross-entity filter translation map |
| `lib/assistant/route.ts` | Claude tool-call classifier wrapping the deterministic fallback |
| `lib/assistant/rate-limit.ts` | Token bucket, extracted from `chat-stream.ts` |
| `lib/assistant/registry.ts` | `AssistantEntity -> EntityAdapter` lookup |
| `lib/assistant/stream.ts` | NDJSON assembly |
| `lib/assistant/adapters/people.ts` | Wraps `lib/people/*` |
| `lib/assistant/adapters/events.ts` | Wraps `lib/find-shows/filter-events` |
| `lib/assistant/adapters/companies.ts` | Wraps `lib/companies/search` |
| `lib/companies/search.ts` | Query logic extracted from `app/api/companies/route.ts` |
| `app/api/assistant/chat/route.ts` | The endpoint |

**Modify:**

| File | Change |
|---|---|
| `app/api/companies/route.ts` | Becomes a thin caller of `lib/companies/search.ts` |

**Tests:** `tests/integration/assistant-{classify,confidence,carry-over,adapters,stream,route}.test.ts`, `tests/integration/companies-search.test.ts`

---

### Task 1: Core types

**Files:**
- Create: `lib/assistant/types.ts`

**Interfaces:**
- Consumes: `PeopleFilters` from `@/types/people`; `EventFilters` from `@/models/event-query`
- Produces: `AssistantEntity`, `Signal`, `FilterChip`, `RouteAction`, `DegradedReason`, `RouteDecision`, `AssistantEvent`, `SearchResult`, `EntityAdapter<F>`

There is no test in this task — it is types only, erased at runtime. Task 2 is the first behavioural task. Typecheck is the verification.

- [ ] **Step 1: Create the types file**

```ts
// lib/assistant/types.ts

/** The three datasets the assistant can answer from. */
export type AssistantEntity = 'companies' | 'events' | 'people';

export const ASSISTANT_ENTITIES: readonly AssistantEntity[] = [
  'companies',
  'events',
  'people',
] as const;

/** A classifier signal word. `weight` defaults to 1. */
export type Signal = { word: string; weight?: number };

/** Display form of one applied filter, for the panel's chip row. */
export type FilterChip = { key: string; label: string; value: string };

export type RouteAction = 'answer_inline' | 'navigate' | 'confirm';

export type DegradedReason = 'missing_api_key' | 'model_error' | 'no_tool_call';

/** The routing verdict, emitted as the first stream event. */
export type RouteDecision = {
  targetEntity: AssistantEntity;
  action: RouteAction;
  confidence: number;
  handoffMessage: string;
  interpretedFilters: unknown;
  droppedFilters: string[];
  /** Always null in Spec 1. Reserved for cross-entity queries. */
  crossReference: null;
  degraded?: DegradedReason;
};

/** The NDJSON wire format. `route` is always first. */
export type AssistantEvent =
  | ({ type: 'route' } & RouteDecision)
  | { type: 'filters'; chips: FilterChip[] }
  | { type: 'results'; rows: unknown[]; total: number | null }
  | { type: 'token'; text: string }
  | { type: 'suggestions'; items: string[] }
  | { type: 'done' }
  | { type: 'error'; code: string; message: string };

/** `total` is null when counting is too expensive — companies always is. */
export type SearchResult = { rows: unknown[]; total: number | null };

/**
 * One entity's whole world: its filter type, parser, search and prose.
 *
 * An adapter knows nothing about the other two entities. That is what makes a
 * wrong-entity answer unrepresentable rather than merely discouraged — the
 * events adapter physically cannot return a Person.
 */
export type EntityAdapter<F> = {
  entity: AssistantEntity;
  /** Feeds both the deterministic classifier and the system prompt. */
  signals: readonly Signal[];
  /** JSON Schema used as the Claude tool `input_schema` for this entity. */
  filterSchema: Record<string, unknown>;
  emptyFilters(): F;
  parseLocally(message: string, base: F): F;
  /** Translate another entity's filters onto this one. Unmappable keys are dropped, never guessed. */
  carryOver(foreign: Record<string, unknown>): { filters: Partial<F>; dropped: string[] };
  search(filters: F, page: number): Promise<SearchResult>;
  chips(filters: F): FilterChip[];
  describe(filters: F, total: number | null): string;
  suggest(filters: F, total: number | null): string[];
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `lib/assistant/types.ts`. (Pre-existing errors elsewhere in the repo may appear; ignore those.)

- [ ] **Step 3: Commit**

```bash
git add lib/assistant/types.ts
git commit -m "feat(assistant): add the entity router core types"
```

---

### Task 2: Signal lists and the deterministic classifier

**Files:**
- Create: `lib/assistant/signals.ts`, `lib/assistant/classify.ts`
- Test: `tests/integration/assistant-classify.test.ts`

**Interfaces:**
- Consumes: `AssistantEntity`, `Signal`, `ASSISTANT_ENTITIES` from Task 1
- Produces:
  - `ENTITY_SIGNALS: Record<AssistantEntity, readonly Signal[]>`
  - `HEAD_PHRASES: readonly string[]`, `QUALIFIER_PHRASES: readonly string[]`
  - `classify(message: string): ClassifyResult`
  - `type ClassifyResult = { scores: Record<AssistantEntity, number>; winner: AssistantEntity | null; margin: number }`

`winner` is `null` when no signal matched at all. `margin` is `(top - runnerUp) / top`, clamped to 0–1, and `0` when `winner` is null.

- [ ] **Step 1: Write the signals file**

```ts
// lib/assistant/signals.ts
import type { AssistantEntity, Signal } from './types';

/**
 * The one source of truth for entity signal words. Consumed by BOTH the
 * deterministic classifier and the system prompt in route.ts, so the two can
 * never drift apart.
 */
export const ENTITY_SIGNALS: Record<AssistantEntity, readonly Signal[]> = {
  events: [
    { word: 'event', weight: 2 },
    { word: 'events', weight: 2 },
    { word: 'conference' },
    { word: 'conferences' },
    { word: 'expo', weight: 2 },
    { word: 'expos', weight: 2 },
    { word: 'trade show', weight: 2 },
    { word: 'trade shows', weight: 2 },
    { word: 'tradeshow' },
    { word: 'show' },
    { word: 'shows' },
    { word: 'summit' },
    { word: 'summits' },
    { word: 'meetup' },
    { word: 'meetups' },
    { word: 'webinar' },
    { word: 'webinars' },
    { word: 'booth' },
    { word: 'booths' },
    { word: 'exhibitor' },
    { word: 'exhibitors' },
    { word: 'exhibiting' },
    { word: 'sponsor' },
    { word: 'sponsors' },
    { word: 'attendee' },
    { word: 'attendees' },
    { word: 'venue' },
    { word: 'fair' },
    { word: 'fairs' },
    { word: 'exhibition' },
    { word: 'exhibitions' },
    { word: 'happening' },
    { word: 'upcoming' },
  ],
  companies: [
    { word: 'company', weight: 2 },
    { word: 'companies', weight: 2 },
    { word: 'account' },
    { word: 'accounts' },
    { word: 'firm' },
    { word: 'firms' },
    { word: 'organization' },
    { word: 'organizations' },
    { word: 'organisation' },
    { word: 'organisations' },
    { word: 'startup' },
    { word: 'startups' },
    { word: 'vendor' },
    { word: 'vendors' },
    { word: 'supplier' },
    { word: 'suppliers' },
    { word: 'manufacturer' },
    { word: 'manufacturers' },
    { word: 'firmographic' },
    { word: 'firmographics' },
    { word: 'headcount' },
    { word: 'employees' },
    { word: 'revenue' },
    { word: 'funding' },
    { word: 'industry' },
    { word: 'vertical' },
    { word: 'tech stack' },
    { word: 'domain' },
    { word: 'lookalike' },
    { word: 'lookalikes' },
  ],
  people: [
    { word: 'people', weight: 2 },
    { word: 'person', weight: 2 },
    { word: 'contact', weight: 2 },
    { word: 'contacts', weight: 2 },
    { word: 'lead' },
    { word: 'leads' },
    { word: 'name' },
    { word: 'names' },
    { word: 'job title' },
    { word: 'title' },
    { word: 'titles' },
    { word: 'seniority' },
    { word: 'department' },
    { word: 'decision maker' },
    { word: 'decision makers' },
    { word: 'ceo' },
    { word: 'cto' },
    { word: 'cmo' },
    { word: 'cfo' },
    { word: 'cxo' },
    { word: 'vp' },
    { word: 'vps' },
    { word: 'director' },
    { word: 'directors' },
    { word: 'manager' },
    { word: 'managers' },
    { word: 'head of' },
    { word: 'founder' },
    { word: 'founders' },
    { word: 'email' },
    { word: 'emails' },
    { word: 'phone' },
    { word: 'linkedin' },
    { word: 'verified' },
    { word: 'confidence' },
  ],
};

/**
 * Phrases after which the next content word is the DELIVERABLE the user wants.
 * A signal in that position scores 3x — this is what makes
 * "companies exhibiting at SaaStr" resolve to companies rather than events.
 */
export const HEAD_PHRASES: readonly string[] = [
  'find me',
  'show me',
  'give me',
  'list',
  'who are',
  'which',
  'what',
  'find',
  'search for',
  'get me',
];

/**
 * Phrases after which a signal is a QUALIFIER, not the deliverable. A signal in
 * that position scores 0.3x — "at SaaStr" must not turn a companies question
 * into an events question.
 */
export const QUALIFIER_PHRASES: readonly string[] = [
  'exhibiting at',
  'attending',
  'attended',
  'at the',
  'at',
  'based in',
  'working at',
  'from',
  'sponsoring',
  'going to',
];

export const HEAD_MULTIPLIER = 3;
export const QUALIFIER_MULTIPLIER = 0.3;
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/integration/assistant-classify.test.ts
import { describe, expect, it } from 'vitest';
import { classify } from '@/lib/assistant/classify';
import type { AssistantEntity } from '@/lib/assistant/types';

describe('classify — entity resolution', () => {
  const cases: Array<[string, AssistantEntity]> = [
    // Plain, unambiguous.
    ['what conferences are in Berlin next month', 'events'],
    ['show me SaaS companies in Germany', 'companies'],
    ['find me VPs of marketing', 'people'],
    ['upcoming expos in Q1', 'events'],
    ['startups with 50-200 employees', 'companies'],
    ['verified contacts with email', 'people'],

    // The deliverable noun wins over the qualifier.
    ['companies exhibiting at SaaStr', 'companies'],
    ['events where NovaAI is exhibiting', 'events'],
    ['CMOs at companies attending Web Summit', 'people'],
    ['find me people at companies going to Web Summit', 'people'],
    ['show me trade shows where Siemens has a booth', 'events'],
  ];

  it.each(cases)('classifies %j as %s', (message, expected) => {
    expect(classify(message).winner).toBe(expected);
  });

  it('returns a null winner when no signal is present', () => {
    const result = classify('hello there');
    expect(result.winner).toBeNull();
    expect(result.margin).toBe(0);
  });

  it('reports a narrow margin when two entities tie', () => {
    // "companies" and "contacts" are both head-weighted deliverable nouns.
    const result = classify('companies and contacts');
    expect(result.margin).toBeLessThan(0.34);
  });

  it('reports a clear margin for an unambiguous question', () => {
    expect(classify('what trade shows are happening in Munich').margin).toBeGreaterThan(0.5);
  });

  it('is case-insensitive', () => {
    expect(classify('SHOW ME COMPANIES IN FRANCE').winner).toBe('companies');
  });

  it('matches multi-word signals', () => {
    expect(classify('list trade shows in Paris').winner).toBe('events');
  });

  it('does not match a signal inside a longer word', () => {
    // "leader" must not match the people signal "lead".
    expect(classify('leader').winner).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-classify.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/classify"`

- [ ] **Step 4: Implement the classifier**

```ts
// lib/assistant/classify.ts
import {
  ENTITY_SIGNALS,
  HEAD_MULTIPLIER,
  HEAD_PHRASES,
  QUALIFIER_MULTIPLIER,
  QUALIFIER_PHRASES,
} from './signals';
import { ASSISTANT_ENTITIES, type AssistantEntity } from './types';

export type ClassifyResult = {
  scores: Record<AssistantEntity, number>;
  winner: AssistantEntity | null;
  /** (top - runnerUp) / top, clamped 0-1. Zero when there is no winner. */
  margin: number;
};

function normalize(message: string): string {
  return ` ${message.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

/** Index of the first whole-word occurrence of `needle`, or -1. */
function wordIndex(haystack: string, needle: string): number {
  return haystack.indexOf(` ${needle} `);
}

/**
 * Positional weight for a signal found at `index`.
 *
 * A signal is in HEAD position if it starts the sentence or directly follows a
 * head phrase; it is in QUALIFIER position if it directly follows a qualifier
 * phrase. Qualifier wins ties only when it is closer, which is what makes
 * "companies exhibiting at SaaStr" score companies high and events low.
 */
function positionalMultiplier(haystack: string, index: number): number {
  const before = haystack.slice(0, index + 1);

  const nearestHead = HEAD_PHRASES.reduce((best, phrase) => {
    const at = before.lastIndexOf(` ${phrase} `);
    return at > best ? at + phrase.length : best;
  }, -1);

  const nearestQualifier = QUALIFIER_PHRASES.reduce((best, phrase) => {
    const at = before.lastIndexOf(` ${phrase} `);
    return at > best ? at + phrase.length : best;
  }, -1);

  // Directly adjacent means within a couple of characters of the signal start.
  const headAdjacent = nearestHead >= 0 && index - nearestHead <= 2;
  const qualifierAdjacent = nearestQualifier >= 0 && index - nearestQualifier <= 2;

  if (qualifierAdjacent && nearestQualifier >= nearestHead) return QUALIFIER_MULTIPLIER;
  if (headAdjacent || index <= 1) return HEAD_MULTIPLIER;
  return 1;
}

/**
 * Scores a message against every entity's signal list.
 *
 * Runs on EVERY message, not only when no API key is present — its agreement
 * or disagreement with the model classifier is what produces the confidence
 * number that gates auto-navigation.
 */
export function classify(message: string): ClassifyResult {
  const haystack = normalize(message);

  const scores = ASSISTANT_ENTITIES.reduce(
    (acc, entity) => {
      acc[entity] = ENTITY_SIGNALS[entity].reduce((sum, signal) => {
        const index = wordIndex(haystack, signal.word);
        if (index < 0) return sum;
        return sum + (signal.weight ?? 1) * positionalMultiplier(haystack, index);
      }, 0);
      return acc;
    },
    {} as Record<AssistantEntity, number>
  );

  const ranked = [...ASSISTANT_ENTITIES].sort((a, b) => scores[b] - scores[a]);
  const top = scores[ranked[0]];
  if (top <= 0) return { scores, winner: null, margin: 0 };

  const runnerUp = scores[ranked[1]];
  return {
    scores,
    winner: ranked[0],
    margin: Math.max(0, Math.min(1, (top - runnerUp) / top)),
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/integration/assistant-classify.test.ts`
Expected: PASS, 12 tests.

If a deliverable-vs-qualifier case fails, adjust the adjacency window in `positionalMultiplier` or add the missing phrase to `QUALIFIER_PHRASES` — do not weaken the assertions.

- [ ] **Step 6: Commit**

```bash
git add lib/assistant/signals.ts lib/assistant/classify.ts tests/integration/assistant-classify.test.ts
git commit -m "feat(assistant): add signal lists and the deterministic classifier"
```

---

### Task 3: Confidence and action resolution

**Files:**
- Create: `lib/assistant/confidence.ts`
- Test: `tests/integration/assistant-confidence.test.ts`

**Interfaces:**
- Consumes: `ClassifyResult` from Task 2; `AssistantEntity`, `RouteAction` from Task 1
- Produces: `resolveRoute(input: ResolveInput): ResolveOutput`
  - `ResolveInput = { modelEntity: AssistantEntity | null; deterministic: ClassifyResult; currentPage: AssistantEntity; previousEntity?: AssistantEntity | null; hasApiKey: boolean }`
  - `ResolveOutput = { targetEntity: AssistantEntity; action: RouteAction; confidence: number }`
- Exports `CLEAR_MARGIN = 0.34` and `CONFIRM_THRESHOLD = 0.6`

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/assistant-confidence.test.ts
import { describe, expect, it } from 'vitest';
import { resolveRoute } from '@/lib/assistant/confidence';
import type { ClassifyResult } from '@/lib/assistant/classify';
import type { AssistantEntity } from '@/lib/assistant/types';

function deterministic(
  winner: AssistantEntity | null,
  margin: number
): ClassifyResult {
  return { scores: { companies: 0, events: 0, people: 0 }, winner, margin };
}

describe('resolveRoute — confidence table', () => {
  it('agrees with a clear margin -> 0.95, routes', () => {
    const out = resolveRoute({
      modelEntity: 'events',
      deterministic: deterministic('events', 0.8),
      currentPage: 'companies',
      hasApiKey: true,
    });
    expect(out.confidence).toBe(0.95);
    expect(out.targetEntity).toBe('events');
    expect(out.action).toBe('navigate');
  });

  it('agrees with a narrow margin -> 0.75, still routes', () => {
    const out = resolveRoute({
      modelEntity: 'events',
      deterministic: deterministic('events', 0.1),
      currentPage: 'companies',
      hasApiKey: true,
    });
    expect(out.confidence).toBe(0.75);
    expect(out.action).toBe('navigate');
  });

  it('disagrees -> 0.45, confirms, and prefers the model entity', () => {
    const out = resolveRoute({
      modelEntity: 'companies',
      deterministic: deterministic('events', 0.9),
      currentPage: 'people',
      hasApiKey: true,
    });
    expect(out.confidence).toBe(0.45);
    expect(out.action).toBe('confirm');
    expect(out.targetEntity).toBe('companies');
  });

  it('no key with a clear margin -> 0.70, routes', () => {
    const out = resolveRoute({
      modelEntity: null,
      deterministic: deterministic('people', 0.8),
      currentPage: 'events',
      hasApiKey: false,
    });
    expect(out.confidence).toBe(0.7);
    expect(out.action).toBe('navigate');
  });

  it('no key with a narrow margin -> 0.40, confirms', () => {
    const out = resolveRoute({
      modelEntity: null,
      deterministic: deterministic('people', 0.1),
      currentPage: 'events',
      hasApiKey: false,
    });
    expect(out.confidence).toBe(0.4);
    expect(out.action).toBe('confirm');
  });

  it('answers inline when the target matches the current page', () => {
    const out = resolveRoute({
      modelEntity: 'people',
      deterministic: deterministic('people', 0.9),
      currentPage: 'people',
      hasApiKey: true,
    });
    expect(out.action).toBe('answer_inline');
  });

  it('no signal at all -> current page, confidence 1, inline', () => {
    const out = resolveRoute({
      modelEntity: null,
      deterministic: deterministic(null, 0),
      currentPage: 'companies',
      hasApiKey: true,
    });
    expect(out.targetEntity).toBe('companies');
    expect(out.confidence).toBe(1);
    expect(out.action).toBe('answer_inline');
  });

  it('no signal inherits the previous entity over the current page', () => {
    const out = resolveRoute({
      modelEntity: null,
      deterministic: deterministic(null, 0),
      currentPage: 'companies',
      previousEntity: 'events',
      hasApiKey: true,
    });
    expect(out.targetEntity).toBe('events');
    expect(out.action).toBe('navigate');
  });

  it('never confirms above the 0.6 threshold', () => {
    const routed = resolveRoute({
      modelEntity: 'events',
      deterministic: deterministic('events', 0.1),
      currentPage: 'companies',
      hasApiKey: true,
    });
    expect(routed.confidence).toBeGreaterThanOrEqual(0.6);
    expect(routed.action).not.toBe('confirm');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-confidence.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/confidence"`

- [ ] **Step 3: Implement it**

```ts
// lib/assistant/confidence.ts
import type { ClassifyResult } from './classify';
import type { AssistantEntity, RouteAction } from './types';

/** Above this margin the deterministic classifier is treated as decisive. */
export const CLEAR_MARGIN = 0.34;
/** Below this confidence we ask instead of navigating. Spec rule 5. */
export const CONFIRM_THRESHOLD = 0.6;

export type ResolveInput = {
  /** What the model chose, or null if it could not be consulted. */
  modelEntity: AssistantEntity | null;
  deterministic: ClassifyResult;
  currentPage: AssistantEntity;
  /** Entity of the previous turn, for follow-ups like "show me more". */
  previousEntity?: AssistantEntity | null;
  hasApiKey: boolean;
};

export type ResolveOutput = {
  targetEntity: AssistantEntity;
  action: RouteAction;
  confidence: number;
};

/**
 * Turns two independent classifier opinions into a target and an action.
 *
 * The model is never asked how confident it is — LLM self-reported confidence
 * sits near 0.9 for almost every input, which would mean the confirm-gate never
 * fires. Agreement between two independent methods is the honest signal.
 */
export function resolveRoute(input: ResolveInput): ResolveOutput {
  const { modelEntity, deterministic, currentPage, previousEntity, hasApiKey } = input;

  const decide = (targetEntity: AssistantEntity, confidence: number): ResolveOutput => {
    if (confidence < CONFIRM_THRESHOLD) {
      return { targetEntity, action: 'confirm', confidence };
    }
    return {
      targetEntity,
      action: targetEntity === currentPage ? 'answer_inline' : 'navigate',
      confidence,
    };
  };

  // No entity signal anywhere: a greeting, a how-to, or a follow-up like
  // "show me more". Rule 7 — the previous turn's entity wins over the page.
  if (!modelEntity && !deterministic.winner) {
    return decide(previousEntity ?? currentPage, 1);
  }

  const clear = deterministic.margin >= CLEAR_MARGIN;

  if (!hasApiKey || !modelEntity) {
    const target = deterministic.winner ?? previousEntity ?? currentPage;
    return decide(target, clear ? 0.7 : 0.4);
  }

  // The model saw a signal the word list missed — trust it, but not fully.
  if (!deterministic.winner) return decide(modelEntity, 0.75);

  if (modelEntity === deterministic.winner) {
    return decide(modelEntity, clear ? 0.95 : 0.75);
  }

  // Genuine disagreement. Prefer the model's reading, but ask.
  return decide(modelEntity, 0.45);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/assistant-confidence.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/assistant/confidence.ts tests/integration/assistant-confidence.test.ts
git commit -m "feat(assistant): compute routing confidence from classifier agreement"
```

---

### Task 4: Extract the companies query into `lib/companies/search.ts`

**Files:**
- Create: `lib/companies/search.ts`
- Modify: `app/api/companies/route.ts` (replace lines 1–242 entirely)
- Test: `tests/integration/companies-search.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db/prisma`
- Produces:
  - `type CompanySearchFilters = { search: string | null; category: string | null; employeeRange: string | null; region: string | null; country: string | null }`
  - `type CompanyRowSource = (sql: string, params: SqlParam[]) => Promise<CompanyRow[]>`
  - `buildCompanyQuery(filters, limit, cursor): { sql: string; params: SqlParam[] }`
  - `formatCompany(row: CompanyRow): FormattedCompany`
  - `searchCompanies(input): Promise<{ companies: FormattedCompany[]; nextCursor: string | null; hasNextPage: boolean; total: null; totalPages: null }>`

`searchCompanies` accepts an optional `rowSource` so tests can run with no database. Behaviour of `/api/companies` must not change — `tests/integration/companies-filter-api.test.ts` is the regression guard.

- [ ] **Step 1: Read the existing route and confirm the baseline passes**

Run: `npx vitest run tests/integration/companies-filter-api.test.ts`
Expected: PASS. Record the count — it must be identical after the refactor.

- [ ] **Step 2: Write the failing test**

```ts
// tests/integration/companies-search.test.ts
import { describe, expect, it } from 'vitest';
import {
  buildCompanyQuery,
  formatCompany,
  searchCompanies,
} from '@/lib/companies/search';

const EMPTY = {
  search: null,
  category: null,
  employeeRange: null,
  region: null,
  country: null,
};

describe('buildCompanyQuery', () => {
  it('uses the pattern operators for prefix search so the index is usable', () => {
    const { sql, params } = buildCompanyQuery({ ...EMPTY, search: 'acme' }, 30, 0);
    expect(sql).toContain('lower(name) ~>=~');
    expect(sql).toContain('lower(name) ~<~');
    expect(sql).toContain('ORDER BY lower(name) USING ~<~');
    expect(params).toContain('acme');
    expect(params).toContain('acmf'); // upper bound: last char incremented
  });

  it('orders by rowCursor when browsing', () => {
    const { sql } = buildCompanyQuery(EMPTY, 30, 0);
    expect(sql).toContain('ORDER BY "DiscoveryCompany"."rowCursor" DESC');
  });

  it('applies the cursor as a rowCursor bound', () => {
    const { sql, params } = buildCompanyQuery(EMPTY, 30, 500);
    expect(sql).toContain('"rowCursor" <');
    expect(params).toContain(500);
  });

  it('expands coarse employee bands', () => {
    const { params } = buildCompanyQuery({ ...EMPTY, employeeRange: '51-200' }, 30, 0);
    expect(params).toEqual(expect.arrayContaining(['51-200', '51-100', '101-200']));
  });

  it('expands country aliases and infers the region', () => {
    const { params } = buildCompanyQuery({ ...EMPTY, country: 'USA' }, 30, 0);
    expect(params).toEqual(expect.arrayContaining(['USA', 'United States', 'Americas']));
  });

  it('does not infer a region when one was given explicitly', () => {
    const { params } = buildCompanyQuery(
      { ...EMPTY, country: 'USA', region: 'Europe' },
      30,
      0
    );
    expect(params).toContain('Europe');
    expect(params).not.toContain('Americas');
  });
});

describe('formatCompany', () => {
  it('strips the trailing numeric suffix from seeded names', () => {
    expect(formatCompany({ rowCursor: 1, id: 'a', name: 'Acme 42' } as never).name).toBe('Acme');
  });

  it('splits comma lists and defaults nulls', () => {
    const out = formatCompany({
      rowCursor: 1,
      id: 'a',
      name: 'Acme',
      tags: 'saas,b2b',
      category: null,
    } as never);
    expect(out.tags).toEqual(['saas', 'b2b']);
    expect(out.category).toBe('');
    expect(out.highlights).toEqual([]);
  });
});

describe('searchCompanies', () => {
  const rows = Array.from({ length: 31 }, (_, i) => ({
    rowCursor: 100 - i,
    id: `c${i}`,
    name: `Company ${i}`,
  })) as never[];

  it('returns total and totalPages as null — counting is too slow to do per request', async () => {
    const out = await searchCompanies({
      filters: EMPTY,
      limit: 30,
      cursor: 0,
      rowSource: async () => rows,
    });
    expect(out.total).toBeNull();
    expect(out.totalPages).toBeNull();
  });

  it('trims the over-fetched row and reports the next cursor', async () => {
    const out = await searchCompanies({
      filters: EMPTY,
      limit: 30,
      cursor: 0,
      rowSource: async () => rows,
    });
    expect(out.companies).toHaveLength(30);
    expect(out.hasNextPage).toBe(true);
    expect(out.nextCursor).toBe('71');
  });

  it('reports no next page when the source returns a short page', async () => {
    const out = await searchCompanies({
      filters: EMPTY,
      limit: 30,
      cursor: 0,
      rowSource: async () => rows.slice(0, 5),
    });
    expect(out.hasNextPage).toBe(false);
    expect(out.nextCursor).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/integration/companies-search.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/companies/search"`

- [ ] **Step 4: Create the extracted module**

Move the logic verbatim out of `app/api/companies/route.ts`. Every SQL string, constant map and comment below is copied unchanged from that file — the comments explain index-usage decisions that are expensive to rediscover.

```ts
// lib/companies/search.ts
export const DEFAULT_LIMIT = 30;
export const MAX_LIMIT = 100;

// Only select columns we actually need for the list view (faster I/O).
// rowCursor is bigint in Postgres; cast to int so JSON serialization works
// (max value ~36.5M fits comfortably).
const LIST_COLUMNS = `
  "rowCursor"::int AS "rowCursor",
  id,
  name,
  category,
  domain,
  founded,
  "employeeRange",
  headquarters,
  region,
  "engagementScore",
  tags,
  highlights,
  insights
`;

export type CompanyRow = {
  rowCursor: number;
  id: string;
  name: string;
  category: string | null;
  description?: string | null;
  domain: string | null;
  website?: string | null;
  founded: string | null;
  employeeRange: string | null;
  headquarters: string | null;
  region: string | null;
  revenueRange?: string | null;
  engagementScore: number | null;
  trustSignals?: string | null;
  tags: string | null;
  email?: string | null;
  phone?: string | null;
  highlights: string | null;
  insights: string | null;
};

export type SqlParam = string | number;

export type CompanySearchFilters = {
  search: string | null;
  category: string | null;
  employeeRange: string | null;
  region: string | null;
  country: string | null;
};

/** Injectable so tests can run with no database. */
export type CompanyRowSource = (sql: string, params: SqlParam[]) => Promise<CompanyRow[]>;

/**
 * Prisma is imported lazily, NOT at module scope.
 *
 * The assistant's adapter registry pulls this module into every test file's
 * import graph. A static `import { prisma }` would construct a PrismaClient
 * during collection and fail the whole suite on a machine with no reachable
 * DATABASE_URL — even for tests that never touch companies.
 */
const defaultRowSource: CompanyRowSource = async (sql, params) => {
  const { prisma } = await import('@/lib/db/prisma');
  return prisma.$queryRawUnsafe<CompanyRow[]>(sql, ...params);
};

export function splitList(value: string | null | undefined) {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

export function cleanParam(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function parseLimit(value: string | null) {
  const requested = Number.parseInt(value || String(DEFAULT_LIMIT), 10);
  if (!Number.isFinite(requested)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, requested));
}

export function formatCompany(row: CompanyRow) {
  return {
    ...row,
    name: row.name.replace(/\s+\d+$/, ''),
    category: row.category ?? '',
    description: row.description ?? '',
    domain: row.domain ?? '',
    website: row.website ?? '',
    founded: row.founded ?? '',
    employeeRange: row.employeeRange ?? '',
    headquarters: row.headquarters ?? '',
    region: row.region ?? '',
    revenueRange: row.revenueRange ?? '',
    engagementScore: row.engagementScore ?? 0,
    trustSignals: row.trustSignals ?? '',
    tags: splitList(row.tags),
    email: row.email ?? '',
    phone: row.phone ?? '',
    highlights: splitList(row.highlights),
    insights: splitList(row.insights),
    events: [],
    deals: [],
    activity: [],
  };
}

export type FormattedCompany = ReturnType<typeof formatCompany>;

// headquarters is stored as "City, Country" (occasionally "City, State,
// Country"), so the country is the last comma-segment. Matching the extracted
// country by equality (rather than a leading-wildcard `LIKE '%, X'`, which can
// never use an index and full-scans 36M rows) lets the query hit
// idx_discovery_cat_region_country_emp. The expression MUST match the index's
// expression exactly. The dataset mixes short/long country names, so match both.
const COUNTRY_EXPR = `trim(split_part(headquarters, ',', -1))`;

const COUNTRY_ALIASES: Record<string, string[]> = {
  USA: ['USA', 'United States'],
  UK: ['UK', 'United Kingdom'],
};

// Each country lives in exactly one region; pinning it lets the query planner
// use the (category, region, ...) composite indexes instead of probing the
// whole table for the headquarters suffix.
const COUNTRY_REGION: Record<string, string> = {
  USA: 'Americas',
  Canada: 'Americas',
  UK: 'Europe',
  Germany: 'Europe',
  France: 'Europe',
  India: 'Asia-Pacific',
  Japan: 'Asia-Pacific',
  Singapore: 'Asia-Pacific',
  Australia: 'Asia-Pacific',
};

// The dataset mixes coarse and fine-grained headcount bands; expand the coarse
// ones so e.g. "51-200" also matches rows stored as "51-100"/"101-200".
const EMPLOYEE_RANGE_EXPANSION: Record<string, string[]> = {
  '51-200': ['51-200', '51-100', '101-200'],
  '1001-5000': ['1001-5000', '1001-2000', '2001-5000'],
  '1001+': ['1001+', '1001-2000', '2001-5000', '1001-5000', '5001-10000', '10001+'],
};

export function buildCompanyQuery(
  filters: CompanySearchFilters,
  limit: number,
  cursor: number
): { sql: string; params: SqlParam[] } {
  const { search, category, employeeRange, region, country } = filters;
  const where: string[] = [];
  const params: SqlParam[] = [];
  // Postgres positional placeholders: push the value, use the returned $n.
  const p = (value: SqlParam) => {
    params.push(value);
    return `$${params.length}`;
  };

  const applyEmployeeFilter = () => {
    if (!employeeRange) return;
    const values = EMPLOYEE_RANGE_EXPANSION[employeeRange] ?? [employeeRange];
    where.push(`"employeeRange" IN (${values.map((v) => p(v)).join(',')})`);
  };

  const applyCountryFilter = () => {
    if (!country) return;
    const names = COUNTRY_ALIASES[country] ?? [country];
    where.push(`${COUNTRY_EXPR} IN (${names.map((n) => p(n)).join(',')})`);
    const inferredRegion = COUNTRY_REGION[country];
    if (inferredRegion && !region) {
      where.push(`region = ${p(inferredRegion)}`);
    }
  };

  // ── Search mode: case-insensitive prefix search via the lower(name) index ──
  // idx_discovery_name_lower_pattern is a text_pattern_ops index, which only
  // serves the pattern operators (~>=~ / ~<~), not collation-aware >= / < —
  // and unlike a parameterized LIKE it stays index-scannable with bound
  // parameters. ORDER BY must use the same operator ordering to stay sorted.
  if (search) {
    const lower = search.toLowerCase();
    const upperBound =
      lower.slice(0, -1) + String.fromCharCode(lower.charCodeAt(lower.length - 1) + 1);
    where.push(`lower(name) ~>=~ ${p(lower)} AND lower(name) ~<~ ${p(upperBound)}`);

    if (category) where.push(`category = ${p(category)}`);
    applyEmployeeFilter();
    if (region) where.push(`region = ${p(region)}`);
    applyCountryFilter();

    return {
      sql: `
        SELECT ${LIST_COLUMNS}
        FROM "DiscoveryCompany"
        WHERE ${where.join(' AND ')}
        ORDER BY lower(name) USING ~<~
        LIMIT ${p(limit + 1)}
      `,
      params,
    };
  }

  // ── Browse mode: use rowCursor for instant pagination ──
  // rowCursor DESC shows newest companies first (Indian MNCs were inserted
  // last = highest cursors; rowCursor mirrors the original SQLite rowid).
  if (category) where.push(`category = ${p(category)}`);
  applyEmployeeFilter();
  if (region) where.push(`region = ${p(region)}`);
  applyCountryFilter();

  if (cursor > 0) where.push(`"rowCursor" < ${p(cursor)}`);

  const whereClause = where.length > 0 ? where.join(' AND ') : '1 = 1';

  return {
    sql: `
      SELECT ${LIST_COLUMNS}
      FROM "DiscoveryCompany"
      WHERE ${whereClause}
      ORDER BY "DiscoveryCompany"."rowCursor" DESC
      LIMIT ${p(limit + 1)}
    `,
    params,
  };
}

/**
 * `total` and `totalPages` are deliberately null: counting the discovery
 * dataset per request is too slow, so the UI pages by cursor instead. Callers
 * must render an absent count rather than reporting zero.
 */
export async function searchCompanies(input: {
  filters: CompanySearchFilters;
  limit: number;
  cursor: number;
  rowSource?: CompanyRowSource;
}): Promise<{
  companies: FormattedCompany[];
  nextCursor: string | null;
  hasNextPage: boolean;
  total: null;
  totalPages: null;
}> {
  const { sql, params } = buildCompanyQuery(input.filters, input.limit, input.cursor);
  const rows = await (input.rowSource ?? defaultRowSource)(sql, params);

  // One row is over-fetched purely to detect a next page.
  const pageRows = rows.slice(0, input.limit);
  const hasNextPage = rows.length > input.limit;
  const lastRow = pageRows[pageRows.length - 1];

  return {
    companies: pageRows.map(formatCompany),
    nextCursor: hasNextPage ? String(lastRow?.rowCursor ?? '') : null,
    hasNextPage,
    total: null,
    totalPages: null,
  };
}
```

- [ ] **Step 5: Replace the route with a thin caller**

Replace the entire contents of `app/api/companies/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { cleanParam, parseLimit, searchCompanies } from '@/lib/companies/search';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const cursor = Number.parseInt(searchParams.get('cursor') || '0', 10) || 0;

    const result = await searchCompanies({
      filters: {
        search: cleanParam(searchParams.get('search')),
        category: cleanParam(searchParams.get('category')),
        employeeRange: cleanParam(searchParams.get('employeeRange')),
        region: cleanParam(searchParams.get('location')),
        country: cleanParam(searchParams.get('country')),
      },
      limit,
      cursor,
    });

    return NextResponse.json({ ...result, pagination: 'cursor', page, limit });
  } catch (error) {
    console.error('Failed to fetch companies:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Run both test files**

Run: `npx vitest run tests/integration/companies-search.test.ts tests/integration/companies-filter-api.test.ts`
Expected: the new file PASSes (11 tests) **and** `companies-filter-api.test.ts` passes with the same count as Step 1. A regression there means the extraction changed behaviour — fix it rather than editing that test.

- [ ] **Step 7: Commit**

```bash
git add lib/companies/search.ts app/api/companies/route.ts tests/integration/companies-search.test.ts
git commit -m "refactor(companies): extract the discovery query into lib/companies/search"
```

---

### Task 5: The people adapter

**Files:**
- Create: `lib/assistant/adapters/people.ts`
- Test: `tests/integration/assistant-adapters.test.ts` (created here, extended in Tasks 6 and 7)

**Interfaces:**
- Consumes: `EntityAdapter`, `FilterChip` (Task 1), `ENTITY_SIGNALS` (Task 2); existing `loadPeople`, `applyPeopleFilters`, `parsePeopleQuery`, `buildPeopleFilterChips`, `buildPeopleAnswer`, `emptyPeopleFilters`, `PeopleFilters`
- Produces: `peopleAdapter: EntityAdapter<PeopleFilters>`

Existing signatures this task depends on:
- `parsePeopleQuery(message: string, options: { base: PeopleFilters }): PeopleFilters`
- `applyPeopleFilters(people: Person[], filters: PeopleFilters): Person[]`
- `buildPeopleFilterChips(filters: PeopleFilters): PeopleFilterChip[]`
- `buildPeopleAnswer(input: { question: string; filters: PeopleFilters; matches: readonly Person[]; total: number }): string`

`buildPeopleAnswer` needs a `question`; the adapter's `describe()` has none, so it passes `''`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/assistant-adapters.test.ts
import { describe, expect, it } from 'vitest';
import { peopleAdapter } from '@/lib/assistant/adapters/people';

describe('peopleAdapter', () => {
  it('parses a question into filters', () => {
    const filters = peopleAdapter.parseLocally(
      'verified marketing managers in Germany',
      peopleAdapter.emptyFilters()
    );
    expect(filters.countries).toEqual(['Germany']);
    expect(filters.verification).toBe('verified');
  });

  it('searches and returns a real numeric total', async () => {
    const filters = peopleAdapter.parseLocally('people in Germany', peopleAdapter.emptyFilters());
    const result = await peopleAdapter.search(filters, 1);
    expect(typeof result.total).toBe('number');
    expect(result.rows.length).toBeLessThanOrEqual(10);
  });

  it('pages without overlapping', async () => {
    const empty = peopleAdapter.emptyFilters();
    const first = await peopleAdapter.search(empty, 1);
    const second = await peopleAdapter.search(empty, 2);
    const firstIds = first.rows.map((r) => (r as { id: string }).id);
    const secondIds = second.rows.map((r) => (r as { id: string }).id);
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
  });

  it('carries country over from another entity and drops what it cannot map', () => {
    const { filters, dropped } = peopleAdapter.carryOver({
      country: 'Germany',
      venue: 'Messe Berlin',
    });
    expect(filters.countries).toEqual(['Germany']);
    expect(dropped).toContain('venue');
  });

  it('produces chips and non-empty prose', () => {
    const filters = peopleAdapter.parseLocally('CEOs in France', peopleAdapter.emptyFilters());
    expect(peopleAdapter.chips(filters).length).toBeGreaterThan(0);
    expect(peopleAdapter.describe(filters, 12).length).toBeGreaterThan(0);
  });

  it('suggests follow-ups', () => {
    expect(peopleAdapter.suggest(peopleAdapter.emptyFilters(), 40).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-adapters.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/adapters/people"`

- [ ] **Step 3: Implement the adapter**

```ts
// lib/assistant/adapters/people.ts
import { buildPeopleAnswer } from '@/lib/people/answer';
import { buildPeopleFilterChips } from '@/lib/people/chips';
import { loadPeople } from '@/lib/people/data';
import { applyPeopleFilters } from '@/lib/people/filters';
import { parsePeopleQuery } from '@/lib/people/parse-query';
import { emptyPeopleFilters, type PeopleFilters } from '@/types/people';
import { ENTITY_SIGNALS } from '../signals';
import type { EntityAdapter, FilterChip } from '../types';

const PAGE_SIZE = 10;

/** Keys this entity accepts from another page's filters. Everything else is dropped. */
const CARRY_OVER_KEYS: Record<string, keyof PeopleFilters> = {
  country: 'countries',
  countries: 'countries',
  location: 'locations',
  locations: 'locations',
  city: 'locations',
  industry: 'industries',
  industries: 'industries',
  category: 'industries',
  company: 'companies',
  companies: 'companies',
  keyword: 'keywords',
  keywords: 'keywords',
};

function asList(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && !!v);
  return [];
}

export const peopleAdapter: EntityAdapter<PeopleFilters> = {
  entity: 'people',
  signals: ENTITY_SIGNALS.people,

  filterSchema: {
    type: 'object',
    properties: {
      titles: { type: 'array', items: { type: 'string' }, description: 'Job titles, e.g. "Marketing Manager".' },
      seniorities: { type: 'array', items: { type: 'string' }, description: 'e.g. "C-Level", "VP", "Director".' },
      departments: { type: 'array', items: { type: 'string' } },
      companies: { type: 'array', items: { type: 'string' } },
      locations: { type: 'array', items: { type: 'string' }, description: 'Cities or regions.' },
      countries: { type: 'array', items: { type: 'string' } },
      industries: { type: 'array', items: { type: 'string' } },
      keywords: { type: 'array', items: { type: 'string' } },
      verification: {
        type: ['string', 'null'],
        enum: ['verified', 'unverified', 'catch-all', null],
        description: 'Null unless the user asked for a verification state.',
      },
      search: { type: 'string', description: 'Free text that fits no other field.' },
    },
    required: [],
  },

  emptyFilters: emptyPeopleFilters,

  parseLocally(message, base) {
    return parsePeopleQuery(message, { base });
  },

  carryOver(foreign) {
    const filters: Partial<PeopleFilters> = {};
    const dropped: string[] = [];

    for (const [key, value] of Object.entries(foreign)) {
      const target = CARRY_OVER_KEYS[key];
      const values = asList(value);
      if (!target || values.length === 0) {
        // Dropped, never guessed — a filter with no counterpart here would be
        // an invention, and the caller is told so it can say what it lost.
        if (values.length > 0) dropped.push(key);
        continue;
      }
      const existing = (filters[target] as string[] | undefined) ?? [];
      (filters[target] as string[]) = [...new Set([...existing, ...values])];
    }

    return { filters, dropped };
  },

  async search(filters, page) {
    const matches = applyPeopleFilters(loadPeople(), filters);
    const start = Math.max(0, (page - 1) * PAGE_SIZE);
    return { rows: matches.slice(start, start + PAGE_SIZE), total: matches.length };
  },

  chips(filters): FilterChip[] {
    return buildPeopleFilterChips(filters).map((chip) => ({
      key: String(chip.key),
      label: String(chip.label),
      value: String(chip.value ?? chip.label),
    }));
  },

  describe(filters, total) {
    const matches = applyPeopleFilters(loadPeople(), filters).slice(0, PAGE_SIZE);
    return buildPeopleAnswer({ question: '', filters, matches, total: total ?? 0 });
  },

  suggest(filters, total) {
    const items = ['Show me more'];
    if (!total || total > PAGE_SIZE) items.push('Narrow to verified emails only');
    if (filters.countries.length === 0) items.push('Filter by country');
    if (filters.seniorities.length === 0) items.push('Only decision makers');
    return items.slice(0, 3);
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/assistant-adapters.test.ts`
Expected: PASS, 6 tests.

If `buildPeopleFilterChips` returns a shape whose fields are not `key`/`label`/`value`, adjust the mapping in `chips()` to match the real `PeopleFilterChip` type — read `lib/people/chips.ts` rather than guessing.

- [ ] **Step 5: Commit**

```bash
git add lib/assistant/adapters/people.ts tests/integration/assistant-adapters.test.ts
git commit -m "feat(assistant): add the people entity adapter"
```

---

### Task 6: The events adapter

**Files:**
- Create: `lib/assistant/adapters/events.ts`
- Modify: `tests/integration/assistant-adapters.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `filterEvents`, `describeResults` from `@/lib/find-shows/filter-events`; `eventFiltersSchema`, `EventFilters` from `@/models/event-query`
- Produces: `eventsAdapter: EntityAdapter<AskEventFilters>`, `type AskEventFilters = EventFilters`

Existing signatures:
- `filterEvents(filters: EventFilters): { events: EventResult[]; totalMatched: number }` — `EventFilters` carries its own `limit`/`offset`
- `describeResults(filters: EventFilters, totalMatched: number, shown: number): string`

**Naming:** `EventFilters` is defined twice in this repo — `types/events.ts` (array-valued, drives the Explorer sidebar) and `models/event-query.ts` (single-valued Zod schema, consumed by `filterEvents`). This adapter uses the **`models/event-query.ts`** one, aliased to `AskEventFilters` at the import so the collision cannot cause a silent mistake.

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/assistant-adapters.test.ts`:

```ts
import { eventsAdapter } from '@/lib/assistant/adapters/events';

describe('eventsAdapter', () => {
  it('extracts a city from a question', () => {
    const filters = eventsAdapter.parseLocally(
      'trade shows in Munich',
      eventsAdapter.emptyFilters()
    );
    expect(filters.keyword ?? filters.city).toBeTruthy();
  });

  it('searches and returns a numeric total', async () => {
    const result = await eventsAdapter.search(
      { ...eventsAdapter.emptyFilters(), country: 'Germany' },
      1
    );
    expect(typeof result.total).toBe('number');
    expect(result.rows.length).toBeLessThanOrEqual(10);
  });

  it('pages via offset', async () => {
    const empty = eventsAdapter.emptyFilters();
    const first = await eventsAdapter.search(empty, 1);
    const second = await eventsAdapter.search(empty, 2);
    const firstSlugs = first.rows.map((r) => (r as { slug: string }).slug);
    const secondSlugs = second.rows.map((r) => (r as { slug: string }).slug);
    expect(firstSlugs.some((s) => secondSlugs.includes(s))).toBe(false);
  });

  it('carries country over and drops people-only filters', () => {
    const { filters, dropped } = eventsAdapter.carryOver({
      country: 'Germany',
      verification: 'verified',
    });
    expect(filters.country).toBe('Germany');
    expect(dropped).toContain('verification');
  });

  it('never returns a Person-shaped row', async () => {
    const result = await eventsAdapter.search(eventsAdapter.emptyFilters(), 1);
    for (const row of result.rows) {
      expect(row).not.toHaveProperty('firstName');
      expect(row).toHaveProperty('slug');
    }
  });

  it('produces chips and prose', () => {
    const filters = { ...eventsAdapter.emptyFilters(), city: 'Munich' };
    expect(eventsAdapter.chips(filters).length).toBeGreaterThan(0);
    expect(eventsAdapter.describe(filters, 5).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-adapters.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/adapters/events"`

- [ ] **Step 3: Implement the adapter**

```ts
// lib/assistant/adapters/events.ts
import { describeResults, filterEvents } from '@/lib/find-shows/filter-events';
import { eventFiltersSchema, type EventFilters as AskEventFilters } from '@/models/event-query';
import { ENTITY_SIGNALS } from '../signals';
import type { EntityAdapter, FilterChip } from '../types';

export type { AskEventFilters };

const PAGE_SIZE = 10;

/**
 * Keys this entity accepts from another page's filters.
 *
 * Note this is the SINGLE-VALUED EventFilters from models/event-query.ts (the
 * one filterEvents consumes), not the array-valued type of the same name in
 * types/events.ts that drives the Explorer sidebar.
 */
const CARRY_OVER_KEYS: Record<string, keyof AskEventFilters> = {
  country: 'country',
  countries: 'country',
  location: 'city',
  locations: 'city',
  city: 'city',
  region: 'region',
  industry: 'category',
  industries: 'category',
  category: 'category',
  keyword: 'keyword',
  keywords: 'keyword',
};

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const found = value.find((v) => typeof v === 'string' && v.trim());
    return typeof found === 'string' ? found.trim() : null;
  }
  return null;
}

export const eventsAdapter: EntityAdapter<AskEventFilters> = {
  entity: 'events',
  signals: ENTITY_SIGNALS.events,

  filterSchema: {
    type: 'object',
    properties: {
      city: { type: ['string', 'null'], description: 'City the show runs in.' },
      country: { type: ['string', 'null'] },
      region: { type: ['string', 'null'] },
      category: { type: ['string', 'null'], description: 'Industry category of the show.' },
      keyword: { type: ['string', 'null'], description: 'Free text matched against the show name.' },
      monthFrom: { type: ['integer', 'null'], minimum: 1, maximum: 12 },
      monthTo: { type: ['integer', 'null'], minimum: 1, maximum: 12 },
      year: { type: ['integer', 'null'], minimum: 2020, maximum: 2100 },
    },
    required: [],
  },

  emptyFilters() {
    return {
      city: null,
      country: null,
      region: null,
      category: null,
      keyword: null,
      monthFrom: null,
      monthTo: null,
      year: null,
      limit: null,
      offset: null,
    };
  },

  /**
   * No natural-language event parser exists outside the model path, so the
   * local fallback puts the whole message in `keyword`. filterEvents matches
   * that against the catalog's searchText, which is a weak but honest read —
   * and it never invents a filter the user did not ask for.
   */
  parseLocally(message, base) {
    const keyword = message.trim();
    return { ...base, keyword: keyword || base.keyword };
  },

  carryOver(foreign) {
    const filters: Partial<AskEventFilters> = {};
    const dropped: string[] = [];

    for (const [key, value] of Object.entries(foreign)) {
      const target = CARRY_OVER_KEYS[key];
      const single = firstString(value);
      if (!target || !single) {
        if (single) dropped.push(key);
        continue;
      }
      if (filters[target] == null) {
        (filters[target] as string) = single;
      }
    }

    return { filters, dropped };
  },

  async search(filters, page) {
    const parsed = eventFiltersSchema.parse({
      ...filters,
      limit: PAGE_SIZE,
      offset: Math.max(0, (page - 1) * PAGE_SIZE),
    });
    const { events, totalMatched } = filterEvents(parsed);
    return { rows: events, total: totalMatched };
  },

  chips(filters): FilterChip[] {
    const labels: Array<[keyof AskEventFilters, string]> = [
      ['city', 'City'],
      ['country', 'Country'],
      ['region', 'Region'],
      ['category', 'Category'],
      ['keyword', 'Keyword'],
    ];
    return labels
      .filter(([key]) => Boolean(filters[key]))
      .map(([key, label]) => ({ key: String(key), label, value: String(filters[key]) }));
  },

  describe(filters, total) {
    const count = total ?? 0;
    return describeResults(filters, count, Math.min(count, PAGE_SIZE));
  },

  suggest(filters, total) {
    const items: string[] = [];
    if ((total ?? 0) > PAGE_SIZE) items.push('Show me more');
    if (!filters.category) items.push('Filter by industry category');
    if (!filters.country && !filters.city) items.push('Narrow to one country');
    items.push('Companies exhibiting at these events');
    return items.slice(0, 3);
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/assistant-adapters.test.ts`
Expected: PASS, 12 tests (6 people + 6 events).

- [ ] **Step 5: Commit**

```bash
git add lib/assistant/adapters/events.ts tests/integration/assistant-adapters.test.ts
git commit -m "feat(assistant): add the events entity adapter"
```

---

### Task 7: The companies adapter

**Files:**
- Create: `lib/assistant/adapters/companies.ts`
- Modify: `tests/integration/assistant-adapters.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `searchCompanies`, `CompanySearchFilters`, `CompanyRowSource` from Task 4
- Produces: `companiesAdapter: EntityAdapter<CompanySearchFilters>`, `createCompaniesAdapter(rowSource?: CompanyRowSource): EntityAdapter<CompanySearchFilters>`

`createCompaniesAdapter` exists so tests can inject a fake row source and run with no database. `companiesAdapter` is `createCompaniesAdapter()` with the real one.

**`total` is always `null` here.** `describe()` must not say "0 results".

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/assistant-adapters.test.ts`:

```ts
import { createCompaniesAdapter } from '@/lib/assistant/adapters/companies';

describe('companiesAdapter', () => {
  const fakeRows = Array.from({ length: 11 }, (_, i) => ({
    rowCursor: 100 - i,
    id: `c${i}`,
    name: `Acme ${i}`,
    category: 'SaaS',
    tags: 'saas',
  }));
  const adapter = createCompaniesAdapter(async () => fakeRows as never);

  it('always reports a null total — counting is too slow to do per request', async () => {
    const result = await adapter.search(adapter.emptyFilters(), 1);
    expect(result.total).toBeNull();
  });

  it('never renders "0" when the total is null', () => {
    const prose = adapter.describe({ ...adapter.emptyFilters(), country: 'Germany' }, null);
    expect(prose).not.toMatch(/\b0\b/);
    expect(prose.length).toBeGreaterThan(0);
  });

  it('puts a plain query into the prefix search field', () => {
    const filters = adapter.parseLocally('Infosys', adapter.emptyFilters());
    expect(filters.search).toBe('Infosys');
  });

  it('carries country and industry over, dropping event-only filters', () => {
    const { filters, dropped } = adapter.carryOver({
      country: 'Germany',
      industry: 'SaaS',
      venue: 'Messe Berlin',
    });
    expect(filters.country).toBe('Germany');
    expect(filters.category).toBe('SaaS');
    expect(dropped).toContain('venue');
  });

  it('returns company rows, never people', async () => {
    const result = await adapter.search(adapter.emptyFilters(), 1);
    expect(result.rows.length).toBeGreaterThan(0);
    for (const row of result.rows) {
      expect(row).not.toHaveProperty('firstName');
      expect(row).toHaveProperty('name');
    }
  });

  it('produces chips for the applied filters', () => {
    const chips = adapter.chips({ ...adapter.emptyFilters(), country: 'Germany' });
    expect(chips).toHaveLength(1);
    expect(chips[0].value).toBe('Germany');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-adapters.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/adapters/companies"`

- [ ] **Step 3: Implement the adapter**

```ts
// lib/assistant/adapters/companies.ts
import {
  searchCompanies,
  type CompanyRowSource,
  type CompanySearchFilters,
} from '@/lib/companies/search';
import { ENTITY_SIGNALS } from '../signals';
import type { EntityAdapter, FilterChip } from '../types';

const PAGE_SIZE = 10;

const CARRY_OVER_KEYS: Record<string, keyof CompanySearchFilters> = {
  country: 'country',
  countries: 'country',
  location: 'region',
  locations: 'region',
  region: 'region',
  industry: 'category',
  industries: 'category',
  category: 'category',
  keyword: 'search',
  keywords: 'search',
};

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const found = value.find((v) => typeof v === 'string' && v.trim());
    return typeof found === 'string' ? found.trim() : null;
  }
  return null;
}

export function createCompaniesAdapter(
  rowSource?: CompanyRowSource
): EntityAdapter<CompanySearchFilters> {
  return {
    entity: 'companies',
    signals: ENTITY_SIGNALS.companies,

    filterSchema: {
      type: 'object',
      properties: {
        search: {
          type: ['string', 'null'],
          description: 'Company name PREFIX. Matching is prefix-only, so send a leading fragment, never a substring.',
        },
        category: { type: ['string', 'null'], description: 'Industry category.' },
        employeeRange: {
          type: ['string', 'null'],
          description: 'Headcount band, e.g. "51-200", "1001-5000", "1001+".',
        },
        region: { type: ['string', 'null'], description: 'e.g. "Europe", "Americas", "Asia-Pacific".' },
        country: { type: ['string', 'null'] },
      },
      required: [],
    },

    emptyFilters() {
      return { search: null, category: null, employeeRange: null, region: null, country: null };
    },

    parseLocally(message, base) {
      const trimmed = message.trim();
      return { ...base, search: trimmed || base.search };
    },

    carryOver(foreign) {
      const filters: Partial<CompanySearchFilters> = {};
      const dropped: string[] = [];

      for (const [key, value] of Object.entries(foreign)) {
        const target = CARRY_OVER_KEYS[key];
        const single = firstString(value);
        if (!target || !single) {
          if (single) dropped.push(key);
          continue;
        }
        if (filters[target] == null) filters[target] = single;
      }

      return { filters, dropped };
    },

    async search(filters, page) {
      const result = await searchCompanies({
        filters,
        limit: PAGE_SIZE,
        // The route pages by rowCursor, but the assistant has no cursor to
        // replay on page 1, so page > 1 is served by over-fetching. Cursor
        // continuation belongs with the UI work in Spec 2.
        cursor: 0,
        rowSource,
      });
      const start = Math.max(0, (page - 1) * PAGE_SIZE);
      return { rows: result.companies.slice(start, start + PAGE_SIZE), total: null };
    },

    chips(filters): FilterChip[] {
      const labels: Array<[keyof CompanySearchFilters, string]> = [
        ['search', 'Name'],
        ['category', 'Industry'],
        ['employeeRange', 'Headcount'],
        ['region', 'Region'],
        ['country', 'Country'],
      ];
      return labels
        .filter(([key]) => Boolean(filters[key]))
        .map(([key, label]) => ({ key: String(key), label, value: String(filters[key]) }));
    },

    /**
     * `total` is ALWAYS null for companies. Prose must describe the filters
     * rather than report a count — saying "0 companies" when the count is
     * simply unavailable is worse than saying nothing about the number.
     */
    describe(filters, _total) {
      const parts: string[] = [];
      if (filters.search) parts.push(`names starting with "${filters.search}"`);
      if (filters.category) parts.push(`in ${filters.category}`);
      if (filters.employeeRange) parts.push(`with ${filters.employeeRange} employees`);
      if (filters.country) parts.push(`based in ${filters.country}`);
      else if (filters.region) parts.push(`in ${filters.region}`);

      if (parts.length === 0) {
        return 'Showing companies from the discovery dataset. Add a filter to narrow the list.';
      }
      return `Showing companies ${parts.join(', ')}. The dataset is too large to count per query, so page through the results rather than reading a total.`;
    },

    suggest(filters) {
      const items = ['Show me more'];
      if (!filters.employeeRange) items.push('Filter by headcount');
      if (!filters.country) items.push('Narrow to one country');
      return items.slice(0, 3);
    },
  };
}

export const companiesAdapter = createCompaniesAdapter();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/assistant-adapters.test.ts`
Expected: PASS, 18 tests (6 people + 6 events + 6 companies).

- [ ] **Step 5: Add the shared contract suite**

All three adapters now exist, so the uniform contract can be asserted once. This
is what catches an adapter that drifts out of the interface later — a per-entity
test would not.

Append to `tests/integration/assistant-adapters.test.ts`:

```ts
import { peopleAdapter as people } from '@/lib/assistant/adapters/people';
import { eventsAdapter as events } from '@/lib/assistant/adapters/events';
import type { EntityAdapter } from '@/lib/assistant/types';

describe('EntityAdapter contract', () => {
  const adapters: Array<[string, EntityAdapter<never>]> = [
    ['people', people as unknown as EntityAdapter<never>],
    ['events', events as unknown as EntityAdapter<never>],
    ['companies', createCompaniesAdapter(async () => []) as unknown as EntityAdapter<never>],
  ];

  it.each(adapters)('%s declares its own entity and signals', (name, adapter) => {
    expect(adapter.entity).toBe(name);
    expect(adapter.signals.length).toBeGreaterThan(0);
  });

  it.each(adapters)('%s exposes an object filterSchema with properties', (_name, adapter) => {
    expect(adapter.filterSchema.type).toBe('object');
    expect(Object.keys(adapter.filterSchema.properties as object).length).toBeGreaterThan(0);
  });

  it.each(adapters)('%s round-trips empty filters through parseLocally', (_name, adapter) => {
    const parsed = adapter.parseLocally('anything', adapter.emptyFilters());
    expect(parsed).toBeTypeOf('object');
    expect(parsed).not.toBeNull();
  });

  it.each(adapters)('%s returns a number-or-null total', async (_name, adapter) => {
    const { total } = await adapter.search(adapter.emptyFilters(), 1);
    expect(total === null || typeof total === 'number').toBe(true);
  });

  it.each(adapters)('%s never renders a bare 0 when total is null', (_name, adapter) => {
    const prose = adapter.describe(adapter.emptyFilters(), null);
    expect(prose.length).toBeGreaterThan(0);
    expect(prose).not.toMatch(/\b0\b/);
  });

  it.each(adapters)('%s always suggests at least one follow-up', (_name, adapter) => {
    expect(adapter.suggest(adapter.emptyFilters(), null).length).toBeGreaterThan(0);
  });

  it.each(adapters)('%s returns chips shaped {key,label,value}', (_name, adapter) => {
    for (const chip of adapter.chips(adapter.emptyFilters())) {
      expect(typeof chip.key).toBe('string');
      expect(typeof chip.label).toBe('string');
      expect(typeof chip.value).toBe('string');
    }
  });
});
```

- [ ] **Step 6: Run the contract suite**

Run: `npx vitest run tests/integration/assistant-adapters.test.ts`
Expected: PASS, 39 tests (18 + 21 contract cases).

If "never renders a bare 0" fails for people or events, their `describe()` is
reporting a count when it has none. Fix the adapter's prose to omit the number
when `total` is null — do not relax the assertion; this is the exact trap the
spec calls out.

- [ ] **Step 7: Commit**

```bash
git add lib/assistant/adapters/companies.ts tests/integration/assistant-adapters.test.ts
git commit -m "feat(assistant): add the companies adapter and the shared adapter contract suite"
```

---

### Task 8: The registry and carry-over translation

**Files:**
- Create: `lib/assistant/registry.ts`, `lib/assistant/carry-over.ts`
- Test: `tests/integration/assistant-carry-over.test.ts`

**Interfaces:**
- Consumes: the three adapters (Tasks 5–7); `AssistantEntity` (Task 1)
- Produces:
  - `adapterFor(entity: AssistantEntity): EntityAdapter<unknown>`
  - `setAdapterForTests(entity, adapter)` / `resetAdapters()`
  - `translateFilters(input: { from: AssistantEntity; to: AssistantEntity; filters: Record<string, unknown> }): { filters: Record<string, unknown>; dropped: string[] }`

`translateFilters` returns the source filters unchanged with `dropped: []` when `from === to`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/assistant-carry-over.test.ts
import { describe, expect, it } from 'vitest';
import { translateFilters } from '@/lib/assistant/carry-over';
import { adapterFor } from '@/lib/assistant/registry';

describe('adapterFor', () => {
  it('returns the adapter whose entity matches', () => {
    expect(adapterFor('people').entity).toBe('people');
    expect(adapterFor('events').entity).toBe('events');
    expect(adapterFor('companies').entity).toBe('companies');
  });
});

describe('translateFilters', () => {
  it('carries country from companies to events', () => {
    const out = translateFilters({
      from: 'companies',
      to: 'events',
      filters: { country: 'Germany' },
    });
    expect(out.filters.country).toBe('Germany');
    expect(out.dropped).toEqual([]);
  });

  it('maps industry onto the events category', () => {
    const out = translateFilters({
      from: 'companies',
      to: 'events',
      filters: { category: 'SaaS' },
    });
    expect(out.filters.category).toBe('SaaS');
  });

  it('drops a filter with no counterpart and reports it', () => {
    const out = translateFilters({
      from: 'people',
      to: 'events',
      filters: { country: 'Germany', verification: 'verified' },
    });
    expect(out.filters.country).toBe('Germany');
    expect(out.dropped).toContain('verification');
  });

  it('passes filters through untouched when the entity is unchanged', () => {
    const filters = { country: 'Germany', verification: 'verified' };
    const out = translateFilters({ from: 'people', to: 'people', filters });
    expect(out.filters).toEqual(filters);
    expect(out.dropped).toEqual([]);
  });

  it('ignores empty values rather than reporting them as dropped', () => {
    const out = translateFilters({
      from: 'people',
      to: 'events',
      filters: { countries: [], search: '' },
    });
    expect(out.dropped).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-carry-over.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/carry-over"`

- [ ] **Step 3: Implement the registry**

```ts
// lib/assistant/registry.ts
import { companiesAdapter } from './adapters/companies';
import { eventsAdapter } from './adapters/events';
import { peopleAdapter } from './adapters/people';
import type { AssistantEntity, EntityAdapter } from './types';

type AnyAdapter = EntityAdapter<never>;

const defaults: Record<AssistantEntity, AnyAdapter> = {
  companies: companiesAdapter as AnyAdapter,
  events: eventsAdapter as AnyAdapter,
  people: peopleAdapter as AnyAdapter,
};

const registry: Record<AssistantEntity, AnyAdapter> = { ...defaults };

export function adapterFor(entity: AssistantEntity): AnyAdapter {
  return registry[entity];
}

/** Test seam — lets a suite swap in a fake adapter without a database. */
export function setAdapterForTests(entity: AssistantEntity, adapter: AnyAdapter): void {
  registry[entity] = adapter;
}

export function resetAdapters(): void {
  for (const entity of Object.keys(defaults) as AssistantEntity[]) {
    registry[entity] = defaults[entity];
  }
}
```

- [ ] **Step 4: Implement carry-over**

```ts
// lib/assistant/carry-over.ts
import { adapterFor } from './registry';
import type { AssistantEntity } from './types';

/**
 * Translates one page's active filters onto another entity's schema.
 *
 * Each adapter decides what it can accept; anything without a counterpart is
 * dropped rather than guessed, and reported back so the UI can say what it lost
 * instead of losing it silently.
 */
export function translateFilters(input: {
  from: AssistantEntity;
  to: AssistantEntity;
  filters: Record<string, unknown>;
}): { filters: Record<string, unknown>; dropped: string[] } {
  if (input.from === input.to) {
    return { filters: input.filters, dropped: [] };
  }

  const { filters, dropped } = adapterFor(input.to).carryOver(input.filters);
  return { filters: filters as Record<string, unknown>, dropped };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/integration/assistant-carry-over.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/assistant/registry.ts lib/assistant/carry-over.ts tests/integration/assistant-carry-over.test.ts
git commit -m "feat(assistant): add the adapter registry and cross-entity filter carry-over"
```

---

### Task 9: The model classifier

**Files:**
- Create: `lib/assistant/route.ts`

**Interfaces:**
- Consumes: `classify` (Task 2), `resolveRoute` (Task 3), `adapterFor` (Task 8), `ENTITY_SIGNALS` (Task 2)
- Produces:
  - `type ModelClassifier = (message: string) => Promise<{ entity: AssistantEntity; filters: Record<string, unknown> } | null>`
  - `isConfigured(): boolean`
  - `createModelClassifier(): ModelClassifier`
  - `buildSystemPrompt(): string`

Returning `null` means "could not classify" — no key, an error, a timeout, or no tool call. The caller maps that to the appropriate `degraded` reason.

No test file in this task: the only behaviour that does not require a live model is prompt construction, and that is asserted in Task 11 via the stream's degraded paths. Verification here is a typecheck.

- [ ] **Step 1: Implement the classifier**

```ts
// lib/assistant/route.ts
// Type-only import: erased at compile time, so a missing package cannot break
// the webpack build. The runtime import below is deliberately opaque to
// webpack — a bare `import Anthropic from '@anthropic-ai/sdk'` here would fail
// module resolution for the WHOLE dev compilation, taking every unrelated
// route down with it. Same pattern as services/event-query.service.ts.
import type AnthropicSdk from '@anthropic-ai/sdk';
import { adapterFor } from './registry';
import { ENTITY_SIGNALS } from './signals';
import { ASSISTANT_ENTITIES, type AssistantEntity } from './types';

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 512;
/** Classification sits in front of everything; a hung call would freeze the panel. */
const TIMEOUT_MS = 4000;

export type ModelClassification = {
  entity: AssistantEntity;
  filters: Record<string, unknown>;
};

/** Returns null when the model could not be consulted or produced no tool call. */
export type ModelClassifier = (message: string) => Promise<ModelClassification | null>;

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const TOOL_NAMES: Record<AssistantEntity, string> = {
  events: 'route_to_events',
  companies: 'route_to_companies',
  people: 'route_to_people',
};

const ENTITY_BY_TOOL: Record<string, AssistantEntity> = {
  route_to_events: 'events',
  route_to_companies: 'companies',
  route_to_people: 'people',
};

/**
 * The signal words come from signals.ts — the same list the deterministic
 * classifier scores against — so the prompt and the fallback can never drift.
 */
export function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);

  const signalLines = ASSISTANT_ENTITIES.map((entity) => {
    const words = ENTITY_SIGNALS[entity].map((s) => s.word).join(', ');
    return `- ${entity}: ${words}`;
  });

  return [
    'You route a single question typed into a B2B CRM assistant to exactly one dataset, and extract structured filters from it.',
    '',
    'Call exactly one tool:',
    '- route_to_events — trade shows, expos, conferences, summits, exhibitors, venues, dates.',
    '- route_to_companies — accounts, firmographics, headcount, industry, domains.',
    '- route_to_people — contacts, job titles, seniority, departments, emails.',
    '',
    'Typical signal words:',
    ...signalLines,
    '',
    'The DELIVERABLE noun decides the dataset, not the qualifier.',
    '"Companies exhibiting at SaaStr" is companies. "Events where NovaAI is exhibiting" is events. "CMOs at companies attending Web Summit" is people.',
    '',
    `Today is ${today}. Resolve relative timing against it: "next March" is March of the coming year, "Q1" is months 1 to 3.`,
    'Set a field to null whenever the question does not constrain it. Do not guess a country from a city unless you are confident (London -> United Kingdom is fine; Springfield is not).',
    'Never invent or name specific records — you only produce filters. The results are produced locally.',
  ].join('\n');
}

function buildTools(): AnthropicSdk.Tool[] {
  return ASSISTANT_ENTITIES.map((entity) => ({
    name: TOOL_NAMES[entity],
    description: `Route to the ${entity} dataset and extract its filters.`,
    input_schema: adapterFor(entity).filterSchema as AnthropicSdk.Tool['input_schema'],
  }));
}

export function createModelClassifier(): ModelClassifier {
  return async function classifyWithModel(message) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      const response = await client.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: buildSystemPrompt(),
          tools: buildTools(),
          tool_choice: { type: 'any' },
          messages: [{ role: 'user', content: message }],
        },
        { signal: controller.signal }
      );

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const entity = ENTITY_BY_TOOL[block.name];
        if (!entity) continue;
        return { entity, filters: (block.input ?? {}) as Record<string, unknown> };
      }

      // Model answered without calling a tool — treat as unclassified.
      return null;
    } catch {
      // Any failure (network, abort, rate limit, malformed response) degrades
      // to the deterministic classifier rather than surfacing an error.
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
}

export { classify } from './classify';
export { resolveRoute } from './confidence';
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `lib/assistant/route.ts`.

If `tool_choice: { type: 'any' }` is rejected by the installed SDK version, check the version with `node -p "require('@anthropic-ai/sdk/package.json').version"` and use the shape that version accepts — do not drop `tool_choice`, since without it the model may answer in prose and every request would degrade.

- [ ] **Step 3: Commit**

```bash
git add lib/assistant/route.ts
git commit -m "feat(assistant): add the Claude tool-call entity classifier"
```

---

### Task 10: Rate limiting

**Files:**
- Create: `lib/assistant/rate-limit.ts`

**Interfaces:**
- Produces: `consumeRateLimit(key: string, now?: number): { allowed: boolean; retryAfterSeconds: number }`, `resetAssistantRateLimiter(): void`

Extracted from `lib/people/chat-stream.ts` lines 46–72. **Do not modify `chat-stream.ts`** — `/api/people/chat` must keep working with its own bucket. Duplicating ~25 lines is the correct trade here: sharing state between the old and new endpoints would silently halve each one's budget.

- [ ] **Step 1: Create the module**

```ts
// lib/assistant/rate-limit.ts

/**
 * In-memory per-IP token bucket. Process-local by design — no dependency.
 *
 * Deliberately separate from the bucket in lib/people/chat-stream.ts: sharing
 * one would make /api/people/chat and /api/assistant/chat consume each other's
 * budget.
 */
const BUCKET_CAPACITY = 20;
const REFILL_PER_SECOND = 0.5;

type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();

export function consumeRateLimit(
  key: string,
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  const bucket = buckets.get(key) ?? { tokens: BUCKET_CAPACITY, updatedAt: now };
  const elapsedSeconds = Math.max(0, (now - bucket.updatedAt) / 1000);
  const tokens = Math.min(BUCKET_CAPACITY, bucket.tokens + elapsedSeconds * REFILL_PER_SECOND);

  if (tokens < 1) {
    buckets.set(key, { tokens, updatedAt: now });
    return { allowed: false, retryAfterSeconds: Math.ceil((1 - tokens) / REFILL_PER_SECOND) };
  }

  buckets.set(key, { tokens: tokens - 1, updatedAt: now });
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetAssistantRateLimiter(): void {
  buckets.clear();
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `lib/assistant/rate-limit.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/assistant/rate-limit.ts
git commit -m "feat(assistant): add the assistant rate limiter"
```

---

### Task 11: The NDJSON stream

**Files:**
- Create: `lib/assistant/stream.ts`
- Test: `tests/integration/assistant-stream.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–10
- Produces:
  - `createAssistantStream(input: AssistantStreamInput): ReadableStream<Uint8Array>`
  - `createAssistantErrorStream(code: string, message: string): ReadableStream<Uint8Array>`
  - `type AnswerGenerator = (input: { question: string; entity: AssistantEntity; prose: string; rows: readonly unknown[]; total: number | null }) => AsyncIterable<string>`
  - `AssistantStreamInput = { message: string; currentPage: AssistantEntity; activeFilters?: Record<string, unknown>; previousEntity?: AssistantEntity | null; page?: number; classifyWithModel?: ModelClassifier; generateAnswer?: AnswerGenerator }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/assistant-stream.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAssistantStream } from '@/lib/assistant/stream';
import { adapterFor, resetAdapters, setAdapterForTests } from '@/lib/assistant/registry';
import type { AssistantEvent } from '@/lib/assistant/types';

async function read(stream: ReadableStream<Uint8Array>): Promise<AssistantEvent[]> {
  const text = await new Response(stream).text();
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as AssistantEvent);
}

function routeEvent(events: AssistantEvent[]) {
  const first = events[0];
  if (first.type !== 'route') throw new Error('expected a route event first');
  return first;
}

afterEach(() => {
  resetAdapters();
  vi.restoreAllMocks();
});

describe('createAssistantStream — ordering', () => {
  it('emits route first, then filters, results, tokens, done', async () => {
    const events = await read(
      createAssistantStream({
        message: 'verified marketing managers in Germany',
        currentPage: 'people',
        classifyWithModel: async () => ({ entity: 'people', filters: {} }),
      })
    );
    const types = events.map((e) => e.type);

    expect(types[0]).toBe('route');
    expect(types).toContain('filters');
    expect(types).toContain('results');
    expect(types).toContain('token');
    expect(types[types.length - 1]).toBe('done');
    expect(types.indexOf('results')).toBeLessThan(types.indexOf('token'));
  });
});

describe('createAssistantStream — navigate', () => {
  it('never emits results for a cross-entity question', async () => {
    const events = await read(
      createAssistantStream({
        message: 'what conferences are in Berlin next month',
        currentPage: 'companies',
        classifyWithModel: async () => ({ entity: 'events', filters: { city: 'Berlin' } }),
      })
    );

    expect(routeEvent(events).action).toBe('navigate');
    expect(routeEvent(events).targetEntity).toBe('events');
    expect(events.map((e) => e.type)).not.toContain('results');
  });

  it('emits a handoff message as prose', async () => {
    const events = await read(
      createAssistantStream({
        message: 'what conferences are in Berlin',
        currentPage: 'people',
        classifyWithModel: async () => ({ entity: 'events', filters: {} }),
      })
    );
    const prose = events
      .filter((e): e is Extract<AssistantEvent, { type: 'token' }> => e.type === 'token')
      .map((e) => e.text)
      .join('');
    expect(prose.toLowerCase()).toContain('events');
  });

  it('carries the source page filters onto the target entity', async () => {
    const events = await read(
      createAssistantStream({
        message: 'what events are happening there',
        currentPage: 'companies',
        activeFilters: { country: 'Germany' },
        classifyWithModel: async () => ({ entity: 'events', filters: {} }),
      })
    );
    expect(routeEvent(events).interpretedFilters).toMatchObject({ country: 'Germany' });
  });
});

describe('createAssistantStream — confirm', () => {
  it('never calls search when the classifiers disagree', async () => {
    const real = adapterFor('companies');
    const search = vi.fn(real.search);
    setAdapterForTests('companies', { ...real, search } as never);

    const events = await read(
      createAssistantStream({
        message: 'trade shows in London',
        currentPage: 'people',
        // Deterministic says events; the model says companies.
        classifyWithModel: async () => ({ entity: 'companies', filters: {} }),
      })
    );

    expect(routeEvent(events).action).toBe('confirm');
    expect(search).not.toHaveBeenCalled();
    expect(events.map((e) => e.type)).toContain('suggestions');
    expect(events.map((e) => e.type)).not.toContain('results');
  });
});

describe('createAssistantStream — degradation', () => {
  it('marks no_tool_call and still answers when the model classifies nothing', async () => {
    const events = await read(
      createAssistantStream({
        message: 'people in Germany',
        currentPage: 'people',
        classifyWithModel: async () => null,
      })
    );
    expect(routeEvent(events).degraded).toBe('no_tool_call');
    expect(events.map((e) => e.type)).toContain('token');
    expect(events[events.length - 1].type).toBe('done');
  });

  it('survives a classifier that throws', async () => {
    const events = await read(
      createAssistantStream({
        message: 'people in Germany',
        currentPage: 'people',
        classifyWithModel: async () => {
          throw new Error('network down');
        },
      })
    );
    expect(routeEvent(events).degraded).toBe('model_error');
    expect(events[events.length - 1].type).toBe('done');
  });

  it('completes the answer from the template when the generator dies mid-prose', async () => {
    const events = await read(
      createAssistantStream({
        message: 'people in Germany',
        currentPage: 'people',
        classifyWithModel: async () => ({ entity: 'people', filters: {} }),
        // eslint-disable-next-line require-yield
        generateAnswer: async function* () {
          yield 'Partial';
          throw new Error('model died');
        },
      })
    );
    const prose = events
      .filter((e): e is Extract<AssistantEvent, { type: 'token' }> => e.type === 'token')
      .map((e) => e.text)
      .join('');
    expect(prose).toContain('Partial');
    expect(prose.length).toBeGreaterThan('Partial'.length);
    expect(events[events.length - 1].type).toBe('done');
  });

  it('emits an error event when the adapter search throws', async () => {
    const real = adapterFor('people');
    setAdapterForTests('people', {
      ...real,
      search: async () => {
        throw new Error('boom');
      },
    } as never);

    const events = await read(
      createAssistantStream({
        message: 'people in Germany',
        currentPage: 'people',
        classifyWithModel: async () => ({ entity: 'people', filters: {} }),
      })
    );
    const error = events.find((e) => e.type === 'error');
    expect(error).toBeDefined();
    if (error?.type !== 'error') throw new Error('expected error event');
    expect(error.code).toBe('search_failed');
    expect(error.message).toContain('people');
  });
});

describe('createAssistantStream — inline', () => {
  it('reports a null total for companies without saying zero', async () => {
    const events = await read(
      createAssistantStream({
        message: 'SaaS companies in Germany',
        currentPage: 'companies',
        classifyWithModel: async () => ({ entity: 'companies', filters: { category: 'SaaS' } }),
      })
    );
    const results = events.find((e) => e.type === 'results');
    if (results?.type !== 'results') throw new Error('expected results event');
    expect(results.total).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-stream.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/stream"`

- [ ] **Step 3: Implement the stream**

```ts
// lib/assistant/stream.ts
import { translateFilters } from './carry-over';
import { classify } from './classify';
import { resolveRoute } from './confidence';
import { adapterFor } from './registry';
import { isConfigured, type ModelClassifier } from './route';
import type { AssistantEntity, AssistantEvent, DegradedReason, RouteDecision } from './types';

export type AnswerGenerator = (input: {
  question: string;
  entity: AssistantEntity;
  /** The adapter's templated prose — the model's factual floor. */
  prose: string;
  rows: readonly unknown[];
  total: number | null;
}) => AsyncIterable<string>;

export type AssistantStreamInput = {
  message: string;
  currentPage: AssistantEntity;
  activeFilters?: Record<string, unknown>;
  previousEntity?: AssistantEntity | null;
  page?: number;
  classifyWithModel?: ModelClassifier;
  generateAnswer?: AnswerGenerator;
};

const ENTITY_LABEL: Record<AssistantEntity, string> = {
  companies: 'Companies',
  events: 'Events',
  people: 'People',
};

function line(event: AssistantEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/** Word-at-a-time so the client's typing animation matches the model path. */
async function* chunked(text: string): AsyncIterable<string> {
  for (const chunk of text.match(/\S+\s*/g) ?? [text]) yield chunk;
}

function handoffLine(target: AssistantEntity, action: RouteDecision['action']): string {
  if (action === 'navigate') {
    return `That's a question about ${target} — opening ${ENTITY_LABEL[target]} with your search applied.`;
  }
  if (action === 'confirm') {
    return `I'm not sure whether you mean ${ENTITY_LABEL[target].toLowerCase()} or something on another page. Which did you want?`;
  }
  return '';
}

export function createAssistantStream(
  input: AssistantStreamInput
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const page = input.page && input.page > 0 ? input.page : 1;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AssistantEvent) => controller.enqueue(encoder.encode(line(event)));

      try {
        // 1. Classify. The deterministic pass always runs; the model pass may
        //    fail, and its failure is information rather than an error.
        const deterministic = classify(input.message);

        let modelEntity: AssistantEntity | null = null;
        let modelFilters: Record<string, unknown> = {};
        let degraded: DegradedReason | undefined;

        if (!isConfigured() && !input.classifyWithModel) {
          degraded = 'missing_api_key';
        } else {
          try {
            const result = await (input.classifyWithModel ?? (async () => null))(input.message);
            if (result) {
              modelEntity = result.entity;
              modelFilters = result.filters;
            } else {
              degraded = isConfigured() || input.classifyWithModel
                ? 'no_tool_call'
                : 'missing_api_key';
            }
          } catch {
            degraded = 'model_error';
          }
        }

        const decision = resolveRoute({
          modelEntity,
          deterministic,
          currentPage: input.currentPage,
          previousEntity: input.previousEntity ?? null,
          hasApiKey: isConfigured() || Boolean(input.classifyWithModel),
        });

        const target = decision.targetEntity;
        const adapter = adapterFor(target);

        // 2. Build filters: carried-over context, then the model's extraction,
        //    then the local parse as the floor.
        const carried = translateFilters({
          from: input.currentPage,
          to: target,
          filters: input.activeFilters ?? {},
        });

        const base = {
          ...(adapter.emptyFilters() as Record<string, unknown>),
          ...carried.filters,
        };

        const filters = modelEntity === target && Object.keys(modelFilters).length > 0
          ? { ...base, ...Object.fromEntries(Object.entries(modelFilters).filter(([, v]) => v != null)) }
          : (adapter.parseLocally(input.message, base as never) as Record<string, unknown>);

        // 3. The route verdict — ALWAYS the first event, always before any
        //    search runs, because the client must know whether to stay here.
        send({
          type: 'route',
          targetEntity: target,
          action: decision.action,
          confidence: decision.confidence,
          handoffMessage: handoffLine(target, decision.action),
          interpretedFilters: filters,
          droppedFilters: carried.dropped,
          crossReference: null,
          ...(degraded ? { degraded } : {}),
        });

        // 4a. Ambiguous — ask, and do not spend a query on a guess.
        if (decision.action === 'confirm') {
          for await (const chunk of chunked(handoffLine(target, 'confirm'))) {
            send({ type: 'token', text: chunk });
          }
          send({
            type: 'suggestions',
            items: [
              `Search ${ENTITY_LABEL[target]}`,
              `Search ${ENTITY_LABEL[input.currentPage]}`,
            ],
          });
          send({ type: 'done' });
          return;
        }

        // 4b. Wrong page — hand off. No results event, ever: returning rows
        //     here is exactly the wrong-entity answer this system prevents.
        if (decision.action === 'navigate') {
          for await (const chunk of chunked(handoffLine(target, 'navigate'))) {
            send({ type: 'token', text: chunk });
          }
          send({ type: 'done' });
          return;
        }

        // 4c. Right page — answer inline.
        send({ type: 'filters', chips: adapter.chips(filters as never) });

        let rows: readonly unknown[];
        let total: number | null;
        try {
          const result = await adapter.search(filters as never, page);
          rows = result.rows;
          total = result.total;
        } catch (error) {
          send({
            type: 'error',
            code: 'search_failed',
            message: `Could not search ${target}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          });
          send({ type: 'done' });
          return;
        }

        send({ type: 'results', rows: [...rows], total });

        const prose = adapter.describe(filters as never, total);
        const answerInput = { question: input.message, entity: target, prose, rows, total };

        let emittedAnything = false;
        let recovered = false;
        try {
          const generate = input.generateAnswer ?? (async function* () {
            yield* chunked(prose);
          });
          for await (const chunk of generate(answerInput)) {
            if (!chunk) continue;
            emittedAnything = true;
            send({ type: 'token', text: chunk });
          }
        } catch {
          // Complete the partial answer from the template. The user must see an
          // answer, not a stack trace.
          if (emittedAnything) send({ type: 'token', text: ' ' });
          for await (const chunk of chunked(prose)) send({ type: 'token', text: chunk });
          recovered = true;
        }

        // A generator that completed without yielding still owes an answer.
        if (!emittedAnything && !recovered) {
          for await (const chunk of chunked(prose)) send({ type: 'token', text: chunk });
        }

        send({ type: 'suggestions', items: adapter.suggest(filters as never, total) });
        send({ type: 'done' });
      } catch (error) {
        send({
          type: 'error',
          code: 'stream_failed',
          message: error instanceof Error ? error.message : 'Something went wrong.',
        });
      } finally {
        controller.close();
      }
    },
  });
}

/** A single-event stream, for refusals that still need the NDJSON shape. */
export function createAssistantErrorStream(
  code: string,
  message: string
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(line({ type: 'error', code, message })));
      controller.close();
    },
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/assistant-stream.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/assistant/stream.ts tests/integration/assistant-stream.test.ts
git commit -m "feat(assistant): assemble the routed NDJSON answer stream"
```

---

### Task 12: The endpoint

**Files:**
- Create: `app/api/assistant/chat/route.ts`
- Test: `tests/integration/assistant-route.test.ts`

**Interfaces:**
- Consumes: `createAssistantStream`, `createAssistantErrorStream` (Task 11); `consumeRateLimit`, `resetAssistantRateLimiter` (Task 10); `createModelClassifier` (Task 9); `BadRequestError` from `@/lib/http/errors`; `jsonError` from `@/lib/http/response`
- Produces: `POST(request: Request): Promise<Response>`

Request body: `{ message: string; currentPage: 'companies'|'events'|'people'; activeFilters?: object; previousEntity?: string|null; page?: number }`. Not tenant-scoped, matching `/api/companies` and `/api/people/chat`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/assistant-route.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/assistant/chat/route';
import { resetAssistantRateLimiter } from '@/lib/assistant/rate-limit';
import type { AssistantEvent } from '@/lib/assistant/types';

function post(body: unknown, ip = '10.0.0.1') {
  return new Request('http://localhost/api/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  }) as never;
}

async function read(stream: ReadableStream<Uint8Array> | null): Promise<AssistantEvent[]> {
  if (!stream) return [];
  const text = await new Response(stream).text();
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as AssistantEvent);
}

beforeEach(() => {
  resetAssistantRateLimiter();
});

describe('POST /api/assistant/chat', () => {
  it('streams NDJSON with a route event first', async () => {
    const response = await POST(post({ message: 'people in Germany', currentPage: 'people' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/x-ndjson');

    const events = await read(response.body);
    expect(events[0].type).toBe('route');
    expect(events[events.length - 1].type).toBe('done');
  });

  it('rejects a missing message', async () => {
    const response = await POST(post({ currentPage: 'people' }));
    expect(response.status).toBe(400);
  });

  it('rejects an unknown currentPage', async () => {
    const response = await POST(post({ message: 'hi', currentPage: 'invoices' }));
    expect(response.status).toBe(400);
  });

  it('defaults currentPage to companies when it is absent', async () => {
    const response = await POST(post({ message: 'hello' }));
    expect(response.status).toBe(200);
    const events = await read(response.body);
    const first = events[0];
    if (first.type !== 'route') throw new Error('expected route event');
    expect(first.targetEntity).toBe('companies');
  });

  it('delivers a rate-limit refusal as a stream event, not an HTTP error', async () => {
    let last: Response | null = null;
    for (let i = 0; i < 22; i += 1) {
      last = await POST(post({ message: 'people in Germany', currentPage: 'people' }, '10.9.9.9'));
    }
    expect(last?.status).toBe(200);

    const events = await read(last?.body ?? null);
    const error = events.find((e) => e.type === 'error');
    if (error?.type !== 'error') throw new Error('expected a rate_limited error event');
    expect(error.code).toBe('rate_limited');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-route.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/api/assistant/chat/route"`

- [ ] **Step 3: Implement the route**

```ts
// app/api/assistant/chat/route.ts
import { BadRequestError } from '@/lib/http/errors';
import { jsonError } from '@/lib/http/response';
import { consumeRateLimit } from '@/lib/assistant/rate-limit';
import { createModelClassifier } from '@/lib/assistant/route';
import { createAssistantErrorStream, createAssistantStream } from '@/lib/assistant/stream';
import { ASSISTANT_ENTITIES, type AssistantEntity } from '@/lib/assistant/types';

/**
 * The single assistant endpoint. Classifies the question into an entity before
 * answering, so a question typed on the wrong page hands off rather than being
 * answered from the wrong dataset.
 *
 * Not tenant-scoped, matching /api/companies and /api/people/chat — these are
 * shared discovery datasets, not workspace data.
 *
 * An assistant problem is never an HTTP error: a rate-limit refusal is still
 * delivered AS A STREAM EVENT so the client has exactly one code path.
 */

const NDJSON_HEADERS = {
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-store, no-transform',
};

type ChatBody = {
  message?: unknown;
  currentPage?: unknown;
  activeFilters?: unknown;
  previousEntity?: unknown;
  page?: unknown;
};

function isEntity(value: unknown): value is AssistantEntity {
  return typeof value === 'string' && ASSISTANT_ENTITIES.includes(value as AssistantEntity);
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ChatBody;

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) throw new BadRequestError('message is required');

    if (body.currentPage !== undefined && !isEntity(body.currentPage)) {
      throw new BadRequestError('currentPage must be one of companies, events, people');
    }
    const currentPage: AssistantEntity = isEntity(body.currentPage) ? body.currentPage : 'companies';

    const activeFilters =
      body.activeFilters && typeof body.activeFilters === 'object'
        ? (body.activeFilters as Record<string, unknown>)
        : undefined;

    const previousEntity = isEntity(body.previousEntity) ? body.previousEntity : null;
    const page = Number.isInteger(body.page) ? (body.page as number) : 1;

    const limit = consumeRateLimit(clientKey(request));
    if (!limit.allowed) {
      return new Response(
        createAssistantErrorStream(
          'rate_limited',
          `Too many questions at once. Try again in ${limit.retryAfterSeconds}s.`
        ),
        { status: 200, headers: NDJSON_HEADERS }
      );
    }

    return new Response(
      createAssistantStream({
        message,
        currentPage,
        activeFilters,
        previousEntity,
        page,
        classifyWithModel: createModelClassifier(),
      }),
      { status: 200, headers: NDJSON_HEADERS }
    );
  } catch (error) {
    return jsonError(error);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/assistant-route.test.ts`
Expected: PASS, 5 tests.

If the 400 cases return 500 instead, confirm `BadRequestError` is exported from `lib/http/errors.ts` and that `jsonError` maps it to 400 — `CLAUDE.md` warns that plain `Error("Unauthorized")` maps to 500, so use the typed errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/assistant/chat/route.ts tests/integration/assistant-route.test.ts
git commit -m "feat(assistant): add POST /api/assistant/chat"
```

---

### Task 13: Full-suite verification and documentation

**Files:**
- Modify: `CLAUDE.md` (the Database section and the Architecture section)

- [ ] **Step 1: Run the entire test suite**

Run: `npx vitest run`
Expected: all tests pass. Specifically confirm these pre-existing files are still green, since this plan touched code they cover:
- `tests/integration/companies-filter-api.test.ts`
- `tests/integration/people-chat-route.test.ts`
- `tests/integration/companies-ask-route.test.ts`
- `tests/integration/event-search-route.test.ts`

Any failure in those four is a regression from Task 4 or Task 10. Fix the source, not the test.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no new errors in `lib/assistant/**`, `lib/companies/**`, or `app/api/assistant/**`.

Run: `npm run lint`
Expected: no new warnings in the files this plan created.

- [ ] **Step 3: Confirm the four legacy AI routes are untouched**

Run: `git diff --stat main -- app/api/ai app/api/companies/ask app/api/events/search app/api/people/chat`
Expected: **empty output.** Any diff means a constraint was violated.

- [ ] **Step 4: Correct the stale database note in CLAUDE.md**

In the **Database (important)** section, replace the bullet beginning "Company discovery dataset (~34.6M rows) → still SQLite" with:

```markdown
- **Company discovery dataset → PostgreSQL**, table `"DiscoveryCompany"`, queried with raw SQL through `lib/db/prisma.ts`. Query construction lives in `lib/companies/search.ts`; `app/api/companies/route.ts` is a thin caller. `total`/`totalPages` are deliberately `null` — counting per request is too slow, so the UI pages by cursor on `rowCursor`. The legacy SQLite client (`prisma/sqlite-companies.prisma`, `lib/db/sqlite-companies.ts`) and the 27 GB `prisma/dev.db` are no longer the live path; the `dev.db` present on a dev machine may be a 4 KB stub.
```

- [ ] **Step 5: Document the assistant router in CLAUDE.md**

Add to the **Architecture** section, after the `/api/companies` exception paragraph:

```markdown
**Assistant routing:** `POST /api/assistant/chat` classifies every question into `companies | events | people` before answering, then either answers inline or returns a navigation handoff. `lib/assistant/` holds the router; each entity is an `EntityAdapter` in `lib/assistant/adapters/` that owns its own filter type, search and prose — an adapter cannot return another entity's rows, which is what prevents wrong-entity answers. Signal words live once in `lib/assistant/signals.ts` and feed both the deterministic classifier and the model prompt. Confidence is computed from the two classifiers' agreement, never self-reported by the model. The older per-page AI routes (`/api/companies/ask`, `/api/ai/event-query`, `/api/ai/event-answer`, `/api/people/chat`) still work and still back the current UI; the panels move to the router in Spec 2.
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record the assistant router and correct the stale SQLite note"
```

---

## Done criteria

- `npx vitest run` is fully green, including the four pre-existing route test files.
- `git diff --stat main -- app/api/ai app/api/companies/ask app/api/events/search app/api/people/chat` is empty.
- `POST /api/assistant/chat` streams `route` first on every request.
- A cross-entity question emits no `results` event.
- A low-confidence question emits `action: 'confirm'` and calls no adapter's `search`.
- The whole suite runs with no `ANTHROPIC_API_KEY` and no Postgres instance.

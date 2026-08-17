# Assistant Shared Conversation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One assistant conversation that survives navigation between Companies, Events and People, with a visible reversible handoff — migrating People onto `/api/assistant/chat` as the first consumer.

**Architecture:** A context provider mounted inside `AppShell` (which persists across section navigation in the App Router) owns the conversation. All behaviour lives in pure modules — a reducer over NDJSON events, a session mirror, handoff resolution, and per-entity `PageBinding`s — because the repo has no way to test React components. The panel delegates row rendering to the binding for the current page.

**Tech Stack:** TypeScript, React 18, Next.js 14 App Router, Vitest (node environment).

**Spec:** `docs/superpowers/specs/2026-08-17-assistant-shared-conversation-design.md`

## Global Constraints

- **Do not add any dependency.** There is no jsdom, happy-dom, React Testing Library or Playwright, and `CLAUDE.md` forbids installing packages. React components are therefore **not** unit-tested; all logic must live in pure modules that are.
- **Zero network calls in the test suite.** No Postgres, no `ANTHROPIC_API_KEY`. Inject fakes.
- **Behaviour lives outside components.** If a component contains an `if` that decides product behaviour, it belongs in a pure module.
- **`forceEntity` must skip both classifiers.** This is what makes the navigate→navigate bounce structurally impossible; never replace it with a retry counter.
- **`action: 'navigate'` still emits no `results` event** — the Spec 1 guarantee the panel's row-rendering relies on.
- **`total` is `number | null`.** Companies is always `null`; the panel must render an absent count, never "0 results".
- **Do not modify** `app/api/companies/ask/route.ts`, `app/api/ai/event-query/route.ts`, `app/api/ai/event-answer/route.ts`, `app/api/events/search/route.ts`, or `app/api/people/chat/route.ts`. They keep working; Spec 2b deletes them.
- **Do not touch** `components/crm/companies-section.tsx` or `components/crm/events-section.tsx`. Spec 2b owns those.
- Run one-shot tests with `npx vitest run <path>`. Never `npm test` (watch mode).
- `components/crm/people-section.tsx` has **uncommitted changes from before this work**. Read it before editing and preserve them.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `components/assistant/types.ts` | `ConversationMessage`, `ConversationState`, `PendingHandoff`, `PageBinding` |
| `components/assistant/conversation-reducer.ts` | PURE: `(state, action) -> state` over NDJSON events |
| `components/assistant/session-mirror.ts` | PURE: serialize / restore a thread |
| `components/assistant/handoff.ts` | PURE: reads `pendingHandoff` → phase-two request body, go-back target |
| `components/assistant/stream-reader.ts` | PURE-ish: NDJSON line loop over a `Response` |
| `components/assistant/registry.ts` | `bindingFor(entity)` + test seam |
| `components/assistant/bindings/people.tsx` | The only binding in Spec 2a |
| `components/assistant/assistant-provider.tsx` | Context; owns state, runs phase two |
| `components/assistant/use-assistant-chat.ts` | Thin hook over provider + stream-reader |
| `components/assistant/assistant-panel.tsx` | Thread; delegates rows to a binding |
| `components/assistant/assistant-message.tsx` | One turn |
| `components/assistant/handoff-bar.tsx` | "Moved from Companies — go back" |

**Modify:**

| File | Change |
|---|---|
| `lib/assistant/stream.ts` | Accept `forceEntity` / `presetFilters`; skip classification when present |
| `app/api/assistant/chat/route.ts` | Parse and forward the two new body fields |
| `components/app-shell/app-shell.tsx` | Mount `AssistantConversationProvider` |
| `components/crm/people-section.tsx` | Swap `usePeopleChat` → shared stack |

**Tests:** `tests/integration/assistant-{force-entity,reducer,session-mirror,handoff,bindings,stream-reader}.test.ts`

---

### Task 1: Server — `forceEntity` and `presetFilters`

**Files:**
- Modify: `lib/assistant/stream.ts`, `app/api/assistant/chat/route.ts`
- Test: `tests/integration/assistant-force-entity.test.ts`

**Interfaces:**
- Consumes: `createAssistantStream` (Spec 1), `AssistantEntity`, `AssistantEvent`
- Produces: `AssistantStreamInput` gains `forceEntity?: AssistantEntity` and `presetFilters?: Record<string, unknown>`

When `forceEntity` is present, **neither classifier runs** and `action` is always `'answer_inline'` with `confidence: 1`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/assistant-force-entity.test.ts
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

describe('createAssistantStream — forceEntity', () => {
  it('never calls the model classifier', async () => {
    const classify = vi.fn(async () => ({ entity: 'companies' as const, filters: {} }));

    await read(
      createAssistantStream({
        message: 'trade shows in Munich',
        currentPage: 'events',
        forceEntity: 'events',
        presetFilters: { city: 'Munich' },
        classifyWithModel: classify,
      })
    );

    expect(classify).not.toHaveBeenCalled();
  });

  it('answers inline for the forced entity at full confidence', async () => {
    const events = await read(
      createAssistantStream({
        message: 'trade shows in Munich',
        currentPage: 'events',
        forceEntity: 'events',
        presetFilters: { city: 'Munich' },
      })
    );

    const route = routeEvent(events);
    expect(route.targetEntity).toBe('events');
    expect(route.action).toBe('answer_inline');
    expect(route.confidence).toBe(1);
    expect(events.map((e) => e.type)).toContain('results');
  });

  it('uses the preset filters verbatim rather than re-parsing the message', async () => {
    const events = await read(
      createAssistantStream({
        message: 'anything at all',
        currentPage: 'events',
        forceEntity: 'events',
        presetFilters: { city: 'Munich', country: 'Germany' },
      })
    );

    expect(routeEvent(events).interpretedFilters).toMatchObject({
      city: 'Munich',
      country: 'Germany',
    });
  });

  it('cannot produce a second navigation — the bounce is structurally impossible', async () => {
    // The model would route away; forceEntity must win.
    const events = await read(
      createAssistantStream({
        message: 'trade shows in Munich',
        currentPage: 'events',
        forceEntity: 'events',
        presetFilters: {},
        classifyWithModel: async () => ({ entity: 'companies', filters: {} }),
      })
    );

    expect(routeEvent(events).action).toBe('answer_inline');
    expect(routeEvent(events).targetEntity).toBe('events');
  });

  it('reports no degraded reason — no model was consulted', async () => {
    const events = await read(
      createAssistantStream({
        message: 'anything',
        currentPage: 'events',
        forceEntity: 'events',
        presetFilters: {},
      })
    );
    expect(routeEvent(events).degraded).toBeUndefined();
  });

  it('surfaces a search failure for the forced entity', async () => {
    const real = adapterFor('events');
    setAdapterForTests('events', {
      ...real,
      search: async () => {
        throw new Error('boom');
      },
    } as never);

    const events = await read(
      createAssistantStream({
        message: 'anything',
        currentPage: 'events',
        forceEntity: 'events',
        presetFilters: {},
      })
    );
    const error = events.find((e) => e.type === 'error');
    if (error?.type !== 'error') throw new Error('expected error event');
    expect(error.code).toBe('search_failed');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-force-entity.test.ts`
Expected: FAIL — `forceEntity` is not a known property, and the classifier is called.

- [ ] **Step 3: Add the fields to `AssistantStreamInput`**

In `lib/assistant/stream.ts`, extend the input type:

```ts
export type AssistantStreamInput = {
  message: string;
  currentPage: AssistantEntity;
  activeFilters?: Record<string, unknown>;
  previousEntity?: AssistantEntity | null;
  page?: number;
  /**
   * Phase two of a navigation handoff: the entity was already decided, so both
   * classifiers are skipped. This is what makes a navigate -> navigate bounce
   * impossible rather than merely unlikely — do not replace it with a counter.
   */
  forceEntity?: AssistantEntity;
  /** Filters already extracted during phase one, used verbatim. */
  presetFilters?: Record<string, unknown>;
  classifyWithModel?: ModelClassifier;
  generateAnswer?: AnswerGenerator;
};
```

- [ ] **Step 4: Branch before classification**

Replace the classification block in `createAssistantStream`'s `start()` — everything from `const deterministic = classify(input.message);` down to and including the `const filters = ...` assignment — with:

```ts
        let decision: { targetEntity: AssistantEntity; action: RouteAction; confidence: number };
        let degraded: DegradedReason | undefined;
        let carried: { filters: Record<string, unknown>; dropped: string[] };
        let filters: Record<string, unknown>;

        if (input.forceEntity) {
          // Phase two of a handoff. No classifier runs at all.
          decision = {
            targetEntity: input.forceEntity,
            action: 'answer_inline',
            confidence: 1,
          };
          carried = { filters: {}, dropped: [] };
          const adapter = adapterFor(input.forceEntity);
          filters = {
            ...(adapter.emptyFilters() as Record<string, unknown>),
            ...(input.presetFilters ?? {}),
          };
        } else {
          const deterministic = classify(input.message);
          const injected = Boolean(input.classifyWithModel);
          const canUseModel = isConfigured() || injected;
          const classifyWithModel = input.classifyWithModel ?? createModelClassifier();

          let modelEntity: AssistantEntity | null = null;
          let modelFilters: Record<string, unknown> = {};

          if (!canUseModel) {
            degraded = 'missing_api_key';
          } else {
            try {
              const result = await classifyWithModel(input.message);
              if (result) {
                modelEntity = result.entity;
                modelFilters = result.filters;
              } else {
                degraded = 'no_tool_call';
              }
            } catch {
              degraded = 'model_error';
            }
          }

          decision = resolveRoute({
            modelEntity,
            deterministic,
            currentPage: input.currentPage,
            previousEntity: input.previousEntity ?? null,
            hasApiKey: canUseModel,
          });

          const adapter = adapterFor(decision.targetEntity);
          carried = translateFilters({
            from: input.currentPage,
            to: decision.targetEntity,
            filters: input.activeFilters ?? {},
          });

          const base = {
            ...(adapter.emptyFilters() as Record<string, unknown>),
            ...carried.filters,
          };

          const modelGaveFilters =
            modelEntity === decision.targetEntity &&
            Object.values(modelFilters).some((value) => value !== null && value !== undefined);

          filters = modelGaveFilters
            ? {
                ...base,
                ...Object.fromEntries(
                  Object.entries(modelFilters).filter(([, v]) => v !== null && v !== undefined)
                ),
              }
            : (adapter.parseLocally(input.message, base as never) as Record<string, unknown>);
        }

        const target = decision.targetEntity;
        const adapter = adapterFor(target);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/integration/assistant-force-entity.test.ts tests/integration/assistant-stream.test.ts`
Expected: PASS — 6 new tests, plus the 10 existing stream tests still green.

- [ ] **Step 6: Forward the fields from the route**

In `app/api/assistant/chat/route.ts`, add to `ChatBody`:

```ts
type ChatBody = {
  message?: unknown;
  currentPage?: unknown;
  activeFilters?: unknown;
  previousEntity?: unknown;
  page?: unknown;
  forceEntity?: unknown;
  presetFilters?: unknown;
};
```

and inside `POST`, after `previousEntity` is computed:

```ts
    if (body.forceEntity !== undefined && !isEntity(body.forceEntity)) {
      throw new BadRequestError('forceEntity must be one of companies, events, people');
    }
    const forceEntity = isEntity(body.forceEntity) ? body.forceEntity : undefined;

    const presetFilters =
      body.presetFilters && typeof body.presetFilters === 'object'
        ? (body.presetFilters as Record<string, unknown>)
        : undefined;
```

then pass them through:

```ts
      createAssistantStream({
        message,
        currentPage,
        activeFilters,
        previousEntity,
        page,
        forceEntity,
        presetFilters,
      }),
```

- [ ] **Step 7: Verify and commit**

Run: `npx vitest run tests/integration/assistant-route.test.ts tests/integration/assistant-force-entity.test.ts`
Expected: PASS.

```bash
git add lib/assistant/stream.ts app/api/assistant/chat/route.ts tests/integration/assistant-force-entity.test.ts
git commit -m "feat(assistant): skip classification when forceEntity is supplied

Phase two of a navigation handoff carries the decided entity and the
filters phase one extracted, so a navigate -> navigate bounce cannot be
expressed."
```

---

### Task 2: Conversation types and the pure reducer

**Files:**
- Create: `components/assistant/types.ts`, `components/assistant/conversation-reducer.ts`
- Test: `tests/integration/assistant-reducer.test.ts`

**Interfaces:**
- Consumes: `AssistantEntity`, `AssistantEvent`, `RouteAction`, `FilterChip` from `@/lib/assistant/types`
- Produces:
  - `ConversationMessage`, `PendingHandoff`, `ConversationState`, `PageBinding<F>`
  - `emptyConversation(): ConversationState`
  - `conversationReducer(state, action): ConversationState`
  - `type ConversationAction` — `{type:'send'; message; id; currentPage}` | `{type:'event'; id; event}` | `{type:'stream_ended'; id}` | `{type:'failed'; id; message}` | `{type:'clear_handoff'}` | `{type:'restore'; state}` | `{type:'reset'}`

`send` carries `currentPage` because the reducer has no router access: it is the only way a handoff can record which page the question was asked *from*, which "go back" depends on.

The **component** named `AssistantMessage` (Task 8) is distinct from the **type** `ConversationMessage` — do not name them the same thing.

- [ ] **Step 1: Create the types file**

```ts
// components/assistant/types.ts
import type { ReactNode } from 'react';
import type { AssistantEntity, FilterChip, RouteAction } from '@/lib/assistant/types';

export type ConversationMessage = {
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
  /** Null when counting is too expensive — companies always is. */
  total: number | null;
  suggestions: string[];
  isComplete: boolean;
  error: { code: string; message: string } | null;
};

export type PendingHandoff = {
  from: AssistantEntity;
  to: AssistantEntity;
  /** The SOURCE page's own filters, so "go back" restores what was there. */
  sourceFilters: unknown;
  /** Filters phase one extracted, replayed verbatim in phase two. */
  presetFilters: unknown;
  /** The question that triggered the handoff, re-sent in phase two. */
  message: string;
};

export type ConversationState = {
  messages: ConversationMessage[];
  isStreaming: boolean;
  error: string | null;
  previousEntity: AssistantEntity | null;
  pendingHandoff: PendingHandoff | null;
};

/** The client twin of Spec 1's EntityAdapter. */
export type PageBinding<F> = {
  entity: AssistantEntity;
  /** Where navigation sends the user, e.g. "/app/people". */
  route: string;
  emptyFilters(): F;
  /** Incoming keys replace conflicting ones; unrelated current filters survive. */
  applyFilters(current: F, incoming: Partial<F>): F;
  renderRows(rows: unknown[]): ReactNode;
};

export function emptyMessage(id: string, role: 'user' | 'assistant'): ConversationMessage {
  return {
    id,
    role,
    text: '',
    entity: null,
    action: null,
    confidence: null,
    filters: null,
    chips: [],
    droppedFilters: [],
    rows: [],
    total: null,
    suggestions: [],
    isComplete: role === 'user',
    error: null,
  };
}

export function emptyConversation(): ConversationState {
  return {
    messages: [],
    isStreaming: false,
    error: null,
    previousEntity: null,
    pendingHandoff: null,
  };
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/integration/assistant-reducer.test.ts
import { describe, expect, it } from 'vitest';
import { conversationReducer } from '@/components/assistant/conversation-reducer';
import { emptyConversation } from '@/components/assistant/types';
import type { ConversationState } from '@/components/assistant/types';
import type { AssistantEvent } from '@/lib/assistant/types';

const ASSISTANT_ID = 'a1';

function afterSend(message = 'people in Germany'): ConversationState {
  return conversationReducer(emptyConversation(), {
    type: 'send',
    message,
    id: ASSISTANT_ID,
    currentPage: 'people',
  });
}

function feed(state: ConversationState, events: AssistantEvent[]): ConversationState {
  return events.reduce(
    (acc, event) => conversationReducer(acc, { type: 'event', id: ASSISTANT_ID, event }),
    state
  );
}

const inlineRoute: AssistantEvent = {
  type: 'route',
  targetEntity: 'people',
  action: 'answer_inline',
  confidence: 0.95,
  handoffMessage: '',
  interpretedFilters: { countries: ['Germany'] },
  droppedFilters: [],
  crossReference: null,
};

describe('conversationReducer — send', () => {
  it('appends a completed user turn and a pending assistant turn', () => {
    const state = afterSend();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0].role).toBe('user');
    expect(state.messages[0].isComplete).toBe(true);
    expect(state.messages[1].role).toBe('assistant');
    expect(state.messages[1].isComplete).toBe(false);
    expect(state.isStreaming).toBe(true);
  });
});

describe('conversationReducer — inline answer', () => {
  it('builds a complete assistant turn from the full event sequence', () => {
    const state = feed(afterSend(), [
      inlineRoute,
      { type: 'filters', chips: [{ key: 'countries:Germany', label: 'Country', value: 'Germany' }] },
      { type: 'results', rows: [{ id: 'p1' }], total: 42 },
      { type: 'token', text: 'Found ' },
      { type: 'token', text: '42 contacts.' },
      { type: 'suggestions', items: ['Show me more'] },
      { type: 'done' },
    ]);

    const reply = state.messages[1];
    expect(reply.entity).toBe('people');
    expect(reply.action).toBe('answer_inline');
    expect(reply.chips).toHaveLength(1);
    expect(reply.rows).toHaveLength(1);
    expect(reply.total).toBe(42);
    expect(reply.text).toBe('Found 42 contacts.');
    expect(reply.suggestions).toEqual(['Show me more']);
    expect(reply.isComplete).toBe(true);
    expect(state.isStreaming).toBe(false);
    expect(state.previousEntity).toBe('people');
    expect(state.pendingHandoff).toBeNull();
  });

  it('preserves a null total rather than coercing it to zero', () => {
    const state = feed(afterSend(), [
      { ...inlineRoute, targetEntity: 'companies' },
      { type: 'results', rows: [{ id: 'c1' }], total: null },
      { type: 'done' },
    ]);
    expect(state.messages[1].total).toBeNull();
  });
});

describe('conversationReducer — navigate', () => {
  const navigateRoute: AssistantEvent = {
    type: 'route',
    targetEntity: 'events',
    action: 'navigate',
    confidence: 0.95,
    handoffMessage: "That's a question about events — opening Events.",
    interpretedFilters: { city: 'Berlin' },
    droppedFilters: ['verification'],
    crossReference: null,
  };

  it('records a pending handoff carrying the preset filters and the question', () => {
    const state = feed(afterSend('what conferences are in Berlin'), [
      navigateRoute,
      { type: 'token', text: "That's a question about events." },
      { type: 'done' },
    ]);

    expect(state.pendingHandoff).toEqual({
      from: 'people',
      to: 'events',
      sourceFilters: null,
      presetFilters: { city: 'Berlin' },
      message: 'what conferences are in Berlin',
    });
    expect(state.messages[1].droppedFilters).toEqual(['verification']);
  });

  it('carries no rows', () => {
    const state = feed(afterSend(), [navigateRoute, { type: 'done' }]);
    expect(state.messages[1].rows).toEqual([]);
  });
});

describe('conversationReducer — confirm', () => {
  it('offers suggestions and sets no handoff', () => {
    const state = feed(afterSend('companies and contacts'), [
      {
        type: 'route',
        targetEntity: 'companies',
        action: 'confirm',
        confidence: 0.45,
        handoffMessage: 'Which did you mean?',
        interpretedFilters: {},
        droppedFilters: [],
        crossReference: null,
      },
      { type: 'suggestions', items: ['Search Companies', 'Search People'] },
      { type: 'done' },
    ]);

    expect(state.messages[1].action).toBe('confirm');
    expect(state.messages[1].suggestions).toHaveLength(2);
    expect(state.pendingHandoff).toBeNull();
  });
});

describe('conversationReducer — failures', () => {
  it('marks the turn failed on an error event', () => {
    const state = feed(afterSend(), [
      { type: 'error', code: 'search_failed', message: 'Could not search people' },
    ]);
    expect(state.messages[1].error?.code).toBe('search_failed');
    expect(state.messages[1].isComplete).toBe(true);
    expect(state.error).toBe('Could not search people');
  });

  it('marks an unterminated stream interrupted, keeping the partial answer', () => {
    const partial = feed(afterSend(), [inlineRoute, { type: 'token', text: 'Partial' }]);
    const state = conversationReducer(partial, { type: 'stream_ended', id: ASSISTANT_ID });

    expect(state.messages[1].text).toBe('Partial');
    expect(state.messages[1].error?.code).toBe('interrupted');
    expect(state.isStreaming).toBe(false);
  });

  it('leaves a completed turn alone when the stream ends', () => {
    const done = feed(afterSend(), [inlineRoute, { type: 'done' }]);
    const state = conversationReducer(done, { type: 'stream_ended', id: ASSISTANT_ID });
    expect(state.messages[1].error).toBeNull();
  });

  it('records a request failure', () => {
    const state = conversationReducer(afterSend(), {
      type: 'failed',
      id: ASSISTANT_ID,
      message: 'Request failed (500)',
    });
    expect(state.messages[1].error?.code).toBe('request_failed');
    expect(state.isStreaming).toBe(false);
  });
});

describe('conversationReducer — housekeeping', () => {
  it('clears a pending handoff', () => {
    const withHandoff = feed(afterSend(), [
      {
        type: 'route',
        targetEntity: 'events',
        action: 'navigate',
        confidence: 0.9,
        handoffMessage: 'x',
        interpretedFilters: {},
        droppedFilters: [],
        crossReference: null,
      },
      { type: 'done' },
    ]);
    expect(conversationReducer(withHandoff, { type: 'clear_handoff' }).pendingHandoff).toBeNull();
  });

  it('restores a serialized state', () => {
    const source = feed(afterSend(), [inlineRoute, { type: 'done' }]);
    const restored = conversationReducer(emptyConversation(), {
      type: 'restore',
      state: source,
    });
    expect(restored.messages).toHaveLength(2);
    expect(restored.previousEntity).toBe('people');
  });

  it('resets to empty', () => {
    const source = feed(afterSend(), [inlineRoute, { type: 'done' }]);
    expect(conversationReducer(source, { type: 'reset' })).toEqual(emptyConversation());
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-reducer.test.ts`
Expected: FAIL — `Cannot find package '@/components/assistant/conversation-reducer'`

- [ ] **Step 4: Implement the reducer**

```ts
// components/assistant/conversation-reducer.ts
import type { AssistantEntity, AssistantEvent } from '@/lib/assistant/types';
import {
  emptyConversation,
  emptyMessage,
  type ConversationMessage,
  type ConversationState,
} from './types';

export type ConversationAction =
  | { type: 'send'; message: string; id: string; currentPage: AssistantEntity }
  | { type: 'event'; id: string; event: AssistantEvent }
  | { type: 'stream_ended'; id: string }
  | { type: 'failed'; id: string; message: string }
  | { type: 'clear_handoff' }
  | { type: 'restore'; state: ConversationState }
  | { type: 'reset' };

function patch(
  state: ConversationState,
  id: string,
  changes: Partial<ConversationMessage>
): ConversationState {
  return {
    ...state,
    messages: state.messages.map((message) =>
      message.id === id ? { ...message, ...changes } : message
    ),
  };
}

function find(state: ConversationState, id: string): ConversationMessage | undefined {
  return state.messages.find((message) => message.id === id);
}

/**
 * Folds NDJSON events into conversation state.
 *
 * Pure by design: the repo has no way to test React, so every decision the
 * panel appears to make actually happens here, where a node test can reach it.
 */
export function conversationReducer(
  state: ConversationState,
  action: ConversationAction
): ConversationState {
  switch (action.type) {
    case 'send': {
      // The user turn records the page it was asked from — the only place that
      // fact enters the reducer, and what "go back" later depends on.
      const user = {
        ...emptyMessage(`${action.id}-user`, 'user'),
        text: action.message,
        entity: action.currentPage,
      };
      const assistant = emptyMessage(action.id, 'assistant');
      return {
        ...state,
        messages: [...state.messages, user, assistant],
        isStreaming: true,
        error: null,
      };
    }

    case 'event': {
      const event = action.event;

      if (event.type === 'route') {
        const next = patch(state, action.id, {
          entity: event.targetEntity,
          action: event.action,
          confidence: event.confidence,
          filters: event.interpretedFilters,
          droppedFilters: event.droppedFilters,
        });

        // A navigate decision is the only thing that opens a handoff. The
        // question is carried too, because phase two re-sends it verbatim.
        if (event.action !== 'navigate') {
          return { ...next, previousEntity: event.targetEntity };
        }
        return {
          ...next,
          previousEntity: event.targetEntity,
          pendingHandoff: {
            from: sourcePageOf(state, action.id),
            to: event.targetEntity,
            sourceFilters: null,
            presetFilters: event.interpretedFilters,
            message: find(state, `${action.id}-user`)?.text ?? '',
          },
        };
      }

      if (event.type === 'filters') return patch(state, action.id, { chips: event.chips });

      if (event.type === 'results') {
        return patch(state, action.id, { rows: event.rows, total: event.total });
      }

      if (event.type === 'token') {
        const current = find(state, action.id);
        return patch(state, action.id, { text: (current?.text ?? '') + event.text });
      }

      if (event.type === 'suggestions') {
        return patch(state, action.id, { suggestions: event.items });
      }

      if (event.type === 'error') {
        return {
          ...patch(state, action.id, {
            error: { code: event.code, message: event.message },
            isComplete: true,
          }),
          isStreaming: false,
          error: event.message,
        };
      }

      // done
      return { ...patch(state, action.id, { isComplete: true }), isStreaming: false };
    }

    case 'stream_ended': {
      const message = find(state, action.id);
      if (!message || message.isComplete) return { ...state, isStreaming: false };
      // Keep whatever arrived and let the user retry, rather than discarding it.
      return {
        ...patch(state, action.id, {
          isComplete: true,
          error: { code: 'interrupted', message: 'Answer incomplete.' },
        }),
        isStreaming: false,
      };
    }

    case 'failed':
      return {
        ...patch(state, action.id, {
          isComplete: true,
          error: { code: 'request_failed', message: action.message },
        }),
        isStreaming: false,
        error: action.message,
      };

    case 'clear_handoff':
      return { ...state, pendingHandoff: null };

    case 'restore':
      return action.state;

    case 'reset':
      return emptyConversation();

    default:
      return state;
  }
}

/**
 * The page the question was asked from, recorded on the user turn at `send`.
 *
 * The reducer has no router access, so this is the only reliable source — and
 * it is what "go back" returns to. The fallbacks exist purely so the type is
 * total; in practice the user turn is always present.
 */
function sourcePageOf(state: ConversationState, id: string): AssistantEntity {
  const user = find(state, `${id}-user`);
  return user?.entity ?? state.previousEntity ?? 'people';
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/integration/assistant-reducer.test.ts`
Expected: PASS, 14 tests.

If the navigate test's `from` is wrong, check that the `send` action's `currentPage` reached the user turn's `entity` — that is the only path by which the source page enters the reducer.

- [ ] **Step 6: Commit**

```bash
git add components/assistant/types.ts components/assistant/conversation-reducer.ts tests/integration/assistant-reducer.test.ts
git commit -m "feat(assistant): add conversation types and the pure NDJSON reducer"
```

---

### Task 3: Session mirror

**Files:**
- Create: `components/assistant/session-mirror.ts`
- Test: `tests/integration/assistant-session-mirror.test.ts`

**Interfaces:**
- Consumes: `ConversationState`, `emptyConversation` (Task 2)
- Produces: `serializeConversation(state): string`, `restoreConversation(raw: string | null): ConversationState`, `SESSION_KEY: string`

Never throws. A corrupt or partial payload yields an empty conversation.

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/assistant-session-mirror.test.ts
import { describe, expect, it } from 'vitest';
import {
  restoreConversation,
  serializeConversation,
  SESSION_KEY,
} from '@/components/assistant/session-mirror';
import { conversationReducer } from '@/components/assistant/conversation-reducer';
import { emptyConversation } from '@/components/assistant/types';

function sampleState() {
  const sent = conversationReducer(emptyConversation(), {
    type: 'send',
    message: 'people in Germany',
    id: 'a1',
    currentPage: 'people',
  });
  return conversationReducer(sent, {
    type: 'event',
    id: 'a1',
    event: {
      type: 'route',
      targetEntity: 'people',
      action: 'answer_inline',
      confidence: 0.95,
      handoffMessage: '',
      interpretedFilters: { countries: ['Germany'] },
      droppedFilters: [],
      crossReference: null,
    },
  });
}

describe('session mirror', () => {
  it('exposes a namespaced storage key', () => {
    expect(SESSION_KEY).toMatch(/^pcx/);
  });

  it('round-trips a conversation', () => {
    const state = sampleState();
    const restored = restoreConversation(serializeConversation(state));
    expect(restored.messages).toHaveLength(2);
    expect(restored.messages[1].entity).toBe('people');
    expect(restored.previousEntity).toBe('people');
  });

  it('never restores a mid-flight streaming state', () => {
    const state = sampleState();
    expect(state.isStreaming).toBe(true);
    expect(restoreConversation(serializeConversation(state)).isStreaming).toBe(false);
  });

  it('drops a pending handoff — the navigation already happened or did not', () => {
    const state = { ...sampleState(), pendingHandoff: { from: 'people', to: 'events' } as never };
    expect(restoreConversation(serializeConversation(state)).pendingHandoff).toBeNull();
  });

  it('returns an empty conversation for null', () => {
    expect(restoreConversation(null)).toEqual(emptyConversation());
  });

  it('returns an empty conversation for corrupt JSON rather than throwing', () => {
    expect(() => restoreConversation('{not json')).not.toThrow();
    expect(restoreConversation('{not json')).toEqual(emptyConversation());
  });

  it('returns an empty conversation when messages is not an array', () => {
    expect(restoreConversation(JSON.stringify({ messages: 'nope' }))).toEqual(emptyConversation());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-session-mirror.test.ts`
Expected: FAIL — unresolved import.

- [ ] **Step 3: Implement it**

```ts
// components/assistant/session-mirror.ts
import { emptyConversation, type ConversationState } from './types';

/** sessionStorage, not localStorage: a refresh keeps the thread, a new tab does not. */
export const SESSION_KEY = 'pcx_assistant_conversation';

export function serializeConversation(state: ConversationState): string {
  return JSON.stringify({
    messages: state.messages,
    previousEntity: state.previousEntity,
  });
}

/**
 * Restores a thread, never throwing.
 *
 * `isStreaming` and `pendingHandoff` are deliberately NOT restored: the request
 * that was in flight is gone, and the navigation it implied either already
 * happened or never will. Restoring either would strand the UI.
 */
export function restoreConversation(raw: string | null): ConversationState {
  if (!raw) return emptyConversation();

  try {
    const parsed = JSON.parse(raw) as Partial<ConversationState>;
    if (!Array.isArray(parsed.messages)) return emptyConversation();

    return {
      ...emptyConversation(),
      messages: parsed.messages,
      previousEntity: parsed.previousEntity ?? null,
    };
  } catch {
    // Corrupt entry — start clean rather than breaking the panel, matching
    // components/search/query-store.ts.
    return emptyConversation();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/assistant-session-mirror.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add components/assistant/session-mirror.ts tests/integration/assistant-session-mirror.test.ts
git commit -m "feat(assistant): mirror the conversation to sessionStorage"
```

---

### Task 4: Handoff resolution — the bounce test

**Files:**
- Create: `components/assistant/handoff.ts`
- Test: `tests/integration/assistant-handoff.test.ts`

**Interfaces:**
- Consumes: `PendingHandoff`, `ConversationState` (Task 2); `AssistantEntity`
- Produces:
  - `type PhaseTwoRequest = { message: string; currentPage: AssistantEntity; forceEntity: AssistantEntity; presetFilters: unknown }`
  - `phaseTwoRequest(handoff: PendingHandoff): PhaseTwoRequest`
  - `goBackTarget(handoff: PendingHandoff): { entity: AssistantEntity; filters: unknown }`
  - `producedNavigation(state: ConversationState): boolean`

This task holds the executable proof that the infinite bounce cannot occur.

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/assistant-handoff.test.ts
import { describe, expect, it } from 'vitest';
import {
  goBackTarget,
  phaseTwoRequest,
  producedNavigation,
} from '@/components/assistant/handoff';
import { conversationReducer } from '@/components/assistant/conversation-reducer';
import { emptyConversation } from '@/components/assistant/types';
import type { PendingHandoff } from '@/components/assistant/types';
import type { AssistantEvent } from '@/lib/assistant/types';

const handoff: PendingHandoff = {
  from: 'companies',
  to: 'events',
  sourceFilters: { country: 'Germany', category: 'SaaS' },
  presetFilters: { city: 'Berlin' },
  message: 'what conferences are in Berlin',
};

describe('phaseTwoRequest', () => {
  it('targets the destination page', () => {
    expect(phaseTwoRequest(handoff).currentPage).toBe('events');
  });

  it('carries forceEntity so phase two cannot re-classify', () => {
    expect(phaseTwoRequest(handoff).forceEntity).toBe('events');
  });

  it('replays the extracted filters verbatim', () => {
    expect(phaseTwoRequest(handoff).presetFilters).toEqual({ city: 'Berlin' });
  });

  it('re-sends the original question', () => {
    expect(phaseTwoRequest(handoff).message).toBe('what conferences are in Berlin');
  });
});

describe('goBackTarget', () => {
  it('returns the source page and the filters it had before the jump', () => {
    expect(goBackTarget(handoff)).toEqual({
      entity: 'companies',
      filters: { country: 'Germany', category: 'SaaS' },
    });
  });
});

describe('the bounce is structurally impossible', () => {
  function reply(events: AssistantEvent[]) {
    const sent = conversationReducer(emptyConversation(), {
      type: 'send',
      message: 'what conferences are in Berlin',
      id: 'a1',
      currentPage: 'people',
    });
    return events.reduce(
      (acc, event) => conversationReducer(acc, { type: 'event', id: 'a1', event }),
      sent
    );
  }

  it('phase one navigate sets a handoff', () => {
    const state = reply([
      {
        type: 'route',
        targetEntity: 'events',
        action: 'navigate',
        confidence: 0.75,
        handoffMessage: 'opening Events',
        interpretedFilters: { city: 'Berlin' },
        droppedFilters: [],
        crossReference: null,
      },
      { type: 'done' },
    ]);
    expect(producedNavigation(state)).toBe(true);
  });

  it('a forceEntity reply can never produce a second navigation', () => {
    // The server guarantees action: "answer_inline" whenever forceEntity is
    // set (see tests/integration/assistant-force-entity.test.ts). Given that
    // reply shape, the reducer cannot open another handoff.
    const state = reply([
      {
        type: 'route',
        targetEntity: 'events',
        action: 'answer_inline',
        confidence: 1,
        handoffMessage: '',
        interpretedFilters: { city: 'Berlin' },
        droppedFilters: [],
        crossReference: null,
      },
      { type: 'results', rows: [{ slug: 'x' }], total: 1 },
      { type: 'done' },
    ]);

    expect(producedNavigation(state)).toBe(false);
    expect(state.pendingHandoff).toBeNull();
  });

  it('phase two always carries forceEntity, so it always gets that reply shape', () => {
    const request = phaseTwoRequest(handoff);
    expect(request.forceEntity).toBeDefined();
    expect(request.forceEntity).toBe(request.currentPage);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-handoff.test.ts`
Expected: FAIL — unresolved import.

- [ ] **Step 3: Implement it**

```ts
// components/assistant/handoff.ts
import type { AssistantEntity } from '@/lib/assistant/types';
import type { ConversationState, PendingHandoff } from './types';

export type PhaseTwoRequest = {
  message: string;
  currentPage: AssistantEntity;
  forceEntity: AssistantEntity;
  presetFilters: unknown;
};

/**
 * The follow-up request issued on arrival at the target page.
 *
 * `forceEntity` is what prevents an infinite bounce: without it the server
 * would classify the question again from the target page's perspective and
 * could route straight back. See the bounce test.
 */
export function phaseTwoRequest(handoff: PendingHandoff): PhaseTwoRequest {
  return {
    message: handoff.message,
    currentPage: handoff.to,
    forceEntity: handoff.to,
    presetFilters: handoff.presetFilters,
  };
}

/** Where "go back" returns to, with the filters that page had before the jump. */
export function goBackTarget(handoff: PendingHandoff): {
  entity: AssistantEntity;
  filters: unknown;
} {
  return { entity: handoff.from, filters: handoff.sourceFilters };
}

/** True when the latest turn asked the client to navigate. */
export function producedNavigation(state: ConversationState): boolean {
  return state.pendingHandoff !== null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/assistant-handoff.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add components/assistant/handoff.ts tests/integration/assistant-handoff.test.ts
git commit -m "feat(assistant): add handoff resolution and pin the bounce hazard"
```

---

### Task 5: The people binding and the registry

**Files:**
- Create: `components/assistant/bindings/people.tsx`, `components/assistant/registry.ts`
- Test: `tests/integration/assistant-bindings.test.ts`

**Interfaces:**
- Consumes: `PageBinding` (Task 2); `PeopleFilters`, `emptyPeopleFilters` from `@/types/people`; `PeopleResultsTable` from `@/components/people/people-results-table`
- Produces: `peopleBinding: PageBinding<PeopleFilters>`, `bindingFor(entity)`, `hasBinding(entity): boolean`, `setBindingForTests`, `resetBindings`

`hasBinding` is what lets the provider and the message renderer skip an entity that has no binding yet — without it, a navigate to Events in Spec 2a would throw.

`bindingFor` throws for entities with no binding yet (events, companies — Spec 2b). The provider must guard.

Existing shape being wrapped: `PeopleResultsTable` takes `{people, selectedIds, savedIds, isLoading?, skeletonRows?, emptyMessage?, onToggleSelect, onToggleSaved, onOpenPerson}`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/assistant-bindings.test.ts
import { describe, expect, it } from 'vitest';
import { peopleBinding } from '@/components/assistant/bindings/people';
import { bindingFor, resetBindings, setBindingForTests } from '@/components/assistant/registry';
import { emptyPeopleFilters } from '@/types/people';

describe('peopleBinding', () => {
  it('declares its entity and route', () => {
    expect(peopleBinding.entity).toBe('people');
    expect(peopleBinding.route).toBe('/app/people');
  });

  it('replaces a conflicting key and preserves unrelated filters', () => {
    const current = {
      ...emptyPeopleFilters(),
      countries: ['France'],
      industries: ['SaaS'],
      verification: 'verified' as const,
    };

    const next = peopleBinding.applyFilters(current, { countries: ['Germany'] });

    expect(next.countries).toEqual(['Germany']); // replaced, not merged
    expect(next.industries).toEqual(['SaaS']); // untouched
    expect(next.verification).toBe('verified'); // untouched
  });

  it('ignores keys the incoming set does not mention', () => {
    const current = { ...emptyPeopleFilters(), countries: ['France'] };
    expect(peopleBinding.applyFilters(current, {}).countries).toEqual(['France']);
  });

  it('accepts an explicit empty array as a real clear', () => {
    const current = { ...emptyPeopleFilters(), countries: ['France'] };
    expect(peopleBinding.applyFilters(current, { countries: [] }).countries).toEqual([]);
  });

  it('starts from the shared empty filter shape', () => {
    expect(peopleBinding.emptyFilters()).toEqual(emptyPeopleFilters());
  });
});

describe('registry', () => {
  it('returns the people binding', () => {
    expect(bindingFor('people').entity).toBe('people');
  });

  it('throws for an entity with no binding yet', () => {
    // events and companies land in Spec 2b.
    expect(() => bindingFor('events')).toThrow(/no binding/i);
  });

  it('supports a test seam', () => {
    setBindingForTests('events', { ...peopleBinding, entity: 'events' } as never);
    expect(bindingFor('events').entity).toBe('events');
    resetBindings();
    expect(() => bindingFor('events')).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-bindings.test.ts`
Expected: FAIL — unresolved imports.

- [ ] **Step 3: Implement the binding**

```tsx
// components/assistant/bindings/people.tsx
"use client";

import { PeopleResultsTable } from '@/components/people/people-results-table';
import { emptyPeopleFilters, type PeopleFilters, type Person } from '@/types/people';
import type { PageBinding } from '../types';

/**
 * Replace-the-conflicting-key semantics live here rather than in shared code
 * because the shapes differ per entity: people's filters are array-valued,
 * the events ask-path's are scalar. A generic merge would have to guess.
 */
export const peopleBinding: PageBinding<PeopleFilters> = {
  entity: 'people',
  route: '/app/people',

  emptyFilters: emptyPeopleFilters,

  applyFilters(current, incoming) {
    // Only keys actually present in `incoming` are replaced — an absent key
    // leaves the user's own filter alone, while an explicit [] clears it.
    return { ...current, ...incoming };
  },

  renderRows(rows) {
    return (
      <PeopleResultsTable
        people={rows as Person[]}
        selectedIds={new Set<string>()}
        savedIds={new Set<string>()}
        onToggleSelect={() => {}}
        onToggleSaved={() => {}}
        onOpenPerson={() => {}}
      />
    );
  },
};
```

- [ ] **Step 4: Implement the registry**

```ts
// components/assistant/registry.ts
import { peopleBinding } from './bindings/people';
import type { AssistantEntity } from '@/lib/assistant/types';
import type { PageBinding } from './types';

type AnyBinding = PageBinding<never>;

const defaults: Partial<Record<AssistantEntity, AnyBinding>> = {
  people: peopleBinding as unknown as AnyBinding,
  // events and companies land in Spec 2b.
};

const registry: Partial<Record<AssistantEntity, AnyBinding>> = { ...defaults };

export function bindingFor(entity: AssistantEntity): AnyBinding {
  const binding = registry[entity];
  if (!binding) {
    throw new Error(`no binding registered for "${entity}" (added in Spec 2b)`);
  }
  return binding;
}

export function hasBinding(entity: AssistantEntity): boolean {
  return Boolean(registry[entity]);
}

/** Test seam. */
export function setBindingForTests(entity: AssistantEntity, binding: AnyBinding): void {
  registry[entity] = binding;
}

export function resetBindings(): void {
  for (const key of Object.keys(registry) as AssistantEntity[]) {
    delete registry[key];
  }
  Object.assign(registry, defaults);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/integration/assistant-bindings.test.ts`
Expected: PASS, 8 tests.

The test file imports a `.tsx` module. Vitest's `include` is `tests/**/*.{test,spec}.{ts,tsx}` and esbuild handles JSX, so no config change is needed — but the binding must not be imported into a node test that then *renders* it. These tests only read `entity`, `route`, `emptyFilters` and `applyFilters`; `renderRows` is never called.

- [ ] **Step 6: Commit**

```bash
git add components/assistant/bindings/people.tsx components/assistant/registry.ts tests/integration/assistant-bindings.test.ts
git commit -m "feat(assistant): add the people page binding and the binding registry"
```

---

### Task 6: The NDJSON stream reader

**Files:**
- Create: `components/assistant/stream-reader.ts`
- Test: `tests/integration/assistant-stream-reader.test.ts`

**Interfaces:**
- Consumes: `AssistantEvent`
- Produces: `readAssistantStream(response: Response, onEvent: (event: AssistantEvent) => void): Promise<void>`

Extracted from the read loop in `components/people/use-people-chat.ts` so the buffering, malformed-frame and split-frame behaviour is reachable from a node test for the first time.

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/assistant-stream-reader.test.ts
import { describe, expect, it, vi } from 'vitest';
import { readAssistantStream } from '@/components/assistant/stream-reader';
import type { AssistantEvent } from '@/lib/assistant/types';

function responseOf(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream);
}

const doneLine = `${JSON.stringify({ type: 'done' })}\n`;

describe('readAssistantStream', () => {
  it('parses one event per line', async () => {
    const seen: AssistantEvent[] = [];
    await readAssistantStream(
      responseOf([`${JSON.stringify({ type: 'token', text: 'hi' })}\n`, doneLine]),
      (event) => seen.push(event)
    );
    expect(seen.map((e) => e.type)).toEqual(['token', 'done']);
  });

  it('reassembles an event split across chunk boundaries', async () => {
    const seen: AssistantEvent[] = [];
    await readAssistantStream(
      responseOf(['{"type":"tok', 'en","text":"split"}\n', doneLine]),
      (event) => seen.push(event)
    );
    const token = seen[0];
    if (token.type !== 'token') throw new Error('expected token');
    expect(token.text).toBe('split');
  });

  it('skips a malformed frame and keeps reading', async () => {
    const seen: AssistantEvent[] = [];
    await readAssistantStream(
      responseOf(['not json\n', `${JSON.stringify({ type: 'token', text: 'ok' })}\n`, doneLine]),
      (event) => seen.push(event)
    );
    expect(seen.map((e) => e.type)).toEqual(['token', 'done']);
  });

  it('ignores blank lines', async () => {
    const seen: AssistantEvent[] = [];
    await readAssistantStream(responseOf(['\n', '   \n', doneLine]), (event) => seen.push(event));
    expect(seen).toHaveLength(1);
  });

  it('emits a trailing event with no final newline', async () => {
    const seen: AssistantEvent[] = [];
    await readAssistantStream(
      responseOf([JSON.stringify({ type: 'done' })]),
      (event) => seen.push(event)
    );
    expect(seen.map((e) => e.type)).toEqual(['done']);
  });

  it('throws when the response has no body', async () => {
    await expect(readAssistantStream(new Response(null), vi.fn())).rejects.toThrow(/body/i);
  });

  it('throws on a non-2xx response', async () => {
    await expect(
      readAssistantStream(new Response('nope', { status: 500 }), vi.fn())
    ).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-stream-reader.test.ts`
Expected: FAIL — unresolved import.

- [ ] **Step 3: Implement it**

```ts
// components/assistant/stream-reader.ts
import type { AssistantEvent } from '@/lib/assistant/types';

/**
 * Reads an NDJSON response, invoking `onEvent` per frame.
 *
 * Extracted from components/people/use-people-chat.ts so the buffering and
 * malformed-frame behaviour is testable in node — inside the hook it was only
 * ever exercised by hand.
 */
export async function readAssistantStream(
  response: Response,
  onEvent: (event: AssistantEvent) => void
): Promise<void> {
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  if (!response.body) {
    throw new Error('Response has no body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const emit = (line: string) => {
    if (!line.trim()) return;
    try {
      onEvent(JSON.parse(line) as AssistantEvent);
    } catch {
      // Ignore a malformed frame rather than killing the read.
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    // Keep the trailing partial line buffered.
    buffer = lines.pop() ?? '';
    for (const line of lines) emit(line);
  }

  // A final frame with no trailing newline still counts.
  emit(buffer);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/assistant-stream-reader.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add components/assistant/stream-reader.ts tests/integration/assistant-stream-reader.test.ts
git commit -m "feat(assistant): extract the NDJSON read loop so it can be tested"
```

---

### Task 7: The provider and the hook

**Files:**
- Create: `components/assistant/assistant-provider.tsx`, `components/assistant/use-assistant-chat.ts`
- Modify: `components/app-shell/app-shell.tsx`

**Interfaces:**
- Consumes: Tasks 2–6
- Produces:
  - `AssistantConversationProvider({ children })`
  - `useAssistantConversation()` → `{ state, send, retry, stop, reset, clearHandoff }`
  - `useAssistantChat({ currentPage, activeFilters })` → the panel's API

No test: this is React wiring. Every decision it makes was already tested in Tasks 2–6. Verification is a typecheck plus Task 10's manual run.

- [ ] **Step 1: Create the provider**

```tsx
// components/assistant/assistant-provider.tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { conversationReducer, type ConversationAction } from './conversation-reducer';
import { phaseTwoRequest } from './handoff';
import { hasBinding, bindingFor } from './registry';
import { restoreConversation, serializeConversation, SESSION_KEY } from './session-mirror';
import { readAssistantStream } from './stream-reader';
import { emptyConversation, type ConversationState } from './types';
import type { AssistantEntity } from '@/lib/assistant/types';

const ENDPOINT = '/api/assistant/chat';

export type SendInput = {
  message: string;
  currentPage: AssistantEntity;
  activeFilters?: Record<string, unknown>;
  forceEntity?: AssistantEntity;
  presetFilters?: unknown;
};

type ContextValue = {
  state: ConversationState;
  send: (input: SendInput) => Promise<void>;
  retry: (currentPage: AssistantEntity) => Promise<void>;
  stop: () => void;
  reset: () => void;
  clearHandoff: () => void;
};

const AssistantContext = createContext<ContextValue | null>(null);

function newId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Owns the conversation for the whole app.
 *
 * Mounted inside AppShell, which persists across section navigation in the App
 * Router — that is what lets the thread survive a handoff with plain React
 * state rather than a storage round-trip.
 */
export function AssistantConversationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(conversationReducer, undefined, emptyConversation);
  const router = useRouter();
  const pathname = usePathname();

  const abortRef = useRef<AbortController | null>(null);
  const lastSendRef = useRef<SendInput | null>(null);
  const phaseTwoRef = useRef<string | null>(null);

  // Restore once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const restored = restoreConversation(window.sessionStorage.getItem(SESSION_KEY));
    if (restored.messages.length > 0) {
      dispatch({ type: 'restore', state: restored });
    }
  }, []);

  // Mirror on change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(SESSION_KEY, serializeConversation(state));
    } catch {
      // Storage full or blocked — the in-memory thread still works.
    }
  }, [state]);

  const run = useCallback(async (input: SendInput) => {
    const controller = new AbortController();
    abortRef.current = controller;
    lastSendRef.current = input;

    const id = newId();
    dispatch({ type: 'send', message: input.message, id, currentPage: input.currentPage });

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.message,
          currentPage: input.currentPage,
          activeFilters: input.activeFilters,
          previousEntity: state.previousEntity,
          forceEntity: input.forceEntity,
          presetFilters: input.presetFilters,
          page: 1,
        }),
        signal: controller.signal,
      });

      await readAssistantStream(response, (event) => {
        dispatch({ type: 'event', id, event } as ConversationAction);
      });

      dispatch({ type: 'stream_ended', id });
    } catch (caught) {
      if ((caught as Error).name === 'AbortError') {
        dispatch({ type: 'stream_ended', id });
      } else {
        const message = caught instanceof Error ? caught.message : 'Something went wrong.';
        dispatch({ type: 'failed', id, message });
      }
    } finally {
      abortRef.current = null;
    }
  }, [state.previousEntity]);

  // Navigate on a pending handoff, then issue phase two on arrival.
  useEffect(() => {
    const handoff = state.pendingHandoff;
    if (!handoff) return;
    if (!hasBinding(handoff.to)) return; // events/companies land in Spec 2b

    const target = bindingFor(handoff.to).route;

    if (pathname !== target) {
      router.push(target);
      return;
    }

    // Arrived. Issue phase two exactly once per handoff.
    const key = `${handoff.to}:${handoff.message}`;
    if (phaseTwoRef.current === key) return;
    phaseTwoRef.current = key;

    void run(phaseTwoRequest(handoff));
  }, [state.pendingHandoff, pathname, router, run]);

  const value = useMemo<ContextValue>(
    () => ({
      state,
      send: run,
      retry: async (currentPage) => {
        const last = lastSendRef.current;
        if (!last) return;
        await run({ ...last, currentPage });
      },
      stop: () => abortRef.current?.abort(),
      reset: () => {
        abortRef.current?.abort();
        phaseTwoRef.current = null;
        dispatch({ type: 'reset' });
      },
      clearHandoff: () => dispatch({ type: 'clear_handoff' }),
    }),
    [state, run]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistantConversation(): ContextValue {
  const value = useContext(AssistantContext);
  if (!value) {
    throw new Error('useAssistantConversation must be used inside AssistantConversationProvider');
  }
  return value;
}
```

- [ ] **Step 2: Create the hook**

```ts
// components/assistant/use-assistant-chat.ts
"use client";

import { useCallback } from 'react';
import { useAssistantConversation } from './assistant-provider';
import type { AssistantEntity } from '@/lib/assistant/types';

/**
 * The panel's view of the shared conversation, scoped to one page.
 *
 * Thin by design — everything it appears to decide is decided in
 * conversation-reducer.ts and handoff.ts, which are node-testable.
 */
export function useAssistantChat({
  currentPage,
  activeFilters,
}: {
  currentPage: AssistantEntity;
  activeFilters?: Record<string, unknown>;
}) {
  const { state, send, retry, stop, reset, clearHandoff } = useAssistantConversation();

  const sendMessage = useCallback(
    async (message: string) => {
      const question = message.trim();
      if (!question || state.isStreaming) return;
      await send({ message: question, currentPage, activeFilters });
    },
    [send, currentPage, activeFilters, state.isStreaming]
  );

  return {
    messages: state.messages,
    isStreaming: state.isStreaming,
    error: state.error,
    pendingHandoff: state.pendingHandoff,
    send: sendMessage,
    retry: useCallback(() => retry(currentPage), [retry, currentPage]),
    stop,
    reset,
    clearHandoff,
  };
}
```

- [ ] **Step 3: Mount the provider in AppShell**

In `components/app-shell/app-shell.tsx`, wrap the existing tree. The provider must sit **inside** `SidebarProvider` but **around** `{children}` — it has to enclose the page so navigation between sections keeps it mounted:

```tsx
"use client";

import { useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { SidebarProvider } from "./sidebar-context";
import { AssistantConversationProvider } from "@/components/assistant/assistant-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [openMobile, setOpenMobile] = useState(false);

  return (
    <SidebarProvider>
      {/* Lives here, not in a page: an App Router layout persists across
          navigation within its segment, so the conversation survives a
          handoff from Companies to Events without serialization. */}
      <AssistantConversationProvider>
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <AppSidebar open={openMobile} onClose={() => setOpenMobile(false)} />
          <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden transition-all duration-300">
            <AppTopbar onMenuClick={() => setOpenMobile(true)} />
            <main className="app-gradient flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
              {children}
            </main>
          </div>
        </div>
      </AssistantConversationProvider>
    </SidebarProvider>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `components/assistant/**` or `components/app-shell/**`.

- [ ] **Step 5: Commit**

```bash
git add components/assistant/assistant-provider.tsx components/assistant/use-assistant-chat.ts components/app-shell/app-shell.tsx
git commit -m "feat(assistant): add the conversation provider and mount it in AppShell"
```

---

### Task 8: Panel components

**Files:**
- Create: `components/assistant/assistant-message.tsx`, `components/assistant/handoff-bar.tsx`, `components/assistant/assistant-panel.tsx`

**Interfaces:**
- Consumes: `ConversationMessage`, `PendingHandoff` (Task 2); `bindingFor` (Task 5); `useAssistantChat` (Task 7); `AiSearchPanel`, `CompactSearchBar` from `@/components/search/ai-search-panel`
- Produces: `AssistantMessage`, `HandoffBar`, `AssistantPanel`

Presentational. Not tested — see the spec's stated coverage gap.

- [ ] **Step 1: Create the message component**

```tsx
// components/assistant/assistant-message.tsx
"use client";

import { cn } from '@/lib/utils';
import { bindingFor, hasBinding } from './registry';
import type { ConversationMessage } from './types';

/**
 * One turn.
 *
 * Rows are delegated to the binding for the turn's entity. That is always the
 * current page's entity, because a navigate turn carries no rows at all — the
 * Spec 1 stream guarantee is what makes this safe.
 */
export function AssistantMessage({
  message,
  onSuggestion,
  onRetry,
}: {
  message: ConversationMessage;
  onSuggestion: (text: string) => void;
  onRetry: () => void;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-2xl bg-[#1B6DFF] px-4 py-2 text-[13px] text-white">
          {message.text}
        </p>
      </div>
    );
  }

  const showRows = message.rows.length > 0 && message.entity && hasBinding(message.entity);

  return (
    <div className="space-y-3">
      {message.chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.chips.map((chip) => (
            <span
              key={chip.key}
              className="rounded-full border border-[#E2E8F0] px-2.5 py-1 text-[12px] text-[#475569] dark:border-[#22304A] dark:text-[#94A3B8]"
            >
              {chip.label}: {chip.value}
            </span>
          ))}
        </div>
      )}

      {message.droppedFilters.length > 0 && (
        <p className="text-[12px] text-[#94A3B8]">
          Dropped {message.droppedFilters.join(', ')} — no equivalent on this page.
        </p>
      )}

      {showRows && (
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] dark:border-[#22304A]">
          {bindingFor(message.entity!).renderRows(message.rows)}
          {/* total is null when counting is too slow — render an absent count,
              never "0 results". */}
          {typeof message.total === 'number' && (
            <p className="border-t border-[#E2E8F0] px-3 py-2 text-[12px] text-[#64748B] dark:border-[#22304A]">
              {message.total} match{message.total === 1 ? '' : 'es'}
            </p>
          )}
        </div>
      )}

      {message.text && (
        <p className={cn('text-[13px] leading-relaxed text-[#0F172A] dark:text-[#E2E8F0]')}>
          {message.text}
        </p>
      )}

      {message.error && (
        <div className="flex items-center gap-2 text-[12px] text-[#DC2626]">
          <span>{message.error.message}</span>
          <button type="button" onClick={onRetry} className="underline">
            Retry
          </button>
        </div>
      )}

      {message.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.suggestions.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onSuggestion(item)}
              className="rounded-full border border-[#E2E8F0] px-3 py-1 text-[12px] text-[#475569] hover:bg-[#F8FAFC] dark:border-[#22304A] dark:text-[#94A3B8] dark:hover:bg-[#111B2E]"
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the handoff bar**

```tsx
// components/assistant/handoff-bar.tsx
"use client";

import { ArrowLeft, X } from 'lucide-react';
import type { AssistantEntity } from '@/lib/assistant/types';

const LABEL: Record<AssistantEntity, string> = {
  companies: 'Companies',
  events: 'Events',
  people: 'People',
};

/**
 * Shown on the target page after an automatic navigation.
 *
 * A page changing under the user is disorienting even when the routing is
 * right, and at 0.75 confidence it will sometimes be wrong — so the jump is
 * always reversible in one click.
 */
export function HandoffBar({
  from,
  onBack,
  onDismiss,
}: {
  from: AssistantEntity;
  onBack: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-[12px] text-[#1E40AF] dark:border-[#1E3A5F] dark:bg-[#0F1D33] dark:text-[#93C5FD]">
      <span>Moved from {LABEL[from]} to answer your question.</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 underline">
          <ArrowLeft className="h-3 w-3" />
          Go back
        </button>
        <button type="button" onClick={onDismiss} aria-label="Dismiss">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the panel**

```tsx
// components/assistant/assistant-panel.tsx
"use client";

import { useEffect, useRef } from 'react';
import { AiSearchPanel, CompactSearchBar } from '@/components/search/ai-search-panel';
import { useAssistantChat } from './use-assistant-chat';
import { AssistantMessage } from './assistant-message';
import { HandoffBar } from './handoff-bar';
import type { AssistantEntity } from '@/lib/assistant/types';

/**
 * The shared assistant surface, mounted by each page in its own layout slot.
 *
 * Two states, matching the existing PeopleChatPanel: the AiSearchPanel hero
 * when the thread is empty, and a CompactSearchBar pinned above the thread
 * once it is not.
 */
export function AssistantPanel({
  currentPage,
  activeFilters,
  kindLabel,
  onGoBack,
}: {
  currentPage: AssistantEntity;
  activeFilters?: Record<string, unknown>;
  kindLabel: string;
  onGoBack: (entity: AssistantEntity, filters: unknown) => void;
}) {
  const chat = useAssistantChat({ currentPage, activeFilters });
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.messages.length, chat.isStreaming]);

  const handoff = chat.pendingHandoff;
  const showBar = handoff !== null && handoff.to === currentPage;

  if (chat.messages.length === 0) {
    return (
      <AiSearchPanel
        kind="people_query"
        kindLabel={kindLabel}
        onSubmit={chat.send}
        isLoading={chat.isStreaming}
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {showBar && handoff && (
        <HandoffBar
          from={handoff.from}
          onBack={() => {
            onGoBack(handoff.from, handoff.sourceFilters);
            chat.clearHandoff();
          }}
          onDismiss={chat.clearHandoff}
        />
      )}

      <CompactSearchBar onSubmit={chat.send} isLoading={chat.isStreaming} />

      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        {chat.messages.map((message) => (
          <AssistantMessage
            key={message.id}
            message={message}
            onSuggestion={chat.send}
            onRetry={chat.retry}
          />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `components/assistant/**`.

`AiSearchPanel` and `CompactSearchBar` prop names may differ from the guesses above. Read `components/search/ai-search-panel.tsx` and match the real signatures rather than changing that file — it is shared with the Companies and Events panels, which Spec 2a must not disturb.

- [ ] **Step 5: Commit**

```bash
git add components/assistant/assistant-message.tsx components/assistant/handoff-bar.tsx components/assistant/assistant-panel.tsx
git commit -m "feat(assistant): add the shared panel, turn renderer and handoff bar"
```

---

### Task 9: Migrate the People page

**Files:**
- Modify: `components/crm/people-section.tsx`

**Interfaces:**
- Consumes: `AssistantPanel` (Task 8), `peopleBinding` (Task 5)
- Removes: the `usePeopleChat` import and its `chat` object; the `PeopleChatPanel` usage

`components/people/use-people-chat.ts` and `components/people/people-chat-panel.tsx` are **left in place**, unreferenced, and deleted in Spec 2b alongside `/api/people/chat`. `PeopleResultsTable`, `PeopleMessage`, `PeopleBulkToolbar` and `PeopleDetailSlideover` all stay in use.

⚠️ **This file has uncommitted changes from before this work (430 insertions / 453 deletions).** Read it fully before editing and preserve them.

- [ ] **Step 1: Read the current file**

Run: `git diff --stat components/crm/people-section.tsx`
Then read `components/crm/people-section.tsx` in full. Note where `chat` is used and where the right-hand column is rendered.

- [ ] **Step 2: Replace the chat hook with the shared panel**

Remove:

```tsx
import { PeopleChatPanel } from "@/components/people/people-chat-panel";
import { usePeopleChat } from "@/components/people/use-people-chat";
...
const chat = usePeopleChat({ activeFilters: filters });
```

Add:

```tsx
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { peopleBinding } from "@/components/assistant/bindings/people";
```

Replace the `<PeopleChatPanel ... />` element with:

```tsx
<AssistantPanel
  currentPage="people"
  activeFilters={filters as unknown as Record<string, unknown>}
  kindLabel="People"
  onGoBack={(entity, sourceFilters) => {
    // Spec 2a only binds People, so a back-jump can only land here; the
    // events and companies routes arrive with their bindings in Spec 2b.
    if (entity === "people" && sourceFilters) {
      setFilters(peopleBinding.applyFilters(filters, sourceFilters as never));
    }
  }}
/>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `usePeopleChat` is still referenced anywhere in the file (a `chat.reset()` call in a tab handler, for example), remove those references too — the hook is going away in Spec 2b.

- [ ] **Step 4: Confirm nothing else imports the old panel**

Run: `npx vitest run` — expect no new failures.

Then confirm the old modules are now unreferenced by app code:

```bash
git grep -n "usePeopleChat\|PeopleChatPanel" -- components app | grep -v "components/people/"
```

Expected: **empty output** (the only remaining references are inside `components/people/` itself, which Spec 2b deletes).

- [ ] **Step 5: Commit**

```bash
git add components/crm/people-section.tsx
git commit -m "feat(people): move the People page onto the shared assistant panel"
```

---

### Task 10: Verification and documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the whole suite**

Run: `npx vitest run`
Expected: all tests pass except the known pre-existing `tests/e2e/auth.spec.ts` (a Playwright spec caught by vitest's `tests/**/*.spec.ts` glob; Playwright is not installed). Confirm the Spec 1 suites are still green:
- `tests/integration/assistant-stream.test.ts`
- `tests/integration/assistant-route.test.ts`
- `tests/integration/assistant-adapters.test.ts`
- `tests/integration/people-chat-route.test.ts`

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run lint`
Expected: no new warnings in `components/assistant/**`. One pre-existing error in `components/crm/companies-section.tsx:994` is expected and out of scope.

- [ ] **Step 3: Confirm the legacy routes are untouched**

```bash
git diff --stat main -- app/api/ai app/api/companies/ask app/api/events/search app/api/people/chat
```

Expected: **empty output.**

- [ ] **Step 4: Run the app and drive the handoff**

This is the only way to verify the parts no test can reach — that the provider survives navigation, the bar renders, and `router.push` fires.

```bash
npm run dev
```

Then, in the browser at `http://localhost:3000/app/people`:

1. Ask **"verified marketing managers in Germany"** → expect an inline answer with chips and a results table, no navigation.
2. Ask **"what trade shows are happening in Munich"** → expect the handoff line in the thread. Because the events binding lands in Spec 2b, the provider will **not** navigate (`hasBinding('events')` is false) — the thread should show the handoff message and stop cleanly, with no crash and no spinner left running.
3. Refresh the page → expect the thread to still be there (sessionStorage), with no streaming state.
4. Open a new tab → expect an empty thread.

Note in the commit message that the full cross-page navigation cannot be exercised until Spec 2b registers the second binding.

⚠️ The configured `ANTHROPIC_API_KEY` currently returns **HTTP 401**, so the model classifier fails and the deterministic classifier answers instead. That is the expected degraded path, not a bug in this work — check the dev server log for `[assistant] classifier failed` to confirm that is what you are seeing.

- [ ] **Step 5: Document the shared conversation in CLAUDE.md**

In the **Architecture** section, immediately after the existing "Assistant routing:" paragraph, add:

```markdown
**Assistant conversation (UI):** `components/assistant/` holds one conversation shared across Companies, Events and People. `AssistantConversationProvider` is mounted in `components/app-shell/app-shell.tsx` — an App Router layout persists across navigation within its segment, so the thread survives a page handoff with plain React state; `sessionStorage` only covers a refresh. All behaviour lives in pure, node-tested modules (`conversation-reducer.ts`, `handoff.ts`, `session-mirror.ts`, `stream-reader.ts`, `bindings/*`) because the repo has no jsdom, React Testing Library or Playwright — React components here are deliberately thin and untested. A cross-page question is two requests: phase one classifies and returns `action: 'navigate'` with no rows; phase two re-sends with `forceEntity` + `presetFilters`, which skips both classifiers so a navigate→navigate bounce cannot be expressed. Only the People binding exists so far; Events and Companies migrate in Spec 2b.
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record the shared assistant conversation layer"
```

---

## Done criteria

- `npx vitest run` green except the pre-existing `tests/e2e/auth.spec.ts`.
- `npx tsc --noEmit` clean.
- `git diff --stat main -- app/api/ai app/api/companies/ask app/api/events/search app/api/people/chat` empty.
- `forceEntity` provably skips both classifiers (spy asserts the model classifier is never called).
- A `forceEntity` reply can never produce a second `pendingHandoff`.
- The People page answers inline through `/api/assistant/chat`, and the thread survives a refresh.
- No new dependency in `package.json`.

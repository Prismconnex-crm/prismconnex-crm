# Entity-Aware AIChatPanel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the client honour the routing decisions the server already sends — a navigation the user sees coming, can cancel and can reverse — on top of filter state that survives navigation, browser back and refresh.

**Architecture:** Every decision lands in a pure module a node test can reach; the React files stay thin wrappers, because the repo has no jsdom, RTL or Playwright. Filter serialization belongs to each page's binding rather than to one shared codec, since Events already owns a shipped, readable URL scheme and a second representation of the same state would drift from it. Tasks 1–8 are the pure/data layer and change nothing a user can see; Tasks 9–13 wire them into React.

**Tech Stack:** TypeScript, Next.js 14 App Router, React 18, Vitest (node environment, `@/` alias = repo root), Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-18-assistant-entity-aware-panel-design.md` (Spec 3a). Phase 2 of `docs/superpowers/specs/2026-08-20-assistant-cross-entity-completion-design.md`.

## Global Constraints

- **No new npm dependency.** No jsdom, no React Testing Library, no Playwright.
- **Node/vitest only.** React components stay untested by design. If a decision needs a test, move the decision into a pure module — that is the whole reason those modules exist.
- **Companies stays on the legacy path.** `hasBinding('companies')` must remain `false` at the end of this plan, and must keep guarding the navigation effect. Do not register a companies binding; Spec 3b does that.
- **Do not delete any legacy route.** `/api/companies/ask` and `/api/events/search` both still have a caller until Spec 3b.
- **Do not rename the endpoint.** `POST /api/assistant/chat` and its NDJSON stream stay exactly as they are.
- **Handoff params are `ask`, `via`, `cid`.** Never `q`, `from` or `filters` — Events already owns `q` (free-text) and `from` (an ISO date) at `lib/events/filters.ts:62-80`. A colliding param does not throw; the page just goes quietly wrong, which is worse. Any future page-owned param must avoid these three names.
- **Spec discrepancy, already resolved:** the spec's "Changed modules" bullet for `handoff.ts` says `handoffUrl` builds "`q`, `filters`, `from` and `cid`". That is stale wording predating the namespacing decision in the same document. Follow `ask`/`via`/`cid`.
- **`parseFilters` must never throw.** The param is attacker-controllable — any user can edit the address bar — and a throw during render on the target page is an unhandled navigation failure, not a bad filter.
- **Never parse the URL in a render initializer.** Read it in an effect after mount. Parsing during render makes the server produce an unfiltered list and the client a filtered one — a hydration mismatch. See `components/events/event-list-view.tsx:55-60` and `components/auth/sign-in-form.tsx:46`.
- **`history.replaceState` for in-page filter edits; `router.push` for handoffs.** A handoff *is* a navigation and *should* be a history entry — that is what makes browser back work. A facet toggle is not, and must not become a back-button step.
- **Avoid `useSearchParams`.** In Next 14 it forces the reading subtree into a Suspense boundary.
- **Existing suite must stay green.** 500 tests, 48 files. Run sequentially: `npx vitest run --no-file-parallelism`.
- **Do not run `npm run build`.** CLAUDE.md forbids it unless explicitly asked — the C: drive has filled and frozen the machine before.
- **Beware `vi.resetModules()`.** Combined with a dynamic import it hands the module under test a *fresh copy* of any module holding process-local state, so writes and assertions hit different instances. `scroll-store.ts` in Task 2 is exactly that shape. Prefer static imports and the `setBindingForTests` / `resetBindings` seam, as the existing assistant tests do.

---

### Task 1: Filter params codec

**Files:**
- Create: `lib/assistant/filter-params.ts`
- Test: `tests/integration/assistant-filter-params.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MAX_FILTER_PARAM_LENGTH: 1500`
  - `encodeFilters(filters: unknown): string | null` — base64url, `null` when over the cap or unserializable
  - `decodeFilters<T>(param: string | null | undefined, fallback: T): T` — never throws

- [x] **Step 1: Write the failing test**

Create `tests/integration/assistant-filter-params.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import {
  decodeFilters,
  encodeFilters,
  MAX_FILTER_PARAM_LENGTH,
} from '@/lib/assistant/filter-params';

const FALLBACK = { titles: [], search: '' };

describe('encodeFilters', () => {
  it('round-trips an object through the param', () => {
    const filters = { titles: ['CEO', 'CTO'], countries: ['Germany'], search: 'fintech' };
    const encoded = encodeFilters(filters);
    expect(encoded).not.toBeNull();
    expect(decodeFilters(encoded, FALLBACK)).toEqual(filters);
  });

  it('emits only base64url characters', () => {
    // +, / and = are mangled or ambiguous in a query string. Padding is stripped.
    const encoded = encodeFilters({ search: 'a?b&c=d+e/f' });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('survives non-ASCII, which base64 of a raw JS string would corrupt', () => {
    const filters = { search: 'Köln Messe — 日本' };
    expect(decodeFilters(encodeFilters(filters), FALLBACK)).toEqual(filters);
  });

  it('round-trips empty filters', () => {
    expect(decodeFilters(encodeFilters(FALLBACK), { titles: ['x'], search: 'y' })).toEqual(FALLBACK);
  });

  it('returns null over the cap rather than writing a giant URL', () => {
    const huge = { keywords: Array.from({ length: 2000 }, (_, i) => `keyword-${i}`) };
    expect(encodeFilters(huge)).toBeNull();
  });

  it('accepts a payload just under the cap', () => {
    const encoded = encodeFilters({ search: 'x'.repeat(200) });
    expect(encoded).not.toBeNull();
    expect((encoded as string).length).toBeLessThanOrEqual(MAX_FILTER_PARAM_LENGTH);
  });

  it('returns null for something JSON cannot represent', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(encodeFilters(cyclic)).toBeNull();
  });
});

describe('decodeFilters', () => {
  it('falls back for an absent param', () => {
    expect(decodeFilters(null, FALLBACK)).toBe(FALLBACK);
    expect(decodeFilters(undefined, FALLBACK)).toBe(FALLBACK);
    expect(decodeFilters('', FALLBACK)).toBe(FALLBACK);
  });

  it('falls back for garbage rather than throwing', () => {
    // Anyone can edit the address bar; a throw here is an unhandled navigation
    // failure on the target page, not a bad filter.
    expect(decodeFilters('!!!not base64!!!', FALLBACK)).toBe(FALLBACK);
    expect(decodeFilters('%%%%', FALLBACK)).toBe(FALLBACK);
  });

  it('falls back for valid base64url that is not JSON', () => {
    expect(decodeFilters('aGVsbG8', FALLBACK)).toBe(FALLBACK);
  });

  it('falls back for JSON that is not an object', () => {
    // "7" and "null" both parse; neither is a filter set.
    expect(decodeFilters(encodeFilters(7), FALLBACK)).toBe(FALLBACK);
    expect(decodeFilters(encodeFilters(null), FALLBACK)).toBe(FALLBACK);
    expect(decodeFilters(encodeFilters([1, 2]), FALLBACK)).toBe(FALLBACK);
  });

  it('falls back for an oversize param it is handed anyway', () => {
    expect(decodeFilters('A'.repeat(MAX_FILTER_PARAM_LENGTH + 1), FALLBACK)).toBe(FALLBACK);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/assistant-filter-params.test.ts`
Expected: FAIL — `Cannot find package '@/lib/assistant/filter-params'`.

- [x] **Step 3: Write minimal implementation**

Create `lib/assistant/filter-params.ts`:

```typescript
/**
 * People's filter state as one URL param.
 *
 * Events serialises readably (`?country=Germany&category=Packaging`) because it
 * already had a shipped scheme worth keeping. People does not: PeopleFilters has
 * fifteen keys and eleven of them are arrays, and enumerating that as readable
 * params buys nothing on a page nobody hand-edits.
 *
 * base64url rather than base64: `+`, `/` and `=` are mangled or ambiguous in a
 * query string. Padding is stripped and restored on the way back.
 *
 * The URL is an enhancement to the transport, never the transport itself — over
 * the cap the param is omitted and the in-memory `presetFilters` carries the
 * handoff instead.
 */

export const MAX_FILTER_PARAM_LENGTH = 1500;

/** Rejects anything outside the base64url alphabet before atob sees it. */
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function toBase64Url(text: string): string {
  // TextEncoder first: btoa on a raw JS string throws for anything above U+00FF,
  // so "Köln" would fail and "日本" would corrupt.
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Null when the value will not serialise, or would make the URL too long. */
export function encodeFilters(filters: unknown): string | null {
  let json: string;
  try {
    json = JSON.stringify(filters);
  } catch {
    return null; // cyclic, BigInt, and friends
  }
  if (typeof json !== 'string') return null; // undefined, a function

  const encoded = toBase64Url(json);
  return encoded.length > MAX_FILTER_PARAM_LENGTH ? null : encoded;
}

/**
 * Never throws. Every failure — absent, oversize, wrong alphabet, bad JSON, or
 * JSON that is not a filter object — returns the caller's fallback.
 */
export function decodeFilters<T>(param: string | null | undefined, fallback: T): T {
  if (!param || param.length > MAX_FILTER_PARAM_LENGTH) return fallback;
  if (!BASE64URL.test(param)) return fallback;

  try {
    const parsed = JSON.parse(fromBase64Url(param)) as unknown;
    // Arrays and primitives parse cleanly but are not filter sets.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/assistant-filter-params.test.ts`
Expected: PASS — 14 tests.

- [x] **Step 5: Commit**

```bash
git add lib/assistant/filter-params.ts tests/integration/assistant-filter-params.test.ts
git commit -m "feat(assistant): base64url codec for People's filter param"
```

---

### Task 2: Scroll store

**Files:**
- Create: `components/assistant/scroll-store.ts`
- Test: `tests/integration/assistant-scroll-store.test.ts`

**Interfaces:**
- Consumes: `AssistantEntity` from `@/lib/assistant/types`.
- Produces:
  - `scrollKey(conversationId: string, entity: AssistantEntity): string`
  - `saveScroll(key: string, offset: number): void`
  - `readScroll(key: string): number` — `0` when unknown
  - `resetScrollsForTests(): void`

- [x] **Step 1: Write the failing test**

Create `tests/integration/assistant-scroll-store.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';

import {
  readScroll,
  resetScrollsForTests,
  saveScroll,
  scrollKey,
} from '@/components/assistant/scroll-store';

beforeEach(() => {
  resetScrollsForTests();
});

describe('scrollKey', () => {
  it('separates entities within one conversation', () => {
    expect(scrollKey('c1', 'people')).not.toBe(scrollKey('c1', 'events'));
  });

  it('separates conversations for one entity', () => {
    expect(scrollKey('c1', 'people')).not.toBe(scrollKey('c2', 'people'));
  });

  it('is stable for the same pair', () => {
    expect(scrollKey('c1', 'people')).toBe(scrollKey('c1', 'people'));
  });
});

describe('saveScroll / readScroll', () => {
  it('returns 0 for a key never written — a fresh thread starts at the top', () => {
    expect(readScroll(scrollKey('c1', 'people'))).toBe(0);
  });

  it('round-trips an offset', () => {
    saveScroll(scrollKey('c1', 'people'), 420);
    expect(readScroll(scrollKey('c1', 'people'))).toBe(420);
  });

  it('keeps entities from overwriting each other', () => {
    saveScroll(scrollKey('c1', 'people'), 100);
    saveScroll(scrollKey('c1', 'events'), 250);
    expect(readScroll(scrollKey('c1', 'people'))).toBe(100);
    expect(readScroll(scrollKey('c1', 'events'))).toBe(250);
  });

  it('keeps conversations from overwriting each other', () => {
    saveScroll(scrollKey('c1', 'people'), 100);
    saveScroll(scrollKey('c2', 'people'), 250);
    expect(readScroll(scrollKey('c1', 'people'))).toBe(100);
    expect(readScroll(scrollKey('c2', 'people'))).toBe(250);
  });

  it('overwrites on the same key', () => {
    saveScroll(scrollKey('c1', 'people'), 100);
    saveScroll(scrollKey('c1', 'people'), 300);
    expect(readScroll(scrollKey('c1', 'people'))).toBe(300);
  });

  it('ignores a non-finite offset rather than poisoning the key', () => {
    saveScroll(scrollKey('c1', 'people'), 100);
    saveScroll(scrollKey('c1', 'people'), Number.NaN);
    expect(readScroll(scrollKey('c1', 'people'))).toBe(100);
  });

  it('clamps a negative offset to 0', () => {
    saveScroll(scrollKey('c1', 'people'), -50);
    expect(readScroll(scrollKey('c1', 'people'))).toBe(0);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/assistant-scroll-store.test.ts`
Expected: FAIL — `Cannot find package '@/components/assistant/scroll-store'`.

- [x] **Step 3: Write minimal implementation**

Create `components/assistant/scroll-store.ts`:

```typescript
import type { AssistantEntity } from '@/lib/assistant/types';

/**
 * Where each thread was scrolled to, per conversation and per entity.
 *
 * In-memory rather than sessionStorage: the offset is worthless after a reload
 * anyway, since the thread is re-rendered at a different height, and a write on
 * every scroll event would be the most frequent storage write in the app.
 *
 * Module-level state. A test that combines `vi.resetModules()` with a dynamic
 * import gets a SECOND copy of this Map and will read back zeros — use the
 * static import and `resetScrollsForTests`.
 */
const offsets = new Map<string, number>();

/** Entity is part of the key: one conversation spans several pages. */
export function scrollKey(conversationId: string, entity: AssistantEntity): string {
  return `${conversationId}::${entity}`;
}

export function saveScroll(key: string, offset: number): void {
  // A NaN from a mid-unmount measurement would otherwise stick permanently.
  if (!Number.isFinite(offset)) return;
  offsets.set(key, Math.max(0, offset));
}

/** 0 for an unknown key — a thread nobody has scrolled starts at the top. */
export function readScroll(key: string): number {
  return offsets.get(key) ?? 0;
}

export function resetScrollsForTests(): void {
  offsets.clear();
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/assistant-scroll-store.test.ts`
Expected: PASS — 11 tests.

- [x] **Step 5: Commit**

```bash
git add components/assistant/scroll-store.ts tests/integration/assistant-scroll-store.test.ts
git commit -m "feat(assistant): remember thread scroll per conversation and entity"
```

---

### Task 3: Bindings serialize and parse their own filters

**Files:**
- Modify: `components/assistant/types.ts` (the `PageBinding` type)
- Modify: `components/assistant/bindings/events.tsx`
- Modify: `components/assistant/bindings/people.tsx`
- Test: `tests/integration/assistant-bindings.test.ts` (append)

**Interfaces:**
- Consumes: `encodeFilters` / `decodeFilters` from Task 1.
- Produces: `PageBinding<F, C>` gains
  - `serializeFilters(filters: F): string` — a leading-`?` query string, or `''`
  - `parseFilters(search: string): F` — never throws

- [x] **Step 1: Write the failing test**

Append to `tests/integration/assistant-bindings.test.ts`:

```typescript
describe('binding filter serialization', () => {
  /**
   * Each binding owns its own URL representation. Events has a shipped readable
   * scheme; People has one opaque blob. A single shared codec would have to be
   * one or the other, and on Events it would compete with the scheme the rail
   * already reads — two representations of the same state, free to drift.
   */
  it('events round-trips through its own readable scheme', () => {
    const filters = eventsBinding.emptyFilters();
    filters.filters.countries = ['Germany'];
    filters.filters.categories = ['Packaging'];
    filters.search = 'expo';

    const query = eventsBinding.serializeFilters(filters);
    expect(query).toContain('country=Germany');
    expect(query).toContain('category=Packaging');
    expect(eventsBinding.parseFilters(query)).toEqual(filters);
  });

  it('events serialises empty filters to an empty string, not "?"', () => {
    expect(eventsBinding.serializeFilters(eventsBinding.emptyFilters())).toBe('');
  });

  it('events ignores the handoff params, which are not its filters', () => {
    // ask/via/cid must never be read as event filters. `q` and `from` ARE its
    // own, which is exactly why the handoff params are named differently.
    const parsed = eventsBinding.parseFilters('?ask=trade%20shows&via=people&cid=abc');
    expect(parsed).toEqual(eventsBinding.emptyFilters());
  });

  it('people round-trips through its base64url blob', () => {
    const filters = peopleBinding.emptyFilters();
    filters.titles = ['VP Engineering'];
    filters.countries = ['Germany'];
    filters.search = 'fintech';

    const query = peopleBinding.serializeFilters(filters);
    expect(query).toMatch(/^\?pf=[A-Za-z0-9_-]+$/);
    expect(peopleBinding.parseFilters(query)).toEqual(filters);
  });

  it('people serialises empty filters to an empty string', () => {
    expect(peopleBinding.serializeFilters(peopleBinding.emptyFilters())).toBe('');
  });

  it('people falls back to empty filters for a corrupt param', () => {
    expect(peopleBinding.parseFilters('?pf=!!!garbage!!!')).toEqual(
      peopleBinding.emptyFilters()
    );
  });

  it('people omits the param entirely when it would exceed the cap', () => {
    const filters = peopleBinding.emptyFilters();
    filters.keywords = Array.from({ length: 2000 }, (_, i) => `keyword-${i}`);
    // Omitted, not truncated: a truncated blob would decode to the wrong filters.
    expect(peopleBinding.serializeFilters(filters)).toBe('');
  });

  it('neither binding throws on an empty search string', () => {
    expect(eventsBinding.parseFilters('')).toEqual(eventsBinding.emptyFilters());
    expect(peopleBinding.parseFilters('')).toEqual(peopleBinding.emptyFilters());
  });
});
```

Make sure the file imports both bindings at the top — add whichever is missing:

```typescript
import { eventsBinding } from '@/components/assistant/bindings/events';
import { peopleBinding } from '@/components/assistant/bindings/people';
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/assistant-bindings.test.ts`
Expected: FAIL — `eventsBinding.serializeFilters is not a function`.

- [x] **Step 3: Extend the PageBinding type**

In `components/assistant/types.ts`, add two members to `PageBinding`, immediately after `applyFilters`:

```typescript
  /**
   * This entity's filters as a leading-`?` query string, or '' when empty.
   *
   * Per-binding rather than shared: Events already had a readable scheme worth
   * keeping, and a second representation of the same state on the same page
   * would drift from it.
   */
  serializeFilters(filters: F): string;
  /** Never throws — the param is attacker-controllable. Falls back to empty. */
  parseFilters(search: string): F;
```

- [x] **Step 4: Implement on the events binding**

In `components/assistant/bindings/events.tsx`, add these imports:

```typescript
import { parseEventQueryState, serializeEventQueryState } from '@/lib/events/filters';
```

(`EventQueryState` is already imported as a type; keep that import.)

Then add to the `eventsBinding` object, after `applyFilters`:

```typescript
  // Delegates to the scheme the rail already reads and writes, so the assistant
  // and the sidebar can never disagree about what the URL means.
  serializeFilters: serializeEventQueryState,
  parseFilters: parseEventQueryState,
```

- [x] **Step 5: Implement on the people binding**

In `components/assistant/bindings/people.tsx`, add this import:

```typescript
import { decodeFilters, encodeFilters } from '@/lib/assistant/filter-params';
```

Then add to the `peopleBinding` object, after `applyFilters`:

```typescript
  /**
   * One opaque param. Fifteen keys, eleven of them arrays — enumerating that
   * readably buys nothing on a page nobody hand-edits.
   */
  serializeFilters(filters) {
    const encoded = encodeFilters(filters);
    // Omitted rather than truncated when oversize: the in-memory presetFilters
    // carries the handoff, and a truncated blob would decode to wrong filters.
    return encoded ? `?pf=${encoded}` : '';
  },

  parseFilters(search) {
    const param = new URLSearchParams(search).get('pf');
    return decodeFilters(param, emptyPeopleFilters());
  },
```

- [x] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/integration/assistant-bindings.test.ts`
Expected: PASS — the existing 19 tests plus 8 new.

- [x] **Step 7: Commit**

```bash
git add components/assistant/types.ts components/assistant/bindings/events.tsx components/assistant/bindings/people.tsx tests/integration/assistant-bindings.test.ts
git commit -m "feat(assistant): let each binding own its URL filter representation"
```

---

### Task 4: The reducer keeps what it currently drops

**Files:**
- Modify: `components/assistant/types.ts` (`ConversationMessage`, `PendingHandoff`, `ConversationState`, `emptyMessage`, `emptyConversation`)
- Modify: `components/assistant/conversation-reducer.ts`
- Test: `tests/integration/assistant-reducer.test.ts` (append)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `ConversationMessage.handoffMessage: string | null`
  - `PendingHandoff.status: 'counting_down' | 'navigating' | 'cancelled'`
  - `ConversationState.handoffWarning: string | null`
  - `ConversationAction`: `send` gains `sourceFilters: unknown`; new `{ type: 'cancel_handoff' }`, `{ type: 'handoff_navigating' }` and `{ type: 'handoff_failed'; reason: string }`

- [x] **Step 1: Write the failing test**

Append to `tests/integration/assistant-reducer.test.ts`:

```typescript
const navigateRoute: AssistantEvent = {
  type: 'route',
  targetEntity: 'events',
  action: 'navigate',
  confidence: 0.8,
  handoffMessage: "That's a question about events — opening Events with your search applied.",
  interpretedFilters: { filters: { countries: ['Germany'] }, search: '' },
  droppedFilters: [],
  crossReference: null,
};

function afterSendWithFilters(sourceFilters: unknown) {
  return conversationReducer(emptyConversation(), {
    type: 'send',
    message: 'trade shows in Germany',
    id: ASSISTANT_ID,
    currentPage: 'people',
    sourceFilters,
  });
}

describe('conversationReducer — handoffMessage', () => {
  it('keeps the sentence the server sent to explain the jump', () => {
    // Previously parsed and thrown away, which is why the panel had nothing to
    // show and invented its own copy.
    const state = feed(afterSendWithFilters(null), [navigateRoute]);
    expect(state.messages.find((m) => m.id === ASSISTANT_ID)?.handoffMessage).toBe(
      navigateRoute.type === 'route' ? navigateRoute.handoffMessage : ''
    );
  });

  it('leaves it null for an inline answer, which explains nothing', () => {
    const state = feed(afterSend(), [inlineRoute]);
    expect(state.messages.find((m) => m.id === ASSISTANT_ID)?.handoffMessage).toBeNull();
  });
});

describe('conversationReducer — sourceFilters', () => {
  it('carries the page filters supplied at send into the handoff', () => {
    // The reducer has no router and no page access; send time is the only
    // moment this fact is available, and "go back" depends on it.
    const filters = { titles: ['CEO'], search: 'fintech' };
    const state = feed(afterSendWithFilters(filters), [navigateRoute]);
    expect(state.pendingHandoff?.sourceFilters).toEqual(filters);
  });

  it('opens the handoff counting down', () => {
    const state = feed(afterSendWithFilters(null), [navigateRoute]);
    expect(state.pendingHandoff?.status).toBe('counting_down');
  });

  it('records the source page and target', () => {
    const state = feed(afterSendWithFilters(null), [navigateRoute]);
    expect(state.pendingHandoff?.from).toBe('people');
    expect(state.pendingHandoff?.to).toBe('events');
  });
});

describe('conversationReducer — cancel and failure', () => {
  it('cancel_handoff marks the handoff cancelled without discarding it', () => {
    // Kept, not cleared: the re-ask needs its message and presetFilters, and
    // the banner needs somewhere to point its "Open Events" button.
    const state = conversationReducer(feed(afterSendWithFilters(null), [navigateRoute]), {
      type: 'cancel_handoff',
    });
    expect(state.pendingHandoff?.status).toBe('cancelled');
    expect(state.pendingHandoff?.message).toBe('trade shows in Germany');
  });

  it('cancel_handoff sets a warning the panel can render', () => {
    const state = conversationReducer(feed(afterSendWithFilters(null), [navigateRoute]), {
      type: 'cancel_handoff',
    });
    expect(state.handoffWarning).toBeTruthy();
  });

  it('handoff_failed cancels and reports why', () => {
    const state = conversationReducer(feed(afterSendWithFilters(null), [navigateRoute]), {
      type: 'handoff_failed',
      reason: 'Events did not load.',
    });
    expect(state.pendingHandoff?.status).toBe('cancelled');
    expect(state.handoffWarning).toBe('Events did not load.');
  });

  it('handoff_navigating marks the jump as under way', () => {
    const state = conversationReducer(feed(afterSendWithFilters(null), [navigateRoute]), {
      type: 'handoff_navigating',
    });
    expect(state.pendingHandoff?.status).toBe('navigating');
  });

  it('cancelling with no pending handoff is a no-op, not a crash', () => {
    const before = afterSendWithFilters(null);
    expect(conversationReducer(before, { type: 'cancel_handoff' })).toEqual(before);
  });

  it('a new send clears the previous warning', () => {
    const cancelled = conversationReducer(feed(afterSendWithFilters(null), [navigateRoute]), {
      type: 'cancel_handoff',
    });
    const next = conversationReducer(cancelled, {
      type: 'send',
      message: 'something else',
      id: 'a2',
      currentPage: 'people',
      sourceFilters: null,
    });
    expect(next.handoffWarning).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/assistant-reducer.test.ts`
Expected: FAIL — `sourceFilters` is not accepted on the `send` action and `handoffMessage` is `undefined`.

- [x] **Step 3: Extend the types**

In `components/assistant/types.ts`:

Add to `ConversationMessage`, after `suggestions`:

```typescript
  /** The server's own sentence explaining a handoff. Null unless action is navigate. */
  handoffMessage: string | null;
```

Add to `PendingHandoff`, after `message`:

```typescript
  /**
   * counting_down — the card is showing and the timer is armed
   * navigating     — router.push has fired; phase two runs on arrival
   * cancelled      — the user cancelled, or the jump failed; re-ask in place
   */
  status: 'counting_down' | 'navigating' | 'cancelled';
```

Add to `ConversationState`, after `pendingHandoff`:

```typescript
  /** Why the navigation did not happen. Rendered as a banner; null when fine. */
  handoffWarning: string | null;
```

In `emptyMessage`, add after `suggestions: []`:

```typescript
    handoffMessage: null,
```

In `emptyConversation`, add after `pendingHandoff: null`:

```typescript
    handoffWarning: null,
```

- [x] **Step 4: Extend the reducer**

In `components/assistant/conversation-reducer.ts`, extend `ConversationAction`:

```typescript
export type ConversationAction =
  | {
      type: 'send';
      message: string;
      id: string;
      currentPage: AssistantEntity;
      /** The asking page's live filters — what "go back" restores. */
      sourceFilters: unknown;
    }
  | { type: 'event'; id: string; event: AssistantEvent }
  | { type: 'stream_ended'; id: string }
  | { type: 'failed'; id: string; message: string }
  | { type: 'cancel_handoff' }
  | { type: 'handoff_navigating' }
  | { type: 'handoff_failed'; reason: string }
  | { type: 'clear_handoff' }
  | { type: 'restore'; state: ConversationState }
  | { type: 'reset' };
```

Add this helper next to `sourcePageOf`:

```typescript
/** Moves a pending handoff to a new status, or leaves state untouched. */
function withHandoffStatus(
  state: ConversationState,
  status: PendingHandoff['status'],
  warning: string | null
): ConversationState {
  if (!state.pendingHandoff) return state;
  return {
    ...state,
    pendingHandoff: { ...state.pendingHandoff, status },
    handoffWarning: warning,
  };
}
```

Import the type it needs — add `PendingHandoff` to the existing import from `./types`.

In `case 'send'`, record the filters on the user turn and clear any stale warning. Replace the `user` construction and the return:

```typescript
    case 'send': {
      // The user turn records the page it was asked from AND that page's
      // filters — the only place either fact enters the reducer, and what "go
      // back" later depends on.
      const user = {
        ...emptyMessage(`${action.id}-user`, 'user'),
        text: action.message,
        entity: action.currentPage,
        filters: action.sourceFilters,
      };
      const assistant = emptyMessage(action.id, 'assistant');
      return {
        ...state,
        messages: [...state.messages, user, assistant],
        isStreaming: true,
        error: null,
        // A new question supersedes the last one's complaint.
        handoffWarning: null,
      };
    }
```

In the `route` branch, keep the handoff message and populate `sourceFilters` and `status`:

```typescript
      if (event.type === 'route') {
        const next = patch(state, action.id, {
          entity: event.targetEntity,
          action: event.action,
          confidence: event.confidence,
          filters: event.interpretedFilters,
          droppedFilters: event.droppedFilters,
          // Only a handoff carries an explanation; an inline answer explains
          // nothing, and storing '' there would render an empty bubble.
          handoffMessage: event.action === 'navigate' ? event.handoffMessage : null,
        });

        if (event.action !== 'navigate') {
          return { ...next, previousEntity: event.targetEntity };
        }
        return {
          ...next,
          previousEntity: event.targetEntity,
          pendingHandoff: {
            from: sourcePageOf(state, action.id),
            to: event.targetEntity,
            // Recorded on the user turn at send time — see case 'send'.
            sourceFilters: find(state, `${action.id}-user`)?.filters ?? null,
            presetFilters: event.interpretedFilters,
            message: find(state, `${action.id}-user`)?.text ?? '',
            status: 'counting_down',
          },
        };
      }
```

Add the three new cases, immediately before `case 'clear_handoff'`:

```typescript
    // Cancelled, not cleared: the re-ask still needs the handoff's message and
    // presetFilters, and the banner needs a target for its "Open" button.
    case 'cancel_handoff':
      return withHandoffStatus(
        state,
        'cancelled',
        'Stayed on this page — answering here instead.'
      );

    case 'handoff_navigating':
      return withHandoffStatus(state, 'navigating', null);

    case 'handoff_failed':
      return withHandoffStatus(state, 'cancelled', action.reason);
```

- [x] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/integration/assistant-reducer.test.ts`
Expected: PASS — the existing 17 tests plus 12 new.

Existing tests that dispatch `send` without `sourceFilters` will fail to typecheck. Add `sourceFilters: null` to each — there are two helpers near the top of the file.

- [x] **Step 6: Verify the rest of the suite still typechecks**

Run: `npx tsc --noEmit`
Expected: exit 0. Any error is a `send` dispatch missing `sourceFilters`; add it.

- [x] **Step 7: Commit**

```bash
git add components/assistant/types.ts components/assistant/conversation-reducer.ts tests/integration/assistant-reducer.test.ts
git commit -m "feat(assistant): keep handoffMessage and real sourceFilters"
```

---

### Task 5: Handoff URL and cancellation decisions

**Files:**
- Modify: `components/assistant/handoff.ts`
- Test: `tests/integration/assistant-handoff.test.ts` (append)

**Interfaces:**
- Consumes: `PendingHandoff` (with `status`) from Task 4.
- Produces:
  - `supersede(state: ConversationState): SupersedeDecision`
  - `cancelToPhaseTwo(handoff: PendingHandoff): PhaseTwoRequest`
  - `handoffUrl(input: HandoffUrlInput): string`
  - `backUrl(input: BackUrlInput): string`
  - `HANDOFF_PARAMS: readonly ['ask', 'via', 'cid']`

- [x] **Step 1: Write the failing test**

Append to `tests/integration/assistant-handoff.test.ts`:

```typescript
import {
  backUrl,
  cancelToPhaseTwo,
  handoffUrl,
  HANDOFF_PARAMS,
  supersede,
} from '@/components/assistant/handoff';
import type { PendingHandoff } from '@/components/assistant/types';

const handoff: PendingHandoff = {
  from: 'people',
  to: 'events',
  sourceFilters: { titles: ['CEO'] },
  presetFilters: { filters: { countries: ['Germany'] }, search: '' },
  message: 'trade shows in Germany',
  status: 'counting_down',
};

describe('handoffUrl', () => {
  it('namespaces its own params so they cannot collide with the page', () => {
    // Events owns `q` (free text) and `from` (an ISO date). Using either here
    // would not throw — the page would just be quietly wrong.
    const url = handoffUrl({
      route: '/app/events',
      serializedFilters: '?country=Germany&category=Packaging',
      message: 'trade shows in Germany',
      from: 'people',
      conversationId: 'cid-1',
    });

    expect(url).toContain('ask=trade+shows+in+Germany');
    expect(url).toContain('via=people');
    expect(url).toContain('cid=cid-1');
    expect(url).not.toMatch(/[?&]q=/);
    expect(url).not.toMatch(/[?&]from=/);
  });

  it("preserves the target binding's own params", () => {
    const url = handoffUrl({
      route: '/app/events',
      serializedFilters: '?country=Germany&category=Packaging',
      message: 'x',
      from: 'people',
      conversationId: 'cid-1',
    });
    expect(url).toContain('country=Germany');
    expect(url).toContain('category=Packaging');
  });

  it('works when the target serialises nothing', () => {
    const url = handoffUrl({
      route: '/app/people',
      serializedFilters: '',
      message: 'who are the CEOs',
      from: 'events',
      conversationId: 'cid-1',
    });
    expect(url.startsWith('/app/people?')).toBe(true);
    expect(url).toContain('via=events');
  });

  it('escapes a question containing & and =', () => {
    const url = handoffUrl({
      route: '/app/events',
      serializedFilters: '',
      message: 'shows in R&D = fun?',
      from: 'people',
      conversationId: 'cid-1',
    });
    // Re-parsing must yield the original, not a truncated question.
    const parsed = new URLSearchParams(url.slice(url.indexOf('?')));
    expect(parsed.get('ask')).toBe('shows in R&D = fun?');
  });

  it('names exactly the three reserved params', () => {
    expect(HANDOFF_PARAMS).toEqual(['ask', 'via', 'cid']);
  });
});

describe('backUrl', () => {
  it('restores the source page with the filters it had', () => {
    const url = backUrl({
      route: '/app/people',
      serializedFilters: '?pf=abc123',
      conversationId: 'cid-1',
    });
    expect(url).toContain('pf=abc123');
    expect(url).toContain('cid=cid-1');
  });

  it('carries no ask or via — going back is not asking again', () => {
    const url = backUrl({
      route: '/app/people',
      serializedFilters: '?pf=abc123',
      conversationId: 'cid-1',
    });
    expect(url).not.toContain('ask=');
    expect(url).not.toContain('via=');
  });

  it('works when the source had no filters', () => {
    expect(backUrl({ route: '/app/people', serializedFilters: '', conversationId: 'c' })).toBe(
      '/app/people?cid=c'
    );
  });
});

describe('cancelToPhaseTwo', () => {
  it('asks the TARGET entity while staying on the source page', () => {
    // The rows are still the target's, produced by the target's adapter.
    // Nothing crosses — Spec 1's guarantee is not being weakened.
    expect(cancelToPhaseTwo(handoff)).toEqual({
      message: 'trade shows in Germany',
      currentPage: 'people',
      forceEntity: 'events',
      presetFilters: { filters: { countries: ['Germany'] }, search: '' },
    });
  });

  it('differs from phaseTwoRequest only in currentPage', () => {
    // phaseTwoRequest runs after arriving; this one runs without moving.
    const arrived = phaseTwoRequest(handoff);
    const stayed = cancelToPhaseTwo(handoff);
    expect(stayed.forceEntity).toBe(arrived.forceEntity);
    expect(stayed.presetFilters).toBe(arrived.presetFilters);
    expect(arrived.currentPage).toBe('events');
    expect(stayed.currentPage).toBe('people');
  });
});

describe('supersede', () => {
  it('reports a countdown that a new send must cancel', () => {
    const state = { ...emptyConversation(), pendingHandoff: handoff };
    expect(supersede(state)).toEqual({ kind: 'cancel', handoff });
  });

  it('reports nothing when no handoff is pending', () => {
    expect(supersede(emptyConversation())).toEqual({ kind: 'none' });
  });

  it('leaves an already-cancelled handoff alone', () => {
    const state = {
      ...emptyConversation(),
      pendingHandoff: { ...handoff, status: 'cancelled' as const },
    };
    expect(supersede(state)).toEqual({ kind: 'none' });
  });

  it('still cancels one that is mid-navigation', () => {
    // The push has fired but phase two has not; a new question wins.
    const navigating = { ...handoff, status: 'navigating' as const };
    const state = { ...emptyConversation(), pendingHandoff: navigating };
    expect(supersede(state)).toEqual({ kind: 'cancel', handoff: navigating });
  });
});
```

Ensure the file imports `emptyConversation` and `phaseTwoRequest`; add whichever is missing:

```typescript
import { phaseTwoRequest } from '@/components/assistant/handoff';
import { emptyConversation } from '@/components/assistant/types';
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/assistant-handoff.test.ts`
Expected: FAIL — `handoffUrl is not a function`.

- [x] **Step 3: Write the implementation**

Append to `components/assistant/handoff.ts`:

```typescript
/**
 * The three params the handoff owns.
 *
 * Deliberately NOT `q`, `from` or `filters`: `lib/events/filters.ts` already
 * claims `q` for the sidebar's free-text box and `from` for dateFrom as an ISO
 * date. Reusing either would put the whole question into a text filter, or a
 * page name into a date — and neither throws, which is what makes it dangerous.
 * Any future page-owned param must avoid these three names.
 */
export const HANDOFF_PARAMS = ['ask', 'via', 'cid'] as const;

export type HandoffUrlInput = {
  /** The target binding's route, e.g. "/app/events". */
  route: string;
  /** The target binding's own serializeFilters output — leading `?`, or ''. */
  serializedFilters: string;
  /** The question, replayed on arrival. */
  message: string;
  /** Where it was asked from, so the target can offer a way back. */
  from: AssistantEntity;
  conversationId: string;
};

export type BackUrlInput = {
  route: string;
  serializedFilters: string;
  conversationId: string;
};

/** The target route carrying the target's own filters plus ask/via/cid. */
export function handoffUrl(input: HandoffUrlInput): string {
  // URLSearchParams handles the escaping, so a question containing & or = does
  // not truncate the query string.
  const params = new URLSearchParams(input.serializedFilters);
  params.set('ask', input.message);
  params.set('via', input.from);
  params.set('cid', input.conversationId);
  return `${input.route}?${params.toString()}`;
}

/** The source route with its restored filters. No ask/via — this is not a question. */
export function backUrl(input: BackUrlInput): string {
  const params = new URLSearchParams(input.serializedFilters);
  params.set('cid', input.conversationId);
  return `${input.route}?${params.toString()}`;
}

/**
 * The re-ask used when the user cancels, or the jump fails.
 *
 * Spec 1 guarantees a navigate turn carries no rows, so there is no inline
 * answer to fall back on — the question has to be asked again. It is asked with
 * `forceEntity` set to the TARGET, so the target's adapter answers and the
 * target's binding renders the rows, while `currentPage` stays the source page
 * because we never left it. Nothing crosses entities.
 */
export function cancelToPhaseTwo(handoff: PendingHandoff): PhaseTwoRequest {
  return {
    message: handoff.message,
    currentPage: handoff.from,
    forceEntity: handoff.to,
    presetFilters: handoff.presetFilters,
  };
}

export type SupersedeDecision =
  | { kind: 'none' }
  | { kind: 'cancel'; handoff: PendingHandoff };

/**
 * What a new question does to a navigation that has not finished.
 *
 * Rapid consecutive cross-entity questions must cancel the pending jump rather
 * than race it — otherwise the second answer arrives and the first navigation
 * then fires underneath it.
 */
export function supersede(state: ConversationState): SupersedeDecision {
  const handoff = state.pendingHandoff;
  if (!handoff || handoff.status === 'cancelled') return { kind: 'none' };
  return { kind: 'cancel', handoff };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/integration/assistant-handoff.test.ts`
Expected: PASS — the existing 8 tests plus 15 new.

- [x] **Step 5: Commit**

```bash
git add components/assistant/handoff.ts tests/integration/assistant-handoff.test.ts
git commit -m "feat(assistant): namespaced handoff URLs and the cancel re-ask"
```

---

### Task 6: Session mirror keyed by conversation

**Files:**
- Modify: `components/assistant/session-mirror.ts`
- Test: `tests/integration/assistant-session-mirror.test.ts` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: `sessionKeyFor(conversationId: string): string`. `SESSION_KEY` stays exported as the legacy/unkeyed key.

- [x] **Step 1: Write the failing test**

Append to `tests/integration/assistant-session-mirror.test.ts`:

```typescript
describe('sessionKeyFor', () => {
  it('gives each conversation its own slot', () => {
    // A pasted link with a cid must rejoin its own thread rather than opening
    // someone else's, or starting a fourth one.
    expect(sessionKeyFor('c1')).not.toBe(sessionKeyFor('c2'));
  });

  it('is stable for one conversation', () => {
    expect(sessionKeyFor('c1')).toBe(sessionKeyFor('c1'));
  });

  it('is namespaced under the existing key, so old entries are recognisable', () => {
    expect(sessionKeyFor('c1')).toContain(SESSION_KEY);
  });

  it('round-trips a thread stored under its own key', () => {
    const state = { ...emptyConversation(), previousEntity: 'events' as const };
    const restored = restoreConversation(serializeConversation(state));
    expect(restored.previousEntity).toBe('events');
  });
});
```

Add `sessionKeyFor` to the file's existing import from `@/components/assistant/session-mirror`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/assistant-session-mirror.test.ts`
Expected: FAIL — `sessionKeyFor is not a function`.

- [x] **Step 3: Write the implementation**

In `components/assistant/session-mirror.ts`, add below the existing `SESSION_KEY`:

```typescript
/**
 * One slot per conversation.
 *
 * A single shared key meant a refresh, a pasted handoff link and a second tab
 * all fought over the same entry. Namespaced under SESSION_KEY so pre-existing
 * entries stay identifiable, and so clearing assistant state stays one prefix
 * scan.
 */
export function sessionKeyFor(conversationId: string): string {
  return `${SESSION_KEY}:${conversationId}`;
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/integration/assistant-session-mirror.test.ts`
Expected: PASS — the existing 7 tests plus 4 new.

- [x] **Step 5: Commit**

```bash
git add components/assistant/session-mirror.ts tests/integration/assistant-session-mirror.test.ts
git commit -m "feat(assistant): one sessionStorage slot per conversation"
```

---

### Task 7: Saved queries know their entity

**Files:**
- Modify: `components/search/query-store.ts`
- Test: `tests/integration/query-store-entity.test.ts`

**Interfaces:**
- Consumes: `AssistantEntity` from `@/lib/assistant/types`.
- Produces: `SavedQuery.targetEntity?: AssistantEntity`; `targetEntityOf(entry: SavedQuery): AssistantEntity`.

- [x] **Step 1: Write the failing test**

Create `tests/integration/query-store-entity.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { targetEntityOf, type SavedQuery } from '@/components/search/query-store';

function entry(overrides: Partial<SavedQuery>): SavedQuery {
  return {
    id: 'q1',
    type: 'lead_query',
    query: 'saas companies in germany',
    chips: [],
    createdAt: 0,
    saved: false,
    ...overrides,
  };
}

describe('targetEntityOf', () => {
  it('prefers an explicit targetEntity', () => {
    expect(targetEntityOf(entry({ type: 'lead_query', targetEntity: 'people' }))).toBe('people');
  });

  it('infers companies from lead_query', () => {
    // Entries written before this field existed must keep working — the store
    // is localStorage, so there is no migration step that can run.
    expect(targetEntityOf(entry({ type: 'lead_query' }))).toBe('companies');
  });

  it('infers events from event_query', () => {
    expect(targetEntityOf(entry({ type: 'event_query' }))).toBe('events');
  });

  it('infers people from people_query', () => {
    expect(targetEntityOf(entry({ type: 'people_query' }))).toBe('people');
  });

  it('falls back to companies for an unrecognised type', () => {
    expect(targetEntityOf(entry({ type: 'something_else' as SavedQuery['type'] }))).toBe(
      'companies'
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/query-store-entity.test.ts`
Expected: FAIL — `targetEntityOf is not a function`.

- [x] **Step 3: Write the implementation**

In `components/search/query-store.ts`, add the import:

```typescript
import type { AssistantEntity } from "@/lib/assistant/types";
```

Add to the `SavedQuery` type, after `payload`:

```typescript
  /**
   * Which page "View" reopens. Optional because entries predating this field
   * live in localStorage, where no migration can run — `targetEntityOf`
   * infers it from `type` instead.
   */
  targetEntity?: AssistantEntity;
```

Add below the type:

```typescript
const ENTITY_BY_KIND: Record<SavedQueryKind, AssistantEntity> = {
  lead_query: "companies",
  event_query: "events",
  people_query: "people",
};

/** The explicit field when present, otherwise inferred from the legacy kind. */
export function targetEntityOf(entry: SavedQuery): AssistantEntity {
  return entry.targetEntity ?? ENTITY_BY_KIND[entry.type] ?? "companies";
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/integration/query-store-entity.test.ts`
Expected: PASS — 5 tests.

- [x] **Step 5: Commit**

```bash
git add components/search/query-store.ts tests/integration/query-store-entity.test.ts
git commit -m "feat(search): saved queries carry their target entity"
```

---

### Task 8: The endpoint accepts a conversation id

**Files:**
- Modify: `app/api/assistant/chat/route.ts`
- Test: `tests/integration/assistant-conversation-id.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the request body may carry `conversationId: string`, 64 characters or fewer. Logged only — it changes no behaviour.

- [x] **Step 1: Write the failing test**

Create `tests/integration/assistant-conversation-id.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetAdapters, setAdapterForTests } from '@/lib/assistant/registry';
import type { EntityAdapter } from '@/lib/assistant/types';

/**
 * conversationId is accepted and logged; it changes no behaviour. The point of
 * these tests is that a malformed one cannot break a question — the field is
 * client-supplied and the endpoint is not tenant-gated.
 */
vi.mock('@/lib/auth/tenant', () => ({ resolveTenant: vi.fn().mockResolvedValue(null) }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: async () => ({ content: [] }) };
  },
}));

const fakeEvents = {
  entity: 'events',
  signals: [{ word: 'shows' }],
  filterSchema: { type: 'object', properties: {} },
  emptyFilters: () => ({}),
  parseLocally: (_m: string, base: unknown) => base,
  carryOver: () => ({ filters: {}, dropped: [] }),
  search: async () => ({ rows: [{ id: 'e1' }], total: 1 }),
  chips: () => [],
  describe: () => 'One show matches.',
  suggest: () => [],
} as unknown as EntityAdapter<never>;

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  setAdapterForTests('events', fakeEvents);
});

afterEach(() => {
  resetAdapters();
});

async function post(body: unknown) {
  const { POST } = await import('@/app/api/assistant/chat/route');
  const response = await POST(
    new Request('http://localhost/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  return { status: response.status, text: await response.text() };
}

const ask = { message: 'shows in germany', currentPage: 'events' };

describe('conversationId', () => {
  it('answers normally when one is supplied', async () => {
    const { status, text } = await post({ ...ask, conversationId: 'conv-abc-123' });
    expect(status).toBe(200);
    expect(text).toContain('"type":"results"');
  });

  it('answers normally when it is absent', async () => {
    const { status, text } = await post(ask);
    expect(status).toBe(200);
    expect(text).toContain('"type":"results"');
  });

  it('rejects one longer than 64 characters', async () => {
    const { status } = await post({ ...ask, conversationId: 'x'.repeat(65) });
    expect(status).toBe(400);
  });

  it('rejects a non-string', async () => {
    const { status } = await post({ ...ask, conversationId: 42 });
    expect(status).toBe(400);
  });

  it('never echoes it into the stream', async () => {
    // It is a client-supplied string; reflecting it would make the endpoint a
    // trivial content-injection vector into the panel.
    const { text } = await post({ ...ask, conversationId: 'conv-abc-123' });
    expect(text).not.toContain('conv-abc-123');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/assistant-conversation-id.test.ts`
Expected: FAIL — the over-length and non-string cases return 200, because nothing validates the field.

- [x] **Step 3: Write the implementation**

In `app/api/assistant/chat/route.ts`, add to the `ChatBody` type:

```typescript
  conversationId?: unknown;
```

Add this constant next to `NDJSON_HEADERS`:

```typescript
/** Long enough for a generated id, short enough not to be a payload. */
const MAX_CONVERSATION_ID = 64;
```

In `POST`, after the `presetFilters` block and before the rate limit call:

```typescript
    // Accepted and logged only — it changes no behaviour here. Validated
    // anyway: it is client-supplied and this route is not tenant-gated.
    if (body.conversationId !== undefined) {
      if (
        typeof body.conversationId !== 'string' ||
        body.conversationId.length > MAX_CONVERSATION_ID
      ) {
        throw new BadRequestError(
          `conversationId must be a string of at most ${MAX_CONVERSATION_ID} characters`
        );
      }
    }
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/integration/assistant-conversation-id.test.ts`
Expected: PASS — 5 tests.

- [x] **Step 5: Commit**

```bash
git add app/api/assistant/chat/route.ts tests/integration/assistant-conversation-id.test.ts
git commit -m "feat(assistant): accept and validate a conversation id"
```

---

> **Shipping boundary.** Tasks 1–8 are complete, tested and user-invisible. The
> suite must be green here: `npx vitest run --no-file-parallelism`. Everything
> below wires these decisions into React and has no test coverage by design.

---

### Task 9: URL-backed filter state and the countdown card

**Files:**
- Create: `components/assistant/use-url-filters.ts`
- Create: `components/assistant/handoff-countdown.tsx`

**Interfaces:**
- Consumes: `bindingFor` from `./registry`; `PageBinding` from `./types`.
- Produces:
  - `useUrlFilters<F>(entity: AssistantEntity): { filters: F; setFilters(next: F): void; isHydrated: boolean }`
  - `HandoffCountdown({ to, message, onCancel }: { to: AssistantEntity; message: string; onCancel(): void })`

- [x] **Step 1: Write the URL hook**

Create `components/assistant/use-url-filters.ts`:

```typescript
"use client";

import { useCallback, useEffect, useState } from 'react';
import { bindingFor } from './registry';
import type { AssistantEntity } from '@/lib/assistant/types';

/**
 * Filter state that lives in the URL, so it survives a handoff, browser back
 * and a refresh.
 *
 * Generalises what components/events/event-list-view.tsx:55-70 already does.
 *
 * `useSearchParams` is deliberately avoided: in Next 14 it forces the reading
 * subtree into a Suspense boundary. components/auth/sign-in-form.tsx:46 records
 * the same decision independently.
 *
 * The URL is read in an effect, never in the render initializer. Parsing during
 * render makes the server produce an unfiltered list and the client a filtered
 * one — a hydration mismatch.
 */
export function useUrlFilters<F>(entity: AssistantEntity): {
  filters: F;
  setFilters: (next: F) => void;
  isHydrated: boolean;
} {
  const binding = bindingFor(entity) as unknown as PageBindingLike<F>;
  const [filters, setState] = useState<F>(() => binding.emptyFilters());
  const [isHydrated, setIsHydrated] = useState(false);

  // Read once on mount, and again whenever the user moves through history.
  useEffect(() => {
    const read = () => setState(binding.parseFilters(window.location.search));
    read();
    setIsHydrated(true);
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [binding]);

  const setFilters = useCallback(
    (next: F) => {
      setState(next);
      if (typeof window === 'undefined') return;
      // replaceState, not router.replace: this only needs to keep the address
      // bar shareable, and avoids re-running the RSC payload on every checkbox
      // click. It also keeps filter edits out of the history stack, so a
      // debounced facet toggle does not become a back-button step.
      const search = binding.serializeFilters(next);
      window.history.replaceState(null, '', `${window.location.pathname}${search}`);
    },
    [binding]
  );

  return { filters, setFilters, isHydrated };
}

/** The slice of PageBinding this hook needs, without its row-context generic. */
type PageBindingLike<F> = {
  emptyFilters(): F;
  serializeFilters(filters: F): string;
  parseFilters(search: string): F;
};
```

- [x] **Step 2: Write the countdown card**

Create `components/assistant/handoff-countdown.tsx`:

```tsx
"use client";

import { ArrowRight } from 'lucide-react';
import type { AssistantEntity } from '@/lib/assistant/types';

const LABEL: Record<AssistantEntity, string> = {
  companies: 'Companies',
  events: 'Events',
  people: 'People',
};

/**
 * The card shown while a handoff is counting down.
 *
 * Presentational only. The timer itself lives in the provider, so cancellation
 * and supersession are ref-and-reducer operations that a node test can drive
 * rather than component lifecycle that nothing here can test.
 */
export function HandoffCountdown({
  to,
  message,
  onCancel,
}: {
  to: AssistantEntity;
  message: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-[12px] text-[#1E40AF] dark:border-[#1E3A5F] dark:bg-[#0F1D33] dark:text-[#93C5FD]">
      <span className="flex items-center gap-2">
        <span className="rounded-full bg-[#1E40AF] px-2 py-0.5 text-[10px] font-medium text-white dark:bg-[#93C5FD] dark:text-[#0F1D33]">
          {LABEL[to]}
        </span>
        <span>{message}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="flex items-center gap-1 opacity-70">
          Opening {LABEL[to]}
          <ArrowRight className="h-3 w-3" />
        </span>
        <button type="button" onClick={onCancel} className="underline">
          Cancel
        </button>
      </span>
    </div>
  );
}
```

- [x] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [x] **Step 4: Commit**

```bash
git add components/assistant/use-url-filters.ts components/assistant/handoff-countdown.tsx
git commit -m "feat(assistant): URL-backed filter hook and the countdown card"
```

---

### Task 10: The provider owns the conversation id, the timer and the failure path

**Files:**
- Modify: `components/assistant/assistant-provider.tsx`

**Interfaces:**
- Consumes: `supersede`, `cancelToPhaseTwo`, `handoffUrl` from Task 5; `sessionKeyFor` from Task 6; `HANDOFF_PARAMS` from Task 5.
- Produces: context gains `conversationId: string` and `cancelHandoff: () => void`; `SendInput` gains `sourceFilters?: unknown`.

- [x] **Step 1: Add the conversation id**

In `components/assistant/assistant-provider.tsx`, add these imports:

```typescript
import { cancelToPhaseTwo, handoffUrl, phaseTwoRequest, supersede } from './handoff';
import { restoreConversation, serializeConversation, sessionKeyFor } from './session-mirror';
```

(Replace the existing `phaseTwoRequest` and `session-mirror` imports with these.)

Add below `newId`:

```typescript
/**
 * The thread's identity, stable across navigation.
 *
 * Read from `?cid=` first so a pasted handoff link rejoins its own thread
 * rather than starting a new one; generated otherwise. Never read during
 * render — see the mount effect.
 */
function newConversationId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
```

Inside the component, replace the mount/mirror effects with:

```typescript
  const [conversationId, setConversationId] = useState<string>(newConversationId);

  // Adopt the id from the URL, then restore that thread. Both happen in an
  // effect: reading window during render is a hydration mismatch.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromUrl = new URLSearchParams(window.location.search).get('cid');
    const id = fromUrl && fromUrl.length <= 64 ? fromUrl : conversationId;
    if (id !== conversationId) setConversationId(id);

    const restored = restoreConversation(window.sessionStorage.getItem(sessionKeyFor(id)));
    if (restored.messages.length > 0) {
      dispatch({ type: 'restore', state: restored });
    }
    // Mount only: adopting a new cid mid-session would abandon the live thread.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror on change, under this conversation's own key.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(sessionKeyFor(conversationId), serializeConversation(state));
    } catch {
      // Storage full or blocked — the in-memory thread still works.
    }
  }, [state, conversationId]);
```

Add `useState` to the React import at the top of the file.

- [x] **Step 2: Carry sourceFilters and the id on every send**

Extend `SendInput`:

```typescript
export type SendInput = {
  message: string;
  currentPage: AssistantEntity;
  activeFilters?: Record<string, unknown>;
  /** The asking page's live filters, recorded so "go back" can restore them. */
  sourceFilters?: unknown;
  forceEntity?: AssistantEntity;
  presetFilters?: unknown;
};
```

In `run`, pass them through. Replace the `dispatch({ type: 'send', ... })` line:

```typescript
    dispatch({
      type: 'send',
      message: input.message,
      id,
      currentPage: input.currentPage,
      sourceFilters: input.sourceFilters ?? null,
    });
```

and add `conversationId` to the fetch body, after `page: 1`:

```typescript
          conversationId,
```

Add `conversationId` to `run`'s dependency array.

- [x] **Step 3: Cancel a pending navigation before starting a new one**

Add a timer ref beside the existing refs:

```typescript
  /** The armed countdown. Held here, not in the card, so cancelling is a ref op. */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
```

At the very top of `run`, before creating the controller:

```typescript
    // A new question supersedes a navigation that has not landed. Without this
    // the second answer arrives and the first push then fires underneath it.
    if (supersede(stateRef.current).kind === 'cancel') {
      clearTimer();
      dispatch({ type: 'cancel_handoff' });
    }
```

Add `clearTimer` to `run`'s dependency array.

- [x] **Step 4: Replace the navigation effect**

Replace the whole "Navigate on a pending handoff" effect with:

```typescript
  // Arm the countdown, then navigate; issue phase two on arrival.
  useEffect(() => {
    const handoff = state.pendingHandoff;
    if (!handoff) return;

    // No binding means no way to render the target's rows on the client. Show
    // the explanation and stop — no countdown, no navigation, no false promise
    // that pressing something will fetch it. Companies until Spec 3b.
    if (!hasBinding(handoff.to)) return;

    if (handoff.status === 'cancelled') return;

    const binding = bindingFor(handoff.to);

    if (pathname !== binding.route) {
      if (handoff.status === 'navigating') return; // push already fired
      if (timerRef.current !== null) return; // already armed

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        dispatch({ type: 'handoff_navigating' });
        try {
          // router.push, not replaceState: a handoff IS a navigation and SHOULD
          // be a history entry — that is what makes browser back work.
          router.push(
            handoffUrl({
              route: binding.route,
              serializedFilters: (
                binding as unknown as { serializeFilters(f: unknown): string }
              ).serializeFilters(handoff.presetFilters),
              message: handoff.message,
              from: handoff.from,
              conversationId,
            })
          );
        } catch {
          dispatch({
            type: 'handoff_failed',
            reason: 'Could not open that page — answering here instead.',
          });
        }
      }, HANDOFF_DELAY_MS);
      return () => clearTimer();
    }

    // Arrived. Issue phase two exactly once per handoff.
    const key = `${handoff.to}:${handoff.message}`;
    if (phaseTwoRef.current === key) return;
    phaseTwoRef.current = key;

    void run(phaseTwoRequest(handoff));
  }, [state.pendingHandoff, pathname, router, run, conversationId, clearTimer]);
```

Add the delay constant beside `ENDPOINT`:

```typescript
/** Long enough to read the card and press Cancel; short enough not to feel stuck. */
const HANDOFF_DELAY_MS = 1500;
```

- [x] **Step 5: Expose cancellation**

In the `useMemo` context value, add:

```typescript
      conversationId,
      cancelHandoff: () => {
        clearTimer();
        const decision = supersede(stateRef.current);
        dispatch({ type: 'cancel_handoff' });
        // Spec 1 guarantees a navigate turn carries no rows, so there is no
        // inline answer to fall back on — the question has to be asked again,
        // with the TARGET's adapter answering it in place.
        if (decision.kind === 'cancel') void run(cancelToPhaseTwo(decision.handoff));
      },
```

and add both to the `ContextValue` type:

```typescript
type ContextValue = {
  state: ConversationState;
  conversationId: string;
  send: (input: SendInput) => Promise<void>;
  retry: (currentPage: AssistantEntity) => Promise<void>;
  stop: () => void;
  reset: () => void;
  clearHandoff: () => void;
  cancelHandoff: () => void;
};
```

Add `conversationId` and `clearTimer` to the `useMemo` dependency array.

- [x] **Step 6: Verify it compiles and the suite is green**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx vitest run --no-file-parallelism`
Expected: all pass.

- [x] **Step 7: Commit**

```bash
git add components/assistant/assistant-provider.tsx
git commit -m "feat(assistant): cancellable countdown and a conversation identity"
```

---

### Task 11: Render the three router decisions

**Files:**
- Modify: `components/assistant/assistant-message.tsx`

**Interfaces:**
- Consumes: `ConversationMessage.handoffMessage` from Task 4.
- Produces: `AssistantMessage` gains optional `onAnswerHere`, `onConfirm` and `onApplyFilters` props. All optional, so existing call sites keep compiling until Task 12 supplies them.

- [x] **Step 1: Add the props**

In `components/assistant/assistant-message.tsx`, extend the component's props:

```tsx
export function AssistantMessage({
  message,
  rowContext,
  onSuggestion,
  onRetry,
  onConfirm,
  onApplyFilters,
}: {
  message: ConversationMessage;
  rowContext?: unknown;
  onSuggestion: (prompt: string) => void;
  onRetry: () => void;
  /** Answer the router's `confirm` question by naming an entity. */
  onConfirm?: (entity: AssistantEntity) => void;
  /** Push this turn's interpreted filters onto the live page. */
  onApplyFilters?: (filters: unknown) => void;
}) {
```

Keep whatever prop names the file already uses for `message`, `rowContext`, `onSuggestion` and `onRetry`; only add the two new ones. Import `AssistantEntity` from `@/lib/assistant/types` if it is not already imported.

- [x] **Step 2: Render the confirm question with answers**

Add, immediately before the `showRows` block:

```tsx
      {/* `confirm` creates no pendingHandoff, so nothing here can navigate —
          it only re-asks with the entity the user named. */}
      {message.action === 'confirm' && message.handoffMessage && onConfirm && message.entity && (
        <div className="space-y-2 rounded-lg border border-[#E2E8F0] px-3 py-2 dark:border-[#22304A]">
          <p className="text-[13px] text-[#0F172A] dark:text-[#E2E8F0]">
            {message.handoffMessage}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onConfirm(message.entity as AssistantEntity)}
              className="rounded-md border border-[#E2E8F0] px-2 py-1 text-[12px] dark:border-[#22304A]"
            >
              {ENTITY_LABEL[message.entity]}
            </button>
          </div>
        </div>
      )}
```

Add the label map near the top of the file if it is not already there:

```tsx
const ENTITY_LABEL: Record<AssistantEntity, string> = {
  companies: 'Companies',
  events: 'Events',
  people: 'People',
};
```

- [x] **Step 3: Render the navigate badge**

Add immediately after the confirm block:

```tsx
      {/* A navigate turn carries no rows by design. Until the target has a
          binding (companies, before Spec 3b) this badge and sentence are the
          whole answer — an explanation of where it lives, with no button that
          would promise to fetch it. */}
      {message.action === 'navigate' && message.handoffMessage && message.entity && (
        <div className="flex items-center gap-2 text-[12px] text-[#1E40AF] dark:text-[#93C5FD]">
          <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-medium dark:bg-[#0F1D33]">
            {ENTITY_LABEL[message.entity]}
          </span>
          <span>{message.handoffMessage}</span>
        </div>
      )}
```

- [x] **Step 4: Add "Apply filters" to the chip row**

Find the block that renders `message.chips` and add, as its last child inside the same container:

```tsx
          {onApplyFilters && message.filters != null && (
            <button
              type="button"
              onClick={() => onApplyFilters(message.filters)}
              className="rounded-full border border-dashed border-[#94A3B8] px-2 py-0.5 text-[11px] text-[#475569] dark:border-[#475569] dark:text-[#94A3B8]"
            >
              Apply filters
            </button>
          )}
```

- [x] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx vitest run --no-file-parallelism tests/integration/assistant-reducer.test.ts tests/integration/assistant-bindings.test.ts`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add components/assistant/assistant-message.tsx
git commit -m "feat(assistant): render confirm, navigate and applicable filters"
```

---

### Task 12: Rename the panel and update its call sites

**Files:**
- Rename: `components/assistant/assistant-panel.tsx` to `components/assistant/ai-chat-panel.tsx`
- Modify: `components/assistant/use-assistant-chat.ts`
- Modify: `components/crm/people-section.tsx:355-380`
- Modify: `components/events/event-list-view.tsx:225-240` and `:291-306`

**Interfaces:**
- Consumes: `useUrlFilters` from Task 9; `HandoffCountdown` from Task 9; `cancelHandoff` and `conversationId` from Task 10.
- Produces: `AIChatPanel({ entity, rowContext })`. `activeFilters` and `onGoBack` are gone.

- [x] **Step 1: Rename the file**

```bash
git mv components/assistant/assistant-panel.tsx components/assistant/ai-chat-panel.tsx
```

- [x] **Step 2: Rewrite the panel's signature and handoff rendering**

In `components/assistant/ai-chat-panel.tsx`:

Rename the export and change the props:

```tsx
export function AIChatPanel({
  entity,
  rowContext,
}: {
  entity: AssistantEntity;
  /** The page's own row handlers, forwarded opaquely to its binding. */
  rowContext?: unknown;
}) {
  const chat = useAssistantChat({ entity });
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const copy = COPY[entity];
```

Replace every other use of `currentPage` in the file with `entity`.

Replace the `showBar` block with the countdown, the arrival bar and the warning banner:

```tsx
  const handoff = chat.pendingHandoff;
  const isCountingDown = handoff !== null && handoff.status === 'counting_down';
  const showArrivalBar = handoff !== null && handoff.status === 'navigating' && handoff.to === entity;
```

and in the JSX, replacing the old `{showBar && handoff && (<HandoffBar .../>)}`:

```tsx
      {isCountingDown && handoff && (
        <HandoffCountdown
          to={handoff.to}
          message={handoff.message}
          onCancel={chat.cancelHandoff}
        />
      )}

      {showArrivalBar && handoff && (
        <HandoffBar
          from={handoff.from}
          onBack={() => {
            // A route push, not a callback the page has to service — the URL
            // now holds the filters, so "back" is just a URL.
            window.history.back();
            chat.clearHandoff();
          }}
          onDismiss={chat.clearHandoff}
        />
      )}

      {chat.handoffWarning && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          {chat.handoffWarning}
        </p>
      )}
```

Add the import:

```tsx
import { HandoffCountdown } from './handoff-countdown';
```

- [x] **Step 3: Update the chat hook**

Rewrite `components/assistant/use-assistant-chat.ts`:

```typescript
"use client";

import { useCallback } from 'react';
import { useAssistantConversation } from './assistant-provider';
import { useUrlFilters } from './use-url-filters';
import type { AssistantEntity } from '@/lib/assistant/types';

/**
 * The panel's view of the shared conversation, scoped to one page.
 *
 * Thin by design — everything it appears to decide is decided in
 * conversation-reducer.ts and handoff.ts, which are node-testable.
 *
 * It reads the page's filters from the URL itself rather than taking them as a
 * prop, which is what let `activeFilters` and `onGoBack` be deleted from the
 * panel's signature instead of duplicated onto a third page.
 */
export function useAssistantChat({ entity }: { entity: AssistantEntity }) {
  const { state, send, retry, stop, reset, clearHandoff, cancelHandoff } =
    useAssistantConversation();
  const { filters } = useUrlFilters<unknown>(entity);

  const sendMessage = useCallback(
    async (message: string) => {
      const question = message.trim();
      if (!question || state.isStreaming) return;
      await send({
        message: question,
        currentPage: entity,
        activeFilters: filters as Record<string, unknown>,
        // The same value, for two different jobs: the server carries it across
        // entities, and the reducer keeps it so "go back" can restore it.
        sourceFilters: filters,
      });
    },
    [send, entity, filters, state.isStreaming]
  );

  return {
    messages: state.messages,
    isStreaming: state.isStreaming,
    error: state.error,
    pendingHandoff: state.pendingHandoff,
    handoffWarning: state.handoffWarning,
    /** Keys the panel's saved scroll offset. */
    conversationId,
    send: sendMessage,
    retry: useCallback(() => retry(entity), [retry, entity]),
    stop,
    reset,
    clearHandoff,
    cancelHandoff,
  };
}
```

Destructure `conversationId` from `useAssistantConversation()` alongside the rest.

- [x] **Step 4: Update the People call site**

In `components/crm/people-section.tsx`, replace the `<AssistantPanel .../>` element with:

```tsx
            <AIChatPanel entity="people" rowContext={rowContext} />
```

Delete the now-unused `onGoBack` closure and the `activeFilters` prop. Keep whatever expression the file already passes as `rowContext`. Update the import to `import { AIChatPanel } from '@/components/assistant/ai-chat-panel';`.

- [x] **Step 5: Update both Events call sites**

In `components/events/event-list-view.tsx`, replace each of the two `<AssistantPanel .../>` elements with:

```tsx
                                    <AIChatPanel entity="events" rowContext={rowContext} />
```

Delete both `onGoBack` closures and both `activeFilters` props, keeping each site's existing `rowContext` expression. Update the import to `import { AIChatPanel } from '@/components/assistant/ai-chat-panel';`.

- [x] **Step 6: Restore the thread's scroll position**

Without this, `scroll-store.ts` from Task 2 has no consumer and every handoff
drops the user at the top of a thread they were reading.

In `components/assistant/ai-chat-panel.tsx`, add the imports:

```tsx
import { useLayoutEffect } from 'react';
import { readScroll, saveScroll, scrollKey } from './scroll-store';
```

Add inside the component, after `copy`:

```tsx
  const threadRef = useRef<HTMLDivElement | null>(null);
  const offsetKey = scrollKey(chat.conversationId, entity);

  // useLayoutEffect, not useEffect: restoring after paint shows the thread at
  // the top for one frame and then jumps, which reads as a glitch.
  useLayoutEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = readScroll(offsetKey);
  }, [offsetKey]);
```

Attach both to the thread container — replace its opening tag:

```tsx
      <div
        ref={threadRef}
        onScroll={(event) => saveScroll(offsetKey, event.currentTarget.scrollTop)}
        className="flex-1 space-y-5 overflow-y-auto pr-1"
      >
```

- [x] **Step 7: Show a back chip when the user arrived via a handoff**

The arrival bar in Step 2 keys off `handoff.status`, which does not survive a
refresh — `session-mirror.ts` deliberately never restores `pendingHandoff`. The
`via` param is the only durable signal that the user got here from somewhere.

Add to the component, after the scroll effect:

```tsx
  const [arrivedFrom, setArrivedFrom] = useState<AssistantEntity | null>(null);

  // In an effect, never in the render initializer: reading window during render
  // is a hydration mismatch.
  useEffect(() => {
    const via = new URLSearchParams(window.location.search).get('via');
    setArrivedFrom(via === 'people' || via === 'events' || via === 'companies' ? via : null);
  }, []);
```

and render it beside the arrival bar, replacing `showArrivalBar &&` with a
condition that also covers a refreshed arrival:

```tsx
      {(showArrivalBar || arrivedFrom !== null) && (
        <HandoffBar
          from={(handoff?.from ?? arrivedFrom) as AssistantEntity}
          onBack={() => {
            window.history.back();
            setArrivedFrom(null);
            chat.clearHandoff();
          }}
          onDismiss={() => {
            setArrivedFrom(null);
            chat.clearHandoff();
          }}
        />
      )}
```

- [x] **Step 8: Open a saved query on its own page**

Otherwise `targetEntityOf` from Task 7 has no consumer. A saved People query
picked from the Events panel should reopen People with its filters restored,
not be re-asked as a fresh question and re-classified.

In `components/assistant/ai-chat-panel.tsx`, add the imports:

```tsx
import { useRouter } from 'next/navigation';
import { targetEntityOf, type SavedQuery } from '@/components/search/query-store';
import { bindingFor, hasBinding } from './registry';
```

Add inside the component:

```tsx
  const router = useRouter();

  /**
   * Restores the exact search rather than re-asking the model, which is the
   * point of having saved the payload. Falls back to re-asking when the entry
   * predates payloads, or when its entity has no binding yet (companies, until
   * Spec 3b) — those still work, they just cost a model call.
   */
  const openSaved = (entry: SavedQuery) => {
    const target = targetEntityOf(entry);
    if (entry.payload == null || !hasBinding(target)) {
      submit(entry.query);
      return;
    }
    const binding = bindingFor(target) as unknown as {
      route: string;
      serializeFilters(filters: unknown): string;
    };
    router.push(`${binding.route}${binding.serializeFilters(entry.payload)}`);
  };
```

Change both `onSelectQuery` props — on `AiSearchPanel` and on `CompactSearchBar` — from `(entry) => submit(entry.query)` to:

```tsx
        onSelectQuery={openSaved}
```

- [x] **Step 9: Confirm no caller of the old name survives**

Run: `grep -rn "AssistantPanel\|assistant-panel" --include=*.ts --include=*.tsx . | grep -v node_modules`
Expected: no output.

- [x] **Step 10: Verify it compiles and lints**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors`. This takes over two minutes — run it in the background.

- [x] **Step 11: Commit**

```bash
git add -A components/assistant components/crm/people-section.tsx components/events/event-list-view.tsx
git commit -m "feat(assistant): AIChatPanel reads its own filters from the URL"
```

---

### Task 13: Full verification

**Files:** none modified.

- [x] **Step 1: Run the full suite sequentially**

Run: `npx vitest run --no-file-parallelism`

Sequential is deliberate: `tests/integration/password-reset.test.ts` has a known
flake in its fetch-call-count assertions under heavy parallel I/O. It is
unrelated to this work and must not be "fixed" by editing
`services/auth.service.ts`, which awaits correctly.

Expected: all files pass, including the five new test files from Tasks 1, 2, 7 and 8.

- [x] **Step 2: Confirm Companies is untouched**

Run: `grep -n "companies" components/assistant/registry.ts`
Expected: only the `// companies lands in Spec 2c.` comment — `hasBinding('companies')` must still be false.

Run: `test -f app/api/companies/ask/route.ts && test -f app/api/events/search/route.ts && echo "both legacy routes intact"`
Expected: `both legacy routes intact`.

- [x] **Step 3: Confirm no handoff param collides**

Run: `grep -n "'ask'\|'via'\|'cid'" lib/events/filters.ts`
Expected: no output — Events must own none of the three.

- [x] **Step 4: Report; commit nothing**

Report the suite result and the three checks above.

Note for the reporter: the countdown's timing, the `popstate` subscription and
the scroll restoration are React and browser behaviour with no test harness in
this repo. Their pure inputs are covered; their wiring is not. A green suite is
not evidence that the countdown fires, that Cancel re-asks, or that browser back
restores filters — those need a manual pass on `/app/people` and `/app/events`,
which needs a real Supabase account since the app is gated.


---

## Execution notes (2026-08-22)

All thirteen tasks executed. Final state: **558 tests across 51 files**, `tsc
--noEmit` exit 0, `✔ No ESLint warnings or errors`.

### The spec was wrong about People, and the plan inherited it

Task 3 shipped a base64url `?pf=` blob for People, on the spec's statement that
`PeopleFilters` has "fifteen keys and eleven of them arrays" and that
enumerating them readably "buys nothing on a page nobody hand-edits".

People already had a readable URL codec. `components/crm/people-section.tsx`
carries a section comment reading *"URL as the single source of truth"* and has
been round-tripping through `lib/people/filters.ts` — `paramsToFilters` and
`serializePeopleQuery`, whose signatures are already exactly `PageBinding`'s
`parseFilters` and `serializeFilters`.

Shipping the blob would have put **two representations of the same state on one
page** — precisely the drift the spec's own Events decision exists to prevent —
and the panel and the rail would each have believed a different set of filters.
The binding now delegates, exactly as the events binding does. The delegated
codec is also strictly better: `paramsToFilters` validates against the closed
vocabulary, so a value the model invents or a user types into the address bar is
dropped rather than queried. That is Phase 4's enum-guard, already present for
People.

`lib/assistant/filter-params.ts` was deleted with its 12 tests. It had no
consumer but its own test file, and Spec 3b gives Companies a readable
`lib/companies/filters.ts` too, so it had no future consumer either.

**The lesson for Spec 3b:** check what the page already does before specifying a
new representation for it. Both times the spec proposed a codec, the page turned
out to have one.

### The handoff sentence arrives twice

`lib/assistant/stream.ts` puts `handoffLine()` on the route event as
`handoffMessage` *and* chunks the same string into tokens, so the typing
animation matches the model path. Task 11's badge renders the first; the
existing prose paragraph would have rendered the second, printing the sentence
twice. `assistant-message.tsx` suppresses the paragraph for navigate and confirm
turns. Confirmed against the live server: one `route` event carrying the
sentence, then twelve `token` events spelling out the same sentence.

### Two smaller corrections

`tsc` defaults to an ES5 target — the repo's `tsconfig.json` sets `lib` but no
`target` — so `for (const b of someUint8Array)` fails to compile while passing
under vitest's esbuild. Indexed loops only, for any byte iteration.

`reset()` in the provider did not clear the countdown timer. Left as written, a
reset mid-countdown would fire a navigation into a conversation that no longer
existed.

### Redundancy left in place deliberately

`components/events/event-list-view.tsx:125` still applies `pendingHandoff`
filters to the rail directly. Since Task 10 the same filters also arrive in the
URL, which that file parses on mount, so the two paths now agree and the effect
is redundant. It is not removed here: it works, it is guarded by its own
question-keyed ref, and removing it belongs with Spec 3b's consolidation rather
than with a rename.

### Unverified, by construction

The countdown firing, Cancel re-asking in place, `popstate`, scroll restoration
and the `?via=` back chip are React and browser behaviour with no test harness
in this repo. Their pure inputs are covered; their wiring is not. The app is
auth-gated and there is no seeded local password, so none of it has been seen in
a browser. A green suite is not evidence that any of it works on screen.

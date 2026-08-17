# Assistant Events Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Events page onto the shared assistant panel, backed by a single event-filter stack, and delete the two `/api/ai/*` routes plus the People chat transport Spec 2a orphaned.

**Architecture:** Spec 1's events adapter is rewritten so its filter type is `EventQueryState` (`{filters, search}`) and its search runs through `lib/events/filterEventList` — the same array-valued stack the Explorer rail already uses. That makes the events binding an identity pass-through. `events-section.tsx` splits along its four existing component seams, and `PageBinding` gains a row context so inline rows get real callbacks instead of the no-ops Spec 2a shipped.

**Tech Stack:** TypeScript, React 18, Next.js 14 App Router, Vitest (node environment).

**Spec:** `docs/superpowers/specs/2026-08-17-assistant-events-migration-design.md`

## Global Constraints

- **Do not add any dependency.** No jsdom, React Testing Library or Playwright; `CLAUDE.md` forbids installing packages. React components stay thin and untested.
- **Zero network calls in the test suite.** No Postgres, no `ANTHROPIC_API_KEY`.
- **The Spec 1 adapter contract suite must pass unchanged.** It is the signal that rewriting the events adapter did not break the boundary. If a contract case fails, fix the adapter — never relax the suite.
- **No adapter may emit a bare `0` when `total` is null.** Recompute instead of coercing.
- **`favouritesOnly` must NOT appear in the events `filterSchema`.** Favourites live in browser `localStorage`, so the server passes an empty set and the flag can never match. Exposing it would let the model set a filter that silently does nothing.
- **Do not modify** `app/api/companies/ask/route.ts`, `app/api/events/search/route.ts`, `services/event-query.service.ts`, `models/event-query.ts`, or `lib/find-shows/filter-events.ts`. Companies still calls them; Spec 2c owns their removal.
- **Do not touch** `components/crm/companies-section.tsx`. Spec 2c owns it.
- **`event-filters.test.ts` is kept permanently** — it covers the stack being adopted.
- **Every deletion is preceded by a grep proving zero references.** No file is removed on the assumption it is unused.
- Run one-shot tests with `npx vitest run <path>`. Never `npm test` (watch mode).
- `components/crm/people-section.tsx` carries uncommitted changes from before this work. Read before editing; preserve them.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `lib/events/answer.ts` | `buildEventAnswer` — templated prose over real counts |
| `components/assistant/bindings/events.tsx` | the events `PageBinding` |
| `components/events/events-inline-rows.tsx` | compact chat-friendly event rows |
| `components/events/event-filter-chip-row.tsx` | page-level chip row, extracted from `events-ai-search.tsx` |
| `components/events/event-detail-view.tsx` | moved from `events-section.tsx:82-336` |
| `components/events/exhibitor-detail-view.tsx` | moved from `events-section.tsx:337-471` |
| `components/events/ticket-booking-view.tsx` | moved from `events-section.tsx:472-706` |
| `components/events/event-list-view.tsx` | moved from `events-section.tsx:707-1029`, then rewired |

**Modify:**

| File | Change |
|---|---|
| `lib/assistant/adapters/events.ts` | rewritten onto `EventQueryState` |
| `components/assistant/types.ts` | `PageBinding<F, C>`; `renderRows(rows, context)` |
| `components/assistant/assistant-panel.tsx` | new `rowContext` prop, forwarded |
| `components/assistant/assistant-message.tsx` | forwards `rowContext` to the binding |
| `components/assistant/bindings/people.tsx` | real callbacks from context, not no-ops |
| `components/assistant/registry.ts` | register the events binding |
| `components/crm/events-section.tsx` | reduced to a ~40-line router |
| `components/crm/people-section.tsx` | pass `rowContext` |
| `CLAUDE.md` | document the single event-filter stack |

**Delete (Task 7):** `app/api/ai/event-query/route.ts`, `app/api/ai/event-answer/route.ts`, `services/ai-event-query.service.ts`, `models/ai-event-query.ts`, `components/events/events-ai-search.tsx`, `app/api/people/chat/route.ts`, `lib/people/chat-stream.ts`, `components/people/use-people-chat.ts`, `components/people/people-chat-panel.tsx`, `components/people/people-message.tsx`, `tests/integration/people-chat-route.test.ts`

**Tests:** `tests/integration/events-answer.test.ts` (new); `assistant-adapters.test.ts` and `assistant-bindings.test.ts` (extended)

---

### Task 1: `lib/events/answer.ts`

**Files:**
- Create: `lib/events/answer.ts`
- Test: `tests/integration/events-answer.test.ts`

**Interfaces:**
- Consumes: `EventFilters`, `EventQueryState` from `@/types/events` / `@/lib/events/filters`; `FindShowEvent` from `@/types/find-shows`
- Produces: `buildEventAnswer(input: { question: string; state: EventQueryState; matches: readonly FindShowEvent[]; total: number }): string`

Mirrors `lib/people/answer.ts`. `total` is always a real number — the adapter recomputes rather than passing null through.

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/events-answer.test.ts
import { describe, expect, it } from 'vitest';
import { buildEventAnswer } from '@/lib/events/answer';
import { emptyEventFilters } from '@/types/events';
import type { FindShowEvent } from '@/types/find-shows';

function event(overrides: Partial<FindShowEvent> = {}): FindShowEvent {
  return {
    slug: 's1',
    name: 'ANALYTICA',
    city: 'Munich',
    country: 'Germany',
    region: 'Europe',
    venue: 'Messe München',
    organizer: 'Messe München GmbH',
    displayDate: '24 - 27 Mar 2026',
    startDate: '2026-03-24',
    endDate: '2026-03-27',
    website: 'http://analytica.de',
    primaryCategory: 'Laboratory',
    categories: ['Laboratory'],
    searchText: 'analytica munich',
    seedAsset: { eventseyeUrl: null, bannerUrl: null, logoUrl: null },
    ...overrides,
  } as FindShowEvent;
}

const state = (overrides: Partial<ReturnType<typeof emptyEventFilters>> = {}, search = '') => ({
  filters: { ...emptyEventFilters(), ...overrides },
  search,
});

describe('buildEventAnswer', () => {
  it('reports the real total', () => {
    const text = buildEventAnswer({
      question: 'shows in Munich',
      state: state({ cities: ['Munich'] }),
      matches: [event()],
      total: 62,
    });
    expect(text).toContain('62');
  });

  it('singularises one match', () => {
    const text = buildEventAnswer({
      question: 'x',
      state: state(),
      matches: [event()],
      total: 1,
    });
    expect(text).toMatch(/1 trade show\b/);
    expect(text).not.toContain('1 trade shows');
  });

  it('names the places being filtered on', () => {
    const text = buildEventAnswer({
      question: 'x',
      state: state({ cities: ['Munich'], countries: ['Germany'] }),
      matches: [event()],
      total: 5,
    });
    expect(text).toContain('Munich');
    expect(text).toContain('Germany');
  });

  it('mentions the date range when one is set', () => {
    const text = buildEventAnswer({
      question: 'x',
      state: state({ dateFrom: '2026-03-01', dateTo: '2026-05-31' }),
      matches: [event()],
      total: 9,
    });
    expect(text).toMatch(/2026/);
  });

  it('summarises the dominant categories from the matched rows', () => {
    const text = buildEventAnswer({
      question: 'x',
      state: state(),
      matches: [
        event({ primaryCategory: 'Laboratory' }),
        event({ slug: 's2', primaryCategory: 'Laboratory' }),
        event({ slug: 's3', primaryCategory: 'Packaging' }),
      ],
      total: 3,
    });
    expect(text).toContain('Laboratory');
  });

  it('explains an empty result instead of reporting zero rows', () => {
    const text = buildEventAnswer({
      question: 'x',
      state: state({ cities: ['Nowhere'] }),
      matches: [],
      total: 0,
    });
    expect(text).toMatch(/no trade shows/i);
    expect(text.length).toBeGreaterThan(20);
  });

  it('never emits a bare 0 for a non-empty result', () => {
    const text = buildEventAnswer({
      question: 'x',
      state: state(),
      matches: [event()],
      total: 7,
    });
    expect(text).not.toMatch(/\b0\b/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/events-answer.test.ts`
Expected: FAIL — `Cannot find package '@/lib/events/answer'`

- [ ] **Step 3: Implement it**

```ts
// lib/events/answer.ts
import { EVENT_FILTER_LIST_KEYS, type EventFilters } from '@/types/events';
import type { FindShowEvent } from '@/types/find-shows';
import { formatDateRange } from '@/lib/events/chips';
import type { EventQueryState } from '@/lib/events/filters';

/**
 * Templated prose over real counts.
 *
 * This is the baseline answer, not a fallback: the panel must answer with no
 * ANTHROPIC_API_KEY configured. When a working key is present the LLM replaces
 * this text, but the wire format is identical, so the client never branches.
 *
 * Mirrors lib/people/answer.ts.
 */

function topValues(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value || value === '?') continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
    .slice(0, limit)
    .map((entry) => entry.value);
}

function listPhrase(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Where the filters point, in the order a person would say it. */
function placePhrase(filters: EventFilters): string {
  const places = [...filters.cities, ...filters.countries, ...filters.regions];
  return places.length > 0 ? ` in ${listPhrase(places)}` : '';
}

export function buildEventAnswer(input: {
  question: string;
  state: EventQueryState;
  matches: readonly FindShowEvent[];
  total: number;
}): string {
  const { state, matches, total } = input;
  const filters = state.filters;

  if (total === 0) {
    const anyList = EVENT_FILTER_LIST_KEYS.some((key) => filters[key].length > 0);
    const anyDate = Boolean(filters.dateFrom || filters.dateTo);
    if (anyDate) {
      return (
        'No trade shows match in that period. The catalog runs a few years out, ' +
        'so a narrow date window is the usual cause — try widening it, or drop ' +
        'the dates and filter by place instead.'
      );
    }
    if (anyList) {
      return (
        'No trade shows match those filters. Category and city are the two that ' +
        'most often empty a result set; relaxing either normally brings rows back.'
      );
    }
    return 'No trade shows match that search. Try a broader term, or filter by country instead.';
  }

  const parts: string[] = [
    `Found ${total} trade show${total === 1 ? '' : 's'}${placePhrase(filters)}`,
  ];

  const dates = formatDateRange(filters.dateFrom, filters.dateTo);
  if (dates) parts.push(`between ${dates}`);

  const sentence = `${parts.join(' ')}.`;

  const categories = topValues(
    matches.map((event) => event.primaryCategory),
    3
  );
  if (categories.length > 0) {
    return `${sentence} Mostly ${listPhrase(categories)}.`;
  }

  const organizers = topValues(
    matches.map((event) => event.organizer),
    2
  );
  if (organizers.length > 0) {
    return `${sentence} Run mainly by ${listPhrase(organizers)}.`;
  }

  return sentence;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/events-answer.test.ts`
Expected: PASS, 7 tests.

If the date-range test fails, check what `formatDateRange` returns for a two-sided range — read `lib/events/chips.ts:35` rather than guessing at the format.

- [ ] **Step 5: Commit**

```bash
git add lib/events/answer.ts tests/integration/events-answer.test.ts
git commit -m "feat(events): add templated answer prose over the array-valued filters"
```

---

### Task 2: Rewrite the events adapter onto `lib/events`

**Files:**
- Modify: `lib/assistant/adapters/events.ts` (full rewrite)
- Modify: `tests/integration/assistant-adapters.test.ts` (replace the `eventsAdapter` describe block)

**Interfaces:**
- Consumes: `filterEventList`, `type EventQueryState` from `@/lib/events/filters`; `buildEventFilterChips` from `@/lib/events/chips`; `buildEventAnswer` (Task 1); `findShowEvents` from `@/lib/find-shows/catalog`; `emptyEventFilters`, `EVENT_FILTER_LIST_KEYS`, `type EventFilters` from `@/types/events`
- Produces: `eventsAdapter: EntityAdapter<EventQueryState>`

The `AskEventFilters` type alias and every import from `@/models/event-query` and `@/lib/find-shows/filter-events` are removed from this file. Those modules stay on disk — Companies still uses them.

**`EMPTY_FAVOURITES`** is a module-level `new Set<string>()`: the server has no access to the browser's liked-events list, so `favouritesOnly` can never match server-side, which is why it is absent from `filterSchema`.

- [ ] **Step 1: Replace the events block in the adapter test**

In `tests/integration/assistant-adapters.test.ts`, replace the entire `describe('eventsAdapter', ...)` block with:

```ts
describe('eventsAdapter', () => {
  it('puts a plain question into the search field, not a keyword', () => {
    const state = eventsAdapter.parseLocally('trade shows in Munich', eventsAdapter.emptyFilters());
    expect(state.search).toBe('trade shows in Munich');
    expect(state.filters.keywords).toEqual([]);
  });

  it('starts from the shared empty filter shape', () => {
    const empty = eventsAdapter.emptyFilters();
    expect(empty.filters).toEqual(emptyEventFilters());
    expect(empty.search).toBe('');
  });

  it('searches the array-valued filters and returns a numeric total', async () => {
    const empty = eventsAdapter.emptyFilters();
    const result = await eventsAdapter.search(
      { ...empty, filters: { ...empty.filters, countries: ['Germany'] } },
      1
    );
    expect(typeof result.total).toBe('number');
    expect(result.total).toBeGreaterThan(0);
    expect(result.rows.length).toBeLessThanOrEqual(10);
  });

  it('matches on multiple values in one dimension', async () => {
    const empty = eventsAdapter.emptyFilters();
    const one = await eventsAdapter.search(
      { ...empty, filters: { ...empty.filters, countries: ['Germany'] } },
      1
    );
    const two = await eventsAdapter.search(
      { ...empty, filters: { ...empty.filters, countries: ['Germany', 'France'] } },
      1
    );
    // The scalar shape could not express this at all.
    expect(two.total as number).toBeGreaterThan(one.total as number);
  });

  it('pages without overlapping', async () => {
    const empty = eventsAdapter.emptyFilters();
    const first = await eventsAdapter.search(empty, 1);
    const second = await eventsAdapter.search(empty, 2);
    const firstSlugs = first.rows.map((r) => (r as { slug: string }).slug);
    const secondSlugs = second.rows.map((r) => (r as { slug: string }).slug);
    expect(firstSlugs.some((s) => secondSlugs.includes(s))).toBe(false);
  });

  it('carries country over as an array and drops people-only filters', () => {
    const { filters, dropped } = eventsAdapter.carryOver({
      country: 'Germany',
      verification: 'verified',
    });
    expect(filters.filters?.countries).toEqual(['Germany']);
    expect(dropped).toContain('verification');
  });

  it('unions carried-over values rather than replacing them', () => {
    const { filters } = eventsAdapter.carryOver({
      countries: ['Germany'],
      country: 'France',
    });
    expect(filters.filters?.countries).toEqual(expect.arrayContaining(['Germany', 'France']));
  });

  it('never returns a Person-shaped row', async () => {
    const result = await eventsAdapter.search(eventsAdapter.emptyFilters(), 1);
    for (const row of result.rows) {
      expect(row).not.toHaveProperty('firstName');
      expect(row).toHaveProperty('slug');
    }
  });

  it('builds chips from the shared chip builder', () => {
    const empty = eventsAdapter.emptyFilters();
    const chips = eventsAdapter.chips({
      ...empty,
      filters: { ...empty.filters, cities: ['Munich'] },
    });
    expect(chips.map((c) => c.value)).toContain('Munich');
    expect(chips.every((c) => typeof c.key === 'string')).toBe(true);
  });

  it('does not expose favouritesOnly to the model', () => {
    const properties = eventsAdapter.filterSchema.properties as Record<string, unknown>;
    // Favourites live in browser localStorage; the server passes an empty set,
    // so the flag could never match. Offering it would be a lie.
    expect(properties.favouritesOnly).toBeUndefined();
    expect(properties.countries).toBeDefined();
    expect(properties.dateFrom).toBeDefined();
  });

  it('exposes ISO date bounds rather than month integers', () => {
    const properties = eventsAdapter.filterSchema.properties as Record<string, unknown>;
    expect(properties.monthFrom).toBeUndefined();
    expect(properties.year).toBeUndefined();
  });
});
```

Add `emptyEventFilters` to the file's imports:

```ts
import { emptyEventFilters } from '@/types/events';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-adapters.test.ts`
Expected: FAIL — the adapter still has the scalar shape, so `emptyFilters().filters` is undefined and `parseLocally(...).search` is undefined.

- [ ] **Step 3: Rewrite the adapter**

Replace the entire contents of `lib/assistant/adapters/events.ts`:

```ts
import { findShowEvents } from '@/lib/find-shows/catalog';
import { buildEventFilterChips } from '@/lib/events/chips';
import { filterEventList, type EventQueryState } from '@/lib/events/filters';
import { buildEventAnswer } from '@/lib/events/answer';
import {
  EVENT_FILTER_LIST_KEYS,
  emptyEventFilters,
  type EventFilterListKey,
} from '@/types/events';
import { ENTITY_SIGNALS } from '../signals';
import type { EntityAdapter, FilterChip } from '../types';

const PAGE_SIZE = 10;

/**
 * The server has no access to the browser's liked-events list, which is where
 * favourites live (localStorage `pc_liked_events`). So `favouritesOnly` can
 * never match here — which is exactly why it is absent from `filterSchema`
 * below rather than offered to the model as a filter that does nothing.
 */
const EMPTY_FAVOURITES: ReadonlySet<string> = new Set<string>();

/** Keys this entity accepts from another page's filters, mapped to list keys. */
const CARRY_OVER_KEYS: Record<string, EventFilterListKey> = {
  country: 'countries',
  countries: 'countries',
  location: 'cities',
  locations: 'cities',
  city: 'cities',
  cities: 'cities',
  region: 'regions',
  regions: 'regions',
  industry: 'categories',
  industries: 'categories',
  category: 'categories',
  categories: 'categories',
  keyword: 'keywords',
  keywords: 'keywords',
};

function asList(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && !!v);
  return [];
}

export const eventsAdapter: EntityAdapter<EventQueryState> = {
  entity: 'events',
  signals: ENTITY_SIGNALS.events,

  filterSchema: {
    type: 'object',
    properties: {
      cities: { type: 'array', items: { type: 'string' }, description: 'Cities the show runs in.' },
      countries: { type: 'array', items: { type: 'string' } },
      regions: {
        type: 'array',
        items: { type: 'string' },
        description: 'e.g. "Europe", "Americas", "Asia-Pacific".',
      },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Industry categories of the show.',
      },
      organizers: { type: 'array', items: { type: 'string' } },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'Free text matched against the show name and description.',
      },
      dateFrom: {
        type: ['string', 'null'],
        description: 'Inclusive ISO YYYY-MM-DD lower bound on the run dates.',
      },
      dateTo: {
        type: ['string', 'null'],
        description: 'Inclusive ISO YYYY-MM-DD upper bound on the run dates.',
      },
      search: { type: 'string', description: 'Free text that fits no other field.' },
    },
    required: [],
  },

  emptyFilters() {
    return { filters: emptyEventFilters(), search: '' };
  },

  /**
   * No natural-language event parser exists outside the model path, so the
   * local fallback puts the whole message in `search` — which filterEventList
   * matches against the catalog's searchText. Weak but honest: it never invents
   * a filter the user did not ask for.
   */
  parseLocally(message, base) {
    const search = message.trim();
    return { ...base, search: search || base.search };
  },

  carryOver(foreign) {
    const filters = emptyEventFilters();
    const dropped: string[] = [];
    let touched = false;

    for (const [key, value] of Object.entries(foreign)) {
      const values = asList(value);
      if (values.length === 0) continue;
      const target = CARRY_OVER_KEYS[key];
      if (!target) {
        // Dropped, never guessed — the caller is told so it can say what it lost.
        dropped.push(key);
        continue;
      }
      filters[target] = Array.from(new Set(filters[target].concat(values)));
      touched = true;
    }

    return { filters: touched ? { filters } : {}, dropped };
  },

  async search(state, page) {
    const matches = filterEventList(
      findShowEvents,
      state.filters,
      state.search,
      EMPTY_FAVOURITES
    );
    const start = Math.max(0, (page - 1) * PAGE_SIZE);
    return { rows: matches.slice(start, start + PAGE_SIZE), total: matches.length };
  },

  chips(state): FilterChip[] {
    return buildEventFilterChips(state.filters, state.search).map((chip) => ({
      key: chip.id,
      label: chip.label,
      value: chip.value,
    }));
  },

  /**
   * Events can be counted cheaply, so a null total is recomputed rather than
   * reported as zero — "No trade shows found" for an uncounted filter set
   * would be a confident falsehood.
   */
  describe(state, total) {
    const matches = filterEventList(
      findShowEvents,
      state.filters,
      state.search,
      EMPTY_FAVOURITES
    );
    return buildEventAnswer({
      question: '',
      state,
      matches: matches.slice(0, PAGE_SIZE),
      total: total ?? matches.length,
    });
  },

  suggest(state, total) {
    const items: string[] = [];
    if (total === null || total > PAGE_SIZE) items.push('Show me more');
    if (state.filters.categories.length === 0) items.push('Filter by industry category');
    if (state.filters.countries.length === 0 && state.filters.cities.length === 0) {
      items.push('Narrow to one country');
    }
    if (items.length < 3) items.push('Companies exhibiting at these events');
    return items.slice(0, 3);
  },
};
```

- [ ] **Step 4: Run the adapter tests including the contract suite**

Run: `npx vitest run tests/integration/assistant-adapters.test.ts`
Expected: PASS. The `EntityAdapter contract` describe block must pass **unchanged** — that is the signal the boundary survived. In particular `%s never renders a bare 0 when total is null` must still hold for events, which is why `describe()` recomputes.

- [ ] **Step 5: Run every dependent suite**

Run: `npx vitest run tests/integration/assistant-carry-over.test.ts tests/integration/assistant-stream.test.ts tests/integration/assistant-force-entity.test.ts tests/integration/assistant-route.test.ts`
Expected: PASS.

`assistant-carry-over.test.ts` asserts `out.filters.country === 'Germany'` for a companies→events translation. That is now `out.filters.filters.countries === ['Germany']`. Update those two assertions in that file — the behaviour is unchanged, only the shape.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add lib/assistant/adapters/events.ts tests/integration/assistant-adapters.test.ts tests/integration/assistant-carry-over.test.ts
git commit -m "refactor(assistant): rewrite the events adapter onto the array-valued lib/events stack

One filter shape now backs both the Explorer rail and the assistant.
favouritesOnly is deliberately absent from the tool schema: favourites
live in browser localStorage, so the server could never match it."
```

---

### Task 3: `PageBinding` gains a row context

**Files:**
- Modify: `components/assistant/types.ts`, `components/assistant/assistant-panel.tsx`, `components/assistant/assistant-message.tsx`, `components/assistant/bindings/people.tsx`, `components/assistant/registry.ts`, `components/crm/people-section.tsx`
- Modify: `tests/integration/assistant-bindings.test.ts`

**Interfaces:**
- Produces:
  - `type PageBinding<F, C = unknown>` with `renderRows(rows: unknown[], context: C): ReactNode`
  - `type PeopleRowContext = { selectedIds: ReadonlySet<string>; savedIds: ReadonlySet<string>; onToggleSelect(id: string): void; onToggleSaved(person: Person): void; onOpenPerson(person: Person): void }`
  - `AssistantPanel` gains `rowContext?: unknown`

**Why:** Spec 2a's people binding renders `onToggleSelect={() => {}}`, `onToggleSaved={() => {}}`, `onOpenPerson={() => {}}` — visible controls that do nothing when clicked. The context is opaque in the middle (the panel forwards it without inspecting it), exactly as the registry already treats filter shapes.

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/assistant-bindings.test.ts`:

```ts
import type { PeopleRowContext } from '@/components/assistant/bindings/people';

describe('peopleBinding — row context', () => {
  it('renderRows takes a context argument', () => {
    // Two parameters: the rows, and the page's own handlers. A one-parameter
    // signature is what forced the no-op callbacks this replaces.
    expect(peopleBinding.renderRows.length).toBe(2);
  });

  it('the context type carries real handlers, not placeholders', () => {
    const context: PeopleRowContext = {
      selectedIds: new Set(['p1']),
      savedIds: new Set(['p2']),
      onToggleSelect: () => {},
      onToggleSaved: () => {},
      onOpenPerson: () => {},
    };
    // Compile-time assertion, plus a runtime shape check so a renamed field
    // fails here rather than silently rendering inert controls.
    expect(Object.keys(context).sort()).toEqual([
      'onOpenPerson',
      'onToggleSaved',
      'onToggleSelect',
      'savedIds',
      'selectedIds',
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-bindings.test.ts`
Expected: FAIL — `renderRows.length` is 1, and `PeopleRowContext` is not exported.

- [ ] **Step 3: Widen the `PageBinding` type**

In `components/assistant/types.ts`, replace the `PageBinding` declaration:

```ts
/**
 * The client twin of Spec 1's EntityAdapter.
 *
 * `C` is the page's own row-interaction context — selection sets and handlers
 * the page already owns. It is opaque to the panel, which forwards it without
 * inspecting it, so each page/binding pair stays type-safe while the panel
 * stays entity-agnostic.
 */
export type PageBinding<F, C = unknown> = {
  entity: AssistantEntity;
  /** Where navigation sends the user, e.g. "/app/people". */
  route: string;
  emptyFilters(): F;
  /** Incoming keys replace conflicting ones; unrelated current filters survive. */
  applyFilters(current: F, incoming: Partial<F>): F;
  renderRows(rows: unknown[], context: C): ReactNode;
};
```

- [ ] **Step 4: Give the people binding real callbacks**

Replace `components/assistant/bindings/people.tsx`:

```tsx
"use client";

import { PeopleResultsTable } from '@/components/people/people-results-table';
import { emptyPeopleFilters, type PeopleFilters, type Person } from '@/types/people';
import type { PageBinding } from '../types';

/** The handlers and selection state the People page already owns. */
export type PeopleRowContext = {
  selectedIds: ReadonlySet<string>;
  savedIds: ReadonlySet<string>;
  onToggleSelect(id: string): void;
  onToggleSaved(person: Person): void;
  onOpenPerson(person: Person): void;
};

const EMPTY_CONTEXT: PeopleRowContext = {
  selectedIds: new Set(),
  savedIds: new Set(),
  onToggleSelect: () => {},
  onToggleSaved: () => {},
  onOpenPerson: () => {},
};

/**
 * Replace-the-conflicting-key semantics live here rather than in shared code
 * because the shapes differ per entity: people's filters are array-valued,
 * events' are nested under `filters`. A generic merge would have to guess.
 */
export const peopleBinding: PageBinding<PeopleFilters, PeopleRowContext> = {
  entity: 'people',
  route: '/app/people',

  emptyFilters: emptyPeopleFilters,

  applyFilters(current, incoming) {
    // Only keys actually present in `incoming` are replaced — an absent key
    // leaves the user's own filter alone, while an explicit [] clears it.
    return { ...current, ...incoming };
  },

  renderRows(rows, context) {
    // EMPTY_CONTEXT is a defensive default for a page that forgets to pass one;
    // the controls are then inert, which is why every page must pass a real one.
    const ctx = context ?? EMPTY_CONTEXT;
    return (
      <PeopleResultsTable
        people={rows as Person[]}
        selectedIds={ctx.selectedIds as Set<string>}
        savedIds={ctx.savedIds as Set<string>}
        onToggleSelect={ctx.onToggleSelect}
        onToggleSaved={ctx.onToggleSaved}
        onOpenPerson={ctx.onOpenPerson}
      />
    );
  },
};
```

- [ ] **Step 5: Widen the registry**

In `components/assistant/registry.ts`, change the alias:

```ts
type AnyBinding = PageBinding<never, never>;
```

- [ ] **Step 6: Forward the context through the panel and message**

In `components/assistant/assistant-message.tsx`, add a `rowContext` prop and pass it to `renderRows`:

```tsx
export function AssistantMessage({
  message,
  rowContext,
  onSuggestion,
  onRetry,
}: {
  message: ConversationMessage;
  rowContext?: unknown;
  onSuggestion: (text: string) => void;
  onRetry: () => void;
}) {
```

and change the render call:

```tsx
          {bindingFor(entity).renderRows(message.rows, rowContext as never)}
```

In `components/assistant/assistant-panel.tsx`, add the prop to the signature:

```tsx
export function AssistantPanel({
  currentPage,
  activeFilters,
  rowContext,
  onGoBack,
}: {
  currentPage: AssistantEntity;
  activeFilters?: Record<string, unknown>;
  /** The page's own row handlers, forwarded opaquely to its binding. */
  rowContext?: unknown;
  onGoBack: (entity: AssistantEntity, filters: unknown) => void;
}) {
```

and pass it down:

```tsx
          <AssistantMessage
            key={message.id}
            message={message}
            rowContext={rowContext}
            onSuggestion={submit}
            onRetry={chat.retry}
          />
```

- [ ] **Step 7: Pass the real context from the People page**

In `components/crm/people-section.tsx`, add `rowContext` to the `AssistantPanel` element — these handlers all already exist in that component:

```tsx
            <AssistantPanel
              currentPage="people"
              activeFilters={filters as unknown as Record<string, unknown>}
              rowContext={{
                selectedIds,
                savedIds,
                onToggleSelect: toggleSelect,
                onToggleSaved: toggleSaved,
                onOpenPerson: setOpenPerson,
              }}
              onGoBack={(entity, sourceFilters) => {
                if (entity === "people" && sourceFilters) {
                  applyFilters(
                    peopleBinding.applyFilters(filters, sourceFilters as Partial<PeopleFilters>)
                  );
                }
              }}
            />
```

- [ ] **Step 8: Run the tests and typecheck**

Run: `npx vitest run tests/integration/assistant-bindings.test.ts`
Expected: PASS, 10 tests.

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add components/assistant/types.ts components/assistant/registry.ts components/assistant/bindings/people.tsx components/assistant/assistant-panel.tsx components/assistant/assistant-message.tsx components/crm/people-section.tsx tests/integration/assistant-bindings.test.ts
git commit -m "fix(assistant): give inline rows real callbacks via a page row context

Spec 2a rendered selection checkboxes and a save button wired to no-ops —
visible controls that did nothing. PageBinding now takes a context the
page supplies, opaque to the panel."
```

---

### Task 4: The events binding and inline rows

**Files:**
- Create: `components/assistant/bindings/events.tsx`, `components/events/events-inline-rows.tsx`
- Modify: `components/assistant/registry.ts`
- Modify: `tests/integration/assistant-bindings.test.ts`

**Interfaces:**
- Consumes: `PageBinding` (Task 3); `EventQueryState` from `@/lib/events/filters`; `emptyEventFilters` from `@/types/events`
- Produces:
  - `eventsBinding: PageBinding<EventQueryState, EventRowContext>`
  - `type EventRowContext = { likedIds: ReadonlySet<string>; targetIds: ReadonlySet<string>; onToggleLike(slug: string): void; onToggleTarget(slug: string): void }`
  - `EventsInlineRows({ events, likedIds, targetIds, onToggleLike, onToggleTarget })`

**`applyFilters` must merge the nested `filters` object key-wise**, not replace it wholesale — otherwise an incoming `countries` would wipe the user's `categories`.

**Why a new inline component:** `EventsResultsTable` requires `totalMatched`, `page`, `pageSize`, `onPageChange`, `chips`, `onRemoveChip`, `onClearAll`. Rendering it in a chat bubble would put a pagination bar and a second chip row inside the message, duplicating the chips the turn already shows.

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/assistant-bindings.test.ts`:

```ts
import { eventsBinding } from '@/components/assistant/bindings/events';
import { emptyEventFilters } from '@/types/events';

describe('eventsBinding', () => {
  it('declares its entity and route', () => {
    expect(eventsBinding.entity).toBe('events');
    expect(eventsBinding.route).toBe('/app/events');
  });

  it('starts from the shared empty query state', () => {
    const empty = eventsBinding.emptyFilters();
    expect(empty.filters).toEqual(emptyEventFilters());
    expect(empty.search).toBe('');
  });

  it('merges the nested filters key-wise rather than replacing the object', () => {
    const current = {
      filters: { ...emptyEventFilters(), countries: ['France'], categories: ['Packaging'] },
      search: 'expo',
    };

    const next = eventsBinding.applyFilters(current, {
      filters: { ...emptyEventFilters(), countries: ['Germany'] },
    });

    expect(next.filters.countries).toEqual(['Germany']); // replaced
    expect(next.filters.categories).toEqual(['Packaging']); // preserved
    expect(next.search).toBe('expo'); // preserved
  });

  it('replaces search when it is supplied', () => {
    const current = { filters: emptyEventFilters(), search: 'old' };
    expect(eventsBinding.applyFilters(current, { search: 'new' }).search).toBe('new');
  });

  it('leaves search alone when it is absent', () => {
    const current = { filters: emptyEventFilters(), search: 'old' };
    expect(
      eventsBinding.applyFilters(current, { filters: emptyEventFilters() }).search
    ).toBe('old');
  });

  it('accepts an explicit empty array as a real clear', () => {
    const current = { filters: { ...emptyEventFilters(), countries: ['France'] }, search: '' };
    const next = eventsBinding.applyFilters(current, {
      filters: { ...emptyEventFilters(), countries: [] },
    });
    expect(next.filters.countries).toEqual([]);
  });

  it('renderRows takes a context argument', () => {
    expect(eventsBinding.renderRows.length).toBe(2);
  });
});

describe('registry — events registered', () => {
  it('no longer throws for events', () => {
    expect(bindingFor('events').entity).toBe('events');
  });

  it('still throws for companies, which lands in Spec 2c', () => {
    expect(() => bindingFor('companies')).toThrow(/no binding/i);
  });
});
```

The existing `registry` block asserts `bindingFor('events')` throws and that the test seam resets to throwing. Update those two cases to use `'companies'` instead of `'events'` — events is now registered.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/assistant-bindings.test.ts`
Expected: FAIL — `Cannot find package '@/components/assistant/bindings/events'`

- [ ] **Step 3: Create the inline rows component**

```tsx
// components/events/events-inline-rows.tsx
"use client";

import { Heart, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FindShowEvent } from '@/types/find-shows';

/**
 * Compact event rows for a chat answer.
 *
 * Deliberately not EventsResultsTable: that component owns pagination, a chip
 * row and clear-all, all of which would duplicate what the message and the rail
 * already show.
 */
export function EventsInlineRows({
  events,
  likedIds,
  targetIds,
  onToggleLike,
  onToggleTarget,
}: {
  events: FindShowEvent[];
  likedIds: ReadonlySet<string>;
  targetIds: ReadonlySet<string>;
  onToggleLike: (slug: string) => void;
  onToggleTarget: (slug: string) => void;
}) {
  if (events.length === 0) {
    return (
      <p className="px-3 py-4 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
        No trade shows match — try widening the dates or dropping a category.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[#E2E8F0] dark:divide-[#22304A]">
      {events.map((event) => (
        <li key={event.slug} className="flex items-center gap-3 px-3 py-2.5">
          {event.seedAsset.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.seedAsset.logoUrl}
              alt=""
              className="h-7 w-7 shrink-0 rounded object-contain"
            />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#F1F5F9] text-[11px] font-semibold text-[#475569] dark:bg-[#1B2942] dark:text-[#94A3B8]">
              {event.name.slice(0, 2).toUpperCase()}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[#0F172A] dark:text-[#E2E8F0]">
              {event.name}
            </p>
            <p className="truncate text-[12px] text-[#64748B] dark:text-[#94A3B8]">
              {event.city}, {event.country} · {event.displayDate} · {event.primaryCategory}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onToggleLike(event.slug)}
            aria-label={likedIds.has(event.slug) ? 'Unlike' : 'Like'}
            className="shrink-0 p-1"
          >
            <Heart
              className={cn(
                'h-4 w-4',
                likedIds.has(event.slug) ? 'fill-[#E11D48] text-[#E11D48]' : 'text-[#94A3B8]'
              )}
            />
          </button>

          <button
            type="button"
            onClick={() => onToggleTarget(event.slug)}
            aria-label={targetIds.has(event.slug) ? 'Remove target' : 'Add target'}
            className="shrink-0 p-1"
          >
            <Target
              className={cn(
                'h-4 w-4',
                targetIds.has(event.slug) ? 'text-[#1B6DFF]' : 'text-[#94A3B8]'
              )}
            />
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Create the binding**

```tsx
// components/assistant/bindings/events.tsx
"use client";

import { EventsInlineRows } from '@/components/events/events-inline-rows';
import type { EventQueryState } from '@/lib/events/filters';
import { emptyEventFilters } from '@/types/events';
import type { FindShowEvent } from '@/types/find-shows';
import type { PageBinding } from '../types';

/** The liked/target sets and toggles the Events page already owns. */
export type EventRowContext = {
  likedIds: ReadonlySet<string>;
  targetIds: ReadonlySet<string>;
  onToggleLike(slug: string): void;
  onToggleTarget(slug: string): void;
};

const EMPTY_CONTEXT: EventRowContext = {
  likedIds: new Set(),
  targetIds: new Set(),
  onToggleLike: () => {},
  onToggleTarget: () => {},
};

export const eventsBinding: PageBinding<EventQueryState, EventRowContext> = {
  entity: 'events',
  route: '/app/events',

  emptyFilters() {
    return { filters: emptyEventFilters(), search: '' };
  },

  /**
   * The nested `filters` object is merged PER KEY over the incoming object's own
   * keys — never `{...current.filters, ...incoming.filters}`.
   *
   * That spread looks equivalent and is not: a caller that builds `incoming`
   * from `emptyEventFilters()` carries an empty array for every dimension, so
   * the spread would silently clear every filter the user set by hand in the
   * rail. Iterating the incoming object's own keys replaces exactly what the
   * caller named — including an explicit `[]`, which is a real clear.
   *
   * `search` is replaced only when supplied.
   */
  applyFilters(current, incoming) {
    const filters = { ...current.filters };
    if (incoming.filters) {
      for (const key of Object.keys(incoming.filters) as (keyof EventFilters)[]) {
        (filters[key] as unknown) = incoming.filters[key];
      }
    }
    return {
      filters,
      search: incoming.search !== undefined ? incoming.search : current.search,
    };
  },

  renderRows(rows, context) {
    const ctx = context ?? EMPTY_CONTEXT;
    return (
      <EventsInlineRows
        events={rows as FindShowEvent[]}
        likedIds={ctx.likedIds}
        targetIds={ctx.targetIds}
        onToggleLike={ctx.onToggleLike}
        onToggleTarget={ctx.onToggleTarget}
      />
    );
  },
};
```

Add `EventFilters` to the type imports in that file:

```tsx
import { emptyEventFilters, type EventFilters } from '@/types/events';
```

- [ ] **Step 5: Register the binding**

In `components/assistant/registry.ts`:

```ts
import { eventsBinding } from './bindings/events';
...
const defaults: Partial<Record<AssistantEntity, AnyBinding>> = {
  people: peopleBinding as unknown as AnyBinding,
  events: eventsBinding as unknown as AnyBinding,
  // companies lands in Spec 2c.
};
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/integration/assistant-bindings.test.ts`
Expected: PASS, 19 tests.

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add components/assistant/bindings/events.tsx components/events/events-inline-rows.tsx components/assistant/registry.ts tests/integration/assistant-bindings.test.ts
git commit -m "feat(assistant): add the events binding and compact inline event rows"
```

---

### Task 5: Split `events-section.tsx` — no behaviour change

**Files:**
- Create: `components/events/event-detail-view.tsx`, `components/events/exhibitor-detail-view.tsx`, `components/events/ticket-booking-view.tsx`, `components/events/event-list-view.tsx`
- Modify: `components/crm/events-section.tsx` (reduced to a router)

**Interfaces:**
- Produces: `EventDetailView({ event })`, `ExhibitorDetailView({ exhibitor, event, onBack })`, `TicketBookingView({ event, onBack })`, `EventListView({ mode })`

**This task moves code without changing it.** Do not fix, rename or improve anything while moving — a behaviour change hidden inside a 900-line move is unreviewable. Task 6 changes `EventListView`.

- [ ] **Step 1: Record the baseline**

Run: `npx vitest run`
Expected: note the pass count. It must be identical at the end of this task.

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Move the three detail views**

For each of the three, create the new file with `"use client";` at the top, move the function body verbatim from `components/crm/events-section.tsx`, add `export` to the function declaration, and copy across only the imports it actually uses:

- `components/events/event-detail-view.tsx` ← lines 82–336 (`EventDetailView`)
- `components/events/exhibitor-detail-view.tsx` ← lines 337–471 (`ExhibitorDetailView`)
- `components/events/ticket-booking-view.tsx` ← lines 472–706 (`TicketBookingView`)

`EventDetailView` renders `ExhibitorDetailView` and `TicketBookingView`, so it imports them from their new paths.

- [ ] **Step 3: Move the list view**

Create `components/events/event-list-view.tsx` with `"use client";`, and move:

- `const PAGE_SIZE = 25;` (line 707)
- `function readSlugSet(...)` (lines 711–722)
- `function EventListView(...)` (lines 723–1029), exported

Leave `ANSWER_ROW_LIMIT` (line 709) behind — Task 6 deletes the code that uses it. If it is unreferenced after this move, delete it now.

- [ ] **Step 4: Reduce events-section.tsx to a router**

Replace the whole file with the router plus its imports:

```tsx
"use client";

import { EventDetailView } from '@/components/events/event-detail-view';
import { EventListView } from '@/components/events/event-list-view';
import { findShowEvents } from '@/lib/find-shows/catalog';
import type { WorkspacePreferences } from '@/types/index';

type EventsSectionProps = {
  eventId?: string;
  preferences?: WorkspacePreferences;
  mode?: 'all' | 'target';
};

/**
 * Routes between the catalog list and a single event's detail view. Each view
 * lives in its own file under components/events/.
 */
export function EventsSection({ eventId, mode = 'all' }: EventsSectionProps) {
  if (eventId) {
    const event = findShowEvents.find((candidate) => candidate.slug === eventId);
    if (event) return <EventDetailView event={event} />;
  }
  return <EventListView mode={mode} />;
}
```

Read lines 62–81 of the original before writing this — the real `EventsSection` may use `preferences` or handle a missing event differently. **Preserve its actual behaviour**; the shape above is the expected result, not a licence to change routing.

- [ ] **Step 5: Verify nothing changed**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx vitest run`
Expected: the **same pass count** as Step 1.

Run: `npm run lint`
Expected: no new warnings. The pre-existing error in `components/crm/companies-section.tsx:994` is expected.

- [ ] **Step 6: Commit**

```bash
git add components/crm/events-section.tsx components/events/event-detail-view.tsx components/events/exhibitor-detail-view.tsx components/events/ticket-booking-view.tsx components/events/event-list-view.tsx
git commit -m "refactor(events): split events-section into its four view components

Pure move, no behaviour change: events-section.tsx is now a router."
```

---

### Task 6: Wire the assistant into the Events page

**Files:**
- Create: `components/events/event-filter-chip-row.tsx`
- Modify: `components/events/event-list-view.tsx`

**Interfaces:**
- Consumes: `AssistantPanel`, `eventsBinding` (Task 4)
- Produces: `EventFilterChipRow({ chips, onRemove, onClearAll })`

**Two things `EventsAiSearch` owns that must survive it.** It is rendered at **two** call sites (a `hero` variant and a `compact` variant), and its compact variant owns the **page-level chip row** with `onRemoveChip`/`onClearAll`. `AssistantPanel` renders chips per message, not for the rail. Deleting `EventsAiSearch` without extracting that row would remove click-to-remove-filter — a regression.

- [ ] **Step 1: Extract the chip row**

Read the chip-row markup out of `components/events/events-ai-search.tsx` (the `compact` variant) and move it verbatim into:

```tsx
// components/events/event-filter-chip-row.tsx
"use client";

import { X } from 'lucide-react';
import type { EventFilterChip } from '@/lib/events/chips';

/**
 * The rail's applied filters, as removable chips.
 *
 * Extracted from events-ai-search.tsx, which owned this row alongside its
 * search box. AssistantPanel renders chips per message; this row reflects the
 * page's own filter state, so it outlives that component.
 */
export function EventFilterChipRow({
  chips,
  onRemove,
  onClearAll,
}: {
  chips: EventFilterChip[];
  onRemove: (chipId: string) => void;
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onRemove(chip.id)}
          className="flex items-center gap-1 rounded-full border border-[#E2E8F0] px-2.5 py-1 text-[12px] text-[#475569] hover:bg-[#F8FAFC] dark:border-[#22304A] dark:text-[#94A3B8] dark:hover:bg-[#111B2E]"
        >
          <span className="text-[#94A3B8]">{chip.label}:</span>
          {chip.value}
          <X className="h-3 w-3" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="px-2 py-1 text-[12px] text-[#64748B] underline dark:text-[#94A3B8]"
      >
        Clear all
      </button>
    </div>
  );
}
```

If the original markup differs, prefer the original — this is a move, and the page should look the same afterwards.

- [ ] **Step 2: Remove the second-call answer machinery**

In `components/events/event-list-view.tsx`, delete:

- the `question`, `answer` and `isAnswering` state declarations
- the whole `useEffect` that POSTs to `/api/ai/event-answer` (and the `EventAnswerRow` import it uses)
- the `asked` parameter handling in `applyQueryState`, and the `setQuestion`/`setAnswer` calls in `clearAll` and `clearQuery`

`applyQueryState` becomes:

```tsx
    const applyQueryState = useCallback((next: EventQueryState) => {
        setQueryState(next);
        setPage(1);
    }, []);
```

`isSearchActive` loses its `question !== null` term:

```tsx
    // The hero and the results share one slot. Anything narrowing the catalog
    // means the rows are what the user came for, so the pitch collapses to a
    // one-line bar. Target Events is a curated list rather than a search, so it
    // skips the hero entirely.
    const isSearchActive = mode === 'target' || chips.length > 0;
```

- [ ] **Step 3: Replace both `EventsAiSearch` call sites**

Both become the same element — `AssistantPanel` handles its own hero/compact states internally, so the `variant` distinction disappears:

```tsx
<AssistantPanel
  currentPage="events"
  activeFilters={queryState as unknown as Record<string, unknown>}
  rowContext={{
    likedIds,
    targetIds,
    onToggleLike: toggleLike,
    onToggleTarget: toggleTarget,
  }}
  onGoBack={(entity, sourceFilters) => {
    // Spec 2b binds People and Events; a back-jump to Companies arrives in 2c.
    if (entity === 'events' && sourceFilters) {
      applyQueryState(
        eventsBinding.applyFilters(queryState, sourceFilters as Partial<EventQueryState>)
      );
    }
  }}
/>
```

Render `<EventFilterChipRow chips={chips} onRemove={removeChip} onClearAll={clearAll} />` immediately beneath the panel in the compact/active branch, where the chip row used to sit.

Add the imports:

```tsx
import { AssistantPanel } from '@/components/assistant/assistant-panel';
import { eventsBinding } from '@/components/assistant/bindings/events';
import { EventFilterChipRow } from '@/components/events/event-filter-chip-row';
```

and remove the `EventsAiSearch` import.

- [ ] **Step 4: Apply an incoming handoff's filters**

The provider issues phase two on arrival, but the **rail** must also reflect the handoff's filters. Add one effect, keyed so it runs once per handoff:

```tsx
    const { state: conversation } = useAssistantConversation();
    const appliedHandoffRef = useRef<string | null>(null);

    // A handoff carries filters the rail must show, not just the panel. Keyed by
    // the question so a second handoff for the same target still applies.
    useEffect(() => {
        const handoff = conversation.pendingHandoff;
        if (!handoff || handoff.to !== 'events' || !handoff.presetFilters) return;
        const key = `${handoff.to}:${handoff.message}`;
        if (appliedHandoffRef.current === key) return;
        appliedHandoffRef.current = key;
        setQueryState((prev) =>
            eventsBinding.applyFilters(prev, handoff.presetFilters as Partial<EventQueryState>)
        );
        setPage(1);
    }, [conversation.pendingHandoff]);
```

Import `useAssistantConversation` from `@/components/assistant/assistant-provider` and `useRef` from React.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx vitest run`
Expected: same pass count as Task 5 — no test covers these components.

- [ ] **Step 6: Commit**

```bash
git add components/events/event-list-view.tsx components/events/event-filter-chip-row.tsx
git commit -m "feat(events): move the Events page onto the shared assistant panel

Extracts the page-level chip row from events-ai-search.tsx, which owned
it alongside its search box; without that the rail would lose
click-to-remove-filter."
```

---

### Task 7: Teardown

**Files:**
- Delete: 11 files, in the order below

**Every deletion is preceded by a grep proving zero references.** If a grep finds a reference, stop — do not delete, and report it.

- [ ] **Step 1: Prove the Events AI stack is unreferenced**

```bash
git grep -n "events-ai-search\|EventsAiSearch" -- components app lib
git grep -n "api/ai/event-query\|api/ai/event-answer" -- components app lib
git grep -n "ai-event-query" -- components app lib services models tests
```

Expected: **empty** for the first two. The third may match `services/ai-event-query.service.ts` and `models/ai-event-query.ts` referencing each other, plus the two route files — all four are about to be deleted together.

- [ ] **Step 2: Delete the Events AI stack**

```bash
git rm app/api/ai/event-query/route.ts app/api/ai/event-answer/route.ts
git rm services/ai-event-query.service.ts models/ai-event-query.ts
git rm components/events/events-ai-search.tsx
git rm -r --ignore-unmatch app/api/ai
```

The last command removes the now-empty `app/api/ai` directory if both routes were its only contents.

- [ ] **Step 3: Prove the People chat transport is unreferenced**

```bash
git grep -n "usePeopleChat\|PeopleChatPanel\|PeopleMessage" -- components app lib
git grep -n "api/people/chat\|chat-stream" -- components app lib
```

Expected: **empty** except prose comments. Spec 2a orphaned these; a code reference here means something still uses them — stop and report.

- [ ] **Step 4: Delete the People chat transport**

```bash
git rm app/api/people/chat/route.ts lib/people/chat-stream.ts
git rm components/people/use-people-chat.ts components/people/people-chat-panel.tsx components/people/people-message.tsx
git rm tests/integration/people-chat-route.test.ts
```

**Do not delete any other `lib/people/*` module.** `data`, `filters`, `parse-query`, `answer`, `chips`, `lookalikes`, `vocabulary` and `saved-store` all back the people adapter.

- [ ] **Step 5: Verify nothing broke**

Run: `npx tsc --noEmit`
Expected: clean. A missing-module error means a reference the greps missed — restore that file and investigate.

Run: `npx vitest run`
Expected: pass count drops by exactly the number of tests in the deleted `people-chat-route.test.ts`, and nothing else fails.

- [ ] **Step 6: Confirm the surviving legacy modules are untouched**

```bash
git status --short -- app/api/companies/ask app/api/events/search services/event-query.service.ts models/event-query.ts lib/find-shows/filter-events.ts
```

Expected: **empty output** — Companies still needs all five, and Spec 2c owns them.

- [ ] **Step 7: Commit**

```bash
git commit -m "chore(assistant): delete the Events AI stack and the orphaned People chat transport

Every removal verified unreferenced first. /api/companies/ask,
/api/events/search and the find-shows scalar filter path survive: the
Companies page still calls them, and Spec 2c owns their removal."
```

---

### Task 8: Verification and documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: all pass except the known pre-existing `tests/e2e/auth.spec.ts` (a Playwright spec caught by vitest's `tests/**/*.spec.ts` glob; Playwright is not installed).

Confirm these are green:
- `tests/integration/assistant-adapters.test.ts` — including the unchanged contract suite
- `tests/integration/assistant-bindings.test.ts`
- `tests/integration/events-answer.test.ts`
- `tests/integration/event-filters.test.ts` — the adopted stack
- `tests/integration/companies-ask-route.test.ts`, `event-search-route.test.ts`, `event-query-filter.test.ts` — the surviving legacy paths

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run lint`
Expected: no new warnings. Pre-existing error in `components/crm/companies-section.tsx:994` expected.

- [ ] **Step 3: Confirm this work did not touch Companies' routes**

```bash
git log --oneline dee7bc4..HEAD -- app/api/companies/ask app/api/events/search services/event-query.service.ts models/event-query.ts lib/find-shows/filter-events.ts components/crm/companies-section.tsx
```

Expected: **empty output.** Use `git log` over this work's commits, **not** `git diff` against `main` — this feature branch adds several of those files, so a diff would report them as changed even when untouched.

- [ ] **Step 4: Drive the real cross-page handoff**

This is the first time the full handoff can be exercised: Spec 2a proved both halves over HTTP but could not join them, because only People had a binding.

```bash
npm run dev
```

Sign in as the demo user, then at `http://localhost:3000/app/people`:

1. Ask **"verified marketing managers in Germany"** → inline answer, chips, rows. Click a row's checkbox and its save button — **both must now do something** (that is the Task 3 fix).
2. Ask **"what trade shows are happening in Munich"** → the handoff line appears, the app navigates to `/app/events`, the "Moved from People — go back" bar shows, the rail's chips reflect Munich, and the answer streams in with event rows.
3. Click **Go back** → returns to `/app/people` with the thread intact.
4. Refresh on Events → thread survives (sessionStorage), no streaming state.
5. Open a new tab → empty thread.

⚠️ The configured `ANTHROPIC_API_KEY` returns **HTTP 401**, so the deterministic classifier answers and `degraded: "no_tool_call"` appears on the route event. That is the expected degraded path. Check the dev log for `[assistant] classifier failed` to confirm.

- [ ] **Step 5: Document it**

In `CLAUDE.md`, replace the sentence in the **Assistant conversation (UI)** paragraph that reads *"Only the People binding exists so far (`hasBinding` guards the rest); Events and Companies migrate in Spec 2b."* with:

```markdown
People and Events are migrated; Companies still runs the legacy `/api/companies/ask` path and migrates in Spec 2c (`hasBinding` guards it until then). Events uses one filter stack for both the rail and the assistant: the array-valued `EventQueryState` in `lib/events/` (`filterEventList`, `computeEventFacets`, `buildEventFilterChips`, `buildEventAnswer`). `favouritesOnly` is deliberately absent from the events tool schema — favourites live in browser `localStorage`, so the server passes an empty set and could never match it. `lib/find-shows/filter-events.ts` and the scalar `EventFilters` in `models/event-query.ts` survive only for the Companies page.
```

Also update the **Routing / UI** section: `components/crm/events-section.tsx` is now a router over `components/events/{event-detail-view,exhibitor-detail-view,ticket-booking-view,event-list-view}.tsx`.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record the Events migration and the single event-filter stack"
```

---

## Done criteria

- `npx vitest run` green except the pre-existing `tests/e2e/auth.spec.ts`.
- `npx tsc --noEmit` clean.
- The Spec 1 adapter contract suite passes **unchanged**.
- `eventsAdapter.filterSchema.properties.favouritesOnly` is `undefined`.
- `bindingFor('events')` resolves; `bindingFor('companies')` still throws.
- `git log --oneline dee7bc4..HEAD -- <Companies' five legacy modules>` is empty.
- A real cross-page handoff works in the running app, and inline row controls are no longer inert.
- No new dependency in `package.json`.

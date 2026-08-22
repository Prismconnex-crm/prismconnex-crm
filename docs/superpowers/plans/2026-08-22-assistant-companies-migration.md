# Companies Migration (Spec 3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put Companies on the same panel, conversation and router as People and Events, then delete the legacy trade-show stack it was the last caller of.

**Architecture:** Companies gets a URL codec and a binding, exactly as People and Events already have, so `hasBinding('companies')` becomes true and the navigation effect stops returning early for it. The page's five loose filter `useState`s collapse into the one filter type the server-side adapter already owns. Only once the panel is mounted and working do the legacy route, service and pane come out — and each deletion is preceded by a grep proving zero remaining callers.

**Tech Stack:** TypeScript, Next.js 14 App Router, React 18, Vitest (node environment, `@/` alias = repo root), Tailwind.

**Spec:** Phase 3 of `docs/superpowers/specs/2026-08-20-assistant-cross-entity-completion-design.md`, plus the "Follow-on work" section of `docs/superpowers/specs/2026-08-18-assistant-entity-aware-panel-design.md`.

## Global Constraints

- **No new npm dependency.** No jsdom, React Testing Library or Playwright. React components stay untested; decisions live in pure modules.
- **`CompanyQueryState` is not a new type — it is `CompanySearchFilters`.** `lib/companies/search.ts:49` already defines `{ search, category, employeeRange, region, country }`, all `string | null`, and the companies *adapter* already uses it as its filter type. The page's `companySearch`, `selectedCategory`, `selectedEmployeeRange`, `selectedLocation` and `selectedCountry` map onto it one-for-one. Inventing a parallel state type would create two representations of the same state — the exact drift that had to be corrected in Phase 2 for People.
- **The `location` param maps to the `region` field.** `app/api/companies/route.ts:23` reads `searchParams.get('location')` into `filters.region`. This asymmetry is pre-existing and load-bearing: the URL codec must emit `location`, not `region`, or the rail and the fetch will disagree and filtering will silently return unfiltered rows.
- **`/api/companies` stays exactly as it is.** CLAUDE.md records that it intentionally bypasses tenancy and queries the shared `"DiscoveryCompany"` table with raw SQL. Do not add tenant scoping, and do not touch `lib/companies/search.ts`.
- **`total`/`totalPages` are deliberately `null`.** Counting the discovery table per request is too slow. Never render "0 results" from a null total.
- **Delete nothing before its replacement works.** The binding is registered and the panel mounted *before* any route, service or component is removed. Every deletion is preceded by a grep proving zero callers, per the spec: "3b verifies zero callers before deleting rather than assuming it."
- **Prefix search only.** `/api/companies` matches names by prefix range (`name >= ? AND name < ?` COLLATE NOCASE). Do not describe it as substring search in any copy.
- **Do not run `npm run build`.** CLAUDE.md forbids it unless explicitly asked — the C: drive has filled and frozen the machine before.
- **Existing suite must stay green.** Run sequentially: `npx vitest run --no-file-parallelism`. Baseline entering this plan: 558 tests, 51 files.
- **Check `tsc` exit code properly.** `npx tsc --noEmit > /tmp/tsc.out 2>&1; echo $?` — piping to `head` reports `head`'s status, not `tsc`'s.
- **`tsc` has no `target` set**, so it defaults to ES5. Iterating a `Uint8Array`/`Set`/`Map` with `for…of` compiles under vitest's esbuild and fails under `tsc`. Use indexed loops or `Array.from`.

---

### Task 1: The Companies URL codec

**Files:**
- Create: `lib/companies/filters.ts`
- Test: `tests/integration/companies-filters.test.ts`

**Interfaces:**
- Consumes: `CompanySearchFilters` from `@/lib/companies/search`.
- Produces:
  - `emptyCompanyFilters(): CompanySearchFilters`
  - `paramsToCompanyFilters(search: string | URLSearchParams): CompanySearchFilters`
  - `serializeCompanyQuery(filters: CompanySearchFilters, extra?: Record<string, string>): string`
  - `hasAnyCompanyFilter(filters: CompanySearchFilters): boolean`

Modelled on `lib/people/filters.ts` and `lib/events/filters.ts`, which the two shipped bindings already delegate to.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/companies-filters.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import {
  emptyCompanyFilters,
  hasAnyCompanyFilter,
  paramsToCompanyFilters,
  serializeCompanyQuery,
} from '@/lib/companies/filters';

describe('emptyCompanyFilters', () => {
  it('is all-null, matching the adapter exactly', () => {
    expect(emptyCompanyFilters()).toEqual({
      search: null,
      category: null,
      employeeRange: null,
      region: null,
      country: null,
    });
  });
});

describe('serializeCompanyQuery', () => {
  it('emits the location param for the region field', () => {
    // app/api/companies/route.ts reads searchParams.get('location') into
    // filters.region. Emitting "region" here would leave the rail and the
    // fetch disagreeing, and the page would quietly show unfiltered rows.
    const filters = { ...emptyCompanyFilters(), region: 'Europe' };
    expect(serializeCompanyQuery(filters)).toContain('location=Europe');
    expect(serializeCompanyQuery(filters)).not.toContain('region=');
  });

  it('round-trips every field', () => {
    const filters = {
      search: 'Acme',
      category: 'Software',
      employeeRange: '51-200',
      region: 'Europe',
      country: 'Germany',
    };
    expect(paramsToCompanyFilters(serializeCompanyQuery(filters))).toEqual(filters);
  });

  it('serialises empty filters to an empty string, not "?"', () => {
    expect(serializeCompanyQuery(emptyCompanyFilters())).toBe('');
  });

  it('trims a padded search rather than querying whitespace', () => {
    expect(serializeCompanyQuery({ ...emptyCompanyFilters(), search: '  Acme  ' })).toContain(
      'search=Acme'
    );
  });

  it('omits a whitespace-only search entirely', () => {
    expect(serializeCompanyQuery({ ...emptyCompanyFilters(), search: '   ' })).toBe('');
  });

  it('merges extra params, as the People codec does', () => {
    const query = serializeCompanyQuery(emptyCompanyFilters(), { page: '2' });
    expect(query).toContain('page=2');
  });

  it('drops an empty extra value rather than emitting a bare key', () => {
    expect(serializeCompanyQuery(emptyCompanyFilters(), { page: '' })).toBe('');
  });
});

describe('paramsToCompanyFilters', () => {
  it('reads location into region', () => {
    expect(paramsToCompanyFilters('?location=Europe').region).toBe('Europe');
  });

  it('returns empty filters for an empty search string', () => {
    expect(paramsToCompanyFilters('')).toEqual(emptyCompanyFilters());
  });

  it('accepts URLSearchParams as well as a string', () => {
    expect(paramsToCompanyFilters(new URLSearchParams('country=Germany')).country).toBe('Germany');
  });

  it('never throws on junk — the address bar is user-editable', () => {
    expect(() => paramsToCompanyFilters('?%%%&&&=))')).not.toThrow();
  });

  it('ignores the handoff params, which are not its filters', () => {
    // ask/via/cid belong to the handoff. Companies owns none of them.
    expect(paramsToCompanyFilters('?ask=saas+companies&via=events&cid=abc')).toEqual(
      emptyCompanyFilters()
    );
  });

  it('treats a blank value as absent rather than as an empty filter', () => {
    expect(paramsToCompanyFilters('?category=').category).toBeNull();
  });
});

describe('hasAnyCompanyFilter', () => {
  it('is false for empty filters', () => {
    expect(hasAnyCompanyFilter(emptyCompanyFilters())).toBe(false);
  });

  it('is true when any one field is set', () => {
    expect(hasAnyCompanyFilter({ ...emptyCompanyFilters(), country: 'Germany' })).toBe(true);
    expect(hasAnyCompanyFilter({ ...emptyCompanyFilters(), search: 'Acme' })).toBe(true);
  });

  it('is false for a whitespace-only search', () => {
    expect(hasAnyCompanyFilter({ ...emptyCompanyFilters(), search: '   ' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/companies-filters.test.ts`
Expected: FAIL — `Cannot find package '@/lib/companies/filters'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/companies/filters.ts`:

```typescript
import type { CompanySearchFilters } from './search';

/**
 * Pure URL (de)serialisation for the Companies rail, matching what
 * lib/people/filters.ts and lib/events/filters.ts already do for their pages.
 *
 * The filter TYPE is deliberately CompanySearchFilters — the same type the
 * companies adapter (lib/assistant/adapters/companies.ts) and the search layer
 * (lib/companies/search.ts) already use. A separate "CompanyQueryState" would
 * be a second representation of one state, and the panel and the rail would be
 * free to disagree about what is filtered.
 */

/**
 * The `region` field travels as the `location` param.
 *
 * Not a typo to be tidied: app/api/companies/route.ts reads
 * `searchParams.get('location')` into `filters.region`. The wire name and the
 * field name have differed since before this file existed, and the fetch still
 * builds `location`. Renaming either half without the other silently drops the
 * filter — the query succeeds and returns unfiltered rows.
 */
const PARAM_BY_FIELD: Record<keyof CompanySearchFilters, string> = {
  search: 'search',
  category: 'category',
  employeeRange: 'employeeRange',
  region: 'location',
  country: 'country',
};

const FIELDS = Object.keys(PARAM_BY_FIELD) as (keyof CompanySearchFilters)[];

export function emptyCompanyFilters(): CompanySearchFilters {
  return { search: null, category: null, employeeRange: null, region: null, country: null };
}

/** Never throws — the address bar is user-editable. Blank values read as absent. */
export function paramsToCompanyFilters(
  search: string | URLSearchParams
): CompanySearchFilters {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const filters = emptyCompanyFilters();

  for (const field of FIELDS) {
    const value = params.get(PARAM_BY_FIELD[field])?.trim();
    filters[field] = value ? value : null;
  }

  return filters;
}

/** Serialises to a leading-`?` string, or '' when nothing at all is set. */
export function serializeCompanyQuery(
  filters: CompanySearchFilters,
  extra: Record<string, string> = {}
): string {
  const params = new URLSearchParams();

  for (const field of FIELDS) {
    const value = filters[field]?.trim();
    if (value) params.set(PARAM_BY_FIELD[field], value);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

export function hasAnyCompanyFilter(filters: CompanySearchFilters): boolean {
  return FIELDS.some((field) => Boolean(filters[field]?.trim()));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/companies-filters.test.ts`
Expected: PASS — 17 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/companies/filters.ts tests/integration/companies-filters.test.ts
git commit -m "feat(companies): a URL codec matching the People and Events ones"
```

---

### Task 2: The Companies binding

**Files:**
- Create: `components/assistant/bindings/companies.tsx`
- Test: `tests/integration/assistant-bindings.test.ts` (append)

**Interfaces:**
- Consumes: Task 1's codec; `PageBinding` from `../types`.
- Produces: `companiesBinding: PageBinding<CompanySearchFilters, CompanyRowContext>` and `export type CompanyRowContext`.

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/assistant-bindings.test.ts`:

```typescript
describe('companiesBinding', () => {
  it('declares its entity and route', () => {
    expect(companiesBinding.entity).toBe('companies');
    expect(companiesBinding.route).toBe('/app/companies');
  });

  it('starts from all-null filters', () => {
    expect(companiesBinding.emptyFilters()).toEqual({
      search: null,
      category: null,
      employeeRange: null,
      region: null,
      country: null,
    });
  });

  it('replaces only the keys the caller named', () => {
    const current = { ...companiesBinding.emptyFilters(), country: 'Germany' };
    const next = companiesBinding.applyFilters(current, { category: 'Software' });
    // The user's own country filter survives a category-only update.
    expect(next).toEqual({ ...current, category: 'Software' });
  });

  it('treats an explicit null as a real clear', () => {
    const current = { ...companiesBinding.emptyFilters(), country: 'Germany' };
    expect(companiesBinding.applyFilters(current, { country: null }).country).toBeNull();
  });

  it('round-trips through the same codec the rail uses', () => {
    const filters = {
      search: 'Acme',
      category: 'Software',
      employeeRange: '51-200',
      region: 'Europe',
      country: 'Germany',
    };
    const query = companiesBinding.serializeFilters(filters);
    expect(query).toContain('location=Europe');
    expect(companiesBinding.parseFilters(query)).toEqual(filters);
  });

  it('serialises empty filters to an empty string', () => {
    expect(companiesBinding.serializeFilters(companiesBinding.emptyFilters())).toBe('');
  });

  it('ignores the handoff params', () => {
    expect(companiesBinding.parseFilters('?ask=saas&via=events&cid=abc')).toEqual(
      companiesBinding.emptyFilters()
    );
  });
});
```

Add the import at the top of the file:

```typescript
import { companiesBinding } from '@/components/assistant/bindings/companies';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/assistant-bindings.test.ts`
Expected: FAIL — `Cannot find package '@/components/assistant/bindings/companies'`.

- [ ] **Step 3: Write the row component**

There is no `types/company.ts` — the page's `Company` is a local type declared
at `components/crm/companies-section.tsx:70`, and a binding must not depend on a
page component's internals. The adapter's rows come from `formatCompany`
(`lib/companies/search.ts:88`), so the binding declares the structural subset it
actually renders.

Note `formatCompany` produces **no `country` field**. It has `headquarters` and
`region`. Rendering `company.country` would print nothing.

Create `components/crm/company-results-table.tsx`:

```tsx
"use client";

import type { CompanyResultRow } from '@/components/assistant/bindings/companies';

/**
 * Assistant result rows for Companies.
 *
 * Deliberately separate from the page's own table, which carries cursor
 * pagination, page-size controls and column state the panel has no use for.
 */
export function CompanyResultsTable({
  companies,
  savedIds,
  onToggleSaved,
  onOpenCompany,
}: {
  companies: CompanyResultRow[];
  savedIds: ReadonlySet<string>;
  onToggleSaved: (company: CompanyResultRow) => void;
  onOpenCompany: (company: CompanyResultRow) => void;
}) {
  if (companies.length === 0) return null;

  return (
    <ul className="divide-y divide-[#E2E8F0] dark:divide-[#22304A]">
      {companies.map((company) => (
        <li key={company.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <button
            type="button"
            onClick={() => onOpenCompany(company)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate text-[13px] font-medium text-[#0F172A] dark:text-[#E2E8F0]">
              {company.name}
            </p>
            <p className="truncate text-[12px] text-[#64748B] dark:text-[#94A3B8]">
              {[company.category, company.headquarters].filter(Boolean).join(' · ')}
            </p>
          </button>
          <button
            type="button"
            onClick={() => onToggleSaved(company)}
            className="shrink-0 text-[12px] text-[#475569] underline dark:text-[#94A3B8]"
          >
            {savedIds.has(company.id) ? 'Saved' : 'Save'}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Write the binding**

Create `components/assistant/bindings/companies.tsx`:

```tsx
"use client";

import { CompanyResultsTable } from '@/components/crm/company-results-table';
import {
  emptyCompanyFilters,
  paramsToCompanyFilters,
  serializeCompanyQuery,
} from '@/lib/companies/filters';
import type { CompanySearchFilters } from '@/lib/companies/search';
import type { PageBinding } from '../types';

/**
 * The fields the panel renders, as `formatCompany` produces them.
 *
 * A structural subset rather than the page's local `Company` type: that type
 * lives inside companies-section.tsx and carries two dozen fields the panel
 * never touches. `formatCompany` emits no `country` — `headquarters` and
 * `region` are the location fields.
 */
export type CompanyResultRow = {
  id: string;
  name: string;
  category: string;
  headquarters: string;
  domain: string;
};

/** The saved-set and handlers the Companies page already owns. */
export type CompanyRowContext = {
  savedIds: ReadonlySet<string>;
  onToggleSaved(company: CompanyResultRow): void;
  onOpenCompany(company: CompanyResultRow): void;
};

const EMPTY_CONTEXT: CompanyRowContext = {
  savedIds: new Set(),
  onToggleSaved: () => {},
  onOpenCompany: () => {},
};

export const companiesBinding: PageBinding<CompanySearchFilters, CompanyRowContext> = {
  entity: 'companies',
  route: '/app/companies',

  emptyFilters: emptyCompanyFilters,

  /**
   * Scalar filters, so a plain spread is correct here — unlike People (array
   * valued) and Events (nested under `filters`). Only keys present in
   * `incoming` are replaced, and an explicit null is a real clear.
   */
  applyFilters(current, incoming) {
    return { ...current, ...incoming };
  },

  // The same codec the rail reads, so the panel and the sidebar can never
  // disagree about what is filtered.
  serializeFilters: serializeCompanyQuery,
  parseFilters: paramsToCompanyFilters,

  renderRows(rows, context) {
    // EMPTY_CONTEXT is a defensive default for a page that forgets to pass one;
    // the controls are then inert, which is why every page must pass a real one.
    const ctx = context ?? EMPTY_CONTEXT;
    return (
      <CompanyResultsTable
        companies={rows as CompanyResultRow[]}
        savedIds={ctx.savedIds}
        onToggleSaved={ctx.onToggleSaved}
        onOpenCompany={ctx.onOpenCompany}
      />
    );
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/integration/assistant-bindings.test.ts`
Expected: PASS — the existing 28 tests plus 7 new.

- [ ] **Step 6: Commit**

```bash
git add components/assistant/bindings/companies.tsx components/crm/company-results-table.tsx tests/integration/assistant-bindings.test.ts
git commit -m "feat(assistant): a Companies binding on the shared contract"
```

---

### Task 3: Register the binding

**Files:**
- Modify: `components/assistant/registry.ts`
- Test: `tests/integration/assistant-bindings.test.ts` (append)

**Interfaces:**
- Consumes: `companiesBinding` from Task 2.
- Produces: `hasBinding('companies') === true`. This is what stops the provider's navigation effect returning early for a companies handoff, and what makes `AssistantMessage` render companies rows.

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/assistant-bindings.test.ts`:

```typescript
describe('registry — all three entities bound', () => {
  it('has a binding for every entity the router can target', () => {
    // Until this task, a handoff to companies showed the explanation and
    // stopped, because there was no client-side way to render its rows.
    expect(hasBinding('companies')).toBe(true);
    expect(hasBinding('events')).toBe(true);
    expect(hasBinding('people')).toBe(true);
  });

  it('returns the companies binding by name', () => {
    expect(bindingFor('companies').entity).toBe('companies');
  });

  it('restores the real companies binding after a test swap', () => {
    setBindingForTests('companies', { ...companiesBinding, route: '/fake' } as never);
    resetBindings();
    expect(bindingFor('companies').route).toBe('/app/companies');
  });
});
```

Add `hasBinding` to the file's existing import from `@/components/assistant/registry`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/assistant-bindings.test.ts`
Expected: FAIL — `expected false to be true` for `hasBinding('companies')`.

- [ ] **Step 3: Write minimal implementation**

In `components/assistant/registry.ts`, add the import:

```typescript
import { companiesBinding } from './bindings/companies';
```

and replace the `defaults` object, removing the placeholder comment:

```typescript
const defaults: Partial<Record<AssistantEntity, AnyBinding>> = {
  people: peopleBinding as unknown as AnyBinding,
  events: eventsBinding as unknown as AnyBinding,
  companies: companiesBinding as unknown as AnyBinding,
};
```

Also update `bindingFor`'s error message, which still names a shipped spec:

```typescript
export function bindingFor(entity: AssistantEntity): AnyBinding {
  const binding = registry[entity];
  if (!binding) {
    throw new Error(`no binding registered for "${entity}"`);
  }
  return binding;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/integration/assistant-bindings.test.ts`
Expected: PASS — 38 tests.

- [ ] **Step 5: Confirm nothing else assumed companies was unbound**

Run: `npx vitest run --no-file-parallelism`
Expected: all pass. A test asserting `hasBinding('companies') === false`, or
asserting that a companies handoff does not navigate, is now WRONG and should be
updated to the new behaviour rather than deleted.

- [ ] **Step 6: Commit**

```bash
git add components/assistant/registry.ts tests/integration/assistant-bindings.test.ts
git commit -m "feat(assistant): bind Companies, completing all three entities"
```

---

### Task 4: One filter state on the Companies page

**Files:**
- Modify: `components/crm/companies-section.tsx` (state at :634 and :651-657, the fetch effect at :765-775, `handleLeadQuery` at :718-742)

**Interfaces:**
- Consumes: Task 1's codec; `useUrlFilters` from `components/assistant/use-url-filters`.
- Produces: nothing other tasks import. The page's filters become URL-backed, which is what lets a handoff INTO Companies arrive with its filters already applied.

**Why this precedes mounting the panel:** the panel reads the page's filters from
the URL. Mounting it over five `useState`s that never touch the URL would give a
panel that believes nothing is filtered while the rail shows filters.

- [ ] **Step 1: Replace the five filter states with one**

In `components/crm/companies-section.tsx`, delete these five lines (at :634 and
:653-656):

```tsx
  const [companySearch, setCompanySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEmployeeRange, setSelectedEmployeeRange] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
```

and put in their place:

```tsx
  /**
   * One filter object, URL-backed, in the type the adapter and the search layer
   * already use. Five separate useStates could not survive a navigation, which
   * is why a handoff into Companies used to arrive unfiltered.
   */
  const { filters: companyFilters, setFilters: setCompanyFilters } =
    useUrlFilters<CompanySearchFilters>('companies');

  const companySearch = companyFilters.search ?? '';
  const selectedCategory = companyFilters.category;
  const selectedEmployeeRange = companyFilters.employeeRange;
  const selectedLocation = companyFilters.region;
  const selectedCountry = companyFilters.country;

  /** Keeps the ~40 existing call sites working without rewriting each one. */
  const setCompanySearch = useCallback(
    (value: string) => setCompanyFilters({ ...companyFilters, search: value || null }),
    [companyFilters, setCompanyFilters]
  );
  const setSelectedCategory = useCallback(
    (value: string | null) => setCompanyFilters({ ...companyFilters, category: value }),
    [companyFilters, setCompanyFilters]
  );
  const setSelectedEmployeeRange = useCallback(
    (value: string | null) => setCompanyFilters({ ...companyFilters, employeeRange: value }),
    [companyFilters, setCompanyFilters]
  );
  const setSelectedLocation = useCallback(
    (value: string | null) => setCompanyFilters({ ...companyFilters, region: value }),
    [companyFilters, setCompanyFilters]
  );
  const setSelectedCountry = useCallback(
    (value: string | null) => setCompanyFilters({ ...companyFilters, country: value }),
    [companyFilters, setCompanyFilters]
  );
```

Add the imports:

```tsx
import { useUrlFilters } from "@/components/assistant/use-url-filters";
import type { CompanySearchFilters } from "@/lib/companies/search";
```

- [ ] **Step 2: Fix the setters that take an updater function**

Run: `grep -n "setSelectedCategory(\|setSelectedEmployeeRange(\|setSelectedLocation(\|setSelectedCountry(\|setCompanySearch(" components/crm/companies-section.tsx`

Every call must pass a **value**, not a function. React's `useState` setters
accept `(prev) => next`; these shims do not. If any call site passes a function,
rewrite it to read from `companyFilters` directly — e.g. replace
`setCompanySearch((prev) => prev + "x")` with
`setCompanySearch(companySearch + "x")`.

- [ ] **Step 3: Verify the fetch still sends the same params**

The fetch effect builds its params from the five names above, which are now
derived from `companyFilters`. It should need no edit. Confirm by reading it:

Run: `grep -n "params.set('location'\|params.set('category'\|params.set('search'" components/crm/companies-section.tsx`

Expected: `location` is still set from `selectedLocation`. If the effect was
changed to read `companyFilters.region` directly, that is equivalent and fine —
but the param name must stay `location`.

- [ ] **Step 4: Leave the `?q=` reader alone**

The effect at :707 reads a `q` param into the search box. Do **not** remove it:
it serves a different caller — the app-shell global search box, which dispatches
`pcx:company-search` and links in with `?q=`. The codec owns `search`, `category`,
`employeeRange`, `location` and `country`; `q` is not one of its params, so the
two do not collide.

Confirm it still compiles against the new setter shim, which takes a value
rather than an updater:

Run: `grep -n "applyGlobalSearch" components/crm/companies-section.tsx`
Expected: it calls `setCompanySearch(value)` with a plain string.

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit > /tmp/tsc.out 2>&1; echo $?`
Expected: `0`.

- [ ] **Step 6: Run the suite**

Run: `npx vitest run --no-file-parallelism`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add components/crm/companies-section.tsx
git commit -m "feat(companies): one URL-backed filter object instead of five useStates"
```

---

### Task 5: Mount the panel, remove the inline pane

**Files:**
- Modify: `components/crm/companies-section.tsx` — state at :638-650, `runAsk` at :883-944, `handleEventPageChange` at :946-977, `EventSearchState` at :40-48, the ask input at :1215-1246, the `eventSearch &&` conditionals at :1203, :1248, :1336, :1539, :1541, and the `EventCatalogPanel` render at :1542-1554

**Interfaces:**
- Consumes: `AIChatPanel` from `components/assistant/ai-chat-panel`; `CompanyRowContext` from Task 2.
- Produces: nothing other tasks import.

- [ ] **Step 1: Delete the pane's state**

Remove these declarations:

```tsx
  const [eventSearch, setEventSearch] = useState<EventSearchState | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [askUnavailable, setAskUnavailable] = useState<
    null | "missing_api_key" | "invalid_api_key"
  >(null);
```

and the `EventSearchState` type at the top of the file (lines 40-48).

- [ ] **Step 2: Delete `runAsk` and `handleEventPageChange`**

Remove both `useCallback` blocks entirely. They are the only callers of
`/api/companies/ask` and `/api/events/search`.

- [ ] **Step 3: Make the search input a plain search box**

Replace the input's `onChange` and `onKeyDown` — the assistant panel now owns
asking, so Enter no longer runs a model call:

```tsx
              <input
                value={companySearch}
                onChange={(event) => {
                  setCompanySearch(event.target.value);
                  setSelectedCompanyId(null);
                  setIsDetailView(false);
                  resetCompanyPagination();
                }}
                placeholder="Search companies by name..."
                className="h-10 w-full rounded-[10px] border border-slate-200 bg-slate-50 pl-10 pr-9 text-[13px] text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white dark:placeholder:text-slate-500"
              />
```

Delete the `{isAsking ? <Sparkles … /> : null}` block, the "Press Enter to
ask" hint paragraph, and the whole `{askUnavailable ? … : null}` block beneath
it. The credential notice now reaches admins through the panel's `notice`
stream event instead.

The placeholder says "by name" because `/api/companies` matches names by prefix
range only — see the Global Constraints.

- [ ] **Step 4: Remove the `eventSearch` conditionals**

Four class expressions branch on `eventSearch`, which no longer exists:

- `:1203` — `!eventSearch && "xl:grid-cols-[360px_1fr] 2xl:grid-cols-[390px_1fr]"` becomes the unconditional string `"xl:grid-cols-[360px_1fr] 2xl:grid-cols-[390px_1fr]"`
- `:1248` — `cn("mt-4 flex flex-wrap items-center gap-2", eventSearch && "hidden")` becomes `"mt-4 flex flex-wrap items-center gap-2"`
- `:1336` — `cn("mt-4 flex-1 space-y-1.5", eventSearch && "hidden")` becomes `"mt-4 flex-1 space-y-1.5"`
- `:1539` and `:1541` — drop the `!eventSearch &&` guard, keeping the class that
  was applied when it was null

- [ ] **Step 5: Replace the EventCatalogPanel render with the panel**

Replace the whole `{!isDetailView && eventSearch ? (<EventCatalogPanel … />) : (` /
`)}` conditional with the shared panel, keeping whatever was in the `else`
branch as the surrounding content:

```tsx
              <AIChatPanel
                entity="companies"
                rowContext={{
                  savedIds: savedCompanyIds,
                  // The page has separate add and remove handlers, not a
                  // toggle, so the binding's onToggleSaved dispatches between
                  // them. handleAddToCrm takes the row; handleRemoveFromCrm
                  // takes the id.
                  onToggleSaved: (company) => {
                    if (isCompanySaved(company.id)) handleRemoveFromCrm(company.id);
                    else handleAddToCrm(company as unknown as Company);
                  },
                  onOpenCompany: (company) => {
                    setSelectedCompanyId(company.id);
                    setIsDetailView(true);
                  },
                }}
              />
```

Add the memoised id set next to the other derived values, so the panel is not
handed a new Set on every render:

```tsx
  const savedCompanyIds = useMemo(
    () => new Set(savedCompanies.map((company) => company.id)),
    [savedCompanies]
  );
```

`handleAddToCrm` expects the page's full local `Company`. The panel's rows come
from `formatCompany`, which produces exactly that shape, so the cast is sound —
but it IS a cast, and if `formatCompany` and the local `Company` type ever
diverge this is where it will surface.

Remove the `EventCatalogPanel` import (line 30) and add:

```tsx
import { AIChatPanel } from "@/components/assistant/ai-chat-panel";
```

- [ ] **Step 6: Verify it compiles and lints**

Run: `npx tsc --noEmit > /tmp/tsc.out 2>&1; echo $?`
Expected: `0`. Any error naming `eventSearch`, `isAsking`, `askUnavailable`,
`runAsk` or `EventSearchState` is a leftover reference — remove it.

Run: `npm run lint` (over two minutes; run it in the background)
Expected: `✔ No ESLint warnings or errors`.

- [ ] **Step 7: Run the suite**

Run: `npx vitest run --no-file-parallelism`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add components/crm/companies-section.tsx
git commit -m "feat(companies): mount the shared panel, drop the inline pane"
```

---

> **Shipping boundary.** Companies is now on the shared panel and the legacy
> stack has no caller. Everything below is deletion. Each step greps for callers
> BEFORE removing anything, per the spec's instruction to verify rather than
> assume — CLAUDE.md records that a previous merge silently resurrected a
> comparable set of deleted Events files.

---

### Task 6: Delete the legacy trade-show stack

**Files:**
- Delete: `app/api/companies/ask/route.ts`, `app/api/events/search/route.ts`, `services/event-query.service.ts`, `lib/find-shows/filter-events.ts`, `models/event-query.ts`, `components/crm/event-catalog-panel.tsx`
- Delete: `tests/integration/companies-ask-route.test.ts`, `tests/integration/event-search-route.test.ts`, `tests/integration/event-query-filter.test.ts`
- Modify: `lib/assistant/route.ts:5` (a comment), `lib/env.ts:36` (a comment)

**Interfaces:**
- Consumes: Tasks 3 and 5 — the binding must be registered and the pane gone.
- Produces: nothing.

**Verified caller map** (established before this plan was written):

| Target | Callers | Resolution |
|---|---|---|
| `app/api/companies/ask/` | the pane, its own test | both gone by Task 5 |
| `app/api/events/search/` | the pane, its own test | both gone by Task 5 |
| `services/event-query.service.ts` | the two routes above, `lib/find-shows/filter-events.ts`, a **comment** in `lib/assistant/route.ts:5` | delete after the routes |
| `lib/find-shows/filter-events.ts` | `api/events/search`, `event-query.service`, its own test | delete after both |
| `models/event-query.ts` | the two routes, the pane, `event-catalog-panel`, `event-query.service`, `filter-events` | delete last |
| `components/crm/event-catalog-panel.tsx` | **only** `companies-section.tsx:1544` | gone by Task 5 — the spec did not name this file |
| `models/ai-event-query.ts` | none — already deleted | nothing to do |

- [ ] **Step 1: Prove the two routes have no callers**

Run: `grep -rn "companies/ask\|events/search" --include=*.ts --include=*.tsx app components lib services models tests`

Expected: only `lib/env.ts:36` (a comment) and `app/api/events/search/route.ts:13`
(a comment inside a file about to be deleted). If any real caller appears, STOP
and report — Task 5 missed something.

- [ ] **Step 2: Delete the routes and their tests**

```bash
git rm -r app/api/companies/ask app/api/events/search
git rm tests/integration/companies-ask-route.test.ts tests/integration/event-search-route.test.ts
```

- [ ] **Step 3: Prove the service has no importers, then delete it**

Run: `grep -rn "event-query.service" --include=*.ts --include=*.tsx app components lib services models tests`

Expected: only `lib/assistant/route.ts:5`, which is a comment reading "Same
pattern as services/event-query.service.ts."

```bash
git rm services/event-query.service.ts
```

Then fix that comment so it does not point at a deleted file. In
`lib/assistant/route.ts`, replace line 5:

```typescript
// route down with it. The same webpackIgnore'd dynamic import pattern.
```

- [ ] **Step 4: Prove filter-events has no importers, then delete it**

Run: `grep -rn "find-shows/filter-events" --include=*.ts --include=*.tsx app components lib services models tests`

Expected: only `tests/integration/event-query-filter.test.ts`.

```bash
git rm lib/find-shows/filter-events.ts tests/integration/event-query-filter.test.ts
```

- [ ] **Step 5: Prove event-catalog-panel and models/event-query have no importers, then delete them**

Run: `grep -rn "event-catalog-panel\|models/event-query" --include=*.ts --include=*.tsx app components lib services models tests`

Expected: no output.

```bash
git rm components/crm/event-catalog-panel.tsx models/event-query.ts
```

- [ ] **Step 6: Fix the env comment**

`lib/env.ts:36` describes a route that no longer exists:

```typescript
    // Absent = /api/companies/ask returns 503 and the UI falls back to
```

Replace it with:

```typescript
    // Absent = the assistant's classifier is skipped and every question falls
    // back to the deterministic classifier. See lib/assistant/model-config.ts.
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit > /tmp/tsc.out 2>&1; echo $?`
Expected: `0`.

Run: `npx vitest run --no-file-parallelism`
Expected: all pass, with three fewer test files than before this task.

- [ ] **Step 8: Commit**

```bash
git add -A app components lib models services tests
git commit -m "chore(assistant): delete the legacy trade-show stack"
```

---

### Task 7: Full verification

**Files:** none modified.

- [ ] **Step 1: Run the full suite sequentially**

Run: `npx vitest run --no-file-parallelism`

Sequential is deliberate: `tests/integration/password-reset.test.ts` has a known
flake in its fetch-call-count assertions under heavy parallel I/O. It is
unrelated to this work and must not be "fixed" by editing
`services/auth.service.ts`, which awaits correctly.

Expected: all pass.

- [ ] **Step 2: Confirm all three entities are bound**

Run: `grep -n "companies\|events\|people" components/assistant/registry.ts`
Expected: all three present in `defaults`, and no `// companies lands in…` comment.

- [ ] **Step 3: Confirm the legacy stack is gone**

Run: `ls app/api/companies/ask app/api/events/search services/event-query.service.ts lib/find-shows/filter-events.ts models/event-query.ts components/crm/event-catalog-panel.tsx 2>&1`
Expected: "No such file or directory" for every one.

- [ ] **Step 4: Confirm no handoff param collides on any of the three pages**

Run: `grep -n "'ask'\|'via'\|'cid'" lib/events/filters.ts lib/people/filters.ts lib/companies/filters.ts`
Expected: no output.

- [ ] **Step 5: Lint**

Run: `npm run lint` (background it — over two minutes)
Expected: `✔ No ESLint warnings or errors`.

- [ ] **Step 6: Report; commit nothing**

Report the suite result and the four checks above.

Note for the reporter: no part of the Companies panel has been seen in a browser.
The app is auth-gated and there is no seeded local password, so the mount, the
rows, the handoff into and out of Companies, and the removal of the pane are all
unverified visually. A green suite is not evidence that the page renders.

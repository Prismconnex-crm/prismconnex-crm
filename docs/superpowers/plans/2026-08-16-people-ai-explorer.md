# People AI Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/app/people` as a two-panel Explorer that visually matches `/app/companies` — a 14-group filter rail on the left, a streaming AI chat with inline results on the right — backed by a real `/api/people` over a committed generated seed.

**Architecture:** Pure, framework-free logic modules in `lib/people/` (filtering, faceting, URL serialisation, query parsing, templated answers, lookalike scoring) are imported *both* by the client for zero-latency interaction and by the API routes, so the two can never disagree. `GET /api/people` serves filtered pages plus facet counts and header stats; `POST /api/people/chat` returns a newline-delimited JSON stream that emits parsed filters and results *before* prose, so the table never waits on the answer. Filter state lives in the URL query string as the single source of truth, which is what makes the rail and the chat bidirectional without a sync effect.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), React 18 client components, Tailwind with explicit dark-mode hex tokens, framer-motion, lucide-react, Vitest (node environment), `@anthropic-ai/sdk` (already installed).

**Spec:** `docs/superpowers/specs/2026-08-16-people-ai-explorer-design.md` (Approved 2026-08-16)

## Global Constraints

Every task's requirements implicitly include this section.

- **No new dependencies.** `@anthropic-ai/sdk`, `framer-motion`, `lucide-react`, `zod`, `vitest` are already installed. Never run `npm install`.
- **Nothing heavy.** No `npm run db:seed`, no `npm run sqlite:optimize`, no `npm run build`, no benchmarks. This feature touches no database.
- **Disk discipline.** `data/people-seed.json` (~1.5 MB) is the **only** generated artefact. It lives in `data/`, committed to the repo. Never write to a system temp directory. (Precedent: `data/find-shows-seed.json` is 7.5 MB and committed.)
- **Tests are one-shot:** `npx vitest run`. Never `npm test` — that is watch mode and will hang.
- **`tests/integration/event-filters.test.ts` must still pass unchanged** at every commit.
- **Events and Companies are not modified**, beyond two additive changes to `components/search/*` (Task 10) that leave their behaviour identical.
- **The four uncommitted route deletions stay untouched.** `app/api/ai/event-answer`, `app/api/ai/event-query`, `app/api/companies/ask`, `app/api/events/search` remain deleted. Do not restore, re-create, or `git checkout` them. Nothing here depends on them.
- **Styling tokens**, used verbatim: card `bg-white dark:bg-[#111B2E]`, border `border-slate-200 dark:border-[#22304A]`, inner/sunken `dark:bg-[#0B1220]`, hover `dark:hover:bg-[#16233A]`, open-accordion `dark:bg-[#0E1830]`, radii `rounded-[10px]` / `[12px]` / `[14px]` / `[16px]`, bracketed font sizes (`text-[13px]`), indigo accent. Every surface gets its own dark token — none is left to inherit.
- **The string `2,418` must not appear in any component.** All counts come from the API.
- **Error classes:** use `UnauthorizedError` / `BadRequestError` from `lib/http/errors.ts`, never bare `Error`, per the CLAUDE.md gotcha.
- **Routes are deliberately not tenant-scoped**, like `/api/companies` — the seed is a shared discovery dataset, not workspace data. Do not call `resolveTenant()`.

### Documented deviations from the spec

Both are noted here so a reviewer does not flag them as drift.

1. **URL writes use `window.history.replaceState`, not `router.replace`.** The spec named `router.replace`; the Events Explorer at `components/crm/events-section.tsx:751-759` deliberately uses `history.replaceState` with the comment that it "avoids re-running the RSC payload on every checkbox click". Both satisfy the spec's actual requirement (shareable URL, no history flooding); the existing precedent is faster and is what this plan follows.
2. **The free-text search box lives *inside* `PeopleFilters` as `search`.** Events kept it outside because its assistant never echoed a raw string back. People's chat *does* round-trip the raw query, and keeping one object makes URL state and `activeFilters` a single serialisation. No spec requirement changes.

## File Structure

**Create — types and data**

| File | Responsibility |
|---|---|
| `types/people.ts` | `Person`, `PeopleFilters`, closed vocabularies, `emptyPeopleFilters`, `hasAnyPeopleFilter` |
| `scripts/generate-people-seed.mjs` | Seeded generator; asserts its own distributions before writing |
| `data/people-seed.json` | The 2,418-record artefact (generated, committed) |
| `lib/people/data.ts` | Typed seed loader + memoised vocabulary/stats indexes |
| `lib/people/vocabulary.ts` | Alias resolution + text normalisation |

**Create — logic**

| File | Responsibility |
|---|---|
| `lib/people/filters.ts` | `applyPeopleFilters`, `computePeopleFacets`, `filtersToParams`, `paramsToFilters` |
| `lib/people/chips.ts` | `PeopleFilters` → `QueryChip[]`, and one-chip removal |
| `lib/people/parse-query.ts` | Natural language → `PeopleFilters` |
| `lib/people/answer.ts` | Templated prose from filters + real counts |
| `lib/people/lookalikes.ts` | Weighted similarity scoring |
| `lib/people/saved-store.ts` | Saved People, `localStorage` |
| `lib/people/chat-stream.ts` | NDJSON stream assembly, LLM upgrade, rate limiter |

**Create — API**

| File | Responsibility |
|---|---|
| `app/api/people/route.ts` | `GET` — filtered page + facets + stats |
| `app/api/people/chat/route.ts` | `POST` — NDJSON stream |

**Create — UI**

| File | Responsibility |
|---|---|
| `components/people/people-results-table.tsx` | Shared cell renderers; inline (capped) and full modes |
| `components/people/people-bulk-toolbar.tsx` | Select all / Verify emails / Add to Sequence / Merge / "N selected" |
| `components/people/people-filter-sidebar.tsx` | 14 accordions, `All` chip row, sticky Clear-all footer |
| `components/people/people-detail-slideover.tsx` | Right-hand slide-over with focus trap |
| `components/people/use-people-chat.ts` | `{ messages, isStreaming, error, send, retry, stop }` |
| `components/people/people-message.tsx` | Answer + chips + Apply filters + capped table |
| `components/people/people-chat-panel.tsx` | Empty ⇄ thread states, `Chat \| Results` switch |

**Modify**

| File | Change |
|---|---|
| `components/crm/people-section.tsx` | Rewritten as a thin composition root |
| `components/search/query-store.ts:12` | `SavedQueryKind` gains `"people_query"` |
| `components/search/ai-search-panel.tsx:26,173-197` | Export `TabKey`; add optional `defaultTab` prop |

**Create — tests** (all in `tests/integration/`)

`people-vocabulary.test.ts`, `people-data.test.ts`, `people-filters.test.ts`, `people-chips.test.ts`, `people-parse-query.test.ts`, `people-answer.test.ts`, `people-lookalikes.test.ts`, `people-saved-store.test.ts`, `people-route.test.ts`, `people-chat-route.test.ts`

## Task Dependency Order

Tasks 1 → 9 are a strict chain (each consumes the previous). Task 10 is independent and may run any time. Tasks 11 → 15 depend on 1–10. Task 16 is final verification.

---

### Task 1: Types and vocabulary

**Files:**
- Create: `types/people.ts`
- Create: `lib/people/vocabulary.ts`
- Test: `tests/integration/people-vocabulary.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Person`, `PeopleFilters`, `PeopleFilterListKey`, `PEOPLE_FILTER_LIST_KEYS`, `emptyPeopleFilters(): PeopleFilters`, `hasAnyPeopleFilter(f: PeopleFilters): boolean`, `PeopleStats`, and the const tuples `SENIORITIES`, `DEPARTMENTS`, `HEADCOUNT_BANDS`, `VERIFICATION_STATUSES`, `DATA_SOURCES`, `BUYING_INTENTS`, `CONFIDENCE_THRESHOLDS` with their derived types `Seniority`, `Department`, `HeadcountBand`, `VerificationStatus`, `DataSource`, `BuyingIntent`, `ConfidenceThreshold`. From `vocabulary.ts`: `normalizePeopleText(v: string): string`, `singularize(word: string): string`, `resolveVerification(term: string): VerificationStatus | null`, `resolveSeniority(term: string): Seniority | null`, `resolveDepartment(term: string): Department | null`, `resolveHeadcountBand(term: string): HeadcountBand | null`, `VERIFICATION_LABELS`, `SOURCE_LABELS`, `INTENT_LABELS`.

**Design note:** every list-valued key on `PeopleFilters` is typed `string[]`, not a narrow union array. This mirrors `EventFilters` in `types/events.ts` and is what lets `filters[key]` work in generic chip/facet code. Closed vocabularies are enforced at the parse boundary (`paramsToFilters`, Task 3), not in the type.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/people-vocabulary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  emptyPeopleFilters,
  hasAnyPeopleFilter,
  PEOPLE_FILTER_LIST_KEYS,
  SENIORITIES,
  DEPARTMENTS,
  HEADCOUNT_BANDS,
  VERIFICATION_STATUSES,
  DATA_SOURCES,
  BUYING_INTENTS,
} from '@/types/people';
import {
  normalizePeopleText,
  resolveDepartment,
  resolveHeadcountBand,
  resolveSeniority,
  resolveVerification,
  singularize,
} from '@/lib/people/vocabulary';

describe('empty filters', () => {
  it('has an entry for every list key and nothing applied', () => {
    const filters = emptyPeopleFilters();
    for (const key of PEOPLE_FILTER_LIST_KEYS) {
      expect(filters[key]).toEqual([]);
    }
    expect(filters.verification).toBeNull();
    expect(filters.minConfidence).toBeNull();
    expect(filters.lookalikeSeedId).toBeNull();
    expect(filters.search).toBe('');
    expect(hasAnyPeopleFilter(filters)).toBe(false);
  });

  it('detects each kind of applied filter', () => {
    expect(hasAnyPeopleFilter({ ...emptyPeopleFilters(), countries: ['Germany'] })).toBe(true);
    expect(hasAnyPeopleFilter({ ...emptyPeopleFilters(), verification: 'verified' })).toBe(true);
    expect(hasAnyPeopleFilter({ ...emptyPeopleFilters(), minConfidence: 70 })).toBe(true);
    expect(hasAnyPeopleFilter({ ...emptyPeopleFilters(), lookalikeSeedId: 'p-1' })).toBe(true);
    expect(hasAnyPeopleFilter({ ...emptyPeopleFilters(), search: 'sarah' })).toBe(true);
    // Whitespace is not a filter.
    expect(hasAnyPeopleFilter({ ...emptyPeopleFilters(), search: '   ' })).toBe(false);
  });
});

describe('vocabularies are non-empty and unique', () => {
  it('exposes every closed vocabulary', () => {
    for (const vocab of [
      SENIORITIES,
      DEPARTMENTS,
      HEADCOUNT_BANDS,
      VERIFICATION_STATUSES,
      DATA_SOURCES,
      BUYING_INTENTS,
    ]) {
      expect(vocab.length).toBeGreaterThan(0);
      expect(new Set(vocab).size).toBe(vocab.length);
    }
  });
});

describe('normalizePeopleText', () => {
  it('lowercases, trims and strips accents', () => {
    expect(normalizePeopleText('  MÜNCHEN ')).toBe('munchen');
    expect(normalizePeopleText('São Paulo')).toBe('sao paulo');
  });
});

describe('singularize', () => {
  it('handles the plural forms that appear in questions', () => {
    expect(singularize('managers')).toBe('manager');
    expect(singularize('companies')).toBe('company');
    expect(singularize('addresses')).toBe('address');
    expect(singularize('sales')).toBe('sales');
    expect(singularize('director')).toBe('director');
  });
});

describe('alias resolution', () => {
  it('maps verification words onto statuses', () => {
    expect(resolveVerification('verified')).toBe('verified');
    expect(resolveVerification('unverified')).toBe('needs_verification');
    expect(resolveVerification('needs verification')).toBe('needs_verification');
    expect(resolveVerification('bounced')).toBe('invalid');
    expect(resolveVerification('german')).toBeNull();
  });

  it('maps seniority words', () => {
    expect(resolveSeniority('vp')).toBe('VP');
    expect(resolveSeniority('vice president')).toBe('VP');
    expect(resolveSeniority('chief')).toBe('C-Level');
    expect(resolveSeniority('heads')).toBe('Director');
    expect(resolveSeniority('banana')).toBeNull();
  });

  it('maps department words', () => {
    expect(resolveDepartment('marketing')).toBe('Marketing');
    expect(resolveDepartment('devs')).toBe('Engineering');
    expect(resolveDepartment('people ops')).toBe('HR');
    expect(resolveDepartment('banana')).toBeNull();
  });

  it('maps headcount phrases onto bands', () => {
    expect(resolveHeadcountBand('startup')).toBe('11-50');
    expect(resolveHeadcountBand('enterprise')).toBe('5000+');
    expect(resolveHeadcountBand('51-200')).toBe('51-200');
    expect(resolveHeadcountBand('banana')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/people-vocabulary.test.ts`
Expected: FAIL — `Failed to resolve import "@/types/people"`.

- [ ] **Step 3: Write `types/people.ts`**

```ts
/**
 * Shared types for the People AI Explorer (left filter rail + chat + results).
 *
 * `PeopleFilters` is the single source of truth for both the rail and the
 * assistant: it is what the URL serialises, what the chat receives as
 * `activeFilters`, and what a chat reply's "Apply filters" writes back. That one
 * direction of truth is what makes the two panels bidirectional without a sync
 * effect.
 *
 * Every list-valued key is `string[]` rather than a narrow union array, matching
 * `EventFilters` in `types/events.ts`, so generic chip and facet code can index
 * `filters[key]`. Closed vocabularies are enforced when parsing URL params.
 */

export const SENIORITIES = [
  'C-Level',
  'VP',
  'Director',
  'Manager',
  'Senior',
  'Individual Contributor',
  'Entry',
] as const;
export type Seniority = (typeof SENIORITIES)[number];

export const DEPARTMENTS = [
  'Marketing',
  'Sales',
  'Engineering',
  'Product',
  'Operations',
  'Finance',
  'HR',
  'Procurement',
  'Legal',
  'IT',
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const HEADCOUNT_BANDS = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5000+',
] as const;
export type HeadcountBand = (typeof HEADCOUNT_BANDS)[number];

export const VERIFICATION_STATUSES = ['verified', 'needs_verification', 'invalid'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const DATA_SOURCES = ['user_import', 'licensed_dataset', 'enrichment'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export const BUYING_INTENTS = ['high', 'medium', 'low', 'none'] as const;
export type BuyingIntent = (typeof BUYING_INTENTS)[number];

/** Confidence ships as chips, not a slider (spec decision 6). */
export const CONFIDENCE_THRESHOLDS = [50, 70, 90] as const;
export type ConfidenceThreshold = (typeof CONFIDENCE_THRESHOLDS)[number];

export type Person = {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  seniority: Seniority;
  department: Department;
  company: string;
  companyDomain: string;
  companyHeadcount: HeadcountBand;
  industry: string;
  country: string;
  location: string;
  workEmail: string;
  phone: string | null;
  linkedinUrl: string | null;
  verification: VerificationStatus;
  /** 0-100. */
  confidence: number;
  /** 0-100. */
  platformScore: number;
  source: DataSource;
  keywords: string[];
  buyingIntent: BuyingIntent;
  /** ISO date, when this record was last refreshed. */
  fetchedAt: string;
  /** ISO date of the contact's last observed activity. */
  lastActiveAt: string;
};

export type PeopleFilters = {
  titles: string[];
  seniorities: string[];
  departments: string[];
  companies: string[];
  locations: string[];
  countries: string[];
  headcounts: string[];
  industries: string[];
  keywords: string[];
  buyingIntents: string[];
  sources: string[];
  /** Single-select — "All" is represented by null. */
  verification: VerificationStatus | null;
  /** Single-select floor; null means no confidence constraint. */
  minConfidence: ConfidenceThreshold | null;
  /** Id of the person to rank similarity against. */
  lookalikeSeedId: string | null;
  /** The rail's free-text box. */
  search: string;
};

export type PeopleFilterListKey =
  | 'titles'
  | 'seniorities'
  | 'departments'
  | 'companies'
  | 'locations'
  | 'countries'
  | 'headcounts'
  | 'industries'
  | 'keywords'
  | 'buyingIntents'
  | 'sources';

export const PEOPLE_FILTER_LIST_KEYS: PeopleFilterListKey[] = [
  'titles',
  'seniorities',
  'departments',
  'companies',
  'locations',
  'countries',
  'headcounts',
  'industries',
  'keywords',
  'buyingIntents',
  'sources',
];

export function emptyPeopleFilters(): PeopleFilters {
  return {
    titles: [],
    seniorities: [],
    departments: [],
    companies: [],
    locations: [],
    countries: [],
    headcounts: [],
    industries: [],
    keywords: [],
    buyingIntents: [],
    sources: [],
    verification: null,
    minConfidence: null,
    lookalikeSeedId: null,
    search: '',
  };
}

export function hasAnyPeopleFilter(filters: PeopleFilters): boolean {
  return (
    PEOPLE_FILTER_LIST_KEYS.some((key) => filters[key].length > 0) ||
    filters.verification !== null ||
    filters.minConfidence !== null ||
    filters.lookalikeSeedId !== null ||
    filters.search.trim().length > 0
  );
}

/** Header badge + data-source strip numbers. Never hardcoded in a component. */
export type PeopleStats = {
  total: number;
  avgConfidence: number;
  lastFetchedAt: string;
  sources: DataSource[];
};
```

- [ ] **Step 4: Write `lib/people/vocabulary.ts`**

```ts
import {
  DEPARTMENTS,
  HEADCOUNT_BANDS,
  SENIORITIES,
  type Department,
  type HeadcountBand,
  type Seniority,
  type VerificationStatus,
} from '@/types/people';

/**
 * How a human's words map onto the closed vocabularies. Used by the query
 * parser and by URL param validation, so "unverified" in a sentence and
 * `?verification=needs_verification` in a link land on the same value.
 */

export function normalizePeopleText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Enough English plural handling for job titles and department words. */
export function singularize(word: string): string {
  const lower = word.toLowerCase();
  // "sales", "operations" and friends are already singular as department names.
  if (/(?:ss|sis|us|sales|analytics|operations)$/.test(lower)) return lower;
  if (lower.endsWith('ies') && lower.length > 4) return `${lower.slice(0, -3)}y`;
  if (/(?:ches|shes|ses|xes|zes)$/.test(lower)) return lower.slice(0, -2);
  if (lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1);
  return lower;
}

const VERIFICATION_ALIASES: Record<string, VerificationStatus> = {
  verified: 'verified',
  valid: 'verified',
  confirmed: 'verified',
  'needs verification': 'needs_verification',
  needs_verification: 'needs_verification',
  unverified: 'needs_verification',
  unconfirmed: 'needs_verification',
  pending: 'needs_verification',
  invalid: 'invalid',
  bounced: 'invalid',
  bad: 'invalid',
  dead: 'invalid',
};

const SENIORITY_ALIASES: Record<string, Seniority> = {
  'c-level': 'C-Level',
  clevel: 'C-Level',
  'c level': 'C-Level',
  chief: 'C-Level',
  ceo: 'C-Level',
  cto: 'C-Level',
  cfo: 'C-Level',
  cmo: 'C-Level',
  founder: 'C-Level',
  executive: 'C-Level',
  vp: 'VP',
  'vice president': 'VP',
  'svp': 'VP',
  'evp': 'VP',
  director: 'Director',
  head: 'Director',
  lead: 'Director',
  manager: 'Manager',
  senior: 'Senior',
  'individual contributor': 'Individual Contributor',
  ic: 'Individual Contributor',
  entry: 'Entry',
  junior: 'Entry',
  intern: 'Entry',
};

const DEPARTMENT_ALIASES: Record<string, Department> = {
  marketing: 'Marketing',
  growth: 'Marketing',
  brand: 'Marketing',
  demand: 'Marketing',
  sales: 'Sales',
  revenue: 'Sales',
  'business development': 'Sales',
  bizdev: 'Sales',
  engineering: 'Engineering',
  dev: 'Engineering',
  developer: 'Engineering',
  technical: 'Engineering',
  product: 'Product',
  operations: 'Operations',
  ops: 'Operations',
  finance: 'Finance',
  accounting: 'Finance',
  hr: 'HR',
  'human resources': 'HR',
  'people ops': 'HR',
  people: 'HR',
  recruiting: 'HR',
  talent: 'HR',
  procurement: 'Procurement',
  purchasing: 'Procurement',
  sourcing: 'Procurement',
  legal: 'Legal',
  compliance: 'Legal',
  it: 'IT',
  'information technology': 'IT',
  infosec: 'IT',
};

const HEADCOUNT_ALIASES: Record<string, HeadcountBand> = {
  startup: '11-50',
  'small business': '11-50',
  smb: '51-200',
  midmarket: '201-500',
  'mid market': '201-500',
  'mid-market': '201-500',
  'large company': '1001-5000',
  enterprise: '5000+',
};

function lookup<T>(table: Record<string, T>, term: string): T | null {
  const normalized = normalizePeopleText(term);
  if (normalized in table) return table[normalized];
  const singular = singularize(normalized);
  return singular in table ? table[singular] : null;
}

export function resolveVerification(term: string): VerificationStatus | null {
  return lookup(VERIFICATION_ALIASES, term);
}

export function resolveSeniority(term: string): Seniority | null {
  const direct = SENIORITIES.find(
    (value) => normalizePeopleText(value) === normalizePeopleText(term)
  );
  if (direct) return direct;
  return lookup(SENIORITY_ALIASES, term);
}

export function resolveDepartment(term: string): Department | null {
  const direct = DEPARTMENTS.find(
    (value) => normalizePeopleText(value) === normalizePeopleText(term)
  );
  if (direct) return direct;
  return lookup(DEPARTMENT_ALIASES, term);
}

export function resolveHeadcountBand(term: string): HeadcountBand | null {
  const normalized = normalizePeopleText(term);
  const direct = HEADCOUNT_BANDS.find((band) => band.toLowerCase() === normalized);
  if (direct) return direct;
  return lookup(HEADCOUNT_ALIASES, term);
}

/** Human-facing labels for the enum values, used by chips and badges. */
export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  verified: 'Verified',
  needs_verification: 'Needs verification',
  invalid: 'Invalid',
};

export const SOURCE_LABELS: Record<string, string> = {
  user_import: 'User import',
  licensed_dataset: 'Licensed dataset',
  enrichment: 'Enrichment',
};

export const INTENT_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/integration/people-vocabulary.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 6: Commit**

```bash
git add types/people.ts lib/people/vocabulary.ts tests/integration/people-vocabulary.test.ts
git commit -m "feat(people): add People types and vocabulary alias resolution"
```

---

### Task 2: Seed generator and data loader

**Files:**
- Create: `scripts/generate-people-seed.mjs`
- Create: `data/people-seed.json` (generated by running the script)
- Create: `lib/people/data.ts`
- Test: `tests/integration/people-data.test.ts`

**Interfaces:**
- Consumes: `Person`, `PeopleStats`, and the vocabulary tuples from `types/people.ts` (Task 1).
- Produces: `loadPeople(): Person[]`, `peopleVocabulary(): PeopleVocabulary`, `computePeopleStats(people: readonly Person[]): PeopleStats`, and the type `PeopleVocabulary = { titles: string[]; companies: string[]; countries: string[]; locations: string[]; industries: string[]; keywords: string[] }`.

**Why a seeded PRNG:** the generator must be byte-reproducible so tests can assert exact counts and a re-run never churns the committed file.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/people-data.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computePeopleStats, loadPeople, peopleVocabulary } from '@/lib/people/data';
import {
  BUYING_INTENTS,
  DATA_SOURCES,
  DEPARTMENTS,
  HEADCOUNT_BANDS,
  SENIORITIES,
  VERIFICATION_STATUSES,
} from '@/types/people';

const people = loadPeople();

describe('people seed', () => {
  it('holds exactly 2418 records with unique ids', () => {
    expect(people).toHaveLength(2418);
    expect(new Set(people.map((person) => person.id)).size).toBe(2418);
  });

  it('populates every closed vocabulary', () => {
    for (const [key, vocab] of [
      ['seniority', SENIORITIES],
      ['department', DEPARTMENTS],
      ['companyHeadcount', HEADCOUNT_BANDS],
      ['verification', VERIFICATION_STATUSES],
      ['source', DATA_SOURCES],
      ['buyingIntent', BUYING_INTENTS],
    ] as const) {
      const present = new Set(people.map((person) => person[key] as string));
      for (const value of vocab) {
        expect(present.has(value), `${key} missing ${value}`).toBe(true);
      }
    }
  });

  it('gives every open vocabulary at least 20 distinct members', () => {
    const vocabulary = peopleVocabulary();
    expect(vocabulary.titles.length).toBeGreaterThanOrEqual(20);
    expect(vocabulary.companies.length).toBeGreaterThanOrEqual(20);
    expect(vocabulary.countries.length).toBeGreaterThanOrEqual(20);
    expect(vocabulary.locations.length).toBeGreaterThanOrEqual(20);
    expect(vocabulary.industries.length).toBeGreaterThanOrEqual(20);
    expect(vocabulary.keywords.length).toBeGreaterThanOrEqual(20);
  });

  it('keeps every record structurally valid', () => {
    for (const person of people) {
      expect(person.confidence).toBeGreaterThanOrEqual(0);
      expect(person.confidence).toBeLessThanOrEqual(100);
      expect(person.platformScore).toBeGreaterThanOrEqual(0);
      expect(person.platformScore).toBeLessThanOrEqual(100);
      expect(person.workEmail).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
      expect(person.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(person.keywords.length).toBeGreaterThan(0);
    }
  });

  it('contains the worked example the chat is specced against', () => {
    const matches = people.filter(
      (person) =>
        person.country === 'Germany' &&
        person.verification === 'verified' &&
        person.title.toLowerCase().includes('marketing manager')
    );
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe('computePeopleStats', () => {
  it('reports a mean confidence that renders as 84% (Good)', () => {
    const stats = computePeopleStats(people);
    expect(stats.total).toBe(2418);
    expect(stats.avgConfidence).toBe(84);
    expect(stats.lastFetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(stats.sources.length).toBeGreaterThan(0);
  });

  it('handles an empty set without dividing by zero', () => {
    const stats = computePeopleStats([]);
    expect(stats.total).toBe(0);
    expect(stats.avgConfidence).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/people-data.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/people/data"`.

- [ ] **Step 3: Write the generator**

Create `scripts/generate-people-seed.mjs`:

```js
// Generates data/people-seed.json — the committed People discovery dataset.
//
// Deterministic by construction: a seeded PRNG means re-running produces a
// byte-identical file, so tests can assert exact counts and the repo never
// churns. Run with:  node scripts/generate-people-seed.mjs
//
// The script asserts its own distributions BEFORE writing, so a change that
// starves a facet fails loudly here rather than silently emptying a filter
// group in the UI.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'data', 'people-seed.json');

const TOTAL = 2418;
/** Mean confidence must land on 84 so the strip reads "84% (Good)". */
const TARGET_MEAN_CONFIDENCE = 84;

/** mulberry32 — small, fast, and stable across Node versions. */
function makeRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(20260816);

const pick = (list) => list[Math.floor(random() * list.length)];
const pickN = (list, n) => {
  const copy = [...list];
  const out = [];
  for (let i = 0; i < n && copy.length > 0; i += 1) {
    out.push(copy.splice(Math.floor(random() * copy.length), 1)[0]);
  }
  return out;
};
const intBetween = (min, max) => min + Math.floor(random() * (max - min + 1));

const FIRST_NAMES = [
  'Sarah', 'David', 'Amina', 'Jonas', 'Mia', 'Luca', 'Elena', 'Tomas', 'Priya', 'Marcus',
  'Chloe', 'Hiroshi', 'Ingrid', 'Rafael', 'Nadia', 'Oliver', 'Fatima', 'Sven', 'Yuki', 'Diego',
  'Anna', 'Peter', 'Leila', 'Andreas', 'Grace', 'Mateo', 'Sofia', 'Karl', 'Aisha', 'Daniel',
  'Emma', 'Viktor', 'Lucia', 'Samuel', 'Noor', 'Felix', 'Clara', 'Omar', 'Hannah', 'Niklas',
];

const LAST_NAMES = [
  'Miller', 'Lee', 'Khan', 'Richter', 'Thompson', 'Romano', 'Silva', 'Novak', 'Sharma', 'Weber',
  'Dubois', 'Tanaka', 'Larsen', 'Costa', 'Haddad', 'Bennett', 'Aziz', 'Andersson', 'Sato', 'Moreno',
  'Fischer', 'Walsh', 'Nasser', 'Berg', 'Okafor', 'Rossi', 'Garcia', 'Schmidt', 'Ali', 'Novotny',
  'Meyer', 'Petrov', 'Ferreira', 'Cohen', 'Yilmaz', 'Bauer', 'Lindqvist', 'Hassan', 'Krause', 'Vogel',
];

const SENIORITIES = ['C-Level', 'VP', 'Director', 'Manager', 'Senior', 'Individual Contributor', 'Entry'];
const DEPARTMENTS = ['Marketing', 'Sales', 'Engineering', 'Product', 'Operations', 'Finance', 'HR', 'Procurement', 'Legal', 'IT'];
const HEADCOUNT_BANDS = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'];
const VERIFICATION_STATUSES = ['verified', 'needs_verification', 'invalid'];
const DATA_SOURCES = ['user_import', 'licensed_dataset', 'enrichment'];
const BUYING_INTENTS = ['high', 'medium', 'low', 'none'];

/** Titles per department, so a title is never nonsense for its department. */
const TITLES_BY_DEPARTMENT = {
  Marketing: ['Marketing Manager', 'Head of Marketing', 'Demand Generation Manager', 'Brand Manager', 'Content Marketing Lead', 'Chief Marketing Officer', 'Marketing Coordinator'],
  Sales: ['Sales Director', 'Account Executive', 'Sales Manager', 'Business Development Manager', 'VP of Sales', 'Sales Development Representative'],
  Engineering: ['Engineering Manager', 'Senior Software Engineer', 'Head of Engineering', 'Platform Engineer', 'Chief Technology Officer', 'QA Engineer'],
  Product: ['Product Manager', 'Head of Product', 'Product Lead', 'Product Designer', 'Chief Product Officer', 'Associate Product Manager'],
  Operations: ['Operations Manager', 'Head of Operations', 'Supply Chain Manager', 'Chief Operating Officer', 'Operations Analyst'],
  Finance: ['Finance Director', 'Financial Controller', 'Chief Financial Officer', 'Finance Manager', 'Financial Analyst'],
  HR: ['HR Manager', 'Head of People', 'Talent Acquisition Lead', 'Chief People Officer', 'HR Business Partner'],
  Procurement: ['Procurement Lead', 'Purchasing Manager', 'Head of Procurement', 'Sourcing Specialist', 'Category Manager'],
  Legal: ['Legal Counsel', 'Head of Legal', 'Compliance Manager', 'General Counsel', 'Contracts Manager'],
  IT: ['IT Manager', 'Head of IT', 'Systems Administrator', 'Chief Information Officer', 'IT Support Specialist'],
};

/** Which seniority a title implies — keeps the two columns consistent. */
function seniorityForTitle(title) {
  if (/^Chief|^General Counsel/.test(title)) return 'C-Level';
  if (/^VP |Vice President/.test(title)) return 'VP';
  if (/^Head of|Director|Lead$|Counsel$/.test(title)) return 'Director';
  if (/Manager|Controller|Partner$/.test(title)) return 'Manager';
  if (/^Senior/.test(title)) return 'Senior';
  if (/Coordinator|Associate|Support|Representative/.test(title)) return 'Entry';
  return 'Individual Contributor';
}

const COUNTRIES = [
  { country: 'Germany', cities: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt'], tld: 'de' },
  { country: 'United Kingdom', cities: ['London', 'Manchester', 'Bristol'], tld: 'co.uk' },
  { country: 'France', cities: ['Paris', 'Lyon', 'Toulouse'], tld: 'fr' },
  { country: 'United States', cities: ['New York', 'San Francisco', 'Chicago', 'Austin'], tld: 'com' },
  { country: 'Netherlands', cities: ['Amsterdam', 'Rotterdam'], tld: 'nl' },
  { country: 'Spain', cities: ['Madrid', 'Barcelona'], tld: 'es' },
  { country: 'Italy', cities: ['Milan', 'Rome'], tld: 'it' },
  { country: 'Sweden', cities: ['Stockholm', 'Gothenburg'], tld: 'se' },
  { country: 'Poland', cities: ['Warsaw', 'Krakow'], tld: 'pl' },
  { country: 'India', cities: ['Bengaluru', 'Mumbai', 'Pune'], tld: 'in' },
  { country: 'Japan', cities: ['Tokyo', 'Osaka'], tld: 'jp' },
  { country: 'Canada', cities: ['Toronto', 'Vancouver'], tld: 'ca' },
  { country: 'Australia', cities: ['Sydney', 'Melbourne'], tld: 'com.au' },
  { country: 'Brazil', cities: ['Sao Paulo', 'Rio de Janeiro'], tld: 'com.br' },
  { country: 'Switzerland', cities: ['Zurich', 'Geneva'], tld: 'ch' },
  { country: 'Denmark', cities: ['Copenhagen'], tld: 'dk' },
  { country: 'Ireland', cities: ['Dublin'], tld: 'ie' },
  { country: 'Belgium', cities: ['Brussels', 'Antwerp'], tld: 'be' },
  { country: 'Norway', cities: ['Oslo'], tld: 'no' },
  { country: 'Austria', cities: ['Vienna'], tld: 'at' },
  { country: 'Portugal', cities: ['Lisbon', 'Porto'], tld: 'pt' },
  { country: 'Singapore', cities: ['Singapore'], tld: 'sg' },
  { country: 'United Arab Emirates', cities: ['Dubai', 'Abu Dhabi'], tld: 'ae' },
  { country: 'Finland', cities: ['Helsinki'], tld: 'fi' },
];

const INDUSTRIES = [
  'Artificial Intelligence', 'SaaS', 'Manufacturing', 'Healthcare', 'Logistics',
  'Renewable Energy', 'Financial Services', 'Automotive', 'Pharmaceuticals', 'Retail',
  'Telecommunications', 'Construction', 'Aerospace', 'Food & Beverage', 'Chemicals',
  'Cybersecurity', 'Education', 'Real Estate', 'Media', 'Agriculture',
  'Consumer Electronics', 'Insurance', 'Hospitality', 'Mining',
];

const COMPANY_PREFIXES = [
  'Nova', 'Cloud', 'Medi', 'Electro', 'Green', 'Secure', 'Data', 'Bright', 'Quantum', 'Orbit',
  'Vertex', 'Helio', 'Iron', 'Lumen', 'Atlas', 'Pulse', 'Nimbus', 'Forge', 'Delta', 'Zenith',
  'Apex', 'Cobalt', 'Ember', 'Northwind', 'Silva', 'Terra', 'Vega', 'Onyx', 'Kestrel', 'Sable',
];
const COMPANY_SUFFIXES = [
  'AI', 'Systems', 'Labs', 'Works', 'Dynamics', 'Group', 'Technologies', 'Industries',
  'Solutions', 'Networks', 'Robotics', 'Analytics',
];

const KEYWORDS = [
  'automation', 'sustainability', 'cloud migration', 'compliance', 'expansion',
  'digital transformation', 'cost reduction', 'hiring', 'partnerships', 'export',
  'data privacy', 'supply chain', 'customer retention', 'product launch', 'esg',
  'machine learning', 'iot', 'logistics', 'certification', 'rebrand',
  'market entry', 'procurement reform', 'esg reporting', 'trade shows',
];

/** Weighted pick: entries are [value, weight]. */
function weighted(entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

function buildCompanies() {
  const companies = [];
  const seen = new Set();
  // 240 companies over 2418 people gives ~10 contacts each — enough for the
  // Company facet to be useful without any single company dominating.
  while (companies.length < 240) {
    const name = `${pick(COMPANY_PREFIXES)}${pick(COMPANY_SUFFIXES)}`;
    if (seen.has(name)) continue;
    seen.add(name);
    const place = pick(COUNTRIES);
    companies.push({
      name,
      domain: `${name.toLowerCase()}.${place.tld}`,
      country: place.country,
      cities: place.cities,
      industry: pick(INDUSTRIES),
      headcount: weighted([
        ['1-10', 6], ['11-50', 14], ['51-200', 22], ['201-500', 20],
        ['501-1000', 16], ['1001-5000', 14], ['5000+', 8],
      ]),
    });
  }
  return companies;
}

function confidenceFor(verification) {
  // Verified records are trustworthy, invalid ones are not; the spread is what
  // makes the >=50/70/90 chips meaningfully different from each other.
  if (verification === 'verified') return intBetween(82, 99);
  if (verification === 'needs_verification') return intBetween(58, 84);
  return intBetween(20, 55);
}

function isoDaysAgo(days) {
  const base = Date.UTC(2026, 7, 16); // 2026-08-16
  return new Date(base - days * 86400000).toISOString().slice(0, 10);
}

function generate() {
  const companies = buildCompanies();
  const people = [];

  for (let index = 0; index < TOTAL; index += 1) {
    const company = companies[index % companies.length];
    const department = pick(DEPARTMENTS);
    const title = pick(TITLES_BY_DEPARTMENT[department]);
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const verification = weighted([
      ['verified', 62], ['needs_verification', 29], ['invalid', 9],
    ]);
    const confidence = confidenceFor(verification);
    const city = pick(company.cities);

    people.push({
      id: `pcx-person-${String(index + 1).padStart(5, '0')}`,
      firstName,
      lastName,
      title,
      seniority: seniorityForTitle(title),
      department,
      company: company.name,
      companyDomain: company.domain,
      companyHeadcount: company.headcount,
      industry: company.industry,
      country: company.country,
      location: `${city}, ${company.country}`,
      workEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@${company.domain}`,
      phone: random() < 0.55 ? `+${intBetween(1, 99)} ${intBetween(10, 99)} ${intBetween(1000000, 9999999)}` : null,
      linkedinUrl:
        random() < 0.7
          ? `https://www.linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${index}`
          : null,
      verification,
      confidence,
      platformScore: Math.max(0, Math.min(100, confidence + intBetween(-12, 12))),
      source: weighted([['user_import', 34], ['licensed_dataset', 44], ['enrichment', 22]]),
      keywords: pickN(KEYWORDS, intBetween(1, 3)),
      buyingIntent: weighted([['high', 18], ['medium', 30], ['low', 32], ['none', 20]]),
      fetchedAt: isoDaysAgo(intBetween(0, 180)),
      lastActiveAt: isoDaysAgo(intBetween(0, 365)),
    });
  }

  return people;
}

/**
 * Nudges confidence until the mean rounds to exactly TARGET_MEAN_CONFIDENCE,
 * without pushing any record outside its verification band's plausible range.
 */
function calibrateConfidence(people) {
  const mean = () => people.reduce((sum, p) => sum + p.confidence, 0) / people.length;
  let guard = 0;
  while (Math.round(mean()) !== TARGET_MEAN_CONFIDENCE && guard < 200000) {
    const needsHigher = mean() < TARGET_MEAN_CONFIDENCE;
    const person = people[guard % people.length];
    const ceiling = person.verification === 'invalid' ? 55 : 99;
    const floor = person.verification === 'invalid' ? 20 : 40;
    if (needsHigher && person.confidence < ceiling) person.confidence += 1;
    if (!needsHigher && person.confidence > floor) person.confidence -= 1;
    guard += 1;
  }
  if (Math.round(mean()) !== TARGET_MEAN_CONFIDENCE) {
    throw new Error(`Could not calibrate mean confidence to ${TARGET_MEAN_CONFIDENCE}`);
  }
}

function assertDistributions(people) {
  const fail = (message) => {
    throw new Error(`Seed assertion failed: ${message}`);
  };

  if (people.length !== TOTAL) fail(`expected ${TOTAL} records, got ${people.length}`);
  if (new Set(people.map((p) => p.id)).size !== TOTAL) fail('ids are not unique');

  const distinct = (key) => new Set(people.map((p) => p[key]));
  for (const [key, vocab] of [
    ['seniority', SENIORITIES],
    ['department', DEPARTMENTS],
    ['companyHeadcount', HEADCOUNT_BANDS],
    ['verification', VERIFICATION_STATUSES],
    ['source', DATA_SOURCES],
    ['buyingIntent', BUYING_INTENTS],
  ]) {
    const present = distinct(key);
    for (const value of vocab) {
      if (!present.has(value)) fail(`${key} never takes the value "${value}"`);
    }
  }

  for (const key of ['title', 'company', 'country', 'location', 'industry']) {
    if (distinct(key).size < 20) fail(`${key} has fewer than 20 distinct values`);
  }
  if (new Set(people.flatMap((p) => p.keywords)).size < 20) fail('fewer than 20 distinct keywords');

  const mean = people.reduce((sum, p) => sum + p.confidence, 0) / people.length;
  if (Math.round(mean) !== TARGET_MEAN_CONFIDENCE) {
    fail(`mean confidence rounds to ${Math.round(mean)}, expected ${TARGET_MEAN_CONFIDENCE}`);
  }

  // The worked example from the spec must actually return rows.
  const worked = people.filter(
    (p) =>
      p.country === 'Germany' &&
      p.verification === 'verified' &&
      p.title.toLowerCase().includes('marketing manager')
  );
  if (worked.length === 0) fail('no verified Marketing Managers in Germany');
}

const people = generate();
calibrateConfidence(people);
assertDistributions(people);

writeFileSync(OUT, `${JSON.stringify(people)}\n`, 'utf8');
console.log(
  `Wrote ${people.length} people to ${OUT} ` +
    `(mean confidence ${Math.round(people.reduce((s, p) => s + p.confidence, 0) / people.length)})`
);
```

- [ ] **Step 4: Generate the seed**

Run: `node scripts/generate-people-seed.mjs`
Expected: `Wrote 2418 people to ...\data\people-seed.json (mean confidence 84)`

If it throws a `Seed assertion failed:` error, fix the generator — do not weaken the assertion.

Confirm the size is roughly as specced (about 1–2 MB, well under the 7.5 MB `find-shows-seed.json` already committed):

Run: `node -e "console.log((require('fs').statSync('data/people-seed.json').size/1048576).toFixed(2)+' MB')"`

- [ ] **Step 5: Write `lib/people/data.ts`**

```ts
import seed from '../../data/people-seed.json';
import type { DataSource, Person, PeopleStats } from '@/types/people';

/**
 * Typed access to the committed People dataset, plus the derived indexes the
 * rail and the query parser need. Everything is memoised at module scope: the
 * seed is immutable, so the work is done once per process.
 *
 * Imported directly as JSON, matching `lib/find-shows/catalog.ts`.
 */

const PEOPLE = seed as Person[];

export function loadPeople(): Person[] {
  return PEOPLE;
}

export type PeopleVocabulary = {
  titles: string[];
  companies: string[];
  countries: string[];
  locations: string[];
  industries: string[];
  keywords: string[];
};

let vocabularyCache: PeopleVocabulary | null = null;

/** Distinct open-vocabulary values, sorted longest-first for phrase matching. */
export function peopleVocabulary(): PeopleVocabulary {
  if (vocabularyCache) return vocabularyCache;

  const collect = (values: string[]) =>
    Array.from(new Set(values.filter(Boolean))).sort(
      (left, right) => right.length - left.length || left.localeCompare(right)
    );

  vocabularyCache = {
    titles: collect(PEOPLE.map((person) => person.title)),
    companies: collect(PEOPLE.map((person) => person.company)),
    countries: collect(PEOPLE.map((person) => person.country)),
    locations: collect(PEOPLE.map((person) => person.location)),
    industries: collect(PEOPLE.map((person) => person.industry)),
    keywords: collect(PEOPLE.flatMap((person) => person.keywords)),
  };
  return vocabularyCache;
}

export function computePeopleStats(people: readonly Person[]): PeopleStats {
  if (people.length === 0) {
    return { total: 0, avgConfidence: 0, lastFetchedAt: '', sources: [] };
  }

  const totalConfidence = people.reduce((sum, person) => sum + person.confidence, 0);
  const lastFetchedAt = people.reduce(
    (latest, person) => (person.fetchedAt > latest ? person.fetchedAt : latest),
    people[0].fetchedAt
  );
  const sources = Array.from(new Set(people.map((person) => person.source))) as DataSource[];

  return {
    total: people.length,
    avgConfidence: Math.round(totalConfidence / people.length),
    lastFetchedAt,
    sources,
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/integration/people-data.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-people-seed.mjs data/people-seed.json lib/people/data.ts tests/integration/people-data.test.ts
git commit -m "feat(people): generate the committed People seed and add the typed loader"
```

---

### Task 3: Filtering, faceting and URL serialisation

**Files:**
- Create: `lib/people/filters.ts`
- Test: `tests/integration/people-filters.test.ts`

**Interfaces:**
- Consumes: `Person`, `PeopleFilters`, `PEOPLE_FILTER_LIST_KEYS`, `emptyPeopleFilters` (Task 1); nothing from Task 2 (kept seed-independent so tests use fixtures).
- Produces: `applyPeopleFilters(people: readonly Person[], filters: PeopleFilters): Person[]`, `computePeopleFacets(people: readonly Person[], filters: PeopleFilters): PeopleFacets`, `filtersToParams(filters: PeopleFilters): URLSearchParams`, `paramsToFilters(search: string | URLSearchParams): PeopleFilters`, `serializePeopleQuery(filters: PeopleFilters, extra?: Record<string, string>): string`, and the types `FacetOption = { value: string; count: number }`, `PeopleFacetKey`, `PeopleFacets`.

**Faceting rule (same as Events):** each dimension is counted with *its own* predicate held out, so opening "Country" still offers every country reachable under the other filters rather than only the selected one.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/people-filters.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  applyPeopleFilters,
  computePeopleFacets,
  paramsToFilters,
  serializePeopleQuery,
} from '@/lib/people/filters';
import { emptyPeopleFilters, type PeopleFilters, type Person } from '@/types/people';

function makePerson(overrides: Partial<Person> & { id: string }): Person {
  return {
    id: overrides.id,
    firstName: 'Sarah',
    lastName: 'Miller',
    title: 'Marketing Manager',
    seniority: 'Manager',
    department: 'Marketing',
    company: 'NovaAI',
    companyDomain: 'novaai.de',
    companyHeadcount: '51-200',
    industry: 'Artificial Intelligence',
    country: 'Germany',
    location: 'Berlin, Germany',
    workEmail: 'sarah.miller@novaai.de',
    phone: null,
    linkedinUrl: null,
    verification: 'verified',
    confidence: 91,
    platformScore: 98,
    source: 'user_import',
    keywords: ['automation'],
    buyingIntent: 'high',
    fetchedAt: '2026-02-01',
    lastActiveAt: '2026-08-01',
    ...overrides,
  };
}

const people: Person[] = [
  makePerson({ id: 'p1' }),
  makePerson({
    id: 'p2',
    firstName: 'David',
    lastName: 'Lee',
    title: 'Sales Director',
    seniority: 'Director',
    department: 'Sales',
    company: 'CloudForge',
    country: 'United Kingdom',
    location: 'London, United Kingdom',
    workEmail: 'david.lee@cloudforge.co.uk',
    verification: 'needs_verification',
    confidence: 68,
    source: 'licensed_dataset',
    keywords: ['expansion'],
    buyingIntent: 'low',
    companyHeadcount: '1001-5000',
    industry: 'SaaS',
  }),
  makePerson({
    id: 'p3',
    firstName: 'Jonas',
    lastName: 'Richter',
    title: 'Product Lead',
    seniority: 'Director',
    department: 'Product',
    company: 'NovaAI',
    verification: 'invalid',
    confidence: 41,
    source: 'enrichment',
    keywords: ['automation', 'iot'],
    buyingIntent: 'none',
  }),
];

function withFilters(overrides: Partial<PeopleFilters>): PeopleFilters {
  return { ...emptyPeopleFilters(), ...overrides };
}

describe('applyPeopleFilters', () => {
  it('returns everything when nothing is applied', () => {
    expect(applyPeopleFilters(people, emptyPeopleFilters())).toHaveLength(3);
  });

  it('ORs within a dimension and ANDs across dimensions', () => {
    expect(
      applyPeopleFilters(people, withFilters({ departments: ['Marketing', 'Sales'] }))
    ).toHaveLength(2);

    expect(
      applyPeopleFilters(
        people,
        withFilters({ departments: ['Marketing', 'Sales'], countries: ['Germany'] })
      ).map((person) => person.id)
    ).toEqual(['p1']);
  });

  it('filters on verification as a single value', () => {
    expect(
      applyPeopleFilters(people, withFilters({ verification: 'verified' })).map((p) => p.id)
    ).toEqual(['p1']);
  });

  it('treats minConfidence as an inclusive floor', () => {
    expect(applyPeopleFilters(people, withFilters({ minConfidence: 50 })).map((p) => p.id)).toEqual([
      'p1',
      'p2',
    ]);
    expect(applyPeopleFilters(people, withFilters({ minConfidence: 90 })).map((p) => p.id)).toEqual([
      'p1',
    ]);
  });

  it('matches titles as a substring, case-insensitively', () => {
    expect(applyPeopleFilters(people, withFilters({ titles: ['marketing'] })).map((p) => p.id)).toEqual(
      ['p1']
    );
  });

  it('matches company, country and location exactly but case-insensitively', () => {
    expect(applyPeopleFilters(people, withFilters({ companies: ['novaai'] }))).toHaveLength(2);
    expect(applyPeopleFilters(people, withFilters({ countries: ['GERMANY'] }))).toHaveLength(2);
    expect(
      applyPeopleFilters(people, withFilters({ locations: ['London, United Kingdom'] }))
    ).toHaveLength(1);
  });

  it('ORs keywords so any listed term is enough', () => {
    expect(applyPeopleFilters(people, withFilters({ keywords: ['iot'] })).map((p) => p.id)).toEqual([
      'p3',
    ]);
    expect(applyPeopleFilters(people, withFilters({ keywords: ['iot', 'expansion'] }))).toHaveLength(
      2
    );
  });

  it('searches name, title, company and email', () => {
    expect(applyPeopleFilters(people, withFilters({ search: 'david' })).map((p) => p.id)).toEqual([
      'p2',
    ]);
    expect(applyPeopleFilters(people, withFilters({ search: 'cloudforge.co.uk' })).map((p) => p.id)).toEqual([
      'p2',
    ]);
    expect(applyPeopleFilters(people, withFilters({ search: 'sarah miller' })).map((p) => p.id)).toEqual([
      'p1',
    ]);
  });

  it('returns an empty list rather than throwing when nothing matches', () => {
    expect(applyPeopleFilters(people, withFilters({ countries: ['Atlantis'] }))).toEqual([]);
  });
});

describe('computePeopleFacets', () => {
  it('counts a dimension as if its own selection were cleared', () => {
    const facets = computePeopleFacets(people, withFilters({ countries: ['Germany'] }));

    // Country counts ignore the country filter, so the UK is still offered.
    expect(facets.countries).toEqual([
      { value: 'Germany', count: 2 },
      { value: 'United Kingdom', count: 1 },
    ]);
    // Department counts DO respect it.
    expect(facets.departments.map((option) => option.value).sort()).toEqual([
      'Marketing',
      'Product',
    ]);
  });

  it('counts verification alongside the list dimensions', () => {
    const facets = computePeopleFacets(people, emptyPeopleFilters());
    expect(facets.verification).toEqual([
      { value: 'invalid', count: 1 },
      { value: 'needs_verification', count: 1 },
      { value: 'verified', count: 1 },
    ]);
  });

  it('sorts by count descending, then alphabetically', () => {
    const facets = computePeopleFacets(people, emptyPeopleFilters());
    expect(facets.companies).toEqual([
      { value: 'NovaAI', count: 2 },
      { value: 'CloudForge', count: 1 },
    ]);
  });
});

describe('URL round-trip', () => {
  it('round-trips every filter through the query string', () => {
    const filters = withFilters({
      titles: ['Marketing Manager'],
      seniorities: ['Manager'],
      departments: ['Marketing'],
      companies: ['NovaAI'],
      locations: ['Berlin, Germany'],
      countries: ['Germany', 'France'],
      headcounts: ['51-200'],
      industries: ['Artificial Intelligence'],
      keywords: ['automation'],
      buyingIntents: ['high'],
      sources: ['user_import'],
      verification: 'verified',
      minConfidence: 70,
      lookalikeSeedId: 'p1',
      search: 'sarah',
    });

    expect(paramsToFilters(serializePeopleQuery(filters))).toEqual(filters);
  });

  it('serialises an untouched state to an empty string', () => {
    expect(serializePeopleQuery(emptyPeopleFilters())).toBe('');
  });

  it('appends extra params such as tab and page', () => {
    const query = serializePeopleQuery(emptyPeopleFilters(), { tab: 'saved', page: '3' });
    expect(query).toBe('?tab=saved&page=3');
  });

  it('drops values outside the closed vocabularies', () => {
    const filters = paramsToFilters(
      '?verification=banana&minConfidence=63&seniority=Wizard&seniority=VP&intent=galactic&source=user_import'
    );
    expect(filters.verification).toBeNull();
    expect(filters.minConfidence).toBeNull();
    expect(filters.seniorities).toEqual(['VP']);
    expect(filters.buyingIntents).toEqual([]);
    expect(filters.sources).toEqual(['user_import']);
  });

  it('ignores unknown params instead of throwing', () => {
    expect(paramsToFilters('?nonsense=1&country=Germany').countries).toEqual(['Germany']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/people-filters.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/people/filters"`.

- [ ] **Step 3: Write `lib/people/filters.ts`**

```ts
import {
  BUYING_INTENTS,
  CONFIDENCE_THRESHOLDS,
  DATA_SOURCES,
  DEPARTMENTS,
  HEADCOUNT_BANDS,
  PEOPLE_FILTER_LIST_KEYS,
  SENIORITIES,
  VERIFICATION_STATUSES,
  emptyPeopleFilters,
  type ConfidenceThreshold,
  type PeopleFilterListKey,
  type PeopleFilters,
  type Person,
  type VerificationStatus,
} from '@/types/people';
import { normalizePeopleText } from '@/lib/people/vocabulary';

/**
 * Pure filtering, faceting and URL (de)serialisation for the People Explorer.
 *
 * Deliberately free of React and of the Claude SDK so the client rail and the
 * API routes can share it — the client filters instantly while typing, the
 * route applies the identical rules, and the two cannot drift.
 */

// ---------------------------------------------------------------------------
// URL <-> filters
// ---------------------------------------------------------------------------

const LIST_PARAM: Record<PeopleFilterListKey, string> = {
  titles: 'title',
  seniorities: 'seniority',
  departments: 'department',
  companies: 'company',
  locations: 'location',
  countries: 'country',
  headcounts: 'headcount',
  industries: 'industry',
  keywords: 'keyword',
  buyingIntents: 'intent',
  sources: 'source',
};

/**
 * Closed vocabularies are enforced here, at the parse boundary. Values arrive
 * from shared links and from the query parser, so neither source is trusted.
 * An open vocabulary (title, company, location, industry, keyword) accepts any
 * non-empty string — it is matched against the data, not against a list.
 */
const CLOSED_VOCABULARY: Partial<Record<PeopleFilterListKey, readonly string[]>> = {
  seniorities: SENIORITIES,
  departments: DEPARTMENTS,
  headcounts: HEADCOUNT_BANDS,
  buyingIntents: BUYING_INTENTS,
  sources: DATA_SOURCES,
};

export function paramsToFilters(search: string | URLSearchParams): PeopleFilters {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const filters = emptyPeopleFilters();

  for (const key of PEOPLE_FILTER_LIST_KEYS) {
    const values = params.getAll(LIST_PARAM[key]).filter(Boolean);
    const allowed = CLOSED_VOCABULARY[key];
    filters[key] = allowed ? values.filter((value) => allowed.includes(value)) : values;
  }

  const verification = params.get('verification');
  filters.verification =
    verification && (VERIFICATION_STATUSES as readonly string[]).includes(verification)
      ? (verification as VerificationStatus)
      : null;

  const minConfidence = Number(params.get('minConfidence'));
  filters.minConfidence = (CONFIDENCE_THRESHOLDS as readonly number[]).includes(minConfidence)
    ? (minConfidence as ConfidenceThreshold)
    : null;

  filters.lookalikeSeedId = params.get('lookalike') || null;
  filters.search = params.get('q') ?? '';

  return filters;
}

export function filtersToParams(filters: PeopleFilters): URLSearchParams {
  const params = new URLSearchParams();

  for (const key of PEOPLE_FILTER_LIST_KEYS) {
    for (const value of filters[key]) params.append(LIST_PARAM[key], value);
  }
  if (filters.verification) params.set('verification', filters.verification);
  if (filters.minConfidence !== null) params.set('minConfidence', String(filters.minConfidence));
  if (filters.lookalikeSeedId) params.set('lookalike', filters.lookalikeSeedId);
  if (filters.search.trim()) params.set('q', filters.search.trim());

  return params;
}

/** Serialises to a leading-`?` string, or '' when nothing at all is set. */
export function serializePeopleQuery(
  filters: PeopleFilters,
  extra: Record<string, string> = {}
): string {
  const params = filtersToParams(filters);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

type Dimension = PeopleFilterListKey | 'verification' | 'confidence' | 'search';

function equalsAny(value: string, candidates: string[]): boolean {
  const normalized = normalizePeopleText(value);
  return candidates.some((candidate) => normalizePeopleText(candidate) === normalized);
}

function includesAny(value: string, candidates: string[]): boolean {
  const normalized = normalizePeopleText(value);
  return candidates.some((candidate) => normalized.includes(normalizePeopleText(candidate)));
}

function searchBlob(person: Person): string {
  return normalizePeopleText(
    [
      person.firstName,
      person.lastName,
      person.title,
      person.company,
      person.workEmail,
      person.location,
      person.industry,
    ].join(' ')
  );
}

/**
 * One predicate per dimension, so faceting can re-run the match with a single
 * dimension held out without duplicating the matching rules.
 */
function buildChecks(
  filters: PeopleFilters
): Record<Dimension, ((person: Person) => boolean) | null> {
  const query = normalizePeopleText(filters.search);

  return {
    // Open vocabularies match loosely — "marketing" should find "Marketing
    // Manager", and the model may return a partial title.
    titles: filters.titles.length ? (p) => includesAny(p.title, filters.titles) : null,
    industries: filters.industries.length ? (p) => includesAny(p.industry, filters.industries) : null,
    // Closed or exact-identity vocabularies match exactly.
    seniorities: filters.seniorities.length ? (p) => equalsAny(p.seniority, filters.seniorities) : null,
    departments: filters.departments.length
      ? (p) => equalsAny(p.department, filters.departments)
      : null,
    companies: filters.companies.length ? (p) => equalsAny(p.company, filters.companies) : null,
    locations: filters.locations.length ? (p) => equalsAny(p.location, filters.locations) : null,
    countries: filters.countries.length ? (p) => equalsAny(p.country, filters.countries) : null,
    headcounts: filters.headcounts.length
      ? (p) => equalsAny(p.companyHeadcount, filters.headcounts)
      : null,
    buyingIntents: filters.buyingIntents.length
      ? (p) => equalsAny(p.buyingIntent, filters.buyingIntents)
      : null,
    sources: filters.sources.length ? (p) => equalsAny(p.source, filters.sources) : null,
    // Keywords are OR-ed: a contact tagged with any selected term qualifies.
    keywords: filters.keywords.length
      ? (p) => p.keywords.some((keyword) => equalsAny(keyword, filters.keywords))
      : null,
    verification: filters.verification ? (p) => p.verification === filters.verification : null,
    confidence:
      filters.minConfidence !== null
        ? (p) => p.confidence >= (filters.minConfidence as number)
        : null,
    search: query ? (p) => searchBlob(p).includes(query) : null,
  };
}

export function applyPeopleFilters(
  people: readonly Person[],
  filters: PeopleFilters
): Person[] {
  const checks = buildChecks(filters);
  const active = Object.values(checks).filter(Boolean) as ((person: Person) => boolean)[];
  if (active.length === 0) return people as Person[];
  return people.filter((person) => active.every((check) => check(person)));
}

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

export type FacetOption = { value: string; count: number };
export type PeopleFacetKey = PeopleFilterListKey | 'verification';
export type PeopleFacets = Record<PeopleFacetKey, FacetOption[]>;

const FACET_KEYS: PeopleFacetKey[] = [...PEOPLE_FILTER_LIST_KEYS, 'verification'];

function valuesFor(dimension: PeopleFacetKey, person: Person): string[] {
  switch (dimension) {
    case 'titles':
      return [person.title];
    case 'seniorities':
      return [person.seniority];
    case 'departments':
      return [person.department];
    case 'companies':
      return [person.company];
    case 'locations':
      return [person.location];
    case 'countries':
      return [person.country];
    case 'headcounts':
      return [person.companyHeadcount];
    case 'industries':
      return [person.industry];
    case 'keywords':
      return person.keywords;
    case 'buyingIntents':
      return [person.buyingIntent];
    case 'sources':
      return [person.source];
    case 'verification':
      return [person.verification];
  }
}

export function computePeopleFacets(
  people: readonly Person[],
  filters: PeopleFilters
): PeopleFacets {
  const checks = buildChecks(filters);
  const facets = {} as PeopleFacets;

  for (const dimension of FACET_KEYS) {
    const others = (Object.keys(checks) as Dimension[])
      .filter((key) => key !== dimension)
      .map((key) => checks[key])
      .filter(Boolean) as ((person: Person) => boolean)[];

    const counts = new Map<string, number>();
    for (const person of people) {
      if (!others.every((check) => check(person))) continue;
      for (const value of valuesFor(dimension, person)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }

    facets[dimension] = Array.from(counts, ([value, count]) => ({ value, count })).sort(
      (left, right) => right.count - left.count || left.value.localeCompare(right.value)
    );
  }

  return facets;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/people-filters.test.ts`
Expected: PASS — 17 tests.

- [ ] **Step 5: Confirm nothing else broke**

Run: `npx vitest run`
Expected: PASS — all suites, including `event-filters.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/people/filters.ts tests/integration/people-filters.test.ts
git commit -m "feat(people): add pure filtering, faceting and URL serialisation"
```

---

### Task 4: Filter chips

**Files:**
- Create: `lib/people/chips.ts`
- Test: `tests/integration/people-chips.test.ts`

**Interfaces:**
- Consumes: `PeopleFilters`, `PEOPLE_FILTER_LIST_KEYS` (Task 1); `VERIFICATION_LABELS`, `SOURCE_LABELS`, `INTENT_LABELS` (Task 1).
- Produces: `buildPeopleFilterChips(filters: PeopleFilters): PeopleFilterChip[]`, `removePeopleFilterChip(filters: PeopleFilters, chipId: string): PeopleFilters`, type `PeopleFilterChip = { id: string; label: string; value: string }` (structurally compatible with `QueryChip` in `components/search/filter-chips.tsx`, so it can be passed straight to `FilterChips`).

**Chip labels are fixed by the spec's acceptance criterion 3:** the worked example must produce exactly `Title contains: Marketing Manager`, `Verification: Verified`, `Country: Germany`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/people-chips.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildPeopleFilterChips, removePeopleFilterChip } from '@/lib/people/chips';
import { emptyPeopleFilters, type PeopleFilters } from '@/types/people';

function withFilters(overrides: Partial<PeopleFilters>): PeopleFilters {
  return { ...emptyPeopleFilters(), ...overrides };
}

describe('buildPeopleFilterChips', () => {
  it('produces the spec worked example verbatim', () => {
    const chips = buildPeopleFilterChips(
      withFilters({
        titles: ['Marketing Manager'],
        verification: 'verified',
        countries: ['Germany'],
      })
    );

    expect(chips.map((chip) => `${chip.label}: ${chip.value}`)).toEqual([
      'Title contains: Marketing Manager',
      'Verification: Verified',
      'Country: Germany',
    ]);
  });

  it('humanises enum values rather than leaking snake_case', () => {
    const chips = buildPeopleFilterChips(
      withFilters({
        verification: 'needs_verification',
        sources: ['licensed_dataset'],
        buyingIntents: ['high'],
        minConfidence: 70,
      })
    );

    expect(chips.map((chip) => `${chip.label}: ${chip.value}`)).toEqual([
      'Verification: Needs verification',
      'Confidence: ≥70%',
      'Intent: High',
      'Source: Licensed dataset',
    ]);
  });

  it('describes the search box and the lookalike seed', () => {
    const chips = buildPeopleFilterChips(
      withFilters({ search: 'sarah', lookalikeSeedId: 'pcx-person-00001' })
    );
    expect(chips.map((chip) => chip.label)).toEqual(['Search', 'Similar to']);
  });

  it('returns nothing for untouched filters', () => {
    expect(buildPeopleFilterChips(emptyPeopleFilters())).toEqual([]);
  });

  it('gives every chip a unique id', () => {
    const chips = buildPeopleFilterChips(
      withFilters({ countries: ['Germany', 'France'], departments: ['Marketing'] })
    );
    expect(new Set(chips.map((chip) => chip.id)).size).toBe(chips.length);
  });
});

describe('removePeopleFilterChip', () => {
  const filters = withFilters({
    countries: ['Germany', 'France'],
    titles: ['Marketing Manager'],
    verification: 'verified',
    minConfidence: 90,
    search: 'sarah',
    lookalikeSeedId: 'pcx-person-00001',
  });

  it('removes exactly one value from a list dimension', () => {
    const next = removePeopleFilterChip(filters, 'countries:Germany');
    expect(next.countries).toEqual(['France']);
    expect(next.titles).toEqual(['Marketing Manager']);
  });

  it('clears the single-value dimensions', () => {
    expect(removePeopleFilterChip(filters, 'verification').verification).toBeNull();
    expect(removePeopleFilterChip(filters, 'confidence').minConfidence).toBeNull();
    expect(removePeopleFilterChip(filters, 'search').search).toBe('');
    expect(removePeopleFilterChip(filters, 'lookalike').lookalikeSeedId).toBeNull();
  });

  it('leaves state untouched for an unknown chip id', () => {
    expect(removePeopleFilterChip(filters, 'bogus')).toEqual(filters);
    expect(removePeopleFilterChip(filters, 'nosuchkey:value')).toEqual(filters);
  });

  it('round-trips: every built chip can be removed by its own id', () => {
    for (const chip of buildPeopleFilterChips(filters)) {
      const next = removePeopleFilterChip(filters, chip.id);
      expect(next).not.toEqual(filters);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/people-chips.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/people/chips"`.

- [ ] **Step 3: Write `lib/people/chips.ts`**

```ts
import {
  PEOPLE_FILTER_LIST_KEYS,
  type PeopleFilterListKey,
  type PeopleFilters,
} from '@/types/people';
import { INTENT_LABELS, SOURCE_LABELS, VERIFICATION_LABELS } from '@/lib/people/vocabulary';

/**
 * Turns the applied filters into removable chips and back again. Shared by the
 * chat reply ("here's how I read your question"), the rail's active-filter row
 * and the empty state ("nothing matched — drop one of these"), so one click
 * removes exactly one constraint everywhere.
 *
 * Structurally compatible with `QueryChip` in components/search/filter-chips.
 */
export type PeopleFilterChip = { id: string; label: string; value: string };

const SEARCH_CHIP_ID = 'search';
const VERIFICATION_CHIP_ID = 'verification';
const CONFIDENCE_CHIP_ID = 'confidence';
const LOOKALIKE_CHIP_ID = 'lookalike';

const LIST_LABEL: Record<PeopleFilterListKey, string> = {
  titles: 'Title contains',
  seniorities: 'Seniority',
  departments: 'Department',
  companies: 'Company',
  locations: 'Location',
  countries: 'Country',
  headcounts: 'Headcount',
  industries: 'Industry',
  keywords: 'Keyword',
  buyingIntents: 'Intent',
  sources: 'Source',
};

/** Enum values are stored snake_case but must never be shown that way. */
function displayValue(key: PeopleFilterListKey, value: string): string {
  if (key === 'sources') return SOURCE_LABELS[value] ?? value;
  if (key === 'buyingIntents') return INTENT_LABELS[value] ?? value;
  return value;
}

export function buildPeopleFilterChips(filters: PeopleFilters): PeopleFilterChip[] {
  const chips: PeopleFilterChip[] = [];

  if (filters.search.trim()) {
    chips.push({ id: SEARCH_CHIP_ID, label: 'Search', value: filters.search.trim() });
  }

  // Titles lead, so the worked example reads Title → Verification → Country and
  // the most-specific constraint always comes first.
  for (const value of filters.titles) {
    chips.push({ id: `titles:${value}`, label: LIST_LABEL.titles, value });
  }

  if (filters.verification) {
    chips.push({
      id: VERIFICATION_CHIP_ID,
      label: 'Verification',
      value: VERIFICATION_LABELS[filters.verification],
    });
  }

  if (filters.minConfidence !== null) {
    chips.push({
      id: CONFIDENCE_CHIP_ID,
      label: 'Confidence',
      value: `≥${filters.minConfidence}%`,
    });
  }

  for (const key of PEOPLE_FILTER_LIST_KEYS) {
    if (key === 'titles') continue; // already emitted above
    for (const value of filters[key]) {
      chips.push({ id: `${key}:${value}`, label: LIST_LABEL[key], value: displayValue(key, value) });
    }
  }

  if (filters.lookalikeSeedId) {
    chips.push({ id: LOOKALIKE_CHIP_ID, label: 'Similar to', value: filters.lookalikeSeedId });
  }

  return chips;
}

export function removePeopleFilterChip(filters: PeopleFilters, chipId: string): PeopleFilters {
  if (chipId === SEARCH_CHIP_ID) return { ...filters, search: '' };
  if (chipId === VERIFICATION_CHIP_ID) return { ...filters, verification: null };
  if (chipId === CONFIDENCE_CHIP_ID) return { ...filters, minConfidence: null };
  if (chipId === LOOKALIKE_CHIP_ID) return { ...filters, lookalikeSeedId: null };

  const separator = chipId.indexOf(':');
  if (separator === -1) return filters;

  const key = chipId.slice(0, separator) as PeopleFilterListKey;
  const value = chipId.slice(separator + 1);
  if (!PEOPLE_FILTER_LIST_KEYS.includes(key)) return filters;

  return { ...filters, [key]: filters[key].filter((item) => item !== value) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/people-chips.test.ts`
Expected: PASS — 9 tests.

Note: the "humanises enum values" test asserts chip order `Verification → Confidence → Intent → Source`. Verification and Confidence are emitted before the remaining list keys, and `buyingIntents` precedes `sources` in `PEOPLE_FILTER_LIST_KEYS`, so this holds.

- [ ] **Step 5: Commit**

```bash
git add lib/people/chips.ts tests/integration/people-chips.test.ts
git commit -m "feat(people): add filter chip building and single-chip removal"
```

---

### Task 5: Natural-language query parser

**Files:**
- Create: `lib/people/parse-query.ts`
- Test: `tests/integration/people-parse-query.test.ts`

**Interfaces:**
- Consumes: `PeopleFilters`, `emptyPeopleFilters` (Task 1); `resolveVerification`, `resolveSeniority`, `resolveDepartment`, `resolveHeadcountBand`, `normalizePeopleText`, `singularize` (Task 1); `peopleVocabulary`, `PeopleVocabulary` (Task 2).
- Produces: `parsePeopleQuery(text: string, options?: { base?: PeopleFilters; vocabulary?: PeopleVocabulary }): PeopleFilters`.

**Design:** phrase matching against the *actual* dataset vocabulary (longest match first), not a hand-written keyword list. A term only becomes a filter if it exists in the data — that is what stops the parser inventing constraints that can never match. Unmatched words fall through to `search`, so a question is never silently ignored.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/people-parse-query.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parsePeopleQuery } from '@/lib/people/parse-query';
import { emptyPeopleFilters } from '@/types/people';

const vocabulary = {
  titles: ['Marketing Manager', 'Sales Director', 'Head of Product', 'Product Manager'],
  companies: ['NovaAI', 'CloudForge'],
  countries: ['Germany', 'United Kingdom', 'United States'],
  locations: ['Berlin, Germany', 'London, United Kingdom'],
  industries: ['Artificial Intelligence', 'SaaS'],
  keywords: ['automation', 'expansion'],
};

const parse = (text: string) => parsePeopleQuery(text, { vocabulary });

describe('parsePeopleQuery', () => {
  it('reads the spec worked example', () => {
    const filters = parse('verified marketing managers in Germany');
    expect(filters.verification).toBe('verified');
    expect(filters.titles).toEqual(['Marketing Manager']);
    expect(filters.countries).toEqual(['Germany']);
  });

  it('handles plurals and casing', () => {
    expect(parse('SALES DIRECTORS').titles).toEqual(['Sales Director']);
    expect(parse('product managers').titles).toEqual(['Product Manager']);
  });

  it('prefers the longest matching title phrase', () => {
    // "Head of Product" must win over the shorter "Product Manager" substring.
    expect(parse('head of product at NovaAI').titles).toEqual(['Head of Product']);
  });

  it('reads verification aliases', () => {
    expect(parse('unverified contacts').verification).toBe('needs_verification');
    expect(parse('bounced emails').verification).toBe('invalid');
  });

  it('reads a confidence floor, snapping to the nearest supported threshold', () => {
    expect(parse('contacts above 90% confidence').minConfidence).toBe(90);
    expect(parse('at least 70% confidence').minConfidence).toBe(70);
    expect(parse('>= 50% confidence').minConfidence).toBe(50);
    // 63 is not a supported chip value; snap down to the nearest floor.
    expect(parse('over 63% confidence').minConfidence).toBe(50);
    expect(parse('high confidence people').minConfidence).toBe(90);
  });

  it('reads seniority and department', () => {
    expect(parse('VPs in engineering').seniorities).toEqual(['VP']);
    expect(parse('VPs in engineering').departments).toEqual(['Engineering']);
  });

  it('reads company, industry, keyword and headcount', () => {
    expect(parse('people at CloudForge').companies).toEqual(['CloudForge']);
    expect(parse('SaaS contacts').industries).toEqual(['SaaS']);
    expect(parse('anyone tagged automation').keywords).toEqual(['automation']);
    expect(parse('enterprise buyers').headcounts).toEqual(['5000+']);
  });

  it('reads buying intent and data source', () => {
    expect(parse('high intent leads').buyingIntents).toEqual(['high']);
    expect(parse('licensed dataset records').sources).toEqual(['licensed_dataset']);
  });

  it('combines many dimensions from one sentence', () => {
    const filters = parse('verified marketing managers at NovaAI in Germany with high intent');
    expect(filters.verification).toBe('verified');
    expect(filters.titles).toEqual(['Marketing Manager']);
    expect(filters.companies).toEqual(['NovaAI']);
    expect(filters.countries).toEqual(['Germany']);
    expect(filters.buyingIntents).toEqual(['high']);
  });

  it('falls back to free-text search when nothing is recognised', () => {
    const filters = parse('zzz quantum widget people');
    expect(filters.search).toBe('zzz quantum widget people');
    expect(filters.titles).toEqual([]);
  });

  it('does not set search when the sentence was fully understood', () => {
    expect(parse('verified marketing managers in Germany').search).toBe('');
  });

  it('starts from the supplied base filters', () => {
    const base = { ...emptyPeopleFilters(), departments: ['Finance'] };
    const filters = parsePeopleQuery('in Germany', { base, vocabulary });
    expect(filters.departments).toEqual(['Finance']);
    expect(filters.countries).toEqual(['Germany']);
  });

  it('returns untouched filters for an empty question', () => {
    expect(parse('   ')).toEqual(emptyPeopleFilters());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/people-parse-query.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/people/parse-query"`.

- [ ] **Step 3: Write `lib/people/parse-query.ts`**

```ts
import {
  BUYING_INTENTS,
  CONFIDENCE_THRESHOLDS,
  DATA_SOURCES,
  emptyPeopleFilters,
  type ConfidenceThreshold,
  type PeopleFilters,
} from '@/types/people';
import {
  normalizePeopleText,
  resolveDepartment,
  resolveHeadcountBand,
  resolveSeniority,
  resolveVerification,
  singularize,
} from '@/lib/people/vocabulary';
import { peopleVocabulary, type PeopleVocabulary } from '@/lib/people/data';

/**
 * Natural language -> PeopleFilters, with no model call.
 *
 * Phrases are matched against the vocabulary of the actual dataset, longest
 * first, so a term only becomes a filter if rows exist that can satisfy it.
 * Whatever is left unconsumed becomes the free-text search, so a question is
 * never silently dropped — the user always sees *something* happen.
 */

/** Words that carry no filtering meaning and should not reach `search`. */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'at', 'of', 'for', 'with', 'and', 'or', 'to', 'from', 'on', 'by',
  'me', 'show', 'find', 'get', 'list', 'all', 'any', 'who', 'that', 'are', 'is', 'people',
  'contacts', 'contact', 'person', 'persons', 'leads', 'lead', 'buyers', 'anyone', 'everyone',
  'working', 'work', 'works', 'based', 'located', 'company', 'companies', 'records', 'record',
  'tagged', 'confidence', 'intent', 'dataset', 'emails', 'email', 'over', 'above', 'least',
  'more', 'than', 'their', 'has', 'have', 'his', 'her', 'they',
]);

function snapConfidence(percent: number): ConfidenceThreshold {
  // Snap DOWN to the nearest supported floor: asking for ">= 63%" must not
  // silently exclude the 63-69 band by rounding up to 70.
  const eligible = CONFIDENCE_THRESHOLDS.filter((threshold) => threshold <= percent);
  return (eligible[eligible.length - 1] ?? CONFIDENCE_THRESHOLDS[0]) as ConfidenceThreshold;
}

/** Longest-first phrase scan; returns the matches and the remaining text. */
function consumePhrases(
  haystack: string,
  candidates: readonly string[]
): { matched: string[]; rest: string } {
  const matched: string[] = [];
  let rest = haystack;

  // `candidates` from peopleVocabulary() are already sorted longest-first; sort
  // defensively so a caller-supplied vocabulary behaves the same way.
  const ordered = [...candidates].sort((left, right) => right.length - left.length);

  for (const candidate of ordered) {
    const needle = normalizePeopleText(candidate);
    if (!needle) continue;
    // Singularised haystack so "marketing managers" matches "Marketing Manager".
    const singularHaystack = rest.replace(/\b(\w+)s\b/g, (whole, word: string) => {
      const singular = singularize(word);
      return singular === word ? whole : singular;
    });
    const index = singularHaystack.indexOf(needle);
    if (index === -1) continue;

    matched.push(candidate);
    // Remove from BOTH forms so a later, shorter candidate cannot re-match the
    // same words ("Product Manager" inside "Head of Product ... Manager").
    rest = singularHaystack.slice(0, index) + ' ' + singularHaystack.slice(index + needle.length);
  }

  return { matched, rest };
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function parsePeopleQuery(
  text: string,
  options: { base?: PeopleFilters; vocabulary?: PeopleVocabulary } = {}
): PeopleFilters {
  const filters: PeopleFilters = { ...(options.base ?? emptyPeopleFilters()) };
  const raw = text.trim();
  if (!raw) return filters;

  const vocabulary = options.vocabulary ?? peopleVocabulary();
  let rest = normalizePeopleText(raw);

  // 1. Confidence — done first, so the digits never reach the phrase scan.
  const explicitConfidence = rest.match(/(?:>=|≥|over|above|at least|more than)\s*(\d{1,3})\s*%?/);
  if (explicitConfidence) {
    filters.minConfidence = snapConfidence(Number(explicitConfidence[1]));
    rest = rest.replace(explicitConfidence[0], ' ');
  } else if (/\bhigh confidence\b/.test(rest)) {
    filters.minConfidence = 90;
    rest = rest.replace(/\bhigh confidence\b/, ' ');
  }

  // 2. Verification — check the two-word alias before the one-word ones.
  for (const phrase of ['needs verification', 'verified', 'unverified', 'unconfirmed', 'invalid', 'bounced', 'valid', 'confirmed', 'pending']) {
    if (!new RegExp(`\\b${phrase}\\b`).test(rest)) continue;
    const status = resolveVerification(phrase);
    if (status) {
      filters.verification = status;
      rest = rest.replace(new RegExp(`\\b${phrase}\\b`), ' ');
      break;
    }
  }

  // 3. Buying intent — "high intent", "low-intent".
  const intent = rest.match(/\b(high|medium|low|no)[\s-]*intent\b/);
  if (intent) {
    const value = intent[1] === 'no' ? 'none' : intent[1];
    if ((BUYING_INTENTS as readonly string[]).includes(value)) {
      filters.buyingIntents = uniq([...filters.buyingIntents, value]);
    }
    rest = rest.replace(intent[0], ' ');
  }

  // 4. Data source.
  for (const [phrase, source] of [
    ['licensed dataset', 'licensed_dataset'],
    ['licensed', 'licensed_dataset'],
    ['user import', 'user_import'],
    ['imported', 'user_import'],
    ['enrichment', 'enrichment'],
    ['enriched', 'enrichment'],
  ] as const) {
    if (!new RegExp(`\\b${phrase}\\b`).test(rest)) continue;
    if ((DATA_SOURCES as readonly string[]).includes(source)) {
      filters.sources = uniq([...filters.sources, source]);
    }
    rest = rest.replace(new RegExp(`\\b${phrase}\\b`), ' ');
    break;
  }

  // 5. Headcount phrases ("enterprise", "startup", "51-200").
  for (const phrase of ['enterprise', 'startup', 'small business', 'midmarket', 'mid market', 'mid-market', 'smb', 'large company']) {
    if (!new RegExp(`\\b${phrase}\\b`).test(rest)) continue;
    const band = resolveHeadcountBand(phrase);
    if (band) {
      filters.headcounts = uniq([...filters.headcounts, band]);
      rest = rest.replace(new RegExp(`\\b${phrase}\\b`), ' ');
    }
    break;
  }
  const explicitBand = rest.match(/\b(\d{1,4}-\d{1,4}|5000\+)\b/);
  if (explicitBand) {
    const band = resolveHeadcountBand(explicitBand[1]);
    if (band) {
      filters.headcounts = uniq([...filters.headcounts, band]);
      rest = rest.replace(explicitBand[0], ' ');
    }
  }

  // 6. Open vocabularies, longest phrase first. Order matters: titles before
  // departments, so "marketing manager" is not eaten by "marketing".
  const titles = consumePhrases(rest, vocabulary.titles);
  filters.titles = uniq([...filters.titles, ...titles.matched]);
  rest = titles.rest;

  const locations = consumePhrases(rest, vocabulary.locations);
  filters.locations = uniq([...filters.locations, ...locations.matched]);
  rest = locations.rest;

  const countries = consumePhrases(rest, vocabulary.countries);
  filters.countries = uniq([...filters.countries, ...countries.matched]);
  rest = countries.rest;

  const companies = consumePhrases(rest, vocabulary.companies);
  filters.companies = uniq([...filters.companies, ...companies.matched]);
  rest = companies.rest;

  const industries = consumePhrases(rest, vocabulary.industries);
  filters.industries = uniq([...filters.industries, ...industries.matched]);
  rest = industries.rest;

  const keywords = consumePhrases(rest, vocabulary.keywords);
  filters.keywords = uniq([...filters.keywords, ...keywords.matched]);
  rest = keywords.rest;

  // 7. Seniority and department from whatever words survive.
  const remainingWords = rest.split(/[^a-z0-9+]+/).filter(Boolean);
  const unconsumed: string[] = [];
  for (const word of remainingWords) {
    const seniority = resolveSeniority(word);
    if (seniority) {
      filters.seniorities = uniq([...filters.seniorities, seniority]);
      continue;
    }
    const department = resolveDepartment(word);
    if (department) {
      filters.departments = uniq([...filters.departments, department]);
      continue;
    }
    if (!STOP_WORDS.has(word) && !STOP_WORDS.has(singularize(word))) unconsumed.push(word);
  }

  // 8. Anything genuinely unrecognised becomes the search box, so the question
  // always does something visible.
  if (unconsumed.length > 0) filters.search = raw;

  return filters;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/people-parse-query.test.ts`
Expected: PASS — 13 tests.

If "prefers the longest matching title phrase" fails, check that `consumePhrases` is blanking the matched span out of `rest` — a shorter candidate must not be able to re-match consumed words.

- [ ] **Step 5: Commit**

```bash
git add lib/people/parse-query.ts tests/integration/people-parse-query.test.ts
git commit -m "feat(people): parse natural-language questions into PeopleFilters"
```

---

### Task 6: Templated answer prose

**Files:**
- Create: `lib/people/answer.ts`
- Test: `tests/integration/people-answer.test.ts`

**Interfaces:**
- Consumes: `PeopleFilters`, `Person` (Task 1); `buildPeopleFilterChips` (Task 4).
- Produces: `buildPeopleAnswer(input: { question: string; filters: PeopleFilters; matches: readonly Person[]; total: number }): string`.

**Why templated prose is the baseline, not the fallback:** the chat must answer with no API key set (acceptance criterion 3). The LLM only ever *upgrades* this text; the wire format is identical either way, so the client never branches.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/people-answer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildPeopleAnswer } from '@/lib/people/answer';
import { emptyPeopleFilters, type PeopleFilters, type Person } from '@/types/people';

function makePerson(overrides: Partial<Person> & { id: string }): Person {
  return {
    id: overrides.id,
    firstName: 'Sarah',
    lastName: 'Miller',
    title: 'Marketing Manager',
    seniority: 'Manager',
    department: 'Marketing',
    company: 'NovaAI',
    companyDomain: 'novaai.de',
    companyHeadcount: '51-200',
    industry: 'Artificial Intelligence',
    country: 'Germany',
    location: 'Berlin, Germany',
    workEmail: 'sarah.miller@novaai.de',
    phone: null,
    linkedinUrl: null,
    verification: 'verified',
    confidence: 91,
    platformScore: 98,
    source: 'user_import',
    keywords: ['automation'],
    buyingIntent: 'high',
    fetchedAt: '2026-02-01',
    lastActiveAt: '2026-08-01',
    ...overrides,
  };
}

function withFilters(overrides: Partial<PeopleFilters>): PeopleFilters {
  return { ...emptyPeopleFilters(), ...overrides };
}

const matches = [
  makePerson({ id: 'p1' }),
  makePerson({ id: 'p2', company: 'CloudForge', confidence: 85 }),
  makePerson({ id: 'p3', company: 'CloudForge', verification: 'needs_verification', confidence: 60 }),
];

describe('buildPeopleAnswer', () => {
  it('leads with the real total, not the page size', () => {
    const answer = buildPeopleAnswer({
      question: 'verified marketing managers in Germany',
      filters: withFilters({ verification: 'verified', countries: ['Germany'] }),
      matches,
      total: 214,
    });
    expect(answer).toContain('214');
  });

  it('names how the question was read', () => {
    const answer = buildPeopleAnswer({
      question: 'verified marketing managers in Germany',
      filters: withFilters({
        titles: ['Marketing Manager'],
        verification: 'verified',
        countries: ['Germany'],
      }),
      matches,
      total: 214,
    });
    expect(answer).toContain('Germany');
    expect(answer).toContain('Marketing Manager');
  });

  it('reports verified share and average confidence over the matches', () => {
    const answer = buildPeopleAnswer({
      question: 'anything',
      filters: emptyPeopleFilters(),
      matches,
      total: 3,
    });
    expect(answer).toContain('2 have a verified work email');
    expect(answer).toMatch(/average confidence (?:is )?79%/);
  });

  it('mentions the most common companies', () => {
    const answer = buildPeopleAnswer({
      question: 'anything',
      filters: emptyPeopleFilters(),
      matches,
      total: 3,
    });
    expect(answer).toContain('CloudForge');
  });

  it('gives the specced empty-state sentence when nothing matches', () => {
    const answer = buildPeopleAnswer({
      question: 'verified marketing managers in Atlantis',
      filters: withFilters({ verification: 'verified', minConfidence: 90 }),
      matches: [],
      total: 0,
    });
    expect(answer).toContain('No contacts match');
    expect(answer).toContain('verification');
    expect(answer).toContain('confidence');
  });

  it('never emits snake_case enum values', () => {
    const answer = buildPeopleAnswer({
      question: 'unverified licensed records',
      filters: withFilters({ verification: 'needs_verification', sources: ['licensed_dataset'] }),
      matches,
      total: 12,
    });
    expect(answer).not.toContain('needs_verification');
    expect(answer).not.toContain('licensed_dataset');
  });

  it('is a single trimmed paragraph-set with no trailing whitespace', () => {
    const answer = buildPeopleAnswer({
      question: 'anything',
      filters: emptyPeopleFilters(),
      matches,
      total: 3,
    });
    expect(answer).toBe(answer.trim());
    expect(answer.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/people-answer.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/people/answer"`.

- [ ] **Step 3: Write `lib/people/answer.ts`**

```ts
import { hasAnyPeopleFilter, type PeopleFilters, type Person } from '@/types/people';
import { buildPeopleFilterChips } from '@/lib/people/chips';

/**
 * Templated prose over real counts.
 *
 * This is the baseline answer, not a fallback: the panel must answer with no
 * ANTHROPIC_API_KEY configured. When a working key is present the LLM replaces
 * this text, but the wire format is identical, so the client never branches.
 */

function topValues(values: string[], limit: number): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts, ([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
    .slice(0, limit);
}

function listPhrase(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function buildPeopleAnswer(input: {
  question: string;
  filters: PeopleFilters;
  matches: readonly Person[];
  total: number;
}): string {
  const { filters, matches, total } = input;

  if (total === 0) {
    return (
      'No contacts match — try relaxing verification or confidence. ' +
      'Those two constraints are usually what empties a result set; ' +
      'dropping either normally brings rows back.'
    );
  }

  const sentences: string[] = [];

  // How the question was read, in the same words the chips use.
  const chips = buildPeopleFilterChips(filters);
  const readAs = chips
    .filter((chip) => chip.label !== 'Search' && chip.label !== 'Similar to')
    .map((chip) => `${chip.label.toLowerCase()} ${chip.value}`);

  sentences.push(
    hasAnyPeopleFilter(filters) && readAs.length > 0
      ? `Found ${total.toLocaleString()} ${total === 1 ? 'contact' : 'contacts'} with ${listPhrase(readAs)}.`
      : `Found ${total.toLocaleString()} ${total === 1 ? 'contact' : 'contacts'}.`
  );

  const verified = matches.filter((person) => person.verification === 'verified').length;
  const averageConfidence = Math.round(
    matches.reduce((sum, person) => sum + person.confidence, 0) / matches.length
  );
  sentences.push(
    `Of the ${matches.length} shown, ${verified} ${verified === 1 ? 'has' : 'have'} a verified work email, ` +
      `and average confidence is ${averageConfidence}%.`
  );

  const companies = topValues(
    matches.map((person) => person.company),
    3
  );
  if (companies.length > 0) {
    sentences.push(
      `Most come from ${listPhrase(companies.map((entry) => `${entry.value} (${entry.count})`))}.`
    );
  }

  const countries = topValues(
    matches.map((person) => person.country),
    2
  );
  if (countries.length > 1) {
    sentences.push(`Locations skew towards ${listPhrase(countries.map((entry) => entry.value))}.`);
  }

  return sentences.join(' ').trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/people-answer.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/people/answer.ts tests/integration/people-answer.test.ts
git commit -m "feat(people): add templated answer prose over real match counts"
```

---

### Task 7: Lookalike scoring

**Files:**
- Create: `lib/people/lookalikes.ts`
- Test: `tests/integration/people-lookalikes.test.ts`

**Interfaces:**
- Consumes: `Person` (Task 1).
- Produces: `lookalikeScore(seed: Person, candidate: Person): number` (0–1), `rankLookalikes(people: readonly Person[], seedId: string, limit?: number): Person[]`, and `LOOKALIKE_WEIGHTS`.

**Definition (spec):** weighted overlap of seniority, department, industry, headcount band and country. No model call. Deterministic.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/people-lookalikes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LOOKALIKE_WEIGHTS, lookalikeScore, rankLookalikes } from '@/lib/people/lookalikes';
import type { Person } from '@/types/people';

function makePerson(overrides: Partial<Person> & { id: string }): Person {
  return {
    id: overrides.id,
    firstName: 'Sarah',
    lastName: 'Miller',
    title: 'Marketing Manager',
    seniority: 'Manager',
    department: 'Marketing',
    company: 'NovaAI',
    companyDomain: 'novaai.de',
    companyHeadcount: '51-200',
    industry: 'Artificial Intelligence',
    country: 'Germany',
    location: 'Berlin, Germany',
    workEmail: 'sarah.miller@novaai.de',
    phone: null,
    linkedinUrl: null,
    verification: 'verified',
    confidence: 91,
    platformScore: 98,
    source: 'user_import',
    keywords: ['automation'],
    buyingIntent: 'high',
    fetchedAt: '2026-02-01',
    lastActiveAt: '2026-08-01',
    ...overrides,
  };
}

const seed = makePerson({ id: 'seed' });

describe('lookalikeScore', () => {
  it('scores an identical profile as 1', () => {
    expect(lookalikeScore(seed, makePerson({ id: 'twin' }))).toBe(1);
  });

  it('scores a profile sharing nothing as 0', () => {
    const opposite = makePerson({
      id: 'opposite',
      seniority: 'Entry',
      department: 'Legal',
      industry: 'Mining',
      companyHeadcount: '5000+',
      country: 'Japan',
    });
    expect(lookalikeScore(seed, opposite)).toBe(0);
  });

  it('weights each dimension as declared', () => {
    const sameDepartmentOnly = makePerson({
      id: 'dept',
      seniority: 'Entry',
      industry: 'Mining',
      companyHeadcount: '5000+',
      country: 'Japan',
    });
    expect(lookalikeScore(seed, sameDepartmentOnly)).toBeCloseTo(LOOKALIKE_WEIGHTS.department, 10);
  });

  it('weights sum to exactly 1 so scores stay in range', () => {
    const total = Object.values(LOOKALIKE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe('rankLookalikes', () => {
  const people = [
    seed,
    makePerson({ id: 'twin' }),
    makePerson({ id: 'near', country: 'France' }),
    makePerson({ id: 'far', seniority: 'Entry', department: 'Legal', industry: 'Mining', companyHeadcount: '5000+', country: 'Japan' }),
  ];

  it('excludes the seed from its own results', () => {
    expect(rankLookalikes(people, 'seed').map((person) => person.id)).not.toContain('seed');
  });

  it('ranks by descending similarity', () => {
    expect(rankLookalikes(people, 'seed').map((person) => person.id)).toEqual([
      'twin',
      'near',
      'far',
    ]);
  });

  it('is deterministic across repeated calls', () => {
    const first = rankLookalikes(people, 'seed').map((person) => person.id);
    const second = rankLookalikes(people, 'seed').map((person) => person.id);
    expect(first).toEqual(second);
  });

  it('honours the limit', () => {
    expect(rankLookalikes(people, 'seed', 2)).toHaveLength(2);
  });

  it('returns an empty list for an unknown seed id', () => {
    expect(rankLookalikes(people, 'nobody')).toEqual([]);
  });

  it('breaks ties by id so ordering is stable', () => {
    const tied = [seed, makePerson({ id: 'b' }), makePerson({ id: 'a' })];
    expect(rankLookalikes(tied, 'seed').map((person) => person.id)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/people-lookalikes.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/people/lookalikes"`.

- [ ] **Step 3: Write `lib/people/lookalikes.ts`**

```ts
import type { Person } from '@/types/people';

/**
 * "AI Lookalikes" without a model call: weighted overlap on the five
 * dimensions that actually predict a comparable buyer. Deterministic, so the
 * same seed always produces the same ranking and the tests can assert order.
 *
 * The weights are deliberately a single exported object — they are the whole
 * definition of the feature, and unit-tested as such.
 */
export const LOOKALIKE_WEIGHTS = {
  seniority: 0.25,
  department: 0.3,
  industry: 0.2,
  headcount: 0.15,
  country: 0.1,
} as const;

export function lookalikeScore(seed: Person, candidate: Person): number {
  let score = 0;
  if (seed.seniority === candidate.seniority) score += LOOKALIKE_WEIGHTS.seniority;
  if (seed.department === candidate.department) score += LOOKALIKE_WEIGHTS.department;
  if (seed.industry === candidate.industry) score += LOOKALIKE_WEIGHTS.industry;
  if (seed.companyHeadcount === candidate.companyHeadcount) score += LOOKALIKE_WEIGHTS.headcount;
  if (seed.country === candidate.country) score += LOOKALIKE_WEIGHTS.country;
  return score;
}

export function rankLookalikes(
  people: readonly Person[],
  seedId: string,
  limit = 50
): Person[] {
  const seed = people.find((person) => person.id === seedId);
  if (!seed) return [];

  return people
    .filter((person) => person.id !== seedId)
    .map((person) => ({ person, score: lookalikeScore(seed, person) }))
    .sort(
      (left, right) =>
        right.score - left.score || left.person.id.localeCompare(right.person.id)
    )
    .slice(0, limit)
    .map((entry) => entry.person);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/people-lookalikes.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/people/lookalikes.ts tests/integration/people-lookalikes.test.ts
git commit -m "feat(people): add deterministic lookalike scoring"
```

---

### Task 8: `GET /api/people`

**Files:**
- Create: `app/api/people/route.ts`
- Test: `tests/integration/people-route.test.ts`

**Interfaces:**
- Consumes: `loadPeople`, `computePeopleStats` (Task 2); `applyPeopleFilters`, `computePeopleFacets`, `paramsToFilters` (Task 3); `rankLookalikes` (Task 7); `jsonOk`, `jsonError` from `lib/http/`; `BadRequestError` from `lib/http/errors.ts`.
- Produces: `GET(request: Request): Promise<Response>` returning
  `{ results: Person[]; total: number; totalPages: number; page: number; pageSize: number; facets: PeopleFacets; stats: PeopleStats }`.

**Notes:**
- `stats` is computed over the **whole** dataset (it drives the header badge and the data-source strip), while `total` is the filtered count.
- Not tenant-scoped, matching `/api/companies` — this is a shared discovery dataset. Do **not** call `resolveTenant()`.
- `pageSize` is clamped to 1–100 so a hand-edited URL cannot ask for the whole seed.
- When `lookalike` is set, the lookalike ranking replaces the default ordering and is applied *after* the other filters.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/people-route.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/people/route';

function get(query: string) {
  return new Request(`http://localhost/api/people${query}`) as never;
}

describe('GET /api/people', () => {
  it('returns a first page with dataset-wide stats', async () => {
    const response = await GET(get(''));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(25);
    expect(json.results).toHaveLength(25);
    expect(json.total).toBe(2418);
    expect(json.totalPages).toBe(Math.ceil(2418 / 25));
    expect(json.stats.total).toBe(2418);
    expect(json.stats.avgConfidence).toBe(84);
  });

  it('filters by country and verification together', async () => {
    const response = await GET(get('?country=Germany&verification=verified'));
    const json = await response.json();

    expect(json.total).toBeGreaterThan(0);
    expect(json.total).toBeLessThan(2418);
    for (const person of json.results) {
      expect(person.country).toBe('Germany');
      expect(person.verification).toBe('verified');
    }
  });

  it('answers the spec worked example with rows', async () => {
    const response = await GET(get('?title=Marketing%20Manager&verification=verified&country=Germany'));
    const json = await response.json();
    expect(json.total).toBeGreaterThan(0);
  });

  it('keeps stats dataset-wide while total is the filtered count', async () => {
    const json = await (await GET(get('?country=Germany'))).json();
    expect(json.stats.total).toBe(2418);
    expect(json.total).toBeLessThan(2418);
  });

  it('returns facet counts for every filter group', async () => {
    const json = await (await GET(get(''))).json();
    for (const key of [
      'titles', 'seniorities', 'departments', 'companies', 'locations', 'countries',
      'headcounts', 'industries', 'keywords', 'buyingIntents', 'sources', 'verification',
    ]) {
      expect(Array.isArray(json.facets[key]), `${key} facet missing`).toBe(true);
      expect(json.facets[key].length, `${key} facet empty`).toBeGreaterThan(0);
    }
  });

  it('pages without overlapping the previous page', async () => {
    const first = await (await GET(get('?pageSize=10&page=1'))).json();
    const second = await (await GET(get('?pageSize=10&page=2'))).json();

    const firstIds = new Set(first.results.map((person: { id: string }) => person.id));
    for (const person of second.results) {
      expect(firstIds.has(person.id)).toBe(false);
    }
  });

  it('returns an empty page past the end without erroring', async () => {
    const response = await GET(get('?pageSize=10&page=99999'));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.results).toEqual([]);
    expect(json.total).toBe(2418);
  });

  it('returns an empty result set rather than an error when nothing matches', async () => {
    const json = await (await GET(get('?country=Atlantis'))).json();
    expect(json.total).toBe(0);
    expect(json.results).toEqual([]);
    expect(json.totalPages).toBe(0);
  });

  it('clamps pageSize to at most 100', async () => {
    const json = await (await GET(get('?pageSize=5000'))).json();
    expect(json.pageSize).toBe(100);
    expect(json.results).toHaveLength(100);
  });

  it('rejects a page below 1', async () => {
    const response = await GET(get('?page=0'));
    expect(response.status).toBe(400);
  });

  it('ranks by similarity when a lookalike seed is supplied', async () => {
    const seedId = (await (await GET(get('?pageSize=1'))).json()).results[0].id;
    const json = await (await GET(get(`?lookalike=${seedId}&pageSize=5`))).json();

    expect(json.results.map((person: { id: string }) => person.id)).not.toContain(seedId);
    expect(json.results.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/people-route.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/api/people/route"`.

- [ ] **Step 3: Write `app/api/people/route.ts`**

```ts
import { computePeopleStats, loadPeople } from '@/lib/people/data';
import {
  applyPeopleFilters,
  computePeopleFacets,
  paramsToFilters,
} from '@/lib/people/filters';
import { rankLookalikes } from '@/lib/people/lookalikes';
import { BadRequestError } from '@/lib/http/errors';
import { jsonError, jsonOk } from '@/lib/http/response';

/**
 * The People discovery dataset.
 *
 * Deliberately NOT tenant-scoped, exactly like /api/companies: this is a shared
 * discovery dataset, not workspace data. `stats` is dataset-wide (it drives the
 * header badge and the data-source strip) while `total` is the filtered count,
 * so no number on the page is hardcoded.
 */

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;

    const page = Number(params.get('page') ?? '1');
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestError('page must be an integer of 1 or more');
    }

    const requestedSize = Number(params.get('pageSize') ?? String(DEFAULT_PAGE_SIZE));
    const pageSize = Number.isFinite(requestedSize)
      ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(requestedSize)))
      : DEFAULT_PAGE_SIZE;

    const filters = paramsToFilters(params);
    const everyone = loadPeople();

    const matched = applyPeopleFilters(everyone, filters);
    // Lookalike ranking replaces the default ordering, applied after the other
    // constraints so "similar to X, in Germany" narrows before it ranks.
    const ordered = filters.lookalikeSeedId
      ? rankLookalikes(matched, filters.lookalikeSeedId, matched.length)
      : matched;

    const start = (page - 1) * pageSize;

    return jsonOk({
      results: ordered.slice(start, start + pageSize),
      total: ordered.length,
      totalPages: Math.ceil(ordered.length / pageSize),
      page,
      pageSize,
      facets: computePeopleFacets(everyone, filters),
      stats: computePeopleStats(everyone),
    });
  } catch (error) {
    return jsonError(error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/people-route.test.ts`
Expected: PASS — 11 tests.

If "ranks by similarity" fails because the seed still appears, check that `rankLookalikes` is filtering `person.id !== seedId` (Task 7).

- [ ] **Step 5: Commit**

```bash
git add app/api/people/route.ts tests/integration/people-route.test.ts
git commit -m "feat(people): add GET /api/people with facets, stats and paging"
```

---

### Task 9: `POST /api/people/chat` — the NDJSON stream

**Files:**
- Create: `lib/people/chat-stream.ts`
- Create: `app/api/people/chat/route.ts`
- Test: `tests/integration/people-chat-route.test.ts`

**Interfaces:**
- Consumes: `loadPeople` (Task 2); `applyPeopleFilters` (Task 3); `buildPeopleFilterChips` (Task 4); `parsePeopleQuery` (Task 5); `buildPeopleAnswer` (Task 6); `emptyPeopleFilters`, `PeopleFilters`, `Person` (Task 1); `BadRequestError`, `jsonError` from `lib/http/`.
- Produces:
  - `type PeopleChatEvent` — the discriminated union below.
  - `createPeopleChatStream(input: { message: string; activeFilters?: PeopleFilters; page?: number; generateAnswer?: AnswerGenerator }): ReadableStream<Uint8Array>`
  - `type AnswerGenerator = (input: { question: string; filters: PeopleFilters; matches: readonly Person[]; total: number }) => AsyncIterable<string>`
  - `consumeRateLimit(key: string, now?: number): { allowed: boolean; retryAfterSeconds: number }`
  - `resetPeopleRateLimiter(): void` — test seam.
  - `POST(request: Request): Promise<Response>`

**The contract that matters:** `filters` and `results` are emitted **before** any prose, so the inline table fills while the answer is still being written. Every consumer depends on that ordering, and it is the first thing the test asserts.

```
{"type":"filters","filters":{…},"chips":[…]}
{"type":"results","results":[…up to 10],"total":214}
{"type":"token","text":"Found 214 verified…"}
{"type":"done"}
{"type":"error","code":"rate_limited","message":"…"}
```

- [ ] **Step 1: Write the failing test**

Create `tests/integration/people-chat-route.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/people/chat/route';
import {
  createPeopleChatStream,
  resetPeopleRateLimiter,
  type PeopleChatEvent,
} from '@/lib/people/chat-stream';

function post(body: unknown, ip = '10.0.0.1') {
  return new Request('http://localhost/api/people/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  }) as never;
}

async function readEvents(stream: ReadableStream<Uint8Array> | null): Promise<PeopleChatEvent[]> {
  if (!stream) return [];
  const text = await new Response(stream).text();
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as PeopleChatEvent);
}

beforeEach(() => {
  resetPeopleRateLimiter();
});

describe('POST /api/people/chat', () => {
  it('emits filters, then results, then tokens, then done — in that order', async () => {
    const response = await POST(post({ message: 'verified marketing managers in Germany' }));
    expect(response.status).toBe(200);

    const events = await readEvents(response.body);
    const types = events.map((event) => event.type);

    expect(types[0]).toBe('filters');
    expect(types[1]).toBe('results');
    expect(types).toContain('token');
    expect(types[types.length - 1]).toBe('done');
    // No prose may precede the results.
    expect(types.indexOf('token')).toBeGreaterThan(types.indexOf('results'));
  });

  it('parses the question into filters and chips', async () => {
    const events = await readEvents(
      (await POST(post({ message: 'verified marketing managers in Germany' }))).body
    );
    const first = events[0];

    expect(first.type).toBe('filters');
    if (first.type !== 'filters') throw new Error('expected filters event');
    expect(first.filters.verification).toBe('verified');
    expect(first.filters.countries).toEqual(['Germany']);
    expect(first.chips.map((chip) => `${chip.label}: ${chip.value}`)).toContain(
      'Verification: Verified'
    );
  });

  it('caps the inline results at 10 while reporting the true total', async () => {
    const events = await readEvents((await POST(post({ message: 'verified contacts' }))).body);
    const results = events.find((event) => event.type === 'results');

    expect(results?.type).toBe('results');
    if (results?.type !== 'results') throw new Error('expected results event');
    expect(results.results.length).toBeLessThanOrEqual(10);
    expect(results.total).toBeGreaterThan(10);
  });

  it('answers with no ANTHROPIC_API_KEY set', async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const events = await readEvents(
        (await POST(post({ message: 'verified marketing managers in Germany' }))).body
      );
      const prose = events
        .filter((event) => event.type === 'token')
        .map((event) => (event.type === 'token' ? event.text : ''))
        .join('');

      expect(prose.length).toBeGreaterThan(0);
      expect(prose).toContain('Found');
      expect(events[events.length - 1].type).toBe('done');
    } finally {
      if (original === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = original;
    }
  });

  it('narrows using the filters already applied in the rail', async () => {
    const wide = await readEvents((await POST(post({ message: 'managers' }))).body);
    const narrow = await readEvents(
      (
        await POST(
          post({
            message: 'managers',
            activeFilters: { countries: ['Germany'] },
          })
        )
      ).body
    );

    const totalOf = (events: PeopleChatEvent[]) => {
      const results = events.find((event) => event.type === 'results');
      return results?.type === 'results' ? results.total : -1;
    };

    expect(totalOf(narrow)).toBeGreaterThan(0);
    expect(totalOf(narrow)).toBeLessThan(totalOf(wide));
  });

  it('streams the empty-result message rather than erroring', async () => {
    const events = await readEvents(
      (await POST(post({ message: 'contacts in Atlantis with >= 90% confidence' }))).body
    );
    const results = events.find((event) => event.type === 'results');
    const prose = events
      .filter((event) => event.type === 'token')
      .map((event) => (event.type === 'token' ? event.text : ''))
      .join('');

    if (results?.type !== 'results') throw new Error('expected results event');
    expect(results.results).toEqual([]);
    expect(prose).toContain('No contacts match');
    expect(events[events.length - 1].type).toBe('done');
  });

  it('rejects an empty message with 400', async () => {
    expect((await POST(post({ message: '   ' }))).status).toBe(400);
    expect((await POST(post({}))).status).toBe(400);
  });

  it('rate limits a burst from one IP', async () => {
    let limited = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await POST(post({ message: 'verified contacts' }, '10.0.0.99'));
      const events = await readEvents(response.body);
      const error = events.find((event) => event.type === 'error');
      if (error?.type === 'error' && error.code === 'rate_limited') {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });

  it('does not rate limit a different IP', async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await readEvents((await POST(post({ message: 'verified contacts' }, '10.0.0.50'))).body);
    }
    const events = await readEvents(
      (await POST(post({ message: 'verified contacts' }, '10.0.0.51'))).body
    );
    expect(events.some((event) => event.type === 'error')).toBe(false);
  });
});

describe('createPeopleChatStream', () => {
  it('falls back to templated prose when the generator fails mid-flight', async () => {
    async function* halfBrokenGenerator() {
      yield 'Partial answer';
      throw new Error('upstream 401');
    }

    const events = await readEvents(
      createPeopleChatStream({
        message: 'verified marketing managers in Germany',
        generateAnswer: () => halfBrokenGenerator(),
      })
    );

    const prose = events
      .filter((event) => event.type === 'token')
      .map((event) => (event.type === 'token' ? event.text : ''))
      .join('');

    // The partial text survives, the templated answer completes it, and the
    // user sees an answer rather than an error.
    expect(prose).toContain('Partial answer');
    expect(prose).toContain('Found');
    expect(events.some((event) => event.type === 'error')).toBe(false);
    expect(events[events.length - 1].type).toBe('done');
  });

  it('falls back when the generator fails before emitting anything', async () => {
    async function* deadGenerator(): AsyncIterable<string> {
      throw new Error('upstream 401');
      // eslint-disable-next-line no-unreachable
      yield '';
    }

    const events = await readEvents(
      createPeopleChatStream({
        message: 'verified contacts',
        generateAnswer: () => deadGenerator(),
      })
    );

    const prose = events
      .filter((event) => event.type === 'token')
      .map((event) => (event.type === 'token' ? event.text : ''))
      .join('');

    expect(prose).toContain('Found');
    expect(events[events.length - 1].type).toBe('done');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/people-chat-route.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/api/people/chat/route"`.

- [ ] **Step 3: Write `lib/people/chat-stream.ts`**

```ts
import {
  emptyPeopleFilters,
  type PeopleFilters,
  type Person,
} from '@/types/people';
import { loadPeople } from '@/lib/people/data';
import { applyPeopleFilters } from '@/lib/people/filters';
import { parsePeopleQuery } from '@/lib/people/parse-query';
import { buildPeopleFilterChips, type PeopleFilterChip } from '@/lib/people/chips';
import { buildPeopleAnswer } from '@/lib/people/answer';

/**
 * The chat wire format.
 *
 * `filters` and `results` are emitted BEFORE any prose so the inline table
 * fills while the answer is still being written. Every client depends on that
 * ordering.
 *
 * The format is identical whether the prose came from a template or from
 * Claude, which is what lets the panel work with no API key and lets the client
 * avoid branching entirely.
 */
export type PeopleChatEvent =
  | { type: 'filters'; filters: PeopleFilters; chips: PeopleFilterChip[] }
  | { type: 'results'; results: Person[]; total: number }
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; code: string; message: string };

export type AnswerGenerator = (input: {
  question: string;
  filters: PeopleFilters;
  matches: readonly Person[];
  total: number;
}) => AsyncIterable<string>;

/** Inline replies are capped; "View all N results" opens the full table. */
const INLINE_RESULT_LIMIT = 10;
/** How much of the answer the model is allowed to see. Nothing else is sent. */
const MODEL_SAMPLE_LIMIT = 10;

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const BUCKET_CAPACITY = 20;
const REFILL_PER_SECOND = 0.5;

type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();

/** In-memory per-IP token bucket. Process-local by design — no dependency. */
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

export function resetPeopleRateLimiter(): void {
  buckets.clear();
}

// ---------------------------------------------------------------------------
// Prose generation
// ---------------------------------------------------------------------------

/** Chunked templated prose — the always-available baseline. */
async function* templatedAnswer(input: {
  question: string;
  filters: PeopleFilters;
  matches: readonly Person[];
  total: number;
}): AsyncIterable<string> {
  const answer = buildPeopleAnswer(input);
  // Word-at-a-time so the client's typing animation looks the same as the
  // model path.
  for (const chunk of answer.match(/\S+\s*/g) ?? [answer]) {
    yield chunk;
  }
}

/**
 * Streams from Claude when a key is configured, otherwise from the template.
 * Only a trimmed sample of rows is sent — never the whole dataset.
 */
function defaultAnswerGenerator(): AnswerGenerator {
  return async function* generate(input) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      yield* templatedAnswer(input);
      return;
    }

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });

    const sample = input.matches.slice(0, MODEL_SAMPLE_LIMIT).map((person) => ({
      name: `${person.firstName} ${person.lastName}`,
      title: person.title,
      company: person.company,
      country: person.country,
      verification: person.verification,
      confidence: person.confidence,
    }));

    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      system:
        'You answer questions about a B2B contact dataset. Be concise — two or three sentences. ' +
        'Use only the counts and rows provided; never invent contacts. Never output snake_case.',
      messages: [
        {
          role: 'user',
          content:
            `Question: ${input.question}\n` +
            `Total matches: ${input.total}\n` +
            `Sample rows: ${JSON.stringify(sample)}`,
        },
      ],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Stream assembly
// ---------------------------------------------------------------------------

function line(event: PeopleChatEvent): string {
  return `${JSON.stringify(event)}\n`;
}

export function createPeopleChatStream(input: {
  message: string;
  activeFilters?: Partial<PeopleFilters>;
  page?: number;
  generateAnswer?: AnswerGenerator;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const generate = input.generateAnswer ?? defaultAnswerGenerator();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: PeopleChatEvent) => controller.enqueue(encoder.encode(line(event)));

      try {
        // 1. Parse — instant, local, always succeeds.
        const base: PeopleFilters = { ...emptyPeopleFilters(), ...(input.activeFilters ?? {}) };
        const filters = parsePeopleQuery(input.message, { base });
        send({ type: 'filters', filters, chips: buildPeopleFilterChips(filters) });

        // 2. Results — the table fills before any prose is written.
        const matches = applyPeopleFilters(loadPeople(), filters);
        const results = matches.slice(0, INLINE_RESULT_LIMIT);
        send({ type: 'results', results, total: matches.length });

        // 3. Prose. A failed model call falls back mid-flight rather than
        //    erroring: the user must see an answer, not a stack trace.
        const answerInput = {
          question: input.message,
          filters,
          matches: results,
          total: matches.length,
        };

        let emittedAnything = false;
        let recovered = false;
        try {
          for await (const chunk of generate(answerInput)) {
            if (!chunk) continue;
            emittedAnything = true;
            send({ type: 'token', text: chunk });
          }
        } catch {
          // Complete the partial answer from the template. If the model died
          // before saying anything, the whole answer comes from the template.
          if (emittedAnything) send({ type: 'token', text: ' ' });
          for await (const chunk of templatedAnswer(answerInput)) {
            send({ type: 'token', text: chunk });
          }
          recovered = true;
        }

        // A generator that completed without yielding still owes an answer.
        if (!emittedAnything && !recovered) {
          for await (const chunk of templatedAnswer(answerInput)) {
            send({ type: 'token', text: chunk });
          }
        }

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
export function createPeopleChatErrorStream(
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

**Why `recovered` exists:** without it, a generator that throws *before* yielding leaves `emittedAnything === false`, and the `!emittedAnything` guard would run the template a second time — the user would see the answer twice. The two flags distinguish "never spoke" from "already recovered".

- [ ] **Step 4: Write `app/api/people/chat/route.ts`**

```ts
import { BadRequestError } from '@/lib/http/errors';
import { jsonError } from '@/lib/http/response';
import {
  consumeRateLimit,
  createPeopleChatErrorStream,
  createPeopleChatStream,
} from '@/lib/people/chat-stream';
import type { PeopleFilters } from '@/types/people';

/**
 * Streams an answer plus the filters and rows behind it as newline-delimited
 * JSON. Not tenant-scoped, matching GET /api/people.
 *
 * A rate-limit refusal is still delivered *as a stream event* rather than an
 * HTTP error, so the client has exactly one code path for reading replies.
 */

const NDJSON_HEADERS = {
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-store, no-transform',
};

type ChatBody = {
  message?: unknown;
  conversationId?: unknown;
  activeFilters?: unknown;
  page?: unknown;
};

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ChatBody;

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      throw new BadRequestError('message is required');
    }

    const page = Number.isInteger(body.page) ? (body.page as number) : 1;
    const activeFilters =
      body.activeFilters && typeof body.activeFilters === 'object'
        ? (body.activeFilters as Partial<PeopleFilters>)
        : undefined;

    const limit = consumeRateLimit(clientKey(request));
    if (!limit.allowed) {
      return new Response(
        createPeopleChatErrorStream(
          'rate_limited',
          `Too many questions at once. Try again in ${limit.retryAfterSeconds}s.`
        ),
        { status: 200, headers: NDJSON_HEADERS }
      );
    }

    return new Response(createPeopleChatStream({ message, activeFilters, page }), {
      status: 200,
      headers: NDJSON_HEADERS,
    });
  } catch (error) {
    return jsonError(error);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/integration/people-chat-route.test.ts`
Expected: PASS — 11 tests.

If the "no ANTHROPIC_API_KEY" test hangs or fails, confirm `defaultAnswerGenerator` checks `process.env.ANTHROPIC_API_KEY` **at call time**, not at module load — the test mutates it per-case.

- [ ] **Step 6: Confirm nothing else broke**

Run: `npx vitest run`
Expected: PASS — all suites.

- [ ] **Step 7: Commit**

```bash
git add lib/people/chat-stream.ts app/api/people/chat/route.ts tests/integration/people-chat-route.test.ts
git commit -m "feat(people): stream chat replies as NDJSON with filters and results first"
```

---

### Task 10: Shared-component additions and the Saved People store

**Files:**
- Modify: `components/search/query-store.ts:12`
- Modify: `components/search/ai-search-panel.tsx:26` and its `AiSearchPanel` signature
- Create: `lib/people/saved-store.ts`
- Test: `tests/integration/people-saved-store.test.ts`

**Interfaces:**
- Consumes: `Person` (Task 1).
- Produces: `readSavedPeople(storage: SavedPeopleStorage): Person[]`, `writeSavedPeople(storage, people): void`, `toggleSavedPerson(storage, person): Person[]`, `isPersonSaved(people, id): boolean`, `useSavedPeople(): { saved: Person[]; toggle: (person: Person) => void; isSaved: (id: string) => boolean }`, `SAVED_PEOPLE_STORAGE_KEY`, and the type `SavedPeopleStorage = Pick<Storage, 'getItem' | 'setItem'>`.
- Also produces, for later tasks: `TabKey` exported from `ai-search-panel.tsx`, and `AiSearchPanel`'s new optional `defaultTab?: TabKey` prop.

**Why storage is injected:** vitest runs in the `node` environment, where `localStorage` does not exist. The pure functions take a storage object so they are testable without adding a jsdom dependency; the hook supplies `window.localStorage`.

**Both shared-file edits are additive and must leave Events and Companies behaviour identical.** `defaultTab` defaults to `null`, which is the current behaviour (history collapsed).

- [ ] **Step 1: Write the failing test**

Create `tests/integration/people-saved-store.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  SAVED_PEOPLE_STORAGE_KEY,
  isPersonSaved,
  readSavedPeople,
  toggleSavedPerson,
  writeSavedPeople,
} from '@/lib/people/saved-store';
import type { Person } from '@/types/people';

function makeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    dump: () => Object.fromEntries(map),
  };
}

function makePerson(id: string): Person {
  return {
    id,
    firstName: 'Sarah',
    lastName: 'Miller',
    title: 'Marketing Manager',
    seniority: 'Manager',
    department: 'Marketing',
    company: 'NovaAI',
    companyDomain: 'novaai.de',
    companyHeadcount: '51-200',
    industry: 'Artificial Intelligence',
    country: 'Germany',
    location: 'Berlin, Germany',
    workEmail: 'sarah.miller@novaai.de',
    phone: null,
    linkedinUrl: null,
    verification: 'verified',
    confidence: 91,
    platformScore: 98,
    source: 'user_import',
    keywords: ['automation'],
    buyingIntent: 'high',
    fetchedAt: '2026-02-01',
    lastActiveAt: '2026-08-01',
  };
}

describe('saved people store', () => {
  it('starts empty', () => {
    expect(readSavedPeople(makeStorage())).toEqual([]);
  });

  it('round-trips through storage', () => {
    const storage = makeStorage();
    writeSavedPeople(storage, [makePerson('p1')]);
    expect(readSavedPeople(storage).map((person) => person.id)).toEqual(['p1']);
  });

  it('toggles a person in and back out', () => {
    const storage = makeStorage();
    expect(toggleSavedPerson(storage, makePerson('p1')).map((p) => p.id)).toEqual(['p1']);
    expect(toggleSavedPerson(storage, makePerson('p1'))).toEqual([]);
  });

  it('never stores the same person twice', () => {
    const storage = makeStorage();
    writeSavedPeople(storage, [makePerson('p1'), makePerson('p1')]);
    expect(readSavedPeople(storage)).toHaveLength(1);
  });

  it('survives a corrupt entry rather than throwing', () => {
    const storage = makeStorage({ [SAVED_PEOPLE_STORAGE_KEY]: '{not json' });
    expect(readSavedPeople(storage)).toEqual([]);
  });

  it('ignores a stored value that is not an array', () => {
    const storage = makeStorage({ [SAVED_PEOPLE_STORAGE_KEY]: '{"nope":true}' });
    expect(readSavedPeople(storage)).toEqual([]);
  });

  it('reports membership', () => {
    expect(isPersonSaved([makePerson('p1')], 'p1')).toBe(true);
    expect(isPersonSaved([makePerson('p1')], 'p2')).toBe(false);
  });

  it('does not throw when storage refuses to write', () => {
    const readOnly = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => writeSavedPeople(readOnly, [makePerson('p1')])).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/people-saved-store.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/people/saved-store"`.

- [ ] **Step 3: Write `lib/people/saved-store.ts`**

```ts
"use client";

import { useCallback, useEffect, useState } from 'react';
import type { Person } from '@/types/people';

/**
 * Saved People, browser-local.
 *
 * Mirrors `components/search/query-store.ts` rather than the workspace-scoped
 * `/api/saved-companies` table, because People has no persisted model (spec
 * decision 1: the dataset is a committed seed, no database). Everything goes
 * through this one file, so promoting it to an API later is a single-file
 * change.
 *
 * The pure functions take an injected storage object so they can be unit-tested
 * in vitest's `node` environment, where `localStorage` does not exist.
 */

export const SAVED_PEOPLE_STORAGE_KEY = 'pcx_saved_people';
const CHANGE_EVENT = 'pcx:saved-people-changed';

export type SavedPeopleStorage = Pick<Storage, 'getItem' | 'setItem'>;

function dedupe(people: Person[]): Person[] {
  const seen = new Set<string>();
  return people.filter((person) => {
    if (!person?.id || seen.has(person.id)) return false;
    seen.add(person.id);
    return true;
  });
}

export function readSavedPeople(storage: SavedPeopleStorage): Person[] {
  try {
    const raw = storage.getItem(SAVED_PEOPLE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? dedupe(parsed as Person[]) : [];
  } catch {
    // Corrupt entry — start clean rather than breaking the tab.
    return [];
  }
}

export function writeSavedPeople(storage: SavedPeopleStorage, people: Person[]): void {
  try {
    storage.setItem(SAVED_PEOPLE_STORAGE_KEY, JSON.stringify(dedupe(people)));
  } catch {
    // Quota exceeded or storage disabled — saving is a convenience, not a
    // requirement, so drop it silently.
  }
}

export function toggleSavedPerson(storage: SavedPeopleStorage, person: Person): Person[] {
  const current = readSavedPeople(storage);
  const next = current.some((entry) => entry.id === person.id)
    ? current.filter((entry) => entry.id !== person.id)
    : [...current, person];
  writeSavedPeople(storage, next);
  return next;
}

export function isPersonSaved(people: readonly Person[], id: string): boolean {
  return people.some((person) => person.id === id);
}

/** React binding. Broadcasts writes so every mounted view re-reads. */
export function useSavedPeople() {
  const [saved, setSaved] = useState<Person[]>([]);

  useEffect(() => {
    const sync = () => setSaved(readSavedPeople(window.localStorage));
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggle = useCallback((person: Person) => {
    setSaved(toggleSavedPerson(window.localStorage, person));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const isSaved = useCallback((id: string) => isPersonSaved(saved, id), [saved]);

  return { saved, toggle, isSaved };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/people-saved-store.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Make the two additive shared-component edits**

In `components/search/query-store.ts`, extend the kind union on line 12:

```ts
export type SavedQueryKind = "lead_query" | "event_query" | "people_query";
```

In `components/search/ai-search-panel.tsx`, export the tab type on line 26:

```ts
export type TabKey = (typeof TABS)[number]["key"];
```

Then give `AiSearchPanel` an optional `defaultTab`. Change the destructured props and the type to add it, and seed the state from it:

```ts
export function AiSearchPanel({
  title,
  subtitle,
  placeholder,
  kind,
  kindLabel,
  isBusy = false,
  note,
  defaultTab = null,
  onSubmit,
  onSelectQuery,
  children,
}: {
  title: string;
  subtitle: string;
  placeholder: string;
  kind: SavedQueryKind;
  kindLabel: string;
  isBusy?: boolean;
  note?: ReactNode;
  /** Which history tab starts expanded. `null` (the default) keeps it collapsed. */
  defaultTab?: TabKey | null;
  onSubmit: (prompt: string) => void;
  onSelectQuery: (entry: SavedQuery) => void;
  children?: ReactNode;
}) {
  const [prompt, setPrompt] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey | null>(defaultTab);
```

Only those three lines change inside the function body: the `activeTab` initialiser now reads `defaultTab` instead of the literal `null`. Nothing else in the file moves.

- [ ] **Step 6: Verify Events and Companies are unaffected**

Run: `npx vitest run`
Expected: PASS — all suites, `event-filters.test.ts` included.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/people/saved-store.ts tests/integration/people-saved-store.test.ts components/search/query-store.ts components/search/ai-search-panel.tsx
git commit -m "feat(people): add the Saved People store; open AiSearchPanel to a people kind and default tab"
```

---

## A note on verifying Tasks 11–15

These tasks are React components. The repo has **no** React testing library and adding one would violate the no-new-dependencies constraint, so their verification is:

1. `npx tsc --noEmit` — no errors.
2. `npm run lint` — no new warnings.
3. `npx vitest run` — the logic suites still pass.
4. A named manual check in the running app (`npm run dev`, then `http://localhost:3000/app/people`).

Do not invent unit tests for these files. Do not claim a manual check passed without running it.

---

### Task 11: Results table and bulk toolbar

**Files:**
- Create: `components/people/people-results-table.tsx`
- Create: `components/people/people-bulk-toolbar.tsx`

**Interfaces:**
- Consumes: `Person`, `VerificationStatus` (Task 1); `VERIFICATION_LABELS` (Task 1); `cn` from `@/lib/utils`.
- Produces:
  - `PeopleResultsTable(props: { people: Person[]; selectedIds: Set<string>; savedIds: Set<string>; isLoading?: boolean; skeletonRows?: number; emptyMessage?: string; onToggleSelect: (id: string) => void; onToggleSaved: (person: Person) => void; onOpenPerson: (person: Person) => void; })`
  - `PeopleBulkToolbar(props: { selectedCount: number; totalCount: number; allSelected: boolean; onToggleSelectAll: () => void; onVerifyEmails: () => void; onAddToSequence: () => void; onMerge: () => void; })`

**This one table serves both the capped 10-row inline reply and the full Results view**, so cell rendering cannot drift between them. That is the whole reason it is its own file.

The cells carry over from today's page (`components/crm/people-section.tsx:204-278`): avatar + name/title, Platform Score (star), Company, Work Email, Status badge, Confidence bar.

- [ ] **Step 1: Write `components/people/people-results-table.tsx`**

```tsx
"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { VERIFICATION_LABELS } from "@/lib/people/vocabulary";
import type { Person, VerificationStatus } from "@/types/people";

/**
 * The shared People table. Used both for the capped inline table inside a chat
 * reply and for the full paginated Results view, so a cell can never render
 * differently in the two places.
 */

function initials(person: Person): string {
  return `${person.firstName[0] ?? ""}${person.lastName[0] ?? ""}`.toUpperCase();
}

const STATUS_STYLES: Record<VerificationStatus, string> = {
  verified:
    "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  needs_verification:
    "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  invalid:
    "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
};

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={index} className="h-[48px]">
          <td colSpan={7} className="px-4">
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-100 dark:bg-[#16233A]" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function PeopleResultsTable({
  people,
  selectedIds,
  savedIds,
  isLoading = false,
  skeletonRows = 5,
  emptyMessage = "No contacts match — try relaxing verification or confidence.",
  onToggleSelect,
  onToggleSaved,
  onOpenPerson,
}: {
  people: Person[];
  selectedIds: Set<string>;
  savedIds: Set<string>;
  isLoading?: boolean;
  skeletonRows?: number;
  emptyMessage?: string;
  onToggleSelect: (id: string) => void;
  onToggleSaved: (person: Person) => void;
  onOpenPerson: (person: Person) => void;
}) {
  if (!isLoading && people.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:border-[#22304A] dark:bg-[#111B2E]">
        <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">{emptyMessage}</p>
      </div>
    );
  }

  return (
    // The table scrolls inside its own container so the page body never scrolls
    // horizontally, on any breakpoint.
    <div className="overflow-x-auto rounded-[12px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      <table className="w-full min-w-[900px] whitespace-nowrap text-left text-[13px]">
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-[#22304A] dark:bg-[#0B1220]">
          <tr className="text-[12px] text-slate-500 dark:text-slate-400">
            <th className="w-[44px] px-4 py-2.5 font-medium">
              <span className="sr-only">Select</span>
            </th>
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-3 py-2.5 font-medium">Platform Score</th>
            <th className="px-3 py-2.5 font-medium">Company</th>
            <th className="px-3 py-2.5 font-medium">Work Email</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-[#22304A]">
          {isLoading ? (
            <SkeletonRows rows={skeletonRows} />
          ) : (
            people.map((person) => {
              const isSelected = selectedIds.has(person.id);
              const isSaved = savedIds.has(person.id);
              return (
                <tr
                  key={person.id}
                  onClick={() => onOpenPerson(person)}
                  className={cn(
                    "group h-[48px] cursor-pointer border-l-2 transition-colors",
                    isSelected
                      ? "border-l-indigo-500 bg-indigo-50/50 dark:bg-[#16233A]/80"
                      : "border-l-transparent hover:bg-slate-50 dark:hover:bg-[#16233A]/40"
                  )}
                >
                  <td className="px-4" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${person.firstName} ${person.lastName}`}
                      checked={isSelected}
                      onChange={() => onToggleSelect(person.id)}
                      className="size-3.5 cursor-pointer accent-indigo-600"
                    />
                  </td>
                  <td className="px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm",
                          isSelected ? "bg-indigo-500" : "bg-slate-300 dark:bg-[#22304A]"
                        )}
                      >
                        {initials(person)}
                      </div>
                      <div className="flex flex-col">
                        <span
                          className={cn(
                            "text-[13px] font-semibold",
                            isSelected
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-slate-900 dark:text-[#E5E7EB]"
                          )}
                        >
                          {person.firstName} {person.lastName}
                        </span>
                        <span className="max-w-[160px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {person.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label={isSaved ? "Remove from Saved People" : "Save person"}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleSaved(person);
                        }}
                        className="ml-1 rounded-full p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-amber-500 dark:text-slate-600 dark:hover:bg-[#22304A]"
                      >
                        <Star className={cn("size-3.5", isSaved && "fill-amber-400 text-amber-400")} />
                      </button>
                    </div>
                  </td>
                  <td className="px-3">
                    <div className="flex items-center gap-1.5">
                      <Star
                        className={cn(
                          "size-3.5",
                          person.platformScore >= 90
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300 dark:text-slate-600"
                        )}
                      />
                      <span className="font-medium text-slate-700 dark:text-[#E5E7EB]">
                        {person.platformScore}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 font-medium text-slate-700 dark:text-slate-400">
                    {person.company}
                  </td>
                  <td className="px-3 font-medium text-slate-900 dark:text-[#E5E7EB]">
                    {person.workEmail}
                  </td>
                  <td className="px-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                        STATUS_STYLES[person.verification]
                      )}
                    >
                      {VERIFICATION_LABELS[person.verification]}
                    </span>
                  </td>
                  <td className="px-3">
                    <div className="flex w-[70px] items-center gap-2">
                      <span className="font-mono text-[12px] font-medium text-slate-700 dark:text-white">
                        {person.confidence}%
                      </span>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#0B1220]">
                        <div
                          className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400"
                          style={{ width: `${person.confidence}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/people/people-bulk-toolbar.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";

/**
 * Sits directly above the results table. The selection state is real; the three
 * actions are wired to their handlers but their side effects are a follow-up
 * (spec: "the toolbar ships wired to selection state, but Verify/Sequence/Merge
 * are follow-ups"). They are disabled with nothing selected so they never look
 * broken.
 */
export function PeopleBulkToolbar({
  selectedCount,
  totalCount,
  allSelected,
  onToggleSelectAll,
  onVerifyEmails,
  onAddToSequence,
  onMerge,
}: {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onVerifyEmails: () => void;
  onAddToSequence: () => void;
  onMerge: () => void;
}) {
  const actionClass = (enabled: boolean) =>
    cn(
      "h-7 rounded-[6px] border px-2.5 text-[12px] font-medium shadow-sm transition-colors",
      enabled
        ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#16233A] dark:text-[#E5E7EB] dark:hover:bg-[#22304A]"
        : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-600"
    );

  const hasSelection = selectedCount > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 border-r border-slate-200 pr-3 dark:border-[#22304A]">
          <input
            type="checkbox"
            checked={allSelected && totalCount > 0}
            onChange={onToggleSelectAll}
            className="size-3.5 cursor-pointer accent-indigo-600"
          />
          <span className="text-[12px] font-medium text-slate-700 dark:text-[#E5E7EB]">
            Select all
          </span>
        </label>
        <button type="button" disabled={!hasSelection} onClick={onVerifyEmails} className={actionClass(hasSelection)}>
          Verify emails
        </button>
        <button type="button" disabled={!hasSelection} onClick={onAddToSequence} className={actionClass(hasSelection)}>
          Add to Sequence
        </button>
        <button type="button" disabled={selectedCount < 2} onClick={onMerge} className={actionClass(selectedCount >= 2)}>
          Merge
        </button>
      </div>
      <div className="flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 dark:border-[#22304A] dark:bg-[#16233A]">
        <span className="text-[11px] font-semibold text-slate-700 dark:text-white">
          {selectedCount} selected
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings for `components/people/*`.

- [ ] **Step 4: Commit**

```bash
git add components/people/people-results-table.tsx components/people/people-bulk-toolbar.tsx
git commit -m "feat(people): add the shared results table and bulk action toolbar"
```

---

### Task 12: The 14-group filter rail

**Files:**
- Create: `components/people/people-filter-sidebar.tsx`

**Interfaces:**
- Consumes: `FilterAccordion`, `FacetOptionList` from `components/search/filter-accordion.tsx`; `PeopleFacets` (Task 3); `PeopleFilters`, `PEOPLE_FILTER_LIST_KEYS`, `hasAnyPeopleFilter`, `CONFIDENCE_THRESHOLDS`, `VERIFICATION_STATUSES` (Task 1); `VERIFICATION_LABELS`, `SOURCE_LABELS`, `INTENT_LABELS` (Task 1); `Person` (Task 1).
- Produces: `PeopleFilterSidebar(props: { filters: PeopleFilters; facets: PeopleFacets; resultCount: number; lookalikeSeed: Person | null; onFiltersChange: (next: PeopleFilters) => void; onClear: () => void; })`

**The 14 groups, in the spec's order:** AI Lookalikes, Verification Status, Confidence Score, Data Source, Job Title, Seniority, Department, Company, Location, Country, Employee Headcount, Industry, Keywords, Buying Intent.

Chevron and expand animation come from `FilterAccordion` unchanged, so the motion matches Companies exactly.

- [ ] **Step 1: Write `components/people/people-filter-sidebar.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FacetOptionList, FilterAccordion } from "@/components/search/filter-accordion";
import type { PeopleFacets } from "@/lib/people/filters";
import { INTENT_LABELS, SOURCE_LABELS, VERIFICATION_LABELS } from "@/lib/people/vocabulary";
import {
  CONFIDENCE_THRESHOLDS,
  VERIFICATION_STATUSES,
  hasAnyPeopleFilter,
  type ConfidenceThreshold,
  type PeopleFilterListKey,
  type PeopleFilters,
  type Person,
  type VerificationStatus,
} from "@/types/people";

/**
 * The left rail. Renders straight from the shared `PeopleFilters` in the URL,
 * so it shows the same state whether the user ticked a box or the assistant set
 * it from a sentence.
 */

type SectionKey =
  | "lookalikes"
  | "verification"
  | "confidence"
  | PeopleFilterListKey;

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "lookalikes", label: "AI Lookalikes" },
  { key: "verification", label: "Verification Status" },
  { key: "confidence", label: "Confidence Score" },
  { key: "sources", label: "Data Source" },
  { key: "titles", label: "Job Title" },
  { key: "seniorities", label: "Seniority" },
  { key: "departments", label: "Department" },
  { key: "companies", label: "Company" },
  { key: "locations", label: "Location" },
  { key: "countries", label: "Country" },
  { key: "headcounts", label: "Employee Headcount" },
  { key: "industries", label: "Industry" },
  { key: "keywords", label: "Keywords" },
  { key: "buyingIntents", label: "Buying Intent" },
];

/** Which sections get a search box — the long, open vocabularies. */
const SEARCHABLE: Partial<Record<PeopleFilterListKey, boolean>> = {
  titles: true,
  companies: true,
  locations: true,
  countries: true,
  industries: true,
  keywords: true,
};

function summarise(values: string[], label: (value: string) => string): string | null {
  if (values.length === 0) return null;
  return values.length === 1 ? label(values[0]) : `${label(values[0])} +${values.length - 1}`;
}

export function PeopleFilterSidebar({
  filters,
  facets,
  resultCount,
  lookalikeSeed,
  onFiltersChange,
  onClear,
}: {
  filters: PeopleFilters;
  facets: PeopleFacets;
  resultCount: number;
  lookalikeSeed: Person | null;
  onFiltersChange: (next: PeopleFilters) => void;
  onClear: () => void;
}) {
  const [openSection, setOpenSection] = useState<SectionKey | null>("verification");

  const activeCount =
    (Object.keys(filters) as (keyof PeopleFilters)[]).reduce((count, key) => {
      const value = filters[key];
      if (Array.isArray(value)) return count + value.length;
      if (key === "search") return count + (String(value).trim() ? 1 : 0);
      return count + (value === null ? 0 : 1);
    }, 0);

  const toggleValue = (key: PeopleFilterListKey, value: string) => {
    const current = filters[key];
    onFiltersChange({
      ...filters,
      [key]: current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    });
  };

  const labelFor = (key: SectionKey, value: string): string => {
    if (key === "sources") return SOURCE_LABELS[value] ?? value;
    if (key === "buyingIntents") return INTENT_LABELS[value] ?? value;
    return value;
  };

  const summaryFor = (key: SectionKey): string | null => {
    if (key === "lookalikes") {
      return lookalikeSeed ? `${lookalikeSeed.firstName} ${lookalikeSeed.lastName}` : null;
    }
    if (key === "verification") {
      return filters.verification ? VERIFICATION_LABELS[filters.verification] : null;
    }
    if (key === "confidence") {
      return filters.minConfidence !== null ? `≥${filters.minConfidence}%` : null;
    }
    return summarise(filters[key], (value) => labelFor(key, value));
  };

  const isDirty = hasAnyPeopleFilter(filters);

  return (
    <div className="flex h-full flex-col rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          value={filters.search}
          onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
          placeholder="Search people, or ask about contacts..."
          className="h-10 w-full rounded-[10px] border border-slate-200 bg-slate-50 pl-10 pr-9 text-[13px] text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white dark:placeholder:text-slate-500"
        />
        {filters.search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onFiltersChange({ ...filters, search: "" })}
            className="absolute right-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
        Press Enter to ask — e.g. &ldquo;verified marketing managers in Germany&rdquo;
      </p>

      {/* "All" chip row — mirrors the Companies rail. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className={cn(
            "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
            !isDirty
              ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-[#0B1220]"
              : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-slate-900 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-300 dark:hover:text-white"
          )}
        >
          All
        </button>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {resultCount.toLocaleString()} matching
        </span>
      </div>

      <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {SECTIONS.map((section) => (
          <FilterAccordion
            key={section.key}
            label={section.label}
            isOpen={openSection === section.key}
            onToggle={() => setOpenSection(openSection === section.key ? null : section.key)}
            summary={summaryFor(section.key)}
          >
            {section.key === "lookalikes" ? (
              <div className="space-y-2 p-1">
                {lookalikeSeed ? (
                  <>
                    <div className="flex items-center gap-2 rounded-[9px] border border-indigo-200 bg-indigo-50 px-2.5 py-2 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                      <Sparkles className="size-3.5 shrink-0 text-indigo-500" />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-indigo-700 dark:text-indigo-300">
                        {lookalikeSeed.firstName} {lookalikeSeed.lastName} · {lookalikeSeed.title}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onFiltersChange({ ...filters, lookalikeSeedId: null })}
                      className="w-full rounded-[9px] py-1.5 text-[11px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                    >
                      Clear lookalike seed
                    </button>
                  </>
                ) : (
                  <p className="px-3 py-3 text-center text-[12px] text-slate-400 dark:text-slate-500">
                    Open a contact and choose &ldquo;Find similar&rdquo; to rank everyone by how
                    closely they match.
                  </p>
                )}
              </div>
            ) : section.key === "verification" ? (
              <div className="space-y-1 p-1">
                {([null, ...VERIFICATION_STATUSES] as (VerificationStatus | null)[]).map(
                  (status) => {
                    const isSelected = filters.verification === status;
                    const count =
                      status === null
                        ? facets.verification.reduce((sum, option) => sum + option.count, 0)
                        : (facets.verification.find((option) => option.value === status)?.count ?? 0);
                    return (
                      <button
                        key={status ?? "all"}
                        type="button"
                        onClick={() => onFiltersChange({ ...filters, verification: status })}
                        className={cn(
                          "flex w-full items-center justify-between rounded-[9px] px-2.5 py-2 text-left text-[12px] font-medium transition-colors",
                          isSelected
                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                            : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#16233A]"
                        )}
                      >
                        <span>{status === null ? "All" : VERIFICATION_LABELS[status]}</span>
                        <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                          {count.toLocaleString()}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            ) : section.key === "confidence" ? (
              <div className="flex flex-wrap gap-1.5 p-1">
                {([null, ...CONFIDENCE_THRESHOLDS] as (ConfidenceThreshold | null)[]).map(
                  (threshold) => {
                    const isSelected = filters.minConfidence === threshold;
                    return (
                      <button
                        key={threshold ?? "any"}
                        type="button"
                        onClick={() => onFiltersChange({ ...filters, minConfidence: threshold })}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400/50 dark:bg-indigo-500/10 dark:text-indigo-300"
                            : "border-slate-200 text-slate-600 hover:border-indigo-300 dark:border-[#22304A] dark:text-slate-300"
                        )}
                      >
                        {threshold === null ? "Any" : `≥${threshold}%`}
                      </button>
                    );
                  }
                )}
              </div>
            ) : (
              <FacetOptionList
                options={facets[section.key].map((option) => ({
                  value: option.value,
                  count: option.count,
                }))}
                selected={filters[section.key]}
                onToggle={(value) => toggleValue(section.key as PeopleFilterListKey, value)}
                searchPlaceholder={
                  SEARCHABLE[section.key as PeopleFilterListKey]
                    ? `Search ${section.label.toLowerCase()}...`
                    : undefined
                }
              />
            )}
          </FilterAccordion>
        ))}
      </div>

      {/* Sticky footer inside the panel. */}
      <div className="-mx-4 -mb-4 mt-3 flex items-center justify-between gap-2 rounded-b-[14px] border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#22304A] dark:bg-[#0B1220]">
        <button
          type="button"
          onClick={onClear}
          disabled={!isDirty}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
            isDirty
              ? "border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-600 dark:border-[#22304A] dark:text-slate-300 dark:hover:border-red-500/30 dark:hover:text-red-400"
              : "cursor-not-allowed border-slate-200 text-slate-300 dark:border-[#22304A] dark:text-slate-600"
          )}
        >
          <X className="size-3" />
          Clear all
        </button>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {activeCount} active {activeCount === 1 ? "filter" : "filters"}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Close the enum-label gap in Data Source and Buying Intent**

`FacetOptionList` renders `option.value` verbatim (`filter-accordion.tsx:158`), so those two groups would show raw `licensed_dataset` / `high`. It takes no label prop, and this change may not extend that shared file beyond the two agreed edits in Task 10.

So render exactly those two groups with the same inline button list already used for Verification. Insert this branch **before** the final `FacetOptionList` branch:

```tsx
            ) : section.key === "sources" || section.key === "buyingIntents" ? (
              <div className="space-y-1 p-1">
                {facets[section.key].map((option) => {
                  const isSelected = filters[section.key].includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleValue(section.key as PeopleFilterListKey, option.value)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-[9px] px-2.5 py-2 text-left text-[12px] font-medium transition-colors",
                        isSelected
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#16233A]"
                      )}
                    >
                      <span>{labelFor(section.key, option.value)}</span>
                      <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                        {option.count.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
```

Every other group keeps `FacetOptionList` — their values are already human-readable.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors. In particular `facets[section.key]` must typecheck — `section.key` is narrowed to `PeopleFilterListKey` in the final branch because the three special keys are handled above it.

Run: `npm run lint`
Expected: no new warnings.

- [ ] **Step 4: Commit**

```bash
git add components/people/people-filter-sidebar.tsx
git commit -m "feat(people): add the 14-group filter rail"
```

---

### Task 13: The chat hook, message and panel

**Files:**
- Create: `components/people/use-people-chat.ts`
- Create: `components/people/people-message.tsx`
- Create: `components/people/people-chat-panel.tsx`

**Interfaces:**
- Consumes: `PeopleChatEvent` (Task 9); `PeopleFilters`, `Person` (Task 1); `PeopleFilterChip` (Task 4); `AiSearchPanel`, `CompactSearchBar` (Task 10 edits); `FilterChips` from `components/search/filter-chips.tsx`; `useQueryStore` from `components/search/query-store.ts`; `PeopleResultsTable` (Task 11).
- Produces:
  - `type PeopleChatMessage = { id: string; role: "user" | "assistant"; text: string; filters: PeopleFilters | null; chips: PeopleFilterChip[]; results: Person[]; total: number; isComplete: boolean; error: { code: string; message: string } | null }`
  - `usePeopleChat(options: { activeFilters: PeopleFilters }): { messages: PeopleChatMessage[]; isStreaming: boolean; error: string | null; send: (message: string) => Promise<void>; retry: () => Promise<void>; stop: () => void; reset: () => void }`
  - `PeopleMessage(props: { message: PeopleChatMessage; savedIds: Set<string>; selectedIds: Set<string>; isStreaming: boolean; onApplyFilters: (filters: PeopleFilters) => void; onViewAll: (filters: PeopleFilters) => void; onRetry: () => void; onToggleSelect: (id: string) => void; onToggleSaved: (person: Person) => void; onOpenPerson: (person: Person) => void; })`
  - `PeopleChatPanel(props: { ... })` — see its own step.

- [ ] **Step 1: Write `components/people/use-people-chat.ts`**

```ts
"use client";

import { useCallback, useRef, useState } from "react";
import type { PeopleChatEvent } from "@/lib/people/chat-stream";
import type { PeopleFilterChip } from "@/lib/people/chips";
import type { PeopleFilters, Person } from "@/types/people";

/**
 * Owns the chat thread and the NDJSON read loop.
 *
 * The stream's contract (filters, then results, then prose) is what lets this
 * fill the table before the answer exists. A stream that dies mid-answer keeps
 * whatever prose arrived, marks the message incomplete and offers Retry —
 * partial output is more useful than a discarded one.
 */

export type PeopleChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  filters: PeopleFilters | null;
  chips: PeopleFilterChip[];
  results: Person[];
  total: number;
  isComplete: boolean;
  error: { code: string; message: string } | null;
};

function newId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function usePeopleChat({ activeFilters }: { activeFilters: PeopleFilters }) {
  const [messages, setMessages] = useState<PeopleChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lastQuestionRef = useRef<string>("");
  const conversationIdRef = useRef<string>(newId());

  const patchAssistant = useCallback((id: string, patch: Partial<PeopleChatMessage>) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...patch } : message))
    );
  }, []);

  const run = useCallback(
    async (question: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      lastQuestionRef.current = question;

      const assistantId = newId();
      setError(null);
      setIsStreaming(true);
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "user",
          text: question,
          filters: null,
          chips: [],
          results: [],
          total: 0,
          isComplete: true,
          error: null,
        },
        {
          id: assistantId,
          role: "assistant",
          text: "",
          filters: null,
          chips: [],
          results: [],
          total: 0,
          isComplete: false,
          error: null,
        },
      ]);

      try {
        const response = await fetch("/api/people/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: question,
            conversationId: conversationIdRef.current,
            activeFilters,
            page: 1,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let prose = "";

        // NDJSON: split on newlines, keep the trailing partial line buffered.
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let event: PeopleChatEvent;
            try {
              event = JSON.parse(line) as PeopleChatEvent;
            } catch {
              continue; // ignore a malformed frame rather than killing the read
            }

            if (event.type === "filters") {
              patchAssistant(assistantId, { filters: event.filters, chips: event.chips });
            } else if (event.type === "results") {
              patchAssistant(assistantId, { results: event.results, total: event.total });
            } else if (event.type === "token") {
              prose += event.text;
              patchAssistant(assistantId, { text: prose });
            } else if (event.type === "error") {
              patchAssistant(assistantId, {
                error: { code: event.code, message: event.message },
                isComplete: true,
              });
              setError(event.message);
            } else if (event.type === "done") {
              patchAssistant(assistantId, { isComplete: true });
            }
          }
        }

        // The stream ended without a `done` frame — keep the partial answer and
        // let the user retry rather than discarding what arrived.
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId && !message.isComplete
              ? { ...message, error: { code: "interrupted", message: "Answer incomplete." } }
              : message
          )
        );
      } catch (caught) {
        if ((caught as Error).name === "AbortError") {
          patchAssistant(assistantId, { isComplete: true });
        } else {
          const message = caught instanceof Error ? caught.message : "Something went wrong.";
          patchAssistant(assistantId, {
            isComplete: true,
            error: { code: "request_failed", message },
          });
          setError(message);
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [activeFilters, patchAssistant]
  );

  const send = useCallback(
    async (message: string) => {
      const question = message.trim();
      if (!question || isStreaming) return;
      await run(question);
    },
    [isStreaming, run]
  );

  const retry = useCallback(async () => {
    if (!lastQuestionRef.current || isStreaming) return;
    // Drop the failed exchange so the thread does not accumulate dead turns.
    setMessages((current) => current.slice(0, -2));
    await run(lastQuestionRef.current);
  }, [isStreaming, run]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    conversationIdRef.current = newId();
    lastQuestionRef.current = "";
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isStreaming, error, send, retry, stop, reset };
}
```

- [ ] **Step 2: Write `components/people/people-message.tsx`**

```tsx
"use client";

import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, Filter, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterChips } from "@/components/search/filter-chips";
import { PeopleResultsTable } from "@/components/people/people-results-table";
import type { PeopleChatMessage } from "@/components/people/use-people-chat";
import type { PeopleFilters, Person } from "@/types/people";

/**
 * One turn in the thread. An assistant turn is three things stacked: the prose
 * answer, the chips showing how the question was read (with "Apply filters"),
 * and the capped inline table.
 */
export function PeopleMessage({
  message,
  savedIds,
  selectedIds,
  isStreaming,
  onApplyFilters,
  onViewAll,
  onRetry,
  onToggleSelect,
  onToggleSaved,
  onOpenPerson,
}: {
  message: PeopleChatMessage;
  savedIds: Set<string>;
  selectedIds: Set<string>;
  isStreaming: boolean;
  onApplyFilters: (filters: PeopleFilters) => void;
  onViewAll: (filters: PeopleFilters) => void;
  onRetry: () => void;
  onToggleSelect: (id: string) => void;
  onToggleSaved: (person: Person) => void;
  onOpenPerson: (person: Person) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-[14px] rounded-br-[4px] bg-indigo-600 px-3.5 py-2.5 text-[13px] font-medium text-white shadow-sm">
          {message.text}
        </div>
      </div>
    );
  }

  const isRateLimited = message.error?.code === "rate_limited";
  // Results have not arrived yet — show the skeleton rather than an empty table.
  const isAwaitingResults = !message.filters && !message.error;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-3 rounded-[14px] border border-slate-200 bg-white p-3.5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]"
    >
      {message.text ? (
        <p className="text-[13px] leading-6 text-slate-800 dark:text-slate-200">
          {message.text}
          {isStreaming && !message.isComplete ? (
            <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-indigo-500 align-middle" />
          ) : null}
        </p>
      ) : null}

      {message.error ? (
        <div
          className={cn(
            "flex items-start gap-2 rounded-[10px] border px-3 py-2.5 text-[12px]",
            isRateLimited
              ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
          )}
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{message.error.message}</p>
            {/* Rate limits get no retry button until the window elapses. */}
            {!isRateLimited ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-1.5 inline-flex items-center gap-1 rounded-[8px] border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:bg-[#0B1220] dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <RefreshCw className="size-3" />
                Retry
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {message.chips.length > 0 && message.filters ? (
        <div className="flex flex-wrap items-center gap-2">
          <FilterChips chips={message.chips} />
          <button
            type="button"
            onClick={() => onApplyFilters(message.filters as PeopleFilters)}
            className="inline-flex h-7 items-center gap-1.5 rounded-[8px] border border-indigo-200 bg-indigo-50 px-2.5 text-[11px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
          >
            <Filter className="size-3" />
            Apply filters
          </button>
        </div>
      ) : null}

      {isAwaitingResults || message.results.length > 0 ? (
        <PeopleResultsTable
          people={message.results}
          selectedIds={selectedIds}
          savedIds={savedIds}
          isLoading={isAwaitingResults}
          skeletonRows={5}
          onToggleSelect={onToggleSelect}
          onToggleSaved={onToggleSaved}
          onOpenPerson={onOpenPerson}
        />
      ) : null}

      {message.total > message.results.length && message.filters ? (
        <button
          type="button"
          onClick={() => onViewAll(message.filters as PeopleFilters)}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          View all {message.total.toLocaleString()} results
          <ArrowRight className="size-3.5" />
        </button>
      ) : null}
    </motion.div>
  );
}
```

- [ ] **Step 3: Write `components/people/people-chat-panel.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AiSearchPanel, CompactSearchBar } from "@/components/search/ai-search-panel";
import { useQueryStore } from "@/components/search/query-store";
import { PeopleMessage } from "@/components/people/people-message";
import { PeopleResultsTable } from "@/components/people/people-results-table";
import { PeopleBulkToolbar } from "@/components/people/people-bulk-toolbar";
import type { PeopleChatMessage } from "@/components/people/use-people-chat";
import type { PeopleFilters, Person } from "@/types/people";

/**
 * The right column. Two states, one surface:
 *
 * - EMPTY: the shared `AiSearchPanel` hero — gradient sparkle badge, gradient
 *   textarea, circular send button, Recent | Saved cards.
 * - ACTIVE: the hero collapses to `CompactSearchBar`, pinned above a scrolling
 *   thread.
 *
 * `View all N results` flips `view` to "results" — a full paginated table with
 * the thread preserved underneath, rather than a third column.
 */
export function PeopleChatPanel({
  messages,
  isStreaming,
  view,
  results,
  resultsTotal,
  page,
  pageSize,
  isLoadingResults,
  selectedIds,
  savedIds,
  onViewChange,
  onPageChange,
  onSend,
  onRetry,
  onApplyFilters,
  onViewAll,
  onToggleSelect,
  onToggleSelectAll,
  onToggleSaved,
  onOpenPerson,
}: {
  messages: PeopleChatMessage[];
  isStreaming: boolean;
  view: "chat" | "results";
  results: Person[];
  resultsTotal: number;
  page: number;
  pageSize: number;
  isLoadingResults: boolean;
  selectedIds: Set<string>;
  savedIds: Set<string>;
  onViewChange: (view: "chat" | "results") => void;
  onPageChange: (page: number) => void;
  onSend: (message: string) => void;
  onRetry: () => void;
  onApplyFilters: (filters: PeopleFilters) => void;
  onViewAll: (filters: PeopleFilters) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onToggleSaved: (person: Person) => void;
  onOpenPerson: (person: Person) => void;
}) {
  const [draft, setDraft] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const { record } = useQueryStore("people_query");

  // Follow the answer as it streams.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = (prompt: string) => {
    const question = prompt.trim();
    if (!question) return;
    onSend(question);
    setDraft("");
  };

  // Record each completed exchange so the Recent | Saved cards show real chips.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || !last.isComplete || last.error) return;
    const question = messages[messages.length - 2];
    if (!question || question.role !== "user") return;
    record({
      query: question.text,
      chips: last.chips.map((chip) => ({ label: chip.label, value: chip.value })),
      payload: last.filters,
    });
  }, [messages, record]);

  if (messages.length === 0) {
    return (
      <AiSearchPanel
        title="Find anything"
        subtitle="Describe the contacts you're looking for in simple terms and we'll find and answer questions about them."
        placeholder="e.g., Verified marketing managers at AI companies in Germany..."
        kind="people_query"
        kindLabel="People query"
        isBusy={isStreaming}
        defaultTab="recent"
        onSubmit={submit}
        onSelectQuery={(entry) => {
          if (entry.payload) onApplyFilters(entry.payload as PeopleFilters);
          submit(entry.query);
        }}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(resultsTotal / pageSize));

  return (
    <div className="flex h-full min-h-[600px] flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      <div className="flex items-center gap-1 border-b border-slate-200 p-2 dark:border-[#22304A]">
        {(["chat", "results"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewChange(mode)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
              view === mode
                ? "bg-slate-900 text-white dark:bg-white dark:text-[#0B1220]"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#16233A] dark:hover:text-white"
            )}
          >
            {mode === "results" ? `Results (${resultsTotal.toLocaleString()})` : "Chat"}
          </button>
        ))}
      </div>

      {view === "chat" ? (
        <>
          <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((message) => (
              <PeopleMessage
                key={message.id}
                message={message}
                savedIds={savedIds}
                selectedIds={selectedIds}
                isStreaming={isStreaming}
                onApplyFilters={onApplyFilters}
                onViewAll={onViewAll}
                onRetry={onRetry}
                onToggleSelect={onToggleSelect}
                onToggleSaved={onToggleSaved}
                onOpenPerson={onOpenPerson}
              />
            ))}
          </div>
          {/* Composer pinned to the bottom. */}
          <CompactSearchBar
            value={draft}
            placeholder="Ask a follow-up about these contacts..."
            kind="people_query"
            kindLabel="People query"
            isBusy={isStreaming}
            onChange={setDraft}
            onSubmit={submit}
            onClear={() => setDraft("")}
            onSelectQuery={(entry) => submit(entry.query)}
            className="order-last"
          />
        </>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          <PeopleBulkToolbar
            selectedCount={selectedIds.size}
            totalCount={results.length}
            allSelected={results.length > 0 && results.every((person) => selectedIds.has(person.id))}
            onToggleSelectAll={onToggleSelectAll}
            onVerifyEmails={() => undefined}
            onAddToSequence={() => undefined}
            onMerge={() => undefined}
          />
          <PeopleResultsTable
            people={results}
            selectedIds={selectedIds}
            savedIds={savedIds}
            isLoading={isLoadingResults}
            skeletonRows={10}
            onToggleSelect={onToggleSelect}
            onToggleSaved={onToggleSaved}
            onOpenPerson={onOpenPerson}
          />
          <div className="flex items-center justify-between gap-3 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#22304A] dark:bg-[#0B1220]">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-[6px] border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-700 transition-colors disabled:cursor-not-allowed disabled:text-slate-300 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-[#E5E7EB] dark:disabled:text-slate-600"
            >
              Prev
            </button>
            <span className="text-[12px] font-medium text-slate-600 dark:text-[#E5E7EB]">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-[6px] border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-700 transition-colors disabled:cursor-not-allowed disabled:text-slate-300 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-[#E5E7EB] dark:disabled:text-slate-600"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Note:** `CompactSearchBar` is placed after the thread in DOM order and pinned by flex layout, not by `order-last` alone — remove the `className="order-last"` if `tsc` or the visual check shows it fighting the flex column. The thread has `flex-1 overflow-y-auto`, so the bar naturally sits at the bottom.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings.

- [ ] **Step 5: Commit**

```bash
git add components/people/use-people-chat.ts components/people/people-message.tsx components/people/people-chat-panel.tsx
git commit -m "feat(people): add the streaming chat hook, message and panel"
```

---

### Task 14: Detail slide-over

**Files:**
- Create: `components/people/people-detail-slideover.tsx`

**Interfaces:**
- Consumes: `Person` (Task 1); `VERIFICATION_LABELS`, `SOURCE_LABELS` (Task 1).
- Produces: `PeopleDetailSlideover(props: { person: Person | null; isSaved: boolean; onClose: () => void; onToggleSaved: (person: Person) => void; onFindSimilar: (person: Person) => void; })`

**Requirements from the spec:** replaces the docked third column; carries Add to CRM, Add to Sequence, work email, country, phone, title, LinkedIn URL and the Source / Fetched / Confidence block; dismissed by Escape, backdrop click or the close button; **focus is trapped while open and restored to the originating row on close**.

- [ ] **Step 1: Write `components/people/people-detail-slideover.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Globe, Phone, Sparkles, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_LABELS, VERIFICATION_LABELS } from "@/lib/people/vocabulary";
import type { Person } from "@/types/people";

/**
 * The person detail, as a right-hand slide-over rather than a permanently
 * docked third column — the two-panel layout must match Companies, so detail
 * has to float above it.
 *
 * Focus is trapped while open and restored to whatever opened it, so keyboard
 * users are not dumped at the top of the document on close.
 */
export function PeopleDetailSlideover({
  person,
  isSaved,
  onClose,
  onToggleSaved,
  onFindSimilar,
}: {
  person: Person | null;
  isSaved: boolean;
  onClose: () => void;
  onToggleSaved: (person: Person) => void;
  onFindSimilar: (person: Person) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!person) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      // Trap: cycle focus inside the panel.
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [person, onClose]);

  return (
    <AnimatePresence>
      {person ? (
        <>
          <motion.button
            type="button"
            aria-label="Close contact details"
            tabIndex={-1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 cursor-default bg-slate-900/30 backdrop-blur-[2px] dark:bg-black/50"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${person.firstName} ${person.lastName} details`}
            tabIndex={-1}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[420px] flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl outline-none dark:border-[#22304A] dark:bg-[#111B2E]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5 dark:border-[#22304A]">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-[56px] shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-100 shadow-sm dark:border-[#22304A] dark:bg-[#16233A]">
                  <span className="text-[22px] font-bold text-slate-700 dark:text-slate-300">
                    {person.firstName[0]}
                    {person.lastName[0]}
                  </span>
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-[20px] font-bold leading-tight text-slate-900 dark:text-white">
                    {person.firstName} {person.lastName}
                  </h2>
                  <span className="mt-1 inline-block rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-400">
                    {person.company}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={isSaved ? "Remove from Saved People" : "Save person"}
                  onClick={() => onToggleSaved(person)}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-amber-500 dark:hover:bg-[#22304A]"
                >
                  <Star className={cn("size-4", isSaved && "fill-amber-400 text-amber-400")} />
                </button>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#22304A] dark:hover:text-slate-300"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-200 p-5 dark:border-[#22304A]">
              <button className="h-8 w-full rounded-[6px] bg-indigo-600 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400">
                Add to CRM
              </button>
              <button className="h-8 w-full rounded-[6px] border border-slate-300 bg-white text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-[#E5E7EB] dark:hover:bg-[#16233A]">
                Add to Sequence
              </button>
            </div>

            <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-[#22304A]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Work email
                  </p>
                  <p className="mb-1 truncate text-[13px] font-semibold text-slate-900 dark:text-[#E5E7EB]" title={person.workEmail}>
                    {person.workEmail}
                  </p>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold",
                      person.verification === "verified"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : person.verification === "needs_verification"
                          ? "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
                          : "border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
                    )}
                  >
                    {VERIFICATION_LABELS[person.verification]}
                    <BadgeCheck className="size-2.5" />
                  </span>
                </div>
                <div className="border-l border-slate-100 pl-3 dark:border-[#22304A]">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Country
                  </p>
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900 dark:text-[#E5E7EB]">
                    <Globe className="size-3.5 text-indigo-500" />
                    {person.country}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Phone
                  </p>
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900 dark:text-[#E5E7EB]">
                    <Phone className="size-3.5 text-slate-400" />
                    {person.phone ?? "—"}
                  </p>
                </div>
                <div className="border-l border-slate-100 pl-3 dark:border-[#22304A]">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Title
                  </p>
                  <p className="text-[13px] font-semibold leading-tight text-slate-900 dark:text-[#E5E7EB]">
                    {person.title}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  LinkedIn URL
                </p>
                <div className="flex h-8 w-full items-center rounded-[6px] border border-slate-200 bg-slate-50 px-2.5 dark:border-[#22304A] dark:bg-[#0B1220]">
                  {person.linkedinUrl ? (
                    <a
                      href={person.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-[12px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {person.linkedinUrl}
                    </a>
                  ) : (
                    <span className="text-[12px] font-medium text-slate-400 dark:text-slate-500">
                      Not provided
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-1.5 rounded-[6px] border border-slate-200 bg-slate-50 p-2.5 text-[12px] dark:border-[#22304A] dark:bg-[#0B1220]">
                <div className="font-medium text-slate-500 dark:text-slate-400">Source</div>
                <div className="font-semibold text-slate-900 dark:text-[#E5E7EB]">
                  {SOURCE_LABELS[person.source] ?? person.source}
                </div>
                <div className="font-medium text-slate-500 dark:text-slate-400">Fetched</div>
                <div className="font-semibold text-slate-900 dark:text-[#E5E7EB]">
                  {person.fetchedAt}
                </div>
                <div className="font-medium text-slate-500 dark:text-slate-400">Confidence</div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400">
                  {person.confidence}%
                </div>
              </div>

              <button
                type="button"
                onClick={() => onFindSimilar(person)}
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-[6px] border border-indigo-200 bg-white text-[12px] font-bold text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-[#16233A] dark:text-indigo-400 dark:hover:bg-[#22304A]"
              >
                <Sparkles className="size-3.5" />
                Find similar
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings.

- [ ] **Step 3: Commit**

```bash
git add components/people/people-detail-slideover.tsx
git commit -m "feat(people): add the person detail slide-over with focus trapping"
```

---

### Task 15: The page shell

**Files:**
- Modify: `components/crm/people-section.tsx` (full rewrite — the existing 462 lines of mock go)

**Interfaces:**
- Consumes: everything from Tasks 1–14.
- Produces: `PeopleSection()` — already imported by `components/crm/section-router.tsx:12` and rendered at `:70`. **The export name must not change.**

**What this file owns, and nothing else:** the header, the `People | Saved People` tabs, the data-source strip, the two-column grid, the URL as the source of truth, the responsive Filters drawer, and the slide-over's open/closed state. All rendering lives in the components from Tasks 11–14.

**The grid must be exactly `xl:grid-cols-[360px_1fr] 2xl:grid-cols-[390px_1fr]`** — that is acceptance criterion 1, copied from `components/crm/companies-section.tsx:1166`.

- [ ] **Step 1: Delete the mock and write the new shell**

Replace the entire contents of `components/crm/people-section.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Bookmark, ChevronDown, Filter, UploadCloud, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PeopleFilterSidebar } from "@/components/people/people-filter-sidebar";
import { PeopleChatPanel } from "@/components/people/people-chat-panel";
import { PeopleResultsTable } from "@/components/people/people-results-table";
import { PeopleBulkToolbar } from "@/components/people/people-bulk-toolbar";
import { PeopleDetailSlideover } from "@/components/people/people-detail-slideover";
import { usePeopleChat } from "@/components/people/use-people-chat";
import { useSavedPeople } from "@/lib/people/saved-store";
import { paramsToFilters, serializePeopleQuery, type PeopleFacets } from "@/lib/people/filters";
import { SOURCE_LABELS } from "@/lib/people/vocabulary";
import {
  emptyPeopleFilters,
  type PeopleFilters,
  type PeopleStats,
  type Person,
} from "@/types/people";

/**
 * The People AI Explorer.
 *
 * A thin composition root: the URL query string is the single source of truth
 * for filters, so the rail and the chat cannot disagree — the rail writes to
 * it, a chat reply's "Apply filters" writes to it, and the chat reads it as
 * `activeFilters` on every send.
 *
 * Layout matches /app/companies exactly: xl:grid-cols-[360px_1fr].
 */

const EMPTY_FACETS: PeopleFacets = {
  titles: [], seniorities: [], departments: [], companies: [], locations: [],
  countries: [], headcounts: [], industries: [], keywords: [], buyingIntents: [],
  sources: [], verification: [],
};

const PAGE_SIZE = 25;

export function PeopleSection() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [filters, setFilters] = useState<PeopleFilters>(emptyPeopleFilters());
  const [tab, setTab] = useState<"people" | "saved">("people");
  const [view, setView] = useState<"chat" | "results">("chat");
  const [page, setPage] = useState(1);

  const [results, setResults] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<PeopleFacets>(EMPTY_FACETS);
  const [stats, setStats] = useState<PeopleStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openPerson, setOpenPerson] = useState<Person | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { saved, toggle: toggleSaved, isSaved } = useSavedPeople();
  const chat = usePeopleChat({ activeFilters: filters });

  // --- URL as the single source of truth -----------------------------------

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters(paramsToFilters(params));
    setTab(params.get("tab") === "saved" ? "saved" : "people");
    setView(params.get("view") === "results" ? "results" : "chat");
    const urlPage = Number(params.get("page") ?? "1");
    setPage(Number.isInteger(urlPage) && urlPage > 0 ? urlPage : 1);
    setIsHydrated(true);
  }, []);

  // history.replaceState rather than router.replace: this only needs to keep
  // the address bar shareable, and avoids re-running the RSC payload on every
  // checkbox click. Skipped until the URL has been read, so the first paint
  // cannot blank out an incoming shared link. (Same call as events-section.tsx.)
  useEffect(() => {
    if (!isHydrated) return;
    const query = serializePeopleQuery(filters, {
      tab: tab === "saved" ? "saved" : "",
      view: view === "results" ? "results" : "",
      page: page > 1 ? String(page) : "",
    });
    window.history.replaceState(null, "", `${window.location.pathname}${query}`);
  }, [filters, tab, view, page, isHydrated]);

  // --- Data ----------------------------------------------------------------

  useEffect(() => {
    if (!isHydrated) return;
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const query = serializePeopleQuery(filters, {
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });
        const response = await fetch(`/api/people${query}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed (${response.status})`);

        const data = await response.json();
        if (cancelled) return;

        setResults(Array.isArray(data.results) ? data.results : []);
        setTotal(typeof data.total === "number" ? data.total : 0);
        setFacets(data.facets ?? EMPTY_FACETS);
        setStats(data.stats ?? null);
        setLoadError(null);
      } catch (error) {
        if ((error as Error).name === "AbortError" || cancelled) return;
        setLoadError("Unable to load contacts. Please refresh the page.");
        setResults([]);
        setTotal(0);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filters, page, isHydrated]);

  // --- Handlers ------------------------------------------------------------

  const applyFilters = useCallback((next: PeopleFilters) => {
    setFilters(next);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(emptyPeopleFilters());
    setPage(1);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const rows = tab === "saved" ? saved : results;

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((current) =>
      current.size === rows.length ? new Set() : new Set(rows.map((person) => person.id))
    );
  }, [rows]);

  const savedIds = useMemo(() => new Set(saved.map((person) => person.id)), [saved]);

  const lookalikeSeed = useMemo(
    () =>
      filters.lookalikeSeedId
        ? (results.find((person) => person.id === filters.lookalikeSeedId) ?? null)
        : null,
    [filters.lookalikeSeedId, results]
  );

  const headerCount = stats?.total ?? 0;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[24px] font-bold tracking-tight text-slate-900 dark:text-white">
            People
            <span className="text-[12px] font-medium tracking-normal text-slate-500 dark:text-slate-400">
              {headerCount.toLocaleString()} contacts
            </span>
          </h1>
          <p className="text-[13px] text-slate-900 dark:text-slate-400">
            Search contacts, verify emails, and move people into CRM workflows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Below 1024px the rail becomes a drawer behind this button. */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:hidden dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A]"
          >
            <Filter className="size-4" />
            Filters
          </button>
          <button className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A]">
            <UploadCloud className="size-4" />
            Import CSV/XLSX
          </button>
          <button className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A]">
            Export
            <ChevronDown className="size-4 text-slate-400" />
          </button>
        </div>
      </motion.div>

      {/* Tabs — same pill style as Companies | Saved Companies */}
      <div className="flex w-fit items-center gap-1 rounded-[12px] border border-slate-200 bg-white p-1 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
        {([
          { key: "people", label: "People", icon: Users },
          { key: "saved", label: "Saved People", icon: Bookmark },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-all",
              tab === key
                ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-[#0B1220]"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#16233A] dark:hover:text-white"
            )}
          >
            <Icon className="size-4" />
            {label}
            {key === "saved" && saved.length > 0 ? (
              <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white dark:bg-indigo-500">
                {saved.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Slim data-source strip, between the header and the two panels. */}
      <div className="flex flex-col items-center gap-6 rounded-[12px] border border-slate-200 bg-white px-5 py-3 shadow-sm md:flex-row dark:border-[#22304A] dark:bg-[#111B2E]">
        <div className="flex w-full flex-1 flex-col justify-center border-slate-200 md:border-r md:pr-6 dark:border-[#22304A]">
          <p className="mb-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
            Data source
          </p>
          <div className="flex items-center gap-2">
            <UploadCloud className="size-4 text-indigo-500" />
            <p className="truncate text-[14px] font-semibold text-slate-900 dark:text-white">
              {stats && stats.sources.length > 0
                ? stats.sources.map((source) => SOURCE_LABELS[source] ?? source).join(" / ")
                : "—"}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col justify-center border-slate-200 md:w-auto md:border-r md:pr-6 dark:border-[#22304A]">
          <p className="mb-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
            Last Fetched
          </p>
          <p className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-900 dark:text-white">
            <Activity className="size-3.5 text-emerald-500" />
            {stats?.lastFetchedAt || "—"}
          </p>
        </div>
        <div className="flex w-full flex-1 flex-col justify-center">
          <p className="mb-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400">
            Avg. Confidence
            <span className="ml-2 font-mono font-semibold text-slate-900 dark:text-white">
              {stats?.avgConfidence ?? 0}%
            </span>
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#16233A]">
            <div
              className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
              style={{ width: `${stats?.avgConfidence ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {loadError}
        </div>
      ) : null}

      {/* The Saved tab replaces BOTH columns — neither filters nor questions
          apply to a hand-curated list. */}
      {tab === "saved" ? (
        <div className="space-y-3">
          {saved.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
              <Bookmark className="size-12 text-slate-400 dark:text-slate-500" />
              <p className="mt-4 text-[18px] font-bold text-slate-900 dark:text-white">
                No saved people yet
              </p>
              <p className="mt-2 max-w-md text-[14px] text-slate-500 dark:text-slate-400">
                Save contacts from the results table to keep them here.
              </p>
            </div>
          ) : (
            <>
              <PeopleBulkToolbar
                selectedCount={selectedIds.size}
                totalCount={saved.length}
                allSelected={selectedIds.size === saved.length}
                onToggleSelectAll={toggleSelectAll}
                onVerifyEmails={() => undefined}
                onAddToSequence={() => undefined}
                onMerge={() => undefined}
              />
              <PeopleResultsTable
                people={saved}
                selectedIds={selectedIds}
                savedIds={savedIds}
                onToggleSelect={toggleSelect}
                onToggleSaved={toggleSaved}
                onOpenPerson={setOpenPerson}
              />
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[360px_1fr] 2xl:grid-cols-[390px_1fr]">
          {/* LEFT — hidden below xl, where it becomes the drawer below. */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="hidden flex-col xl:flex"
          >
            <PeopleFilterSidebar
              filters={filters}
              facets={facets}
              resultCount={total}
              lookalikeSeed={lookalikeSeed}
              onFiltersChange={applyFilters}
              onClear={clearFilters}
            />
          </motion.div>

          {/* RIGHT */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="flex flex-col"
          >
            <PeopleChatPanel
              messages={chat.messages}
              isStreaming={chat.isStreaming}
              view={view}
              results={results}
              resultsTotal={total}
              page={page}
              pageSize={PAGE_SIZE}
              isLoadingResults={isLoading}
              selectedIds={selectedIds}
              savedIds={savedIds}
              onViewChange={setView}
              onPageChange={setPage}
              onSend={(message) => void chat.send(message)}
              onRetry={() => void chat.retry()}
              onApplyFilters={applyFilters}
              onViewAll={(next) => {
                applyFilters(next);
                setView("results");
              }}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onToggleSaved={toggleSaved}
              onOpenPerson={setOpenPerson}
            />
          </motion.div>
        </div>
      )}

      {/* Filters drawer, below xl. */}
      {isDrawerOpen ? (
        <>
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-slate-900/30 backdrop-blur-[2px] xl:hidden dark:bg-black/50"
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-0 top-0 z-50 h-full w-full max-w-[360px] overflow-y-auto bg-white p-3 shadow-2xl xl:hidden dark:bg-[#0B1220]"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-bold text-slate-900 dark:text-white">Filters</span>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-[#22304A]"
              >
                <X className="size-4" />
              </button>
            </div>
            <PeopleFilterSidebar
              filters={filters}
              facets={facets}
              resultCount={total}
              lookalikeSeed={lookalikeSeed}
              onFiltersChange={applyFilters}
              onClear={clearFilters}
            />
          </motion.div>
        </>
      ) : null}

      <PeopleDetailSlideover
        person={openPerson}
        isSaved={openPerson ? isSaved(openPerson.id) : false}
        onClose={() => setOpenPerson(null)}
        onToggleSaved={toggleSaved}
        onFindSimilar={(person) => {
          applyFilters({ ...filters, lookalikeSeedId: person.id });
          setOpenPerson(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Lock body scroll while the drawer is open**

The spec requires a body-scroll lock on the drawer. Add this effect alongside the others in `PeopleSection`:

```tsx
  // The drawer overlays the page; letting the body scroll behind it makes the
  // rail feel detached on touch devices.
  useEffect(() => {
    if (!isDrawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isDrawerOpen]);
```

- [ ] **Step 3: Verify the mock is gone**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings.

Confirm no hardcoded contact count survives anywhere in the component tree:

Run: `git grep -n "2,418" -- components/ || echo "clean"`
Expected: `clean`

Run: `git grep -n "contactsList" -- components/ || echo "clean"`
Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add components/crm/people-section.tsx
git commit -m "feat(people): rewrite the People page as a two-panel Explorer over the real API"
```

---

### Task 16: Acceptance verification

**Files:** none created. This task runs the checks and fixes whatever they surface.

**Do not mark this task complete on the basis of expected output. Run each command and read what it actually prints.**

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: every suite passes, including the untouched `tests/integration/event-filters.test.ts`.

- [ ] **Step 2: Types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings.

- [ ] **Step 3: Start the app**

Run: `npm run dev`
Open `http://localhost:3000/app/people`.

(The CRM requires a signed-in session. If the page redirects, sign in at `/sign-in` as `demo@prismconnex.com` — the seeded user, per CLAUDE.md.)

- [ ] **Step 4: Walk the spec's acceptance criteria**

Check each one in the browser and record the result. Any failure is a bug to fix, not a note to file.

1. Filters left / chat right; the grid is `xl:grid-cols-[360px_1fr]`, visually matching `/app/companies` side by side.
2. The header badge, data-source strip and every facet count come from `/api/people`. The string `2,418` appears in no component (verified by grep in Task 15).
3. Ask *"verified marketing managers in Germany"*. It streams an answer, shows `Title contains: Marketing Manager`, `Verification: Verified`, `Country: Germany` as chips, and renders matching rows — **with `ANTHROPIC_API_KEY` unset**. Test this explicitly by commenting the key out of `.env.local` and restarting the dev server. Restore it afterwards.
4. `Apply filters` ticks the left rail; changing the rail changes what the next message sends as `activeFilters`; both are reflected in the URL.
5. `View all N results` switches the right panel to the paginated Results view and back, chat thread intact.
6. Clicking a row opens the slide-over; Escape closes it and focus returns to the originating row.
7. Starring a row moves it into `Saved People`, which survives a page reload.
8. Below 1024px the rail is a drawer behind the header's Filters button, and the chat is full width. (Resize to ~900px.)
9. The page is correct in Light, Dark and System — toggle all three.
10. Copy a filtered URL into a new tab: the rail, tab, view and page all restore.

- [ ] **Step 5: Check the seed did not bloat the repo**

Run: `git status --short`
Expected: clean, apart from anything you are about to commit. `data/people-seed.json` should already be committed from Task 2 and must not appear as modified — if it does, the generator is not deterministic and that is a bug.

- [ ] **Step 6: Confirm the deleted routes were left alone**

Run: `git status --short -- app/api/ai app/api/companies/ask app/api/events/search`
Expected: the same four ` D ` deletions that were present before this work started. Nothing restored, nothing staged.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix(people): address acceptance-pass findings"
```

If nothing needed fixing, skip this step rather than making an empty commit.

---

## Plan Self-Review

Run against the spec after writing; findings already fixed inline.

**Spec coverage.** Every section maps to a task: Data → 2; Filters (14 groups) → 12; Logic modules → 1, 2, 3, 4, 5, 6, 7, 10; API → 8, 9; UI shell → 15; new components → 11, 12, 13, 14; Saved People tab → 10 (store) + 15 (tab); Import/Export as presentational → 15; detail slide-over → 14; State → 15; Edge cases → 9 (empty/rate-limit/LLM-failure), 13 (retry/interrupted), 11 (empty table), 15 (load failure); Responsive & theming → 15 (drawer) + all components (paired tokens); Testing → the five specced files plus `people-vocabulary`, `people-chips`, `people-answer`, `people-saved-store`; Constraints → Global Constraints; Acceptance → 16.

**Gaps found and closed while reviewing:**
- The spec's `lib/people/data.ts` was specced as "loader + memoized facet indexes", but facet *counting* depends on active filters, so it cannot be memoised there. Facets live in `filters.ts` (Task 3) and `data.ts` memoises only the vocabulary and stats. Recorded here rather than left as a silent divergence.
- `FacetOptionList` renders `option.value` verbatim, which would leak `licensed_dataset` into the Data Source and Buying Intent groups. Task 12 calls this out and routes those two groups through the inline button list instead of adding a prop to the shared file.
- The chat stream's fallback logic double-emitted the templated answer when the generator threw before yielding. Task 9 Step 3 carries the corrected block.

**Type consistency.** `PeopleFilters` list keys are `string[]` throughout; `PeopleFacets` is keyed by `PeopleFilterListKey | 'verification'` and constructed identically in Task 3, consumed in Tasks 12 and 15 (`EMPTY_FACETS` has all twelve keys). `PeopleFilterChip` is used by name in Tasks 4, 9 and 13. `PeopleChatEvent` is produced in Task 9 and consumed in Task 13. `Person` is unchanged from Task 1 everywhere. `PeopleResultsTable`'s prop list is identical at all three call sites (Tasks 13 ×2, 15 ×1).

**Placeholders.** None. Every code step carries complete source; the two "Note:" blocks in Tasks 12 and 13 give the exact replacement code rather than describing it.


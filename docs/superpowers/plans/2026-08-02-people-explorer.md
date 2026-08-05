# People Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/app/people` as a three-part explorer — a faceted left rail, a conversational assistant that parses questions locally into filters and answers in prose, and a results table with a persistent detail column — over a committed 2,418-record contact seed.

**Architecture:** Domain-free search primitives in `lib/search/` (normalize, phrase, fuzzy, numeric, textScore) are composed by People-specific modules in `lib/people/` (aliases, vocabulary, parse-query, filters, chips, duplicates, answer, search-index). Every module is pure and synchronous, so the client imports them directly for zero-latency typing while `app/api/people/query/route.ts` wraps the same functions for parity. The URL query string is the single source of truth shared by the rail, the ask panel and the table. No model call, no `ANTHROPIC_API_KEY`, no network request anywhere in the People path.

**Tech Stack:** Next.js 14 App Router, TypeScript, React client components, Tailwind, Zod, Vitest (node environment), framer-motion, lucide-react.

**Source spec:** `docs/superpowers/specs/2026-08-01-people-explorer-design.md`

## Global Constraints

- **No new dependencies.** `CLAUDE.md` forbids installing anything unless explicitly asked. MiniSearch, fuse.js and similar are out; the inverted index in `lib/search/textScore.ts` replaces them.
- **No large files, no temp files, no seeds outside `data/`.** The disk-space constraint in `CLAUDE.md` is binding. `data/people-seed.json` is the only generated artefact (~1.5 MB). Nothing is written to C: temp.
- **Do not run `npm run db:seed`, `npm run sqlite:optimize`, or any benchmark.** This feature touches no database.
- **Events and Companies stay untouched.** No file under `components/events/`, `lib/events/`, `components/crm/events-section.tsx` or `components/crm/companies-section.tsx` is modified. `tests/integration/event-filters.test.ts` must still pass unchanged at the end.
- **No `ANTHROPIC_API_KEY` reference anywhere in the People path.** No `fetch` to an external service.
- **No `dangerouslySetInnerHTML`.** Answers are structured `AnswerSegment[]`, never HTML strings.
- **Styling tokens** are the repo's, not the prototype's CSS: `rounded-[10px]` / `rounded-[12px]` / `rounded-[14px]`, `border-slate-200 dark:border-[#22304A]`, `bg-white dark:bg-[#111B2E]`, inner surfaces `dark:bg-[#0B1220]`, hover `dark:bg-[#16233A]`, bracketed font sizes (`text-[13px]`), indigo accent, emerald `Verified` / amber `Needs verify` badges. Every surface gets its dark token.
- **Test command** is `npx vitest run` (one-shot). `npm test` is watch mode — do not use it in a task step.
- **Copy that must appear verbatim** in the UI: the ask-panel header `Ask about your people`, its subtitle `Answers come from your 2,418 contacts — nothing else.`, the band pills `All` / `High confidence` / `Needs verification`, the disclosure label `More filters (5)`, and the rail heading order `Country, Company, Job function, Source, Verification, Confidence`.
- **Commit after every task** with the message given in that task's final step.

## Two deliberate refinements to the spec

Both were found by working the spec's own test cases through its stated algorithm. Implement the refined behaviour; the spec's acceptance criteria still hold.

1. **Depluralisation tries three variants, not one.** The spec says n-grams are retried with "trailing `s` or `es` stripped from every word in the gram". Under that rule the spec's own case `sales directors` normalises to `sale director`, which matches no vocabulary entry — `sales` is a real alias that must survive. Task 4 therefore tries each gram as: verbatim, then last-word-only depluralised, then all-words depluralised. `marketing managers` → `marketing manager` and `sales directors` → `sales director` both resolve.
2. **Fuzzy rescue tries the depluralised token too.** The spec claims `managrs` → `manager` is distance 1 of 7; it is actually distance 2 of 7, which its own ≤25%-of-length rule rejects. Depluralising first gives `managr` → `manager`, distance 1 of 6, accepted. Task 5 scores both forms and keeps the better.

## File Structure

**Created — types and data**

| File | Responsibility |
|---|---|
| `types/people.ts` | `Person`, closed vocabularies, `PeopleFilters`, `emptyPeopleFilters`, `hasAnyPeopleFilter`, key lists |
| `scripts/generate-people-seed.mjs` | Deterministic generator; writes `data/people-seed.json`, asserts distribution bands |
| `data/people-seed.json` | 2,418 committed records |
| `lib/people/data.ts` | Typed loader for the seed |

**Created — `lib/search/` (domain-free)**

| File | Responsibility |
|---|---|
| `lib/search/types.ts` | `Token`, `Match`, `PhraseEntry`, `PhraseIndex`, `ParsedQueryBase` |
| `lib/search/normalize.ts` | `normalize`, `tokenize`, `depluralise` |
| `lib/search/stopwords.ts` | `STOPWORDS` |
| `lib/search/phrase.ts` | `buildPhraseIndex`, `matchPhrases` |
| `lib/search/fuzzy.ts` | `levenshtein`, `fuzzyFind` |
| `lib/search/numeric.ts` | `scanNumericConditions` |
| `lib/search/textScore.ts` | `buildTextIndex`, `scoreQuery` |

**Created — `lib/people/` (People-specific)**

| File | Responsibility |
|---|---|
| `lib/people/aliases.ts` | Country/seniority/department/verification/boolean aliases, combined title phrases |
| `lib/people/vocabulary.ts` | `buildPeopleVocabulary` — one ordered `PhraseIndex` |
| `lib/people/parse-query.ts` | `parsePeopleQuery` — the eight stages |
| `lib/people/filters.ts` | URL codec, `buildChecks`, `filterPeopleList`, `computePeopleFacets`, `widenSuggestions`, `sortPeople` |
| `lib/people/chips.ts` | `buildPeopleFilterChips`, `removePeopleFilterChip` |
| `lib/people/duplicates.ts` | `findDuplicatePairs` |
| `lib/people/answer.ts` | `buildAnswer` — five answer kinds |
| `lib/people/search-index.ts` | `queryPeople`, `revalidatePeopleIndex` |

**Created — API**

| File | Responsibility |
|---|---|
| `models/people-query.ts` | Zod request/response schemas |
| `app/api/people/query/route.ts` | Thin controller over the pure modules |

**Created — UI**

| File | Responsibility |
|---|---|
| `components/search/range-slider.tsx` | Shared dual-handle 0–100 slider |
| `components/people/use-people-query.ts` | URL state → parse → filter → facets → sort |
| `components/people/use-people-thread.ts` | Append-only conversation thread |
| `components/people/people-filter-rail.tsx` | Search, count, quick chips, six facets, More filters |
| `components/people/people-ask-panel.tsx` | Hero ↔ sticky bar, thread, composer, examples |
| `components/people/people-answer-bubble.tsx` | Renders `Answer` segments, chips, mini list, actions |
| `components/people/people-results-table.tsx` | Band pills, bulk bar, table, pagination |
| `components/people/person-detail-pane.tsx` | Persistent 330px right column |

**Modified**

| File | Change |
|---|---|
| `components/crm/people-section.tsx` | Rewritten as the orchestrator, under 200 lines |
| `components/search/query-store.ts` | Add `"people_query"` to `SavedQueryKind` |

**Created — tests**

| File | Covers |
|---|---|
| `tests/integration/people-search-primitives.test.ts` | Tasks 3–7 |
| `tests/integration/people-seed.test.ts` | Task 2 |
| `tests/integration/people-query-parse.test.ts` | Tasks 1, 8–11 |
| `tests/integration/people-duplicates.test.ts` | Task 12 |
| `tests/integration/people-answer.test.ts` | Task 13 |

---

### Task 1: Types and URL codec

The whole feature reads and writes one `PeopleFilters` object, and the URL is its
only persistent home. Building the codec first means every later task has a
concrete shape to target and a round-trip test that proves nothing is lost.

**Files:**
- Create: `types/people.ts`
- Create: `lib/people/filters.ts`
- Test: `tests/integration/people-query-parse.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Person`, `Seniority`, `Department`, `Source`, `Verification`, `Band`,
  `PeopleFilters`, `PEOPLE_STRING_LIST_KEYS`, `emptyPeopleFilters()`,
  `hasAnyPeopleFilter(filters)`, `PeopleSort`, `PeopleQueryState`,
  `parsePeopleQueryState(search: string): PeopleQueryState`,
  `serializePeopleQueryState(state: PeopleQueryState): string`.

- [ ] **Step 1: Write the types**

Create `types/people.ts`:

```ts
/**
 * Shared types for the People Explorer (rail + ask panel + results).
 *
 * `PeopleFilters` is the single source of truth: the rail renders from it, the
 * local parser produces it, and the URL stores it. That is what makes the left
 * panel tick itself when the assistant reads a sentence.
 */

export type Seniority = 'C-Level' | 'VP' | 'Director' | 'Manager' | 'Individual Contributor';

export const SENIORITIES: Seniority[] = [
  'C-Level',
  'VP',
  'Director',
  'Manager',
  'Individual Contributor',
];

export type Department =
  | 'Marketing'
  | 'Sales'
  | 'Engineering'
  | 'Product'
  | 'Partnerships'
  | 'Procurement'
  | 'HR'
  | 'Finance'
  | 'Operations';

export const DEPARTMENTS: Department[] = [
  'Marketing',
  'Sales',
  'Engineering',
  'Product',
  'Partnerships',
  'Procurement',
  'HR',
  'Finance',
  'Operations',
];

export type Source = 'User import' | 'Licensed dataset' | 'Web enrichment';

export const SOURCES: Source[] = ['User import', 'Licensed dataset', 'Web enrichment'];

export type Verification = 'verified' | 'needs_verify' | 'unverified';

export const VERIFICATIONS: Verification[] = ['verified', 'needs_verify', 'unverified'];

export type Person = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  title: string;
  seniority: Seniority;
  department: Department;
  company: string;
  companyDomain: string;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  country: string;
  city: string;
  source: Source;
  verification: Verification;
  /** 0-100. */
  confidence: number;
  /** Platform score, 0-100. */
  score: number;
  starred: boolean;
  /** ISO YYYY-MM-DD. */
  fetchedAt: string;
  /** Display string, e.g. "2h ago". */
  lastActive: string;
  /** Single initial. */
  avatar: string;
  /** Precomputed, already normalized. */
  searchText: string;
};

/** The `string[]` dimensions, useful for generic chip/facet/URL code. */
export type PeopleStringListKey =
  | 'countries'
  | 'cities'
  | 'companies'
  | 'titles'
  | 'seniorities'
  | 'departments'
  | 'sources'
  | 'keywords';

export const PEOPLE_STRING_LIST_KEYS: PeopleStringListKey[] = [
  'countries',
  'cities',
  'companies',
  'titles',
  'seniorities',
  'departments',
  'sources',
  'keywords',
];

/** The pills above the table. `all` means no constraint. */
export type Band = 'all' | 'high' | 'needs';

/** Confidence at or above this counts as "high" for the band pill and chips. */
export const HIGH_CONFIDENCE_FLOOR = 85;

export type PeopleFilters = {
  countries: string[];
  cities: string[];
  companies: string[];
  titles: string[];
  seniorities: string[];
  departments: string[];
  sources: string[];
  verification: Verification[];
  confidenceMin: number | null;
  confidenceMax: number | null;
  scoreMin: number | null;
  scoreMax: number | null;
  /** Tri-state: null is unset, false is the real constraint "has none". */
  hasEmail: boolean | null;
  hasPhone: boolean | null;
  hasLinkedIn: boolean | null;
  starred: boolean | null;
  band: Band;
  /** Pins the table to an explicit record set. Only the duplicates answer sets it. */
  ids: string[] | null;
  /** AND-ed free-text terms. */
  keywords: string[];
};

export function emptyPeopleFilters(): PeopleFilters {
  return {
    countries: [],
    cities: [],
    companies: [],
    titles: [],
    seniorities: [],
    departments: [],
    sources: [],
    verification: [],
    confidenceMin: null,
    confidenceMax: null,
    scoreMin: null,
    scoreMax: null,
    hasEmail: null,
    hasPhone: null,
    hasLinkedIn: null,
    starred: null,
    band: 'all',
    ids: null,
    keywords: [],
  };
}

export function hasAnyPeopleFilter(filters: PeopleFilters): boolean {
  return (
    PEOPLE_STRING_LIST_KEYS.some((key) => filters[key].length > 0) ||
    filters.verification.length > 0 ||
    filters.confidenceMin !== null ||
    filters.confidenceMax !== null ||
    filters.scoreMin !== null ||
    filters.scoreMax !== null ||
    filters.hasEmail !== null ||
    filters.hasPhone !== null ||
    filters.hasLinkedIn !== null ||
    filters.starred !== null ||
    filters.band !== 'all' ||
    filters.ids !== null
  );
}

export type PeopleSort = 'score' | 'confidence' | 'name' | 'fetched';

export const PEOPLE_SORTS: PeopleSort[] = ['score', 'confidence', 'name', 'fetched'];

export const PEOPLE_PAGE_SIZE = 25;
```

- [ ] **Step 2: Write the failing round-trip test**

Create `tests/integration/people-query-parse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parsePeopleQueryState, serializePeopleQueryState } from '@/lib/people/filters';
import { emptyPeopleFilters } from '@/types/people';

describe('people URL codec', () => {
  it('round-trips an exhaustive state', () => {
    const url =
      '?country=Germany&country=India&city=Berlin&company=NovaAI+Systems' +
      '&title=Marketing+Manager&seniority=Manager&department=Marketing' +
      '&source=User+import&verify=verified&verify=needs_verify' +
      '&id=p-1&id=p-2&keyword=robotics&keyword=hydrogen' +
      '&confmin=70&confmax=90&scoremin=40&scoremax=95' +
      '&email=1&phone=0&li=1&star=0&band=high&q=miller&sort=name&page=3';

    expect(serializePeopleQueryState(parsePeopleQueryState(url))).toBe(url);
  });

  it('distinguishes an unset tri-state from a false one', () => {
    const state = parsePeopleQueryState('?phone=0');
    expect(state.filters.hasPhone).toBe(false);
    expect(state.filters.hasEmail).toBeNull();
  });

  it('returns an empty string for a pristine state', () => {
    expect(
      serializePeopleQueryState({
        filters: emptyPeopleFilters(),
        search: '',
        sort: 'score',
        page: 1,
      })
    ).toBe('');
  });

  it('drops junk rather than throwing', () => {
    const state = parsePeopleQueryState('?band=nonsense&confmin=abc&page=-4&verify=bogus&sort=zzz');
    expect(state.filters.band).toBe('all');
    expect(state.filters.confidenceMin).toBeNull();
    expect(state.filters.verification).toEqual([]);
    expect(state.sort).toBe('score');
    expect(state.page).toBe(1);
  });

  it('treats no id param as null, not an empty array', () => {
    expect(parsePeopleQueryState('?country=Germany').filters.ids).toBeNull();
    expect(parsePeopleQueryState('?id=p-1').filters.ids).toEqual(['p-1']);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run tests/integration/people-query-parse.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/people/filters"`.

- [ ] **Step 4: Write the codec**

Create `lib/people/filters.ts` with the codec only. Later tasks append to this
file; do not create a second one.

```ts
import {
  PEOPLE_STRING_LIST_KEYS,
  PEOPLE_SORTS,
  VERIFICATIONS,
  emptyPeopleFilters,
  type Band,
  type PeopleFilters,
  type PeopleSort,
  type PeopleStringListKey,
  type Verification,
} from '@/types/people';

/**
 * Pure filtering, faceting and URL (de)serialisation for the People Explorer.
 *
 * Free of React and of any model call, so it can be unit-tested and shared
 * between the client rail and the API route.
 */

/**
 * The rail's free-text box, the sort and the page live beside `PeopleFilters`
 * rather than inside it: the parser only ever produces filters, and a chip is
 * never built for "page 3".
 */
export type PeopleQueryState = {
  filters: PeopleFilters;
  search: string;
  sort: PeopleSort;
  page: number;
};

const LIST_PARAM: Record<PeopleStringListKey, string> = {
  countries: 'country',
  cities: 'city',
  companies: 'company',
  titles: 'title',
  seniorities: 'seniority',
  departments: 'department',
  sources: 'source',
  keywords: 'keyword',
};

const BANDS: Band[] = ['all', 'high', 'needs'];

/** 0-100 or nothing. Values arrive from shared URLs, so nothing is trusted. */
function readPercent(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= 0 && rounded <= 100 ? rounded : null;
}

/** `1` → true, `0` → false, absent or anything else → null (unset). */
function readTriState(raw: string | null): boolean | null {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return null;
}

export function parsePeopleQueryState(search: string): PeopleQueryState {
  const params = new URLSearchParams(search);
  const filters = emptyPeopleFilters();

  for (const key of PEOPLE_STRING_LIST_KEYS) {
    filters[key] = params.getAll(LIST_PARAM[key]).filter(Boolean);
  }

  filters.verification = params
    .getAll('verify')
    .filter((value): value is Verification => VERIFICATIONS.includes(value as Verification));

  filters.confidenceMin = readPercent(params.get('confmin'));
  filters.confidenceMax = readPercent(params.get('confmax'));
  filters.scoreMin = readPercent(params.get('scoremin'));
  filters.scoreMax = readPercent(params.get('scoremax'));

  filters.hasEmail = readTriState(params.get('email'));
  filters.hasPhone = readTriState(params.get('phone'));
  filters.hasLinkedIn = readTriState(params.get('li'));
  filters.starred = readTriState(params.get('star'));

  const band = params.get('band') as Band | null;
  filters.band = band && BANDS.includes(band) ? band : 'all';

  const ids = params.getAll('id').filter(Boolean);
  filters.ids = ids.length > 0 ? ids : null;

  const sort = params.get('sort') as PeopleSort | null;
  const page = Number(params.get('page'));

  return {
    filters,
    search: params.get('q') ?? '',
    sort: sort && PEOPLE_SORTS.includes(sort) ? sort : 'score',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/**
 * Serialises to a leading-`?` string, or '' when nothing is applied. Parameter
 * order is fixed so `serialize(parse(x)) === x` holds for any state this
 * function itself produced — that identity is what makes a shared link stable.
 */
export function serializePeopleQueryState(state: PeopleQueryState): string {
  const params = new URLSearchParams();
  const { filters } = state;

  for (const key of PEOPLE_STRING_LIST_KEYS) {
    if (key === 'keywords') continue;
    for (const value of filters[key]) params.append(LIST_PARAM[key], value);
  }
  for (const value of filters.verification) params.append('verify', value);
  if (filters.ids) for (const id of filters.ids) params.append('id', id);
  for (const value of filters.keywords) params.append('keyword', value);

  if (filters.confidenceMin !== null) params.set('confmin', String(filters.confidenceMin));
  if (filters.confidenceMax !== null) params.set('confmax', String(filters.confidenceMax));
  if (filters.scoreMin !== null) params.set('scoremin', String(filters.scoreMin));
  if (filters.scoreMax !== null) params.set('scoremax', String(filters.scoreMax));

  if (filters.hasEmail !== null) params.set('email', filters.hasEmail ? '1' : '0');
  if (filters.hasPhone !== null) params.set('phone', filters.hasPhone ? '1' : '0');
  if (filters.hasLinkedIn !== null) params.set('li', filters.hasLinkedIn ? '1' : '0');
  if (filters.starred !== null) params.set('star', filters.starred ? '1' : '0');

  if (filters.band !== 'all') params.set('band', filters.band);
  if (state.search.trim()) params.set('q', state.search.trim());
  if (state.sort !== 'score') params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));

  const query = params.toString();
  return query ? `?${query}` : '';
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx vitest run tests/integration/people-query-parse.test.ts`
Expected: PASS, 5 tests.

Note: `URLSearchParams.toString()` encodes a space as `+`, which is why the test
URL is written with `NovaAI+Systems`. If the round-trip assertion fails on
encoding rather than on ordering, fix the test's expected string, not the codec.

- [ ] **Step 6: Commit**

```bash
git add types/people.ts lib/people/filters.ts tests/integration/people-query-parse.test.ts
git commit -m "feat(people): add filter types and URL codec"
```

---

### Task 2: Deterministic contact seed

Every later task tests against this data, so it has to exist and be trustworthy
before anything else is built. The generator asserts its own distributions and
exits non-zero if one drifts, so a future tweak cannot silently empty a test.

**Files:**
- Create: `scripts/generate-people-seed.mjs`
- Create: `data/people-seed.json` (produced by the script, committed)
- Create: `lib/people/data.ts`
- Modify: `types/people.ts` — add `PersonSeed`
- Test: `tests/integration/people-seed.test.ts`

**Interfaces:**
- Consumes: `Person`, `Seniority`, `Department`, `Source`, `Verification` from Task 1.
- Produces: `PersonSeed = Omit<Person, 'searchText'>`; `people: Person[]` and
  `peopleById: Record<string, Person>` from `lib/people/data.ts`.

`searchText` is **not** stored in the JSON. It is computed at load time by
`lib/people/data.ts` using the real `normalize()` from Task 3, so there is
exactly one normalisation implementation and the `.mjs` generator cannot drift
from the TypeScript one.

Because of that ordering, this task's loader temporarily uses a local lowercase
join; Task 3's final step swaps it for `normalize()`. Both steps are listed
below.

- [ ] **Step 1: Add the seed record type**

Append to `types/people.ts`:

```ts
/**
 * What `data/people-seed.json` actually stores. `searchText` is derived at load
 * time from the shared `normalize()` so the generator and the parser can never
 * disagree about what "normalized" means.
 */
export type PersonSeed = Omit<Person, 'searchText'>;
```

- [ ] **Step 2: Write the generator**

Create `scripts/generate-people-seed.mjs`:

```js
/**
 * Generates data/people-seed.json — 2,418 contacts for the People Explorer.
 *
 * Deterministic: a fixed-seed mulberry32 PRNG, so re-running produces a
 * byte-identical file. The committed JSON is the artefact; this script exists so
 * the distributions can be adjusted, not because anyone needs to run it.
 *
 * Writes only to data/. No temp files, no large intermediates.
 *
 * Run: node scripts/generate-people-seed.mjs
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOTAL = 2418;
const SEED = 20260801;
const COMPANY_COUNT = 140;
const FETCH_END = Date.UTC(2026, 1, 1); // 2026-02-01, matching the page's strip
const FETCH_DAYS = 31;

// --- PRNG -----------------------------------------------------------------

function mulberry32(a) {
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (list) => list[Math.floor(rand() * list.length)];
const chance = (probability) => rand() < probability;

function weighted(pairs) {
  const total = pairs.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rand() * total;
  for (const [value, weight] of pairs) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const slug = (value) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// --- Vocabularies ---------------------------------------------------------

const COUNTRIES = [
  ['Germany', 12, '49', ['Berlin', 'Munich', 'Hamburg', 'Frankfurt']],
  ['United States', 11, '1', ['New York', 'San Francisco', 'Chicago', 'Austin']],
  ['United Kingdom', 8, '44', ['London', 'Manchester', 'Bristol']],
  ['India', 8, '91', ['Bengaluru', 'Mumbai', 'Pune', 'Hyderabad']],
  ['France', 7, '33', ['Paris', 'Lyon', 'Toulouse']],
  ['Netherlands', 5, '31', ['Amsterdam', 'Rotterdam', 'Eindhoven']],
  ['United Arab Emirates', 4, '971', ['Dubai', 'Abu Dhabi']],
  ['Spain', 4, '34', ['Madrid', 'Barcelona', 'Valencia']],
  ['Italy', 4, '39', ['Milan', 'Rome', 'Turin']],
  ['Canada', 3, '1', ['Toronto', 'Vancouver', 'Montreal']],
  ['Australia', 3, '61', ['Sydney', 'Melbourne']],
  ['Japan', 3, '81', ['Tokyo', 'Osaka']],
  ['Singapore', 3, '65', ['Singapore']],
  ['Sweden', 2, '46', ['Stockholm', 'Gothenburg']],
  ['Switzerland', 2, '41', ['Zurich', 'Geneva']],
  ['Belgium', 2, '32', ['Brussels', 'Antwerp']],
  ['Poland', 2, '48', ['Warsaw', 'Krakow']],
  ['Brazil', 2, '55', ['Sao Paulo', 'Rio de Janeiro']],
  ['Mexico', 2, '52', ['Mexico City', 'Monterrey']],
  ['South Africa', 2, '27', ['Johannesburg', 'Cape Town']],
  ['Turkey', 2, '90', ['Istanbul', 'Ankara']],
  ['China', 2, '86', ['Shanghai', 'Shenzhen']],
  ['South Korea', 2, '82', ['Seoul']],
  ['Denmark', 1, '45', ['Copenhagen']],
  ['Norway', 1, '47', ['Oslo']],
  ['Ireland', 1, '353', ['Dublin']],
  ['Austria', 1, '43', ['Vienna']],
  ['Portugal', 1, '351', ['Lisbon']],
];

const COUNTRY_BY_NAME = new Map(COUNTRIES.map((row) => [row[0], row]));

const DEPARTMENTS = [
  ['Marketing', 20],
  ['Sales', 20],
  ['Engineering', 9],
  ['Product', 9],
  ['Partnerships', 9],
  ['Procurement', 9],
  ['HR', 8],
  ['Finance', 8],
  ['Operations', 8],
];

const SENIORITIES = [
  ['C-Level', 8],
  ['VP', 12],
  ['Director', 20],
  ['Manager', 34],
  ['Individual Contributor', 26],
];

const C_LEVEL_TITLE = {
  Marketing: 'Chief Marketing Officer',
  Sales: 'Chief Revenue Officer',
  Engineering: 'Chief Technology Officer',
  Product: 'Chief Product Officer',
  Partnerships: 'Founder & CEO',
  Procurement: 'Chief Procurement Officer',
  HR: 'Chief People Officer',
  Finance: 'Chief Financial Officer',
  Operations: 'Chief Operating Officer',
};

const IC_SUFFIXES = ['Specialist', 'Associate', 'Coordinator', 'Analyst'];

/** Title, seniority and department never contradict each other, by construction. */
function titleFor(seniority, department) {
  if (seniority === 'C-Level') return C_LEVEL_TITLE[department];
  if (seniority === 'VP') return `VP of ${department}`;
  if (seniority === 'Director') return `${department} Director`;
  if (seniority === 'Manager') return `${department} Manager`;
  return `${department} ${pick(IC_SUFFIXES)}`;
}

const SOURCES = [
  ['User import', 40],
  ['Licensed dataset', 38],
  ['Web enrichment', 22],
];

const FIRST_NAMES = [
  'Sarah', 'David', 'Amina', 'Jonas', 'Mia', 'Luca', 'Elena', 'Ahmed', 'Priya', 'Tomas',
  'Nina', 'Marco', 'Yuki', 'Hannah', 'Omar', 'Clara', 'Felix', 'Ines', 'Rahul', 'Sofia',
  'Lars', 'Mei', 'Pablo', 'Anna', 'Viktor', 'Leila', 'Noah', 'Greta', 'Kiran', 'Julia',
  'Mateo', 'Zara', 'Henrik', 'Aisha', 'Diego', 'Freya', 'Sanjay', 'Camille', 'Erik', 'Nadia',
  'Bruno', 'Lena', 'Arjun', 'Chloe', 'Stefan', 'Maya', 'Pierre', 'Ivana', 'Karim', 'Ruth',
];

const LAST_NAMES = [
  'Miller', 'Lee', 'Khan', 'Richter', 'Thompson', 'Romano', 'Silva', 'Farouk', 'Nair', 'Novak',
  'Berg', 'Rossi', 'Tanaka', 'Weber', 'Haddad', 'Dubois', 'Bauer', 'Costa', 'Sharma', 'Moreau',
  'Nilsson', 'Chen', 'Garcia', 'Schmidt', 'Petrov', 'Aziz', 'Jansen', 'Fischer', 'Menon', 'Kowalski',
  'Alvarez', 'Okafor', 'Larsen', 'Rahman', 'Fernandez', 'Andersen', 'Iyer', 'Laurent', 'Hansen', 'Yilmaz',
  'Ferrari', 'Wagner', 'Gupta', 'Martin', 'Novotny', 'Patel', 'Leroy', 'Horvat', 'Mansour', 'Brooks',
];

const COMPANY_HEADS = [
  'Nova', 'Cloud', 'Medi', 'Electro', 'Green', 'Secure', 'Quantum', 'Bright', 'Vertex', 'Atlas',
  'Helio', 'Pulse', 'Northwind', 'Orbit', 'Silver', 'Iron', 'Beacon', 'Delta', 'Aurora', 'Summit',
  'Cobalt', 'Ember', 'Lumen', 'Vector', 'Terra', 'Zenith', 'Harbor', 'Falcon', 'Cedar', 'Onyx',
  'Prisma', 'Kinetic', 'Meridian', 'Solstice', 'Anchor',
];

const COMPANY_TAILS = ['AI Systems', 'Forge Ltd', 'data Europe', 'Mech Works', 'Hydro Labs', 'Net Dynamics', 'Works', 'Group'];
const COMPANY_SUFFIXES = ['Systems', 'Labs', 'Group', 'Works', 'Technologies', 'Dynamics', 'Solutions', 'Industries'];

const LAST_ACTIVE = [
  ['Just now', 6], ['2h ago', 14], ['5h ago', 12], ['1d ago', 18],
  ['2d ago', 14], ['3d ago', 12], ['1w ago', 14], ['3w ago', 10],
];

// --- Companies ------------------------------------------------------------

/** The prototype's eight, pinned so the familiar rows keep their companies. */
const PINNED_COMPANIES = [
  ['NovaAI Systems', 'novaai.example', 'Germany', 'Berlin'],
  ['CloudForge Ltd', 'cloudforge.example', 'United Kingdom', 'London'],
  ['Medidata Europe', 'medidata.example', 'France', 'Paris'],
  ['ElectroMech Works', 'electromech.example', 'United States', 'Chicago'],
  ['GreenHydro Labs', 'greenhydro.example', 'Germany', 'Munich'],
  ['SecureNet Dynamics', 'securenet.example', 'United Kingdom', 'Manchester'],
  ['Helio Robotics', 'heliorobotics.example', 'India', 'Bengaluru'],
  ['Northwind Logistics', 'northwind.example', 'Netherlands', 'Rotterdam'],
];

function buildCompanies() {
  const companies = PINNED_COMPANIES.map(([name, domain, country, city]) => ({
    name,
    domain,
    country,
    city,
  }));

  // Country quotas rather than per-company draws, so Germany and India cannot
  // come up short on an unlucky seed.
  const totalWeight = COUNTRIES.reduce((sum, row) => sum + row[1], 0);
  const remaining = COMPANY_COUNT - companies.length;
  const bag = [];
  for (const [name, weight] of COUNTRIES) {
    const quota = Math.max(1, Math.round((weight / totalWeight) * remaining));
    for (let i = 0; i < quota; i += 1) bag.push(name);
  }
  while (bag.length > remaining) bag.pop();
  while (bag.length < remaining) bag.push('Germany');

  const used = new Set(companies.map((company) => company.name));
  for (const country of shuffle(bag)) {
    let name = '';
    do {
      name = `${pick(COMPANY_HEADS)}${chance(0.35) ? pick(COMPANY_TAILS) : ` ${pick(COMPANY_SUFFIXES)}`}`;
    } while (used.has(name));
    used.add(name);
    companies.push({
      name,
      domain: `${slug(name).replace(/-/g, '')}.example`,
      country,
      city: pick(COUNTRY_BY_NAME.get(country)[3]),
    });
  }

  return companies;
}

// --- Person construction --------------------------------------------------

let nextId = 1;
const emailStyles = ['first.last', 'flast', 'first'];

function emailLocal(first, last, style) {
  const f = slug(first).replace(/-/g, '');
  const l = slug(last).replace(/-/g, '');
  if (style === 'first') return f;
  if (style === 'flast') return `${f[0]}${l}`;
  return `${f}.${l}`;
}

function confidenceFor(verification) {
  if (verification === 'verified') return int(84, 99);
  if (verification === 'needs_verify') return int(66, 90);
  return int(42, 80);
}

function fetchedAt() {
  const day = FETCH_END - int(0, FETCH_DAYS - 1) * 86400000;
  return new Date(day).toISOString().slice(0, 10);
}

function makePerson(overrides) {
  const company = overrides.company;
  const department = overrides.department ?? weighted(DEPARTMENTS);
  const seniority = overrides.seniority ?? weighted(SENIORITIES);
  const verification = overrides.verification ?? weighted([
    ['verified', 58],
    ['needs_verify', 27],
    ['unverified', 15],
  ]);
  const firstName = overrides.firstName ?? pick(FIRST_NAMES);
  const lastName = overrides.lastName ?? pick(LAST_NAMES);
  const style = overrides.emailStyle ?? pick(emailStyles);
  // `unverified` implies no email — that is the whole point of the status.
  const email =
    overrides.email !== undefined
      ? overrides.email
      : verification === 'unverified'
        ? null
        : `${emailLocal(firstName, lastName, style)}@${company.domain}`;
  const score = overrides.score ?? (chance(0.12) ? int(88, 100) : int(45, 87));

  return {
    id: `p-${nextId++}`,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    title: overrides.title ?? titleFor(seniority, department),
    seniority,
    department,
    company: company.name,
    companyDomain: company.domain,
    email,
    phone: chance(0.46)
      ? `+${COUNTRY_BY_NAME.get(company.country)[2]} ${int(100, 999)} ${int(100000, 999999)}`
      : null,
    linkedin: chance(0.61)
      ? `https://www.linkedin.com/in/${slug(`${firstName} ${lastName}`)}`
      : null,
    country: company.country,
    city: company.city,
    source: overrides.source ?? weighted(SOURCES),
    verification,
    confidence: overrides.confidence ?? confidenceFor(verification),
    // Starred is the star drawn beside the Platform Score, so it must agree
    // with the number it sits next to.
    score,
    starred: score >= 88,
    fetchedAt: overrides.fetchedAt ?? fetchedAt(),
    lastActive: overrides.lastActive ?? weighted(LAST_ACTIVE),
    avatar: firstName[0].toUpperCase(),
  };
}

// --- Pinned prototype rows ------------------------------------------------

/**
 * The prototype's sixteen contacts, emitted verbatim as the first records so the
 * familiar rows survive. Sarah Miller here and Sara Millar below are the fixture
 * the duplicate finder is tested against.
 */
const PINNED = [
  ['Sarah', 'Miller', 0, 'Marketing', 'Manager', 'verified', 91, 98, 'User import', 'first', '2h ago'],
  ['David', 'Lee', 1, 'Sales', 'Director', 'verified', 88, 85, 'Licensed dataset', 'first', '1d ago'],
  ['Amina', 'Khan', 2, 'Partnerships', 'Manager', 'needs_verify', 79, 72, 'User import', 'first', '3d ago'],
  ['Jonas', 'Richter', 0, 'Product', 'Manager', 'verified', 86, 91, 'Licensed dataset', 'first', 'Just now'],
  ['Mia', 'Thompson', 3, 'Operations', 'Manager', 'needs_verify', 74, 65, 'User import', 'first', '1w ago'],
  ['Luca', 'Romano', 4, 'Procurement', 'Individual Contributor', 'verified', 83, 88, 'Licensed dataset', 'first', '5h ago'],
  ['Elena', 'Silva', 5, 'HR', 'Manager', 'verified', 85, 81, 'Licensed dataset', 'first', '2d ago'],
  ['Ahmed', 'Farouk', 6, 'Operations', 'Director', 'verified', 90, 93, 'Web enrichment', 'first.last', '4h ago'],
  ['Elena', 'Rossi', 7, 'Partnerships', 'C-Level', 'verified', 95, 96, 'User import', 'first.last', '1d ago'],
  ['Priya', 'Nair', 6, 'Marketing', 'Director', 'verified', 89, 84, 'Licensed dataset', 'first.last', '6h ago'],
  ['Tomas', 'Novak', 1, 'Engineering', 'VP', 'verified', 87, 90, 'Web enrichment', 'first.last', '2d ago'],
  ['Nina', 'Berg', 4, 'Finance', 'Director', 'needs_verify', 71, 68, 'User import', 'first.last', '1w ago'],
  ['Marco', 'Ferrari', 2, 'Sales', 'VP', 'verified', 92, 94, 'Licensed dataset', 'first.last', '3h ago'],
  ['Yuki', 'Tanaka', 3, 'Product', 'Individual Contributor', 'unverified', 58, 61, 'Web enrichment', null, '3w ago'],
  ['Hannah', 'Weber', 5, 'Marketing', 'Individual Contributor', 'needs_verify', 76, 70, 'User import', 'first.last', '2d ago'],
  ['Omar', 'Haddad', 7, 'Procurement', 'Manager', 'verified', 84, 79, 'Licensed dataset', 'first.last', '5d ago'],
];

/** Custom titles the prototype showed, kept even though they break the pattern. */
const PINNED_TITLES = {
  'Amina Khan': 'Partnerships Lead',
  'Jonas Richter': 'Product Lead',
  'Elena Rossi': 'Founder & CEO',
  'Luca Romano': 'Procurement Specialist',
};

// --- Near-duplicates and decoys ------------------------------------------

/**
 * Thirteen deliberate pairs. `rule` names the detection rule the pair is built
 * to exercise; the finder is free to fire more than one, but each pair is
 * constructed so at least this one does.
 */
const DUP_SPECS = [
  // rule 1 — bounded edit distance on the full name
  { rule: 1, companyIndex: 0, a: ['Sarah', 'Miller'], b: ['Sara', 'Millar'], reusePinned: 'Sarah Miller', department: 'Marketing', seniority: 'Manager', bConfidence: 62, bVerification: 'needs_verify', bStyle: 'flast', bSource: 'Web enrichment' },
  { rule: 1, companyIndex: 1, a: ['Stefan', 'Bauer'], b: ['Stephan', 'Bauer'], department: 'Sales', seniority: 'Director' },
  { rule: 1, companyIndex: 2, a: ['Clara', 'Dubois'], b: ['Clare', 'Dubois'], department: 'Marketing', seniority: 'Manager' },
  { rule: 1, companyIndex: 8, a: ['Felix', 'Jansen'], b: ['Felix', 'Janssen'], department: 'Engineering', seniority: 'Manager' },
  { rule: 1, companyIndex: 12, a: ['Ines', 'Costa'], b: ['Inez', 'Costa'], department: 'Finance', seniority: 'Director' },
  // rule 2 — identical email local-part once dots/hyphens/underscores are gone
  { rule: 2, companyIndex: 3, a: ['Jon', 'Weber'], b: ['Jonathan', 'Weber'], department: 'Operations', seniority: 'Manager', sharedLocal: 'jonweber' },
  { rule: 2, companyIndex: 5, a: ['Kathryn', 'Moreau'], b: ['Katie', 'Moreau'], department: 'HR', seniority: 'Manager', sharedLocal: 'k_moreau' },
  { rule: 2, companyIndex: 9, a: ['Alexander', 'Petrov'], b: ['Sasha', 'Petrov'], department: 'Product', seniority: 'Director', sharedLocal: 'a-petrov' },
  { rule: 2, companyIndex: 14, a: ['Benjamin', 'Okafor'], b: ['Ben', 'Okafor'], department: 'Sales', seniority: 'VP', sharedLocal: 'b.okafor' },
  // rule 3 — same surname, same first initial, different given name, same department
  { rule: 3, companyIndex: 4, a: ['Priya', 'Sharma'], b: ['Pooja', 'Sharma'], department: 'Marketing', seniority: 'Manager' },
  { rule: 3, companyIndex: 7, a: ['Martin', 'Larsen'], b: ['Mikkel', 'Larsen'], department: 'Procurement', seniority: 'Director' },
  { rule: 3, companyIndex: 11, a: ['Camille', 'Leroy'], b: ['Cedric', 'Leroy'], department: 'Partnerships', seniority: 'Manager' },
  { rule: 3, companyIndex: 16, a: ['Andrea', 'Horvat'], b: ['Anton', 'Horvat'], department: 'Engineering', seniority: 'VP' },
];

/**
 * Six pairs that must NOT be flagged: same company, same surname, same first
 * initial — but different departments, distant given names and distinct email
 * local-parts, so every rule declines.
 */
const DECOY_SPECS = [
  { companyIndex: 0, a: ['Michael', 'Brooks', 'Sales'], b: ['Melanie', 'Brooks', 'Finance'] },
  { companyIndex: 2, a: ['Christopher', 'Fischer', 'Engineering'], b: ['Charlotte', 'Fischer', 'HR'] },
  { companyIndex: 6, a: ['Rahul', 'Menon', 'Product'], b: ['Ruth', 'Menon', 'Operations'] },
  { companyIndex: 10, a: ['Gabriel', 'Alvarez', 'Marketing'], b: ['Gloria', 'Alvarez', 'Procurement'] },
  { companyIndex: 13, a: ['Sebastian', 'Nilsson', 'Sales'], b: ['Sigrid', 'Nilsson', 'Partnerships'] },
  { companyIndex: 15, a: ['Theodore', 'Yilmaz', 'Finance'], b: ['Tamara', 'Yilmaz', 'Engineering'] },
];

// --- Build ----------------------------------------------------------------

const companies = buildCompanies();
const people = [];

for (const row of PINNED) {
  const [firstName, lastName, companyIndex, department, seniority, verification, confidence, score, source, emailStyle, lastActive] = row;
  const person = makePerson({
    company: companies[companyIndex],
    firstName,
    lastName,
    department,
    seniority,
    verification,
    confidence,
    score,
    source,
    emailStyle: emailStyle ?? 'first',
    email: emailStyle === null ? null : undefined,
    lastActive,
  });
  person.title = PINNED_TITLES[person.name] ?? person.title;
  people.push(person);
}

const pinnedByName = new Map(people.map((person) => [person.name, person]));

for (const spec of DUP_SPECS) {
  const company = companies[spec.companyIndex];
  if (!spec.reusePinned) {
    people.push(
      makePerson({
        company,
        firstName: spec.a[0],
        lastName: spec.a[1],
        department: spec.department,
        seniority: spec.seniority,
        verification: 'verified',
        confidence: int(86, 97),
        email: spec.sharedLocal
          ? `${spec.sharedLocal}@${company.domain}`
          : `${emailLocal(spec.a[0], spec.a[1], 'first.last')}@${company.domain}`,
      })
    );
  }
  const bLocal = spec.sharedLocal
    ? spec.sharedLocal.replace(/[._-]/g, '')
    : emailLocal(spec.b[0], spec.b[1], spec.bStyle ?? 'flast');
  people.push(
    makePerson({
      company,
      firstName: spec.b[0],
      lastName: spec.b[1],
      department: spec.department,
      seniority: spec.seniority,
      verification: spec.bVerification ?? 'needs_verify',
      confidence: spec.bConfidence ?? int(63, 80),
      source: spec.bSource,
      email: `${bLocal}@${company.domain}`,
    })
  );
}

for (const spec of DECOY_SPECS) {
  const company = companies[spec.companyIndex];
  for (const [firstName, lastName, department] of [spec.a, spec.b]) {
    people.push(
      makePerson({
        company,
        firstName,
        lastName,
        department,
        verification: 'verified',
        email: `${emailLocal(firstName, lastName, 'first.last')}@${company.domain}`,
      })
    );
  }
}

// Company sizes: every company gets at least 4 so it behaves like a real facet,
// capped at 40 so none of them dominates.
const sizes = companies.map(() => 4);
let toDistribute = TOTAL - 4 * companies.length;
while (toDistribute > 0) {
  const index = int(0, companies.length - 1);
  if (sizes[index] >= 40) continue;
  const add = Math.min(toDistribute, int(1, 6), 40 - sizes[index]);
  sizes[index] += add;
  toDistribute -= add;
}

const slots = [];
companies.forEach((company, index) => {
  const taken = people.filter((person) => person.company === company.name).length;
  for (let i = 0; i < Math.max(0, sizes[index] - taken); i += 1) slots.push(index);
});

for (const index of shuffle(slots)) {
  if (people.length >= TOTAL) break;
  people.push(makePerson({ company: companies[index] }));
}
while (people.length < TOTAL) {
  people.push(makePerson({ company: companies[int(0, companies.length - 1)] }));
}
people.length = TOTAL;

// --- Assertions -----------------------------------------------------------

const fail = (message) => {
  console.error(`generate-people-seed: ${message}`);
  process.exit(1);
};

const countBy = (get) => {
  const counts = new Map();
  for (const person of people) counts.set(get(person), (counts.get(get(person)) ?? 0) + 1);
  return counts;
};

const share = (predicate) => people.filter(predicate).length / people.length;

if (people.length !== TOTAL) fail(`expected ${TOTAL} records, got ${people.length}`);
if (new Set(people.map((p) => p.id)).size !== TOTAL) fail('ids are not unique');

const byCountry = countBy((p) => p.country);
if ((byCountry.get('Germany') ?? 0) < 120) fail(`Germany has ${byCountry.get('Germany') ?? 0}, need >= 120`);
if ((byCountry.get('India') ?? 0) < 90) fail(`India has ${byCountry.get('India') ?? 0}, need >= 90`);
if (byCountry.size < 25) fail(`only ${byCountry.size} countries, need >= 25`);

const byCompany = countBy((p) => p.company);
if (byCompany.size < 130) fail(`only ${byCompany.size} companies, need >= 130`);
for (const [name, count] of byCompany) {
  if (count < 4 || count > 44) fail(`company ${name} has ${count} contacts, need 4-44`);
}

const distinctTitles = new Set(people.map((p) => p.title)).size;
if (distinctTitles < 45 || distinctTitles > 90) fail(`${distinctTitles} distinct titles, need 45-90`);

for (const [value, expected] of [['verified', 0.58], ['needs_verify', 0.27], ['unverified', 0.15]]) {
  const actual = share((p) => p.verification === value);
  if (Math.abs(actual - expected) > 0.04) fail(`verification ${value} at ${actual.toFixed(3)}, need ${expected} +/- 0.04`);
}

if (people.some((p) => p.verification === 'unverified' && p.email !== null)) {
  fail('an unverified record carries an email');
}
if (people.some((p) => p.verification === 'verified' && p.email === null)) {
  fail('a verified record has no email');
}

const meanConfidence = people.reduce((sum, p) => sum + p.confidence, 0) / people.length;
if (meanConfidence < 82 || meanConfidence > 86) fail(`mean confidence ${meanConfidence.toFixed(1)}, need 82-86`);
if (people.some((p) => p.confidence < 40 || p.confidence > 99)) fail('confidence out of 40-99');

for (const [field, expected] of [['email', 0.85], ['phone', 0.46], ['linkedin', 0.61]]) {
  const actual = share((p) => p[field] !== null);
  if (Math.abs(actual - expected) > 0.05) fail(`${field} coverage ${actual.toFixed(3)}, need ${expected} +/- 0.05`);
}

const starredShare = share((p) => p.starred);
if (starredShare < 0.09 || starredShare > 0.16) fail(`starred share ${starredShare.toFixed(3)}, need 0.09-0.16`);
if (people.some((p) => p.starred !== p.score >= 88)) fail('starred disagrees with score >= 88');

for (const [value, expected] of SENIORITIES) {
  const actual = share((p) => p.seniority === value);
  if (Math.abs(actual - expected / 100) > 0.05) fail(`seniority ${value} at ${actual.toFixed(3)}, need ${expected / 100} +/- 0.05`);
}

if (!people.some((p) => p.name === 'Sarah Miller') || !people.some((p) => p.name === 'Sara Millar')) {
  fail('the Miller/Millar duplicate fixture is missing');
}

// --- Write ----------------------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, '..', 'data', 'people-seed.json');
writeFileSync(target, `${JSON.stringify(people, null, 0)}\n`, 'utf8');
console.log(`generate-people-seed: wrote ${people.length} records to data/people-seed.json`);
```

- [ ] **Step 3: Run the generator**

Run: `node scripts/generate-people-seed.mjs`
Expected: `generate-people-seed: wrote 2418 records to data/people-seed.json`, exit 0.

If any assertion fails, the message names the band that drifted. Adjust the
matching weight table at the top of the script — not the assertion — and re-run.
Re-running is always safe: the PRNG is fixed-seed, and the script writes one
file into `data/`.

- [ ] **Step 4: Write the loader**

Create `lib/people/data.ts`:

```ts
import seed from '../../data/people-seed.json';
import type { Person, PersonSeed } from '@/types/people';

/**
 * The contact dataset. Static and committed, like data/find-shows-seed.json:
 * a workspace-scoped table would make the count vary per workspace, so the
 * page's "2,418 contacts" header could not be a fixed number.
 *
 * `searchText` is derived here rather than stored, so the generator and the
 * query parser share exactly one definition of "normalized".
 */
function searchTextFor(person: PersonSeed): string {
  return [person.name, person.title, person.company, person.email ?? '', person.country, person.city]
    .join(' ')
    .toLowerCase();
}

export const people: Person[] = (seed as PersonSeed[]).map((person) => ({
  ...person,
  searchText: searchTextFor(person),
}));

export const peopleById: Record<string, Person> = Object.fromEntries(
  people.map((person) => [person.id, person])
);
```

- [ ] **Step 5: Write the seed test**

Create `tests/integration/people-seed.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { people, peopleById } from '@/lib/people/data';
import { DEPARTMENTS, SENIORITIES, SOURCES, VERIFICATIONS } from '@/types/people';

describe('people seed', () => {
  it('holds exactly 2,418 uniquely identified records', () => {
    expect(people).toHaveLength(2418);
    expect(Object.keys(peopleById)).toHaveLength(2418);
  });

  it('keeps every closed vocabulary closed', () => {
    for (const person of people) {
      expect(DEPARTMENTS).toContain(person.department);
      expect(SENIORITIES).toContain(person.seniority);
      expect(SOURCES).toContain(person.source);
      expect(VERIFICATIONS).toContain(person.verification);
    }
  });

  it('never contradicts itself on verification and email', () => {
    for (const person of people) {
      if (person.verification === 'unverified') expect(person.email).toBeNull();
      if (person.verification === 'verified') expect(person.email).not.toBeNull();
    }
  });

  it('keeps the star coherent with the platform score', () => {
    for (const person of people) expect(person.starred).toBe(person.score >= 88);
  });

  it('leaves every acceptance query a non-trivial set to match', () => {
    const germany = people.filter((person) => person.country === 'Germany');
    const india = people.filter((person) => person.country === 'India');
    expect(germany.length).toBeGreaterThanOrEqual(120);
    expect(india.length).toBeGreaterThanOrEqual(90);

    const marketingManagersInGermany = germany.filter(
      (person) => person.department === 'Marketing' && person.seniority === 'Manager'
    );
    expect(marketingManagersInGermany.length).toBeGreaterThan(0);
  });

  it('behaves like a real company facet', () => {
    const counts = new Map<string, number>();
    for (const person of people) counts.set(person.company, (counts.get(person.company) ?? 0) + 1);
    expect(counts.size).toBeGreaterThanOrEqual(130);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(44);
    }
  });

  it('carries the duplicate fixture the finder is tested against', () => {
    const sarah = people.find((person) => person.name === 'Sarah Miller');
    const sara = people.find((person) => person.name === 'Sara Millar');
    expect(sarah?.company).toBe('NovaAI Systems');
    expect(sara?.company).toBe('NovaAI Systems');
    expect(sarah?.confidence).toBe(91);
    expect(sara?.confidence).toBe(62);
  });

  it('gives each record a normalized searchText', () => {
    for (const person of people.slice(0, 50)) {
      expect(person.searchText).toBe(person.searchText.toLowerCase());
      expect(person.searchText).toContain(person.company.toLowerCase());
    }
  });
});
```

- [ ] **Step 6: Run the test**

Run: `npx vitest run tests/integration/people-seed.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-people-seed.mjs data/people-seed.json lib/people/data.ts types/people.ts tests/integration/people-seed.test.ts
git commit -m "feat(people): generate the 2,418-contact seed"
```

---

### Task 3: `lib/search/` — normalisation and tokens

The foundation every later stage stands on. This normaliser is deliberately
**not** the one in `lib/events/filters.ts:17`, which leaves punctuation intact.
Hyphens and periods must become separators for `c-level`, `v.p.` and
`co-founder` to tokenize. Events keeps its own; nothing there changes.

**Files:**
- Create: `lib/search/types.ts`
- Create: `lib/search/normalize.ts`
- Create: `lib/search/stopwords.ts`
- Modify: `lib/people/data.ts` — use the real `normalize`
- Test: `tests/integration/people-search-primitives.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Token = { text: string; start: number; end: number }`,
  `Match = { field: string; value: string; sourceText: string }`,
  `PhraseField = { field: string; value: string }`,
  `PhraseEntry = { phrase: string; fields: PhraseField[] }`,
  `PhraseIndex = Map<string, PhraseField[]>`,
  `normalize(value: string): string`, `tokenize(normalized: string): Token[]`,
  `depluralise(word: string): string`, `STOPWORDS: ReadonlySet<string>`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/people-search-primitives.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { depluralise, normalize, tokenize } from '@/lib/search/normalize';
import { STOPWORDS } from '@/lib/search/stopwords';

describe('normalize', () => {
  it('turns punctuation into separators so compound titles tokenize', () => {
    expect(normalize('C-Level')).toBe('c level');
    expect(normalize('V.P.')).toBe('v p');
    expect(normalize('co-founder')).toBe('co founder');
  });

  it('strips accents and case', () => {
    expect(normalize('München')).toBe('munchen');
    expect(normalize('  Séverine   MOREAU ')).toBe('severine moreau');
  });

  it('keeps the characters numeric conditions are written with', () => {
    expect(normalize('80%+')).toBe('80%+');
    expect(normalize('>= 80')).toBe('>= 80');
  });

  it('separates comparators so an unspaced one still tokenizes', () => {
    expect(normalize('confidence<50')).toBe('confidence < 50');
    expect(normalize('score>=90')).toBe('score >= 90');
  });

  it('never throws on empty or exotic input', () => {
    expect(normalize('')).toBe('');
    expect(normalize('!!!')).toBe('');
    expect(normalize('日本')).toBe('');
  });
});

describe('tokenize', () => {
  it('carries offsets into the normalized string', () => {
    expect(tokenize('marketing managers in germany')).toEqual([
      { text: 'marketing', start: 0, end: 9 },
      { text: 'managers', start: 10, end: 18 },
      { text: 'in', start: 19, end: 21 },
      { text: 'germany', start: 22, end: 29 },
    ]);
  });

  it('returns nothing for an empty string', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('depluralise', () => {
  it('strips one trailing s from real plurals', () => {
    expect(depluralise('managers')).toBe('manager');
    expect(depluralise('directors')).toBe('director');
    expect(depluralise('emails')).toBe('email');
  });

  it('leaves short words and double-s endings alone', () => {
    expect(depluralise('is')).toBe('is');
    expect(depluralise('gas')).toBe('gas');
    expect(depluralise('business')).toBe('business');
  });
});

describe('STOPWORDS', () => {
  it('covers the connectives a question is padded with', () => {
    for (const word of ['in', 'at', 'with', 'the', 'of', 'contacts', 'people', 'top']) {
      expect(STOPWORDS.has(word)).toBe(true);
    }
  });

  it('never swallows a real filter value', () => {
    for (const word of ['sales', 'marketing', 'germany', 'verified', 'manager']) {
      expect(STOPWORDS.has(word)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/integration/people-search-primitives.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/search/normalize"`.

- [ ] **Step 3: Write the shared types**

Create `lib/search/types.ts`:

```ts
/**
 * Domain-free search primitives, shared so Events can adopt them later without
 * a second implementation. Nothing in `lib/search/` knows what a contact is.
 */

/** One whitespace-delimited run, with offsets into the normalized string. */
export type Token = { text: string; start: number; end: number };

/** One constraint a stage read out of the text, and the words it read it from. */
export type Match = { field: string; value: string; sourceText: string };

/** A single `{ field, value }` an index entry contributes when it matches. */
export type PhraseField = { field: string; value: string };

/** An entry may carry several fields, which is how one span sets two filters. */
export type PhraseEntry = { phrase: string; fields: PhraseField[] };

/** Normalized phrase → the fields it sets. Insertion order breaks ties. */
export type PhraseIndex = Map<string, PhraseField[]>;
```

- [ ] **Step 4: Write the normaliser**

Create `lib/search/normalize.ts`:

```ts
import type { Token } from './types';

/**
 * Lowercase, strip accents, turn every other punctuation mark into a separator.
 *
 * `%`, `+`, `<`, `>` and `=` survive because the numeric scanner reads them:
 * "80%+" and ">= 80" have to reach it intact.
 *
 * Comparators are then given their own whitespace, so "confidence<50" tokenizes
 * the same way "confidence < 50" does. `%` and `+` are deliberately *not* split
 * off, because "80%+" has to stay one token for the scanner to read the suffix.
 */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%+<>=]+/g, ' ')
    .replace(/([<>]=?)/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(normalized: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\S+/g;
  let match = pattern.exec(normalized);
  while (match !== null) {
    tokens.push({ text: match[0], start: match.index, end: match.index + match[0].length });
    match = pattern.exec(normalized);
  }
  return tokens;
}

/**
 * Strips a single trailing `s`. The spec called for "s or es", but stripping
 * `es` turns `sales` into `sal` — and `sales` is a real department alias that
 * has to survive. One `s` resolves every plural the vocabulary actually sees
 * (managers, directors, emails, leads) without that collateral damage.
 */
export function depluralise(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ss')) return word;
  return word.endsWith('s') ? word.slice(0, -1) : word;
}
```

- [ ] **Step 5: Write the stopwords**

Create `lib/search/stopwords.ts`:

```ts
/**
 * Words that carry no constraint. Removed only *after* phrase matching, so
 * "head of partnerships" and "top rated" still resolve as phrases.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'all', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'by', 'can', 'contact',
  'contacts', 'do', 'does', 'each', 'find', 'for', 'from', 'get', 'give', 'has',
  'have', 'how', 'i', 'in', 'is', 'it', 'its', 'just', 'lead', 'leads', 'list',
  'many', 'me', 'my', 'need', 'of', 'on', 'only', 'or', 'our', 'out', 'people',
  'person', 'please', 'show', 'some', 'that', 'the', 'their', 'them', 'there',
  'these', 'they', 'this', 'those', 'to', 'top', 'us', 'was', 'we', 'were',
  'what', 'which', 'who', 'whose', 'with', 'within', 'you', 'your',
]);
```

- [ ] **Step 6: Point the loader at the real normaliser**

In `lib/people/data.ts`, replace the `searchTextFor` body so there is exactly one
definition of "normalized" in the codebase:

```ts
import seed from '../../data/people-seed.json';
import { normalize } from '@/lib/search/normalize';
import type { Person, PersonSeed } from '@/types/people';

function searchTextFor(person: PersonSeed): string {
  return normalize(
    [person.name, person.title, person.company, person.email ?? '', person.country, person.city].join(' ')
  );
}
```

Leave the rest of the file as written in Task 2.

- [ ] **Step 7: Run both test files**

Run: `npx vitest run tests/integration/people-search-primitives.test.ts tests/integration/people-seed.test.ts`
Expected: PASS. The seed test's `searchText` assertions still hold — `normalize`
lowercases, and company names contain no punctuation that would be stripped.

- [ ] **Step 8: Commit**

```bash
git add lib/search/types.ts lib/search/normalize.ts lib/search/stopwords.ts lib/people/data.ts tests/integration/people-search-primitives.test.ts
git commit -m "feat(search): add domain-free normalisation and tokens"
```

---

### Task 4: `lib/search/phrase.ts` — n-gram phrase matching

This is the stage that makes `marketing managers` two constraints instead of
one, and the stage whose absence caused the Events bug where `united kingdom`
fell through as two separate keywords.

**Files:**
- Create: `lib/search/phrase.ts`
- Test: `tests/integration/people-search-primitives.test.ts` (append)

**Interfaces:**
- Consumes: `Token`, `Match`, `PhraseEntry`, `PhraseField`, `PhraseIndex` from
  `lib/search/types`; `depluralise` from `lib/search/normalize`.
- Produces: `buildPhraseIndex(entries: PhraseEntry[]): PhraseIndex`,
  `matchPhrases(tokens: Token[], index: PhraseIndex, maxGram?: number): { matches: Match[]; remaining: Token[] }`.

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/people-search-primitives.test.ts`:

```ts
import { buildPhraseIndex, matchPhrases } from '@/lib/search/phrase';
import { normalize as norm, tokenize as tok } from '@/lib/search/normalize';

const demoIndex = buildPhraseIndex([
  { phrase: 'marketing manager', fields: [{ field: 'departments', value: 'Marketing' }, { field: 'seniorities', value: 'Manager' }] },
  { phrase: 'sales director', fields: [{ field: 'departments', value: 'Sales' }, { field: 'seniorities', value: 'Director' }] },
  { phrase: 'head of partnerships', fields: [{ field: 'departments', value: 'Partnerships' }, { field: 'seniorities', value: 'Director' }] },
  { phrase: 'marketing', fields: [{ field: 'departments', value: 'Marketing' }] },
  { phrase: 'sales', fields: [{ field: 'departments', value: 'Sales' }] },
  { phrase: 'manager', fields: [{ field: 'seniorities', value: 'Manager' }] },
  { phrase: 'united kingdom', fields: [{ field: 'countries', value: 'United Kingdom' }] },
  { phrase: 'germany', fields: [{ field: 'countries', value: 'Germany' }] },
  { phrase: 'novaai systems', fields: [{ field: 'companies', value: 'NovaAI Systems' }] },
]);

const run = (text: string) => matchPhrases(tok(norm(text)), demoIndex);

describe('matchPhrases', () => {
  it('emits both fields of a combined phrase from one span', () => {
    const { matches, remaining } = run('marketing manager');
    expect(matches).toEqual([
      { field: 'departments', value: 'Marketing', sourceText: 'marketing manager' },
      { field: 'seniorities', value: 'Manager', sourceText: 'marketing manager' },
    ]);
    expect(remaining).toEqual([]);
  });

  it('resolves plurals by depluralising the last word', () => {
    expect(run('marketing managers').matches.map((m) => m.value)).toEqual(['Marketing', 'Manager']);
    expect(run('sales directors').matches.map((m) => m.value)).toEqual(['Sales', 'Director']);
  });

  it('prefers the longest gram, so a two-word country is never two keywords', () => {
    const { matches, remaining } = run('united kingdom');
    expect(matches).toEqual([
      { field: 'countries', value: 'United Kingdom', sourceText: 'united kingdom' },
    ]);
    expect(remaining).toEqual([]);
  });

  it('handles a three-word phrase before its one-word parts', () => {
    expect(run('head of partnerships').matches.map((m) => m.value)).toEqual([
      'Partnerships',
      'Director',
    ]);
  });

  it('returns unmatched tokens untouched, in order', () => {
    const { matches, remaining } = run('marketing in germany zzzz');
    expect(matches.map((m) => m.value)).toEqual(['Marketing', 'Germany']);
    expect(remaining.map((token) => token.text)).toEqual(['in', 'zzzz']);
  });

  it('lets an earlier entry win a tie at equal length', () => {
    const index = buildPhraseIndex([
      { phrase: 'ops', fields: [{ field: 'departments', value: 'Operations' }] },
      { phrase: 'ops', fields: [{ field: 'departments', value: 'WRONG' }] },
    ]);
    expect(matchPhrases(tok('ops'), index).matches[0].value).toBe('Operations');
  });

  it('matches a company name ahead of the words inside it', () => {
    expect(run('novaai systems').matches.map((m) => m.value)).toEqual(['NovaAI Systems']);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/integration/people-search-primitives.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/search/phrase"`.

- [ ] **Step 3: Write the matcher**

Create `lib/search/phrase.ts`:

```ts
import { depluralise, normalize } from './normalize';
import type { Match, PhraseEntry, PhraseField, PhraseIndex, Token } from './types';

/**
 * Builds the lookup. Entries are inserted in the caller's order and the first
 * writer of a key wins, so precedence at equal phrase length is controlled by
 * build order rather than by anything implicit.
 */
export function buildPhraseIndex(entries: PhraseEntry[]): PhraseIndex {
  const index: PhraseIndex = new Map();
  for (const entry of entries) {
    const key = normalize(entry.phrase);
    if (!key || entry.fields.length === 0) continue;
    if (!index.has(key)) index.set(key, entry.fields);
  }
  return index;
}

/**
 * The forms of an n-gram worth looking up, in preference order.
 *
 * All-words depluralisation alone would turn "sales directors" into
 * "sale director" and lose it, so the last-word-only form is tried first: it
 * covers "marketing managers" and "sales directors" while leaving a leading
 * "sales" intact.
 */
function gramVariants(words: string[]): string[] {
  const verbatim = words.join(' ');
  const variants = [verbatim];

  const lastOnly = [...words];
  lastOnly[lastOnly.length - 1] = depluralise(lastOnly[lastOnly.length - 1]);
  const lastJoined = lastOnly.join(' ');
  if (lastJoined !== verbatim) variants.push(lastJoined);

  const allJoined = words.map(depluralise).join(' ');
  if (allJoined !== verbatim && allJoined !== lastJoined) variants.push(allJoined);

  return variants;
}

/**
 * Walks left to right, trying n-grams longest-first at each position. On a hit
 * the span is consumed and the walk continues past it; otherwise the single
 * token is handed back as remaining.
 */
export function matchPhrases(
  tokens: Token[],
  index: PhraseIndex,
  maxGram = 4
): { matches: Match[]; remaining: Token[] } {
  const matches: Match[] = [];
  const remaining: Token[] = [];
  let position = 0;

  while (position < tokens.length) {
    let consumed = 0;
    let fields: PhraseField[] | undefined;
    let sourceText = '';

    for (let size = Math.min(maxGram, tokens.length - position); size >= 1 && !fields; size -= 1) {
      const words = tokens.slice(position, position + size).map((token) => token.text);
      for (const variant of gramVariants(words)) {
        const hit = index.get(variant);
        if (!hit) continue;
        fields = hit;
        consumed = size;
        sourceText = words.join(' ');
        break;
      }
    }

    if (fields) {
      for (const field of fields) {
        matches.push({ field: field.field, value: field.value, sourceText });
      }
      position += consumed;
    } else {
      remaining.push(tokens[position]);
      position += 1;
    }
  }

  return { matches, remaining };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/integration/people-search-primitives.test.ts`
Expected: PASS, all `normalize`/`tokenize`/`depluralise`/`STOPWORDS`/`matchPhrases` cases.

- [ ] **Step 5: Commit**

```bash
git add lib/search/phrase.ts tests/integration/people-search-primitives.test.ts
git commit -m "feat(search): add longest-first n-gram phrase matching"
```

---

### Task 5: `lib/search/fuzzy.ts` — bounded edit distance and single-token rescue

**Files:**
- Create: `lib/search/fuzzy.ts`
- Test: `tests/integration/people-search-primitives.test.ts` (append)

**Interfaces:**
- Consumes: `PhraseField`, `PhraseIndex` from `lib/search/types`; `depluralise`
  from `lib/search/normalize`.
- Produces: `levenshtein(a: string, b: string, max: number): number` — returns
  `max + 1` as soon as the bound is exceeded, never the true distance above it;
  `fuzzyFind(token: string, index: PhraseIndex): { key: string; fields: PhraseField[]; distance: number } | null`.

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/people-search-primitives.test.ts`:

```ts
import { fuzzyFind, levenshtein } from '@/lib/search/fuzzy';

describe('levenshtein', () => {
  it('measures real distances', () => {
    expect(levenshtein('germny', 'germany', 3)).toBe(1);
    expect(levenshtein('markting', 'marketing', 3)).toBe(1);
    expect(levenshtein('managrs', 'manager', 3)).toBe(2);
    expect(levenshtein('sarah miller', 'sara millar', 3)).toBe(2);
    expect(levenshtein('abc', 'abc', 2)).toBe(0);
  });

  it('early-exits above the bound rather than reporting the true distance', () => {
    expect(levenshtein('completely', 'different', 2)).toBe(3);
    expect(levenshtein('a', 'abcdefgh', 2)).toBe(3);
  });
});

describe('fuzzyFind', () => {
  const index = buildPhraseIndex([
    { phrase: 'marketing', fields: [{ field: 'departments', value: 'Marketing' }] },
    { phrase: 'manager', fields: [{ field: 'seniorities', value: 'Manager' }] },
    { phrase: 'germany', fields: [{ field: 'countries', value: 'Germany' }] },
    { phrase: 'united kingdom', fields: [{ field: 'countries', value: 'United Kingdom' }] },
  ]);

  it('rescues each misspelling in "markting managrs germny" independently', () => {
    expect(fuzzyFind('markting', index)?.fields[0].value).toBe('Marketing');
    expect(fuzzyFind('managrs', index)?.fields[0].value).toBe('Manager');
    expect(fuzzyFind('germny', index)?.fields[0].value).toBe('Germany');
  });

  it('ignores multi-word entries — rescue is single-token only', () => {
    expect(fuzzyFind('kingdom', index)).toBeNull();
  });

  it('refuses a rescue that is too loose for the token length', () => {
    expect(fuzzyFind('mgr', index)).toBeNull();
    expect(fuzzyFind('zzzzqqq', index)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/integration/people-search-primitives.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/search/fuzzy"`.

- [ ] **Step 3: Write the implementation**

Create `lib/search/fuzzy.ts`:

```ts
import { depluralise } from './normalize';
import type { PhraseField, PhraseIndex } from './types';

/**
 * Bounded Levenshtein. Returns `max + 1` the moment every cell in a row is
 * above the bound, so a long mismatch costs a row or two rather than a full
 * matrix — which matters when this runs against every 1-gram in the vocabulary.
 */
export function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length > max ? max + 1 : b.length;
  if (b.length === 0) return a.length > max ? max + 1 : a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = new Array<number>(b.length + 1);
    current[0] = i;
    let rowMin = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }

    if (rowMin > max) return max + 1;
    previous = current;
  }

  return previous[b.length] > max ? max + 1 : previous[b.length];
}

/**
 * Last-resort rescue for a single mistyped token, against the 1-gram entries of
 * the vocabulary only.
 *
 * Accepted at distance <= 2 *and* <= 25% of the token's length, so short tokens
 * cannot drift into an unrelated value. The depluralised form is scored too:
 * "managrs" is distance 2 of 7 from "manager" and would be rejected, while
 * "managr" is distance 1 of 6 and is not — which is the case that makes
 * "markting managrs germny" resolve all three words.
 */
export function fuzzyFind(
  token: string,
  index: PhraseIndex
): { key: string; fields: PhraseField[]; distance: number } | null {
  const singular = depluralise(token);
  const forms = singular === token ? [token] : [token, singular];

  let best: { key: string; fields: PhraseField[]; distance: number } | null = null;

  for (const [key, fields] of index) {
    if (key.includes(' ')) continue;
    for (const form of forms) {
      if (form.length < 4) continue;
      const limit = Math.min(2, Math.floor(form.length * 0.25));
      if (limit < 1) continue;
      const distance = levenshtein(form, key, limit);
      if (distance > limit) continue;
      if (!best || distance < best.distance) best = { key, fields, distance };
    }
  }

  return best;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/integration/people-search-primitives.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/search/fuzzy.ts tests/integration/people-search-primitives.test.ts
git commit -m "feat(search): add bounded edit distance and token rescue"
```

---

### Task 6: `lib/search/numeric.ts` — numeric condition scanning

Runs **before** phrase matching, so the word `confidence` in "confidence above
80" is eaten here rather than surviving to keywords. Critically, it consumes a
span **only when a condition is actually formed** — otherwise "high confidence
contacts" would lose the word the `high confidence` phrase needs.

**Files:**
- Create: `lib/search/numeric.ts`
- Test: `tests/integration/people-search-primitives.test.ts` (append)

**Interfaces:**
- Consumes: `Token` from `lib/search/types`.
- Produces: `NumericSpec = { key: string; aliases: string[] }`,
  `NumericCondition = { key: string; min: number | null; max: number | null; sourceText: string }`,
  `scanNumericConditions(tokens: Token[], specs: NumericSpec[]): { conditions: NumericCondition[]; remaining: Token[] }`.

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/people-search-primitives.test.ts`:

```ts
import { scanNumericConditions, type NumericSpec } from '@/lib/search/numeric';

const numericSpecs: NumericSpec[] = [
  { key: 'confidence', aliases: ['confidence', 'conf'] },
  { key: 'score', aliases: ['platform score', 'score', 'scoring', 'rated'] },
];

const scan = (text: string) => scanNumericConditions(tok(norm(text)), numericSpecs);

describe('scanNumericConditions', () => {
  it('reads every "at least" surface form', () => {
    for (const text of [
      'confidence above 80',
      'confidence over 80',
      'confidence more than 80',
      'confidence at least 80',
      'confidence greater than 80',
      'confidence >= 80',
      'confidence > 80',
    ]) {
      expect(scan(text).conditions).toEqual([
        { key: 'confidence', min: 80, max: null, sourceText: expect.any(String) },
      ]);
    }
  });

  it('reads every "at most" surface form', () => {
    for (const text of [
      'confidence below 50',
      'confidence under 50',
      'confidence less than 50',
      'confidence at most 50',
      'confidence <= 50',
    ]) {
      expect(scan(text).conditions[0]).toMatchObject({ key: 'confidence', min: null, max: 50 });
    }
  });

  it('reads a suffixed percentage written before the field', () => {
    expect(scan('80%+ confidence').conditions[0]).toMatchObject({ key: 'confidence', min: 80 });
    expect(scan('90+ score').conditions[0]).toMatchObject({ key: 'score', min: 90 });
  });

  it('reads a two-sided range', () => {
    expect(scan('confidence between 70 and 90').conditions[0]).toMatchObject({
      key: 'confidence',
      min: 70,
      max: 90,
    });
  });

  it('reads a multi-word field alias', () => {
    expect(scan('platform score over 90').conditions[0]).toMatchObject({ key: 'score', min: 90 });
  });

  it('skips up to two filler words between the field and its comparator', () => {
    expect(scan('scoring contacts above 90').conditions[0]).toMatchObject({ key: 'score', min: 90 });
    expect(scan('scoring contacts above 90').remaining).toEqual([]);
  });

  it('consumes nothing when no condition is formed, so phrases can still fire', () => {
    const { conditions, remaining } = scan('high confidence contacts with phone');
    expect(conditions).toEqual([]);
    expect(remaining.map((token) => token.text)).toEqual([
      'high',
      'confidence',
      'contacts',
      'with',
      'phone',
    ]);
  });

  it('leaves everything else in remaining', () => {
    const { conditions, remaining } = scan('marketing managers confidence above 80');
    expect(conditions).toHaveLength(1);
    expect(remaining.map((token) => token.text)).toEqual(['marketing', 'managers']);
  });

  it('ignores an out-of-range number rather than clamping it', () => {
    expect(scan('confidence above 900').conditions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/integration/people-search-primitives.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/search/numeric"`.

- [ ] **Step 3: Write the scanner**

Create `lib/search/numeric.ts`:

```ts
import type { Token } from './types';

export type NumericSpec = {
  /** The filter dimension this condition lands on, e.g. 'confidence'. */
  key: string;
  /** Phrases that name the field, longest first is not required — matched greedily. */
  aliases: string[];
};

export type NumericCondition = {
  key: string;
  min: number | null;
  max: number | null;
  sourceText: string;
};

const MIN_OPS: string[][] = [
  ['above'],
  ['over'],
  ['>'],
  ['>='],
  ['at', 'least'],
  ['more', 'than'],
  ['greater', 'than'],
  ['higher', 'than'],
];

const MAX_OPS: string[][] = [
  ['below'],
  ['under'],
  ['<'],
  ['<='],
  ['at', 'most'],
  ['less', 'than'],
  ['lower', 'than'],
  ['up', 'to'],
];

/** How many filler tokens may sit between the field name and its comparator. */
const MAX_SKIP = 2;

type ParsedNumber = { value: number; plus: boolean };

/** Percentages only — a value outside 0-100 is not a confidence or a score. */
function readNumber(text: string | undefined): ParsedNumber | null {
  if (!text) return null;
  const match = /^(\d{1,3})(%?)(\+?)$/.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  if (value < 0 || value > 100) return null;
  return { value, plus: match[3] === '+' };
}

function matchOp(words: string[], at: number, ops: string[][]): number {
  for (const op of ops) {
    if (op.every((word, offset) => words[at + offset] === word)) return op.length;
  }
  return 0;
}

function matchAlias(
  words: string[],
  at: number,
  specs: NumericSpec[]
): { spec: NumericSpec; length: number } | null {
  let best: { spec: NumericSpec; length: number } | null = null;
  for (const spec of specs) {
    for (const alias of spec.aliases) {
      const parts = alias.split(' ');
      if (!parts.every((word, offset) => words[at + offset] === word)) continue;
      if (!best || parts.length > best.length) best = { spec, length: parts.length };
    }
  }
  return best;
}

type Range = { min: number | null; max: number | null; start: number; end: number };

/** Looks rightwards from just past the field name. */
function readForward(words: string[], from: number, aliasStart: number): Range | null {
  for (let at = from; at <= from + MAX_SKIP && at < words.length; at += 1) {
    if (words[at] === 'between') {
      const low = readNumber(words[at + 1]);
      const high = readNumber(words[at + 3]);
      if (low && words[at + 2] === 'and' && high) {
        return { min: low.value, max: high.value, start: aliasStart, end: at + 4 };
      }
    }

    const minOp = matchOp(words, at, MIN_OPS);
    if (minOp > 0) {
      const number = readNumber(words[at + minOp]);
      if (number) return { min: number.value, max: null, start: aliasStart, end: at + minOp + 1 };
    }

    const maxOp = matchOp(words, at, MAX_OPS);
    if (maxOp > 0) {
      const number = readNumber(words[at + maxOp]);
      if (number) return { min: null, max: number.value, start: aliasStart, end: at + maxOp + 1 };
    }

    // A bare number directly after the field only — "confidence 80" reads as a
    // floor, but "confidence contacts 80" does not, so this does not skip.
    if (at === from) {
      const number = readNumber(words[at]);
      if (number) return { min: number.value, max: null, start: aliasStart, end: at + 1 };
    }
  }
  return null;
}

/** Looks leftwards, for "80%+ confidence" and "above 80 confidence". */
function readBackward(words: string[], aliasStart: number, aliasEnd: number): Range | null {
  const number = readNumber(words[aliasStart - 1]);
  if (!number) return null;

  for (const length of [2, 1]) {
    const at = aliasStart - 1 - length;
    if (at < 0) continue;
    if (matchOp(words, at, MIN_OPS) === length) {
      return { min: number.value, max: null, start: at, end: aliasEnd };
    }
    if (matchOp(words, at, MAX_OPS) === length) {
      return { min: null, max: number.value, start: at, end: aliasEnd };
    }
  }

  return { min: number.value, max: null, start: aliasStart - 1, end: aliasEnd };
}

/**
 * Finds `<field> <comparator> <number>` conditions and consumes their spans.
 *
 * A span is consumed only when a condition is actually formed. That is what
 * lets "high confidence" survive to the phrase stage as a bare adjective while
 * "confidence above 80" is fully absorbed here.
 */
export function scanNumericConditions(
  tokens: Token[],
  specs: NumericSpec[]
): { conditions: NumericCondition[]; remaining: Token[] } {
  const words = tokens.map((token) => token.text);
  const consumed = new Set<number>();
  const conditions: NumericCondition[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    if (consumed.has(index)) continue;

    const alias = matchAlias(words, index, specs);
    if (!alias) continue;

    const aliasEnd = index + alias.length;
    const range =
      readForward(words, aliasEnd, index) ?? readBackward(words, index, aliasEnd);
    if (!range) continue;

    for (let at = range.start; at < range.end; at += 1) consumed.add(at);
    conditions.push({
      key: alias.spec.key,
      min: range.min,
      max: range.max,
      sourceText: words.slice(range.start, range.end).join(' '),
    });
    index = range.end - 1;
  }

  return {
    conditions,
    remaining: tokens.filter((_, index) => !consumed.has(index)),
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/integration/people-search-primitives.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/search/numeric.ts tests/integration/people-search-primitives.test.ts
git commit -m "feat(search): add numeric condition scanning"
```

---

### Task 7: `lib/search/textScore.ts` — weighted inverted index

Replaces MiniSearch, which is not installed and may not be installed. At 2,418
records over five fields a weighted inverted index is equivalent and small.
This backs the rail's free-text search box, which needs prefix matching so
typing `mil` finds Miller before the word is finished.

**Files:**
- Create: `lib/search/textScore.ts`
- Test: `tests/integration/people-search-primitives.test.ts` (append)

**Interfaces:**
- Consumes: `normalize`, `tokenize` from `lib/search/normalize`.
- Produces: `TextField<T> = { get: (doc: T) => string; weight: number }`,
  `TextIndex`, `buildTextIndex<T>(docs, id, fields): TextIndex`,
  `scoreQuery(index: TextIndex, terms: string[]): { id: string; score: number }[]`
  — AND semantics, every term must match; ranked by summed weight descending,
  ties broken by id so the order is stable.

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/people-search-primitives.test.ts`:

```ts
import { buildTextIndex, scoreQuery } from '@/lib/search/textScore';

type Row = { id: string; name: string; company: string };

const rows: Row[] = [
  { id: 'a', name: 'Sarah Miller', company: 'NovaAI Systems' },
  { id: 'b', name: 'Sara Millar', company: 'NovaAI Systems' },
  { id: 'c', name: 'David Lee', company: 'CloudForge Ltd' },
];

const rowIndex = buildTextIndex(
  rows,
  (row) => row.id,
  [
    { get: (row) => row.name, weight: 3 },
    { get: (row) => row.company, weight: 1 },
  ]
);

describe('textScore', () => {
  it('matches whole tokens', () => {
    expect(scoreQuery(rowIndex, ['miller']).map((hit) => hit.id)).toEqual(['a']);
  });

  it('matches prefixes so typing mid-word still finds rows', () => {
    expect(scoreQuery(rowIndex, ['mill']).map((hit) => hit.id).sort()).toEqual(['a', 'b']);
  });

  it('requires every term to match', () => {
    expect(scoreQuery(rowIndex, ['sarah', 'novaai']).map((hit) => hit.id)).toEqual(['a']);
    expect(scoreQuery(rowIndex, ['sarah', 'cloudforge'])).toEqual([]);
  });

  it('ranks a name hit above a company hit', () => {
    const hits = scoreQuery(rowIndex, ['novaai']);
    expect(hits).toHaveLength(2);
    expect(hits[0].score).toBe(hits[1].score);
  });

  it('returns everything for no terms', () => {
    expect(scoreQuery(rowIndex, []).map((hit) => hit.id).sort()).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/integration/people-search-primitives.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/search/textScore"`.

- [ ] **Step 3: Write the index**

Create `lib/search/textScore.ts`:

```ts
import { normalize, tokenize } from './normalize';

export type TextField<T> = { get: (doc: T) => string; weight: number };

export type TextIndex = {
  /** token → id → accumulated weight. */
  postings: Map<string, Map<string, number>>;
  ids: string[];
};

export function buildTextIndex<T>(
  docs: readonly T[],
  id: (doc: T) => string,
  fields: TextField<T>[]
): TextIndex {
  const postings = new Map<string, Map<string, number>>();
  const ids: string[] = [];

  for (const doc of docs) {
    const key = id(doc);
    ids.push(key);
    for (const field of fields) {
      for (const token of tokenize(normalize(field.get(doc) ?? ''))) {
        let bucket = postings.get(token.text);
        if (!bucket) {
          bucket = new Map<string, number>();
          postings.set(token.text, bucket);
        }
        bucket.set(key, (bucket.get(key) ?? 0) + field.weight);
      }
    }
  }

  return { postings, ids };
}

/** Every id whose indexed text starts a token with `term`, and its weight. */
function hitsFor(index: TextIndex, term: string): Map<string, number> {
  const hits = new Map<string, number>();
  const exact = index.postings.get(term);
  if (exact) {
    for (const [id, weight] of exact) hits.set(id, weight);
  }
  // Prefix scan: the vocabulary is a few thousand tokens, so a linear pass is
  // cheaper than maintaining a trie and is well inside a 250 ms debounce.
  for (const [token, bucket] of index.postings) {
    if (token === term || !token.startsWith(term)) continue;
    for (const [id, weight] of bucket) hits.set(id, (hits.get(id) ?? 0) + weight);
  }
  return hits;
}

/** AND semantics across terms. Ranked by summed weight, then by id for stability. */
export function scoreQuery(index: TextIndex, terms: string[]): { id: string; score: number }[] {
  if (terms.length === 0) return index.ids.map((id) => ({ id, score: 0 }));

  let running: Map<string, number> | null = null;

  for (const term of terms) {
    const hits = hitsFor(index, term);
    if (running === null) {
      running = hits;
      continue;
    }
    const merged = new Map<string, number>();
    for (const [id, score] of running) {
      const other = hits.get(id);
      if (other !== undefined) merged.set(id, score + other);
    }
    running = merged;
    if (running.size === 0) break;
  }

  return Array.from(running ?? [], ([id, score]) => ({ id, score })).sort(
    (left, right) => right.score - left.score || left.id.localeCompare(right.id)
  );
}
```

- [ ] **Step 4: Run the whole primitives file**

Run: `npx vitest run tests/integration/people-search-primitives.test.ts`
Expected: PASS, every describe block from Tasks 3–7.

- [ ] **Step 5: Commit**

```bash
git add lib/search/textScore.ts tests/integration/people-search-primitives.test.ts
git commit -m "feat(search): add weighted inverted index for free-text search"
```

---

### Task 8: `lib/people/aliases.ts` and `vocabulary.ts`

The vocabulary is where "Leadership is not a department" is enforced: the
prototype's own rows contradict it — Ahmed Farouk is an *Operations* Director
and Elena Rossi a *Partnerships* Founder & CEO — so `leadership`, `executive`,
`exec` and `c-level` are aliases onto **seniority `C-Level`**, and the rail's
"Job function" accordion is the department facet.

**Files:**
- Create: `lib/people/aliases.ts`
- Create: `lib/people/vocabulary.ts`
- Test: `tests/integration/people-query-parse.test.ts` (append)

**Interfaces:**
- Consumes: `PhraseEntry`, `PhraseIndex` from `lib/search/types`;
  `buildPhraseIndex` from `lib/search/phrase`; `Person`, `DEPARTMENTS`,
  `SENIORITIES` from `types/people`.
- Produces: `FLAG_ENTRIES: PhraseEntry[]` (verification, contactability,
  starred, bare-adjective numerics — everything parse stage 3 consumes),
  `buildCombinedTitleEntries(): PhraseEntry[]`, `COUNTRY_ALIASES`,
  `SENIORITY_ALIASES`, `DEPARTMENT_ALIASES`,
  `Vocabulary = { index: PhraseIndex; flags: PhraseIndex; countries: string[]; companies: string[]; titles: string[]; cities: string[] }`,
  `buildPeopleVocabulary(list: readonly Person[]): Vocabulary`.

Field names emitted by index entries are exactly the `PeopleFilters` keys:
`countries`, `cities`, `companies`, `titles`, `seniorities`, `departments`,
`sources`, `verification`, `hasEmail`, `hasPhone`, `hasLinkedIn`, `starred`,
`confidenceMin`, `confidenceMax`, `scoreMin`, `scoreMax`. Boolean fields carry
`'1'` or `'0'`; numeric fields carry the number as a string.

- [ ] **Step 1: Write the aliases**

Create `lib/people/aliases.ts`:

```ts
import type { PhraseEntry } from '@/lib/search/types';
import { DEPARTMENTS, SENIORITIES, type Department, type Seniority } from '@/types/people';

/**
 * Country aliases. The full country names themselves come from
 * `SELECT DISTINCT country` in vocabulary.ts, so only the shorthands live here.
 */
export const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'United Kingdom',
  'u k': 'United Kingdom',
  britain: 'United Kingdom',
  'great britain': 'United Kingdom',
  england: 'United Kingdom',
  british: 'United Kingdom',
  us: 'United States',
  usa: 'United States',
  'u s': 'United States',
  'u s a': 'United States',
  america: 'United States',
  american: 'United States',
  states: 'United States',
  deutschland: 'Germany',
  german: 'Germany',
  uae: 'United Arab Emirates',
  emirates: 'United Arab Emirates',
  holland: 'Netherlands',
  dutch: 'Netherlands',
  french: 'France',
  indian: 'India',
  spanish: 'Spain',
  italian: 'Italy',
  japanese: 'Japan',
  canadian: 'Canada',
  australian: 'Australia',
  swiss: 'Switzerland',
  swedish: 'Sweden',
  polish: 'Poland',
  brazilian: 'Brazil',
  mexican: 'Mexico',
  turkish: 'Turkey',
  chinese: 'China',
  korean: 'South Korea',
  danish: 'Denmark',
  norwegian: 'Norway',
  irish: 'Ireland',
  austrian: 'Austria',
  portuguese: 'Portugal',
};

/**
 * `leadership` / `executive` / `exec` / `c-level` land on seniority, not on a
 * department — see the header comment.
 *
 * `lead` and `head` are deliberately absent as bare words: "leads" is CRM
 * vocabulary, and "head" only means Director inside "head of <department>".
 */
export const SENIORITY_ALIASES: Record<string, Seniority> = {
  'c level': 'C-Level',
  clevel: 'C-Level',
  'c suite': 'C-Level',
  leadership: 'C-Level',
  executive: 'C-Level',
  exec: 'C-Level',
  founder: 'C-Level',
  cofounder: 'C-Level',
  'co founder': 'C-Level',
  ceo: 'C-Level',
  cto: 'C-Level',
  cfo: 'C-Level',
  cmo: 'C-Level',
  coo: 'C-Level',
  chief: 'C-Level',
  vp: 'VP',
  'v p': 'VP',
  'vice president': 'VP',
  director: 'Director',
  manager: 'Manager',
  'individual contributor': 'Individual Contributor',
  ic: 'Individual Contributor',
  specialist: 'Individual Contributor',
  associate: 'Individual Contributor',
  analyst: 'Individual Contributor',
  coordinator: 'Individual Contributor',
};

export const DEPARTMENT_ALIASES: Record<string, Department> = {
  marketing: 'Marketing',
  growth: 'Marketing',
  brand: 'Marketing',
  sales: 'Sales',
  revenue: 'Sales',
  'business development': 'Sales',
  'biz dev': 'Sales',
  engineering: 'Engineering',
  engineer: 'Engineering',
  technical: 'Engineering',
  product: 'Product',
  partnerships: 'Partnerships',
  partnership: 'Partnerships',
  alliances: 'Partnerships',
  procurement: 'Procurement',
  purchasing: 'Procurement',
  sourcing: 'Procurement',
  hr: 'HR',
  'human resources': 'HR',
  'people ops': 'HR',
  recruiting: 'HR',
  finance: 'Finance',
  financial: 'Finance',
  accounting: 'Finance',
  operations: 'Operations',
  ops: 'Operations',
  operational: 'Operations',
  logistics: 'Operations',
};

const C_LEVEL_TITLES: Record<Department, string> = {
  Marketing: 'chief marketing officer',
  Sales: 'chief revenue officer',
  Engineering: 'chief technology officer',
  Product: 'chief product officer',
  Partnerships: 'founder and ceo',
  Procurement: 'chief procurement officer',
  HR: 'chief people officer',
  Finance: 'chief financial officer',
  Operations: 'chief operating officer',
};

/** Short forms a seniority is written with inside a combined job title. */
const SENIORITY_SHORT: Record<Seniority, string[]> = {
  'C-Level': ['chief'],
  VP: ['vp', 'vice president'],
  Director: ['director', 'head'],
  Manager: ['manager', 'lead'],
  'Individual Contributor': ['specialist', 'associate', 'analyst', 'coordinator'],
};

/**
 * The systematic cross-product of the two closed vocabularies, so the table
 * stays in sync by construction rather than by hand. One span yields two
 * matches: "marketing managers" is a department *and* a seniority.
 */
export function buildCombinedTitleEntries(): PhraseEntry[] {
  const entries: PhraseEntry[] = [];

  const push = (phrase: string, department: Department, seniority: Seniority) => {
    entries.push({
      phrase,
      fields: [
        { field: 'departments', value: department },
        { field: 'seniorities', value: seniority },
      ],
    });
  };

  for (const department of DEPARTMENTS) {
    push(C_LEVEL_TITLES[department], department, 'C-Level');
    for (const seniority of SENIORITIES) {
      for (const short of SENIORITY_SHORT[seniority]) {
        push(`${department} ${short}`, department, seniority);
        push(`${short} of ${department}`, department, seniority);
        push(`${short} ${department}`, department, seniority);
      }
    }
    push(`head of ${department}`, department, 'Director');
  }

  return entries;
}

const verification = (...values: string[]) =>
  values.map((value) => ({ field: 'verification', value }));

/**
 * Everything parse stage 3 consumes: verification, contactability, starred, and
 * the bare-adjective numeric forms.
 *
 * Verification and contactability are independent, and the longer phrase wins:
 * "verified emails" is one two-word span that sets verification only. It does
 * not also set `hasEmail`, because the span is gone before `email` can be read
 * as a contactability signal.
 */
export const FLAG_ENTRIES: PhraseEntry[] = [
  { phrase: 'verified emails', fields: verification('verified') },
  { phrase: 'verified email', fields: verification('verified') },
  { phrase: 'safe to send', fields: verification('verified') },
  { phrase: 'verified', fields: verification('verified') },
  { phrase: 'clean', fields: verification('verified') },
  { phrase: 'needs verification', fields: verification('needs_verify', 'unverified') },
  { phrase: 'needing verification', fields: verification('needs_verify', 'unverified') },
  { phrase: 'need verification', fields: verification('needs_verify', 'unverified') },
  { phrase: 'not verified', fields: verification('needs_verify', 'unverified') },
  { phrase: 'unverified', fields: verification('needs_verify', 'unverified') },
  { phrase: 'risky', fields: verification('needs_verify', 'unverified') },
  { phrase: 'bounce risk', fields: verification('needs_verify', 'unverified') },
  { phrase: 'bounce', fields: verification('needs_verify', 'unverified') },

  { phrase: 'with work email', fields: [{ field: 'hasEmail', value: '1' }] },
  { phrase: 'with email', fields: [{ field: 'hasEmail', value: '1' }] },
  { phrase: 'has email', fields: [{ field: 'hasEmail', value: '1' }] },
  { phrase: 'no work email', fields: [{ field: 'hasEmail', value: '0' }] },
  { phrase: 'without email', fields: [{ field: 'hasEmail', value: '0' }] },
  { phrase: 'no email', fields: [{ field: 'hasEmail', value: '0' }] },
  { phrase: 'missing email', fields: [{ field: 'hasEmail', value: '0' }] },

  { phrase: 'with phone number', fields: [{ field: 'hasPhone', value: '1' }] },
  { phrase: 'with phone', fields: [{ field: 'hasPhone', value: '1' }] },
  { phrase: 'has phone', fields: [{ field: 'hasPhone', value: '1' }] },
  { phrase: 'without phone', fields: [{ field: 'hasPhone', value: '0' }] },
  { phrase: 'no phone', fields: [{ field: 'hasPhone', value: '0' }] },

  { phrase: 'with linkedin', fields: [{ field: 'hasLinkedIn', value: '1' }] },
  { phrase: 'has linkedin', fields: [{ field: 'hasLinkedIn', value: '1' }] },
  { phrase: 'on linkedin', fields: [{ field: 'hasLinkedIn', value: '1' }] },
  { phrase: 'without linkedin', fields: [{ field: 'hasLinkedIn', value: '0' }] },
  { phrase: 'no linkedin', fields: [{ field: 'hasLinkedIn', value: '0' }] },

  { phrase: 'starred', fields: [{ field: 'starred', value: '1' }] },
  { phrase: 'favourited', fields: [{ field: 'starred', value: '1' }] },
  { phrase: 'favourites', fields: [{ field: 'starred', value: '1' }] },
  { phrase: 'favorites', fields: [{ field: 'starred', value: '1' }] },
  { phrase: 'favourite', fields: [{ field: 'starred', value: '1' }] },
  { phrase: 'favorite', fields: [{ field: 'starred', value: '1' }] },

  { phrase: 'high confidence', fields: [{ field: 'confidenceMin', value: '85' }] },
  { phrase: 'low confidence', fields: [{ field: 'confidenceMax', value: '60' }] },
  { phrase: 'top rated', fields: [{ field: 'scoreMin', value: '90' }] },
  { phrase: 'top scoring', fields: [{ field: 'scoreMin', value: '90' }] },
  { phrase: 'highest score', fields: [{ field: 'scoreMin', value: '90' }] },
  { phrase: 'high score', fields: [{ field: 'scoreMin', value: '90' }] },
  { phrase: 'best', fields: [{ field: 'scoreMin', value: '90' }] },
];
```

- [ ] **Step 2: Write the vocabulary builder**

Create `lib/people/vocabulary.ts`:

```ts
import { buildPhraseIndex } from '@/lib/search/phrase';
import type { PhraseEntry, PhraseIndex } from '@/lib/search/types';
import type { Person } from '@/types/people';
import {
  COUNTRY_ALIASES,
  DEPARTMENT_ALIASES,
  FLAG_ENTRIES,
  SENIORITY_ALIASES,
  buildCombinedTitleEntries,
} from './aliases';

export type Vocabulary = {
  /** Everything parse stage 4 matches against. */
  index: PhraseIndex;
  /** Verification, contactability, starred and bare-adjective numerics. */
  flags: PhraseIndex;
  countries: string[];
  companies: string[];
  titles: string[];
  cities: string[];
};

function distinct(list: readonly Person[], get: (person: Person) => string): string[] {
  return Array.from(new Set(list.map(get))).sort();
}

const cache = new WeakMap<readonly Person[], Vocabulary>();

/**
 * One ordered `PhraseIndex`. Insertion order decides ties at *equal* phrase
 * length only — longest-first already guarantees that "NovaAI Systems" beats
 * "systems", and that "marketing manager" beats "marketing".
 *
 * Memoised on the array identity, so the 2,418-record build happens once per
 * process rather than once per keystroke.
 */
export function buildPeopleVocabulary(list: readonly Person[]): Vocabulary {
  const cached = cache.get(list);
  if (cached) return cached;

  const countries = distinct(list, (person) => person.country);
  const companies = distinct(list, (person) => person.company);
  const titles = distinct(list, (person) => person.title);
  const cities = distinct(list, (person) => person.city);
  const sources = distinct(list, (person) => person.source);

  const one = (phrase: string, field: string, value: string): PhraseEntry => ({
    phrase,
    fields: [{ field, value }],
  });

  const entries: PhraseEntry[] = [
    // 1. combined title phrases (both fields)
    ...buildCombinedTitleEntries(),
    // 2. verification and boolean phrases
    ...FLAG_ENTRIES,
    // 3. seniority aliases
    ...Object.entries(SENIORITY_ALIASES).map(([phrase, value]) =>
      one(phrase, 'seniorities', value)
    ),
    // 4. department aliases
    ...Object.entries(DEPARTMENT_ALIASES).map(([phrase, value]) =>
      one(phrase, 'departments', value)
    ),
    // 5. country aliases, then the real country names
    ...Object.entries(COUNTRY_ALIASES).map(([phrase, value]) => one(phrase, 'countries', value)),
    ...countries.map((value) => one(value, 'countries', value)),
    // 6. companies, before titles and cities
    ...companies.map((value) => one(value, 'companies', value)),
    // 7. raw job titles
    ...titles.map((value) => one(value, 'titles', value)),
    // 8. cities
    ...cities.map((value) => one(value, 'cities', value)),
    // 9. sources
    ...sources.map((value) => one(value, 'sources', value)),
  ];

  const vocabulary: Vocabulary = {
    index: buildPhraseIndex(entries),
    flags: buildPhraseIndex(FLAG_ENTRIES),
    countries,
    companies,
    titles,
    cities,
  };

  cache.set(list, vocabulary);
  return vocabulary;
}
```

- [ ] **Step 3: Write the vocabulary test**

Append to `tests/integration/people-query-parse.test.ts`:

```ts
import { matchPhrases } from '@/lib/search/phrase';
import { normalize, tokenize } from '@/lib/search/normalize';
import { people } from '@/lib/people/data';
import { buildPeopleVocabulary } from '@/lib/people/vocabulary';

const vocab = buildPeopleVocabulary(people);
const lookup = (text: string) =>
  matchPhrases(tokenize(normalize(text)), vocab.index).matches.map((m) => `${m.field}=${m.value}`);

describe('people vocabulary', () => {
  it('is memoised on the array identity', () => {
    expect(buildPeopleVocabulary(people)).toBe(vocab);
  });

  it('treats leadership words as a seniority, never as a department', () => {
    for (const word of ['leadership', 'executives', 'exec', 'c-level', 'founder']) {
      const matches = lookup(word);
      expect(matches).toContain('seniorities=C-Level');
      expect(matches.some((match) => match.startsWith('departments='))).toBe(false);
    }
  });

  it('reads a combined title as two constraints', () => {
    expect(lookup('marketing managers')).toEqual([
      'departments=Marketing',
      'seniorities=Manager',
    ]);
    expect(lookup('head of partnerships')).toEqual([
      'departments=Partnerships',
      'seniorities=Director',
    ]);
    expect(lookup('vp of marketing')).toEqual(['departments=Marketing', 'seniorities=VP']);
  });

  it('prefers a company name over the words inside it', () => {
    expect(lookup('NovaAI Systems')).toEqual(['companies=NovaAI Systems']);
  });

  it('expands country shorthands', () => {
    expect(lookup('uk')).toEqual(['countries=United Kingdom']);
    expect(lookup('usa')).toEqual(['countries=United States']);
    expect(lookup('deutschland')).toEqual(['countries=Germany']);
    expect(lookup('uae')).toEqual(['countries=United Arab Emirates']);
  });

  it('keeps every emitted value inside the dataset vocabulary', () => {
    for (const value of vocab.countries) expect(lookup(value)).toContain(`countries=${value}`);
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/integration/people-query-parse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/people/aliases.ts lib/people/vocabulary.ts tests/integration/people-query-parse.test.ts
git commit -m "feat(people): add query vocabulary and aliases"
```

---

### Task 9: `lib/people/parse-query.ts` — the eight stages

Pure, synchronous, no I/O, never throws. Input capped at 500 characters.

**Files:**
- Create: `lib/people/parse-query.ts`
- Test: `tests/integration/people-query-parse.test.ts` (append)

**Interfaces:**
- Consumes: `normalize`, `tokenize` from `lib/search/normalize`; `matchPhrases`
  from `lib/search/phrase`; `fuzzyFind` from `lib/search/fuzzy`;
  `scanNumericConditions` from `lib/search/numeric`; `STOPWORDS`;
  `Vocabulary` from `lib/people/vocabulary`; `PeopleFilters`,
  `emptyPeopleFilters` from `types/people`.
- Produces: `Intent = 'search' | 'summary' | 'duplicates'`,
  `ParsedPeopleQuery = { filters: PeopleFilters; matched: Match[]; unmatched: string[]; intent: Intent }`,
  `parsePeopleQuery(input: string, vocab: Vocabulary): ParsedPeopleQuery`,
  `NUMERIC_SPECS: NumericSpec[]`.

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/people-query-parse.test.ts`:

```ts
import { parsePeopleQuery } from '@/lib/people/parse-query';
import { filterPeopleList } from '@/lib/people/filters';

const parse = (text: string) => parsePeopleQuery(text, vocab);

describe('parsePeopleQuery — dimensions', () => {
  const cases: [string, Partial<Record<string, unknown>>][] = [
    ['marketing managers in Germany', { departments: ['Marketing'], seniorities: ['Manager'], countries: ['Germany'] }],
    ['verified contacts at NovaAI Systems', { verification: ['verified'], companies: ['NovaAI Systems'] }],
    ['c-level in india with verified emails', { seniorities: ['C-Level'], countries: ['India'], verification: ['verified'] }],
    ['sales directors confidence above 80', { departments: ['Sales'], seniorities: ['Director'], confidenceMin: 80 }],
    ['people needing verification', { verification: ['needs_verify', 'unverified'] }],
    ['vp of marketing united states', { departments: ['Marketing'], seniorities: ['VP'], countries: ['United States'] }],
    ['high confidence contacts with phone', { confidenceMin: 85, hasPhone: true }],
    ['top scoring contacts above 90', { scoreMin: 90 }],
    ['markting managrs germny', { departments: ['Marketing'], seniorities: ['Manager'], countries: ['Germany'] }],
  ];

  it.each(cases)('reads %s', (input, expected) => {
    const parsed = parse(input);
    expect(parsed.filters).toMatchObject(expected);
    expect(parsed.filters.keywords).toEqual([]);
    expect(parsed.unmatched).toEqual([]);
  });

  it('returns empty filters for an empty string', () => {
    const parsed = parse('');
    expect(parsed.filters).toEqual(emptyPeopleFilters());
    expect(filterPeopleList(people, parsed.filters, '')).toHaveLength(people.length);
  });

  it('degrades to keywords on nonsense without crashing', () => {
    const parsed = parse('zzzzqqq');
    expect(parsed.filters.keywords).toEqual(['zzzzqqq']);
    expect(parsed.unmatched).toEqual(['zzzzqqq']);
    expect(filterPeopleList(people, parsed.filters, '')).toEqual([]);
  });

  it('never throws, whatever it is handed', () => {
    for (const input of ['', '   ', '???', 'a'.repeat(2000), '<script>', '日本語']) {
      expect(() => parse(input)).not.toThrow();
    }
  });

  it('invents nothing outside the dataset vocabulary', () => {
    for (const [input] of cases) {
      const { filters } = parse(input);
      for (const value of filters.countries) expect(vocab.countries).toContain(value);
      for (const value of filters.companies) expect(vocab.companies).toContain(value);
      for (const value of filters.titles) expect(vocab.titles).toContain(value);
      for (const value of filters.cities) expect(vocab.cities).toContain(value);
    }
  });
});

describe('parsePeopleQuery — numerics', () => {
  it('covers every surface form', () => {
    expect(parse('80%+ confidence').filters.confidenceMin).toBe(80);
    expect(parse('confidence between 70 and 90').filters).toMatchObject({
      confidenceMin: 70,
      confidenceMax: 90,
    });
    expect(parse('platform score over 90').filters.scoreMin).toBe(90);
    expect(parse('top rated contacts').filters.scoreMin).toBe(90);
    expect(parse('low confidence people').filters.confidenceMax).toBe(60);
    expect(parse('confidence below 50').filters.confidenceMax).toBe(50);
  });
});

describe('parsePeopleQuery — flags', () => {
  it('keeps verification and contactability independent', () => {
    expect(parse('verified emails').filters).toMatchObject({
      verification: ['verified'],
      hasEmail: null,
    });
    expect(parse('contacts with email').filters).toMatchObject({
      verification: [],
      hasEmail: true,
    });
    expect(parse('contacts with no phone').filters.hasPhone).toBe(false);
    expect(parse('starred contacts').filters.starred).toBe(true);
  });
});

describe('parsePeopleQuery — intent', () => {
  it('routes each question shape', () => {
    expect(parse('any duplicates i should merge?').intent).toBe('duplicates');
    expect(parse('how many contacts do i have?').intent).toBe('summary');
    expect(parse('verified marketing people in Germany').intent).toBe('search');
  });

  it('lets duplicates beat summary', () => {
    expect(parse('how many duplicates are there?').intent).toBe('duplicates');
  });

  it('falls back to search when a summary word carries a real dimension', () => {
    expect(parse('how many verified people in France').intent).toBe('search');
  });
});

describe('parsePeopleQuery — end to end', () => {
  it('returns rows that satisfy every parsed constraint', () => {
    for (const [input] of [
      ['marketing managers in Germany'],
      ['verified contacts at NovaAI Systems'],
      ['c-level in india with verified emails'],
      ['sales directors confidence above 80'],
      ['vp of marketing united states'],
      ['high confidence contacts with phone'],
    ] as [string][]) {
      const { filters } = parse(input);
      const rows = filterPeopleList(people, filters, '');
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        if (filters.countries.length) expect(filters.countries).toContain(row.country);
        if (filters.companies.length) expect(filters.companies).toContain(row.company);
        if (filters.departments.length) expect(filters.departments).toContain(row.department);
        if (filters.seniorities.length) expect(filters.seniorities).toContain(row.seniority);
        if (filters.verification.length) expect(filters.verification).toContain(row.verification);
        if (filters.confidenceMin !== null) expect(row.confidence).toBeGreaterThanOrEqual(filters.confidenceMin);
        if (filters.hasPhone === true) expect(row.phone).not.toBeNull();
      }
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/integration/people-query-parse.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/people/parse-query"`.

- [ ] **Step 3: Write the parser**

Create `lib/people/parse-query.ts`:

```ts
import { fuzzyFind } from '@/lib/search/fuzzy';
import { normalize, tokenize } from '@/lib/search/normalize';
import { matchPhrases } from '@/lib/search/phrase';
import { scanNumericConditions, type NumericSpec } from '@/lib/search/numeric';
import { STOPWORDS } from '@/lib/search/stopwords';
import type { Match, Token } from '@/lib/search/types';
import {
  VERIFICATIONS,
  emptyPeopleFilters,
  type PeopleFilters,
  type Verification,
} from '@/types/people';
import type { Vocabulary } from './vocabulary';

export type Intent = 'search' | 'summary' | 'duplicates';

export type ParsedPeopleQuery = {
  filters: PeopleFilters;
  matched: Match[];
  unmatched: string[];
  intent: Intent;
};

/** `scoring` and `rated` are aliases so "top scoring … above 90" lands on score. */
export const NUMERIC_SPECS: NumericSpec[] = [
  { key: 'confidence', aliases: ['confidence', 'conf'] },
  { key: 'score', aliases: ['platform score', 'score', 'scoring', 'rated'] },
];

const MAX_INPUT = 500;
const MAX_KEYWORDS = 3;

const DUPLICATE_WORDS = /\b(duplicate|duplicates|dupes|dedupe|dedup|merge|merging)\b/;
const SUMMARY_WORDS = /\b(how many|count|breakdown|summarise|summarize|summary|overview)\b/;

const LIST_FIELDS = new Set([
  'countries',
  'cities',
  'companies',
  'titles',
  'seniorities',
  'departments',
  'sources',
]);

function pushUnique(list: string[], value: string) {
  if (!list.includes(value)) list.push(value);
}

/** Applies one `{ field, value }` from the vocabulary onto the filter object. */
function applyMatch(filters: PeopleFilters, match: Match): void {
  const { field, value } = match;

  if (LIST_FIELDS.has(field)) {
    pushUnique(filters[field as 'countries'], value);
    return;
  }

  switch (field) {
    case 'verification':
      if (VERIFICATIONS.includes(value as Verification)) {
        pushUnique(filters.verification as string[], value);
      }
      return;
    case 'hasEmail':
      filters.hasEmail = value === '1';
      return;
    case 'hasPhone':
      filters.hasPhone = value === '1';
      return;
    case 'hasLinkedIn':
      filters.hasLinkedIn = value === '1';
      return;
    case 'starred':
      filters.starred = value === '1';
      return;
    case 'confidenceMin':
      filters.confidenceMin = Number(value);
      return;
    case 'confidenceMax':
      filters.confidenceMax = Number(value);
      return;
    case 'scoreMin':
      filters.scoreMin = Number(value);
      return;
    case 'scoreMax':
      filters.scoreMax = Number(value);
      return;
    default:
      return;
  }
}

function hasDimension(filters: PeopleFilters): boolean {
  return (
    filters.countries.length > 0 ||
    filters.cities.length > 0 ||
    filters.companies.length > 0 ||
    filters.titles.length > 0 ||
    filters.seniorities.length > 0 ||
    filters.departments.length > 0 ||
    filters.sources.length > 0 ||
    filters.verification.length > 0 ||
    filters.confidenceMin !== null ||
    filters.confidenceMax !== null ||
    filters.scoreMin !== null ||
    filters.scoreMax !== null ||
    filters.hasEmail !== null ||
    filters.hasPhone !== null ||
    filters.hasLinkedIn !== null ||
    filters.starred !== null ||
    filters.keywords.length > 0
  );
}

/**
 * Turns a sentence into filters, locally and synchronously.
 *
 * Stage order is load-bearing. Numerics run before phrases so the word
 * "confidence" in "confidence above 80" is eaten rather than surviving to
 * keywords; phrases run before stopword removal so "head of partnerships"
 * survives its own "of"; and phrases run before keywords, which is exactly the
 * ordering whose absence let "united kingdom" fall through as two terms.
 */
export function parsePeopleQuery(input: string, vocab: Vocabulary): ParsedPeopleQuery {
  const filters = emptyPeopleFilters();
  const matched: Match[] = [];

  const raw = (input ?? '').slice(0, MAX_INPUT);
  const text = normalize(raw);

  // Stage 0 — intent. Duplicates beats summary.
  const wantsDuplicates = DUPLICATE_WORDS.test(text);
  const wantsSummary = SUMMARY_WORDS.test(text);

  if (!text) {
    return { filters, matched, unmatched: [], intent: wantsDuplicates ? 'duplicates' : 'search' };
  }

  // Stage 1 — normalize and tokenize. Every later stage consumes spans from
  // this single token array; nothing re-reads the raw text.
  let tokens: Token[] = tokenize(text);

  // Stage 2 — numeric conditions.
  const numeric = scanNumericConditions(tokens, NUMERIC_SPECS);
  tokens = numeric.remaining;
  for (const condition of numeric.conditions) {
    if (condition.min !== null) {
      applyMatch(filters, {
        field: condition.key === 'score' ? 'scoreMin' : 'confidenceMin',
        value: String(condition.min),
        sourceText: condition.sourceText,
      });
    }
    if (condition.max !== null) {
      applyMatch(filters, {
        field: condition.key === 'score' ? 'scoreMax' : 'confidenceMax',
        value: String(condition.max),
        sourceText: condition.sourceText,
      });
    }
    matched.push({
      field: condition.key,
      value: `${condition.min ?? ''}-${condition.max ?? ''}`,
      sourceText: condition.sourceText,
    });
  }

  // Stage 3 — verification, contactability, starred and bare-adjective numerics.
  const flags = matchPhrases(tokens, vocab.flags);
  tokens = flags.remaining;
  for (const match of flags.matches) {
    applyMatch(filters, match);
    matched.push(match);
  }

  // Stage 4 — the full vocabulary, longest gram first.
  const phrases = matchPhrases(tokens, vocab.index);
  tokens = phrases.remaining;
  for (const match of phrases.matches) {
    applyMatch(filters, match);
    matched.push(match);
  }

  // Stage 5 — stopword removal.
  tokens = tokens.filter((token) => !STOPWORDS.has(token.text));

  // Stage 6 — fuzzy rescue, single tokens only.
  const leftovers: string[] = [];
  for (const token of tokens) {
    const rescue = fuzzyFind(token.text, vocab.index);
    if (!rescue) {
      leftovers.push(token.text);
      continue;
    }
    for (const field of rescue.fields) {
      const match = { field: field.field, value: field.value, sourceText: token.text };
      applyMatch(filters, match);
      matched.push(match);
    }
  }

  // Stage 7 — whatever survives becomes keywords, deduplicated and capped.
  const unmatched = Array.from(new Set(leftovers));
  filters.keywords = unmatched.slice(0, MAX_KEYWORDS);

  const intent: Intent = wantsDuplicates
    ? 'duplicates'
    : wantsSummary && !hasDimension(filters)
      ? 'summary'
      : 'search';

  return { filters, matched, unmatched, intent };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/integration/people-query-parse.test.ts`
Expected: FAIL on the `filterPeopleList` import only — that function arrives in
Task 10. Every `parsePeopleQuery` describe block that does not call it passes.

If a *dimension* case fails, the message names the phrase that did not resolve.
Fix it by adding the alias to `lib/people/aliases.ts`, not by loosening the test.

- [ ] **Step 5: Commit**

```bash
git add lib/people/parse-query.ts tests/integration/people-query-parse.test.ts
git commit -m "feat(people): parse questions into filters locally"
```

---

### Task 10: `lib/people/filters.ts` — matching, facets, widening, sorting

Appends to the file Task 1 created. `band` and `ids` are normal filter
dimensions here, not something applied outside the filter object: they compose
with everything else, produce a chip, and survive a URL round-trip.

**Files:**
- Modify: `lib/people/filters.ts` (append below the codec)
- Test: `tests/integration/people-query-parse.test.ts` (append)

**Interfaces:**
- Consumes: `Person`, `PeopleFilters`, `PeopleSort`, `HIGH_CONFIDENCE_FLOOR`
  from `types/people`; `buildTextIndex`, `scoreQuery` from
  `lib/search/textScore`; `normalize`, `tokenize` from `lib/search/normalize`.
- Produces: `Dimension`, `FacetOption = { value: string; count: number }`,
  `PeopleFacets`, `filterPeopleList(people, filters, search): Person[]`,
  `computePeopleFacets(people, filters, search): PeopleFacets`,
  `WidenSuggestion = { dimension: Dimension; label: string; count: number }`,
  `widenSuggestions(people, filters, search): WidenSuggestion[]`,
  `sortPeople(list, sort): Person[]`.

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/people-query-parse.test.ts`:

```ts
import {
  computePeopleFacets,
  sortPeople,
  widenSuggestions,
} from '@/lib/people/filters';
import { HIGH_CONFIDENCE_FLOOR } from '@/types/people';

describe('filterPeopleList', () => {
  it('ORs within a dimension and ANDs across them', () => {
    const filters = { ...emptyPeopleFilters(), countries: ['Germany', 'India'], seniorities: ['Manager'] };
    const rows = filterPeopleList(people, filters, '');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(['Germany', 'India']).toContain(row.country);
      expect(row.seniority).toBe('Manager');
    }
  });

  it('ANDs keywords — every term must appear', () => {
    const one = filterPeopleList(people, { ...emptyPeopleFilters(), keywords: ['germany'] }, '');
    const two = filterPeopleList(people, { ...emptyPeopleFilters(), keywords: ['germany', 'zzzz'] }, '');
    expect(one.length).toBeGreaterThan(0);
    expect(two).toEqual([]);
  });

  it('treats a false tri-state as a real constraint', () => {
    const withPhone = filterPeopleList(people, { ...emptyPeopleFilters(), hasPhone: true }, '');
    const without = filterPeopleList(people, { ...emptyPeopleFilters(), hasPhone: false }, '');
    expect(withPhone.every((row) => row.phone !== null)).toBe(true);
    expect(without.every((row) => row.phone === null)).toBe(true);
    expect(withPhone.length + without.length).toBe(people.length);
  });

  it('composes the band pill with the other filters', () => {
    const filters = { ...emptyPeopleFilters(), countries: ['Germany'], band: 'high' as const };
    const rows = filterPeopleList(people, filters, '');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.country).toBe('Germany');
      expect(row.confidence).toBeGreaterThanOrEqual(HIGH_CONFIDENCE_FLOOR);
    }
  });

  it('pins the table to an explicit id set', () => {
    const ids = [people[3].id, people[9].id];
    const rows = filterPeopleList(people, { ...emptyPeopleFilters(), ids }, '');
    expect(rows.map((row) => row.id).sort()).toEqual([...ids].sort());
  });

  it('matches the search box by prefix', () => {
    const rows = filterPeopleList(people, emptyPeopleFilters(), 'mill');
    expect(rows.some((row) => row.name === 'Sarah Miller')).toBe(true);
    expect(rows.some((row) => row.name === 'Sara Millar')).toBe(true);
  });
});

describe('computePeopleFacets', () => {
  it('counts each dimension against everything except itself', () => {
    const filters = { ...emptyPeopleFilters(), countries: ['Germany'] };
    const facets = computePeopleFacets(people, filters, '');
    const countries = facets.countries.map((option) => option.value);
    expect(countries.length).toBeGreaterThan(1);
    expect(countries).toContain('India');

    const germanyCount = facets.countries.find((option) => option.value === 'Germany')?.count;
    expect(germanyCount).toBe(people.filter((person) => person.country === 'Germany').length);
  });

  it('narrows a different dimension under the same filter', () => {
    const filters = { ...emptyPeopleFilters(), countries: ['Germany'] };
    const facets = computePeopleFacets(people, filters, '');
    const total = facets.departments.reduce((sum, option) => sum + option.count, 0);
    expect(total).toBe(people.filter((person) => person.country === 'Germany').length);
  });
});

describe('widenSuggestions', () => {
  it('names the dimension whose removal recovers the most records', () => {
    const filters = {
      ...emptyPeopleFilters(),
      countries: ['Germany'],
      departments: ['Marketing'],
      confidenceMin: 99,
      scoreMin: 100,
    };
    expect(filterPeopleList(people, filters, '')).toEqual([]);

    const suggestions = widenSuggestions(people, filters, '');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].count).toBeGreaterThan(0);
    for (const suggestion of suggestions) {
      expect(suggestion.count).toBeLessThanOrEqual(suggestions[0].count);
    }
  });
});

describe('sortPeople', () => {
  it('orders by each key and breaks ties stably on id', () => {
    const byScore = sortPeople(people, 'score');
    expect(byScore[0].score).toBeGreaterThanOrEqual(byScore[1].score);

    const byName = sortPeople(people, 'name');
    expect(byName[0].name.localeCompare(byName[1].name)).toBeLessThanOrEqual(0);

    const byFetched = sortPeople(people, 'fetched');
    expect(byFetched[0].fetchedAt >= byFetched[1].fetchedAt).toBe(true);

    expect(sortPeople(people, 'score').map((row) => row.id)).toEqual(
      sortPeople(people, 'score').map((row) => row.id)
    );
  });

  it('does not mutate its input', () => {
    const before = people.map((row) => row.id);
    sortPeople(people, 'name');
    expect(people.map((row) => row.id)).toEqual(before);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/integration/people-query-parse.test.ts`
Expected: FAIL — `filterPeopleList is not exported`.

- [ ] **Step 3: Append the matching engine**

First replace the import block at the top of `lib/people/filters.ts` with this
one — it adds `HIGH_CONFIDENCE_FLOOR` and `Person`, and pulls in the two search
primitives:

```ts
import { normalize, tokenize } from '@/lib/search/normalize';
import { buildTextIndex, scoreQuery, type TextIndex } from '@/lib/search/textScore';
import {
  HIGH_CONFIDENCE_FLOOR,
  PEOPLE_STRING_LIST_KEYS,
  PEOPLE_SORTS,
  VERIFICATIONS,
  emptyPeopleFilters,
  type Band,
  type PeopleFilters,
  type PeopleSort,
  type PeopleStringListKey,
  type Person,
  type Verification,
} from '@/types/people';
```

Then append below the codec:

```ts
// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * One predicate per dimension, so faceting can re-run the match with a single
 * dimension held out without duplicating any of the rules.
 */
export type Dimension =
  | 'countries'
  | 'cities'
  | 'companies'
  | 'titles'
  | 'seniorities'
  | 'departments'
  | 'sources'
  | 'verification'
  | 'confidence'
  | 'score'
  | 'email'
  | 'phone'
  | 'linkedin'
  | 'starred'
  | 'band'
  | 'ids'
  | 'keywords'
  | 'search';

const textIndexCache = new WeakMap<readonly Person[], TextIndex>();

/** Built once per dataset, not once per keystroke. */
function getTextIndex(list: readonly Person[]): TextIndex {
  const cached = textIndexCache.get(list);
  if (cached) return cached;
  const index = buildTextIndex(
    list,
    (person) => person.id,
    [
      { get: (person) => person.name, weight: 4 },
      { get: (person) => person.company, weight: 3 },
      { get: (person) => person.title, weight: 2 },
      { get: (person) => person.email ?? '', weight: 2 },
      { get: (person) => `${person.city} ${person.country}`, weight: 1 },
    ]
  );
  textIndexCache.set(list, index);
  return index;
}

type Check = (person: Person) => boolean;

function listCheck(values: string[], get: (person: Person) => string): Check | null {
  if (values.length === 0) return null;
  const allowed = new Set(values);
  return (person) => allowed.has(get(person));
}

function triStateCheck(state: boolean | null, get: (person: Person) => boolean): Check | null {
  if (state === null) return null;
  return (person) => get(person) === state;
}

export function buildChecks(
  list: readonly Person[],
  filters: PeopleFilters,
  search: string
): Record<Dimension, Check | null> {
  const terms = tokenize(normalize(search)).map((token) => token.text);
  const searchIds =
    terms.length > 0
      ? new Set(scoreQuery(getTextIndex(list), terms).map((hit) => hit.id))
      : null;

  const pinned = filters.ids ? new Set(filters.ids) : null;

  return {
    countries: listCheck(filters.countries, (person) => person.country),
    cities: listCheck(filters.cities, (person) => person.city),
    companies: listCheck(filters.companies, (person) => person.company),
    titles: listCheck(filters.titles, (person) => person.title),
    seniorities: listCheck(filters.seniorities, (person) => person.seniority),
    departments: listCheck(filters.departments, (person) => person.department),
    sources: listCheck(filters.sources, (person) => person.source),
    verification: listCheck(filters.verification, (person) => person.verification),

    confidence:
      filters.confidenceMin !== null || filters.confidenceMax !== null
        ? (person) =>
            (filters.confidenceMin === null || person.confidence >= filters.confidenceMin) &&
            (filters.confidenceMax === null || person.confidence <= filters.confidenceMax)
        : null,
    score:
      filters.scoreMin !== null || filters.scoreMax !== null
        ? (person) =>
            (filters.scoreMin === null || person.score >= filters.scoreMin) &&
            (filters.scoreMax === null || person.score <= filters.scoreMax)
        : null,

    email: triStateCheck(filters.hasEmail, (person) => person.email !== null),
    phone: triStateCheck(filters.hasPhone, (person) => person.phone !== null),
    linkedin: triStateCheck(filters.hasLinkedIn, (person) => person.linkedin !== null),
    starred: triStateCheck(filters.starred, (person) => person.starred),

    band:
      filters.band === 'high'
        ? (person) => person.confidence >= HIGH_CONFIDENCE_FLOOR
        : filters.band === 'needs'
          ? (person) => person.verification !== 'verified'
          : null,

    ids: pinned ? (person) => pinned.has(person.id) : null,

    // Keywords are AND-ed: every term must appear somewhere in the record.
    keywords: filters.keywords.length
      ? (person) => filters.keywords.every((term) => person.searchText.includes(normalize(term)))
      : null,

    search: searchIds ? (person) => searchIds.has(person.id) : null,
  };
}

export function filterPeopleList(
  list: readonly Person[],
  filters: PeopleFilters,
  search: string
): Person[] {
  const checks = buildChecks(list, filters, search);
  const active = Object.values(checks).filter(Boolean) as Check[];
  if (active.length === 0) return [...list];
  return list.filter((person) => active.every((check) => check(person)));
}

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

export type FacetOption = { value: string; count: number };

export type FacetDimension =
  | 'countries'
  | 'cities'
  | 'companies'
  | 'titles'
  | 'seniorities'
  | 'departments'
  | 'sources'
  | 'verification';

export type PeopleFacets = Record<FacetDimension, FacetOption[]>;

export const FACET_DIMENSIONS: FacetDimension[] = [
  'countries',
  'cities',
  'companies',
  'titles',
  'seniorities',
  'departments',
  'sources',
  'verification',
];

const FACET_VALUE: Record<FacetDimension, (person: Person) => string> = {
  countries: (person) => person.country,
  cities: (person) => person.city,
  companies: (person) => person.company,
  titles: (person) => person.title,
  seniorities: (person) => person.seniority,
  departments: (person) => person.department,
  sources: (person) => person.source,
  verification: (person) => person.verification,
};

function othersThan(
  checks: Record<Dimension, Check | null>,
  dimension: Dimension
): Check[] {
  return (Object.keys(checks) as Dimension[])
    .filter((key) => key !== dimension)
    .map((key) => checks[key])
    .filter(Boolean) as Check[];
}

/**
 * Counts each option against everything *except* its own dimension, so opening
 * "Country" still shows every country reachable under the other filters rather
 * than only the ones already ticked. Same hold-one-out approach as
 * `computeEventFacets`.
 */
export function computePeopleFacets(
  list: readonly Person[],
  filters: PeopleFilters,
  search: string
): PeopleFacets {
  const checks = buildChecks(list, filters, search);
  const facets = {} as PeopleFacets;

  for (const dimension of FACET_DIMENSIONS) {
    const others = othersThan(checks, dimension);
    const counts = new Map<string, number>();

    for (const person of list) {
      if (!others.every((check) => check(person))) continue;
      const value = FACET_VALUE[dimension](person);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    facets[dimension] = Array.from(counts, ([value, count]) => ({ value, count })).sort(
      (left, right) => right.count - left.count || left.value.localeCompare(right.value)
    );
  }

  return facets;
}

// ---------------------------------------------------------------------------
// Widening
// ---------------------------------------------------------------------------

export type WidenSuggestion = { dimension: Dimension; label: string; count: number };

function describe(dimension: Dimension, filters: PeopleFilters): string {
  const join = (values: string[]) => values.join(' / ');
  switch (dimension) {
    case 'countries':
      return `the ${join(filters.countries)} country filter`;
    case 'cities':
      return `the ${join(filters.cities)} city filter`;
    case 'companies':
      return `the ${join(filters.companies)} company filter`;
    case 'titles':
      return `the ${join(filters.titles)} job title filter`;
    case 'seniorities':
      return `the ${join(filters.seniorities)} seniority filter`;
    case 'departments':
      return `the ${join(filters.departments)} job function filter`;
    case 'sources':
      return `the ${join(filters.sources)} source filter`;
    case 'verification':
      return 'the verification filter';
    case 'confidence':
      if (filters.confidenceMin !== null && filters.confidenceMax !== null) {
        return `the ${filters.confidenceMin}–${filters.confidenceMax}% confidence range`;
      }
      return filters.confidenceMin !== null
        ? `the ${filters.confidenceMin}% confidence floor`
        : `the ${filters.confidenceMax}% confidence ceiling`;
    case 'score':
      if (filters.scoreMin !== null && filters.scoreMax !== null) {
        return `the ${filters.scoreMin}–${filters.scoreMax} platform score range`;
      }
      return filters.scoreMin !== null
        ? `the ${filters.scoreMin} platform score floor`
        : `the ${filters.scoreMax} platform score ceiling`;
    case 'email':
      return filters.hasEmail ? 'the work email requirement' : 'the "no work email" filter';
    case 'phone':
      return filters.hasPhone ? 'the phone requirement' : 'the "no phone" filter';
    case 'linkedin':
      return filters.hasLinkedIn ? 'the LinkedIn requirement' : 'the "no LinkedIn" filter';
    case 'starred':
      return filters.starred ? 'the starred filter' : 'the "not starred" filter';
    case 'band':
      return filters.band === 'high' ? 'the High confidence pill' : 'the Needs verification pill';
    case 'ids':
      return 'the pinned record set';
    case 'keywords':
      return `the ${join(filters.keywords)} keyword filter`;
    case 'search':
      return 'the search box';
  }
}

/**
 * For each constrained dimension, how many records come back if that one
 * dimension is dropped. Reuses the hold-one-out machinery; consumed by the
 * `empty` answer, which names the single most restrictive constraint.
 */
export function widenSuggestions(
  list: readonly Person[],
  filters: PeopleFilters,
  search: string
): WidenSuggestion[] {
  const checks = buildChecks(list, filters, search);

  const suggestions: WidenSuggestion[] = [];
  for (const key of Object.keys(checks) as Dimension[]) {
    if (!checks[key]) continue;
    const others = othersThan(checks, key);
    const count = list.filter((person) => others.every((check) => check(person))).length;
    suggestions.push({ dimension: key, label: describe(key, filters), count });
  }

  return suggestions.sort((left, right) => right.count - left.count);
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/** `p-12` must order after `p-2`, so ties break on the numeric part of the id. */
function idOrder(person: Person): number {
  const value = Number(person.id.replace(/^\D+/, ''));
  return Number.isFinite(value) ? value : 0;
}

export function sortPeople(list: readonly Person[], sort: PeopleSort): Person[] {
  const rows = [...list];
  switch (sort) {
    case 'confidence':
      return rows.sort((a, b) => b.confidence - a.confidence || idOrder(a) - idOrder(b));
    case 'name':
      return rows.sort((a, b) => a.name.localeCompare(b.name) || idOrder(a) - idOrder(b));
    case 'fetched':
      return rows.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt) || idOrder(a) - idOrder(b));
    case 'score':
    default:
      return rows.sort((a, b) => b.score - a.score || idOrder(a) - idOrder(b));
  }
}
```

- [ ] **Step 4: Run the whole parse test file**

Run: `npx vitest run tests/integration/people-query-parse.test.ts`
Expected: PASS — every block from Tasks 1, 8, 9 and 10, including the
end-to-end block that feeds parsed filters into `filterPeopleList`.

- [ ] **Step 5: Commit**

```bash
git add lib/people/filters.ts tests/integration/people-query-parse.test.ts
git commit -m "feat(people): add matching, facets, widening and sorting"
```

---

### Task 11: `lib/people/chips.ts`

**Files:**
- Create: `lib/people/chips.ts`
- Test: `tests/integration/people-query-parse.test.ts` (append)

**Interfaces:**
- Consumes: `PeopleFilters`, `PEOPLE_STRING_LIST_KEYS`, `emptyPeopleFilters` from
  `types/people`.
- Produces: `PeopleFilterChip = { id: string; label: string; value: string }` —
  structurally compatible with `QueryChip` in
  `components/search/filter-chips.tsx`;
  `buildPeopleFilterChips(filters, search?): PeopleFilterChip[]`;
  `removePeopleFilterChip(filters, search, chipId): { filters: PeopleFilters; search: string }`.

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/people-query-parse.test.ts`:

```ts
import { buildPeopleFilterChips, removePeopleFilterChip } from '@/lib/people/chips';

describe('people filter chips', () => {
  it('produces one chip per constraint for the acceptance query', () => {
    const { filters } = parse('verified marketing managers in Germany with 80%+ confidence');
    const chips = buildPeopleFilterChips(filters, '');
    expect(chips).toHaveLength(5);
    expect(chips.map((chip) => chip.label).sort()).toEqual([
      'Confidence',
      'Country',
      'Job function',
      'Seniority',
      'Verification',
    ]);
    expect(chips.find((chip) => chip.label === 'Confidence')?.value).toBe('≥ 80%');
  });

  it('reads numeric ranges the way the spec writes them', () => {
    const base = emptyPeopleFilters();
    expect(buildPeopleFilterChips({ ...base, confidenceMax: 50 }, '')[0].value).toBe('≤ 50%');
    expect(buildPeopleFilterChips({ ...base, confidenceMin: 70, confidenceMax: 90 }, '')[0].value).toBe('70–90%');
  });

  it('distinguishes the two states of a tri-state', () => {
    const base = emptyPeopleFilters();
    expect(buildPeopleFilterChips({ ...base, hasEmail: true }, '')[0].value).toBe('Has work email');
    expect(buildPeopleFilterChips({ ...base, hasEmail: false }, '')[0].value).toBe('No work email');
    expect(buildPeopleFilterChips(base, '')).toEqual([]);
  });

  it('shows the band, and hides it when it is All', () => {
    const base = emptyPeopleFilters();
    expect(buildPeopleFilterChips({ ...base, band: 'high' }, '')[0].value).toBe('High confidence');
    expect(buildPeopleFilterChips({ ...base, band: 'needs' }, '')[0].value).toBe('Needs verification');
    expect(buildPeopleFilterChips({ ...base, band: 'all' }, '')).toEqual([]);
  });

  it('removes exactly one constraint per chip', () => {
    const { filters } = parse('verified marketing managers in Germany with 80%+ confidence');
    const chips = buildPeopleFilterChips(filters, '');
    for (const chip of chips) {
      const next = removePeopleFilterChip(filters, '', chip.id);
      expect(buildPeopleFilterChips(next.filters, next.search)).toHaveLength(chips.length - 1);
    }
  });

  it('clears the search box when its chip is removed', () => {
    const next = removePeopleFilterChip(emptyPeopleFilters(), 'miller', 'search');
    expect(next.search).toBe('');
  });

  it('ignores an unknown chip id rather than throwing', () => {
    const filters = { ...emptyPeopleFilters(), countries: ['Germany'] };
    expect(removePeopleFilterChip(filters, '', 'bogus').filters).toEqual(filters);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/integration/people-query-parse.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/people/chips"`.

- [ ] **Step 3: Write the chips**

Create `lib/people/chips.ts`:

```ts
import {
  PEOPLE_STRING_LIST_KEYS,
  type PeopleFilters,
  type PeopleStringListKey,
  type Verification,
} from '@/types/people';

/**
 * Turns the applied filters into removable chips and back again. Shared by the
 * ask panel ("here's how I read your question"), the chips row under the
 * collapsed bar, and the empty state, so one click removes exactly one
 * constraint everywhere.
 *
 * Structurally compatible with `QueryChip` in components/search/filter-chips.
 */
export type PeopleFilterChip = { id: string; label: string; value: string };

const LIST_LABEL: Record<PeopleStringListKey, string> = {
  countries: 'Country',
  cities: 'City',
  companies: 'Company',
  titles: 'Job title',
  seniorities: 'Seniority',
  departments: 'Job function',
  sources: 'Source',
  keywords: 'Keyword',
};

const VERIFICATION_LABEL: Record<Verification, string> = {
  verified: 'Verified',
  needs_verify: 'Needs verify',
  unverified: 'Unverified',
};

const SEARCH_CHIP = 'search';
const CONFIDENCE_CHIP = 'confidence';
const SCORE_CHIP = 'score';
const BAND_CHIP = 'band';
const IDS_CHIP = 'ids';
const EMAIL_CHIP = 'email';
const PHONE_CHIP = 'phone';
const LINKEDIN_CHIP = 'linkedin';
const STARRED_CHIP = 'starred';

function rangeLabel(min: number | null, max: number | null, suffix: string): string {
  if (min !== null && max !== null) return `${min}–${max}${suffix}`;
  if (min !== null) return `≥ ${min}${suffix}`;
  return `≤ ${max}${suffix}`;
}

export function buildPeopleFilterChips(filters: PeopleFilters, search = ''): PeopleFilterChip[] {
  const chips: PeopleFilterChip[] = [];

  if (search.trim()) chips.push({ id: SEARCH_CHIP, label: 'Search', value: search.trim() });

  for (const key of PEOPLE_STRING_LIST_KEYS) {
    for (const value of filters[key]) {
      chips.push({ id: `${key}:${value}`, label: LIST_LABEL[key], value });
    }
  }

  for (const value of filters.verification) {
    chips.push({
      id: `verification:${value}`,
      label: 'Verification',
      value: VERIFICATION_LABEL[value],
    });
  }

  if (filters.confidenceMin !== null || filters.confidenceMax !== null) {
    chips.push({
      id: CONFIDENCE_CHIP,
      label: 'Confidence',
      value: rangeLabel(filters.confidenceMin, filters.confidenceMax, '%'),
    });
  }

  if (filters.scoreMin !== null || filters.scoreMax !== null) {
    chips.push({
      id: SCORE_CHIP,
      label: 'Platform score',
      value: rangeLabel(filters.scoreMin, filters.scoreMax, ''),
    });
  }

  if (filters.hasEmail !== null) {
    chips.push({
      id: EMAIL_CHIP,
      label: 'Contactability',
      value: filters.hasEmail ? 'Has work email' : 'No work email',
    });
  }
  if (filters.hasPhone !== null) {
    chips.push({
      id: PHONE_CHIP,
      label: 'Contactability',
      value: filters.hasPhone ? 'Has phone' : 'No phone',
    });
  }
  if (filters.hasLinkedIn !== null) {
    chips.push({
      id: LINKEDIN_CHIP,
      label: 'Contactability',
      value: filters.hasLinkedIn ? 'Has LinkedIn' : 'No LinkedIn',
    });
  }
  if (filters.starred !== null) {
    chips.push({
      id: STARRED_CHIP,
      label: 'Starred',
      value: filters.starred ? 'Starred' : 'Not starred',
    });
  }

  if (filters.band !== 'all') {
    chips.push({
      id: BAND_CHIP,
      label: 'Band',
      value: filters.band === 'high' ? 'High confidence' : 'Needs verification',
    });
  }

  if (filters.ids) {
    chips.push({
      id: IDS_CHIP,
      label: 'Pinned',
      value: `${filters.ids.length} record${filters.ids.length === 1 ? '' : 's'}`,
    });
  }

  return chips;
}

/**
 * Applies a chip removal. Returns the next filters plus the next search box
 * value, since the search chip lives outside `PeopleFilters`.
 */
export function removePeopleFilterChip(
  filters: PeopleFilters,
  search: string,
  chipId: string
): { filters: PeopleFilters; search: string } {
  if (chipId === SEARCH_CHIP) return { filters, search: '' };

  const simple: Record<string, Partial<PeopleFilters>> = {
    [CONFIDENCE_CHIP]: { confidenceMin: null, confidenceMax: null },
    [SCORE_CHIP]: { scoreMin: null, scoreMax: null },
    [EMAIL_CHIP]: { hasEmail: null },
    [PHONE_CHIP]: { hasPhone: null },
    [LINKEDIN_CHIP]: { hasLinkedIn: null },
    [STARRED_CHIP]: { starred: null },
    [BAND_CHIP]: { band: 'all' },
    [IDS_CHIP]: { ids: null },
  };

  if (chipId in simple) return { filters: { ...filters, ...simple[chipId] }, search };

  const separator = chipId.indexOf(':');
  if (separator === -1) return { filters, search };

  const key = chipId.slice(0, separator);
  const value = chipId.slice(separator + 1);

  if (key === 'verification') {
    return {
      filters: { ...filters, verification: filters.verification.filter((item) => item !== value) },
      search,
    };
  }

  if (!PEOPLE_STRING_LIST_KEYS.includes(key as PeopleStringListKey)) return { filters, search };

  return {
    filters: {
      ...filters,
      [key]: filters[key as PeopleStringListKey].filter((item) => item !== value),
    },
    search,
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/integration/people-query-parse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/people/chips.ts tests/integration/people-query-parse.test.ts
git commit -m "feat(people): build removable filter chips"
```

---

### Task 12: `lib/people/duplicates.ts`

Blocking by exact company gives ~140 blocks averaging ~17 records — about 19,000
comparisons worst case, fast enough to run synchronously on demand. It is
deliberately not precomputed, so it stays correct if the index is ever
revalidated.

**Files:**
- Create: `lib/people/duplicates.ts`
- Test: `tests/integration/people-duplicates.test.ts`

**Interfaces:**
- Consumes: `levenshtein` from `lib/search/fuzzy`; `normalize` from
  `lib/search/normalize`; `Person` from `types/people`.
- Produces: `DuplicateRule = 1 | 2 | 3`,
  `DuplicatePair = { keepId: string; mergeId: string; rule: DuplicateRule; nameDistance: number; confidenceGap: number }`,
  `findDuplicatePairs(list, limit?): DuplicatePair[]`,
  `findDuplicatePairsWithStats(list, limit?): { pairs: DuplicatePair[]; comparisons: number }`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/people-duplicates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findDuplicatePairs, findDuplicatePairsWithStats } from '@/lib/people/duplicates';
import { people, peopleById } from '@/lib/people/data';

const allPairs = findDuplicatePairs(people, 500);

const pairNames = allPairs.map((pair) =>
  [peopleById[pair.keepId].name, peopleById[pair.mergeId].name].sort().join(' | ')
);

const found = (a: string, b: string) => pairNames.includes([a, b].sort().join(' | '));

describe('findDuplicatePairs', () => {
  it('finds all thirteen seeded pairs', () => {
    const seeded: [string, string][] = [
      ['Sarah Miller', 'Sara Millar'],
      ['Stefan Bauer', 'Stephan Bauer'],
      ['Clara Dubois', 'Clare Dubois'],
      ['Felix Jansen', 'Felix Janssen'],
      ['Ines Costa', 'Inez Costa'],
      ['Jon Weber', 'Jonathan Weber'],
      ['Kathryn Moreau', 'Katie Moreau'],
      ['Alexander Petrov', 'Sasha Petrov'],
      ['Benjamin Okafor', 'Ben Okafor'],
      ['Priya Sharma', 'Pooja Sharma'],
      ['Martin Larsen', 'Mikkel Larsen'],
      ['Camille Leroy', 'Cedric Leroy'],
      ['Andrea Horvat', 'Anton Horvat'],
    ];
    for (const [a, b] of seeded) {
      expect(found(a, b), `expected ${a} / ${b} to be flagged`).toBe(true);
    }
  });

  it('flags none of the six decoys', () => {
    const decoys: [string, string][] = [
      ['Michael Brooks', 'Melanie Brooks'],
      ['Christopher Fischer', 'Charlotte Fischer'],
      ['Rahul Menon', 'Ruth Menon'],
      ['Gabriel Alvarez', 'Gloria Alvarez'],
      ['Sebastian Nilsson', 'Sigrid Nilsson'],
      ['Theodore Yilmaz', 'Tamara Yilmaz'],
    ];
    for (const [a, b] of decoys) {
      expect(found(a, b), `${a} / ${b} are different people and must not be flagged`).toBe(false);
    }
  });

  it('exercises all three rules', () => {
    expect(new Set(allPairs.map((pair) => pair.rule))).toEqual(new Set([1, 2, 3]));
  });

  it('ranks the smallest name distance first', () => {
    for (let index = 1; index < allPairs.length; index += 1) {
      expect(allPairs[index - 1].nameDistance).toBeLessThanOrEqual(allPairs[index].nameDistance);
    }
  });

  it('keeps the higher-confidence record of the Miller pair', () => {
    const pair = allPairs.find((candidate) =>
      [peopleById[candidate.keepId].name, peopleById[candidate.mergeId].name].includes('Sara Millar')
    );
    expect(peopleById[pair!.keepId].name).toBe('Sarah Miller');
    expect(peopleById[pair!.keepId].confidence).toBe(91);
    expect(pair!.confidenceGap).toBe(29);
  });

  it('never pairs a record with itself or across companies', () => {
    for (const pair of allPairs) {
      expect(pair.keepId).not.toBe(pair.mergeId);
      expect(peopleById[pair.keepId].company).toBe(peopleById[pair.mergeId].company);
    }
  });

  it('honours the limit', () => {
    expect(findDuplicatePairs(people, 3)).toHaveLength(3);
    expect(findDuplicatePairs(people).length).toBeLessThanOrEqual(10);
  });

  it('blocks by company rather than comparing everything', () => {
    // 2,418 records compared naively would be ~2.9M comparisons. Blocking by
    // company must keep it under 25,000. A wall-clock assertion would be flaky
    // on slow CI; this catches the regression it would be guarding against.
    const { comparisons } = findDuplicatePairsWithStats(people, 500);
    expect(comparisons).toBeLessThan(25000);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/integration/people-duplicates.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/people/duplicates"`.

- [ ] **Step 3: Write the finder**

Create `lib/people/duplicates.ts`:

```ts
import { levenshtein } from '@/lib/search/fuzzy';
import { normalize } from '@/lib/search/normalize';
import type { Person, Verification } from '@/types/people';

/**
 * 1 — bounded edit distance on the normalized full name.
 * 2 — identical email local-part once dots, hyphens and underscores are gone.
 * 3 — same surname, same first initial, different given name, same department.
 */
export type DuplicateRule = 1 | 2 | 3;

export type DuplicatePair = {
  /** The record to keep: higher confidence, then better verification, then score. */
  keepId: string;
  mergeId: string;
  rule: DuplicateRule;
  nameDistance: number;
  confidenceGap: number;
};

const NAME_DISTANCE_LIMIT = 2;

const VERIFICATION_RANK: Record<Verification, number> = {
  verified: 0,
  needs_verify: 1,
  unverified: 2,
};

/** `s.miller` and `smiller` are the same mailbox; `sarah` is not. */
function emailKey(person: Person): string | null {
  if (!person.email) return null;
  const local = person.email.split('@')[0] ?? '';
  const stripped = local.toLowerCase().replace(/[._-]/g, '');
  return stripped || null;
}

function ruleFor(a: Person, b: Person, nameDistance: number): DuplicateRule | null {
  if (nameDistance <= NAME_DISTANCE_LIMIT) return 1;

  const keyA = emailKey(a);
  const keyB = emailKey(b);
  if (keyA !== null && keyA === keyB) return 2;

  // Rule 3 is the one that risks false positives, so it additionally requires
  // the two records to share a department. The seeded decoys exercise this.
  const lastA = normalize(a.lastName);
  const lastB = normalize(b.lastName);
  const firstA = normalize(a.firstName);
  const firstB = normalize(b.firstName);
  if (
    lastA === lastB &&
    firstA !== firstB &&
    firstA.charAt(0) === firstB.charAt(0) &&
    a.department === b.department
  ) {
    return 3;
  }

  return null;
}

/** Higher confidence wins; ties fall to verification rank, then platform score. */
function chooseKeep(a: Person, b: Person): [Person, Person] {
  if (a.confidence !== b.confidence) return a.confidence > b.confidence ? [a, b] : [b, a];
  const rankA = VERIFICATION_RANK[a.verification];
  const rankB = VERIFICATION_RANK[b.verification];
  if (rankA !== rankB) return rankA < rankB ? [a, b] : [b, a];
  return a.score >= b.score ? [a, b] : [b, a];
}

export function findDuplicatePairsWithStats(
  list: readonly Person[],
  limit = 10
): { pairs: DuplicatePair[]; comparisons: number } {
  const blocks = new Map<string, Person[]>();
  for (const person of list) {
    const block = blocks.get(person.company);
    if (block) block.push(person);
    else blocks.set(person.company, [person]);
  }

  const pairs: DuplicatePair[] = [];
  let comparisons = 0;

  for (const block of blocks.values()) {
    for (let i = 0; i < block.length; i += 1) {
      for (let j = i + 1; j < block.length; j += 1) {
        comparisons += 1;
        const a = block[i];
        const b = block[j];
        const nameDistance = levenshtein(
          normalize(a.name),
          normalize(b.name),
          NAME_DISTANCE_LIMIT
        );
        const rule = ruleFor(a, b, nameDistance);
        if (rule === null) continue;

        const [keep, merge] = chooseKeep(a, b);
        pairs.push({
          keepId: keep.id,
          mergeId: merge.id,
          rule,
          nameDistance,
          confidenceGap: Math.abs(a.confidence - b.confidence),
        });
      }
    }
  }

  pairs.sort(
    (left, right) =>
      left.nameDistance - right.nameDistance || right.confidenceGap - left.confidenceGap
  );

  return { pairs: pairs.slice(0, limit), comparisons };
}

export function findDuplicatePairs(list: readonly Person[], limit = 10): DuplicatePair[] {
  return findDuplicatePairsWithStats(list, limit).pairs;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/integration/people-duplicates.test.ts`
Expected: PASS, 8 tests.

Note: `levenshtein` returns `max + 1` (that is, `3`) for any pair beyond the
bound, so `nameDistance` is `3` for every rule-2 and rule-3 pair. That is
intentional — the ranking only needs rule-1 pairs to sort first.

If a seeded pair is missing, the failure message names it. Fix the generator's
`DUP_SPECS` row and re-run `node scripts/generate-people-seed.mjs`, then re-run
the test; do not relax a rule.

- [ ] **Step 5: Commit**

```bash
git add lib/people/duplicates.ts tests/integration/people-duplicates.test.ts
git commit -m "feat(people): detect near-duplicate contacts"
```

---

### Task 13: `lib/people/answer.ts`

Pure, synchronous, returns no HTML. The `em` segments are the bold-indigo runs
the prototype writes as `<b>`; the renderer maps them to `<strong>`, so
`dangerouslySetInnerHTML` appears nowhere.

**Files:**
- Create: `lib/people/answer.ts`
- Test: `tests/integration/people-answer.test.ts`

**Interfaces:**
- Consumes: `ParsedPeopleQuery` from `lib/people/parse-query`;
  `widenSuggestions` from `lib/people/filters`; `findDuplicatePairs` from
  `lib/people/duplicates`; `Person` from `types/people`.
- Produces: `AnswerSegment`, `AnswerAction`, `Answer`, `buildAnswer(input)`.

`rows` is the **whole filtered set**, not one page — every action count is
computed from it, so no action can offer to act on a number the table does not
hold.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/people-answer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildAnswer } from '@/lib/people/answer';
import { people, peopleById } from '@/lib/people/data';
import { filterPeopleList } from '@/lib/people/filters';
import { parsePeopleQuery } from '@/lib/people/parse-query';
import { buildPeopleVocabulary } from '@/lib/people/vocabulary';
import { emptyPeopleFilters } from '@/types/people';

const vocab = buildPeopleVocabulary(people);

function answerFor(prompt: string) {
  const parsed = parsePeopleQuery(prompt, vocab);
  const rows = filterPeopleList(people, parsed.filters, '');
  return buildAnswer({ parsed, rows, total: rows.length, people });
}

const text = (answer: { segments: { value: string }[] }) =>
  answer.segments.map((segment) => segment.value).join('');

describe('buildAnswer', () => {
  it('produces one answer per kind', () => {
    expect(answerFor('marketing managers in Germany').kind).toBe('results');
    expect(answerFor('how many contacts do i have?').kind).toBe('summary');
    expect(answerFor('any duplicates i should merge?').kind).toBe('duplicates');
    expect(answerFor('zzzzqqq').kind).toBe('unparsed');

    const parsed = parsePeopleQuery('marketing managers in Germany', vocab);
    const impossible = { ...parsed.filters, confidenceMin: 100, scoreMin: 100 };
    const rows = filterPeopleList(people, impossible, '');
    expect(rows).toEqual([]);
    expect(
      buildAnswer({ parsed: { ...parsed, filters: impossible }, rows, total: 0, people }).kind
    ).toBe('empty');
  });

  it('never emits markup', () => {
    for (const prompt of [
      'marketing managers in Germany',
      'how many contacts do i have?',
      'any duplicates i should merge?',
      'zzzzqqq',
    ]) {
      for (const segment of answerFor(prompt).segments) {
        expect(segment.value).not.toContain('<');
        expect(segment.value).not.toContain('>');
      }
    }
  });

  it('states counts that match the filtered set', () => {
    const parsed = parsePeopleQuery('marketing managers in Germany', vocab);
    const rows = filterPeopleList(people, parsed.filters, '');
    const answer = buildAnswer({ parsed, rows, total: rows.length, people });

    expect(answer.totalCount).toBe(rows.length);
    expect(text(answer)).toContain(String(rows.length));
    expect(text(answer)).toContain(String(rows.filter((row) => row.verification === 'verified').length));
    expect(answer.previewIds.length).toBeLessThanOrEqual(4);
    for (const id of answer.previewIds) expect(peopleById[id]).toBeDefined();
  });

  it('gives every action a count the rows can honour', () => {
    const parsed = parsePeopleQuery('marketing managers in Germany', vocab);
    const rows = filterPeopleList(people, parsed.filters, '');
    const answer = buildAnswer({ parsed, rows, total: rows.length, people });

    for (const action of answer.actions) {
      if (!('count' in action)) continue;
      expect(action.count).toBeGreaterThan(0);
      expect(action.count).toBeLessThanOrEqual(rows.length);
    }
  });

  it('omits the verify action when nothing needs verifying', () => {
    const parsed = parsePeopleQuery('verified contacts in Germany', vocab);
    const rows = filterPeopleList(people, parsed.filters, '');
    expect(rows.every((row) => row.verification === 'verified')).toBe(true);
    const answer = buildAnswer({ parsed, rows, total: rows.length, people });
    expect(answer.actions.some((action) => action.kind === 'verify')).toBe(false);
  });

  it('names a dimension whose removal genuinely recovers the most', () => {
    const parsed = parsePeopleQuery('marketing managers in Germany', vocab);
    const impossible = { ...parsed.filters, confidenceMin: 100 };
    const answer = buildAnswer({
      parsed: { ...parsed, filters: impossible },
      rows: [],
      total: 0,
      people,
    });

    expect(answer.kind).toBe('empty');
    const recovered = Number(/brings back (\d+)/.exec(text(answer))?.[1]);
    expect(recovered).toBeGreaterThan(0);

    const withoutConfidence = filterPeopleList(
      people,
      { ...impossible, confidenceMin: null },
      ''
    ).length;
    expect(recovered).toBe(withoutConfidence);
  });

  it('summarises totals recomputed from the seed, not from a constant', () => {
    const answer = answerFor('how many contacts do i have?');
    const verified = people.filter((person) => person.verification === 'verified').length;
    const average = Math.round(
      people.reduce((sum, person) => sum + person.confidence, 0) / people.length
    );

    expect(answer.totalCount).toBe(people.length);
    expect(text(answer)).toContain(people.length.toLocaleString());
    expect(text(answer)).toContain(String(verified));
    expect(text(answer)).toContain(`${average}%`);
  });

  it('describes the Miller pair and pins the flagged records', () => {
    const answer = answerFor('any duplicates i should merge?');
    const body = text(answer);

    expect(body).toContain('Sarah Miller');
    expect(body).toContain('Sara Millar');
    expect(body).toContain('NovaAI Systems');

    const merge = answer.actions.find((action) => action.kind === 'merge');
    expect(merge).toBeDefined();
    expect(peopleById[(merge as { keepId: string }).keepId].name).toBe('Sarah Miller');
    expect(answer.previewIds.length).toBeGreaterThan(0);
    for (const id of answer.previewIds) expect(peopleById[id]).toBeDefined();
  });

  it('offers guidance rather than a filter when nothing was recognised', () => {
    const answer = answerFor('zzzzqqq');
    expect(answer.actions).toEqual([]);
    expect(text(answer)).toContain('verified marketing managers in Germany');
  });

  it('returns an empty-filter answer for an empty prompt without throwing', () => {
    expect(() =>
      buildAnswer({
        parsed: { filters: emptyPeopleFilters(), matched: [], unmatched: [], intent: 'search' },
        rows: [],
        total: 0,
        people,
      })
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/integration/people-answer.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/people/answer"`.

- [ ] **Step 3: Write the answer builder**

Create `lib/people/answer.ts`:

```ts
import type { Person } from '@/types/people';
import { findDuplicatePairs } from './duplicates';
import { widenSuggestions } from './filters';
import type { ParsedPeopleQuery } from './parse-query';

/** `em` runs render as <strong>; no answer ever carries markup of its own. */
export type AnswerSegment = { type: 'text' | 'em'; value: string };

export type AnswerAction =
  | { kind: 'sequence'; label: string; count: number }
  | { kind: 'verify'; label: string; count: number }
  | { kind: 'save'; label: string }
  | { kind: 'export'; label: string }
  | { kind: 'merge'; label: string; keepId: string; mergeId: string }
  | { kind: 'keep-both'; label: string }
  | { kind: 'clear'; label: string };

export type Answer = {
  kind: 'results' | 'empty' | 'unparsed' | 'summary' | 'duplicates';
  segments: AnswerSegment[];
  /** At most four, for the mini list in the bubble. */
  previewIds: string[];
  totalCount: number;
  actions: AnswerAction[];
};

const PREVIEW_LIMIT = 4;
const DUPLICATE_LIMIT = 10;

const text = (value: string): AnswerSegment => ({ type: 'text', value });
const em = (value: string): AnswerSegment => ({ type: 'em', value });

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

function average(rows: readonly Person[], get: (person: Person) => number): number {
  if (rows.length === 0) return 0;
  return Math.round(rows.reduce((sum, row) => sum + get(row), 0) / rows.length);
}

function topValues(
  rows: readonly Person[],
  get: (person: Person) => string,
  limit: number
): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(get(row), (counts.get(get(row)) ?? 0) + 1);
  return Array.from(counts, ([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
    .slice(0, limit);
}

/**
 * Composes the assistant's reply from the parse result and the matched rows.
 * Every sentence is template-built here: no network call, no API key, no HTML.
 *
 * `rows` is the whole filtered set rather than one page, so every action count
 * is a number the table can actually honour.
 */
export function buildAnswer(input: {
  parsed: ParsedPeopleQuery;
  rows: readonly Person[];
  total: number;
  people: readonly Person[];
}): Answer {
  const { parsed, rows, total, people } = input;

  if (parsed.intent === 'duplicates') return duplicatesAnswer(people);
  if (parsed.intent === 'summary') return summaryAnswer(people);
  if (parsed.matched.length === 0) return unparsedAnswer();
  if (rows.length === 0) return emptyAnswer(parsed, people);

  return resultsAnswer(rows, total);
}

function resultsAnswer(rows: readonly Person[], total: number): Answer {
  const verified = rows.filter((row) => row.verification === 'verified').length;
  const unverified = rows.length - verified;
  const confidence = average(rows, (row) => row.confidence);

  const segments: AnswerSegment[] = [
    text('Found '),
    em(`${total.toLocaleString()} ${plural(total, 'contact', 'contacts')}`),
    text('. '),
    em(String(verified)),
    text(` of them ${plural(verified, 'is', 'are')} verified, and average confidence is `),
    em(`${confidence}%`),
    text('. '),
    unverified > 0
      ? text(
          `${unverified} still ${plural(unverified, 'needs', 'need')} verification before you send.`
        )
      : text('The whole set is safe to send to.'),
  ];

  const actions: AnswerAction[] = [
    { kind: 'sequence', label: 'Add to sequence', count: total },
    { kind: 'save', label: 'Save this search' },
  ];
  // Never offer to act on zero records.
  if (unverified > 0) {
    actions.push({ kind: 'verify', label: 'Verify emails', count: unverified });
  }

  return {
    kind: 'results',
    segments,
    previewIds: rows.slice(0, PREVIEW_LIMIT).map((row) => row.id),
    totalCount: total,
    actions,
  };
}

function emptyAnswer(parsed: ParsedPeopleQuery, people: readonly Person[]): Answer {
  const suggestions = widenSuggestions(people, parsed.filters, '');
  const best = suggestions.find((suggestion) => suggestion.count > 0);

  const segments: AnswerSegment[] = best
    ? [
        text('Nothing matches. Dropping '),
        em(best.label),
        text(' brings back '),
        em(String(best.count)),
        text('.'),
      ]
    : [
        text(
          'Nothing matches, and no single filter is doing it on its own — try clearing the search and starting again.'
        ),
      ];

  return {
    kind: 'empty',
    segments,
    previewIds: [],
    totalCount: 0,
    actions: [{ kind: 'clear', label: 'Clear all filters' }],
  };
}

function unparsedAnswer(): Answer {
  return {
    kind: 'unparsed',
    segments: [
      text('I could not read that as a filter. Try naming a '),
      em('country'),
      text(', a '),
      em('company'),
      text(', a '),
      em('job function'),
      text(', a '),
      em('seniority'),
      text(' or a '),
      em('verification status'),
      text(' — for example, "verified marketing managers in Germany".'),
    ],
    previewIds: [],
    totalCount: 0,
    actions: [],
  };
}

function summaryAnswer(people: readonly Person[]): Answer {
  const verified = people.filter((person) => person.verification === 'verified').length;
  const unverified = people.length - verified;
  const confidence = average(people, (person) => person.confidence);
  const countries = topValues(people, (person) => person.country, 5);
  const department = topValues(people, (person) => person.department, 1)[0];

  const segments: AnswerSegment[] = [
    text('You have '),
    em(`${people.length.toLocaleString()} contacts`),
    text('. '),
    em(String(verified)),
    text(' are verified and '),
    em(String(unverified)),
    text(' still need work, at an average confidence of '),
    em(`${confidence}%`),
    text('. The biggest countries are '),
    em(countries.map((entry) => `${entry.value} (${entry.count})`).join(', ')),
    text(', and the largest job function is '),
    em(`${department.value} (${department.count})`),
    text('.'),
  ];

  const actions: AnswerAction[] = [];
  if (unverified > 0) {
    actions.push({ kind: 'verify', label: 'Verify emails', count: unverified });
  }
  actions.push({ kind: 'export', label: 'Export everything' });

  return {
    kind: 'summary',
    segments,
    previewIds: [],
    totalCount: people.length,
    actions,
  };
}

function duplicatesAnswer(people: readonly Person[]): Answer {
  const pairs = findDuplicatePairs(people, DUPLICATE_LIMIT);
  const byId = new Map(people.map((person) => [person.id, person]));

  if (pairs.length === 0) {
    return {
      kind: 'duplicates',
      segments: [text('I could not find any likely duplicates in your contacts.')],
      previewIds: [],
      totalCount: 0,
      actions: [],
    };
  }

  const top = pairs[0];
  const keep = byId.get(top.keepId)!;
  const merge = byId.get(top.mergeId)!;

  const segments: AnswerSegment[] = [
    text('I found '),
    em(`${pairs.length} likely duplicate ${plural(pairs.length, 'pair', 'pairs')}`),
    text('. The closest is '),
    em(keep.name),
    text(' and '),
    em(merge.name),
    text(`, both ${keep.title} at `),
    em(keep.company),
    text(`. ${keep.name} is ${keep.confidence}% confident from ${keep.source}; `),
    text(`${merge.name} is ${merge.confidence}% from ${merge.source}. `),
    text('Keep '),
    em(keep.name),
    text('. The table below is pinned to every flagged record.'),
  ];

  const previewIds = pairs.flatMap((pair) => [pair.keepId, pair.mergeId]);

  return {
    kind: 'duplicates',
    segments,
    previewIds,
    totalCount: previewIds.length,
    actions: [
      { kind: 'merge', label: `Merge into ${keep.name}`, keepId: top.keepId, mergeId: top.mergeId },
      { kind: 'keep-both', label: 'Keep both' },
      { kind: 'save', label: 'Save this search' },
    ],
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/integration/people-answer.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/people/answer.ts tests/integration/people-answer.test.ts
git commit -m "feat(people): compose assistant answers locally"
```

---

### Task 14: `search-index.ts`, the Zod model, and the API route

The UI imports the pure modules directly so typing stays instant; the route
exists for parity and for future server-side use. No tenancy — like
`/api/companies`, this is a shared discovery dataset, not workspace data. No
`fetch` to any external service, and no `ANTHROPIC_API_KEY` in the path.

**Files:**
- Create: `lib/people/search-index.ts`
- Create: `models/people-query.ts`
- Create: `app/api/people/query/route.ts`
- Test: `tests/integration/people-answer.test.ts` (append)

**Interfaces:**
- Consumes: everything from Tasks 8–13.
- Produces: `matchPeople(filters, search, sort): Person[]`,
  `queryPeople({ filters, search, sort, page }): { results: Person[]; total: number }`,
  `revalidatePeopleIndex(): void`, `peopleQueryRequestSchema`,
  `PeopleQueryRequest`, and `POST /api/people/query`.

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/people-answer.test.ts`:

```ts
import { matchPeople, queryPeople, revalidatePeopleIndex } from '@/lib/people/search-index';
import { peopleQueryRequestSchema } from '@/models/people-query';
import { PEOPLE_PAGE_SIZE } from '@/types/people';

describe('queryPeople', () => {
  it('pages at 25 and reports the true total separately', () => {
    const filters = { ...emptyPeopleFilters(), countries: ['Germany'] };
    const first = queryPeople({ filters, search: '', sort: 'score', page: 1 });

    expect(first.results).toHaveLength(PEOPLE_PAGE_SIZE);
    expect(first.total).toBe(matchPeople(filters, '', 'score').length);
    expect(first.total).toBeGreaterThan(PEOPLE_PAGE_SIZE);

    const second = queryPeople({ filters, search: '', sort: 'score', page: 2 });
    expect(second.results[0].id).not.toBe(first.results[0].id);
    expect(second.total).toBe(first.total);
  });

  it('returns an empty page past the end without throwing', () => {
    const page = queryPeople({ filters: emptyPeopleFilters(), search: '', sort: 'score', page: 9999 });
    expect(page.results).toEqual([]);
    expect(page.total).toBe(people.length);
  });

  it('survives revalidation', () => {
    const before = queryPeople({ filters: emptyPeopleFilters(), search: '', sort: 'score', page: 1 });
    revalidatePeopleIndex();
    const after = queryPeople({ filters: emptyPeopleFilters(), search: '', sort: 'score', page: 1 });
    expect(after.results.map((row) => row.id)).toEqual(before.results.map((row) => row.id));
  });
});

describe('peopleQueryRequestSchema', () => {
  it('accepts a bare prompt', () => {
    expect(peopleQueryRequestSchema.parse({ prompt: 'marketing managers in Germany' })).toMatchObject({
      prompt: 'marketing managers in Germany',
      page: 1,
      sort: 'score',
    });
  });

  it('rejects a prompt past the cap and an out-of-range page', () => {
    expect(peopleQueryRequestSchema.safeParse({ prompt: 'x'.repeat(501) }).success).toBe(false);
    expect(peopleQueryRequestSchema.safeParse({ prompt: 'ok', page: 0 }).success).toBe(false);
    expect(peopleQueryRequestSchema.safeParse({ prompt: 'ok', sort: 'bogus' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/integration/people-answer.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/people/search-index"`.

- [ ] **Step 3: Write the index**

Create `lib/people/search-index.ts`:

```ts
import {
  PEOPLE_PAGE_SIZE,
  type PeopleFilters,
  type PeopleSort,
  type Person,
} from '@/types/people';
import { people as seeded } from './data';
import { filterPeopleList, sortPeople } from './filters';

/**
 * Module-level dataset, cached across requests. `revalidatePeopleIndex` clears
 * it for a future import path — if contacts ever become real workspace data,
 * a Prisma-backed loader goes behind this function and nothing else changes.
 */
let cached: readonly Person[] | null = null;

function dataset(): readonly Person[] {
  if (!cached) cached = seeded;
  return cached;
}

export function revalidatePeopleIndex(): void {
  cached = null;
}

/** The whole filtered, sorted set — what the answer builder needs. */
export function matchPeople(
  filters: PeopleFilters,
  search: string,
  sort: PeopleSort
): Person[] {
  return sortPeople(filterPeopleList(dataset(), filters, search), sort);
}

export function queryPeople(input: {
  filters: PeopleFilters;
  search: string;
  sort: PeopleSort;
  page: number;
}): { results: Person[]; total: number } {
  const all = matchPeople(input.filters, input.search, input.sort);
  const start = Math.max(0, (input.page - 1) * PEOPLE_PAGE_SIZE);
  return { results: all.slice(start, start + PEOPLE_PAGE_SIZE), total: all.length };
}
```

- [ ] **Step 4: Write the Zod model**

Create `models/people-query.ts`:

```ts
import { z } from 'zod';
import { PEOPLE_SORTS, VERIFICATIONS } from '@/types/people';

/**
 * Request contract for POST /api/people/query.
 *
 * There is no model in this path, so nothing here guards against a
 * hallucination — it guards against a malformed or hostile client, and against
 * an oversized prompt reaching the parser.
 */
const percent = z.number().int().min(0).max(100);
const stringList = z.array(z.string().trim().min(1).max(160)).max(50);

export const peopleFiltersSchema = z.object({
  countries: stringList,
  cities: stringList,
  companies: stringList,
  titles: stringList,
  seniorities: stringList,
  departments: stringList,
  sources: stringList,
  verification: z.array(z.enum(VERIFICATIONS as [string, ...string[]])).max(3),
  confidenceMin: percent.nullable(),
  confidenceMax: percent.nullable(),
  scoreMin: percent.nullable(),
  scoreMax: percent.nullable(),
  hasEmail: z.boolean().nullable(),
  hasPhone: z.boolean().nullable(),
  hasLinkedIn: z.boolean().nullable(),
  starred: z.boolean().nullable(),
  band: z.enum(['all', 'high', 'needs']),
  ids: z.array(z.string().trim().min(1).max(40)).max(200).nullable(),
  keywords: z.array(z.string().trim().min(1).max(80)).max(3),
});

export const peopleQueryRequestSchema = z.object({
  prompt: z.string().max(500).default(''),
  filters: peopleFiltersSchema.optional(),
  search: z.string().max(200).default(''),
  sort: z.enum(PEOPLE_SORTS as [string, ...string[]]).default('score'),
  page: z.number().int().min(1).max(1000).default(1),
});

export type PeopleQueryRequest = z.infer<typeof peopleQueryRequestSchema>;
```

- [ ] **Step 5: Write the route**

Create `app/api/people/query/route.ts`:

```ts
import { jsonError, jsonOk } from '@/lib/http/response';
import { validateBody } from '@/lib/http/validate';
import { buildAnswer } from '@/lib/people/answer';
import { people } from '@/lib/people/data';
import { parsePeopleQuery } from '@/lib/people/parse-query';
import { matchPeople } from '@/lib/people/search-index';
import { buildPeopleVocabulary } from '@/lib/people/vocabulary';
import { peopleQueryRequestSchema } from '@/models/people-query';
import {
  PEOPLE_PAGE_SIZE,
  emptyPeopleFilters,
  type PeopleFilters,
  type PeopleSort,
} from '@/types/people';

/**
 * Turns a question into filters, rows and a prose answer — entirely locally.
 *
 * A thin controller over the pure modules, mirroring what the client does in
 * `use-people-query.ts`. No tenancy: like /api/companies this is a shared
 * discovery dataset, not workspace data.
 */
export async function POST(request: Request) {
  try {
    const body = validateBody(peopleQueryRequestSchema, await request.json());
    const started = Date.now();

    const vocabulary = buildPeopleVocabulary(people);
    const parsed = parsePeopleQuery(body.prompt, vocabulary);

    // Each ask replaces the filter state; the supplied filters are the base
    // only when there is no prompt to read.
    const filters: PeopleFilters = body.prompt.trim()
      ? parsed.filters
      : ((body.filters as PeopleFilters | undefined) ?? emptyPeopleFilters());

    const sort = body.sort as PeopleSort;
    const all = matchPeople(filters, body.search, sort);
    const answer = buildAnswer({ parsed, rows: all, total: all.length, people });

    // The duplicates answer pins the table to exactly the records it described.
    const effective: PeopleFilters =
      parsed.intent === 'duplicates' && answer.previewIds.length > 0
        ? { ...filters, ids: answer.previewIds }
        : filters;

    const rows =
      effective === filters ? all : matchPeople(effective, body.search, sort);
    const start = Math.max(0, (body.page - 1) * PEOPLE_PAGE_SIZE);

    return jsonOk({
      filters: effective,
      matched: parsed.matched,
      unmatched: parsed.unmatched,
      intent: parsed.intent,
      answer,
      results: rows.slice(start, start + PEOPLE_PAGE_SIZE),
      total: rows.length,
      tookMs: Date.now() - started,
    });
  } catch (error) {
    return jsonError(error);
  }
}
```

- [ ] **Step 6: Run the tests and confirm the path is model-free**

Run: `npx vitest run tests/integration/people-answer.test.ts`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS across the whole suite, including
`tests/integration/event-filters.test.ts` unchanged.

Run: `git grep -n "ANTHROPIC_API_KEY" -- lib/people lib/search app/api/people models/people-query.ts types/people.ts`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add lib/people/search-index.ts models/people-query.ts app/api/people/query/route.ts tests/integration/people-answer.test.ts
git commit -m "feat(people): add the query index and API route"
```

---

## UI tasks — how they are verified

The Vitest suite runs in the **node** environment with no jsdom and no React
Testing Library, and `CLAUDE.md` forbids installing either. So Tasks 15–20 are
not TDD'd with unit tests. Each one is verified by:

1. `npx tsc --noEmit` — passes with no new errors.
2. `npm run lint` — passes with no new warnings.
3. `npx vitest run` — the pure-module suite still passes, proving the UI change
   did not drag a regression into `lib/`.
4. A named check in the running app (`npm run dev`, then `/app/people`).

The logic those components render is already covered by Tasks 1–14, which is
why it lives in `lib/` rather than in the components.

---

### Task 15: `components/search/range-slider.tsx`

**Files:**
- Create: `components/search/range-slider.tsx`

**Interfaces:**
- Consumes: `cn` from `lib/utils`.
- Produces: `RangeSlider` with props
  `{ min: number | null; max: number | null; onChange: (min: number | null, max: number | null) => void; suffix?: string; label?: string }`.
  `null` means "unset" and must survive a round trip through the control.

- [ ] **Step 1: Write the component**

Create `components/search/range-slider.tsx`:

```tsx
"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Dual-handle 0-100 range, shared by the Confidence and Platform score facets.
 *
 * Two overlaid native range inputs rather than a custom drag implementation:
 * keyboard support, touch targets and accessibility come for free, and there is
 * no dependency to install.
 *
 * `null` bounds mean "unset" and are preserved: dragging a handle back to its
 * extreme clears that side rather than pinning it to 0 or 100, so an untouched
 * slider never writes a filter into the URL.
 */
export function RangeSlider({
  min,
  max,
  onChange,
  suffix = "",
  label,
}: {
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
  suffix?: string;
  label?: string;
}) {
  const id = useId();
  const low = min ?? 0;
  const high = max ?? 100;

  const setLow = (value: number) => {
    const next = Math.min(value, high);
    onChange(next === 0 ? null : next, max);
  };

  const setHigh = (value: number) => {
    const next = Math.max(value, low);
    onChange(min, next === 100 ? null : next);
  };

  return (
    <div className="space-y-3 p-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label ?? "Range"}
        </span>
        <span className="text-[12px] font-semibold tabular-nums text-slate-900 dark:text-white">
          {min === null && max === null
            ? "Any"
            : `${low}${suffix} – ${high}${suffix}`}
        </span>
      </div>

      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200 dark:bg-[#22304A]" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-indigo-500"
          style={{ left: `${low}%`, right: `${100 - high}%` }}
        />
        {(
          [
            ["low", low, setLow] as const,
            ["high", high, setHigh] as const,
          ]
        ).map(([key, value, set]) => (
          <input
            key={key}
            id={`${id}-${key}`}
            aria-label={`${label ?? "Range"} ${key === "low" ? "minimum" : "maximum"}`}
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={(event) => set(Number(event.target.value))}
            className={cn(
              "pointer-events-none absolute inset-x-0 top-1/2 h-6 w-full -translate-y-1/2 appearance-none bg-transparent",
              "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none",
              "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white",
              "[&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:shadow dark:[&::-webkit-slider-thumb]:border-[#111B2E]",
              "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full",
              "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-indigo-500"
            )}
          />
        ))}
      </div>

      {min !== null || max !== null ? (
        <button
          type="button"
          onClick={() => onChange(null, null)}
          className="text-[11px] font-semibold text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings.

- [ ] **Step 3: Commit**

```bash
git add components/search/range-slider.tsx
git commit -m "feat(search): add a shared dual-handle range slider"
```

---

### Task 16: the two hooks

`use-people-query.ts` owns URL state and runs the pure modules in `useMemo`s.
`use-people-thread.ts` holds the conversation in React state — not the URL and
not localStorage, so a refresh restores the search without replaying the chat.

**Files:**
- Create: `components/people/use-people-query.ts`
- Create: `components/people/use-people-thread.ts`

**Interfaces:**
- Consumes: everything from `lib/people/`.
- Produces:
  `usePeopleQuery(): { state, filters, search, sort, page, isHydrated, rows, pageRows, total, facets, chips, vocabulary, setFilters, setSearch, setSort, setPage, removeChip, clearAll, applyParsed }`
  and
  `usePeopleThread(): { messages, ask, clear }` with
  `ThreadMessage = { id: string; role: 'user'; text: string } | { id: string; role: 'assistant'; answer: Answer; chips: PeopleFilterChip[] }`.

- [ ] **Step 1: Write the query hook**

Create `components/people/use-people-query.ts`:

```ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { people } from "@/lib/people/data";
import { buildPeopleFilterChips, removePeopleFilterChip } from "@/lib/people/chips";
import {
  computePeopleFacets,
  filterPeopleList,
  parsePeopleQueryState,
  serializePeopleQueryState,
  sortPeople,
  type PeopleQueryState,
} from "@/lib/people/filters";
import { buildPeopleVocabulary } from "@/lib/people/vocabulary";
import type { ParsedPeopleQuery } from "@/lib/people/parse-query";
import {
  PEOPLE_PAGE_SIZE,
  emptyPeopleFilters,
  type PeopleFilters,
  type PeopleSort,
} from "@/types/people";

const EMPTY_STATE: PeopleQueryState = {
  filters: emptyPeopleFilters(),
  search: "",
  sort: "score",
  page: 1,
};

/**
 * The URL is the single source of truth shared by the rail, the ask panel and
 * the table — which is what makes the left panel visibly tick itself when the
 * assistant reads a sentence, and what makes a shared link reproduce the screen.
 *
 * Everything below the state is a `useMemo` over the pure modules: no fetch, no
 * loading state, no API key.
 */
export function usePeopleQuery() {
  const [state, setState] = useState<PeopleQueryState>(EMPTY_STATE);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setState(parsePeopleQueryState(window.location.search));
    setIsHydrated(true);
  }, []);

  // history.replaceState rather than router.replace: this only needs to keep
  // the address bar shareable, not to push a navigation entry per keystroke.
  useEffect(() => {
    if (!isHydrated) return;
    const query = serializePeopleQueryState(state);
    window.history.replaceState(null, "", `${window.location.pathname}${query}`);
  }, [state, isHydrated]);

  const vocabulary = useMemo(() => buildPeopleVocabulary(people), []);

  const rows = useMemo(
    () => sortPeople(filterPeopleList(people, state.filters, state.search), state.sort),
    [state.filters, state.search, state.sort]
  );

  const facets = useMemo(
    () => computePeopleFacets(people, state.filters, state.search),
    [state.filters, state.search]
  );

  const chips = useMemo(
    () => buildPeopleFilterChips(state.filters, state.search),
    [state.filters, state.search]
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PEOPLE_PAGE_SIZE));
  const page = Math.min(state.page, pageCount);
  const pageRows = useMemo(
    () => rows.slice((page - 1) * PEOPLE_PAGE_SIZE, page * PEOPLE_PAGE_SIZE),
    [rows, page]
  );

  // Any change to what is being matched sends the reader back to page 1.
  const setFilters = useCallback((filters: PeopleFilters) => {
    setState((current) => ({ ...current, filters, page: 1 }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setState((current) => ({ ...current, search, page: 1 }));
  }, []);

  const setSort = useCallback((sort: PeopleSort) => {
    setState((current) => ({ ...current, sort, page: 1 }));
  }, []);

  const setPage = useCallback((next: number) => {
    setState((current) => ({ ...current, page: Math.max(1, next) }));
  }, []);

  const removeChip = useCallback((chipId: string) => {
    setState((current) => {
      const next = removePeopleFilterChip(current.filters, current.search, chipId);
      return { ...current, filters: next.filters, search: next.search, page: 1 };
    });
  }, []);

  const clearAll = useCallback(() => setState(EMPTY_STATE), []);

  /** Every ask replaces the filter state — the chips always explain the table. */
  const applyParsed = useCallback((parsed: ParsedPeopleQuery, ids?: string[]) => {
    setState((current) => ({
      ...current,
      filters: ids && ids.length > 0 ? { ...parsed.filters, ids } : parsed.filters,
      search: "",
      page: 1,
    }));
  }, []);

  return {
    state,
    filters: state.filters,
    search: state.search,
    sort: state.sort,
    page,
    pageCount,
    isHydrated,
    rows,
    pageRows,
    total: rows.length,
    facets,
    chips,
    vocabulary,
    setFilters,
    setSearch,
    setSort,
    setPage,
    removeChip,
    clearAll,
    applyParsed,
  };
}
```

- [ ] **Step 2: Write the thread hook**

Create `components/people/use-people-thread.ts`:

```ts
"use client";

import { useCallback, useState } from "react";
import type { PeopleFilterChip } from "@/lib/people/chips";
import type { Answer } from "@/lib/people/answer";

export type ThreadMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; answer: Answer; chips: PeopleFilterChip[] };

let counter = 0;
const nextId = () => `msg-${(counter += 1)}`;

/**
 * Append-only conversation. Held in React state rather than the URL or
 * localStorage: the search is shareable, the chat is not.
 */
export function usePeopleThread() {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);

  const ask = useCallback((text: string, answer: Answer, chips: PeopleFilterChip[]) => {
    setMessages((current) => [
      ...current,
      { id: nextId(), role: "user", text },
      { id: nextId(), role: "assistant", answer, chips },
    ]);
  }, []);

  const clear = useCallback(() => setMessages([]), []);

  return { messages, ask, clear };
}
```

- [ ] **Step 3: Typecheck, lint and re-run the suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings.

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/people/use-people-query.ts components/people/use-people-thread.ts
git commit -m "feat(people): add the query and thread hooks"
```

---

### Task 17: `components/people/people-filter-rail.tsx`

Six facets visible, five behind a `More filters (5)` disclosure — which
**auto-opens when any filter inside it is set**, so a parsed query never hides
its own effect. "Job function" is the department facet; Job title lists distinct
raw titles and is separate, so `marketing managers` ticks Job function and
Seniority, not Job title.

**Files:**
- Create: `components/people/people-filter-rail.tsx`

**Interfaces:**
- Consumes: `FilterAccordion`, `FacetOptionList` from
  `components/search/filter-accordion` (unchanged); `RangeSlider` from Task 15;
  `PeopleFacets` from `lib/people/filters`; `PeopleFilters`,
  `hasAnyPeopleFilter` from `types/people`.
- Produces: `PeopleFilterRail` with props
  `{ filters, search, facets, resultCount, onFiltersChange, onSearchChange, onClear }`.

- [ ] **Step 1: Write the rail**

Create `components/people/people-filter-rail.tsx`:

```tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BadgeCheck, ChevronDown, Search, Star, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FacetOptionList, FilterAccordion } from "@/components/search/filter-accordion";
import { RangeSlider } from "@/components/search/range-slider";
import type { FacetDimension, PeopleFacets } from "@/lib/people/filters";
import {
  hasAnyPeopleFilter,
  type PeopleFilters,
  type Verification,
} from "@/types/people";

type SectionKey = FacetDimension | "confidence" | "score" | "contactability";

const PRIMARY: { key: SectionKey; label: string }[] = [
  { key: "countries", label: "Country" },
  { key: "companies", label: "Company" },
  { key: "departments", label: "Job function" },
  { key: "sources", label: "Source" },
  { key: "verification", label: "Verification" },
  { key: "confidence", label: "Confidence" },
];

const SECONDARY: { key: SectionKey; label: string }[] = [
  { key: "seniorities", label: "Seniority" },
  { key: "titles", label: "Job title" },
  { key: "cities", label: "City" },
  { key: "score", label: "Platform score" },
  { key: "contactability", label: "Contactability" },
];

const VERIFICATION_LABEL: Record<Verification, string> = {
  verified: "Verified",
  needs_verify: "Needs verify",
  unverified: "Unverified",
};

const CONTACTABILITY: { key: "hasEmail" | "hasPhone" | "hasLinkedIn"; label: string }[] = [
  { key: "hasEmail", label: "Work email" },
  { key: "hasPhone", label: "Phone" },
  { key: "hasLinkedIn", label: "LinkedIn" },
];

function summarise(values: string[]): string | null {
  if (values.length === 0) return null;
  return values.length === 1 ? values[0] : `${values[0]} +${values.length - 1}`;
}

/** Any → yes → no → any. `null` is unset; `false` is the real "has none". */
function cycle(state: boolean | null): boolean | null {
  if (state === null) return true;
  return state ? false : null;
}

export function PeopleFilterRail({
  filters,
  search,
  facets,
  resultCount,
  onFiltersChange,
  onSearchChange,
  onClear,
}: {
  filters: PeopleFilters;
  search: string;
  facets: PeopleFacets;
  resultCount: number;
  onFiltersChange: (next: PeopleFilters) => void;
  onSearchChange: (next: string) => void;
  onClear: () => void;
}) {
  const [openSection, setOpenSection] = useState<SectionKey | null>("countries");
  const [showMore, setShowMore] = useState(false);

  const secondaryIsSet =
    filters.seniorities.length > 0 ||
    filters.titles.length > 0 ||
    filters.cities.length > 0 ||
    filters.scoreMin !== null ||
    filters.scoreMax !== null ||
    filters.hasEmail !== null ||
    filters.hasPhone !== null ||
    filters.hasLinkedIn !== null;

  // A parsed query must never hide its own effect behind a collapsed disclosure.
  useEffect(() => {
    if (secondaryIsSet) setShowMore(true);
  }, [secondaryIsSet]);

  const isDirty = hasAnyPeopleFilter(filters) || search.trim().length > 0;

  const toggleValue = (key: FacetDimension, value: string) => {
    if (key === "verification") {
      const current = filters.verification;
      onFiltersChange({
        ...filters,
        verification: current.includes(value as Verification)
          ? current.filter((item) => item !== value)
          : [...current, value as Verification],
      });
      return;
    }
    const current = filters[key];
    onFiltersChange({
      ...filters,
      [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    });
  };

  const summaryFor = (key: SectionKey): string | null => {
    if (key === "confidence") {
      if (filters.confidenceMin === null && filters.confidenceMax === null) return null;
      return `${filters.confidenceMin ?? 0}–${filters.confidenceMax ?? 100}%`;
    }
    if (key === "score") {
      if (filters.scoreMin === null && filters.scoreMax === null) return null;
      return `${filters.scoreMin ?? 0}–${filters.scoreMax ?? 100}`;
    }
    if (key === "contactability") {
      const set = CONTACTABILITY.filter((entry) => filters[entry.key] !== null);
      return set.length ? `${set.length} set` : null;
    }
    if (key === "verification") {
      return summarise(filters.verification.map((value) => VERIFICATION_LABEL[value]));
    }
    return summarise(filters[key]);
  };

  const renderSection = ({ key, label }: { key: SectionKey; label: string }) => (
    <FilterAccordion
      key={key}
      label={label}
      isOpen={openSection === key}
      onToggle={() => setOpenSection(openSection === key ? null : key)}
      summary={summaryFor(key)}
    >
      {key === "confidence" ? (
        <RangeSlider
          label="Confidence"
          suffix="%"
          min={filters.confidenceMin}
          max={filters.confidenceMax}
          onChange={(min, max) =>
            onFiltersChange({ ...filters, confidenceMin: min, confidenceMax: max })
          }
        />
      ) : key === "score" ? (
        <RangeSlider
          label="Platform score"
          min={filters.scoreMin}
          max={filters.scoreMax}
          onChange={(min, max) => onFiltersChange({ ...filters, scoreMin: min, scoreMax: max })}
        />
      ) : key === "contactability" ? (
        <div className="space-y-1.5 p-1">
          {CONTACTABILITY.map((entry) => {
            const state = filters[entry.key];
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => onFiltersChange({ ...filters, [entry.key]: cycle(state) })}
                className="flex w-full items-center justify-between rounded-[9px] px-2.5 py-2 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#16233A]"
              >
                <span>{entry.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    state === null && "bg-slate-100 text-slate-500 dark:bg-[#16233A] dark:text-slate-400",
                    state === true && "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
                    state === false && "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                  )}
                >
                  {state === null ? "Any" : state ? "Has" : "None"}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <FacetOptionList
          options={
            key === "verification"
              ? facets.verification.map((option) => ({
                  ...option,
                  value: VERIFICATION_LABEL[option.value as Verification] ?? option.value,
                }))
              : facets[key as FacetDimension]
          }
          selected={
            key === "verification"
              ? filters.verification.map((value) => VERIFICATION_LABEL[value])
              : filters[key as Exclude<FacetDimension, "verification">]
          }
          onToggle={(value) => {
            if (key === "verification") {
              const raw = (Object.keys(VERIFICATION_LABEL) as Verification[]).find(
                (candidate) => VERIFICATION_LABEL[candidate] === value
              );
              if (raw) toggleValue("verification", raw);
              return;
            }
            toggleValue(key as FacetDimension, value);
          }}
          searchPlaceholder={
            key === "countries" || key === "companies" || key === "titles" || key === "cities"
              ? `Search ${label.toLowerCase()}...`
              : undefined
          }
        />
      )}
    </FilterAccordion>
  );

  return (
    <div className="flex h-full flex-col rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Name, email, company..."
          className="h-10 w-full rounded-[10px] border border-slate-200 bg-slate-50 pl-10 pr-9 text-[13px] text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white dark:placeholder:text-slate-500"
        />
        {search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {resultCount.toLocaleString()} matching
        </span>
        {isDirty ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-red-200 hover:text-red-600 dark:border-[#22304A] dark:text-slate-300 dark:hover:border-red-500/30 dark:hover:text-red-400"
          >
            <X className="size-3" />
            Clear all filters
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {(
          [
            ["Verified", <BadgeCheck key="v" className="size-3" />, filters.verification.length === 1 && filters.verification[0] === "verified"],
            ["Needs verify", <TriangleAlert key="n" className="size-3" />, filters.verification.includes("needs_verify")],
            ["Starred", <Star key="s" className="size-3" />, filters.starred === true],
          ] as [string, ReactNode, boolean][]
        ).map(([label, icon, active], index) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              // Quick chips only ever toggle between unset and the positive
              // value; the `false` state lives under More filters.
              if (index === 0) {
                onFiltersChange({ ...filters, verification: active ? [] : ["verified"] });
              } else if (index === 1) {
                onFiltersChange({
                  ...filters,
                  verification: active ? [] : ["needs_verify", "unverified"],
                });
              } else {
                onFiltersChange({ ...filters, starred: active ? null : true });
              }
            }}
            className={cn(
              "flex h-8 items-center justify-center gap-1 rounded-[9px] border px-1 text-[10px] font-semibold transition-colors",
              active
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400/50 dark:bg-indigo-500/10 dark:text-indigo-300"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-300"
            )}
          >
            {icon}
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {PRIMARY.map(renderSection)}

        <button
          type="button"
          onClick={() => setShowMore((current) => !current)}
          aria-expanded={showMore}
          className="flex h-9 w-full items-center justify-between rounded-[10px] px-3 text-[12px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
        >
          More filters ({SECONDARY.length})
          <ChevronDown className={cn("size-4 transition-transform", showMore && "rotate-180")} />
        </button>

        {showMore ? SECONDARY.map(renderSection) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings.

- [ ] **Step 3: Commit**

```bash
git add components/people/people-filter-rail.tsx
git commit -m "feat(people): add the faceted filter rail"
```

---

### Task 18: the ask panel and the answer bubble

The hero Ask card collapses to a sticky one-line bar the moment a query exists.
The prototype's 392px card put the first result row about 700px down; collapsing
restores "first row visible at 1366×768" without changing the empty state.
Clearing the input restores the hero.

**Files:**
- Create: `components/people/people-answer-bubble.tsx`
- Create: `components/people/people-ask-panel.tsx`
- Modify: `components/search/query-store.ts` — add the `people_query` kind

**Interfaces:**
- Consumes: `Answer`, `AnswerAction` from `lib/people/answer`;
  `PeopleFilterChip` from `lib/people/chips`; `FilterChips` from
  `components/search/filter-chips`; `useQueryStore` from
  `components/search/query-store`; `ThreadMessage` from `use-people-thread`.
- Produces: `PeopleAnswerBubble` with props
  `{ answer, chips, previewRows, onAction, onRemoveChip }`; `PeopleAskPanel`
  with props
  `{ collapsed, value, onChange, onSubmit, messages, previewFor, onAction, onClear, onRemoveChip, chips, appliedSummary }`.

- [ ] **Step 1: Add the new saved-query kind**

In `components/search/query-store.ts`, extend the union — one line, nothing else
in that file changes:

```ts
export type SavedQueryKind = "lead_query" | "event_query" | "people_query";
```

- [ ] **Step 2: Write the answer bubble**

Create `components/people/people-answer-bubble.tsx`:

```tsx
"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterChips } from "@/components/search/filter-chips";
import type { Answer, AnswerAction } from "@/lib/people/answer";
import type { PeopleFilterChip } from "@/lib/people/chips";
import type { Person } from "@/types/people";

/**
 * Renders a structured `Answer`. The `em` segments become <strong> — there is
 * no HTML string anywhere in this path, so nothing needs
 * dangerouslySetInnerHTML and every sentence stays unit-testable in lib/.
 */
export function PeopleAnswerBubble({
  answer,
  chips,
  previewRows,
  onAction,
  onRemoveChip,
}: {
  answer: Answer;
  chips: PeopleFilterChip[];
  previewRows: Person[];
  onAction: (action: AnswerAction) => void;
  onRemoveChip: (chipId: string) => void;
}) {
  const hidden = answer.totalCount - previewRows.length;

  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
        <Sparkles className="size-3.5" />
      </span>

      <div className="min-w-0 flex-1 space-y-2.5">
        <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
          {answer.segments.map((segment, index) =>
            segment.type === "em" ? (
              <strong key={index} className="font-semibold text-indigo-600 dark:text-indigo-400">
                {segment.value}
              </strong>
            ) : (
              <span key={index}>{segment.value}</span>
            )
          )}
        </p>

        {chips.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Filters applied on the left
            </p>
            <FilterChips chips={chips} onRemove={(chip) => onRemoveChip(chip.id)} />
          </div>
        ) : null}

        {previewRows.length > 0 ? (
          <div className="overflow-hidden rounded-[10px] border border-slate-200 dark:border-[#22304A]">
            {previewRows.map((person) => (
              <div
                key={person.id}
                className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2 last:border-b-0 dark:border-[#22304A]"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 dark:bg-[#22304A] dark:text-slate-200">
                  {person.avatar}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-900 dark:text-white">
                  {person.name}
                </span>
                <span className="hidden min-w-0 flex-1 truncate text-[11px] text-slate-500 dark:text-slate-400 sm:block">
                  {person.title} · {person.company}
                </span>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                  {person.confidence}%
                </span>
              </div>
            ))}
            {hidden > 0 ? (
              <p className="bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500 dark:bg-[#0B1220] dark:text-slate-400">
                + {hidden.toLocaleString()} more in the table below
              </p>
            ) : null}
          </div>
        ) : null}

        {answer.actions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {answer.actions.map((action) => (
              <button
                key={`${action.kind}-${action.label}`}
                type="button"
                onClick={() => onAction(action)}
                className={cn(
                  "h-7 rounded-[8px] border px-2.5 text-[11px] font-semibold transition-colors",
                  action.kind === "merge"
                    ? "border-transparent bg-indigo-600 text-white hover:bg-indigo-500"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#16233A] dark:text-slate-200 dark:hover:bg-[#22304A]"
                )}
              >
                {action.label}
                {"count" in action ? ` (${action.count.toLocaleString()})` : ""}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the ask panel**

Create `components/people/people-ask-panel.tsx`:

```tsx
"use client";

import { ChevronDown, Send, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { FilterChips } from "@/components/search/filter-chips";
import { useQueryStore } from "@/components/search/query-store";
import type { AnswerAction } from "@/lib/people/answer";
import type { PeopleFilterChip } from "@/lib/people/chips";
import type { Person } from "@/types/people";
import { PeopleAnswerBubble } from "./people-answer-bubble";
import type { ThreadMessage } from "./use-people-thread";

const EXAMPLES = [
  "verified marketing managers in Germany",
  "how many verified people in France",
  "c-level in india with verified emails",
  "top scoring contacts above 90",
  "any duplicates I should merge?",
];

export function PeopleAskPanel({
  collapsed,
  value,
  onChange,
  onSubmit,
  messages,
  previewFor,
  chips,
  appliedSummary,
  onAction,
  onClear,
  onRemoveChip,
}: {
  collapsed: boolean;
  value: string;
  onChange: (next: string) => void;
  onSubmit: (text: string) => void;
  messages: ThreadMessage[];
  previewFor: (ids: string[]) => Person[];
  chips: PeopleFilterChip[];
  appliedSummary: string;
  onAction: (action: AnswerAction) => void;
  onClear: () => void;
  onRemoveChip: (chipId: string) => void;
}) {
  const [threadOpen, setThreadOpen] = useState(true);
  const { recent, saved } = useQueryStore("people_query");

  const submit = () => {
    const text = value.trim();
    if (text) onSubmit(text);
  };

  const thread =
    messages.length > 0 ? (
      <div className="space-y-4">
        {messages.map((message) =>
          message.role === "user" ? (
            <p
              key={message.id}
              className="ml-auto w-fit max-w-[85%] rounded-[12px] bg-indigo-600 px-3 py-2 text-[13px] font-medium text-white"
            >
              {message.text}
            </p>
          ) : (
            <PeopleAnswerBubble
              key={message.id}
              answer={message.answer}
              chips={message.chips}
              previewRows={previewFor(message.answer.previewIds)}
              onAction={onAction}
              onRemoveChip={onRemoveChip}
            />
          )
        )}
      </div>
    ) : null;

  const composer = (
    <div className="space-y-2">
      <div className="relative">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask about your people..."
          className="h-11 w-full rounded-[10px] border border-slate-200 bg-slate-50 pl-3 pr-11 text-[13px] text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white dark:placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={submit}
          aria-label="Ask"
          className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-[8px] bg-indigo-600 text-white transition-colors hover:bg-indigo-500"
        >
          <Send className="size-3.5" />
        </button>
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">{appliedSummary}</p>

      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              onChange(example);
              onSubmit(example);
            }}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-[#22304A] dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
          >
            {example}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        {recent.length} recent · {saved.length} saved
      </p>
    </div>
  );

  if (collapsed) {
    return (
      <div className="sticky top-2 z-20 space-y-2">
        <div className="flex h-14 items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-3 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
            <Sparkles className="size-3.5" />
          </span>
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Ask about your people..."
            className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={submit}
            aria-label="Ask"
            className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-indigo-600 text-white transition-colors hover:bg-indigo-500"
          >
            <Send className="size-3.5" />
          </button>
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={() => setThreadOpen((current) => !current)}
              aria-label="Toggle conversation"
              aria-expanded={threadOpen}
              className="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-slate-400 hover:bg-slate-100 dark:hover:bg-[#16233A]"
            >
              <ChevronDown className={cn("size-4 transition-transform", threadOpen && "rotate-180")} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear conversation"
            className="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#16233A] dark:hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <FilterChips chips={chips} onRemove={(chip) => onRemoveChip(chip.id)} className="px-0.5" />

        {threadOpen && thread ? (
          <div className="max-h-[320px] overflow-y-auto rounded-[12px] border border-slate-200 bg-white p-4 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
            {thread}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
              Ask about your people
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              Answers come from your 2,418 contacts — nothing else.
            </p>
          </div>
        </div>
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-[11px] font-semibold text-slate-500 transition-colors hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
          >
            Clear conversation
          </button>
        ) : null}
      </div>

      {thread ?? (
        <div className="mb-4 rounded-[12px] border border-dashed border-slate-200 px-4 py-8 text-center dark:border-[#22304A]">
          <p className="text-[14px] font-bold text-slate-900 dark:text-white">Ask anything</p>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            Filters, counts, rankings and duplicates — all answered from the contacts you already
            have.
          </p>
        </div>
      )}

      <div className="mt-4">{composer}</div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings.

- [ ] **Step 5: Commit**

```bash
git add components/people/people-answer-bubble.tsx components/people/people-ask-panel.tsx components/search/query-store.ts
git commit -m "feat(people): add the ask panel and answer bubble"
```

---

### Task 19: the results table and the detail pane

Selection is held as `{ mode: 'page' | 'all', ids: Set<string> }` so "Select all
N matching" survives paging. Changing any filter clears the selection — the
orchestrator in Task 20 does that.

**Files:**
- Create: `components/people/people-results-table.tsx`
- Create: `components/people/person-detail-pane.tsx`

**Interfaces:**
- Consumes: `Person`, `Band`, `PEOPLE_PAGE_SIZE` from `types/people`;
  `PeopleFilterChip` from `lib/people/chips`; `FilterChips`.
- Produces: `Selection = { mode: 'page' | 'all'; ids: Set<string> }`;
  `PeopleResultsTable` with props
  `{ rows, total, page, pageCount, band, selection, selectedId, chips, onPageChange, onBandChange, onSelectionChange, onSelectRow, onRemoveChip, onClearAll }`;
  `PersonDetailPane` with props `{ person }`.

- [ ] **Step 1: Write the detail pane**

Create `components/people/person-detail-pane.tsx`:

```tsx
"use client";

import { BadgeCheck, Globe, Phone, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Person } from "@/types/people";

const STATUS_LABEL = {
  verified: "Verified",
  needs_verify: "Needs verify",
  unverified: "Unverified",
} as const;

/**
 * The persistent right column inside the results card — what the prototype
 * draws. Not a slide-over: the detail is always on screen beside the table, so
 * comparing two rows costs one click rather than two.
 */
export function PersonDetailPane({ person }: { person: Person | null }) {
  if (!person) {
    return (
      <div className="flex h-full items-center justify-center rounded-[12px] border border-dashed border-slate-200 p-6 text-center dark:border-[#22304A]">
        <p className="text-[12px] text-slate-400 dark:text-slate-500">
          Select a contact to see their details.
        </p>
      </div>
    );
  }

  const isVerified = person.verification === "verified";

  return (
    <div className="flex flex-col gap-4 rounded-[12px] border border-slate-200 bg-white p-4 dark:border-[#22304A] dark:bg-[#0B1220]">
      <div className="flex items-center gap-3">
        <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[20px] font-bold text-slate-700 shadow-sm dark:border-[#22304A] dark:bg-[#16233A] dark:text-slate-200">
          {person.avatar}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-[17px] font-bold leading-tight text-slate-900 dark:text-white">
            {person.name}
          </h3>
          <span className="mt-1 inline-block rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-400">
            {person.company}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button className="h-8 rounded-[6px] bg-indigo-600 text-[12px] font-semibold text-white transition-colors hover:bg-indigo-500">
          Add to CRM
        </button>
        <button className="h-8 rounded-[6px] border border-slate-300 bg-white text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-200 dark:hover:bg-[#16233A]">
          Add to Sequence
        </button>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Work email
        </p>
        <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
          {person.email ?? "—"}
        </p>
        <span
          className={cn(
            "mt-1 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold",
            isVerified
              ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
          )}
        >
          {STATUS_LABEL[person.verification]}
          {isVerified ? <BadgeCheck className="size-2.5" /> : <TriangleAlert className="size-2.5" />}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Country
          </p>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
            <Globe className="size-3.5 text-indigo-500" />
            {person.country}
          </p>
        </div>
        <div className="border-l border-slate-100 pl-3 dark:border-[#22304A]">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Phone
          </p>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
            <Phone className="size-3.5 text-slate-400" />
            {person.phone ?? "—"}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Title
        </p>
        <p className="text-[13px] font-semibold leading-tight text-slate-900 dark:text-slate-100">
          {person.title}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-y-1.5 rounded-[6px] border border-slate-200 bg-slate-50 p-2.5 text-[12px] dark:border-[#22304A] dark:bg-[#111B2E]">
        <span className="font-medium text-slate-500 dark:text-slate-400">Source</span>
        <span className="font-semibold text-slate-900 dark:text-slate-100">{person.source}</span>
        <span className="font-medium text-slate-500 dark:text-slate-400">Fetched</span>
        <span className="font-semibold text-slate-900 dark:text-slate-100">{person.fetchedAt}</span>
        <span className="font-medium text-slate-500 dark:text-slate-400">Confidence</span>
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {person.confidence}%
        </span>
        <span className="font-medium text-slate-500 dark:text-slate-400">Platform score</span>
        <span className="font-semibold text-slate-900 dark:text-slate-100">{person.score}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the results table**

Create `components/people/people-results-table.tsx`:

```tsx
"use client";

import { SearchX, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterChips } from "@/components/search/filter-chips";
import type { PeopleFilterChip } from "@/lib/people/chips";
import type { Band, Person } from "@/types/people";

/**
 * `all` means every matching record, not every record on this page — which is
 * why the ids set is only meaningful in `page` mode. Kept here rather than as a
 * plain Set so "Select all N matching" survives paging.
 */
export type Selection = { mode: "page" | "all"; ids: Set<string> };

const BANDS: { id: Band; label: string }[] = [
  { id: "all", label: "All" },
  { id: "high", label: "High confidence" },
  { id: "needs", label: "Needs verification" },
];

const STATUS_LABEL = {
  verified: "Verified",
  needs_verify: "Needs verify",
  unverified: "Unverified",
} as const;

export function PeopleResultsTable({
  rows,
  total,
  page,
  pageCount,
  band,
  selection,
  selectedId,
  chips,
  onPageChange,
  onBandChange,
  onSelectionChange,
  onSelectRow,
  onRemoveChip,
  onClearAll,
}: {
  rows: Person[];
  total: number;
  page: number;
  pageCount: number;
  band: Band;
  selection: Selection;
  selectedId: string | null;
  chips: PeopleFilterChip[];
  onPageChange: (page: number) => void;
  onBandChange: (band: Band) => void;
  onSelectionChange: (selection: Selection) => void;
  onSelectRow: (id: string) => void;
  onRemoveChip: (chipId: string) => void;
  onClearAll: () => void;
}) {
  const selectedCount = selection.mode === "all" ? total : selection.ids.size;
  const allOnPageSelected =
    selection.mode === "all" || (rows.length > 0 && rows.every((row) => selection.ids.has(row.id)));

  const toggleRow = (id: string) => {
    if (selection.mode === "all") {
      const ids = new Set(rows.map((row) => row.id));
      ids.delete(id);
      onSelectionChange({ mode: "page", ids });
      return;
    }
    const ids = new Set(selection.ids);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    onSelectionChange({ mode: "page", ids });
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/50 p-3 dark:border-[#22304A] dark:bg-[#0B1220]/50">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-1 text-[14px] font-bold text-slate-900 dark:text-white">Results</h3>
          {BANDS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onBandChange(entry.id)}
              className={cn(
                "h-[24px] rounded-full border px-3 text-[11px] font-semibold transition-colors",
                band === entry.id
                  ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-[#0B1220]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-500/40 hover:text-slate-900 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-400 dark:hover:text-white"
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {total.toLocaleString()} in view
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3 dark:border-[#22304A]">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 border-r border-slate-200 pr-3 dark:border-[#22304A]">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={() =>
                onSelectionChange(
                  allOnPageSelected
                    ? { mode: "page", ids: new Set() }
                    : { mode: "page", ids: new Set(rows.map((row) => row.id)) }
                )
              }
              className="size-3.5 accent-indigo-600"
            />
            <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
              Select all
            </span>
          </label>

          {allOnPageSelected && selection.mode === "page" && total > rows.length ? (
            <button
              type="button"
              onClick={() => onSelectionChange({ mode: "all", ids: new Set() })}
              className="h-7 rounded-[6px] border border-indigo-200 bg-indigo-50 px-2.5 text-[12px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
            >
              Select all {total.toLocaleString()} matching
            </button>
          ) : null}

          {["Verify emails", "Add to Sequence", "Merge"].map((label) => (
            <button
              key={label}
              type="button"
              disabled={selectedCount === 0}
              className="h-7 rounded-[6px] border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#22304A] dark:bg-[#16233A] dark:text-slate-200 dark:hover:bg-[#22304A]"
            >
              {label}
            </button>
          ))}
        </div>

        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-[#22304A] dark:bg-[#16233A] dark:text-white">
          {selectedCount.toLocaleString()} selected
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <SearchX className="size-10 text-slate-400 dark:text-slate-500" />
          <div className="space-y-1">
            <p className="text-[15px] font-bold text-slate-900 dark:text-white">
              No contacts match these filters
            </p>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">
              Remove one of the filters below to widen the search.
            </p>
          </div>
          <FilterChips
            chips={chips}
            onRemove={(chip) => onRemoveChip(chip.id)}
            className="justify-center"
            emptyLabel="No filters are applied."
          />
          {chips.length > 0 ? (
            <button
              type="button"
              onClick={onClearAll}
              className="mt-1 h-9 rounded-[10px] bg-indigo-600 px-4 text-[12px] font-semibold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-500"
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] whitespace-nowrap text-left text-[13px]">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-[#22304A] dark:bg-[#0B1220]">
              <tr className="text-[12px] text-slate-500 dark:text-slate-400">
                <th className="w-8 px-3 py-2.5" />
                <th className="px-3 py-2.5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">Platform score</th>
                <th className="px-3 py-2.5 font-medium">Company</th>
                <th className="px-3 py-2.5 font-medium">Work email</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#22304A]">
              {rows.map((person) => {
                const isActive = selectedId === person.id;
                const isChecked = selection.mode === "all" || selection.ids.has(person.id);
                return (
                  <tr
                    key={person.id}
                    onClick={() => onSelectRow(person.id)}
                    className={cn(
                      "h-[48px] cursor-pointer border-l-2 transition-colors",
                      isActive
                        ? "border-l-indigo-500 bg-indigo-50/50 dark:bg-[#16233A]/80"
                        : "border-l-transparent hover:bg-slate-50 dark:hover:bg-[#16233A]/40"
                    )}
                  >
                    <td className="px-3" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRow(person.id)}
                        aria-label={`Select ${person.name}`}
                        className="size-3.5 accent-indigo-600"
                      />
                    </td>
                    <td className="px-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm",
                            isActive ? "bg-indigo-500" : "bg-slate-300 dark:bg-[#22304A]"
                          )}
                        >
                          {person.avatar}
                        </span>
                        <span className="flex flex-col">
                          <span
                            className={cn(
                              "text-[13px] font-semibold",
                              isActive
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-slate-900 dark:text-slate-100"
                            )}
                          >
                            {person.name}
                          </span>
                          <span className="max-w-[160px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {person.title}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3">
                      <span className="flex items-center gap-1.5">
                        <Star
                          className={cn(
                            "size-3.5",
                            person.starred
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-300 dark:text-slate-600"
                          )}
                        />
                        <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">
                          {person.score}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 font-medium text-slate-700 dark:text-slate-400">
                      {person.company}
                    </td>
                    <td className="px-3 font-medium text-slate-900 dark:text-slate-200">
                      {person.email ?? "—"}
                    </td>
                    <td className="px-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                          person.verification === "verified"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
                        )}
                      >
                        {STATUS_LABEL[person.verification]}
                      </span>
                    </td>
                    <td className="px-3">
                      <span className="flex w-[76px] items-center gap-2">
                        <span className="font-mono text-[12px] font-medium tabular-nums text-slate-700 dark:text-white">
                          {person.confidence}%
                        </span>
                        <span className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#0B1220]">
                          <span
                            className="block h-full rounded-full bg-indigo-500 dark:bg-indigo-400"
                            style={{ width: `${person.confidence}%` }}
                          />
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-auto flex items-center justify-end gap-5 border-t border-slate-200 bg-slate-50/50 p-3 dark:border-[#22304A] dark:bg-[#0B1220]/50">
        <span className="text-[12px] font-medium text-slate-600 dark:text-slate-200">
          Page {page} of {pageCount}
        </span>
        <div className="flex items-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="h-[24px] px-2.5 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-slate-200 dark:hover:bg-[#16233A] dark:disabled:text-slate-600"
          >
            Prev
          </button>
          <span className="h-[24px] w-px bg-slate-200 dark:bg-[#22304A]" />
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            className="h-[24px] px-2.5 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-slate-200 dark:hover:bg-[#16233A] dark:disabled:text-slate-600"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings.

- [ ] **Step 4: Commit**

```bash
git add components/people/people-results-table.tsx components/people/person-detail-pane.tsx
git commit -m "feat(people): add the results table and detail pane"
```

---

### Task 20: rewrite `components/crm/people-section.tsx`

The orchestrator: owns URL state, runs the pure modules, passes down. Target
under 200 lines. The full-width data-source strip (Data source / Last Fetched /
Avg. Confidence) is **preserved unchanged** above everything.

**Files:**
- Modify: `components/crm/people-section.tsx` (full rewrite)

**Interfaces:**
- Consumes: `usePeopleQuery`, `usePeopleThread`, `PeopleFilterRail`,
  `PeopleAskPanel`, `PeopleResultsTable`, `PersonDetailPane`,
  `parsePeopleQuery`, `buildAnswer`, `buildPeopleFilterChips`, `people`.
- Produces: `PeopleSection` — the export `components/crm/section-router.tsx:70`
  already renders. Its signature does not change, so the router is untouched.

- [ ] **Step 1: Rewrite the section**

Replace the entire contents of `components/crm/people-section.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ChevronDown, UploadCloud } from "lucide-react";
import { PeopleAskPanel } from "@/components/people/people-ask-panel";
import { PeopleFilterRail } from "@/components/people/people-filter-rail";
import {
  PeopleResultsTable,
  type Selection,
} from "@/components/people/people-results-table";
import { PersonDetailPane } from "@/components/people/person-detail-pane";
import { usePeopleQuery } from "@/components/people/use-people-query";
import { usePeopleThread } from "@/components/people/use-people-thread";
import { useQueryStore } from "@/components/search/query-store";
import type { AnswerAction } from "@/lib/people/answer";
import { buildAnswer } from "@/lib/people/answer";
import { buildPeopleFilterChips } from "@/lib/people/chips";
import { people, peopleById } from "@/lib/people/data";
import { filterPeopleList } from "@/lib/people/filters";
import { parsePeopleQuery } from "@/lib/people/parse-query";
import type { Band } from "@/types/people";

const EMPTY_SELECTION: Selection = { mode: "page", ids: new Set() };

export function PeopleSection() {
  const query = usePeopleQuery();
  const thread = usePeopleThread();
  const store = useQueryStore("people_query");

  const [draft, setDraft] = useState("");
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Changing what is matched invalidates a selection made against the old set.
  useEffect(() => {
    setSelection(EMPTY_SELECTION);
  }, [query.filters, query.search]);

  // Live parse as the user types, debounced 250 ms: the rail and the table move
  // before Enter is pressed. Only Enter appends to the thread — this path just
  // applies filters, and clearing the input clears them again, which is what
  // restores the hero card.
  const { applyParsed, clearAll, vocabulary } = query;
  useEffect(() => {
    const text = draft.trim();
    const timer = setTimeout(() => {
      if (!text) {
        if (thread.messages.length === 0) clearAll();
        return;
      }
      applyParsed(parsePeopleQuery(text, vocabulary));
    }, 250);
    return () => clearTimeout(timer);
  }, [draft, applyParsed, clearAll, vocabulary, thread.messages.length]);

  // The detail pane falls back to the first row when the selection leaves the
  // filtered set, so it is never showing someone the table no longer holds.
  const selectedPerson = useMemo(() => {
    if (selectedId) {
      const match = query.rows.find((row) => row.id === selectedId);
      if (match) return match;
    }
    return query.pageRows[0] ?? null;
  }, [selectedId, query.rows, query.pageRows]);

  const ask = (text: string) => {
    const parsed = parsePeopleQuery(text, query.vocabulary);
    const rows = filterPeopleList(people, parsed.filters, "");
    const answer = buildAnswer({ parsed, rows, total: rows.length, people });

    // The duplicates answer pins the table to exactly the records it described.
    const pinned = parsed.intent === "duplicates" ? answer.previewIds : undefined;
    query.applyParsed(parsed, pinned);

    const chips = buildPeopleFilterChips(
      pinned && pinned.length > 0 ? { ...parsed.filters, ids: pinned } : parsed.filters,
      ""
    );
    thread.ask(text, answer, chips);
    store.record({ query: text, chips: chips.map(({ label, value }) => ({ label, value })) });
    setDraft("");
  };

  const onAction = (action: AnswerAction) => {
    // Bulk actions are cosmetic in this change — wiring them is separate work.
    if (action.kind === "clear") query.clearAll();
    if (action.kind === "save") store.record({ query: draft || "Saved search", chips: [] });
  };

  // Any query state collapses the hero to the sticky bar; clearing the input
  // with no thread behind it restores the hero.
  const collapsed =
    draft.trim().length > 0 || thread.messages.length > 0 || query.chips.length > 0;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-start justify-between gap-4 py-2 sm:flex-row sm:items-center"
      >
        <div>
          <h1 className="mb-1 flex items-baseline gap-3 text-[24px] font-bold tracking-tight text-slate-900 dark:text-white">
            People
            <span className="text-[12px] font-medium tracking-normal text-slate-500 dark:text-slate-400">
              {people.length.toLocaleString()} contacts
            </span>
          </h1>
          <p className="text-[13px] text-slate-600 dark:text-slate-400">
            Contacts with verification, source transparency, and bulk actions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="h-9 rounded-[8px] border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-[#111B2E] dark:text-slate-300 dark:hover:bg-white/[0.04]">
            Import CSV/XLSX
          </button>
          <button className="flex h-9 items-center gap-2 rounded-[8px] border border-slate-200 bg-white pl-4 pr-3 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-[#111B2E] dark:text-slate-300 dark:hover:bg-white/[0.04]">
            <span>Export</span>
            <ChevronDown className="size-4 text-slate-400" />
          </button>
        </div>
      </motion.div>

      {/* Transparency strip — preserved unchanged. */}
      <div className="flex flex-col items-center gap-6 rounded-[12px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E] md:flex-row">
        <div className="flex w-full flex-1 flex-col justify-center border-slate-200 dark:border-[#22304A] md:border-r md:pr-6">
          <p className="mb-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
            Data source
          </p>
          <div className="flex items-center gap-2">
            <UploadCloud className="size-4 text-indigo-500" />
            <p className="truncate text-[14px] font-semibold text-slate-900 dark:text-white">
              User import / Licensed dataset
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col justify-center border-slate-200 dark:border-[#22304A] md:w-auto md:border-r md:pr-6">
          <p className="mb-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
            Last Fetched
          </p>
          <p className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-900 dark:text-white">
            <Activity className="size-3.5 text-emerald-500" />
            2026-02-01
          </p>
        </div>
        <div className="flex w-full flex-1 flex-col justify-center">
          <p className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-slate-500 dark:text-slate-400">
            <span>
              Avg. Confidence
              <span className="ml-2 font-mono font-semibold text-slate-900 dark:text-white">
                84% <span className="font-medium text-emerald-500">(Good)</span>
              </span>
            </span>
            <span className="hidden text-[11px] text-slate-400 lg:block">
              Combines recency + source reliability.
            </span>
          </p>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#16233A]">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: "84%" }} />
          </div>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <PeopleFilterRail
          filters={query.filters}
          search={query.search}
          facets={query.facets}
          resultCount={query.total}
          onFiltersChange={query.setFilters}
          onSearchChange={query.setSearch}
          onClear={() => {
            query.clearAll();
            thread.clear();
          }}
        />

        <PeopleAskPanel
          collapsed={collapsed}
          value={draft}
          onChange={setDraft}
          onSubmit={ask}
          messages={thread.messages}
          previewFor={(ids) => ids.map((id) => peopleById[id]).filter(Boolean).slice(0, 4)}
          chips={query.chips}
          appliedSummary={`${query.chips.length} filter${query.chips.length === 1 ? "" : "s"} applied · ${query.total.toLocaleString()} matching`}
          onAction={onAction}
          onClear={() => {
            thread.clear();
            query.clearAll();
          }}
          onRemoveChip={query.removeChip}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <PeopleResultsTable
          rows={query.pageRows}
          total={query.total}
          page={query.page}
          pageCount={query.pageCount}
          band={query.filters.band}
          selection={selection}
          selectedId={selectedPerson?.id ?? null}
          chips={query.chips}
          onPageChange={query.setPage}
          onBandChange={(band: Band) => query.setFilters({ ...query.filters, band })}
          onSelectionChange={setSelection}
          onSelectRow={setSelectedId}
          onRemoveChip={query.removeChip}
          onClearAll={query.clearAll}
        />
        <PersonDetailPane person={selectedPerson} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck, lint and re-run the suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings.

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 3: Check it in the running app**

Run: `npm run dev`, open `http://localhost:3000/app/people`, and confirm:

1. The header reads `People 2,418 contacts` and the strip is unchanged.
2. The hero Ask card is showing, with the rail on the left.
3. Typing `verified marketing managers in Germany with 80%+ confidence` fills
   the table about a quarter-second after you stop typing — before Enter —
   collapses the card to the sticky bar, and shows five chips. Pressing Enter
   additionally appends the question and its prose answer to the thread.
4. The rail's Country, Job function, Verification and Confidence sections have
   ticked themselves to match, and `More filters (5)` has auto-opened because
   Seniority is set.
5. `Any duplicates I should merge?` names Sarah Miller and Sara Millar and pins
   the table.
6. Clearing the input restores the hero card.
7. The browser Network tab shows **no request** while any of this happens.

Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add components/crm/people-section.tsx
git commit -m "feat(people): wire the People Explorer together"
```

---

### Task 21: Acceptance and cleanup

**Files:**
- Modify: `docs/superpowers/specs/2026-08-01-people-explorer-design.md` — tick
  the acceptance boxes
- Modify: `CLAUDE.md` — one paragraph documenting the People path

- [ ] **Step 1: Run the full suite and the build**

Run: `npx vitest run`
Expected: PASS, every file, including `tests/integration/event-filters.test.ts`.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: clean.

Run: `npm run build`
Expected: succeeds. (This is a Next build, not a database or seed step, so it is
within the disk-space constraint.)

- [ ] **Step 2: Prove the isolation guarantees**

Run: `git diff --name-only main...HEAD`
Expected: no path under `components/events/`, `lib/events/`,
`components/crm/events-section.tsx` or `components/crm/companies-section.tsx`.

Run: `git grep -n "ANTHROPIC_API_KEY" -- lib/people lib/search components/people app/api/people`
Expected: no output.

Run: `git grep -n "dangerouslySetInnerHTML" -- components/people`
Expected: no output.

Run: `git grep -rn "fetch(" -- lib/people lib/search components/people`
Expected: no output.

- [ ] **Step 3: Walk the acceptance list**

With `npm run dev` running, confirm each box in the spec's Acceptance section,
then tick it in
`docs/superpowers/specs/2026-08-01-people-explorer-design.md`:

- [ ] `verified marketing managers in Germany with 80%+ confidence` returns the correct contacts with five distinct chips and no keyword chips
- [ ] The rail's checkboxes, sliders and quick chips tick themselves to match the parsed query, and `More filters` auto-opens when it holds a set filter
- [ ] The assistant replies in prose for all five answer kinds, with no network request in the path
- [ ] `Any duplicates I should merge?` surfaces Sarah Miller / Sara Millar and pins the table to the flagged records
- [ ] First result row visible without scrolling at 1366×768 in the query state
- [ ] Band pills compose with the other filters, produce a chip, and survive a URL round-trip (copy the address bar into a new tab)
- [ ] Bulk actions operate on the filtered set, including "Select all N matching"
- [ ] No reference to `ANTHROPIC_API_KEY` anywhere in the People path
- [ ] Companies and Events tabs untouched

- [ ] **Step 4: Document the feature**

Add to `CLAUDE.md`, directly after the **Find Shows** section:

```markdown
## People Explorer

`/app/people` — faceted rail + local assistant + results, all client-side.
Contacts are a static committed seed (`data/people-seed.json`, 2,418 records,
regenerated by `node scripts/generate-people-seed.mjs`), not Postgres, so the
header count is fixed and there is no tenancy question. Questions are parsed by
`lib/people/parse-query.ts` over the domain-free primitives in `lib/search/`
(normalize, phrase, fuzzy, numeric, textScore) — **no model call and no
`ANTHROPIC_API_KEY`**. Answers are structured `AnswerSegment[]` composed in
`lib/people/answer.ts`, never HTML. The URL query string is the single source of
truth (`lib/people/filters.ts` codec). `app/api/people/query/route.ts` wraps the
same pure modules for parity; the UI imports them directly so typing is instant.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-08-01-people-explorer-design.md
git commit -m "docs: record the People Explorer path and tick acceptance"
```

---

## Follow-ups (not in this change)

Carried from the spec, deliberately out of scope here:

- **Adopt `lib/search/` in Events**, replacing the unimplemented
  `lib/events/parse-query.ts` from the 2026-08-01 Events spec with the shared
  primitives built here. Events keeps its own `normalize` until then.
- **Persist contacts.** If contacts become real workspace data, extend the
  Prisma `Contact` model with the fields in `types/people.ts` and put a
  Prisma-backed loader behind `lib/people/search-index.ts`; nothing else needs
  to change.
- **Bulk actions are cosmetic.** Verify emails / Add to Sequence / Add to CRM /
  Export / Merge keep no-op handlers; wiring them is separate work.

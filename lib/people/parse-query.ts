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
  'contacts', 'contact', 'person', 'persons', 'leads', 'lead', 'buyers', 'buyer', 'anyone',
  'everyone', 'working', 'work', 'works', 'based', 'located', 'company', 'companies',
  'records', 'record', 'tagged', 'confidence', 'intent', 'dataset', 'emails', 'email',
  'over', 'above', 'least', 'more', 'than', 'their', 'has', 'have', 'his', 'her', 'they',
]);

function snapConfidence(percent: number): ConfidenceThreshold {
  // Snap DOWN to the nearest supported floor: asking for ">= 63%" must not
  // silently exclude the 63-69 band by rounding up to 70.
  const eligible = CONFIDENCE_THRESHOLDS.filter((threshold) => threshold <= percent);
  return (eligible[eligible.length - 1] ?? CONFIDENCE_THRESHOLDS[0]) as ConfidenceThreshold;
}

/** Split already-normalised text into comparable word tokens. */
function tokenize(text: string): string[] {
  return text.split(/[^a-z0-9+]+/).filter(Boolean);
}

/**
 * Finds a run of tokens matching the phrase, comparing each token both
 * literally and singularised — so "marketing managers" matches the title
 * "Marketing Manager" while "United States" still matches itself. Consumed
 * slots hold `null` and can never be re-matched by a later, shorter phrase.
 */
function findRun(tokens: (string | null)[], needle: string[]): number {
  outer: for (let start = 0; start + needle.length <= tokens.length; start += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      const token = tokens[start + offset];
      if (token === null) continue outer;
      const word = needle[offset];
      if (token !== word && singularize(token) !== singularize(word)) continue outer;
    }
    return start;
  }
  return -1;
}

/**
 * Longest phrase first, so "Head of Product" claims its words before
 * "Product Manager" can. Mutates `tokens`, blanking whatever it consumes.
 */
function consumePhrases(tokens: (string | null)[], candidates: readonly string[]): string[] {
  const matched: string[] = [];
  const ordered = [...candidates].sort(
    (left, right) => right.length - left.length || left.localeCompare(right)
  );

  for (const candidate of ordered) {
    const needle = tokenize(normalizePeopleText(candidate));
    if (needle.length === 0) continue;

    const at = findRun(tokens, needle);
    if (at === -1) continue;

    matched.push(candidate);
    for (let index = at; index < at + needle.length; index += 1) tokens[index] = null;
  }

  return matched;
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

  // 2. Verification. "unverified" cannot be mistaken for "verified" because
  //    \b requires a boundary, and there is none mid-word.
  for (const phrase of [
    'needs verification', 'unverified', 'unconfirmed', 'verified', 'invalid',
    'bounced', 'valid', 'confirmed', 'pending',
  ]) {
    const pattern = new RegExp(`\\b${phrase}\\b`);
    if (!pattern.test(rest)) continue;
    const status = resolveVerification(phrase);
    if (status) {
      filters.verification = status;
      rest = rest.replace(pattern, ' ');
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
    const pattern = new RegExp(`\\b${phrase}\\b`);
    if (!pattern.test(rest)) continue;
    if ((DATA_SOURCES as readonly string[]).includes(source)) {
      filters.sources = uniq([...filters.sources, source]);
    }
    rest = rest.replace(pattern, ' ');
    break;
  }

  // 5. Headcount phrases ("enterprise", "startup") then explicit bands.
  for (const phrase of [
    'small business', 'mid-market', 'mid market', 'midmarket', 'large company',
    'enterprise', 'startup', 'smb',
  ]) {
    const pattern = new RegExp(`\\b${phrase}\\b`);
    if (!pattern.test(rest)) continue;
    const band = resolveHeadcountBand(phrase);
    if (band) {
      filters.headcounts = uniq([...filters.headcounts, band]);
      rest = rest.replace(pattern, ' ');
    }
    break;
  }
  const explicitBand = rest.match(/(\d{1,4}-\d{1,4}|5000\+)/);
  if (explicitBand) {
    const band = resolveHeadcountBand(explicitBand[1]);
    if (band) {
      filters.headcounts = uniq([...filters.headcounts, band]);
      rest = rest.replace(explicitBand[0], ' ');
    }
  }

  // 6. Open vocabularies, longest phrase first. Order matters: titles before
  //    departments, so "marketing manager" is not eaten by "marketing", and
  //    locations before countries, so "Berlin, Germany" beats bare "Germany".
  const tokens: (string | null)[] = tokenize(rest);

  filters.titles = uniq([...filters.titles, ...consumePhrases(tokens, vocabulary.titles)]);
  filters.locations = uniq([...filters.locations, ...consumePhrases(tokens, vocabulary.locations)]);
  filters.countries = uniq([...filters.countries, ...consumePhrases(tokens, vocabulary.countries)]);
  filters.companies = uniq([...filters.companies, ...consumePhrases(tokens, vocabulary.companies)]);
  filters.industries = uniq([
    ...filters.industries,
    ...consumePhrases(tokens, vocabulary.industries),
  ]);
  filters.keywords = uniq([...filters.keywords, ...consumePhrases(tokens, vocabulary.keywords)]);

  // 7. Seniority and department from whatever words survive. Stop words are
  //    checked first: "people" means contacts here, not the HR department.
  const unconsumed: string[] = [];
  for (const token of tokens) {
    if (token === null) continue;
    if (STOP_WORDS.has(token) || STOP_WORDS.has(singularize(token))) continue;

    const seniority = resolveSeniority(token);
    if (seniority) {
      filters.seniorities = uniq([...filters.seniorities, seniority]);
      continue;
    }

    const department = resolveDepartment(token);
    if (department) {
      filters.departments = uniq([...filters.departments, department]);
      continue;
    }

    unconsumed.push(token);
  }

  // 8. Anything genuinely unrecognised becomes the search box, so the question
  //    always does something visible.
  if (unconsumed.length > 0) filters.search = raw;

  return filters;
}

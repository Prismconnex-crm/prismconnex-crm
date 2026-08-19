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

  // How the question was read, in the same words the chips use — so the prose
  // and the chips below it can never describe different searches.
  const chips = buildPeopleFilterChips(filters);
  const readAs = chips
    .filter((chip) => chip.label !== 'Search' && chip.label !== 'Similar to')
    .map((chip) => `${chip.label.toLowerCase()} ${chip.value}`);

  sentences.push(
    hasAnyPeopleFilter(filters) && readAs.length > 0
      ? `Found ${total.toLocaleString()} ${total === 1 ? 'contact' : 'contacts'} with ${listPhrase(readAs)}.`
      : `Found ${total.toLocaleString()} ${total === 1 ? 'contact' : 'contacts'}.`
  );

  if (matches.length > 0) {
    const verified = matches.filter((person) => person.verification === 'verified').length;
    const averageConfidence = Math.round(
      matches.reduce((sum, person) => sum + person.confidence, 0) / matches.length
    );
    sentences.push(
      `Of the ${matches.length} shown, ${verified} ${verified === 1 ? 'has' : 'have'} a verified work email, ` +
        `and average confidence is ${averageConfidence}%.`
    );

    const companyNames = matches.map((person) => person.company);
    const companies = topValues(companyNames, 3);
    if (companies.length > 0 && companies[0].count > 1) {
      sentences.push(
        `Most come from ${listPhrase(companies.map((entry) => `${entry.value} (${entry.count})`))}.`
      );
    } else if (companies.length > 1) {
      // Every company appears once — "most come from" would be a false claim.
      sentences.push(`They are spread across ${new Set(companyNames).size} different companies.`);
    }

    const countries = topValues(
      matches.map((person) => person.country),
      2
    );
    if (countries.length > 1) {
      sentences.push(`Locations skew towards ${listPhrase(countries.map((entry) => entry.value))}.`);
    }
  }

  return sentences.join(' ').trim();
}

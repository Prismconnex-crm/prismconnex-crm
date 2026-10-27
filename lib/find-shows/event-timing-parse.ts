/**
 * Pure text rules for event clock-time discovery, shared by every official site.
 *
 * - Date mentions in English, French, German, Spanish, Italian, Portuguese and
 *   Dutch ("2 November, 2026", "November 2-5, 2026", "02.11.2026", "2026-11-02").
 * - Edition evidence: a page counts as describing the edition only when it names
 *   a date with an explicit year inside the edition's date range.
 * - Clock ranges ("10AM - 6:30PM", "09:30 – 18:00", "10h à 18h", "10 bis 18 Uhr").
 *   A bare number is never read as a time ("10 - 18" could be a date range).
 * - Per-day schedules: the first verified day inside the edition wins (day-1 rule).
 *
 * Nothing here guesses: no default hours, no meridian inference.
 */

/** An edition's date range; `name` (the event's own name) keeps "ESC Congress" from reading as a side activity. */
export type EditionDates = { startDate: string; endDate: string; name?: string };

export type ClockRange = { start: string; end: string; raw: string; index: number; length: number };

export type DateMention = {
  index: number;
  end: number;
  /** Candidate ISO dates (a numeric 03/04/2027 has two readings; a range "2-5 Nov" has two days). */
  dates: string[];
  /** Whether the mention carries its own year. */
  hasYear: boolean;
  raw: string;
};

export type DailyTiming = { date: string; start: string; end: string; snippet: string };

// --- Text -----------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  amp: '&', nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', quot: '"', apos: "'", lt: '<', gt: '>', rsquo: "'", lsquo: "'",
};

export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Dates ----------------------------------------------------------------------

const MONTH_NAMES: [number, string[]][] = [
  [1, ['january', 'jan', 'janvier', 'januar', 'jänner', 'enero', 'gennaio', 'janeiro', 'januari']],
  [2, ['february', 'feb', 'février', 'fevrier', 'februar', 'febrero', 'febbraio', 'fevereiro', 'februari']],
  [3, ['march', 'mar', 'mars', 'märz', 'maerz', 'marzo', 'março', 'marco', 'maart']],
  [4, ['april', 'apr', 'avril', 'abril', 'aprile']],
  [5, ['may', 'mai', 'mayo', 'maggio', 'maio', 'mei']],
  [6, ['june', 'jun', 'juin', 'juni', 'junio', 'giugno', 'junho']],
  [7, ['july', 'jul', 'juillet', 'juli', 'julio', 'luglio', 'julho']],
  [8, ['august', 'aug', 'août', 'aout', 'agosto', 'augustus']],
  [9, ['september', 'sep', 'sept', 'septembre', 'septiembre', 'setiembre', 'settembre', 'setembro']],
  [10, ['october', 'oct', 'octobre', 'oktober', 'octubre', 'ottobre', 'outubro']],
  [11, ['november', 'nov', 'novembre', 'noviembre', 'novembro']],
  [12, ['december', 'dec', 'décembre', 'decembre', 'dezember', 'diciembre', 'dicembre', 'dezembro']],
];

const MONTH_BY_NAME = new Map<string, number>(MONTH_NAMES.flatMap(([month, names]) => names.map((name) => [name, month] as const)));
const MONTH = `(${Array.from(MONTH_BY_NAME.keys()).sort((a, b) => b.length - a.length).join('|')})`;
const ORD = `(?:st|nd|rd|th|er|e|\\.)?`;
const RANGE_SEP = `\\s*(?:-|–|—|to|au|bis|al|a|tot)\\s*`;

/** "2 November 2026", "2-5 November, 2026", "7th - 8th August 2027", "2 de noviembre de 2026". */
const DAY_MONTH = new RegExp(
  `(?<![\\p{L}\\d])(\\d{1,2})${ORD}(?:${RANGE_SEP}(\\d{1,2})${ORD})?\\s*(?:of\\s+|de\\s+)?${MONTH}(?![\\p{L}])\\.?(?:,?\\s*(?:de\\s+)?(\\d{4})(?!\\d))?`,
  'giu'
);
/**
 * "November 2, 2026", "Nov 2-5, 2026". A day number is never the hour of a following clock
 * time: in "November 11 - 10:00 - 17:00" the "10" opens the hours, it does not end a 11–10 range.
 */
const NOT_AN_HOUR = String.raw`(?![:.h]\d)(?!\s*(?:a\.?\s?m\.?|p\.?\s?m\.?|uhr)(?![\p{L}]))`;
const MONTH_DAY = new RegExp(
  `(?<![\\p{L}])${MONTH}(?![\\p{L}])\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)${NOT_AN_HOUR}(?:\\s*(?:-|–|—)\\s*(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)${NOT_AN_HOUR})?(?:,?\\s+(\\d{4})(?!\\d))?`,
  'giu'
);
const ISO_DATE = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
const NUMERIC_DATE = /(?<![\d.\/])(\d{1,2})[./](\d{1,2})[./](\d{4})(?!\d)/g;

const pad = (value: number) => String(value).padStart(2, '0');

function isoOf(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const editionYear = (edition: EditionDates) => Number(edition.startDate.slice(0, 4));

/**
 * Every date mention in the text. A mention without a year is resolved against
 * `fallbackYear` (when given) — callers only pass one when the page itself is
 * already known to describe the edition.
 */
export function findDateMentions(text: string, fallbackYear?: number): DateMention[] {
  const found: DateMention[] = [];
  const push = (index: number, raw: string, dates: (string | null)[], hasYear: boolean) => {
    const valid = dates.filter((date): date is string => Boolean(date));
    if (valid.length) found.push({ index, end: index + raw.length, dates: Array.from(new Set(valid)), hasYear, raw });
  };

  for (const match of Array.from(text.matchAll(DAY_MONTH))) {
    const month = MONTH_BY_NAME.get(match[3].toLowerCase());
    const year = match[4] ? Number(match[4]) : fallbackYear;
    if (!month || !year) continue;
    push(match.index!, match[0], [isoOf(year, month, Number(match[1])), match[2] ? isoOf(year, month, Number(match[2])) : null], Boolean(match[4]));
  }
  for (const match of Array.from(text.matchAll(MONTH_DAY))) {
    const month = MONTH_BY_NAME.get(match[1].toLowerCase());
    const year = match[4] ? Number(match[4]) : fallbackYear;
    if (!month || !year) continue;
    push(match.index!, match[0], [isoOf(year, month, Number(match[2])), match[3] ? isoOf(year, month, Number(match[3])) : null], Boolean(match[4]));
  }
  for (const match of Array.from(text.matchAll(ISO_DATE))) {
    push(match.index!, match[0], [isoOf(Number(match[1]), Number(match[2]), Number(match[3]))], true);
  }
  for (const match of Array.from(text.matchAll(NUMERIC_DATE))) {
    const [a, b, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
    // Day-first and month-first readings; the edition range decides which one is meant.
    push(match.index!, match[0], [isoOf(year, b, a), isoOf(year, a, b)], true);
  }

  // Overlapping matches (e.g. "November 2026" inside "2 November 2026"): keep the earliest, longest one —
  // unless only the later one carries a year: in "Day 1 May 27, 2027" the date is "May 27, 2027", not "1 May".
  found.sort((x, y) => x.index - y.index || y.end - x.end);
  const kept: DateMention[] = [];
  for (const mention of found) {
    const last = kept[kept.length - 1];
    if (last && mention.index < last.end) {
      if (!last.hasYear && mention.hasYear) kept[kept.length - 1] = mention;
      continue;
    }
    kept.push(mention);
  }
  return kept;
}

export const inEdition = (iso: string, edition: EditionDates) => iso >= edition.startDate && iso <= edition.endDate;

/**
 * Whether a page describes this edition:
 * - 'match'    — it names a dated day (with its year) inside the edition's range;
 * - 'conflict' — it names dated days, none of them in the edition (another year or edition);
 * - 'none'     — it names no dated day at all.
 */
export function editionEvidence(text: string, edition: EditionDates): 'match' | 'conflict' | 'none' {
  const dated = findDateMentions(text).filter((mention) => mention.hasYear);
  if (dated.some((mention) => mention.dates.some((date) => inEdition(date, edition)))) return 'match';
  return dated.length ? 'conflict' : 'none';
}

// --- Clock times ----------------------------------------------------------------

const CLOCK = String.raw`(\d{1,2})(?:\s*(:|\.|h)\s*(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?|h(?![a-z\d])|hrs?(?![a-z]))?`;
const CLOCK_SEP = String.raw`\s*(?:-|–|—|~|to|until|till|bis|à|a|al|alle|tot|through)\s*`;
const CLOCK_RANGE_SOURCE = `(?<![\\d:.])${CLOCK}${CLOCK_SEP}${CLOCK}(\\s*uhr)?(?![\\d])`;

type ClockToken = { hour: string; sep?: string; minute?: string; suffix?: string };

function tokenToTime(token: ClockToken, uhr: boolean): { hours: number; minutes: number } | null {
  const hours = Number(token.hour);
  const minutes = token.minute ? Number(token.minute) : 0;
  const suffix = token.suffix?.toLowerCase().replace(/[\s.]/g, '') ?? '';
  const meridian = suffix === 'am' || suffix === 'pm' ? suffix : null;
  // A clock time needs a form that cannot be a plain number: minutes after ":" or "h",
  // a meridian, an "h" suffix, or a range followed by "Uhr". "9.30" counts only with a meridian or "Uhr".
  const explicit =
    Boolean(meridian) ||
    suffix === 'h' ||
    suffix.startsWith('hr') ||
    uhr ||
    (token.minute !== undefined && (token.sep === ':' || token.sep?.toLowerCase() === 'h'));
  if (!explicit || minutes > 59) return null;
  if (meridian) {
    if (hours < 1 || hours > 12) return null;
    return { hours: (hours % 12) + (meridian === 'pm' ? 12 : 0), minutes };
  }
  if (hours > 23) return null;
  return { hours, minutes };
}

export const toClock = (time: { hours: number; minutes: number }) => `${pad(time.hours)}:${pad(time.minutes)}`;

/**
 * Every opening–closing clock range in the text, normalised to 24-hour "HH:MM".
 *
 * A candidate that is not a valid range (e.g. "11 - 10:00", a day number before the opening
 * time) must not consume its characters: scanning resumes one character later, so the real
 * range "10:00 - 17:00" that overlaps it is still found.
 */
export function findClockRanges(text: string): ClockRange[] {
  const ranges: ClockRange[] = [];
  const pattern = new RegExp(CLOCK_RANGE_SOURCE, 'gi');
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const uhr = Boolean(match[9]);
    const start = tokenToTime({ hour: match[1], sep: match[2], minute: match[3], suffix: match[4] }, uhr);
    const end = tokenToTime({ hour: match[5], sep: match[6], minute: match[7], suffix: match[8] }, uhr);
    // Opening must come before closing on the same day.
    if (!start || !end || start.hours * 60 + start.minutes >= end.hours * 60 + end.minutes) {
      pattern.lastIndex = match.index + 1;
      continue;
    }
    ranges.push({ start: toClock(start), end: toClock(end), raw: match[0].trim(), index: match.index, length: match[0].length });
  }
  return ranges;
}

// --- Schedules ------------------------------------------------------------------

/** Words that introduce visitor/show hours (not conference session agendas). */
const HOURS_LABEL =
  /\btimings?\b|opening\s*(?:hours|times)|opening\s+and\s+closing\s+(?:hours|times)|\b(?:show|exhibition|event|fair|expo)\s+(?:is|will\s+be)\s+open\b|\bdates?\s+(?:and|&)\s+times?\b|open(?:ing)?\s+daily|show\s*(?:hours|times)|exhibition\s*(?:hours|times)|visitor\s*(?:hours|times)|visiting\s*(?:hours|times)|trading\s*hours|event\s*(?:hours|times)|daily\s*hours|öffnungszeiten|horaires?(?:\s+d['’]ouverture)?|heures\s+d['’]ouverture|orari(?:\s+di\s+apertura)?|horarios?(?:\s+de\s+apertura)?|hor[aá]rio\s+de\s+funcionamento|openingstijden/i;

/**
 * "When" as a label ("When:", "When?", "When & where", "When Friday 9:00 AM - 6:00 PM"). It is weak:
 * what follows it must read as a heading, not a sentence ("when you arrive between …") — isHeadingGap.
 */
const WHEN_HEADING = String.raw`\bwhen\b`;

const SCHEDULE_LABEL = new RegExp(`${HOURS_LABEL.source}|${WHEN_HEADING}`, 'gi');

/** Labels too common in other senses ("Timing Chip Pick-Up", "when you arrive") to stand alone. */
const WEAK_LABEL = /^(?:when|timings?)$/i;

/** What the main event's hours are called: the show/exhibition itself, or its opening hours. */
const MAIN_EVENT_WORD =
  new RegExp(String.raw`(?<![\p{L}\d])(?:exhibitions?|exhibits?|shows?|expos?|fairs?|\p{L}*messen?|\p{L}*ausstellung(?:en)?|salons?|ferias?|fieras?|beurs|visitors?|visiting|public|opening\s*(?:hours|times)|opening\s+and\s+closing\s+(?:hours|times)|open(?:ing)?\s+daily|show\s*(?:hours|times)|öffnungszeiten|horaires?|orari|horarios?|openingstijden|doors?\s+open)(?![\p{L}\d])`, 'giu');

/** Side activities whose times are not the event's opening hours. */
const SIDE_ACTIVITY_WORD =
  new RegExp(String.raw`(?<![\p{L}\d])(?:drinks?|receptions?|cocktails?|networking|dinners?|gala|part(?:y|ies)|after[\s-]?part(?:y|ies)|happy\s+hours?|seminars?|conferences?|congress(?:es)?|symposi(?:um|a)|keynotes?|panels?|sessions?|workshops?|masterclass(?:es)?|registration|check[\s-]?in|badges?|accreditation|awards?|ceremon(?:y|ies)|breakfasts?|lunch(?:es|eon)?|build[\s-]?up|set[\s-]?up|move[\s-]?in|dismantl\w*|tear[\s-]?down|move[\s-]?out|exhibitors?|press|pick[\s-]?up|empfang|abendveranstaltung|abend|kongress|konferenz(?:en)?|preisverleihung|aufbau|abbau|soirée|conférences?|colloques?|ateliers?|remise\s+des\s+prix|montage|démontage|cenas?|conferencias?|congresos?|talleres?|premiación|montaje|desmontaje|convegn[oi]|conferenz[ae]|cerimonia|premiazione|allestimento|disallestimento)(?![\p{L}\d])`, 'giu');

/** A side-activity word directly in front of a phrase ("Seminar " + "opening times"). */
const SIDE_QUALIFIER = new RegExp(`(${SIDE_ACTIVITY_WORD.source})[\\s-]*$`, 'iu');

/** Strips e-mail addresses and URLs ("registration@show.com") so they are not read as words. */
const withoutAddresses = (text: string) => text.replace(/\S+@\S+|\S*(?:https?:\/\/|www\.)\S*/gi, ' ');

/** A side-activity word that is part of the event's own name ("ESC Congress") names the event itself. */
function isOwnName(word: string, eventName: string | undefined): boolean {
  if (!eventName) return false;
  const stem = word.toLowerCase().replace(/\s+/g, ' ').replace(/(?:es|s)$/, '');
  return eventName.toLowerCase().includes(stem);
}

/**
 * What the words closest before a time range say it is: the main event's hours ('main'), a side
 * activity such as a drinks reception, seminar or registration ('side'), or nothing either way.
 * The nearest signal wins: in "Opening times 10:00 - 17:00 (drinks reception 17:00 - 18:30)" the
 * first range follows "Opening times", the second follows "drinks reception".
 */
export function timeContext(before: string, eventName?: string): 'main' | 'side' | null {
  const text = withoutAddresses(before);
  let best: { end: number; kind: 'main' | 'side' } | null = null;
  for (const match of Array.from(text.matchAll(MAIN_EVENT_WORD))) {
    const end = match.index! + match[0].length;
    // "Seminar opening times", "Exhibitor opening hours": the qualifier names whose hours these are.
    const qualifier = text.slice(Math.max(0, match.index! - 30), match.index!).match(SIDE_QUALIFIER)?.[1];
    const kind = qualifier && !isOwnName(qualifier, eventName) ? 'side' : 'main';
    if (!best || end >= best.end) best = { end, kind };
  }
  for (const match of Array.from(text.matchAll(SIDE_ACTIVITY_WORD))) {
    if (isOwnName(match[0], eventName)) continue;
    const end = match.index! + match[0].length;
    if (!best || end > best.end) best = { end, kind: 'side' };
  }
  return best?.kind ?? null;
}

const DAY_WORD = new RegExp(String.raw`(?<![\p{L}])(?:days?|tag|jour(?:née)?|día|giorno|dag)(?![\p{L}])`, 'iu');

/**
 * Whether a title (e.g. a JSON-LD sub-event name) refers to the main event or one of its days
 * ("Exhibition day 1", "Day 2", "Trade fair") — as opposed to a session title ("Keynote: …", "The future of …").
 */
export function namesMainEventOrDay(title: string | null | undefined): boolean {
  if (!title) return false;
  return DAY_WORD.test(title) || new RegExp(MAIN_EVENT_WORD.source, 'iu').test(withoutAddresses(title));
}

/** Whether a title (e.g. a JSON-LD sub-event name) names a side activity rather than the event. */
export function namesSideActivity(title: string | null | undefined, eventName?: string): boolean {
  if (!title) return false;
  const text = withoutAddresses(title);
  const side = Array.from(text.matchAll(SIDE_ACTIVITY_WORD)).some((match) => !isOwnName(match[0], eventName));
  return side && !new RegExp(MAIN_EVENT_WORD.source, 'iu').test(text);
}

const HEADING_FILLER =
  new RegExp(String.raw`(?<![\p{L}])(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday|s)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|daily|every\s+day|each\s+day|days?|where|and|from|the|on|at|is|open|doors|dates?|times?|hours?|show|event)(?![\p{L}])`, 'giu');

/**
 * Text between a weak label and its time range must read like a heading ("When & where Wednesday
 * 11 November 2026", "When? 2027 Show Dates & Times Friday 22nd January", "Timing:"), not a sentence
 * ("Timing Chip Pick-Up for Sprint athletes •", "when you arrive between"). Dates, clock ranges
 * (earlier lines of the same schedule), weekdays and heading words are ignored; at most one other word.
 */
function isHeadingGap(gap: string, edition: EditionDates): boolean {
  const spans = [
    ...findDateMentions(gap, editionYear(edition)).map((mention) => [mention.index, mention.end]),
    ...findClockRanges(gap).map((range) => [range.index, range.index + range.length]),
  ].sort((a, b) => b[0] - a[0]);
  let rest = gap;
  for (const [start, end] of spans) rest = rest.slice(0, start) + ' ' + rest.slice(end);
  const words = rest.replace(HEADING_FILLER, ' ').match(new RegExp(String.raw`\p{L}{2,}`, 'gu')) ?? [];
  return words.length <= 1;
}

/**
 * Where the words describing a label start: up to 30 characters before it, but not across a
 * sentence or list boundary ("…no registration required. When Open 10am - 5pm" starts at "When").
 */
function clauseStart(text: string, labelIndex: number, floor = 0): number {
  const from = Math.max(floor, labelIndex - 30);
  const boundaries = Array.from(text.slice(from, labelIndex).matchAll(/[.!?;•|](?=\s)/g));
  const last = boundaries[boundaries.length - 1];
  return last ? from + last.index! + 1 : from;
}

/**
 * Each date's schedule line, as a [start, end] span: the date, any words, and the first clock range
 * within 60 characters — when no other date comes first ("Kongress 1. September 2026, 10:00 bis 17:00").
 */
function scheduleLines(text: string, mentions: DateMention[]): ([number, number] | null)[] {
  return mentions.map((mention, index) => {
    const range = findClockRanges(text.slice(mention.end, mention.end + 60))[0];
    if (!range) return null;
    const rangeStart = mention.end + range.index;
    const next = mentions[index + 1];
    if (next && next.index < rangeStart) return null;
    return [mention.index, rangeStart + range.length];
  });
}

/** text[from, to) with the given spans replaced by spaces. */
function blankSpans(text: string, from: number, to: number, spans: ([number, number] | null)[]): string {
  let out = text.slice(from, to);
  for (const span of spans) {
    if (!span || span[1] <= from || span[0] >= to) continue;
    const start = Math.max(span[0], from) - from;
    const end = Math.min(span[1], to) - from;
    out = out.slice(0, start) + ' '.repeat(end - start) + out.slice(end);
  }
  return out;
}

/**
 * Per-day schedule lines ("2 November, 2026: 10AM - 6:30PM", "Tue 2 Nov | 10:00–18:30"),
 * restricted to days inside the edition, introduced by an hours label or a "When" heading, and
 * not introduced as a side activity ("Conference Timings November 10: 9am – 5:30pm"). Sorted by date.
 */
export function extractDailySchedule(text: string, edition: EditionDates): DailyTiming[] {
  const fallbackYear = editionEvidence(text, edition) === 'match' ? editionYear(edition) : undefined;
  const days = new Map<string, DailyTiming>();

  const mentions = findDateMentions(text, fallbackYear);
  const lines = scheduleLines(text, mentions);
  for (let position = 0; position < mentions.length; position++) {
    const mention = mentions[position];
    const day = mention.dates.find((date) => inEdition(date, edition));
    if (!day) continue;
    // The clock range must follow the date directly (punctuation / a weekday in brackets allowed).
    const after = text.slice(mention.end, mention.end + 60);
    const lead = after.match(/^[\s,:;|•·\-–—]*(?:\([^)]{0,15}\)[\s,:;|\-–—]*)?(?:from\s+|de\s+|von\s+)?/i)![0];
    const range = findClockRanges(after.slice(lead.length)).find((r) => r.index === 0);
    if (!range) continue;
    // Only hours introduced by a schedule label: the nearest one within 300 characters that heads
    // this line (a weak "When"/"Timings" must be followed by heading text, not a sentence)…
    const windowStart = Math.max(0, mention.index - 300);
    const labelIndex = Array.from(text.slice(windowStart, mention.index).matchAll(SCHEDULE_LABEL))
      .map((match) => ({ index: windowStart + match.index!, end: windowStart + match.index! + match[0].length, weak: WEAK_LABEL.test(match[0].trim()) }))
      .reverse()
      .find((label) => {
        if (!label.weak) return true;
        const gap = text.slice(label.end, mention.index);
        return isHeadingGap(gap, edition) || timeContext(gap, edition.name) === 'main';
      })?.index;
    if (labelIndex === undefined) continue;
    // …and not for a side activity (the words nearest before the date, within the label's clause, decide).
    // Earlier lines are blanked out: "Opening Ceremony" on the 10 September line says nothing about the 11th,
    // while a block heading ("Kongress", "Fachmesse") before its lines still does.
    const contextStart = clauseStart(text, labelIndex, windowStart);
    const context = blankSpans(text, contextStart, mention.index, lines.slice(0, position));
    if (timeContext(context, edition.name) === 'side') continue;
    if (!days.has(day)) {
      days.set(day, { date: day, start: range.start, end: range.end, snippet: `${mention.raw}${lead}${range.raw}`.replace(/\s+/g, ' ').trim() });
    }
  }
  return Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The first labelled hours range in the text ("Opening hours: 09:30 - 18:00", "Open daily 10am - 5pm").
 * With `edition`, a range whose label names a date outside the edition ("OPENING TIMES 11 May 2027: …"
 * on a page for the 2026 edition) is skipped: those hours belong to another edition. A range for a
 * side activity is skipped too, and a weak label ("When", "Timing") must head its range directly.
 */
export function extractLabelledHours(
  text: string,
  edition?: EditionDates
): (ClockRange & { snippet: string; zone: string | null }) | null {
  for (const label of Array.from(text.matchAll(SCHEDULE_LABEL))) {
    const from = label.index! + label[0].length;
    const weak = WEAK_LABEL.test(label[0].trim());
    // A range within 80 characters of the label, skipping any that belong to a side activity.
    const range = findClockRanges(text.slice(from, from + 140)).find((candidate) => {
      if (candidate.index > 80) return false;
      if (timeContext(text.slice(clauseStart(text, label.index!), from + candidate.index), edition?.name) === 'side') return false;
      if (!edition) return true;
      const gapText = text.slice(from, from + candidate.index);
      const gap = findDateMentions(gapText, editionYear(edition));
      const inThisEdition = gap.some((mention) => mention.dates.some((date) => inEdition(date, edition)));
      if (gap.length && !inThisEdition) return false;
      // A weak label stands when a date of this edition, a heading, or the main event itself
      // ("timings? The exhibition will be open from …") introduces the range.
      return !weak || inThisEdition || isHeadingGap(gapText, edition) || timeContext(gapText, edition.name) === 'main';
    });
    if (!range) continue;
    const rangeEnd = from + range.index + range.length;
    const zone =
      text
        .slice(rangeEnd, rangeEnd + 20)
        .match(/^\s*\(?\b(CET|CEST|GMT|BST|UTC|EST|EDT|CST|CDT|MST|MDT|PST|PDT|JST|KST|SGT|HKT|GST|IST|AEST|AEDT|ACST|AWST|NZST|NZDT|EET|EEST|WET|WEST|MSK|BRT|ICT|WIB)\b/i)?.[1]
        ?.toUpperCase() ?? null;
    return { ...range, snippet: text.slice(label.index!, rangeEnd).replace(/\s+/g, ' ').trim(), zone };
  }
  return null;
}

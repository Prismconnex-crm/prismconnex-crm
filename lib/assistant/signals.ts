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
    { word: 'ceos' },
    { word: 'cto' },
    { word: 'ctos' },
    { word: 'cmo' },
    { word: 'cmos' },
    { word: 'cfo' },
    { word: 'cfos' },
    { word: 'cxo' },
    { word: 'cxos' },
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

/** A signal directly after a head phrase — the noun the user wants back. */
export const HEAD_MULTIPLIER = 3;
/** A signal directly after a qualifier phrase — merely narrowing the request. */
export const QUALIFIER_MULTIPLIER = 0.3;
/**
 * A signal opening the sentence with no marker before it. Deliberately smaller
 * than HEAD_MULTIPLIER: "companies and contacts" names two deliverables and
 * should stay a near-tie the confirm-gate can catch, not a confident answer.
 */
export const LEAD_MULTIPLIER = 1.5;
/** How many words after a marker still count as that marker's position. */
export const PROXIMITY_WORDS = 3;

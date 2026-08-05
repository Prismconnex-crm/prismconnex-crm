import { z } from 'zod';
import { isValidIsoDate } from '@/lib/events/filters';
import { findShowsCategories, findShowsRegions } from '@/lib/find-shows/catalog';

/**
 * Request/response contracts for POST /api/ai/event-query and
 * POST /api/ai/event-answer.
 *
 * The model's only job is to turn a sentence into filters — it never names an
 * event or a date of its own, so a result can't be hallucinated. Everything it
 * returns is validated against these schemas before it reaches the client.
 */

/** Closed vocabularies, minus the "All …" sentinels the UI uses for "no filter". */
export const ALLOWED_REGIONS = findShowsRegions.filter((region) => region !== 'All Regions');
export const ALLOWED_CATEGORIES = findShowsCategories.filter(
  (category) => category !== 'All Categories'
);

/** A real calendar day, not just something YYYY-MM-DD shaped. */
const isoDate = z.string().refine(isValidIsoDate, 'Expected a real calendar date as YYYY-MM-DD');

const stringList = z.array(z.string().trim().min(1).max(120)).max(25);

export const eventFiltersSchema = z.object({
  regions: z.array(z.enum(ALLOWED_REGIONS as [string, ...string[]])).max(4),
  countries: stringList,
  cities: stringList,
  categories: z.array(z.enum(ALLOWED_CATEGORIES as [string, ...string[]])).max(13),
  organizers: stringList,
  keywords: stringList,
  dateFrom: isoDate.nullable(),
  dateTo: isoDate.nullable(),
  favouritesOnly: z.boolean(),
});

export const eventQueryRequestSchema = z.object({
  prompt: z.string().trim().min(2).max(500),
  currentFilters: eventFiltersSchema.partial().optional(),
});

export type EventQueryRequest = z.infer<typeof eventQueryRequestSchema>;

export const eventQueryResponseSchema = z.object({
  filters: eventFiltersSchema,
  explanation: z.string().trim().min(1).max(400),
  suggestedFollowUps: z.array(z.string().trim().min(1).max(120)).max(3),
});

/** Rows are supplied by the client from the already-filtered result set. */
export const eventAnswerRequestSchema = z.object({
  question: z.string().trim().min(2).max(500),
  totalMatched: z.number().int().min(0),
  rows: z
    .array(
      z.object({
        name: z.string().max(200),
        organizer: z.string().max(200),
        city: z.string().max(120),
        country: z.string().max(120),
        dates: z.string().max(80),
        category: z.string().max(80),
      })
    )
    .max(40),
});

export type EventAnswerRequest = z.infer<typeof eventAnswerRequestSchema>;

/**
 * JSON Schema handed to Claude as a strict tool definition. Region and category
 * enums are injected from the catalog so the model physically cannot invent a
 * value the filter engine would then silently drop.
 */
export function buildEventFilterToolSchema() {
  return {
    type: 'object' as const,
    properties: {
      regions: {
        type: 'array',
        items: { type: 'string', enum: ALLOWED_REGIONS },
        description:
          'Broad world regions the user asked for. Empty array when they did not restrict by region. Do not infer a region when a country or city is already given.',
      },
      countries: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Full country names in English, e.g. "Germany", "United Kingdom", "United States". Expand abbreviations (UK, USA, UAE). Empty array if not mentioned.',
      },
      cities: {
        type: 'array',
        items: { type: 'string' },
        description:
          'City or venue names in English. Empty array if not mentioned. Do not guess a city from a country.',
      },
      categories: {
        type: 'array',
        items: { type: 'string', enum: ALLOWED_CATEGORIES },
        description:
          'Industry categories, chosen only from the enum. Empty array when the user does not name an industry, or explicitly asks for all categories.',
      },
      organizers: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Organiser or trade-body names when the user names one, e.g. "Messe Frankfurt". Empty array otherwise.',
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Free-text terms for anything not covered by the fields above, e.g. "robotics", "hydrogen". Each term is required to appear in the event, so keep the list short. Empty array otherwise.',
      },
      dateFrom: {
        type: ['string', 'null'],
        description:
          'Inclusive start of the requested window as YYYY-MM-DD, resolved against today. Null when the user did not constrain timing.',
      },
      dateTo: {
        type: ['string', 'null'],
        description: 'Inclusive end of the requested window as YYYY-MM-DD. Null when open-ended.',
      },
      favouritesOnly: {
        type: 'boolean',
        description:
          'True only when the user explicitly restricts to their liked, saved, favourite or targeted events.',
      },
      explanation: {
        type: 'string',
        description:
          'One short sentence, addressed to the user, describing how you read their request.',
      },
      suggestedFollowUps: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to three short follow-up questions the user might ask next.',
      },
    },
    required: [
      'regions',
      'countries',
      'cities',
      'categories',
      'organizers',
      'keywords',
      'dateFrom',
      'dateTo',
      'favouritesOnly',
      'explanation',
      'suggestedFollowUps',
    ],
    additionalProperties: false,
  };
}

import { z } from 'zod';
import { findShowsCategories, findShowsRegions } from '@/lib/find-shows/catalog';
import type { FindShowEvent } from '@/types/find-shows';

/**
 * The natural-language question typed into the Companies search box.
 */
export const askQuerySchema = z.object({
  q: z.string().trim().min(2).max(300),
});

export type AskQueryInput = z.infer<typeof askQuerySchema>;

/**
 * Filters Claude extracts from an event-flavoured question. Every field is
 * optional — "list all shows in London" only fills `city`, while "packaging
 * expos in Germany next March" fills `country`, `category` and `monthFrom`.
 *
 * Claude never returns events, only these filters; the matching itself runs
 * locally against `findShowEvents` so a result can never be hallucinated.
 */
export const eventFiltersSchema = z.object({
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  region: z.enum(findShowsRegions as unknown as [string, ...string[]]).nullable().optional(),
  category: z
    .enum(findShowsCategories as unknown as [string, ...string[]])
    .nullable()
    .optional(),
  keyword: z.string().nullable().optional(),
  monthFrom: z.number().int().min(1).max(12).nullable().optional(),
  monthTo: z.number().int().min(1).max(12).nullable().optional(),
  year: z.number().int().min(2020).max(2100).nullable().optional(),
  limit: z.number().int().min(1).max(50).nullable().optional(),
  offset: z.number().int().min(0).nullable().optional(),
});

export type EventFilters = z.infer<typeof eventFiltersSchema>;

/**
 * Body for the non-LLM paging route. The client replays the filters Claude
 * already extracted, so Prev/Next never costs another model call.
 */
export const eventSearchSchema = z.object({
  filters: eventFiltersSchema,
  page: z.number().int().min(1).default(1),
});

export type EventSearchInput = z.infer<typeof eventSearchSchema>;

export const companyQuerySchema = z.object({
  name: z.string().nullable().optional(),
});

/** A trimmed-down event shaped for the results panel. */
export type EventResult = Pick<
  FindShowEvent,
  | 'slug'
  | 'name'
  | 'city'
  | 'country'
  | 'venue'
  | 'organizer'
  | 'displayDate'
  | 'startDate'
  | 'website'
  | 'primaryCategory'
> & {
  /** Flattened from `seedAsset.logoUrl` so the panel needs no nested access. */
  logoUrl: string | null;
};

export type AskResult =
  | {
      intent: 'events';
      answer: string;
      filters: EventFilters;
      events: EventResult[];
      totalMatched: number;
    }
  | {
      intent: 'companies';
      /** Cleaned company name to hand back to the existing prefix search. */
      name: string;
    };

/**
 * JSON Schema mirrors of the Zod shapes above, handed to Claude as tool
 * definitions. `additionalProperties: false` + `required` are mandatory for
 * `strict: true`, which guarantees `tool_use.input` validates exactly.
 */
export const filterEventsToolSchema = {
  type: 'object' as const,
  properties: {
    city: {
      type: ['string', 'null'],
      description: 'City name in English, e.g. "London", "Munich". Null if not mentioned.',
    },
    country: {
      type: ['string', 'null'],
      description:
        'Full country name in English, e.g. "United Kingdom", "Germany", "United States". Expand abbreviations: UK -> United Kingdom, USA/US -> United States, UAE -> United Arab Emirates. Null if not mentioned.',
    },
    region: {
      type: ['string', 'null'],
      enum: [...findShowsRegions, null],
      description: 'Broad region, only when no country or city is given. Null otherwise.',
    },
    category: {
      type: ['string', 'null'],
      enum: [...findShowsCategories, null],
      description:
        'Industry category, chosen from the enum. Null if the question does not name an industry.',
    },
    keyword: {
      type: ['string', 'null'],
      description:
        'A free-text term to match against the show name when the question mentions something not covered by category, e.g. "robotics". Null otherwise.',
    },
    monthFrom: {
      type: ['integer', 'null'],
      description: 'Start month 1-12 when the question restricts timing. Null otherwise.',
    },
    monthTo: {
      type: ['integer', 'null'],
      description:
        'End month 1-12 for a range such as "autumn" (9-11) or "Q1" (1-3). Equal to monthFrom for a single month. Null otherwise.',
    },
    year: {
      type: ['integer', 'null'],
      description: 'Four-digit year when explicitly mentioned or clearly implied. Null otherwise.',
    },
    limit: {
      type: ['integer', 'null'],
      description: 'How many results the user asked for, e.g. "top 5". Null for no explicit limit.',
    },
  },
  required: [
    'city',
    'country',
    'region',
    'category',
    'keyword',
    'monthFrom',
    'monthTo',
    'year',
    'limit',
  ],
  additionalProperties: false,
};

export const searchCompaniesToolSchema = {
  type: 'object' as const,
  properties: {
    name: {
      type: ['string', 'null'],
      description:
        'The company name or name fragment the user is searching for, stripped of filler words. Null if no name is identifiable.',
    },
  },
  required: ['name'],
  additionalProperties: false,
};

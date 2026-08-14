// Type-only import: erased at compile time, so a missing package cannot break
// the webpack build. The runtime import below is deliberately opaque to
// webpack — see the same note in services/event-query.service.ts.
import type AnthropicSdk from '@anthropic-ai/sdk';
import { InternalServerError } from '@/lib/http/errors';
import {
  ALLOWED_CATEGORIES,
  ALLOWED_REGIONS,
  buildEventFilterToolSchema,
  eventQueryResponseSchema,
  type EventAnswerRequest,
  type EventQueryRequest,
} from '@/models/ai-event-query';
import { emptyEventFilters, type EventFilters, type EventQueryResponse } from '@/types/events';

const MODEL = 'claude-opus-5';

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Loads the SDK at request time. The specifier is held in a variable and marked
 * webpackIgnore so bundlers leave it alone.
 */
async function loadClient(): Promise<AnthropicSdk> {
  const specifier = '@anthropic-ai/sdk';
  try {
    const mod = await import(/* webpackIgnore: true */ specifier);
    const Ctor = (mod.default ?? mod) as new () => AnthropicSdk;
    return new Ctor();
  } catch {
    throw new InternalServerError(
      'The Claude SDK is not installed. Run `npm install @anthropic-ai/sdk`.'
    );
  }
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'which', 'where',
  'when', 'show', 'shows', 'event', 'events', 'find', 'list', 'give', 'about',
  'are', 'any', 'all', 'happening', 'next', 'near', 'trade', 'fair', 'fairs',
  'expo', 'expos', 'exhibition', 'exhibitions', 'conference', 'conferences',
]);

/**
 * Last resort when the assistant is unavailable or keeps returning an
 * unusable shape: pull the few most meaningful words out of the raw prompt and
 * run them as an ordinary keyword search. Terms are AND-ed by the filter
 * engine, so this stays deliberately short.
 */
export function keywordFallback(prompt: string): EventQueryResponse {
  const keywords = prompt
    .toLowerCase()
    .split(/[^a-z0-9&-]+/i)
    .filter((token) => token.length > 3 && !STOPWORDS.has(token))
    .slice(0, 3);

  return {
    filters: { ...emptyEventFilters(), keywords },
    explanation: keywords.length
      ? `Searched for ${keywords.map((word) => `"${word}"`).join(', ')}.`
      : 'Showing all events — nothing specific to filter on.',
    suggestedFollowUps: [],
  };
}

function buildSystemPrompt(currentFilters: EventQueryRequest['currentFilters']): string {
  const today = new Date().toISOString().slice(0, 10);

  const lines = [
    'You turn a natural-language question about trade shows into structured filters for a CRM event catalog.',
    '',
    'Call the extract_event_filters tool exactly once. Return filters only — never name a specific event, venue or date of your own.',
    '',
    `Today is ${today}. Resolve relative timing against it and emit concrete YYYY-MM-DD bounds: "next quarter" and "Q1 2026" become explicit ranges, "next March" is March of the coming year, "this autumn" is 01 September to 30 November.`,
    '',
    `Allowed regions: ${ALLOWED_REGIONS.join(', ')}.`,
    `Allowed categories: ${ALLOWED_CATEGORIES.join(', ')}.`,
    'Use only those exact values. If the user names an industry with no matching category, put the term in keywords instead.',
    '',
    'Leave a list empty when the question does not constrain it. A question that says "all categories", "any industry" or similar is asking NOT to filter by industry — return an empty categories list rather than every value.',
    'Do not guess a country from an ambiguous city, and do not set a region when a country or city is already given.',
  ];

  if (currentFilters) {
    lines.push(
      '',
      'The user already has these filters applied:',
      JSON.stringify(currentFilters),
      'Treat the question as a refinement of that state when it reads like one ("and in Germany too", "narrow to next month"), and as a fresh search when it does not. Always return the complete filter set you want applied, not a diff.'
    );
  }

  return lines.join('\n');
}

type Tool = AnthropicSdk.Tool;

/**
 * Asks Claude for filters, validates them, and retries once with the validation
 * error fed back before giving up. The caller falls back to a keyword search.
 */
export async function extractEventFilters(
  request: EventQueryRequest
): Promise<EventQueryResponse> {
  const client = await loadClient();

  const tools: Tool[] = [
    {
      name: 'extract_event_filters',
      description:
        'Extract trade-show catalog filters from a natural-language question about events.',
      input_schema: buildEventFilterToolSchema() as Tool['input_schema'],
      strict: true,
    } as Tool,
  ];

  const messages: AnthropicSdk.MessageParam[] = [{ role: 'user', content: request.prompt }];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      // Extraction, not deep reasoning — low effort keeps this fast enough to
      // sit behind a search box. Thinking is left at its default (adaptive):
      // disabling it on this model risks tool calls arriving as plain text.
      output_config: { effort: 'low' },
      system: buildSystemPrompt(request.currentFilters),
      tools,
      tool_choice: { type: 'tool', name: 'extract_event_filters', disable_parallel_tool_use: true },
      messages,
    });

    const toolUse = response.content.find(
      (block): block is AnthropicSdk.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUse) {
      const input = toolUse.input as Record<string, unknown>;
      const parsed = eventQueryResponseSchema.safeParse({
        filters: {
          regions: input.regions,
          countries: input.countries,
          cities: input.cities,
          categories: input.categories,
          organizers: input.organizers,
          keywords: input.keywords,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          favouritesOnly: input.favouritesOnly,
        },
        explanation: input.explanation,
        suggestedFollowUps: input.suggestedFollowUps ?? [],
      });

      if (parsed.success) {
        return normalizeResponse(parsed.data);
      }

      if (attempt === 2) break;

      // Feed the validation failure back verbatim so the retry has something
      // concrete to correct rather than guessing what went wrong.
      messages.push(
        { role: 'assistant', content: response.content },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              is_error: true,
              content: `Those filters failed validation: ${parsed.error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join('; ')}. Call the tool again with a corrected set.`,
            },
          ],
        }
      );
      continue;
    }

    if (attempt === 2) break;
    messages.push({
      role: 'assistant',
      content: response.content.length ? response.content : 'I could not extract filters.',
    });
    messages.push({ role: 'user', content: 'Call the extract_event_filters tool.' });
  }

  throw new InternalServerError('The assistant did not return usable filters.');
}

/** Guards against a valid-but-nonsensical range and trims stray whitespace. */
function normalizeResponse(response: EventQueryResponse): EventQueryResponse {
  const filters: EventFilters = { ...response.filters };

  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    [filters.dateFrom, filters.dateTo] = [filters.dateTo, filters.dateFrom];
  }

  return { ...response, filters };
}

/**
 * Second, much smaller call: answer the user's question from the rows that were
 * actually matched. The row list is the entire evidence base — the prompt says
 * so explicitly, and no catalog data is loaded server-side here.
 */
export async function answerFromRows(request: EventAnswerRequest): Promise<string> {
  if (request.rows.length === 0) {
    return 'No events matched those filters. Try removing a filter — the date range or the country is usually the tightest one.';
  }

  const client = await loadClient();

  const table = request.rows
    .map(
      (row, index) =>
        `${index + 1}. ${row.name} — ${row.organizer || 'organizer unknown'} — ${row.city}, ${row.country} — ${row.dates} — ${row.category}`
    )
    .join('\n');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    output_config: { effort: 'low' },
    system: [
      'You answer a question about trade shows using ONLY the numbered rows supplied by the user message.',
      'Never mention an event, city, date or organiser that is not in those rows, and never estimate beyond them.',
      `The rows are the first ${request.rows.length} of ${request.totalMatched} matches — when the question asks for a count, quote ${request.totalMatched} as the total and make clear the listed rows are a sample if it matters.`,
      'The catalog has no attendance or exhibitor-count data, so if the question turns on "biggest" or "most popular", say that plainly instead of guessing.',
      'Answer in one to three sentences of plain prose. No preamble, no bullet lists, no markdown headings.',
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: `Question: ${request.question}\n\nMatching events:\n${table}`,
      },
    ],
  });

  const text = response.content
    .filter((block): block is AnthropicSdk.TextBlock => block.type === 'text')
    .map((block) => block.text.trim())
    .join(' ')
    .trim();

  if (!text) throw new InternalServerError('The assistant did not return an answer.');
  return text;
}

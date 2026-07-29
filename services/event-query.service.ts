// Type-only import: erased at compile time, so a missing package cannot break
// the webpack build. The runtime import below is deliberately opaque to
// webpack — a bare `import Anthropic from '@anthropic-ai/sdk'` here would fail
// module resolution for the WHOLE dev compilation, taking every unrelated
// route (including /api/auth/sign-in) down with it.
import type AnthropicSdk from '@anthropic-ai/sdk';
import { describeResults, filterEvents } from '@/lib/find-shows/filter-events';
import { InternalServerError } from '@/lib/http/errors';
import {
  companyQuerySchema,
  eventFiltersSchema,
  filterEventsToolSchema,
  searchCompaniesToolSchema,
  type AskResult,
} from '@/models/event-query';

const MODEL = 'claude-opus-4-8';

/**
 * The assistant only ever classifies and extracts — it is explicitly told not
 * to name events, because the event list is produced locally from the catalog.
 */
function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);

  return [
    'You classify a single search query typed into a B2B CRM and extract structured filters from it.',
    '',
    'Call exactly one tool:',
    '- filter_events — the query is about trade shows, exhibitions, expos, fairs, conferences or events ("shows in London", "packaging expos in Germany", "what events are happening in Q1").',
    '- search_companies — the query is about a company, or is a bare company name ("Infosys", "logistics firms in Pune").',
    '',
    `Today is ${today}. Resolve relative timing against it: "next March" is March of the coming year, "this autumn" is months 9 to 11, "Q1" is months 1 to 3.`,
    'Set a field to null whenever the query does not constrain it. Do not guess a country from a city unless you are confident (London -> United Kingdom is fine; Springfield is not).',
    'A query that says "all categories", "any category", "under all the category" or similar is explicitly asking NOT to filter by industry — set category to null. Never pick an enum value to represent "all".',
    'Never invent or name specific events — you only produce filters.',
  ].join('\n');
}

type Tool = AnthropicSdk.Tool;

const tools: Tool[] = [
  {
    name: 'filter_events',
    description:
      'Extract trade-show filters from a query about events, shows, expos, fairs, exhibitions or conferences.',
    input_schema: filterEventsToolSchema as Tool['input_schema'],
  },
  {
    name: 'search_companies',
    description: 'Extract a company name from a query that is about companies rather than events.',
    input_schema: searchCompaniesToolSchema as Tool['input_schema'],
  },
];

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Loads the SDK at request time. The specifier is held in a variable and
 * marked webpackIgnore so bundlers leave it alone — see the import comment.
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

export async function askAboutCompaniesOrEvents(query: string): Promise<AskResult> {
  const client = await loadClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    // Extraction, not reasoning — omitting `thinking` keeps this fast enough
    // to sit behind a search box.
    output_config: { effort: 'low' },
    system: buildSystemPrompt(),
    tools,
    // Force a choice so there is no free-text intent string to parse, and cap
    // it at one tool per response.
    tool_choice: { type: 'any', disable_parallel_tool_use: true },
    messages: [{ role: 'user', content: query }],
  });

  const toolUse = response.content.find(
    (block): block is AnthropicSdk.ToolUseBlock => block.type === 'tool_use'
  );

  if (!toolUse) {
    throw new InternalServerError('The assistant did not return a usable answer.');
  }

  if (toolUse.name === 'search_companies') {
    const parsed = companyQuerySchema.safeParse(toolUse.input);
    return {
      intent: 'companies',
      name: parsed.success && parsed.data.name ? parsed.data.name : query,
    };
  }

  const parsed = eventFiltersSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new InternalServerError('The assistant returned filters in an unexpected shape.');
  }

  const { events, totalMatched } = filterEvents(parsed.data);

  return {
    intent: 'events',
    answer: describeResults(parsed.data, totalMatched, events.length),
    filters: parsed.data,
    events,
    totalMatched,
  };
}

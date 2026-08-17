// Type-only import: erased at compile time, so a missing package cannot break
// the webpack build. The runtime import below is deliberately opaque to
// webpack — a bare `import Anthropic from '@anthropic-ai/sdk'` here would fail
// module resolution for the WHOLE dev compilation, taking every unrelated
// route down with it. Same pattern as services/event-query.service.ts.
import type AnthropicSdk from '@anthropic-ai/sdk';
import { adapterFor } from './registry';
import { ENTITY_SIGNALS } from './signals';
import { ASSISTANT_ENTITIES, type AssistantEntity } from './types';

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 512;
/** Classification sits in front of everything; a hung call would freeze the panel. */
const TIMEOUT_MS = 4000;

export type ModelClassification = {
  entity: AssistantEntity;
  filters: Record<string, unknown>;
};

/** Returns null when the model could not be consulted or produced no tool call. */
export type ModelClassifier = (message: string) => Promise<ModelClassification | null>;

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const TOOL_NAMES: Record<AssistantEntity, string> = {
  events: 'route_to_events',
  companies: 'route_to_companies',
  people: 'route_to_people',
};

const ENTITY_BY_TOOL: Record<string, AssistantEntity> = {
  route_to_events: 'events',
  route_to_companies: 'companies',
  route_to_people: 'people',
};

/**
 * The signal words come from signals.ts — the same list the deterministic
 * classifier scores against — so the prompt and the fallback can never drift.
 */
export function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);

  const signalLines = ASSISTANT_ENTITIES.map((entity) => {
    const words = ENTITY_SIGNALS[entity].map((s) => s.word).join(', ');
    return `- ${entity}: ${words}`;
  });

  return [
    'You route a single question typed into a B2B CRM assistant to exactly one dataset, and extract structured filters from it.',
    '',
    'Call exactly one tool:',
    '- route_to_events — trade shows, expos, conferences, summits, exhibitors, venues, dates.',
    '- route_to_companies — accounts, firmographics, headcount, industry, domains.',
    '- route_to_people — contacts, job titles, seniority, departments, emails.',
    '',
    'Typical signal words:',
    ...signalLines,
    '',
    'The DELIVERABLE noun decides the dataset, not the qualifier.',
    '"Companies exhibiting at SaaStr" is companies. "Events where NovaAI is exhibiting" is events. "CMOs at companies attending Web Summit" is people.',
    '',
    `Today is ${today}. Resolve relative timing against it: "next March" is March of the coming year, "Q1" is months 1 to 3.`,
    'Set a field to null whenever the question does not constrain it. Do not guess a country from a city unless you are confident (London -> United Kingdom is fine; Springfield is not).',
    'Never invent or name specific records — you only produce filters. The results are produced locally.',
  ].join('\n');
}

function buildTools(): AnthropicSdk.Tool[] {
  return ASSISTANT_ENTITIES.map((entity) => ({
    name: TOOL_NAMES[entity],
    description: `Route to the ${entity} dataset and extract its filters.`,
    input_schema: adapterFor(entity).filterSchema as AnthropicSdk.Tool['input_schema'],
  }));
}

export function createModelClassifier(): ModelClassifier {
  return async function classifyWithModel(message) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      const response = await client.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: buildSystemPrompt(),
          tools: buildTools(),
          tool_choice: { type: 'any', disable_parallel_tool_use: true },
          messages: [{ role: 'user', content: message }],
        },
        { signal: controller.signal }
      );

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const entity = ENTITY_BY_TOOL[block.name];
        if (!entity) continue;
        return { entity, filters: (block.input ?? {}) as Record<string, unknown> };
      }

      // Model answered without calling a tool — treat as unclassified.
      return null;
    } catch {
      // Any failure (network, abort, rate limit, malformed response) degrades
      // to the deterministic classifier rather than surfacing an error.
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
}

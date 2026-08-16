import {
  emptyPeopleFilters,
  type PeopleFilters,
  type Person,
} from '@/types/people';
import { loadPeople } from '@/lib/people/data';
import { applyPeopleFilters } from '@/lib/people/filters';
import { parsePeopleQuery } from '@/lib/people/parse-query';
import { buildPeopleFilterChips, type PeopleFilterChip } from '@/lib/people/chips';
import { buildPeopleAnswer } from '@/lib/people/answer';

/**
 * The chat wire format.
 *
 * `filters` and `results` are emitted BEFORE any prose so the inline table
 * fills while the answer is still being written. Every client depends on that
 * ordering.
 *
 * The format is identical whether the prose came from a template or from
 * Claude, which is what lets the panel work with no API key and lets the client
 * avoid branching entirely.
 */
export type PeopleChatEvent =
  | { type: 'filters'; filters: PeopleFilters; chips: PeopleFilterChip[] }
  | { type: 'results'; results: Person[]; total: number }
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; code: string; message: string };

export type AnswerGenerator = (input: {
  question: string;
  filters: PeopleFilters;
  matches: readonly Person[];
  total: number;
}) => AsyncIterable<string>;

/** Inline replies are capped; "View all N results" opens the full table. */
const INLINE_RESULT_LIMIT = 10;
/** How much of the answer the model is allowed to see. Nothing else is sent. */
const MODEL_SAMPLE_LIMIT = 10;

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const BUCKET_CAPACITY = 20;
const REFILL_PER_SECOND = 0.5;

type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();

/** In-memory per-IP token bucket. Process-local by design — no dependency. */
export function consumeRateLimit(
  key: string,
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  const bucket = buckets.get(key) ?? { tokens: BUCKET_CAPACITY, updatedAt: now };
  const elapsedSeconds = Math.max(0, (now - bucket.updatedAt) / 1000);
  const tokens = Math.min(BUCKET_CAPACITY, bucket.tokens + elapsedSeconds * REFILL_PER_SECOND);

  if (tokens < 1) {
    buckets.set(key, { tokens, updatedAt: now });
    return { allowed: false, retryAfterSeconds: Math.ceil((1 - tokens) / REFILL_PER_SECOND) };
  }

  buckets.set(key, { tokens: tokens - 1, updatedAt: now });
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetPeopleRateLimiter(): void {
  buckets.clear();
}

// ---------------------------------------------------------------------------
// Prose generation
// ---------------------------------------------------------------------------

/** Chunked templated prose — the always-available baseline. */
async function* templatedAnswer(input: {
  question: string;
  filters: PeopleFilters;
  matches: readonly Person[];
  total: number;
}): AsyncIterable<string> {
  const answer = buildPeopleAnswer(input);
  // Word-at-a-time so the client's typing animation looks the same as the
  // model path.
  for (const chunk of answer.match(/\S+\s*/g) ?? [answer]) {
    yield chunk;
  }
}

/**
 * Streams from Claude when a key is configured, otherwise from the template.
 * Only a trimmed sample of rows is sent — never the whole dataset.
 */
function defaultAnswerGenerator(): AnswerGenerator {
  return async function* generate(input) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      yield* templatedAnswer(input);
      return;
    }

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });

    const sample = input.matches.slice(0, MODEL_SAMPLE_LIMIT).map((person) => ({
      name: `${person.firstName} ${person.lastName}`,
      title: person.title,
      company: person.company,
      country: person.country,
      verification: person.verification,
      confidence: person.confidence,
    }));

    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      system:
        'You answer questions about a B2B contact dataset. Be concise — two or three sentences. ' +
        'Use only the counts and rows provided; never invent contacts. Never output snake_case.',
      messages: [
        {
          role: 'user',
          content:
            `Question: ${input.question}\n` +
            `Total matches: ${input.total}\n` +
            `Sample rows: ${JSON.stringify(sample)}`,
        },
      ],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Stream assembly
// ---------------------------------------------------------------------------

function line(event: PeopleChatEvent): string {
  return `${JSON.stringify(event)}\n`;
}

export function createPeopleChatStream(input: {
  message: string;
  activeFilters?: Partial<PeopleFilters>;
  page?: number;
  generateAnswer?: AnswerGenerator;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const generate = input.generateAnswer ?? defaultAnswerGenerator();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: PeopleChatEvent) => controller.enqueue(encoder.encode(line(event)));

      try {
        // 1. Parse — instant, local, always succeeds.
        const base: PeopleFilters = { ...emptyPeopleFilters(), ...(input.activeFilters ?? {}) };
        const filters = parsePeopleQuery(input.message, { base });
        send({ type: 'filters', filters, chips: buildPeopleFilterChips(filters) });

        // 2. Results — the table fills before any prose is written.
        const matches = applyPeopleFilters(loadPeople(), filters);
        const results = matches.slice(0, INLINE_RESULT_LIMIT);
        send({ type: 'results', results, total: matches.length });

        // 3. Prose. A failed model call falls back mid-flight rather than
        //    erroring: the user must see an answer, not a stack trace.
        const answerInput = {
          question: input.message,
          filters,
          matches: results,
          total: matches.length,
        };

        let emittedAnything = false;
        let recovered = false;
        try {
          for await (const chunk of generate(answerInput)) {
            if (!chunk) continue;
            emittedAnything = true;
            send({ type: 'token', text: chunk });
          }
        } catch {
          // Complete the partial answer from the template. If the model died
          // before saying anything, the whole answer comes from the template.
          if (emittedAnything) send({ type: 'token', text: ' ' });
          for await (const chunk of templatedAnswer(answerInput)) {
            send({ type: 'token', text: chunk });
          }
          recovered = true;
        }

        // A generator that completed without yielding still owes an answer.
        if (!emittedAnything && !recovered) {
          for await (const chunk of templatedAnswer(answerInput)) {
            send({ type: 'token', text: chunk });
          }
        }

        send({ type: 'done' });
      } catch (error) {
        send({
          type: 'error',
          code: 'stream_failed',
          message: error instanceof Error ? error.message : 'Something went wrong.',
        });
      } finally {
        controller.close();
      }
    },
  });
}

/** A single-event stream, for refusals that still need the NDJSON shape. */
export function createPeopleChatErrorStream(
  code: string,
  message: string
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(line({ type: 'error', code, message })));
      controller.close();
    },
  });
}

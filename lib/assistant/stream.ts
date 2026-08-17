import { translateFilters } from './carry-over';
import { classify } from './classify';
import { resolveRoute } from './confidence';
import { adapterFor } from './registry';
import { createModelClassifier, isConfigured, type ModelClassifier } from './route';
import type { AssistantEntity, AssistantEvent, DegradedReason, RouteAction } from './types';

export type AnswerGenerator = (input: {
  question: string;
  entity: AssistantEntity;
  /** The adapter's templated prose — the model's factual floor. */
  prose: string;
  rows: readonly unknown[];
  total: number | null;
}) => AsyncIterable<string>;

export type AssistantStreamInput = {
  message: string;
  currentPage: AssistantEntity;
  activeFilters?: Record<string, unknown>;
  previousEntity?: AssistantEntity | null;
  page?: number;
  classifyWithModel?: ModelClassifier;
  generateAnswer?: AnswerGenerator;
};

const ENTITY_LABEL: Record<AssistantEntity, string> = {
  companies: 'Companies',
  events: 'Events',
  people: 'People',
};

function line(event: AssistantEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/** Word-at-a-time so the client's typing animation matches the model path. */
async function* chunked(text: string): AsyncIterable<string> {
  for (const chunk of text.match(/\S+\s*/g) ?? [text]) yield chunk;
}

function handoffLine(target: AssistantEntity, action: RouteAction): string {
  if (action === 'navigate') {
    return `That's a question about ${target} — opening ${ENTITY_LABEL[target]} with your search applied.`;
  }
  if (action === 'confirm') {
    return `I'm not sure whether you mean ${ENTITY_LABEL[
      target
    ].toLowerCase()} or something on another page. Which did you want?`;
  }
  return '';
}

export function createAssistantStream(input: AssistantStreamInput): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const page = input.page && input.page > 0 ? input.page : 1;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AssistantEvent) => controller.enqueue(encoder.encode(line(event)));

      try {
        // 1. Classify. The deterministic pass always runs; the model pass may
        //    fail, and its failure is information rather than an error.
        const deterministic = classify(input.message);
        // The default classifier is resolved HERE, not by the caller. A route
        // that always passes one would make `canUseModel` true even with no
        // API key, so the missing_api_key branch could never be reached.
        const injected = Boolean(input.classifyWithModel);
        const canUseModel = isConfigured() || injected;
        const classifyWithModel = input.classifyWithModel ?? createModelClassifier();

        let modelEntity: AssistantEntity | null = null;
        let modelFilters: Record<string, unknown> = {};
        let degraded: DegradedReason | undefined;

        if (!canUseModel) {
          degraded = 'missing_api_key';
        } else {
          try {
            const result = await classifyWithModel(input.message);
            if (result) {
              modelEntity = result.entity;
              modelFilters = result.filters;
            } else {
              degraded = 'no_tool_call';
            }
          } catch {
            degraded = 'model_error';
          }
        }

        const decision = resolveRoute({
          modelEntity,
          deterministic,
          currentPage: input.currentPage,
          previousEntity: input.previousEntity ?? null,
          hasApiKey: canUseModel,
        });

        const target = decision.targetEntity;
        const adapter = adapterFor(target);

        // 2. Build filters: carried-over context, then the model's extraction,
        //    then the local parse as the floor.
        const carried = translateFilters({
          from: input.currentPage,
          to: target,
          filters: input.activeFilters ?? {},
        });

        const base = {
          ...(adapter.emptyFilters() as Record<string, unknown>),
          ...carried.filters,
        };

        const modelGaveFilters =
          modelEntity === target &&
          Object.values(modelFilters).some((value) => value !== null && value !== undefined);

        const filters = modelGaveFilters
          ? {
              ...base,
              ...Object.fromEntries(
                Object.entries(modelFilters).filter(([, v]) => v !== null && v !== undefined)
              ),
            }
          : (adapter.parseLocally(input.message, base as never) as Record<string, unknown>);

        // 3. The route verdict — ALWAYS the first event, always before any
        //    search runs, because the client must know whether to stay here.
        send({
          type: 'route',
          targetEntity: target,
          action: decision.action,
          confidence: decision.confidence,
          handoffMessage: handoffLine(target, decision.action),
          interpretedFilters: filters,
          droppedFilters: carried.dropped,
          crossReference: null,
          ...(degraded ? { degraded } : {}),
        });

        // 4a. Ambiguous — ask, and do not spend a query on a guess.
        if (decision.action === 'confirm') {
          for await (const chunk of chunked(handoffLine(target, 'confirm'))) {
            send({ type: 'token', text: chunk });
          }
          send({
            type: 'suggestions',
            items: [
              `Search ${ENTITY_LABEL[target]}`,
              `Search ${ENTITY_LABEL[input.currentPage]}`,
            ],
          });
          send({ type: 'done' });
          return;
        }

        // 4b. Wrong page — hand off. No results event, ever: returning rows
        //     here is exactly the wrong-entity answer this system prevents.
        if (decision.action === 'navigate') {
          for await (const chunk of chunked(handoffLine(target, 'navigate'))) {
            send({ type: 'token', text: chunk });
          }
          send({ type: 'done' });
          return;
        }

        // 4c. Right page — answer inline.
        send({ type: 'filters', chips: adapter.chips(filters as never) });

        let rows: readonly unknown[];
        let total: number | null;
        try {
          const result = await adapter.search(filters as never, page);
          rows = result.rows;
          total = result.total;
        } catch (error) {
          send({
            type: 'error',
            code: 'search_failed',
            message: `Could not search ${target}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          });
          send({ type: 'done' });
          return;
        }

        send({ type: 'results', rows: [...rows], total });

        const prose = adapter.describe(filters as never, total);
        const answerInput = { question: input.message, entity: target, prose, rows, total };

        let emittedAnything = false;
        let recovered = false;
        try {
          const generate =
            input.generateAnswer ??
            (async function* () {
              yield* chunked(prose);
            });
          for await (const chunk of generate(answerInput)) {
            if (!chunk) continue;
            emittedAnything = true;
            send({ type: 'token', text: chunk });
          }
        } catch {
          // Complete the partial answer from the template. The user must see an
          // answer, not a stack trace.
          if (emittedAnything) send({ type: 'token', text: ' ' });
          for await (const chunk of chunked(prose)) send({ type: 'token', text: chunk });
          recovered = true;
        }

        // A generator that completed without yielding still owes an answer.
        if (!emittedAnything && !recovered) {
          for await (const chunk of chunked(prose)) send({ type: 'token', text: chunk });
        }

        send({ type: 'suggestions', items: adapter.suggest(filters as never, total) });
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
export function createAssistantErrorStream(
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

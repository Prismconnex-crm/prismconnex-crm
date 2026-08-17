import { BadRequestError } from '@/lib/http/errors';
import { jsonError } from '@/lib/http/response';
import { consumeRateLimit } from '@/lib/assistant/rate-limit';
import { createAssistantErrorStream, createAssistantStream } from '@/lib/assistant/stream';
import { ASSISTANT_ENTITIES, type AssistantEntity } from '@/lib/assistant/types';

/**
 * The single assistant endpoint. Classifies the question into an entity before
 * answering, so a question typed on the wrong page hands off rather than being
 * answered from the wrong dataset.
 *
 * Not tenant-scoped, matching /api/companies — these are shared discovery
 * datasets, not workspace data.
 *
 * An assistant problem is never an HTTP error: a rate-limit refusal is still
 * delivered AS A STREAM EVENT so the client has exactly one code path.
 */

const NDJSON_HEADERS = {
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-store, no-transform',
};

type ChatBody = {
  message?: unknown;
  currentPage?: unknown;
  activeFilters?: unknown;
  previousEntity?: unknown;
  page?: unknown;
  forceEntity?: unknown;
  presetFilters?: unknown;
};

function isEntity(value: unknown): value is AssistantEntity {
  return typeof value === 'string' && ASSISTANT_ENTITIES.includes(value as AssistantEntity);
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ChatBody;

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) throw new BadRequestError('message is required');

    if (body.currentPage !== undefined && !isEntity(body.currentPage)) {
      throw new BadRequestError('currentPage must be one of companies, events, people');
    }
    const currentPage: AssistantEntity = isEntity(body.currentPage)
      ? body.currentPage
      : 'companies';

    const activeFilters =
      body.activeFilters && typeof body.activeFilters === 'object'
        ? (body.activeFilters as Record<string, unknown>)
        : undefined;

    const previousEntity = isEntity(body.previousEntity) ? body.previousEntity : null;
    const page = Number.isInteger(body.page) ? (body.page as number) : 1;

    if (body.forceEntity !== undefined && !isEntity(body.forceEntity)) {
      throw new BadRequestError('forceEntity must be one of companies, events, people');
    }
    const forceEntity = isEntity(body.forceEntity) ? body.forceEntity : undefined;

    const presetFilters =
      body.presetFilters && typeof body.presetFilters === 'object'
        ? (body.presetFilters as Record<string, unknown>)
        : undefined;

    const limit = consumeRateLimit(clientKey(request));
    if (!limit.allowed) {
      return new Response(
        createAssistantErrorStream(
          'rate_limited',
          `Too many questions at once. Try again in ${limit.retryAfterSeconds}s.`
        ),
        { status: 200, headers: NDJSON_HEADERS }
      );
    }

    return new Response(
      // No classifier passed: the stream resolves the real one itself, so a
      // missing API key is reported as missing_api_key rather than as a model
      // that answered without calling a tool.
      createAssistantStream({
        message,
        currentPage,
        activeFilters,
        previousEntity,
        page,
        forceEntity,
        presetFilters,
      }),
      { status: 200, headers: NDJSON_HEADERS }
    );
  } catch (error) {
    return jsonError(error);
  }
}

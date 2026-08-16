import { BadRequestError } from '@/lib/http/errors';
import { jsonError } from '@/lib/http/response';
import {
  consumeRateLimit,
  createPeopleChatErrorStream,
  createPeopleChatStream,
} from '@/lib/people/chat-stream';
import type { PeopleFilters } from '@/types/people';

/**
 * Streams an answer plus the filters and rows behind it as newline-delimited
 * JSON. Not tenant-scoped, matching GET /api/people.
 *
 * A rate-limit refusal is still delivered *as a stream event* rather than an
 * HTTP error, so the client has exactly one code path for reading replies.
 */

const NDJSON_HEADERS = {
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-store, no-transform',
};

type ChatBody = {
  message?: unknown;
  conversationId?: unknown;
  activeFilters?: unknown;
  page?: unknown;
};

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ChatBody;

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      throw new BadRequestError('message is required');
    }

    const page = Number.isInteger(body.page) ? (body.page as number) : 1;
    const activeFilters =
      body.activeFilters && typeof body.activeFilters === 'object'
        ? (body.activeFilters as Partial<PeopleFilters>)
        : undefined;

    const limit = consumeRateLimit(clientKey(request));
    if (!limit.allowed) {
      return new Response(
        createPeopleChatErrorStream(
          'rate_limited',
          `Too many questions at once. Try again in ${limit.retryAfterSeconds}s.`
        ),
        { status: 200, headers: NDJSON_HEADERS }
      );
    }

    return new Response(createPeopleChatStream({ message, activeFilters, page }), {
      status: 200,
      headers: NDJSON_HEADERS,
    });
  } catch (error) {
    return jsonError(error);
  }
}

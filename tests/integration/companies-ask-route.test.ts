import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const askAboutCompaniesOrEvents = vi.fn();
const isConfigured = vi.fn(() => true);

// Only the network boundary is faked. `describeAssistantFailure` stays real —
// classifying an upstream error is the behaviour under test.
vi.mock('@/services/event-query.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/event-query.service')>();
  return {
    ...actual,
    isConfigured: () => isConfigured(),
    askAboutCompaniesOrEvents: (query: string) => askAboutCompaniesOrEvents(query),
  };
});

// Safe as static imports: vitest hoists `vi.mock` above them.
import { POST } from '@/app/api/companies/ask/route';
import { InternalServerError } from '@/lib/http/errors';
import { describeAssistantFailure } from '@/services/event-query.service';

function post(body: unknown) {
  return new Request('http://localhost/api/companies/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

/** Shape the Anthropic SDK actually throws — see APIError.generate. */
function sdkError(status: number, type: string) {
  return Object.assign(new Error(`${status} ${type}`), {
    status,
    type,
    error: { type: 'error', error: { type, message: 'upstream said no' } },
  });
}

beforeEach(() => {
  isConfigured.mockReturnValue(true);
  askAboutCompaniesOrEvents.mockReset();
  // The route logs upstream failures on purpose; keep the run output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/companies/ask — assistant failures', () => {
  it('reports an invalid API key as unavailable, not a server error', async () => {
    askAboutCompaniesOrEvents.mockRejectedValue(sdkError(401, 'authentication_error'));

    const response = await POST(post({ q: 'shows in London' }));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json).toMatchObject({ intent: 'unavailable', reason: 'invalid_api_key' });
  });

  it('degrades a rate limit to a prefix search on the raw query', async () => {
    askAboutCompaniesOrEvents.mockRejectedValue(sdkError(429, 'rate_limit_error'));

    const response = await POST(post({ q: 'packaging expos in Germany' }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      intent: 'companies',
      name: 'packaging expos in Germany',
      degraded: true,
      reason: 'assistant_error',
    });
  });

  it('degrades an overloaded upstream rather than 500ing', async () => {
    askAboutCompaniesOrEvents.mockRejectedValue(sdkError(529, 'overloaded_error'));

    const response = await POST(post({ q: 'Infosys' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ intent: 'companies', degraded: true });
  });

  it('degrades a network failure rather than 500ing', async () => {
    askAboutCompaniesOrEvents.mockRejectedValue(new TypeError('fetch failed'));

    const response = await POST(post({ q: 'logistics firms in Pune' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ intent: 'companies', degraded: true });
  });

  it('degrades when the assistant returns an unusable answer', async () => {
    askAboutCompaniesOrEvents.mockRejectedValue(
      new InternalServerError('The assistant did not return a usable answer.')
    );

    const response = await POST(post({ q: 'shows in Milan' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ intent: 'companies', degraded: true });
  });
});

describe('POST /api/companies/ask — unchanged behaviour', () => {
  it('still reports a missing API key as unavailable', async () => {
    isConfigured.mockReturnValue(false);

    const response = await POST(post({ q: 'shows in London' }));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json).toMatchObject({ intent: 'unavailable', reason: 'missing_api_key' });
  });

  it('still rejects a malformed body with a 4xx', async () => {
    const response = await POST(post({ q: 'x' }));

    expect(response.status).toBe(400);
    expect(askAboutCompaniesOrEvents).not.toHaveBeenCalled();
  });

  it('passes a successful result straight through', async () => {
    askAboutCompaniesOrEvents.mockResolvedValue({ intent: 'companies', name: 'Infosys' });

    const response = await POST(post({ q: 'Infosys' }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ intent: 'companies', name: 'Infosys' });
    expect(json.degraded).toBeUndefined();
  });
});

describe('describeAssistantFailure', () => {
  it('treats a 401 as a configuration problem worth surfacing', () => {
    expect(describeAssistantFailure(sdkError(401, 'authentication_error'))).toEqual({
      kind: 'unavailable',
      reason: 'invalid_api_key',
    });
  });

  it('treats a 403 as a configuration problem worth surfacing', () => {
    expect(describeAssistantFailure(sdkError(403, 'permission_error'))).toEqual({
      kind: 'unavailable',
      reason: 'invalid_api_key',
    });
  });

  it('treats everything else as transient', () => {
    expect(describeAssistantFailure(sdkError(429, 'rate_limit_error'))).toEqual({
      kind: 'degraded',
      reason: 'assistant_error',
    });
    expect(describeAssistantFailure(new Error('boom'))).toEqual({
      kind: 'degraded',
      reason: 'assistant_error',
    });
    expect(describeAssistantFailure(null)).toEqual({
      kind: 'degraded',
      reason: 'assistant_error',
    });
  });
});

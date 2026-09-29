import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Only the session/tenant/billing boundaries are faked; the routes are real.
const mocks = vi.hoisted(() => ({
  getSessionPayload: vi.fn(),
  resolveTenant: vi.fn(),
  getRemainingCredits: vi.fn(),
  recordUsage: vi.fn(),
}));

vi.mock('@/lib/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session')>()),
  getSessionPayload: mocks.getSessionPayload,
}));

vi.mock('@/lib/auth/tenant', () => ({
  resolveTenant: mocks.resolveTenant,
}));

vi.mock('@/services/billing.service', () => ({
  BillingService: {
    getRemainingCredits: mocks.getRemainingCredits,
    recordUsage: mocks.recordUsage,
  },
}));

import { POST as chat } from '@/app/api/assistant/chat/route';
import { POST as companiesAsk } from '@/app/api/companies/ask/route';
import { POST as eventQuery } from '@/app/api/ai/event-query/route';
import { POST as eventAnswer } from '@/app/api/ai/event-answer/route';
import { GET as enrich } from '@/app/api/people/enrich/route';
import { resetAssistantRateLimiter } from '@/lib/assistant/rate-limit';

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as never;
}

const tenant = { userId: 'u1', email: 'a@b.com', workspaceId: 'ws1', role: 'SALES_REP' };
const fetchSpy = vi.fn();

beforeEach(() => {
  resetAssistantRateLimiter();
  mocks.getSessionPayload.mockResolvedValue(null);
  mocks.resolveTenant.mockResolvedValue(null);
  mocks.getRemainingCredits.mockResolvedValue(100);
  mocks.recordUsage.mockResolvedValue(null);
  fetchSpy.mockReset();
  vi.stubGlobal('fetch', fetchSpy);
  vi.stubEnv('CONTACTOUT_API_KEY', 'test-token');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('model-backed routes require a signed-in user', () => {
  const cases: Array<[string, () => Promise<Response>]> = [
    ['/api/assistant/chat', () => chat(post('/api/assistant/chat', { message: 'people in Germany' }))],
    ['/api/companies/ask', () => companiesAsk(post('/api/companies/ask', { query: 'fintech in Berlin' }))],
    ['/api/ai/event-query', () => eventQuery(post('/api/ai/event-query', { prompt: 'shows in Paris' }))],
    [
      '/api/ai/event-answer',
      () => eventAnswer(post('/api/ai/event-answer', { question: 'x', rows: [] })),
    ],
  ];

  for (const [path, call] of cases) {
    it(`${path} answers 401 without a session`, async () => {
      const response = await call();
      expect(response.status).toBe(401);
    });
  }

  it('rate-limits the assistant per user, not per spoofable forwarded IP', async () => {
    mocks.getSessionPayload.mockResolvedValue({ sub: 'user-a', email: 'a@b.com' });

    // Rotating X-Forwarded-For used to mint a fresh bucket on every request.
    let lastBody = '';
    for (let i = 0; i < 25; i++) {
      const response = await chat(
        post('/api/assistant/chat', { message: 'people in Germany' }, { 'x-forwarded-for': `10.0.0.${i}` })
      );
      lastBody = await response.text();
    }
    expect(lastBody).toContain('rate_limited');
  });
});

describe('GET /api/people/enrich', () => {
  const url = 'http://localhost/api/people/enrich?domain=acme.com';

  it('answers 401 and never calls ContactOut without a workspace', async () => {
    const response = await enrich(new Request(url));

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('answers 402 and never calls ContactOut when credits are exhausted', async () => {
    mocks.resolveTenant.mockResolvedValue(tenant);
    mocks.getRemainingCredits.mockResolvedValue(0);

    const response = await enrich(new Request(url));
    const json = await response.json();

    expect(response.status).toBe(402);
    expect(json.error).toMatch(/credit/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('meters the lookup against the workspace that made it', async () => {
    mocks.resolveTenant.mockResolvedValue(tenant);
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ profiles: [{ full_name: 'Ada Lovelace' }, { full_name: 'Alan Turing' }] }), {
        status: 200,
      })
    );

    const response = await enrich(new Request(url));

    expect(response.status).toBe(200);
    expect(mocks.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws1', userId: 'u1', kind: 'PEOPLE_LOOKUP', amount: 2 })
    );
  });
});

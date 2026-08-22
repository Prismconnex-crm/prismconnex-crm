import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetAdapters, setAdapterForTests } from '@/lib/assistant/registry';
import type { EntityAdapter } from '@/lib/assistant/types';

/**
 * conversationId is accepted and logged; it changes no behaviour. The point of
 * these tests is that a malformed one cannot break a question — the field is
 * client-supplied and the endpoint is not tenant-gated.
 */
vi.mock('@/lib/auth/tenant', () => ({ resolveTenant: vi.fn().mockResolvedValue(null) }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: async () => ({ content: [] }) };
  },
}));

const fakeEvents = {
  entity: 'events',
  signals: [{ word: 'shows' }],
  filterSchema: { type: 'object', properties: {} },
  emptyFilters: () => ({}),
  parseLocally: (_m: string, base: unknown) => base,
  carryOver: () => ({ filters: {}, dropped: [] }),
  search: async () => ({ rows: [{ id: 'e1' }], total: 1 }),
  chips: () => [],
  describe: () => 'One show matches.',
  suggest: () => [],
} as unknown as EntityAdapter<never>;

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  setAdapterForTests('events', fakeEvents);
});

afterEach(() => {
  resetAdapters();
});

async function post(body: unknown) {
  const { POST } = await import('@/app/api/assistant/chat/route');
  const response = await POST(
    new Request('http://localhost/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  return { status: response.status, text: await response.text() };
}

const ask = { message: 'shows in germany', currentPage: 'events' };

describe('conversationId', () => {
  it('answers normally when one is supplied', async () => {
    const { status, text } = await post({ ...ask, conversationId: 'conv-abc-123' });
    expect(status).toBe(200);
    expect(text).toContain('"type":"results"');
  });

  it('answers normally when it is absent', async () => {
    const { status, text } = await post(ask);
    expect(status).toBe(200);
    expect(text).toContain('"type":"results"');
  });

  it('rejects one longer than 64 characters', async () => {
    const { status } = await post({ ...ask, conversationId: 'x'.repeat(65) });
    expect(status).toBe(400);
  });

  it('rejects a non-string', async () => {
    const { status } = await post({ ...ask, conversationId: 42 });
    expect(status).toBe(400);
  });

  it('never echoes it into the stream', async () => {
    // It is a client-supplied string; reflecting it would make the endpoint a
    // trivial content-injection vector into the panel.
    const { text } = await post({ ...ask, conversationId: 'conv-abc-123' });
    expect(text).not.toContain('conv-abc-123');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetAdapters, setAdapterForTests } from '@/lib/assistant/registry';
import { resetModelCredentialForTests } from '@/lib/assistant/model-config';
import type { AssistantEvent, EntityAdapter } from '@/lib/assistant/types';

/**
 * The notice names a server-side configuration fault, so it is admin-only. The
 * gate is server-side: a non-admin must not be able to read the text out of the
 * payload, which rules out shipping it and hiding it in CSS.
 *
 * The fallback itself is NOT gated — every role keeps getting keyword results.
 * Only the explanation is privileged.
 *
 * The notice travels as an NDJSON stream event rather than a JSON field: this
 * route's body is a ReadableStream, and its own contract is that an assistant
 * problem reaches the client as a stream event so there is one code path.
 *
 * No vi.resetModules() here, deliberately. It would hand the route a second
 * copy of model-config and registry, so the credential state this file resets
 * and the adapter it installs would not be the ones the route reads.
 */
const mocks = vi.hoisted(() => ({
  resolveTenant: vi.fn(),
}));

vi.mock('@/lib/auth/tenant', () => ({
  resolveTenant: mocks.resolveTenant,
}));

/**
 * A set-looking key makes the stream construct a real client and call the API.
 * The suite must pass with no network and no valid key, so the SDK is stubbed
 * to answer without a tool call — which degrades to the deterministic
 * classifier, exactly as an unreachable model would.
 */
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: async () => ({ content: [] }) };
  },
}));

/** Keeps the route off the database — the events adapter would query for real. */
const fakeEvents = {
  entity: 'events',
  signals: [{ word: 'shows' }],
  filterSchema: { type: 'object', properties: {} },
  emptyFilters: () => ({}),
  parseLocally: (_message: string, base: unknown) => base,
  carryOver: () => ({ filters: {}, dropped: [] }),
  search: async () => ({ rows: [{ id: 'e1', name: 'Test Expo' }], total: 1 }),
  chips: () => [],
  describe: () => 'One show matches.',
  suggest: () => [],
} as unknown as EntityAdapter<never>;

beforeEach(() => {
  resetModelCredentialForTests();
  delete process.env.ANTHROPIC_API_KEY; // -> state: 'missing'
  mocks.resolveTenant.mockReset();
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
  const text = await response.text();
  const events = text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as AssistantEvent);
  return { status: response.status, text, events };
}

function notices(events: AssistantEvent[]) {
  return events.filter((event) => event.type === 'notice');
}

const ask = { message: 'shows in germany', currentPage: 'events' };

describe('credential notice gating', () => {
  it('includes the notice for an admin', async () => {
    mocks.resolveTenant.mockResolvedValue({
      userId: 'u1',
      email: 'a@example.com',
      workspaceId: 'w1',
      role: 'ADMIN',
    });

    const { events, text } = await post(ask);

    expect(text).toContain('ANTHROPIC_API_KEY');
    expect(notices(events)).toHaveLength(1);
  });

  it('still answers the question — the notice explains, it does not replace', async () => {
    mocks.resolveTenant.mockResolvedValue({
      userId: 'u1',
      email: 'a@example.com',
      workspaceId: 'w1',
      role: 'ADMIN',
    });

    const { events } = await post(ask);

    // route first, always — the notice must not displace it.
    expect(events[0].type).toBe('route');
    expect(events.some((event) => event.type === 'results')).toBe(true);
    expect(events.at(-1)?.type).toBe('done');
  });

  it('omits it entirely for a non-admin — not merely hidden', async () => {
    mocks.resolveTenant.mockResolvedValue({
      userId: 'u2',
      email: 'b@example.com',
      workspaceId: 'w1',
      role: 'SALES_REP',
    });

    const { text, events } = await post(ask);

    expect(text).not.toContain('ANTHROPIC_API_KEY');
    expect(notices(events)).toHaveLength(0);
  });

  it('omits it when there is no session at all', async () => {
    // resolveTenant RESOLVES null for a signed-out caller — it does not throw.
    // Reading .role off that null is the obvious way to break this route.
    mocks.resolveTenant.mockResolvedValue(null);

    const { text } = await post(ask);

    expect(text).not.toContain('ANTHROPIC_API_KEY');
  });

  it('costs the caller a notice, never a reply, when the tenant lookup throws', async () => {
    mocks.resolveTenant.mockRejectedValue(new Error('database unreachable'));

    const { events, text } = await post(ask);

    expect(text).not.toContain('ANTHROPIC_API_KEY');
    expect(events.some((event) => event.type === 'results')).toBe(true);
  });

  it('still answers when the credential is fine, with no notice', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-valid';
    mocks.resolveTenant.mockResolvedValue({
      userId: 'u1',
      email: 'a@example.com',
      workspaceId: 'w1',
      role: 'ADMIN',
    });

    const { status, events } = await post(ask);

    expect(status).toBe(200);
    expect(notices(events)).toHaveLength(0);
  });

  it('does not consult the tenant at all when the credential is fine', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-valid';

    await post(ask);

    // The healthy path must not pay for a database round-trip.
    expect(mocks.resolveTenant).not.toHaveBeenCalled();
  });
});

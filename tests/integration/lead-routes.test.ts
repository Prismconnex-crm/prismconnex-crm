import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ resolveTenant: vi.fn() }));

vi.mock('@/lib/auth/tenant', () => ({ resolveTenant: mocks.resolveTenant }));
// Any database call from a route that should have stopped at auth fails loudly.
vi.mock('@/lib/db/prisma', () => ({ prisma: new Proxy({}, { get: () => { throw new Error('database touched'); } }) }));

import { GET as listLeads, POST as createLead } from '@/app/api/leads/route';
import { DELETE as deleteLead, GET as getLead, PATCH as patchLead } from '@/app/api/leads/[id]/route';
import { POST as addNote } from '@/app/api/leads/[id]/notes/route';
import { GET as listMembers } from '@/app/api/workspace/members/route';

function request(method: string, path: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as never;
}

const params = { params: { id: 'lead-1' } };

beforeEach(() => {
  mocks.resolveTenant.mockResolvedValue(null);
});

describe('lead routes without a workspace session', () => {
  const calls: Array<[string, () => Promise<Response>]> = [
    ['GET /api/leads', () => listLeads(request('GET', '/api/leads'))],
    ['POST /api/leads', () => createLead(request('POST', '/api/leads', { fullName: 'Ada' }))],
    ['GET /api/leads/[id]', () => getLead(request('GET', '/api/leads/lead-1'), params)],
    ['PATCH /api/leads/[id]', () => patchLead(request('PATCH', '/api/leads/lead-1', { jobTitle: 'x' }), params)],
    ['DELETE /api/leads/[id]', () => deleteLead(request('DELETE', '/api/leads/lead-1'), params)],
    ['POST /api/leads/[id]/notes', () => addNote(request('POST', '/api/leads/lead-1/notes', { body: 'hi' }), params)],
    ['GET /api/workspace/members', () => listMembers()],
  ];

  for (const [name, call] of calls) {
    it(`${name} answers 401`, async () => {
      expect((await call()).status).toBe(401);
    });
  }
});

describe('lead routes validate before touching the database', () => {
  it('rejects a lead with no name as 400', async () => {
    mocks.resolveTenant.mockResolvedValue({ userId: 'u', email: 'e', workspaceId: 'w', role: 'ADMIN' });
    const response = await createLead(request('POST', '/api/leads', { fullName: '' }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.message).toMatch(/fullName/);
  });

  it('rejects a VIEWER’s create as 403 before validation reaches the database', async () => {
    mocks.resolveTenant.mockResolvedValue({ userId: 'u', email: 'e', workspaceId: 'w', role: 'VIEWER' });
    const response = await createLead(request('POST', '/api/leads', { fullName: 'Ada' }));

    expect(response.status).toBe(403);
  });
});

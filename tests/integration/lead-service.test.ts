import { beforeEach, describe, expect, it, vi } from 'vitest';

// The repository boundary is faked so the suite never dials a database; the
// service's rules — roles, tenancy, owner membership, status transitions — run
// for real.
const repo = vi.hoisted(() => ({
  list: vi.fn(),
  stats: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  createNote: vi.fn(),
}));
const members = vi.hoisted(() => ({ isMember: vi.fn(), list: vi.fn() }));
const audit = vi.hoisted(() => ({ log: vi.fn() }));

vi.mock('@/repositories/lead.repository', () => ({ LeadRepository: repo }));
vi.mock('@/repositories/workspace-member.repository', () => ({ WorkspaceMemberRepository: members }));
vi.mock('@/lib/audit/audit.service', () => ({ AuditService: audit }));
vi.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { LeadService } from '@/services/lead.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/http/errors';
import type { TenantContext } from '@/lib/auth/tenant';

function tenant(role: string): TenantContext {
  return { userId: 'user-1', email: 'me@acme.com', workspaceId: 'ws-1', role };
}

function leadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead-1',
    workspaceId: 'ws-1',
    companyId: null,
    fullName: 'Ada Lovelace',
    email: null,
    phone: null,
    jobTitle: null,
    companyName: 'Analytical Engines',
    source: 'MANUAL',
    status: 'NEW',
    score: 40,
    ownerId: 'user-1',
    owner: { id: 'user-1', name: 'Me', email: 'me@acme.com' },
    nextFollowUpAt: null,
    deal: null,
    notes: [],
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  members.isMember.mockResolvedValue(true);
  repo.findById.mockResolvedValue(leadRow());
  repo.create.mockImplementation(async (_ws: string, data: Record<string, unknown>) => leadRow(data));
  repo.update.mockImplementation(async (_id: string, data: Record<string, unknown>) => leadRow(data));
  audit.log.mockResolvedValue(null);
});

describe('LeadService — roles', () => {
  it('lets a VIEWER read but not create', async () => {
    const service = new LeadService(tenant('VIEWER'));

    await expect(service.get('lead-1')).resolves.toMatchObject({ id: 'lead-1' });
    await expect(service.create({ fullName: 'Ada', source: 'MANUAL', status: 'NEW', score: 0 })).rejects.toBeInstanceOf(
      ForbiddenError
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('lets SUPPORT add a note but not edit the lead', async () => {
    const service = new LeadService(tenant('SUPPORT'));
    repo.createNote.mockResolvedValue({
      id: 'note-1',
      body: 'Called',
      createdAt: new Date(),
      author: { id: 'user-1', name: 'Me', email: 'me@acme.com' },
    });

    await expect(service.addNote('lead-1', { body: 'Called' })).resolves.toMatchObject({ body: 'Called' });
    await expect(service.update('lead-1', { jobTitle: 'CTO' })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('reserves delete for ADMIN', async () => {
    await expect(new LeadService(tenant('SALES_REP')).remove('lead-1')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(new LeadService(tenant('ADMIN')).remove('lead-1')).resolves.toBeUndefined();
    expect(repo.remove).toHaveBeenCalledWith('lead-1');
  });
});

describe('LeadService — tenancy', () => {
  it('treats a lead from another workspace as not found', async () => {
    repo.findById.mockResolvedValue(null);
    const service = new LeadService(tenant('ADMIN'));

    await expect(service.get('foreign-lead')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.update('foreign-lead', { jobTitle: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.findById).toHaveBeenCalledWith('ws-1', 'foreign-lead');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('creates the lead inside the caller’s workspace', async () => {
    await new LeadService(tenant('SALES_REP')).create({ fullName: 'Ada', source: 'MANUAL', status: 'NEW', score: 0 });
    expect(repo.create).toHaveBeenCalledWith('ws-1', expect.anything());
  });
});

describe('LeadService — assignment', () => {
  it('assigns a new lead to its creator when no owner is given', async () => {
    await new LeadService(tenant('SALES_REP')).create({ fullName: 'Ada', source: 'MANUAL', status: 'NEW', score: 0 });
    expect(repo.create).toHaveBeenCalledWith('ws-1', expect.objectContaining({ ownerId: 'user-1' }));
  });

  it('keeps an explicitly unassigned lead unassigned', async () => {
    await new LeadService(tenant('SALES_REP')).create({
      fullName: 'Ada',
      source: 'MANUAL',
      status: 'NEW',
      score: 0,
      ownerId: null,
    });
    expect(repo.create).toHaveBeenCalledWith('ws-1', expect.objectContaining({ ownerId: null }));
  });

  it('refuses an owner who is not a member of the workspace', async () => {
    members.isMember.mockResolvedValue(false);

    await expect(new LeadService(tenant('SALES_REP')).update('lead-1', { ownerId: 'outsider' })).rejects.toBeInstanceOf(
      BadRequestError
    );
    expect(members.isMember).toHaveBeenCalledWith('ws-1', 'outsider');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('audits a reassignment separately from a plain edit', async () => {
    await new LeadService(tenant('SALES_REP')).update('lead-1', { ownerId: 'user-2' });
    expect(audit.log).toHaveBeenCalledWith('ws-1', 'user-1', 'LEAD', 'lead-1', 'ASSIGN');
  });
});

describe('LeadService — status rules', () => {
  it('only reaches CONVERTED through Convert to Deal', async () => {
    const service = new LeadService(tenant('SALES_REP'));

    await expect(service.update('lead-1', { status: 'CONVERTED' })).rejects.toThrow(/Convert to Deal/);
    await expect(
      service.create({ fullName: 'Ada', source: 'MANUAL', status: 'CONVERTED', score: 0 })
    ).rejects.toThrow(/Convert to Deal/);
  });

  it('locks the status of a lead that is already converted', async () => {
    repo.findById.mockResolvedValue(leadRow({ status: 'CONVERTED' }));

    await expect(new LeadService(tenant('SALES_REP')).update('lead-1', { status: 'NEW' })).rejects.toBeInstanceOf(
      BadRequestError
    );
  });

  it('audits a status change', async () => {
    await new LeadService(tenant('SALES_REP')).update('lead-1', { status: 'QUALIFIED' });
    expect(audit.log).toHaveBeenCalledWith('ws-1', 'user-1', 'LEAD', 'lead-1', 'STATUS_CHANGE');
  });
});

describe('LeadService — list', () => {
  it('resolves the "me" owner filter to the caller and returns stats', async () => {
    repo.list.mockResolvedValue([leadRow()]);
    repo.stats.mockResolvedValue([
      { status: 'NEW', _count: { _all: 3 } },
      { status: 'CONVERTED', _count: { _all: 1 } },
    ]);

    const result = await new LeadService(tenant('VIEWER')).list({ owner: 'me', limit: 50 });

    expect(repo.list).toHaveBeenCalledWith('ws-1', expect.objectContaining({ ownerId: 'user-1' }));
    expect(result.stats.total).toBe(4);
    expect(result.stats.byStatus.NEW).toBe(3);
    expect(result.stats.byStatus.CONTACTED).toBe(0);
    expect(result.stats.conversionRate).toBe(25);
    expect(result.items[0].owner).toEqual({ id: 'user-1', name: 'Me' });
  });

  it('returns a cursor only when there is another page', async () => {
    repo.stats.mockResolvedValue([]);
    // The repository fetches limit + 1 rows to learn whether a next page exists.
    repo.list.mockResolvedValue([leadRow({ id: 'a' }), leadRow({ id: 'b' }), leadRow({ id: 'c' })]);

    const result = await new LeadService(tenant('VIEWER')).list({ limit: 2 });

    expect(result.items.map((lead) => lead.id)).toEqual(['a', 'b']);
    expect(result.nextCursor).toBe('b');
  });
});

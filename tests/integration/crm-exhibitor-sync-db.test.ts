import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncPlan } from '@/lib/exhibitors/crm-sync';
import { prismaExhibitorSyncDb } from '@/lib/exhibitors/crm-sync-db';

// The statements lib/exhibitors/crm-sync-db.ts sends, captured instead of run: nothing here touches a database.
const calls = vi.hoisted(() => [] as { sql: string; params: unknown[] }[]);
vi.mock('@/lib/db/prisma', () => {
  const tx = {
    $executeRawUnsafe: async (sql: string, ...params: unknown[]) => {
      calls.push({ sql, params });
      return (params[1] as unknown[]).length;
    },
  };
  return { prisma: { $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } };
});

const SLUG = 'aapex-las-vegas-nv-2026-11-03';
const row = (id: string, extra: Record<string, string | null> = {}) => ({
  eventSlug: SLUG,
  companyName: `Company ${id}`,
  nameKey: `company${id}`,
  logoUrl: id === '1' ? null : `/api/find-shows/exhibitors/logo?slug=${SLUG}&id=${id}`,
  sourceDetailUrl: `https://aapex2026.mapyourshow.com/8_0/exhibitor/exhibitor-details.cfm?exhid=${id}`,
  sourceDirectoryUrl: 'https://aapex2026.mapyourshow.com/8_0/explore/exhibitor-gallery.cfm?featured=false',
  standNumber: `V${id}`,
  description: id === '2' ? null : `About ${id}`,
  source: 'map-your-show',
  ...extra,
});

/** The quoted column list of an INSERT, or the unnest alias list of the UPDATE, in order. */
const insertColumns = (sql: string) => Array.from(sql.match(/\(([^)]*)\)\s*SELECT/)![1].matchAll(/"(\w+)"/g), (m) => m[1]);

beforeEach(() => {
  calls.length = 0;
});

describe('CRM exhibitor sync: the SQL sent to EventExhibitor', () => {
  it('inserts each column from its own field, in column order, keyed on (eventSlug, sourceDetailUrl)', async () => {
    const inserts = [row('1'), row('2')];
    await prismaExhibitorSyncDb.apply(SLUG, { inserts, updates: [], unchanged: 0 } satisfies SyncPlan);
    expect(calls).toHaveLength(1);
    const [{ sql, params }] = calls;
    expect(sql).toMatch(/ON CONFLICT \("eventSlug","sourceDetailUrl"\) DO NOTHING/);
    const columns = insertColumns(sql);
    // id, then $1 = eventSlug, then one unnest array per column ($2…), then createdAt/updatedAt.
    expect(columns.slice(0, 2)).toEqual(['id', 'eventSlug']);
    expect(columns.slice(-2)).toEqual(['createdAt', 'updatedAt']);
    expect(params[0]).toBe(SLUG);
    const arrayColumns = columns.slice(2, -2);
    expect(params).toHaveLength(1 + arrayColumns.length);
    arrayColumns.forEach((column, index) => {
      expect(params[index + 1], column).toEqual(inserts.map((insert) => insert[column as keyof typeof insert]));
    });
  });

  it('updates only source-owned columns, each from its own field, and never CRM-owned ones', async () => {
    const updates = [
      { id: 'r1', companyName: 'A', nameKey: 'a', logoUrl: null, sourceDirectoryUrl: 'https://dir/', standNumber: 'V1', description: 'd1' },
      { id: 'r2', companyName: 'B', nameKey: null, logoUrl: '/logo/2', sourceDirectoryUrl: null, standNumber: null, description: null },
    ];
    await prismaExhibitorSyncDb.apply(SLUG, { inserts: [], updates, unchanged: 0 });
    expect(calls).toHaveLength(1);
    const [{ sql, params }] = calls;
    const set = Array.from(sql.match(/SET([\s\S]*?)FROM/)![1].matchAll(/"(\w+)"\s*=\s*([\w.()]+)/g), (m) => [m[1], m[2]]);
    const alias = sql.match(/AS u\(([^)]*)\)/)![1].split(',').map((name) => name.trim());
    expect(alias[0]).toBe('id');
    expect(params[0]).toBe(SLUG);
    expect(params[1]).toEqual(['r1', 'r2']);
    for (const [column, value] of set) {
      if (column === 'updatedAt') continue;
      const index = alias.indexOf(value.replace(/^u\./, ''));
      expect(index, column).toBeGreaterThan(0);
      expect(params[index + 1], column).toEqual(updates.map((update) => update[column as keyof (typeof updates)[number]]));
    }
    expect(set.map(([column]) => column).sort()).toEqual(['companyName', 'description', 'logoUrl', 'nameKey', 'sourceDirectoryUrl', 'standNumber', 'updatedAt']);
    expect(sql).toMatch(/WHERE e\."id" = u\.id AND e\."eventSlug" = \$1/);
  });

  it('sends nothing for an empty plan', async () => {
    expect(await prismaExhibitorSyncDb.apply(SLUG, { inserts: [], updates: [], unchanged: 3 })).toEqual({ inserted: 0, updated: 0 });
    expect(calls).toHaveLength(0);
  });
});

import { prisma } from '@/lib/db/prisma';
import type { ExhibitorSyncDb, ExistingExhibitorRow, SyncPlan } from './crm-sync';

/**
 * EventExhibitor through the app's Prisma client, for lib/exhibitors/crm-sync.ts — the same path in the app
 * (the automatic sync) and in the CLI. One transaction per event: its inserts and updates land together or
 * not at all. Inserts go through the (eventSlug, sourceDetailUrl) unique key with ON CONFLICT DO NOTHING, so
 * two runs racing on one event can never create a duplicate row.
 */
export const prismaExhibitorSyncDb: ExhibitorSyncDb = {
  async existingRows(eventSlug) {
    return prisma.eventExhibitor.findMany({
      where: { eventSlug },
      select: {
        id: true,
        sourceDetailUrl: true,
        source: true,
        companyName: true,
        nameKey: true,
        logoUrl: true,
        sourceDirectoryUrl: true,
        standNumber: true,
        description: true,
      },
    }) satisfies Promise<ExistingExhibitorRow[]>;
  },

  async apply(eventSlug, plan: SyncPlan) {
    const { inserts, updates } = plan;
    return prisma.$transaction(async (tx) => {
      let inserted = 0;
      let updated = 0;
      if (inserts.length) {
        const column = <K extends keyof (typeof inserts)[number]>(key: K) => inserts.map((row) => row[key]);
        inserted = await tx.$executeRawUnsafe(
          `INSERT INTO "EventExhibitor"
             ("id","eventSlug","companyName","nameKey","logoUrl","sourceDetailUrl","sourceDirectoryUrl",
              "standNumber","description","source","createdAt","updatedAt")
           SELECT gen_random_uuid()::text, $1, t.*, NOW(), NOW()
           FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[]) AS t
           ON CONFLICT ("eventSlug","sourceDetailUrl") DO NOTHING`,
          eventSlug,
          column('companyName'),
          column('nameKey'),
          column('logoUrl'),
          column('sourceDetailUrl'),
          column('sourceDirectoryUrl'),
          column('standNumber'),
          column('description'),
          column('source')
        );
      }
      if (updates.length) {
        const column = <K extends keyof (typeof updates)[number]>(key: K) => updates.map((row) => row[key]);
        // Only the source-owned columns; CRM-owned ones (website, country, contacts, …) are not in the SET.
        updated = await tx.$executeRawUnsafe(
          `UPDATE "EventExhibitor" AS e SET
             "companyName" = u.company_name, "nameKey" = u.name_key, "logoUrl" = u.logo_url,
             "sourceDirectoryUrl" = u.directory_url, "standNumber" = u.stand, "description" = u.description,
             "updatedAt" = NOW()
           FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[])
             AS u(id, company_name, name_key, logo_url, directory_url, stand, description)
           WHERE e."id" = u.id AND e."eventSlug" = $1`,
          eventSlug,
          column('id'),
          column('companyName'),
          column('nameKey'),
          column('logoUrl'),
          column('sourceDirectoryUrl'),
          column('standNumber'),
          column('description')
        );
      }
      return { inserted, updated };
    }, { timeout: 60_000 });
  },
};

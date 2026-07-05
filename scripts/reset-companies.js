/**
 * Phase C: wipe the Company table (28.5M synthetic rows) using SQLite's
 * truncate optimization, null out child references, then VACUUM to reclaim
 * the ~26GB file. Real companies are re-inserted afterwards by
 * `npx tsx prisma/seed-real-companies.ts`.
 *
 * Safe because Contact/Lead/Deal.companyId is nullable (onDelete: SetNull);
 * we null them explicitly since FK enforcement is disabled for the fast wipe.
 */
const { performance } = require("node:perf_hooks");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({ log: ["error"] });

async function step(label, fn) {
  const t = performance.now();
  const r = await fn();
  console.log(`${label}: ${((performance.now() - t) / 1000).toFixed(1)}s`);
  return r;
}

async function main() {
  await step("PRAGMA foreign_keys=OFF", () =>
    prisma.$executeRawUnsafe("PRAGMA foreign_keys=OFF"));

  // No WHERE + FK off + no triggers => SQLite truncate optimization (near-instant)
  await step("DELETE FROM Company (truncate)", () =>
    prisma.$executeRawUnsafe("DELETE FROM Company"));

  await step("null Contact.companyId", () =>
    prisma.$executeRawUnsafe("UPDATE Contact SET companyId=NULL WHERE companyId IS NOT NULL"));
  await step("null Lead.companyId", () =>
    prisma.$executeRawUnsafe("UPDATE Lead SET companyId=NULL WHERE companyId IS NOT NULL"));
  await step("null Deal.companyId", () =>
    prisma.$executeRawUnsafe("UPDATE Deal SET companyId=NULL WHERE companyId IS NOT NULL"));

  await step("PRAGMA foreign_keys=ON", () =>
    prisma.$executeRawUnsafe("PRAGMA foreign_keys=ON"));

  const remaining = await prisma.$queryRawUnsafe("SELECT COUNT(*) AS n FROM Company");
  console.log("Company rows remaining:", Number(remaining[0].n));

  await step("VACUUM", () => prisma.$executeRawUnsafe("VACUUM"));
  await step("PRAGMA wal_checkpoint(TRUNCATE)", () =>
    prisma.$executeRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)"));

  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

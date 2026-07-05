const { performance } = require("node:perf_hooks");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const steps = [
  {
    label: "idx_company_name_nocase",
    kind: "execute",
    sql: "CREATE INDEX IF NOT EXISTS idx_company_name_nocase ON Company(name COLLATE NOCASE)",
  },
  {
    label: "drop idx_category_engagementScore (orphaned)",
    kind: "execute",
    sql: "DROP INDEX IF EXISTS idx_category_engagementScore",
  },
  { label: "ANALYZE Company", kind: "execute", sql: "ANALYZE Company" },
  { label: "PRAGMA optimize", kind: "query", sql: "PRAGMA optimize" },
];

async function runStep(step) {
  const started = performance.now();

  if (step.kind === "query") {
    await prisma.$queryRawUnsafe(step.sql);
  } else {
    await prisma.$executeRawUnsafe(step.sql);
  }

  const durationMs = performance.now() - started;
  console.log(`${step.label}: ${durationMs.toFixed(1)}ms`);
}

async function main() {
  console.log("Applying SQLite Company optimizations...");

  for (const step of steps) {
    await runStep(step);
  }

  const indexes = await prisma.$queryRawUnsafe(
    "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='Company' ORDER BY name"
  );

  console.log("\nCompany indexes:");
  console.log(JSON.stringify(indexes, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

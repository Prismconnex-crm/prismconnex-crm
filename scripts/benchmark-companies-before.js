const { performance } = require("node:perf_hooks");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DEFAULT_CATEGORY = process.env.BENCH_CATEGORY || "information technology & services";
const DEFAULT_EMPLOYEE_RANGE = process.env.BENCH_EMPLOYEE_RANGE || "1-10";
const DEFAULT_REGION = process.env.BENCH_REGION || "Asia-Pacific";
const DEFAULT_SEARCH = process.env.BENCH_SEARCH || "Tata";
const LIMIT = Number.parseInt(process.env.BENCH_LIMIT || "50", 10);
const DEEP_PAGE = Number.parseInt(process.env.BENCH_DEEP_PAGE || "1000", 10);

async function measure(label, run) {
  const started = performance.now();
  const rows = await run();
  const durationMs = performance.now() - started;

  return {
    label,
    rows: Array.isArray(rows) ? rows.length : Number(rows ?? 0),
    durationMs: Number(durationMs.toFixed(1)),
  };
}

async function main() {
  const results = [];

  results.push(
    await measure("old: ORDER BY engagementScore DESC", () =>
      prisma.company.findMany({
        orderBy: { engagementScore: "desc" },
        take: LIMIT,
      })
    )
  );

  results.push(
    await measure("old: composite filter with Prisma orderBy", () =>
      prisma.company.findMany({
        where: {
          category: DEFAULT_CATEGORY,
          employeeRange: DEFAULT_EMPLOYEE_RANGE,
          region: DEFAULT_REGION,
        },
        orderBy: { engagementScore: "desc" },
        take: LIMIT,
      })
    )
  );

  results.push(
    await measure("old: name contains search", () =>
      prisma.company.findMany({
        where: {
          name: { contains: DEFAULT_SEARCH },
        },
        take: LIMIT,
      })
    )
  );

  results.push(
    await measure(`old: OFFSET page ${DEEP_PAGE}`, () =>
      prisma.company.findMany({
        orderBy: { engagementScore: "desc" },
        skip: (DEEP_PAGE - 1) * LIMIT,
        take: LIMIT,
      })
    )
  );

  console.log("Company Query Benchmark - Before Optimization");
  console.table(results);
  console.log("\nBenchmark report template:");
  console.log("| Query | Rows | Duration ms | Notes |");
  console.log("| --- | ---: | ---: | --- |");
  for (const result of results) {
    console.log(`| ${result.label} | ${result.rows} | ${result.durationMs} | Baseline Prisma/OFFSET shape |`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

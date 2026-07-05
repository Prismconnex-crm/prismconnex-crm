const { performance } = require("node:perf_hooks");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DEFAULT_CATEGORY = process.env.BENCH_CATEGORY || "information technology & services";
const DEFAULT_EMPLOYEE_RANGE = process.env.BENCH_EMPLOYEE_RANGE || "1-10";
const DEFAULT_REGION = process.env.BENCH_REGION || "Asia-Pacific";
const DEFAULT_SEARCH = process.env.BENCH_SEARCH || "Tata";
const LIMIT = Number.parseInt(process.env.BENCH_LIMIT || "50", 10);

function nextPrefixBound(value) {
  return value.slice(0, -1) + String.fromCharCode(value.charCodeAt(value.length - 1) + 1);
}

async function applyPragmas() {
  // Match the runtime pragmas from ensureSQLiteReadPragmas() in lib/db/prisma.ts,
  // so this benchmark reflects what the app actually runs at request time.
  const pragmas = [
    "PRAGMA journal_mode=WAL",
    "PRAGMA synchronous=NORMAL",
    "PRAGMA temp_store=MEMORY",
    "PRAGMA cache_size=-64000",
  ];

  for (const pragma of pragmas) {
    await prisma.$queryRawUnsafe(pragma);
  }
}

async function explain(sql, params = []) {
  return prisma.$queryRawUnsafe(`EXPLAIN QUERY PLAN ${sql}`, ...params);
}

async function measure(label, sql, params = []) {
  // Run 3x, discard the first (cold-cache) run, report the median of the rest —
  // reduces noise from OS page-cache state on a large db without over-engineering.
  const durations = [];
  let rows;
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    rows = await prisma.$queryRawUnsafe(sql, ...params);
    durations.push(performance.now() - started);
  }
  const warm = durations.slice(1).sort((a, b) => a - b);
  const durationMs = warm[Math.floor(warm.length / 2)];
  const plan = await explain(sql, params);

  return {
    label,
    rows: rows.length,
    durationMs: Number(durationMs.toFixed(1)),
    plan: plan.map((step) => step.detail).join(" | "),
  };
}

async function main() {
  await applyPragmas();

  const results = [];

  const topCompaniesSql = `
    SELECT rowid AS rowCursor, id, name, category, employeeRange, region, engagementScore
    FROM Company
    ORDER BY rowid DESC
    LIMIT ?
  `;

  results.push(await measure("new: rowid browse listing", topCompaniesSql, [LIMIT]));

  const filteredSql = `
    SELECT rowid AS rowCursor, id, name, category, employeeRange, region, engagementScore
    FROM Company
    WHERE category = ?
      AND employeeRange = ?
      AND region = ?
    ORDER BY rowid DESC
    LIMIT ?
  `;

  results.push(
    await measure("new: indexed composite filters", filteredSql, [
      DEFAULT_CATEGORY,
      DEFAULT_EMPLOYEE_RANGE,
      DEFAULT_REGION,
      LIMIT,
    ])
  );

  const searchUpperBound = nextPrefixBound(DEFAULT_SEARCH);
  const searchSql = `
    SELECT rowid AS rowCursor, id, name, category, employeeRange, region, engagementScore
    FROM Company
    WHERE name >= ? COLLATE NOCASE AND name < ? COLLATE NOCASE
    ORDER BY name COLLATE NOCASE ASC
    LIMIT ?
  `;

  results.push(await measure("new: prefix name search (COLLATE NOCASE)", searchSql, [DEFAULT_SEARCH, searchUpperBound, LIMIT]));

  const firstPage = await prisma.$queryRawUnsafe(topCompaniesSql, LIMIT);
  const cursor = firstPage[firstPage.length - 1];
  if (cursor) {
    const cursorSql = `
      SELECT rowid AS rowCursor, id, name, category, employeeRange, region, engagementScore
      FROM Company
      WHERE rowid < ?
      ORDER BY rowid DESC
      LIMIT ?
    `;

    results.push(
      await measure("new: rowid cursor next page", cursorSql, [cursor.rowCursor, LIMIT])
    );
  }

  console.log("Company Query Benchmark - After Optimization");
  console.table(
    results.map((result) => ({
      label: result.label,
      rows: result.rows,
      durationMs: result.durationMs,
    }))
  );

  console.log("\nQuery plans:");
  for (const result of results) {
    console.log(`\n${result.label}`);
    console.log(result.plan);
  }

  console.log("\nBenchmark report template:");
  console.log("| Query | Rows | Duration ms | Plan | Notes |");
  console.log("| --- | ---: | ---: | --- | --- |");
  for (const result of results) {
    console.log(`| ${result.label} | ${result.rows} | ${result.durationMs} | ${result.plan} | Optimized SQLite/raw SQL shape |`);
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

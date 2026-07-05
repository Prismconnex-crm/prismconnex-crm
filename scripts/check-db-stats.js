const { PrismaClient } = require("../lib/generated/sqlite-client");
const p = new PrismaClient();

async function main() {
  // Fast queries - avoid full table scans
  const sample = await p.$queryRawUnsafe(
    "SELECT region, headquarters, category, employeeRange FROM Company WHERE region = 'Asia-Pacific' LIMIT 10"
  );
  console.log("APAC sample (10 rows):", JSON.stringify(sample, null, 2));

  // Check how many Indian companies exist already (quick indexed lookup)
  const indiaCount = await p.$queryRawUnsafe(
    "SELECT COUNT(*) as cnt FROM Company WHERE headquarters LIKE '%India%'"
  );
  console.log("India HQ count:", JSON.stringify(indiaCount, (k, v) => typeof v === "bigint" ? Number(v) : v));

  // Check DB file size
  const fs = require("fs");
  const dbPath = process.env.DATABASE_URL?.replace("file:", "") || "prisma/dev.db";
  try {
    const stats = fs.statSync(dbPath);
    console.log("DB file size:", (stats.size / (1024 * 1024 * 1024)).toFixed(2), "GB");
  } catch (e) {
    console.log("Could not stat DB file:", dbPath);
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

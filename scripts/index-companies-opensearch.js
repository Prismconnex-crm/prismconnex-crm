/**
 * Bulk Index Companies from SQLite → OpenSearch
 * 
 * Reads all companies from the SQLite database and indexes them
 * into the OpenSearch companies_v1 index using the _bulk API.
 * 
 * Usage: OPENSEARCH_URL=https://... node scripts/index-companies-opensearch.js
 */

const { PrismaClient } = require("@prisma/client");
const { Client } = require("@opensearch-project/opensearch");

const prisma = new PrismaClient({ log: ["error"] });

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || "https://localhost:9200";
const INDEX_NAME = "companies_v1";
const BATCH_SIZE = 5000;
const LOG_EVERY = 50000;

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  SQLite → OpenSearch Company Indexing                   ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  const client = new Client({
    node: OPENSEARCH_URL,
    auth: process.env.OPENSEARCH_USERNAME
      ? {
          username: process.env.OPENSEARCH_USERNAME,
          password: process.env.OPENSEARCH_PASSWORD || "",
        }
      : undefined,
    ssl: { rejectUnauthorized: false },
    requestTimeout: 120000,
  });

  // Get total count
  console.log("Counting companies in SQLite...");
  const totalResult = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) as cnt FROM Company"
  );
  const total = Number(totalResult[0].cnt);
  console.log(`Total companies: ${total.toLocaleString()}`);

  const startTime = Date.now();
  let indexed = 0;
  let offset = 0;

  while (offset < total) {
    // Read batch from SQLite using raw SQL for speed
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, name, domain, category, employeeRange, region, 
              headquarters, description, website, founded, revenueRange,
              engagementScore, trustSignals, tags, email, phone,
              highlights, insights, updatedAt
       FROM Company 
       ORDER BY rowid
       LIMIT ${BATCH_SIZE} OFFSET ${offset}`
    );

    if (rows.length === 0) break;

    // Build bulk request body
    const bulkBody = [];
    for (const row of rows) {
      bulkBody.push({ index: { _index: INDEX_NAME, _id: row.id } });
      bulkBody.push({
        id: row.id,
        name: row.name ? row.name.replace(/\s+\d+$/, "") : "", // Clean generated suffixes
        nameKeyword: row.name ? row.name.replace(/\s+\d+$/, "") : "",
        domainNorm: row.domain || "",
        category: row.category || "",
        employeeRange: row.employeeRange || "",
        region: row.region || "",
        headquarters: row.headquarters || "",
        description: row.description || "",
        website: row.website || "",
        founded: row.founded || "",
        revenueRange: row.revenueRange || "",
        trustSignals: row.trustSignals || "",
        tags: row.tags ? row.tags.split(",").map((t) => t.trim()) : [],
        email: row.email || "",
        phone: row.phone || "",
        highlights: row.highlights || "",
        insights: row.insights || "",
        popularityScore: row.engagementScore || 0,
        updatedAt: row.updatedAt
          ? new Date(row.updatedAt).toISOString()
          : new Date().toISOString(),
      });
    }

    // Send bulk request
    try {
      const result = await client.bulk({ body: bulkBody, refresh: false });
      if (result.body.errors) {
        const errorItems = result.body.items.filter((item) => item.index?.error);
        console.error(
          `  ⚠ ${errorItems.length} errors in batch at offset ${offset}`
        );
        if (errorItems.length <= 3) {
          errorItems.forEach((item) =>
            console.error("    ", JSON.stringify(item.index.error))
          );
        }
      }
    } catch (err) {
      console.error(`  ❌ Bulk request failed at offset ${offset}:`, err.message);
      // Retry once
      await new Promise((r) => setTimeout(r, 3000));
      try {
        await client.bulk({ body: bulkBody, refresh: false });
      } catch (retryErr) {
        console.error(`  ❌ Retry failed, skipping batch:`, retryErr.message);
      }
    }

    indexed += rows.length;
    offset += BATCH_SIZE;

    if (indexed % LOG_EVERY === 0 || indexed >= total) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = Math.round(indexed / ((Date.now() - startTime) / 1000));
      const pct = ((indexed / total) * 100).toFixed(1);
      const eta =
        rate > 0 ? Math.round((total - indexed) / rate) : "?";

      console.log(
        `  📊 ${indexed.toLocaleString().padStart(12)} / ${total.toLocaleString()} ` +
          `(${pct}%) | ${rate.toLocaleString()} docs/sec | ` +
          `Elapsed: ${elapsed}s | ETA: ${eta}s`
      );
    }
  }

  // Force a refresh so data is searchable immediately
  console.log("\nForcing index refresh...");
  await client.indices.refresh({ index: INDEX_NAME });

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n✅ Indexing complete!`);
  console.log(`   Indexed: ${indexed.toLocaleString()} documents`);
  console.log(`   Time: ${totalTime} minutes`);

  await client.close();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});

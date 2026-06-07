/**
 * Create OpenSearch Index for Companies
 * 
 * Creates the companies_v1 index with search_as_you_type mapping
 * for prefix-first typeahead search.
 * 
 * Usage: npx ts-node scripts/create-opensearch-index.ts
 */

const { Client } = require("@opensearch-project/opensearch");

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || "https://localhost:9200";
const INDEX_NAME = "companies_v1";

async function main() {
  const client = new Client({
    node: OPENSEARCH_URL,
    auth: process.env.OPENSEARCH_USERNAME
      ? {
          username: process.env.OPENSEARCH_USERNAME,
          password: process.env.OPENSEARCH_PASSWORD || "",
        }
      : undefined,
    ssl: { rejectUnauthorized: false },
  });

  // Check if index exists
  const exists = await client.indices.exists({ index: INDEX_NAME });
  if (exists.body) {
    console.log(`Index "${INDEX_NAME}" already exists. Delete it first if you want to recreate.`);
    console.log(`Run: curl -XDELETE "${OPENSEARCH_URL}/${INDEX_NAME}"`);
    process.exit(0);
  }

  console.log(`Creating index "${INDEX_NAME}"...`);

  await client.indices.create({
    index: INDEX_NAME,
    body: {
      settings: {
        index: {
          number_of_shards: 3,
          number_of_replicas: 1,
        },
        analysis: {
          normalizer: {
            lowercase_normalizer: {
              type: "custom",
              filter: ["lowercase"],
            },
          },
        },
      },
      mappings: {
        properties: {
          id: { type: "keyword" },
          name: { type: "search_as_you_type" },
          nameKeyword: { type: "keyword" },
          domainNorm: {
            type: "keyword",
            normalizer: "lowercase_normalizer",
          },
          category: { type: "keyword" },
          employeeRange: { type: "keyword" },
          region: { type: "keyword" },
          headquarters: { type: "text" },
          description: { type: "text", index: false },
          website: { type: "keyword", index: false },
          founded: { type: "keyword", index: false },
          revenueRange: { type: "keyword", index: false },
          trustSignals: { type: "text", index: false },
          tags: { type: "keyword" },
          email: { type: "keyword", index: false },
          phone: { type: "keyword", index: false },
          highlights: { type: "text", index: false },
          insights: { type: "text", index: false },
          popularityScore: { type: "integer" },
          updatedAt: { type: "date" },
        },
      },
    },
  });

  console.log(`✅ Index "${INDEX_NAME}" created successfully!`);
  console.log(`\nMapping includes:`);
  console.log(`  - name: search_as_you_type (prefix-first typeahead)`);
  console.log(`  - domainNorm: keyword with lowercase normalizer`);
  console.log(`  - category/employeeRange/region: keyword filters`);
  console.log(`  - popularityScore: integer (for sort tiebreaking)`);

  await client.close();
}

main().catch((e) => {
  console.error("Failed to create index:", e);
  process.exit(1);
});

import { PrismaClient } from "@prisma/client";
import { inferCompanyRegion } from "../lib/company-classification";

const prisma = new PrismaClient({ log: ["error"] });

const categories = [
  "information technology & services", "construction", "marketing and advertising",
  "real estate", "health, wellness & fitness", "management consulting",
  "computer software", "internet", "retail", "financial services",
  "consumer services", "hospital & health care", "automotive",
  "restaurants", "education management", "food & beverages",
  "design", "hospitality", "accounting", "trade show events"
];

const prefixes = ["Omni", "Nova", "Zeta", "Pinnacle", "Aether", "Horizon", "Matrix", "Vertex", "Quantum", "Solar", "Terra", "Stellar", "Astral", "Vortex", "Saga", "Eon", "Sigma", "Vector", "Helix", "Polaris"];
const middles = ["Enterprises", "Corporation", "Ventures", "Systems", "Industries", "Holdings", "Networks", "Laboratories", "Resources", "Strategies", "Dynamics", "Solutions", "Services", "Technologies"];
const suffixes = ["Inc", "Corp", "Ltd", "LLC", "Group", "Co."];

const PER_CATEGORY = 60000; // 60,000 per category Ã— 20 = 1,200,000

async function main() {
  console.log("Fetching default workspace...");
  let workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    console.error("Workspace not found.");
    process.exit(1);
  }

  const workspaceId = workspace.id;
  console.log(`Using Workspace ID: ${workspaceId}`);
  console.log("Optimizing SQLite write performance via PRAGMAs...");
  await prisma.$queryRawUnsafe('PRAGMA synchronous = OFF;');
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = MEMORY;');

  console.log(`Starting generation of 1,200,000 mid-sized businesses (employee range: 21-50, ${PER_CATEGORY} per category)...`);

  const hqCities = ["New York, USA", "London, UK", "Chicago, USA", "Los Angeles, USA", "Toronto, Canada", "Sydney, Australia", "Miami, USA", "Austin, USA", "Berlin, Germany", "Singapore", "Dallas, USA", "Denver, USA", "Seattle, USA", "Boston, USA", "San Diego, USA"];
  const revList = ["$5M - $10M", "$10M - $25M"];

  for (const category of categories) {
    console.log(`Generating ${PER_CATEGORY} companies for: ${category}`);

    // Process in sub-batches of 10,000 to keep memory footprint low
    const SUB_BATCH = 10000;
    for (let batch = 0; batch < PER_CATEGORY; batch += SUB_BATCH) {
      const companiesToInsert: any[] = [];

      for (let i = 0; i < SUB_BATCH; i++) {
        const globalIdx = batch + i;
        const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
        const mid = middles[Math.floor(Math.random() * middles.length)];
        const suf = suffixes[Math.floor(Math.random() * suffixes.length)];

        const name = `${pre} ${mid} ${suf} ${globalIdx + 150000}`;
        let domainBase = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (domainBase.length > 18) domainBase = domainBase.substring(0, 18);
        const tld = globalIdx % 3 === 0 ? '.net' : (globalIdx % 5 === 0 ? '.co' : '.com');
        const domain = domainBase + tld;

        const hq = hqCities[Math.floor(Math.random() * hqCities.length)];
        const region = inferCompanyRegion(hq) ?? "Americas";

        companiesToInsert.push({
          workspaceId,
          name,
          category,
          description: `A well-established company specializing in ${category}.`,
          domain,
          website: `https://${domain}`,
          founded: `201${globalIdx % 10}`,
          employeeRange: "21-50",
          headquarters: hq,
          region,
          revenueRange: revList[globalIdx % 2],
          engagementScore: Math.floor(Math.random() * 30) + 60, // 60-89 score
          trustSignals: "Top Performing Mid-Market Brand",
          tags: "Mid-Market, High-Growth",
          email: `info@${domain}`,
          phone: `+1 800-555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          highlights: "Consistent market leader, High-converting segments",
          insights: "Optimal corporate level fit"
        });
      }

      // Insert in chunks of 2000
      const CHUNK = 2000;
      for (let c = 0; c < companiesToInsert.length; c += CHUNK) {
        await prisma.company.createMany({ data: companiesToInsert.slice(c, c + CHUNK) });
      }
      console.log(`  ...inserted ${batch + SUB_BATCH} / ${PER_CATEGORY}`);
    }

    console.log(`âœ“ Done: ${PER_CATEGORY} for ${category}`);
  }

  const total = await prisma.company.count();
  console.log(`\nSuccessfully seeded 1,200,000 new 21-50 companies!`);
  console.log(`Total companies in database: ${total}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });



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

const prefixes = ["Delta", "Alpha", "Apex", "Sierra", "Summit", "Horizon", "Quantum", "Nexus", "Vector", "Titan", "Spectra", "Beacon", "Vanguard", "Pinnacle", "Crest", "Helix", "Synergy", "Infinity", "Stratford", "Keystone"];
const middles = ["Systems", "Logistics", "Media", "Capital", "Industries", "Holdings", "Networks", "Laboratories", "Resources", "Strategies", "Dynamics", "Solutions", "Ventures", "Technologies"];
const suffixes = ["Corp", "Ltd", "Inc", "Co.", "Group", "LLC"];

const PER_CATEGORY = 90000; // 90,000 per category Ã— 20 = 1,800,000

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

  console.log(`Starting generation of 1,800,000 medium businesses (employee range: 11-20, ${PER_CATEGORY} per category)...`);

  const hqCities = ["New York, USA", "London, UK", "Chicago, USA", "Los Angeles, USA", "Toronto, Canada", "Sydney, Australia", "Miami, USA", "Austin, USA", "Berlin, Germany", "Singapore", "Dallas, USA", "Denver, USA", "Seattle, USA", "Boston, USA", "San Diego, USA"];
  const revList = ["$1M - $5M", "$5M - $10M"];

  for (const category of categories) {
    console.log(`Generating ${PER_CATEGORY} companies for: ${category}`);

    // Process in sub-batches of 10,000 to optimize memory usage
    const SUB_BATCH = 10000;
    for (let batch = 0; batch < PER_CATEGORY; batch += SUB_BATCH) {
      const companiesToInsert: any[] = [];

      for (let i = 0; i < SUB_BATCH; i++) {
        const globalIdx = batch + i;
        const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
        const mid = middles[Math.floor(Math.random() * middles.length)];
        const suf = suffixes[Math.floor(Math.random() * suffixes.length)];

        const name = `${pre} ${mid} ${suf} ${globalIdx + 50000}`;
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
          description: `An established mid-sized enterprise specializing in ${category}.`,
          domain,
          website: `https://${domain}`,
          founded: `201${globalIdx % 10}`,
          employeeRange: "11-20",
          headquarters: hq,
          region,
          revenueRange: revList[globalIdx % 2],
          engagementScore: Math.floor(Math.random() * 40) + 50, // slightly higher engagement range 50-89
          trustSignals: "Verified Mid-Market Enterprise",
          tags: "Mid-Market, Verified",
          email: `info@${domain}`,
          phone: `+1 800-555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          highlights: "Consistent year-on-year growth",
          insights: "Strong potential lead category fit"
        });
      }

      // Insert in chunks of 2500 to prevent SQLite parameter limits
      const CHUNK = 2500;
      for (let c = 0; c < companiesToInsert.length; c += CHUNK) {
        await prisma.company.createMany({ data: companiesToInsert.slice(c, c + CHUNK) });
      }
      console.log(`  ...inserted ${batch + SUB_BATCH} / ${PER_CATEGORY}`);
    }

    console.log(`âœ“ Done: ${PER_CATEGORY} for ${category}`);
  }

  const total = await prisma.company.count();
  console.log(`\nSuccessfully seeded 1,800,000 new medium companies!`);
  console.log(`Total companies in database: ${total}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });



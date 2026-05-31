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

const prefixes = ["Elysian", "Solaris", "Zenith", "Catalyst", "Insignia", "Ironclad", "Meridian", "Ascent", "Clarity", "Vortex", "Velocity", "Horizon", "Pinnacle", "Starlight", "Obsidian", "Sentinel", "Equinox", "Veritas", "Galactic", "Kinesis"];
const middles = ["Systems", "Dynamics", "Synergy", "Capital", "Holdings", "Networks", "Labs", "Resources", "Strategies", "Global", "Solutions", "Services", "Technologies", "Enterprises"];
const suffixes = ["Inc", "Corp", "Ltd", "Group", "LLC", "Partners"];

const PER_CATEGORY = 24045; // 24,045 per category Ã— 20 = 480,900

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

  console.log(`Starting generation of 480,900 mid-to-large businesses (employee range: 51-100, ${PER_CATEGORY} per category)...`);

  const hqCities = ["New York, USA", "London, UK", "Chicago, USA", "Los Angeles, USA", "Toronto, Canada", "Sydney, Australia", "Miami, USA", "Austin, USA", "Berlin, Germany", "Singapore", "Dallas, USA", "Denver, USA", "Seattle, USA", "Boston, USA", "San Diego, USA"];
  const revList = ["$10M - $25M", "$25M - $50M"];

  for (const category of categories) {
    console.log(`Generating ${PER_CATEGORY} companies for: ${category}`);

    // Process in sub-batches of 10,000 to keep memory footprint low
    const SUB_BATCH = 5000;
    for (let batch = 0; batch < PER_CATEGORY; batch += SUB_BATCH) {
      const companiesToInsert: any[] = [];
      const currentBatchSize = Math.min(SUB_BATCH, PER_CATEGORY - batch);

      for (let i = 0; i < currentBatchSize; i++) {
        const globalIdx = batch + i;
        const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
        const mid = middles[Math.floor(Math.random() * middles.length)];
        const suf = suffixes[Math.floor(Math.random() * suffixes.length)];

        const name = `${pre} ${mid} ${suf} ${globalIdx + 300000}`;
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
          description: `A fast-growing, high-performance company specializing in ${category}.`,
          domain,
          website: `https://${domain}`,
          founded: `201${globalIdx % 10}`,
          employeeRange: "51-100",
          headquarters: hq,
          region,
          revenueRange: revList[globalIdx % 2],
          engagementScore: Math.floor(Math.random() * 20) + 70, // 70-89 score (high engagement corporate range)
          trustSignals: "Top Rated Enterprise Segment",
          tags: "Enterprise, High-Scale, Verified",
          email: `contact@${domain}`,
          phone: `+1 800-555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          highlights: "Exceptional market dominance, Industry leader",
          insights: "Direct outbound prospect priority"
        });
      }

      // Insert in chunks of 2500
      const CHUNK = 2500;
      for (let c = 0; c < companiesToInsert.length; c += CHUNK) {
        await prisma.company.createMany({ data: companiesToInsert.slice(c, c + CHUNK) });
      }
      console.log(`  ...inserted ${batch + currentBatchSize} / ${PER_CATEGORY}`);
    }

    console.log(`âœ“ Done: ${PER_CATEGORY} for ${category}`);
  }

  const total = await prisma.company.count();
  console.log(`\nSuccessfully seeded 480,900 new 51-100 companies!`);
  console.log(`Total companies in database: ${total}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });



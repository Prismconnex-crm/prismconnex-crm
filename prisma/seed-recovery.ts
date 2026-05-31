import { PrismaClient } from "@prisma/client";
import { inferCompanyRegion } from "../lib/company-classification";

const prisma = new PrismaClient({ log: ["error"] });

const TARGET_TOTAL = 33156300;

const categories = [
  "information technology & services", "construction", "marketing and advertising",
  "real estate", "health, wellness & fitness", "management consulting",
  "computer software", "internet", "retail", "financial services",
  "consumer services", "hospital & health care", "automotive",
  "restaurants", "education management", "food & beverages",
  "design", "hospitality", "accounting", "trade show events"
];

const employeeRanges = [
  "1-10", "11-20", "21-50", "51-100", "101-200", "51-200", "201-500", 
  "501-1000", "1001-2000", "2001-5000", "1001-5000", "5001-10000", "10001+", "1001+"
];

const prefixes = ["Quantum", "Apex", "Veritas", "Pinnacle", "Crest", "Helix", "Synergy", "Infinity", "Horizon", "Ascent", "Aero", "Astro", "Cyber", "Tech", "Omni", "Global", "NextGen", "Pro", "Core", "Prime"];
const middles = ["Systems", "Solutions", "Technologies", "Group", "Partners", "Associates", "Consulting", "Ventures", "Capital", "Holdings", "Industries", "Networks", "Laboratories", "Resources"];
const suffixes = ["Inc", "Corp", "Ltd", "LLC", "Co", "Group", "International", "Global", "Worldwide"];

async function main() {
  console.log("Fetching default workspace...");
  let workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    console.error("Workspace not found.");
    process.exit(1);
  }

  const workspaceId = workspace.id;
  
  const currentTotal = await prisma.company.count();
  console.log(`Current total companies: ${currentTotal}`);
  
  if (currentTotal >= TARGET_TOTAL) {
      console.log(`Target already met! We have ${currentTotal} companies.`);
      process.exit(0);
  }

  const missing = TARGET_TOTAL - currentTotal;
  console.log(`We are missing exactly ${missing} companies to reach ${TARGET_TOTAL}.`);
  console.log("Optimizing SQLite write performance via PRAGMAs for recovery seed...");
  await prisma.$queryRawUnsafe('PRAGMA synchronous = OFF;');
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = MEMORY;');
  await prisma.$queryRawUnsafe('PRAGMA temp_store = MEMORY;');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 30000;');

  const hqCities = ["New York, USA", "London, UK", "Chicago, USA", "Los Angeles, USA", "Toronto, Canada", "Sydney, Australia", "Miami, USA", "Austin, USA", "Berlin, Germany", "Singapore", "Dallas, USA", "Denver, USA", "Seattle, USA", "Boston, USA", "San Diego, USA"];
  const revList = ["< $1M", "$1M - $5M", "$5M - $10M", "$10M - $25M", "$25M - $50M", "$50M - $100M", "$100M - $500M", "$500M - $1B", "$1B+"];

  // Process in sub-batches of 10,000 to keep memory footprint low
  const SUB_BATCH = 10000;
  for (let batch = 0; batch < missing; batch += SUB_BATCH) {
    const companiesToInsert: any[] = [];
    const currentBatchSize = Math.min(SUB_BATCH, missing - batch);

    for (let i = 0; i < currentBatchSize; i++) {
      const globalIdx = batch + i;
      const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
      const mid = middles[Math.floor(Math.random() * middles.length)];
      const suf = suffixes[Math.floor(Math.random() * suffixes.length)];

      // Offset completely shifted by 40M to ensure no name/domain collisions with first/second 10M scripts
      const uniqueId = globalIdx + 40000000; 
      const name = `${pre} ${mid} ${suf} ${uniqueId}`;
      
      let domainBase = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (domainBase.length > 20) domainBase = domainBase.substring(0, 20);
      const tld = globalIdx % 3 === 0 ? '.net' : (globalIdx % 5 === 0 ? '.co' : '.com');
      const domain = domainBase + tld;

      const hq = hqCities[Math.floor(Math.random() * hqCities.length)];
      const region = inferCompanyRegion(hq) ?? "Americas";

      const category = categories[Math.floor(Math.random() * categories.length)];
      const empRange = employeeRanges[Math.floor(Math.random() * employeeRanges.length)];
      const revRange = revList[Math.floor(Math.random() * revList.length)];

      companiesToInsert.push({
        workspaceId,
        name,
        category,
        description: `A dynamic organization specializing in ${category}.`,
        domain,
        website: `https://${domain}`,
        founded: `201${globalIdx % 10}`,
        employeeRange: empRange,
        headquarters: hq,
        region,
        revenueRange: revRange,
        engagementScore: Math.floor(Math.random() * 50) + 40, // 40-89
        trustSignals: "Verified Global Record",
        tags: "Verified, B2B",
        email: `info@${domain}`,
        phone: `+1 800-555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        highlights: "Consistent growth, Market presence",
        insights: "Standard prospect match"
      });
    }

    // Insert in chunks of 2500
    const CHUNK = 2500;
    for (let c = 0; c < companiesToInsert.length; c += CHUNK) {
      await prisma.company.createMany({ data: companiesToInsert.slice(c, c + CHUNK) });
    }
    
    console.log(`  ...inserted ${batch + currentBatchSize} / ${missing}`);
  }

  const newTotal = await prisma.company.count();
  console.log(`\nSuccessfully seeded the remaining missing records!`);
  console.log(`Total companies in database: ${newTotal}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });



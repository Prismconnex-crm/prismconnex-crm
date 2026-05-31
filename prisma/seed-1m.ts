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

const prefixes = ["Local", "Elite", "Prime", "Core", "First", "Swift", "Pro", "Dependable", "True", "Urban", "Metro", "Value", "Direct", "Star", "Apex", "Summit", "Nexus", "Global", "Regional", "Bright", "Nova", "Peak", "Edge", "Spark", "Rise", "Bold", "Keen", "Wise", "Civic", "Rapid"];
const middles = ["Services", "Solutions", "Group", "Partners", "Associates", "Works", "Studio", "Agency", "Consulting", "Providers", "Enterprises", "Ventures", "Concepts", "Systems", "Labs", "Hub", "Tech", "Digital", "Connect", "Logic"];
const suffixes = ["LLC", "Inc", "Co.", "Associates", "Partners", "Group", "Corp", "Ltd"];

const PER_CATEGORY = 50000; // 50,000 per category Ã— 20 = 1,000,000

async function main() {
  console.log("Fetching default workspace...");
  let workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    console.error("Workspace not found.");
    process.exit(1);
  }

  const workspaceId = workspace.id;
  console.log(`Using Workspace ID: ${workspaceId}`);
  console.log(`Starting generation of 1,000,000 small businesses (${PER_CATEGORY} per category)...`);

  const hqCities = ["New York, USA", "London, UK", "Chicago, USA", "Los Angeles, USA", "Toronto, Canada", "Sydney, Australia", "Miami, USA", "Austin, USA", "Berlin, Germany", "Singapore", "Dallas, USA", "Denver, USA", "Seattle, USA", "Boston, USA", "San Diego, USA"];
  const revList = ["< $1M", "$1M - $5M"];

  for (const category of categories) {
    console.log(`Generating ${PER_CATEGORY} companies for: ${category}`);

    // Process in sub-batches of 5,000 to keep memory low
    const SUB_BATCH = 5000;
    for (let batch = 0; batch < PER_CATEGORY; batch += SUB_BATCH) {
      const companiesToInsert: any[] = [];

      for (let i = 0; i < SUB_BATCH; i++) {
        const globalIdx = batch + i;
        const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
        const mid = middles[Math.floor(Math.random() * middles.length)];
        const suf = suffixes[Math.floor(Math.random() * suffixes.length)];

        const name = `${pre} ${mid} ${suf} ${globalIdx}`;
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
          description: `A fast-growing small business specializing in ${category}.`,
          domain,
          website: `https://${domain}`,
          founded: `201${globalIdx % 10}`,
          employeeRange: "1-10",
          headquarters: hq,
          region,
          revenueRange: revList[globalIdx % 2],
          engagementScore: Math.floor(Math.random() * 30) + 40,
          trustSignals: "Local Business Leader",
          tags: "Small Business, Local",
          email: `contact@${domain}`,
          phone: `+1 800-555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          highlights: "Growing local footprint",
          insights: "Expanding service offerings"
        });
      }

      // Insert in chunks of 2500
      const CHUNK = 2500;
      for (let c = 0; c < companiesToInsert.length; c += CHUNK) {
        await prisma.company.createMany({ data: companiesToInsert.slice(c, c + CHUNK) });
      }
      console.log(`  ...inserted ${batch + SUB_BATCH} / ${PER_CATEGORY}`);
    }

    console.log(`âœ“ Done: ${PER_CATEGORY} for ${category}`);
  }

  const total = await prisma.company.count();
  console.log(`\nSuccessfully seeded 1,000,000 new companies!`);
  console.log(`Total companies in database: ${total}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });



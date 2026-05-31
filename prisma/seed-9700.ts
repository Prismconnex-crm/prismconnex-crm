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

const prefixes = ["Titan", "Nexus", "Pinnacle", "Aether", "Equinox", "Veritas", "Spectra", "Beacon", "Crest", "Helix", "Synergy", "Infinity", "Stratford", "Keystone", "Meridian", "Ascent", "Elysian", "Solaris", "Zenith", "Catalyst"];
const middles = ["Systems", "Dynamics", "Synergy", "Capital", "Holdings", "Networks", "Labs", "Resources", "Strategies", "Global", "Solutions", "Services", "Technologies", "Enterprises"];
const suffixes = ["Inc", "Corp", "Ltd", "Group", "LLC", "Partners"];

const PER_CATEGORY = 485; // 485 per category Ã— 20 = 9,700

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

  console.log(`Starting generation of 9,700 enterprise businesses (employee range: 1001+, ${PER_CATEGORY} per category)...`);

  const hqCities = ["New York, USA", "London, UK", "Chicago, USA", "Los Angeles, USA", "Toronto, Canada", "Sydney, Australia", "Miami, USA", "Austin, USA", "Berlin, Germany", "Singapore", "Dallas, USA", "Denver, USA", "Seattle, USA", "Boston, USA", "San Diego, USA"];
  const revList = ["$500M - $1B", "$1B+"];

  for (const category of categories) {
    console.log(`Generating ${PER_CATEGORY} companies for: ${category}`);

    const companiesToInsert: any[] = [];
    for (let i = 0; i < PER_CATEGORY; i++) {
      const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
      const mid = middles[Math.floor(Math.random() * middles.length)];
      const suf = suffixes[Math.floor(Math.random() * suffixes.length)];

      const name = `${pre} ${mid} ${suf} ${i + 900000}`;
      let domainBase = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (domainBase.length > 18) domainBase = domainBase.substring(0, 18);
      const tld = i % 3 === 0 ? '.net' : (i % 5 === 0 ? '.co' : '.com');
      const domain = domainBase + tld;

      const hq = hqCities[Math.floor(Math.random() * hqCities.length)];
      const region = inferCompanyRegion(hq) ?? "Americas";

      companiesToInsert.push({
        workspaceId,
        name,
        category,
        description: `A highly prominent international enterprise leader specializing in ${category}.`,
        domain,
        website: `https://${domain}`,
        founded: `201${i % 10}`,
        employeeRange: "1001+",
        headquarters: hq,
        region,
        revenueRange: revList[i % 2],
        engagementScore: Math.floor(Math.random() * 10) + 90, // 90-99 score (top enterprise range)
        trustSignals: "Verified High-Scale Conglomerate Brand",
        tags: "Enterprise, Corporate, Global, Verified",
        email: `corporate@${domain}`,
        phone: `+1 800-555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        highlights: "Exceptional market dominance, Enterprise leader",
        insights: "Premium enterprise target lead match"
      });
    }

    // Insert in chunks of 485
    const CHUNK = 485;
    for (let c = 0; c < companiesToInsert.length; c += CHUNK) {
      await prisma.company.createMany({ data: companiesToInsert.slice(c, c + CHUNK) });
    }
    console.log(`âœ“ Done: ${PER_CATEGORY} for ${category}`);
  }

  const total = await prisma.company.count();
  console.log(`\nSuccessfully seeded 9,700 new 1001+ companies!`);
  console.log(`Total companies in database: ${total}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });



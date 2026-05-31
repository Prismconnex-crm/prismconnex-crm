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

const prefixes = ["Omega", "Alpha", "Apex", "Sierra", "Summit", "Horizon", "Quantum", "Nexus", "Vector", "Titan", "Spectra", "Beacon", "Vanguard", "Pinnacle", "Crest", "Helix", "Synergy", "Infinity", "Stratford", "Keystone"];
const middles = ["Systems", "Dynamics", "Synergy", "Capital", "Holdings", "Networks", "Labs", "Resources", "Strategies", "Global", "Solutions", "Services", "Technologies", "Enterprises"];
const suffixes = ["Inc", "Corp", "Ltd", "Group", "LLC", "Partners"];

const PER_CATEGORY = 460; // 460 per category Ã— 20 = 9,200

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

  console.log(`Starting generation of 9,200 major fortune-500 enterprise businesses (employee range: 5001-10000, ${PER_CATEGORY} per category)...`);

  const hqCities = ["New York, USA", "London, UK", "Chicago, USA", "Los Angeles, USA", "Toronto, Canada", "Sydney, Australia", "Miami, USA", "Austin, USA", "Berlin, Germany", "Singapore", "Dallas, USA", "Denver, USA", "Seattle, USA", "Boston, USA", "San Diego, USA"];
  const revList = ["$5B - $10B", "$10B+"];

  for (const category of categories) {
    console.log(`Generating ${PER_CATEGORY} companies for: ${category}`);

    const companiesToInsert: any[] = [];
    for (let i = 0; i < PER_CATEGORY; i++) {
      const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
      const mid = middles[Math.floor(Math.random() * middles.length)];
      const suf = suffixes[Math.floor(Math.random() * suffixes.length)];

      const name = `${pre} ${mid} ${suf} ${i + 800000}`;
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
        description: `A prestigious global conglomerate specializing in ${category}.`,
        domain,
        website: `https://${domain}`,
        founded: `201${i % 10}`,
        employeeRange: "5001-10000",
        headquarters: hq,
        region,
        revenueRange: revList[i % 2],
        engagementScore: Math.floor(Math.random() * 8) + 92, // 92-99 score (absolute premium global leader range)
        trustSignals: "Verified Fortune-500 Mega-Conglomerate",
        tags: "Enterprise, Fortune-500, Global-Mega, Verified",
        email: `corporate@${domain}`,
        phone: `+1 800-555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        highlights: "Unmatched global footprint, Strategic market architect",
        insights: "Conglomerate key account target priority, Prime enterprise match"
      });
    }

    // Insert in chunks of 460
    const CHUNK = 460;
    for (let c = 0; c < companiesToInsert.length; c += CHUNK) {
      await prisma.company.createMany({ data: companiesToInsert.slice(c, c + CHUNK) });
    }
    console.log(`âœ“ Done: ${PER_CATEGORY} for ${category}`);
  }

  const total = await prisma.company.count();
  console.log(`\nSuccessfully seeded 9,200 new 5001-10000 companies!`);
  console.log(`Total companies in database: ${total}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });



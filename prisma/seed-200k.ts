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

const prefixes = ["Local", "Elite", "Prime", "Core", "First", "Swift", "Pro", "Dependable", "True", "Urban", "Metro", "Value", "Direct", "Star", "Apex", "Summit", "Nexus", "Global", "Regional"];
const middles = ["Services", "Solutions", "Group", "Partners", "Associates", "Works", "Studio", "Agency", "Consulting", "Providers", "Enterprises", "Ventures", "Concepts", "Systems"];
const suffixes = ["LLC", "Inc", "Co.", "Associates", "Partners", "Group"];

async function main() {
  console.log("Creating default workspace...");
  let workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Default Workspace",
        region: "US"
      }
    });
  }
  
  const workspaceId = workspace.id;
  console.log(`Using Workspace ID: ${workspaceId}`);
  console.log("Starting generation of 200,000 small businesses...");

  for (const category of categories) {
    console.log(`Generating 10,000 companies for: ${category}`);
    const companiesToInsert: any[] = [];
    
    for (let i = 0; i < 10000; i++) {
      const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
      const mid = middles[Math.floor(Math.random() * middles.length)];
      const suf = suffixes[Math.floor(Math.random() * suffixes.length)];
      
      const name = `${pre} ${mid} ${suf}`;
      let domainBase = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (domainBase.length > 15) {
          domainBase = domainBase.substring(0, 15);
      }
      const tld = i % 3 === 0 ? '.net' : (i % 4 === 0 ? '.co' : '.com');
      const domain = domainBase + tld;
      
      const hqCities = ["New York, USA", "London, UK", "Chicago, USA", "Los Angeles, USA", "Toronto, Canada", "Sydney, Australia", "Miami, USA", "Austin, USA", "Berlin, Germany", "Singapore"];
      const hq = hqCities[Math.floor(Math.random() * hqCities.length)];
      
      const region = inferCompanyRegion(hq) ?? "Americas";
      
      const revList = ["< $1M", "$1M - $5M"];
      const rev = revList[i % revList.length];
      
      const score = Math.floor(Math.random() * 30) + 40; // 40-69 for smaller businesses
      
      companiesToInsert.push({
        workspaceId,
        name,
        category,
        description: `A fast-growing small business specializing in ${category}.`,
        domain,
        website: `https://${domain}`,
        founded: `201${i % 10}`,
        employeeRange: "1-10",
        headquarters: hq,
        region,
        revenueRange: rev,
        engagementScore: score,
        trustSignals: "Local Business Leader",
        tags: "Small Business, Local",
        email: `contact@${domain}`,
        phone: `+1 800-555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        highlights: "Growing local footprint",
        insights: "Expanding service offerings"
      });
    }
    
    // Chunk insert to avoid memory issues
    const chunkSize = 2000;
    for (let i = 0; i < companiesToInsert.length; i += chunkSize) {
      const chunk = companiesToInsert.slice(i, i + chunkSize);
      await prisma.company.createMany({
        data: chunk
      });
    }
    console.log(`Inserted 10,000 for ${category}.`);
  }
  
  console.log("Successfully seeded 200,000 small businesses!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



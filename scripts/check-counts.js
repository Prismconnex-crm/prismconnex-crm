const { PrismaClient } = require("../lib/generated/sqlite-client");
const prisma = new PrismaClient();

async function main() {
  const indiaCount = await prisma.company.count({ where: { headquarters: { contains: "India" } } });
  console.log("India HQ count:", indiaCount);
  
  const mumbaiCount = await prisma.company.count({ where: { headquarters: { contains: "Mumbai" } } });
  console.log("Mumbai HQ count:", mumbaiCount);
  
  const itCount = await prisma.company.count({ where: { category: "information technology & services" } });
  console.log("IT&S category count:", itCount);
  
  // Check a sample of headquarters values
  const sample = await prisma.company.findMany({ 
    where: { category: "information technology & services" },
    select: { headquarters: true },
    distinct: ["headquarters"],
    take: 30 
  });
  console.log("Sample HQ values:", sample.map(s => s.headquarters));
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

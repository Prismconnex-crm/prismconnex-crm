const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking domains in the database...");
  
  // Total companies
  const total = await prisma.company.count();
  
  // Dummy domains (contains 4 or more digits)
  // We use raw SQL with GLOB
  const dummyCountResult = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM Company 
    WHERE domain GLOB '*[0-9][0-9][0-9][0-9]*'
  `;
  
  const dummyCount = Number(dummyCountResult[0].count);
  const realCount = total - dummyCount;
  
  console.log(`Total companies: ${total}`);
  console.log(`Companies with official/real domains: ${realCount}`);
  console.log(`Companies with dummy generated domains: ${dummyCount}`);
  
  // Check FidensGen
  const fidensGen = await prisma.company.findFirst({
    where: { name: { contains: 'FidensGen' } }
  });
  if (fidensGen) {
    console.log(`\nFound FidensGen:`);
    console.log(`Name: ${fidensGen.name}`);
    console.log(`Domain: ${fidensGen.domain}`);
    console.log(`Website: ${fidensGen.website}`);
  } else {
    console.log(`\nFidensGen not found.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

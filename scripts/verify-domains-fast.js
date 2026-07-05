const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking domains in the database (faster query)...");
  
  // Total companies
  const total = await prisma.company.count();
  console.log(`Total companies: ${total}`);
  
  // Try counting specific pattern matches directly
  // Real domains don't end in 4+ digits before the TLD
  const dummyCountResult = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM Company 
    WHERE domain LIKE '%[0-9][0-9][0-9][0-9]%.%'
  `;
  
  // Check FidensGen to see its exact data
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

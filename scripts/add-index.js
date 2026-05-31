const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log('Creating index...');
  
  // Use WAL mode to handle concurrent access
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 30000;");
  
  // Create index to make category and engagement score fetching lightning fast
  await prisma.$queryRawUnsafe('CREATE INDEX IF NOT EXISTS idx_category_engagementScore ON Company(category, engagementScore DESC);');
  
  console.log('Index created!');
  await prisma.$disconnect();
}

main().catch(console.error);

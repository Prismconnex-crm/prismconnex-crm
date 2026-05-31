const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({ log: ["error"] });

async function main() {
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 30000;");
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");

  console.log("Updating BigHaat category from 'food & beverages' to 'agriculture'...");
  const updated = await prisma.$executeRawUnsafe(`
    UPDATE Company SET category = 'agriculture' WHERE domain = 'bighaat.com'
  `);
  console.log("Rows updated:", updated);

  await prisma.$disconnect();
  console.log("✅ Done!");
}

main().catch(e => { console.error("Failed:", e); process.exit(1); });

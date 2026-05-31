const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({ log: ["error"] });

async function main() {
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 30000;");
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");

  // Bump TCS and Infosys above FidensGen so FidensGen lands at position 3-4
  // TCS -> 102 (position 1)
  // Infosys -> 101 (position 2)
  // FidensGen stays at 100 (position 3)
  // Wipro and others remain at 99 (position 4+)

  console.log("Setting TCS to score 102...");
  const r1 = await prisma.$executeRawUnsafe(`
    UPDATE Company SET engagementScore = 102 WHERE domain = 'tcs.com'
  `);
  console.log("TCS rows updated:", r1);

  console.log("Setting Infosys to score 101...");
  const r2 = await prisma.$executeRawUnsafe(`
    UPDATE Company SET engagementScore = 101 WHERE domain = 'infosys.com'
  `);
  console.log("Infosys rows updated:", r2);

  // FidensGen is already at 100, confirm
  console.log("\nVerifying top 6 companies by engagementScore...");
  const top = await prisma.$queryRawUnsafe(`
    SELECT name, engagementScore, category, domain
    FROM Company
    ORDER BY engagementScore DESC
    LIMIT 6
  `);
  top.forEach((c, i) => {
    const name = c.name.replace(/\s+\d+$/, '');
    console.log(`  ${i+1}. ${name} (score: ${c.engagementScore}, domain: ${c.domain})`);
  });

  await prisma.$disconnect();
  console.log("\n✅ Done! FidensGen should now be at position 3.");
}

main().catch(e => { console.error("Failed:", e); process.exit(1); });

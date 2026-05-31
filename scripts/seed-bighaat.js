const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({ log: ["error"] });

async function main() {
  console.log("Fetching workspace...");
  const workspace = await prisma.workspace.findFirst();
  if (!workspace) { console.error("No workspace!"); process.exit(1); }
  const wid = workspace.id;
  console.log("Workspace:", wid);

  // Set WAL mode and busy_timeout
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 30000;");
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");

  // Check if BigHaat already exists
  const existing = await prisma.company.findFirst({
    where: { domain: "bighaat.com", workspaceId: wid },
  });

  if (existing) {
    console.log(`BigHaat already exists (id: ${existing.id}). Ensuring score is high...`);
    await prisma.company.update({
      where: { id: existing.id },
      data: { engagementScore: 100, category: 'food & beverages' },
    });
    console.log("✅ Updated successfully!");
    await prisma.$disconnect();
    return;
  }

  // Generate a unique ID
  const id = "bighaat-" + Date.now();
  const now = new Date().toISOString();

  // Direct raw SQL insert
  console.log("Inserting BigHaat via raw SQL...");
  await prisma.$executeRawUnsafe(`
    INSERT INTO Company (
      id, workspaceId, name, category, description, domain, website,
      founded, employeeRange, headquarters, region, revenueRange,
      engagementScore, trustSignals, tags, email, phone,
      highlights, insights, createdAt, updatedAt
    ) VALUES (
      '${id}',
      '${wid}',
      'BigHaat',
      'food & beverages',
      'BigHaat is an Indian agri-commerce company empowering farmers with agricultural inputs, technology, and advisory. It is one of the largest online platforms for agriculture products.',
      'bighaat.com',
      'https://www.bighaat.com',
      '2015',
      '201-500',
      'Bangalore, India',
      'Asia-Pacific',
      '$10M - $50M',
      100,
      'Verified Domain, Active E-commerce Platform',
      'Agriculture, Agri-Tech, E-commerce, Food & Beverages, Farming',
      'info@bighaat.com',
      '+91 80 4716 9999',
      'India''s leading Agri Digital Platform, Empowers millions of farmers',
      'Strong growth in digital agriculture and direct-to-farmer ecommerce',
      '${now}',
      '${now}'
    )
  `);

  console.log("✅ BigHaat seeded successfully!");
  await prisma.$disconnect();
}

main().catch(e => { console.error("Seed failed:", e); process.exit(1); });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

async function main() {
  // Find the default workspace
  const workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    console.error("No workspace found. Please seed a workspace first.");
    process.exit(1);
  }

  // Check if FidensGen already exists
  const existing = await prisma.company.findFirst({
    where: {
      domain: "fidensgen.com",
      workspaceId: workspace.id,
    },
  });

  if (existing) {
    // Update engagement score to ensure it appears at position 3-4
    await prisma.company.update({
      where: { id: existing.id },
      data: { engagementScore: 99 },
    });
    console.log(`FidensGen already exists (id: ${existing.id}). Updated engagementScore to 99.`);
    return;
  }

  const company = await prisma.company.create({
    data: {
      workspaceId: workspace.id,
      name: "FidensGen Business Solutions Private Limited",
      category: "information technology & services",
      description:
        "FidensGen Business Solutions Private Limited is a B2B connecting platform that provides comprehensive business solutions, IT services, and digital transformation consulting to enterprises globally.",
      domain: "fidensgen.com",
      website: "https://fidensgen.com",
      founded: "2020",
      employeeRange: "21-50",
      headquarters: "India",
      region: "Asia-Pacific",
      revenueRange: "$1M - $10M",
      engagementScore: 99,
      trustSignals: "Verified Domain, Active Website, B2B Platform",
      tags: "B2B, IT Services, Business Solutions, Digital Transformation, Consulting",
      email: "info@fidensgen.com",
      phone: "+91 000 000 0000",
      highlights:
        "B2B connecting platform, Comprehensive business solutions, IT services provider",
      insights:
        "Growing B2B platform with strong digital transformation consulting capabilities",
    },
  });

  console.log(`✅ FidensGen seeded successfully! ID: ${company.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Database...");

  // Clear DB in dependency order
  await prisma.auditLog.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.event.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.workspaceSettings.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  // Create User
  const user = await prisma.user.create({
    data: {
      email: "demo@prismconnex.com",
      name: "Demo Admin",
    },
  });

  // Create Workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: "Demo Solutions Ltd.",
      region: "EU",
    },
  });

  // Create Membership (ADMIN)
  await prisma.membership.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      role: "ADMIN",
    },
  });

  // Create Settings
  await prisma.workspaceSettings.create({
    data: {
      workspaceId: workspace.id,
      showDualTime: true,
    },
  });

  console.log("Seed completed: Created 1 Workspace, 1 Admin User");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

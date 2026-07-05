import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
  });
}

// Ensure global.prisma is set in dev
if (process.env.NODE_ENV !== "production") {
  if (!global.prisma) {
    global.prisma = createPrismaClient();
  }
}

const client = global.prisma || createPrismaClient();

export const prisma = client;

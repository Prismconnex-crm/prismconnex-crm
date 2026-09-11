import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    log: ["error"],
  });
}

/**
 * One PrismaClient per process — in EVERY environment, not just development.
 *
 * The previous version memoized on globalThis only when NODE_ENV !== "production"
 * and fell through to `global.prisma || createPrismaClient()` otherwise, so a
 * production evaluation of this module built a fresh client that nothing ever
 * disconnected. Sixteen modules import this file and Next bundles route handlers
 * separately, so a built server (and every Vercel lambda) ended up with several
 * clients, each claiming up to `connection_limit` Supavisor connections and
 * holding them for the life of the process. That is what exhausts the Postgres
 * connection slots behind the pooler — at which point Supavisor can no longer
 * authenticate new sessions and *everything* that needs a fresh connection,
 * including the Supabase Table Editor, fails with a connection timeout.
 *
 * globalThis survives Next's dev-server HMR module re-evaluation as well, so the
 * same assignment fixes the dev-side leak that HMR would otherwise cause.
 */
export const prisma: PrismaClient = globalThis.prisma ?? createPrismaClient();

globalThis.prisma = prisma;

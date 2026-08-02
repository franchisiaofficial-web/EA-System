import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForAuthPrisma = globalThis as unknown as {
  authPrisma: PrismaClient | undefined;
};

function createAuthPrismaClient() {
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error(
      'DIRECT_URL environment variable is not set. Auth client requires a trusted privileged connection.'
    );
  }
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.PRISMA_POOL_MAX) || 3,
  });
  return new PrismaClient({ adapter });
}

export const authPrisma =
  globalForAuthPrisma.authPrisma ?? createAuthPrismaClient();

if (process.env.NODE_ENV !== 'production')
  globalForAuthPrisma.authPrisma = authPrisma;

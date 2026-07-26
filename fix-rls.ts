/**
 * RLS Cleanup — Remove temporary debugging policies applied to auth tables.
 *
 * Background:
 *   Sprint 2 debugging introduced temporary permissive policies on sessions,
 *   accounts, and verifications to work around RLS violations that occurred
 *   because BetterAuth used the RLS-enforced application Prisma client.
 *
 *   The proper fix (Decision 13) creates a dedicated auth Prisma client
 *   using DIRECT_URL for BetterAuth, so these temporary bypass policies
 *   are no longer needed and must be removed.
 *
 * Usage:
 *   npx tsx fix-rls.ts
 */
import 'dotenv/config';
import { PrismaClient } from './src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const p = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  const drops = [
    'DROP POLICY IF EXISTS "insert session" ON sessions',
    'DROP POLICY IF EXISTS "delete own session" ON sessions',
    'DROP POLICY IF EXISTS "update own session" ON sessions',
    'DROP POLICY IF EXISTS "insert account" ON accounts',
    'DROP POLICY IF EXISTS "update own account" ON accounts',
    'DROP POLICY IF EXISTS "delete own account" ON accounts',
    'DROP POLICY IF EXISTS "select account for authentication" ON accounts',
    'DROP POLICY IF EXISTS "insert verification" ON verifications',
    'DROP POLICY IF EXISTS "select verification" ON verifications',
    'DROP POLICY IF EXISTS "delete verification" ON verifications',
    'DROP POLICY IF EXISTS "select user for authentication" ON users',
  ];

  for (const sql of drops) {
    console.log(sql);
    await p.$executeRawUnsafe(sql);
  }

  console.log('\nAll temporary debugging RLS policies removed.');
  console.log('BetterAuth now uses a dedicated auth client (DIRECT_URL).');
  console.log('See: DECISIONS.md — Decision 13');

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

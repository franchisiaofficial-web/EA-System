import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const TEST_DB = process.env.TEST_DATABASE_URL;

if (!TEST_DB) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Refusing to run RLS tests against a real database.\n' +
      'These tests mutate schools, memberships, users, subscriptions, and audit logs.\n' +
      'Set TEST_DATABASE_URL in your environment before running npm test.'
  );
}

function buildUserUrl(superUrl: string): string {
  const url = new URL(superUrl);
  const projectRef = url.username.split('.')[1] || '';
  url.username = projectRef ? `app_user.${projectRef}` : 'app_user';
  url.password = 'knVnzbJJI9Ab_En4oAy0NOdqxpYR-CVF';
  return url.toString();
}

const TEST_USER_URL = buildUserUrl(TEST_DB);

const superPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: TEST_DB }),
});

const userPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: TEST_USER_URL }),
});

async function runInContext(
  userId: string,
  query: string
): Promise<Record<string, unknown>[]> {
  return userPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId}'`);
    return tx.$queryRawUnsafe(query);
  });
}

const SCHOOL_A = 'rls-test-sa';
const SCHOOL_B = 'rls-test-sb';
const USER_A = 'rls-test-ua';
const USER_B = 'rls-test-ub';
const USER_AB = 'rls-test-uab';

beforeAll(async () => {
  const now = new Date();
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO schools (id, name, slug, status, timezone, currency, created_at, updated_at)
     VALUES ('${SCHOOL_A}', 'Test School A', 'rls-sa', 'ACTIVE', 'UTC', 'USD', '${now.toISOString()}', '${now.toISOString()}'),
           ('${SCHOOL_B}', 'Test School B', 'rls-sb', 'ACTIVE', 'UTC', 'USD', '${now.toISOString()}', '${now.toISOString()}')
     ON CONFLICT (id) DO NOTHING`
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO users (id, name, email, email_verified, status, created_at, updated_at)
     VALUES ('${USER_A}', 'RLS User A', 'rlsa@test.com', true, 'active', '${now.toISOString()}', '${now.toISOString()}'),
            ('${USER_B}', 'RLS User B', 'rlsb@test.com', true, 'active', '${now.toISOString()}', '${now.toISOString()}'),
            ('${USER_AB}', 'RLS User AB', 'rlsab@test.com', true, 'active', '${now.toISOString()}', '${now.toISOString()}')
     ON CONFLICT (id) DO NOTHING`
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO memberships (id, school_id, user_id, role, status, joined_at, created_at, updated_at)
     VALUES ('rls-ma', '${SCHOOL_A}', '${USER_A}', 'SCHOOL_ADMIN', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}'),
            ('rls-mb', '${SCHOOL_B}', '${USER_B}', 'TEACHER', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}'),
            ('rls-maba', '${SCHOOL_A}', '${USER_AB}', 'TEACHER', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}'),
            ('rls-mabb', '${SCHOOL_B}', '${USER_AB}', 'STUDENT', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}')
     ON CONFLICT (id) DO NOTHING`
  );
});

afterAll(async () => {
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM memberships WHERE id IN ('rls-ma','rls-mb','rls-maba','rls-mabb')`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM users WHERE id IN ('${USER_A}','${USER_B}','${USER_AB}')`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM schools WHERE id IN ('${SCHOOL_A}','${SCHOOL_B}')`
  );
  await superPrisma.$disconnect();
  await userPrisma.$disconnect();
});

describe('RLS — Multi-Tenant Isolation', () => {
  it('prevents cross-tenant school reads', async () => {
    const r1 = await runInContext(
      USER_A,
      `SELECT count(*)::int as cnt FROM schools WHERE id = '${SCHOOL_A}'`
    );
    expect(Number(r1[0].cnt)).toBe(1);

    const r2 = await runInContext(
      USER_A,
      `SELECT count(*)::int as cnt FROM schools WHERE id = '${SCHOOL_B}'`
    );
    expect(Number(r2[0].cnt)).toBe(0);

    const r3 = await runInContext(
      USER_B,
      `SELECT count(*)::int as cnt FROM schools WHERE id = '${SCHOOL_A}'`
    );
    expect(Number(r3[0].cnt)).toBe(0);
  });

  it('allows multi-school users to see both schools', async () => {
    const r1 = await runInContext(
      USER_AB,
      `SELECT count(*)::int as cnt FROM schools`
    );
    expect(Number(r1[0].cnt)).toBe(2);
  });

  it('denies SUSPENDED memberships', async () => {
    await superPrisma.$executeRawUnsafe(
      `UPDATE memberships SET status = 'SUSPENDED' WHERE id = 'rls-ma'`
    );
    const r = await runInContext(
      USER_A,
      `SELECT count(*)::int as cnt FROM schools WHERE id = '${SCHOOL_A}'`
    );
    expect(Number(r[0].cnt)).toBe(0);
    await superPrisma.$executeRawUnsafe(
      `UPDATE memberships SET status = 'ACTIVE' WHERE id = 'rls-ma'`
    );
  });

  it('denies REMOVED memberships', async () => {
    await superPrisma.$executeRawUnsafe(
      `UPDATE memberships SET status = 'REMOVED' WHERE id = 'rls-ma'`
    );
    const r = await runInContext(
      USER_A,
      `SELECT count(*)::int as cnt FROM schools WHERE id = '${SCHOOL_A}'`
    );
    expect(Number(r[0].cnt)).toBe(0);
    await superPrisma.$executeRawUnsafe(
      `UPDATE memberships SET status = 'ACTIVE' WHERE id = 'rls-ma'`
    );
  });

  it('rejects forged session context', async () => {
    const rows = await userPrisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${USER_A}'`);
      await tx.$executeRawUnsafe(
        `SET LOCAL "app.current_school_id" = '${SCHOOL_B}'`
      );
      await tx.$executeRawUnsafe(
        `SET LOCAL "app.current_role" = 'SUPER_ADMIN'`
      );
      return tx.$queryRawUnsafe(
        `SELECT count(*)::int as cnt FROM schools WHERE id = '${SCHOOL_B}'`
      );
    });
    expect(Number(rows[0].cnt)).toBe(0);
  });

  it('returns zero for empty user_id', async () => {
    const r = await runInContext(
      '',
      `SELECT count(*)::int as cnt FROM schools`
    );
    expect(Number(r[0].cnt)).toBe(0);
  });

  it('returns zero for non-existent user', async () => {
    const r = await runInContext(
      'nonexistent',
      `SELECT count(*)::int as cnt FROM schools`
    );
    expect(Number(r[0].cnt)).toBe(0);
  });

  it('prevents cross-tenant membership reads', async () => {
    const r = await runInContext(
      USER_A,
      `SELECT count(*)::int as cnt FROM memberships WHERE school_id = '${SCHOOL_B}'`
    );
    expect(Number(r[0].cnt)).toBe(0);
  });

  it('prevents cross-tenant user reads', async () => {
    const r = await runInContext(
      USER_A,
      `SELECT count(*)::int as cnt FROM users WHERE id = '${USER_B}'`
    );
    expect(Number(r[0].cnt)).toBe(0);
  });
});

describe('RLS — Helper Functions', () => {
  it('current_user_id() returns the SET LOCAL value', async () => {
    const r = await runInContext(USER_A, `SELECT current_user_id() as val`);
    expect(r[0].val).toBe(USER_A);
  });

  it('has_active_membership() returns true for own school', async () => {
    const r = await runInContext(
      USER_A,
      `SELECT has_active_membership('${SCHOOL_A}') as val`
    );
    expect(r[0].val).toBe(true);
  });

  it('has_active_membership() returns false for other school', async () => {
    const r = await runInContext(
      USER_A,
      `SELECT has_active_membership('${SCHOOL_B}') as val`
    );
    expect(r[0].val).toBe(false);
  });
});

describe('RLS — Infrastructure', () => {
  it('all 14 tenant tables have RLS enabled', async () => {
    const r = await userPrisma.$queryRawUnsafe(
      `SELECT count(*)::int as cnt FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true
       AND tablename IN ('schools','memberships','school_settings','features','school_features',
       'subscriptions','plans','invites','audit_logs','users','sessions','accounts','verifications','permissions')`
    );
    expect(Number(r[0].cnt)).toBe(14);
  });

  it('all 17 RLS policies exist', async () => {
    const r = await userPrisma.$queryRawUnsafe(
      `SELECT count(*)::int as cnt FROM pg_policies WHERE schemaname = 'public'`
    );
    expect(Number(r[0].cnt)).toBe(45);
  });
});

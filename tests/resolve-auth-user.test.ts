/**
 * resolveAuthUser() — Unit Tests
 *
 * Tests the shared authentication resolver against the seeded database.
 * Uses DIRECT_URL (privileged connection) to create/clean up test data.
 *
 * Usage: npx vitest run tests/resolve-auth-user.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const DIRECT_URL = process.env.DIRECT_URL;
if (!DIRECT_URL) throw new Error('DIRECT_URL is not set in .env');

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DIRECT_URL }),
});

const PREFIX = 'raut_';

const SCHOOL_A = `${PREFIX}sa`;
const SCHOOL_B = `${PREFIX}sb_susp`;
const SCHOOL_C = `${PREFIX}sc_arch`;
const USER_ACTIVE = `${PREFIX}ua`;
const USER_DISABLED = `${PREFIX}ud`;
const USER_NO_MEM = `${PREFIX}un`;
const USER_MULTI = `${PREFIX}um`;
const USER_SUSP = `${PREFIX}us`;
const USER_ARCH = `${PREFIX}ua2`;

const MEM_A = `${PREFIX}ma`;
const MEM_MULTI_OLD = `${PREFIX}mo`;
const MEM_MULTI_NEW = `${PREFIX}mn`;
const MEM_SUSP = `${PREFIX}ms`;
const MEM_ARCH = `${PREFIX}ma2`;

beforeAll(async () => {
  const now = new Date();
  const old = new Date(now.getTime() - 86400000 * 30);
  const recent = new Date(now.getTime() - 86400000);

  const sql = `
    INSERT INTO schools (id, name, slug, status, timezone, currency, created_at, updated_at) VALUES
      ('${SCHOOL_A}',  'Resolver School A', '${SCHOOL_A}',  'ACTIVE',    'UTC', 'USD', '${now.toISOString()}', '${now.toISOString()}'),
      ('${SCHOOL_B}', 'Resolver School B', '${SCHOOL_B}', 'SUSPENDED', 'UTC', 'USD', '${now.toISOString()}', '${now.toISOString()}'),
      ('${SCHOOL_C}', 'Resolver School C', '${SCHOOL_C}', 'ARCHIVED',  'UTC', 'USD', '${now.toISOString()}', '${now.toISOString()}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO users (id, name, email, email_verified, status, created_at, updated_at) VALUES
      ('${USER_ACTIVE}',   'Active User',   '${USER_ACTIVE}@t.com',   true, 'active',   '${now.toISOString()}', '${now.toISOString()}'),
      ('${USER_DISABLED}', 'Disabled User', '${USER_DISABLED}@t.com', true, 'disabled', '${now.toISOString()}', '${now.toISOString()}'),
      ('${USER_NO_MEM}',   'NoMem User',    '${USER_NO_MEM}@t.com',   true, 'active',   '${now.toISOString()}', '${now.toISOString()}'),
      ('${USER_MULTI}',    'Multi User',    '${USER_MULTI}@t.com',    true, 'active',   '${now.toISOString()}', '${now.toISOString()}'),
      ('${USER_SUSP}',     'Susp User',     '${USER_SUSP}@t.com',     true, 'active',   '${now.toISOString()}', '${now.toISOString()}'),
      ('${USER_ARCH}',     'Arch User',     '${USER_ARCH}@t.com',     true, 'active',   '${now.toISOString()}', '${now.toISOString()}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO memberships (id, school_id, user_id, role, status, joined_at, created_at, updated_at) VALUES
      ('${MEM_A}',    '${SCHOOL_A}', '${USER_ACTIVE}', 'TEACHER',  'ACTIVE', '${now.toISOString()}',    '${now.toISOString()}',    '${now.toISOString()}'),
      ('${MEM_MULTI_OLD}', '${SCHOOL_A}', '${USER_MULTI}', 'STUDENT', 'ACTIVE', '${old.toISOString()}',    '${old.toISOString()}',    '${old.toISOString()}'),
      ('${MEM_MULTI_NEW}', '${SCHOOL_A}', '${USER_MULTI}', 'TEACHER', 'ACTIVE', '${recent.toISOString()}', '${recent.toISOString()}', '${recent.toISOString()}'),
      ('${MEM_SUSP}', '${SCHOOL_B}', '${USER_SUSP}', 'TEACHER',  'ACTIVE', '${now.toISOString()}',    '${now.toISOString()}',    '${now.toISOString()}'),
      ('${MEM_ARCH}', '${SCHOOL_C}', '${USER_ARCH}', 'TEACHER',  'ACTIVE', '${now.toISOString()}',    '${now.toISOString()}',    '${now.toISOString()}')
    ON CONFLICT (id) DO NOTHING;
  `;

  for (const stmt of sql.split(';').filter((s) => s.trim())) {
    await db.$executeRawUnsafe(stmt.trim());
  }
});

afterAll(async () => {
  const sql = `
    DELETE FROM memberships WHERE id LIKE '${PREFIX}%';
    DELETE FROM users WHERE id LIKE '${PREFIX}%';
    DELETE FROM schools WHERE id LIKE '${PREFIX}%';
  `;
  for (const stmt of sql.split(';').filter((s) => s.trim())) {
    await db.$executeRawUnsafe(stmt.trim());
  }
  await db.$disconnect();
});

describe('resolveAuthUser', () => {
  let resolveAuthUser: typeof import('../src/lib/auth/resolve-auth-user').resolveAuthUser;

  beforeAll(async () => {
    const mod = await import('../src/lib/auth/resolve-auth-user');
    resolveAuthUser = mod.resolveAuthUser;
  });

  it('resolves active user with membership', async () => {
    const result = await resolveAuthUser(USER_ACTIVE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe(USER_ACTIVE);
      expect(result.membership.role).toBe('TEACHER');
    }
  });

  it('returns ACCOUNT_NOT_FOUND for non-existent user', async () => {
    const result = await resolveAuthUser(`${PREFIX}nonexistent`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('ACCOUNT_NOT_FOUND');
  });

  it('returns ACCOUNT_DISABLED for disabled user', async () => {
    const result = await resolveAuthUser(USER_DISABLED);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('ACCOUNT_DISABLED');
  });

  it('returns NO_ACTIVE_MEMBERSHIP for user without memberships', async () => {
    const result = await resolveAuthUser(USER_NO_MEM);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('NO_ACTIVE_MEMBERSHIP');
  });

  it('returns SCHOOL_SUSPENDED for user in suspended school', async () => {
    const result = await resolveAuthUser(USER_SUSP);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('SCHOOL_SUSPENDED');
  });

  it('returns SCHOOL_ARCHIVED for user in archived school', async () => {
    const result = await resolveAuthUser(USER_ARCH);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('SCHOOL_ARCHIVED');
  });

  it('selects the newest ACTIVE membership (descending joinedAt)', async () => {
    const result = await resolveAuthUser(USER_MULTI);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.membership.role).toBe('TEACHER');
      expect(result.membership.id).toBe(MEM_MULTI_NEW);
    }
  });

  it('returns both memberships in the user payload (filter only active)', async () => {
    const result = await resolveAuthUser(USER_MULTI);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.memberships.length).toBe(2);
    }
  });
});

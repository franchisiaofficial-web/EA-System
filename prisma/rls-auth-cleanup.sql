-- ============================================
-- Auth RLS Cleanup — Remove Temporary Debugging Policies
-- ============================================
-- Run this to remove all policies created by the temporary fix-rls.ts script.
-- These policies were an incorrect workaround for BetterAuth RLS violations
-- and are no longer needed because BetterAuth now uses a dedicated trusted
-- Prisma client (DIRECT_URL) that bypasses RLS for auth operations.
--
-- Context: Decision 13 — Authentication Infrastructure Isolation
-- Date: 2026-07-26

-- sessions — remove temporary bypass policies
DROP POLICY IF EXISTS "insert session" ON sessions;
DROP POLICY IF EXISTS "delete own session" ON sessions;
DROP POLICY IF EXISTS "update own session" ON sessions;

-- accounts — remove temporary bypass policies
DROP POLICY IF EXISTS "insert account" ON accounts;
DROP POLICY IF EXISTS "update own account" ON accounts;
DROP POLICY IF EXISTS "delete own account" ON accounts;
DROP POLICY IF EXISTS "select account for authentication" ON accounts;

-- verifications — remove temporary bypass policies
DROP POLICY IF EXISTS "insert verification" ON verifications;
DROP POLICY IF EXISTS "select verification" ON verifications;
DROP POLICY IF EXISTS "delete verification" ON verifications;

-- users — remove temporary bypass policies
DROP POLICY IF EXISTS "select user for authentication" ON users;

-- The canonical policies in rls-policies.sql remain as the authoritative
-- RLS definitions for application (app_user) queries.

import { hasPermission } from '../../../src/lib/permissions/permissions';

/**
 * Phase 1.4 verification — Permission-matrix conformance.
 * Asserts hasPermission() output matches the APPROVED permission-matrix-v1.md
 * (staff resource matrix §2, payroll matrix §3) across every role × action.
 *
 * Notes:
 *  - HR `staff:manage` is documented as a shorthand cell (permission-matrix §2)
 *    but HR `staff:restore` is ✗ (delete-policy §4: Restore = SCHOOL_ADMIN only).
 *    Since manage = all actions by definition, HR is implemented with explicit
 *    actions (read/create/update/archive/export) and NO manage key, so
 *    hasPermission(HR, staff, manage) === false. We assert the binding rule:
 *    HR must NOT restore.
 *  - Payroll "Own/Others/Basic" scoping is enforced at the reader (future
 *    payroll endpoints), not by the permission map. This script asserts the
 *    permission-map grants only; the map must not grant more than the matrix.
 */

type Resource = Parameters<typeof hasPermission>[1];
type Action = Parameters<typeof hasPermission>[2];

const E = (role: string, resource: string, action: string) =>
  hasPermission(role, resource as Resource, action as Action);

type Check = { role: string; resource: string; action: string; expected: boolean; note?: string };

const STAFF = 'staff';
const PAYROLL = 'payroll';

const checks: Check[] = [];

// ---- Staff resource matrix (permission-matrix-v1 §2 + Phase 1.5 lifecycle actions) ----
const staffRoles: { role: string; read: boolean; create: boolean; update: boolean; archive: boolean; restore: boolean; deactivate: boolean; reactivate: boolean; export: boolean; manage: boolean; note?: string }[] = [
  { role: 'SUPER_ADMIN', read: true, create: true, update: true, archive: true, restore: true, deactivate: true, reactivate: true, export: true, manage: true },
  { role: 'SCHOOL_ADMIN', read: true, create: true, update: true, archive: true, restore: true, deactivate: true, reactivate: true, export: true, manage: true },
  { role: 'HR', read: true, create: true, update: true, archive: true, restore: false, deactivate: true, reactivate: true, export: true, manage: false, note: 'manage shorthand; restore is SCHOOL_ADMIN-only per delete policy' },
  { role: 'PRINCIPAL', read: true, create: true, update: true, archive: false, restore: false, deactivate: false, reactivate: false, export: true, manage: false },
  { role: 'VICE_PRINCIPAL', read: true, create: false, update: false, archive: false, restore: false, deactivate: false, reactivate: false, export: false, manage: false },
  { role: 'ACCOUNTANT', read: true, create: false, update: false, archive: false, restore: false, deactivate: false, reactivate: false, export: false, manage: false },
  { role: 'LIBRARIAN', read: true, create: false, update: false, archive: false, restore: false, deactivate: false, reactivate: false, export: false, manage: false },
  { role: 'TRANSPORT_MANAGER', read: true, create: false, update: false, archive: false, restore: false, deactivate: false, reactivate: false, export: false, manage: false },
  { role: 'NON_TEACHING', read: true, create: false, update: false, archive: false, restore: false, deactivate: false, reactivate: false, export: false, manage: false },
  { role: 'TEACHER', read: false, create: false, update: false, archive: false, restore: false, deactivate: false, reactivate: false, export: false, manage: false },
  { role: 'CLASS_TEACHER', read: false, create: false, update: false, archive: false, restore: false, deactivate: false, reactivate: false, export: false, manage: false },
  { role: 'DRIVER', read: false, create: false, update: false, archive: false, restore: false, deactivate: false, reactivate: false, export: false, manage: false },
  { role: 'CAFETERIA_STAFF', read: false, create: false, update: false, archive: false, restore: false, deactivate: false, reactivate: false, export: false, manage: false },
  { role: 'STUDENT', read: false, create: false, update: false, archive: false, restore: false, deactivate: false, reactivate: false, export: false, manage: false },
  { role: 'PARENT', read: false, create: false, update: false, archive: false, restore: false, deactivate: false, reactivate: false, export: false, manage: false },
];

for (const r of staffRoles) {
  checks.push({ role: r.role, resource: STAFF, action: 'read', expected: r.read, note: r.note });
  checks.push({ role: r.role, resource: STAFF, action: 'create', expected: r.create, note: r.note });
  checks.push({ role: r.role, resource: STAFF, action: 'update', expected: r.update, note: r.note });
  checks.push({ role: r.role, resource: STAFF, action: 'archive', expected: r.archive, note: r.note });
  checks.push({ role: r.role, resource: STAFF, action: 'restore', expected: r.restore, note: r.note });
  checks.push({ role: r.role, resource: STAFF, action: 'deactivate', expected: r.deactivate, note: r.note });
  checks.push({ role: r.role, resource: STAFF, action: 'reactivate', expected: r.reactivate, note: r.note });
  checks.push({ role: r.role, resource: STAFF, action: 'export', expected: r.export, note: r.note });
  checks.push({ role: r.role, resource: STAFF, action: 'manage', expected: r.manage, note: r.note });
}

// ---- Payroll matrix (permission-matrix-v1 §3) ----
const payrollRoles: { role: string; read: boolean; create: boolean; update: boolean; approve: boolean; export: boolean; manage: boolean }[] = [
  { role: 'SUPER_ADMIN', read: true, create: true, update: true, approve: true, export: true, manage: true },
  { role: 'SCHOOL_ADMIN', read: true, create: true, update: true, approve: true, export: true, manage: true },
  { role: 'HR', read: true, create: true, update: true, approve: false, export: false, manage: false },
  { role: 'ACCOUNTANT', read: true, create: false, update: false, approve: false, export: true, manage: false },
  { role: 'PRINCIPAL', read: true, create: false, update: false, approve: false, export: false, manage: false },
  { role: 'VICE_PRINCIPAL', read: false, create: false, update: false, approve: false, export: false, manage: false },
  { role: 'TEACHER', read: true, create: false, update: false, approve: false, export: false, manage: false },
  { role: 'CLASS_TEACHER', read: true, create: false, update: false, approve: false, export: false, manage: false },
  { role: 'NON_TEACHING', read: true, create: false, update: false, approve: false, export: false, manage: false },
  { role: 'LIBRARIAN', read: true, create: false, update: false, approve: false, export: false, manage: false },
  { role: 'TRANSPORT_MANAGER', read: true, create: false, update: false, approve: false, export: false, manage: false },
  { role: 'DRIVER', read: true, create: false, update: false, approve: false, export: false, manage: false },
  { role: 'CAFETERIA_STAFF', read: true, create: false, update: false, approve: false, export: false, manage: false },
  { role: 'STUDENT', read: false, create: false, update: false, approve: false, export: false, manage: false },
  { role: 'PARENT', read: false, create: false, update: false, approve: false, export: false, manage: false },
];

for (const r of payrollRoles) {
  checks.push({ role: r.role, resource: PAYROLL, action: 'read', expected: r.read });
  checks.push({ role: r.role, resource: PAYROLL, action: 'create', expected: r.create });
  checks.push({ role: r.role, resource: PAYROLL, action: 'update', expected: r.update });
  checks.push({ role: r.role, resource: PAYROLL, action: 'approve', expected: r.approve });
  checks.push({ role: r.role, resource: PAYROLL, action: 'export', expected: r.export });
  checks.push({ role: r.role, resource: PAYROLL, action: 'manage', expected: r.manage });
}

// ---- Teaching reader untouched (migration note §6.3: /api/teachers stays teachers:read) ----
checks.push({ role: 'PRINCIPAL', resource: 'teachers', action: 'read', expected: true, note: '/api/teachers reader retained' });
checks.push({ role: 'ACCOUNTANT', resource: 'teachers', action: 'read', expected: true, note: '/api/teachers reader retained' });

let failures = 0;
for (const c of checks) {
  const actual = E(c.role, c.resource, c.action);
  const ok = actual === c.expected;
  if (!ok) {
    failures++;
    console.log(`FAIL  ${c.role.padEnd(16)} ${c.resource}:${c.action.padEnd(8)} expected ${c.expected} got ${actual}${c.note ? `  (${c.note})` : ''}`);
  }
}

console.log(`\n${checks.length} assertions, ${failures} failure(s)`);
console.log(failures === 0 ? 'ALL PERMISSION CHECKS PASS' : 'FAILURES DETECTED');
process.exit(failures === 0 ? 0 : 1);

import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  getRolePermissions,
  getAllRoles,
} from '../src/lib/permissions/permissions';

describe('RBAC — Role Definitions', () => {
  it('defines all 15 roles', () => {
    expect(getAllRoles()).toHaveLength(15);
  });

  it.each([
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'VICE_PRINCIPAL',
    'HR',
    'ACCOUNTANT',
    'TEACHER',
    'CLASS_TEACHER',
    'NON_TEACHING',
    'LIBRARIAN',
    'TRANSPORT_MANAGER',
    'DRIVER',
    'CAFETERIA_STAFF',
    'STUDENT',
    'PARENT',
  ])('has role %s', (role) => {
    expect(getAllRoles()).toContain(role);
  });
});

describe('RBAC — Permission Checks', () => {
  it.each([
    ['TEACHER', 'students', 'delete', false],
    ['TEACHER', 'students', 'read', true],
    ['TEACHER', 'attendance', 'create', true],
    ['TEACHER', 'finance', 'manage', false],
    ['STUDENT', 'payroll', 'update', false],
    ['STUDENT', 'attendance', 'read', true],
    ['SCHOOL_ADMIN', 'teachers', 'manage', true],
    ['SCHOOL_ADMIN', 'settings', 'manage', true],
    ['SUPER_ADMIN', 'schools', 'manage', true],
    ['SUPER_ADMIN', 'features', 'manage', true],
    ['SUPER_ADMIN', 'subscriptions', 'manage', true],
    ['ACCOUNTANT', 'finance', 'manage', true],
    ['ACCOUNTANT', 'schools', 'manage', false],
    ['LIBRARIAN', 'library', 'manage', true],
    ['LIBRARIAN', 'finance', 'manage', false],
    ['PARENT', 'students', 'read', true],
    ['PARENT', 'students', 'update', false],
    ['HR', 'teachers', 'manage', true],
    ['HR', 'students', 'manage', false],
    ['DRIVER', 'transport', 'read', true],
    ['DRIVER', 'transport', 'manage', false],
    ['TRANSPORT_MANAGER', 'transport', 'manage', true],
    ['NON_EXISTENT', 'schools', 'read', false],
  ])('%s → %s %s → %s', (role, resource, action, expected) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(hasPermission(role, resource as any, action as any)).toBe(expected);
  });
});

describe('RBAC — getRolePermissions', () => {
  it('returns permissions for valid roles', () => {
    expect(getRolePermissions('TEACHER').length).toBeGreaterThan(0);
    expect(getRolePermissions('STUDENT').length).toBeGreaterThan(0);
    expect(getRolePermissions('SUPER_ADMIN').length).toBeGreaterThan(0);
  });

  it('returns empty for non-existent roles', () => {
    expect(getRolePermissions('NON_EXISTENT')).toEqual([]);
  });
});

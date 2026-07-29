import type { Role } from '@/generated/prisma/client';

type Action =
  'create' | 'read' | 'update' | 'delete' | 'approve' | 'export' | 'manage';

type Resource =
  | 'schools'
  | 'users'
  | 'students'
  | 'parents'
  | 'teachers'
  | 'attendance'
  | 'academics'
  | 'exams'
  | 'finance'
  | 'payroll'
  | 'transport'
  | 'library'
  | 'hostel'
  | 'communication'
  | 'reports'
  | 'inventory'
  | 'analytics'
  | 'settings'
  | 'invites'
  | 'features'
  | 'subscriptions'
  | 'audit_logs'
  | 'academic_years'
  | 'sections'
  | 'classes'
  | 'class_assignments'
  | 'class_enrollments'
  | 'parent_student_links'
  | 'attendance_records'
  | 'terms'
  | 'subjects';

type PermissionMap = Partial<Record<Action, boolean>>;
type RolePermissions = Partial<Record<Resource, PermissionMap>>;

const SUPER_ADMIN: RolePermissions = {
  schools: { manage: true, read: true, update: true, delete: true },
  users: { manage: true, read: true, create: true, update: true, delete: true },
  students: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
    export: true,
  },
  parents: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
    export: true,
  },
  teachers: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
    export: true,
  },
  attendance: {
    manage: true,
    read: true,
    create: true,
    update: true,
    export: true,
  },
  academics: { manage: true, read: true, create: true, update: true },
  exams: {
    manage: true,
    read: true,
    create: true,
    update: true,
    approve: true,
    export: true,
  },
  finance: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
    export: true,
  },
  payroll: {
    manage: true,
    read: true,
    create: true,
    update: true,
    approve: true,
    export: true,
  },
  transport: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  library: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  hostel: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  communication: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  reports: { manage: true, read: true, export: true },
  inventory: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  analytics: { manage: true, read: true, export: true },
  settings: { manage: true, read: true, update: true },
  invites: { manage: true, read: true, create: true, delete: true },
  features: { manage: true, read: true, update: true },
  subscriptions: { manage: true, read: true, update: true },
  audit_logs: { read: true, export: true },
  academic_years: { manage: true, read: true, create: true, update: true },
  terms: { manage: true, read: true, create: true, update: true },
  subjects: { manage: true, read: true, create: true, update: true },
  sections: { manage: true, read: true, create: true, update: true },
  classes: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  class_assignments: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  class_enrollments: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  parent_student_links: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  attendance_records: { manage: true, read: true, create: true, update: true },
};

const SCHOOL_ADMIN: RolePermissions = {
  schools: { read: true, update: true },
  users: { read: true, create: true, update: true, delete: true },
  students: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
    export: true,
  },
  parents: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
    export: true,
  },
  teachers: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
    export: true,
  },
  attendance: {
    manage: true,
    read: true,
    create: true,
    update: true,
    export: true,
  },
  academics: { manage: true, read: true, create: true, update: true },
  exams: {
    manage: true,
    read: true,
    create: true,
    update: true,
    approve: true,
    export: true,
  },
  finance: {
    manage: true,
    read: true,
    create: true,
    update: true,
    export: true,
  },
  payroll: {
    manage: true,
    read: true,
    create: true,
    update: true,
    approve: true,
    export: true,
  },
  transport: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  library: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  hostel: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  communication: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  reports: { manage: true, read: true, export: true },
  inventory: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  analytics: { manage: true, read: true, export: true },
  settings: { manage: true, read: true, update: true },
  invites: { manage: true, read: true, create: true, delete: true },
  features: { read: true },
  subscriptions: { read: true },
  audit_logs: { read: true, export: true },
  academic_years: { manage: true, read: true, create: true, update: true },
  terms: { manage: true, read: true, create: true, update: true },
  subjects: { manage: true, read: true, create: true, update: true },
  sections: { manage: true, read: true, create: true, update: true },
  classes: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  class_assignments: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  class_enrollments: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  parent_student_links: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  attendance_records: { manage: true, read: true, create: true, update: true },
};

const PRINCIPAL: RolePermissions = {
  schools: { read: true },
  users: { read: true },
  students: { read: true, create: true, update: true, export: true },
  parents: { read: true, create: true, update: true, export: true },
  teachers: { read: true, create: true, update: true, export: true },
  attendance: { read: true, create: true, update: true, export: true },
  academics: { read: true, create: true, update: true },
  exams: {
    read: true,
    create: true,
    update: true,
    approve: true,
    export: true,
  },
  finance: { read: true },
  payroll: { read: true },
  transport: { read: true, update: true },
  library: { read: true, create: true, update: true },
  hostel: { read: true, create: true, update: true },
  communication: { read: true, create: true, update: true },
  reports: { read: true, export: true },
  inventory: { read: true },
  analytics: { read: true, export: true },
  settings: { read: true },
  invites: { read: true, create: true },
  audit_logs: { read: true },
  academic_years: { read: true, create: true, update: true },
  terms: { read: true, create: true, update: true },
  subjects: { read: true, create: true, update: true },
  sections: { read: true, create: true, update: true },
  classes: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  class_assignments: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  class_enrollments: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  parent_student_links: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  attendance_records: { manage: true, read: true, create: true, update: true },
};

// PRINCIPAL end
const VICE_PRINCIPAL: RolePermissions = {
  schools: { read: true },
  students: { read: true, create: true, update: true },
  parents: { read: true },
  teachers: { read: true },
  attendance: { read: true, create: true, update: true, export: true },
  academics: { read: true, create: true, update: true },
  exams: { read: true, create: true, update: true, export: true },
  communication: { read: true, create: true },
  reports: { read: true, export: true },
  analytics: { read: true },
  academic_years: { read: true },
  terms: { read: true },
  subjects: { read: true },
  sections: { read: true },
  classes: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  class_assignments: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  class_enrollments: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  parent_student_links: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  attendance_records: { manage: true, read: true, create: true, update: true },
};

const TEACHER: RolePermissions = {
  students: { read: true },
  parents: { read: true },
  attendance: { read: true, create: true, update: true },
  academics: { read: true, create: true, update: true },
  exams: { read: true, create: true, update: true },
  communication: { read: true, create: true },
  reports: { read: true },
  classes: { read: true },
  class_assignments: { read: true },
  class_enrollments: { read: true },
  parent_student_links: { read: true },
  attendance_records: { read: true, create: true, update: true },
};

const CLASS_TEACHER: RolePermissions = {
  students: { read: true, update: true },
  parents: { read: true },
  attendance: { read: true, create: true, update: true, export: true },
  academics: { read: true, create: true, update: true },
  exams: { read: true, create: true, update: true },
  communication: { read: true, create: true },
  reports: { read: true, export: true },
  classes: { read: true, update: true },
  class_assignments: { read: true },
  class_enrollments: { read: true },
  parent_student_links: { read: true },
  attendance_records: { read: true, create: true, update: true },
};

const ACCOUNTANT: RolePermissions = {
  students: { read: true },
  parents: { read: true },
  teachers: { read: true },
  finance: {
    manage: true,
    read: true,
    create: true,
    update: true,
    export: true,
  },
  payroll: {
    manage: true,
    read: true,
    create: true,
    update: true,
    approve: true,
    export: true,
  },
  reports: { read: true, export: true },
  analytics: { read: true },
};

const HR: RolePermissions = {
  teachers: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
    export: true,
  },
  parents: { read: true },
  students: { read: true },
  payroll: {
    manage: true,
    read: true,
    create: true,
    update: true,
    export: true,
  },
  reports: { read: true, export: true },
};

const LIBRARIAN: RolePermissions = {
  students: { read: true },
  teachers: { read: true },
  library: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
};

const TRANSPORT_MANAGER: RolePermissions = {
  students: { read: true },
  parents: { read: true },
  teachers: { read: true },
  transport: {
    manage: true,
    read: true,
    create: true,
    update: true,
    delete: true,
  },
};

const DRIVER: RolePermissions = {
  transport: { read: true },
  communication: { read: true },
};

const NON_TEACHING: RolePermissions = {
  students: { read: true },
  parents: { read: true },
  teachers: { read: true },
  communication: { read: true, create: true },
};

const CAFETERIA_STAFF: RolePermissions = {
  students: { read: true },
  communication: { read: true },
};

const STUDENT: RolePermissions = {
  students: { read: true },
  attendance: { read: true },
  academics: { read: true },
  exams: { read: true },
  communication: { read: true, create: true },
  library: { read: true },
  transport: { read: true },
  classes: { read: true },
  class_enrollments: { read: true },
  parent_student_links: { read: true },
  attendance_records: { read: true },
};

const PARENT: RolePermissions = {
  students: { read: true },
  attendance: { read: true },
  academics: { read: true },
  exams: { read: true },
  finance: { read: true },
  communication: { read: true, create: true },
  transport: { read: true },
  classes: { read: true },
  class_enrollments: { read: true },
  parent_student_links: { read: true },
  attendance_records: { read: true },
};

const ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  SUPER_ADMIN,
  SCHOOL_ADMIN,
  PRINCIPAL,
  VICE_PRINCIPAL,
  TEACHER,
  CLASS_TEACHER,
  ACCOUNTANT,
  HR,
  LIBRARIAN,
  TRANSPORT_MANAGER,
  DRIVER,
  NON_TEACHING,
  CAFETERIA_STAFF,
  STUDENT,
  PARENT,
};

export function hasPermission(
  role: string,
  resource: Resource,
  action: Action
): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;

  const resourcePerms = perms[resource];
  if (!resourcePerms) return false;

  if (resourcePerms.manage) return true;

  return resourcePerms[action] === true;
}

export function getRolePermissions(
  role: string
): Array<{ resource: Resource; actions: Action[] }> {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return [];

  const result: Array<{ resource: Resource; actions: Action[] }> = [];
  const allActions: Action[] = [
    'create',
    'read',
    'update',
    'delete',
    'approve',
    'export',
    'manage',
  ];

  for (const [resource, actions] of Object.entries(perms)) {
    if (!actions) continue;
    const allowed: Action[] = [];
    for (const action of allActions) {
      if (actions[action]) allowed.push(action);
    }
    if (allowed.length > 0) {
      result.push({ resource: resource as Resource, actions: allowed });
    }
  }

  return result;
}

export function getAllRoles(): string[] {
  return Object.keys(ROLE_PERMISSIONS);
}

export type { Role, Resource, Action };

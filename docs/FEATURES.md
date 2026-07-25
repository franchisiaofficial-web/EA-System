# Features

- **Last Updated:** 2026-07-25
- **Current Version:** 0.3.1

---

## Feature Catalog

12 modules defined in the `features` table.

| Key           | Name            | Module     | Seeded | Default Enabled |
| ------------- | --------------- | ---------- | ------ | --------------- |
| admissions    | Admissions      | core       | ✅     | ✅              |
| academics     | Academics       | core       | ✅     | ✅              |
| attendance    | Attendance      | core       | ✅     | ✅              |
| communication | Communication   | core       | ✅     | ✅              |
| examinations  | Examinations    | academic   | ✅     | ❌              |
| finance       | Finance         | admin      | ✅     | ❌              |
| hr            | Human Resources | admin      | ✅     | ❌              |
| transport     | Transport       | operations | ✅     | ❌              |
| library       | Library         | operations | ✅     | ❌              |
| hostel        | Hostel          | operations | ✅     | ❌              |
| inventory     | Inventory       | operations | ✅     | ❌              |
| analytics     | Analytics       | admin      | ✅     | ❌              |

---

## Per-School Toggle

`SchoolFeature` junction table links school → feature with `enabled: boolean`.

Default on school creation: admissions, academics, attendance, communication enabled. Others require Super Admin toggling.

---

## Subscription Plans

| Plan       | Students  | Staff     | Price/mo | Modules                           |
| ---------- | --------- | --------- | -------- | --------------------------------- |
| starter    | 500       | 50        | ₹99      | admissions, academics, attendance |
| growth     | 2,000     | 200       | ₹249     | All 12 modules                    |
| enterprise | Unlimited | Unlimited | Custom   | All 12 modules                    |

---

## Feature Access Flow

```
User Request → Service Layer → isFeatureEnabled(schoolId, key, ctx)
  → SchoolFeature table → enabled? → allow/deny
```

---

## Planned Modules (Phase 1+)

### Student Management

- **Status:** Not Started
- **DB Tables:** TBD (students table)
- **Permissions:** read, create, update, delete, export
- **Roles:** SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER, CLASS_TEACHER

### Teacher Management

- **Status:** Not Started
- **DB Tables:** Memberships (existing, role=TEACHER/CLASS_TEACHER)
- **Permissions:** manage, read, create, update, delete, export
- **Roles:** SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, HR

### Attendance

- **Status:** Complete (Sprint 2 — backend, Sprint 2b — UI)
- **DB Tables:** attendance_records (RLS-protected), partial unique index on (student_membership_id, date) WHERE is_deleted = false
- **Permissions:** read, create, update, export
- **Roles:** SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, CLASS_TEACHER, STUDENT (own), PARENT (linked children)
- **UI Surfaces:** Teacher (mark/bulk/edit), Principal (dashboard), Student (history), Parent (child view)

### Examinations

- **Status:** Not Started
- **DB Tables:** TBD
- **Permissions:** read, create, update, approve, export
- **Roles:** SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER

### Finance

- **Status:** Not Started
- **DB Tables:** TBD
- **Permissions:** manage, read, create, update, delete, export
- **Roles:** SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT

### Transport

- **Status:** Not Started
- **DB Tables:** TBD
- **Permissions:** manage, read, create, update, delete
- **Roles:** SUPER_ADMIN, SCHOOL_ADMIN, TRANSPORT_MANAGER, DRIVER

### Communication

- **Status:** Not Started
- **DB Tables:** TBD
- **Permissions:** read, create, update
- **Roles:** All authenticated users

### Library

- **Status:** Not Started
- **DB Tables:** TBD
- **Permissions:** manage, read, create, update, delete
- **Roles:** SUPER_ADMIN, SCHOOL_ADMIN, LIBRARIAN

### Hostel

- **Status:** Not Started
- **DB Tables:** TBD
- **Permissions:** manage, read, create, update, delete
- **Roles:** SUPER_ADMIN, SCHOOL_ADMIN

### Inventory

- **Status:** Not Started
- **DB Tables:** TBD
- **Permissions:** manage, read, create, update, delete
- **Roles:** SUPER_ADMIN, SCHOOL_ADMIN

### Analytics

- **Status:** Not Started
- **DB Tables:** N/A (reads from other tables)
- **Permissions:** read, export
- **Roles:** SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, ACCOUNTANT

---

## Permission Matrix

Full matrix in `src/lib/permissions/permissions.ts`.

| Role              | Schools | Students      | Teachers      | Finance | Settings | Features |
| ----------------- | ------- | ------------- | ------------- | ------- | -------- | -------- |
| SUPER_ADMIN       | manage  | manage        | manage        | manage  | manage   | manage   |
| SCHOOL_ADMIN      | update  | manage        | manage        | manage  | manage   | read     |
| PRINCIPAL         | read    | create,update | create,update | read    | read     | —        |
| ACCOUNTANT        | —       | read          | read          | manage  | —        | —        |
| TEACHER           | —       | read          | —             | —       | —        | —        |
| CLASS_TEACHER     | —       | read,update   | —             | —       | —        | —        |
| STUDENT           | —       | read(own)     | —             | —       | —        | —        |
| PARENT            | —       | read          | —             | read    | —        | —        |
| HR                | —       | read          | manage        | —       | —        | —        |
| LIBRARIAN         | —       | read          | read          | —       | —        | —        |
| TRANSPORT_MANAGER | —       | read          | read          | —       | —        | —        |
| DRIVER            | —       | —             | —             | —       | —        | —        |

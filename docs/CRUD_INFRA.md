# CRUD Infrastructure

**Version:** 1.0
**Applies to:** All Sprint 3+ modules consuming the shared CRUD layer

---

## Architecture

Four-layer infrastructure consumed by every future module (Students, Teachers, Academic Structure, etc.):

```
UI Layer        — DataTable, Form fields, Dialog, Filters, Entity Action Bar
CRUD Layer      — List → Create → View → Edit → Archive (page/route scaffold)
Server Layer    — Query Helpers, Mutation Helpers, Validation, Permission Checks, Audit Logging
Tenant Layer    — Tenant Context, School Scoping, RLS Integration
```

See `docs/FIELD_CONTRACT.md` for the field component contract.

---

## 1. Permission Resource Placeholder

The CRUD demo at `src/app/api/crud-demo/route.ts` uses:

```typescript
resource: 'schools'
```

This is a **placeholder** used only to keep the demo restricted to `SUPER_ADMIN`/`SCHOOL_ADMIN` roles. It is **not** a pattern to copy literally.

**Future modules must use their own entity's real permission resource**, not `'schools'`. Examples:

| Module | Resource |
|---|---|
| Student Management | `'students'` |
| Teacher Management | `'teachers'` |
| Academic Structure | `'academics'` or `'academic_years'` / `'classes'` / `'sections'` |
| Attendance | `'attendance_records'` |
| Parent Management | `'parents'` |

**Copying the demo's `resource: 'schools'` verbatim into a new module would incorrectly gate that module behind school-admin-only permissions** — the wrong role would have access, and the intended role would be locked out.

---

## 2. Wrapper Responsibility Boundary

The shared mutation helpers (`runMutation()` / `runSimpleMutation()`) handle a specific set of concerns automatically. Future modules must know what the wrapper does and what they still need to do themselves.

### Handled by the wrapper (automatic)

1. **Authentication** — `resolveTenant()` calls `getAuthContext()`
2. **Permission check** — `checkCrudPermission()` calls `requirePermission()`
3. **Tenant resolution / RLS context** — `toRequestContext()` produces the `RequestContext`
4. **Mutation execution** — the `execute` callback runs within `withRls()` (caller provides the callback)
5. **Audit logging** — `writeAudit()` called after successful mutation
6. **Standard `CrudResult` response** — returns `{ success, data? }` or `{ success, error }`

### Caller's responsibility (not handled by the wrapper)

1. **Entity-specific Zod validation** — parse and validate the request body before calling the wrapper
2. **Request parsing** — extract and type the incoming data (headers, body, params)
3. **Cache/path revalidation** — if the module needs `revalidatePath()` after mutation, call it after the wrapper returns success

---

## Reference Implementation

The CRUD demo at `src/app/api/crud-demo/route.ts` is the canonical reference for all future modules. Its POST and DELETE handlers are reproduced below as the pattern to follow.

### POST (Create)

```typescript
// src/app/api/crud-demo/route.ts — POST handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);                    // ← Caller: Zod validation

    const result = await runSimpleMutation<typeof parsed, CrudDemo>({
      resource: 'schools',                                      // ← PLACEHOLDER — use your entity's resource
      action: 'create',
      input: parsed,
      execute: async (data, { authCtx: ac, requestCtx: rc }) => {
        return withRls(rc, async (tx) => {
          return tx.crudDemo.create({                           // ← Replace with your entity
            data: { schoolId: ac.schoolId, ...data },
          });
        });
      },
      getEntityId: (r) => r.id,
      buildAfter: (r) => ({ title: r.title, category: r.category }),  // ← Replace with your fields
    });

    if (!result.success) {
      return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : 400 });
    }
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: (e as Error).message } }, { status: 500 });
  }
}
```

### DELETE (Archive)

```typescript
// src/app/api/crud-demo/route.ts — DELETE handler
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Missing id' } }, { status: 400 });

    const result = await runSimpleMutation<string, CrudDemo>({
      resource: 'schools',                                      // ← PLACEHOLDER — use your entity's resource
      action: 'archive',
      input: id,
      execute: async (entityId, { requestCtx: rc }) => {
        return withRls(rc, async (tx) => tx.crudDemo.update({   // ← Replace with your entity
          where: { id: entityId }, data: { isActive: false },
        }));
      },
      getEntityId: () => id,
      buildAfter: (r) => ({ title: r.title, isActive: false }),  // ← Replace with your fields
    });

    if (!result.success) {
      return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : 400 });
    }
    return NextResponse.json({ success: true, data: { id } });
  } catch (e) {
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: (e as Error).message } }, { status: 500 });
  }
}
```

---

## Related Documents

- `docs/FIELD_CONTRACT.md` — Field component RHF+Zod integration contract
- `docs/DESIGN_SYSTEM.md` — Visual design tokens and component styling
- `docs/DECISIONS.md` — Architectural decisions (Decisions 10–12)
- `src/lib/crud/types.ts` — `CrudResult`, `AuditEvent`, `PaginationParams`, `TenantContext`

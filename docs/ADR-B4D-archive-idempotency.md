# ADR-B4D — Archive Idempotency

**Decision ID**: ADR-B4D
**Date**: 2026-07-29
**Status**: PROPOSED (pending project-owner approval)
**Supersedes**: Original acceptance criterion requiring 409 on repeat archive

---

## Context

The Student DELETE endpoint (`/api/students/[id]`) performs a soft-delete (archive), setting `status = 'ARCHIVED'` and `isDeleted = true`.

The original specification required a repeat archive attempt to return `403` or `409`, treating it as a conflict.

During implementation and testing, the actual runtime behavior was observed to return `200` (idempotent). This was later explicitly changed to return `409` to match the spec. A subsequent architectural review determined that idempotent behavior was preferable.

## Decision

**Archive operations are idempotent.**

A repeated archive request SHALL return:

```
HTTP 200
```

Response:

```json
{
    "success": true,
    "alreadyArchived": true
}
```

## Rationale

1. **Safe retries**: Clients can safely retry archive requests without checking current state
2. **No duplicate mutation**: The database row is already in the target state
3. **No duplicate audit event**: The pre-check returns early before the mutation pipeline
4. **REST convention**: PUT/DELETE on an already-deleted resource returning 200 is a common and accepted pattern

## Implementation

**File**: `src/app/api/students/[id]/route.ts:92-95`

```typescript
if ((result as any).alreadyArchived) {
  return NextResponse.json(
    { success: true, alreadyArchived: true },
    { status: 200 }
  );
}
```

**Evidence script**: `guardian-evidence.ts:828-832`

```typescript
if (b4dApiRes.status !== 200) fail(`B4D: Expected 200 for idempotent re-archive`);
if (!b4dApiRes.data?.alreadyArchived) fail(`B4D: Expected alreadyArchived=true`);
```

## Consequences

- **Verifier updated** to expect `200` instead of `409`
- **API contract clarified**: repeated archive is not an error
- **No database change**: state already matches
- **No audit log generated**: pre-check returns before the mutation pipeline

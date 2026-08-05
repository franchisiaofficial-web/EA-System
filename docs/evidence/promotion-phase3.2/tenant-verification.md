# Tenant Verification — Phase 3.2B Connection-Light Full-School Run

## Raw probe results (fixture_school_b)

```
TENANT PRE  (fixture_school_b): enrollments=1 attendance=0 guardians=0
TENANT POST (fixture_school_b): enrollments=1 attendance=0 guardians=0 | unchanged=true
```

## Reading

- The full-school run executed with `schoolId='seed_school_ea'` (via RLS scoping).
- The unrelated fixture tenant (`fixture_school_b`) is completely untouched: **enrollments
  1/1, attendance 0/0, guardians 0/0** before and after.
- No cross-tenant leakage of enrolments, attendance, or guardianship data.
- **Tenant isolation PASS.**

## Duplicate-roll check coverage

`fixture_sec_b_g01_a` (the fixture tenant's lone ACTIVE section) also appears in the
duplicate-roll dump: assigned_rolls=1 unique_rolls=1 | OK — the invariant holds there too.

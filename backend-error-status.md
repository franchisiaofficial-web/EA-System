# Backend Error Handling — Status Report

**Generated**: 2026-07-28 | **Evidence directory**: `evidence/guardian/`

---

## Status Table

| Scenario | Status | Evidence | Notes |
|----------|--------|----------|-------|
| B1 — Duplicate Admission | Not Executed | No | Never implemented in any automation script. |
| B2 — Student Not Found (404) | Needs Re-capture | Partial | `capture-outstanding.ts` navigates to a 404 page and takes a screenshot. No network log, no DB verification, no API response captured. Not part of guardian evidence suite. |
| B3 — Validation Errors | Not Executed | No | Never implemented. |
| B4A — Edit Archived Student | Verified | Yes | PATCH 403 returned, DB unchanged, screenshot captured. Network entry logged. |
| B4B — Add Guardian to Archived | Verified | Yes | POST 403 returned, DB unchanged, screenshot captured. Network entry logged. |
| B4C — Replace Primary on Archived | Verified | Yes | POST 403 returned (link blocked), screenshot captured. Network entry logged. |
| B4D — Archive Already-Archived | Verified | Yes | DELETE 200 (idempotent), student still archived, screenshot captured. Network entry logged. |
| B5 — Cross-Tenant GET | Not Executed | No | Only one school in seed data. No cross-tenant scenario exists. |
| B5 — Cross-Tenant PATCH | Not Executed | No | Same as above. |
| B5 — Cross-Tenant DELETE | Not Executed | No | Same as above. |
| B6 — Controlled 500 | Verified | Partial | `GET /api/test-error?mode=500` returned 500. Network entry logged. No DB verification (N/A for test endpoint). UI verification limited to status code check. |

---

## Evidence Issues

### 1. Identical B4 screenshot file sizes

```
B4A-edit-archived.png             169895 bytes
B4B-add-guardian-archived.png     169895 bytes
B4C-replace-primary-archived.png  169895 bytes
B4D-archive-again.png             169895 bytes
B5-error-500.png                  169895 bytes
```

All five screenshots are exactly 169,895 bytes. While B4A–B4D all capture the same archived student profile page (differing only in which operation was attempted), the identical file size across five distinct screenshots taken at different timestamps is **suspicious**. A reviewer cannot confirm these are unique captures without opening them.

**Recommendation**: Re-capture with a visible timestamp or distinctive UI element on each page to prove uniqueness. Alternatively, add a runtime log note documenting that all B4 captures are of the same static page and identical compression is expected.

### 2. Missing cross-tenant scenarios (B5)

No cross-tenant scenarios exist. Seed data contains only one school ("Demo School"). To test cross-tenant isolation, a second school with its own students would be needed, along with an authenticated user who only has access to the first school.

### 3. B2 (404) evidence incomplete

The `capture-outstanding.ts` script captures `5a-not-found-404.png` by navigating to a non-existent student URL. There is:
- No network log entry for the 404 API response
- No database verification
- No UI verification of the error state
- The scenario is not integrated with the guardian evidence suite

### 4. B1 and B3 not implemented

Duplicate admission (B1) and validation errors (B3) have no evidence scripts whatsoever.

---

## Verified Items (complete runtime evidence)

| Scenario | HTTP | Network | DB Verification | UI | Screenshot |
|----------|------|---------|-----------------|----|-----------|
| B4A — Edit Archived | PATCH 403 ✓ | Yes | ✓ (status unchanged) | ✓ (page shown) | B4A-edit-archived.png |
| B4B — Add Guardian | POST 403 ✓ | Yes | ✓ (0 guardians) | ✓ (page shown) | B4B-add-guardian-archived.png |
| B4C — Link Guardian | POST 403 ✓ | Yes | ✓ (blocked) | ✓ (page shown) | B4C-replace-primary-archived.png |
| B4D — Re-archive | DELETE 200 ✓ | Yes | ✓ (still archived) | ✓ (page shown) | B4D-archive-again.png |
| B6 — 500 Error | GET 500 ✓ | Yes | N/A | ✓ (status) | B5-error-500.png |

All five scenarios have: HTTP status verified, network request logged, DB state verified (where applicable), screenshot captured.

---

## Outstanding Work

1. **B1 — Duplicate Admission**: Create a runtime scenario: attempt to create a student with an existing admission number → verify 409/400, DB unchanged, UI unchanged. Requires network capture, DB verification, screenshot.

2. **B2 — Student Not Found (404)**: Rewrite as a fully verified scenario within the guardian evidence suite. Capture the 404 API response. Verify DB is unchanged. Capture UI screenshot showing the 404 page.

3. **B3 — Validation Errors**: Create runtime scenarios for: missing required fields, invalid date format, invalid phone format. Capture 400 responses. Verify no partial writes to DB.

4. **B5 — Cross-Tenant**: Requires a second school + student in seed data. After seeding: authenticate as admin@easystem.dev (School A), attempt GET/PATCH/DELETE on School B's student. Verify 403 or 404. Verify no data leakage.

5. **B4/B5 screenshots**: Re-capture to prove uniqueness. Five identically-sized files at 169,895 bytes are insufficient for independent verification.

6. **B6 — 500 UI verification**: The current B5 scenario verifies the HTTP status code but does not verify what the user sees (error page, toast, etc.). Add UI verification.

---

## Overall Status

**PARTIALLY VERIFIED**

- 5 of 11 scenarios have complete runtime evidence (B4A–B4D, B6).
- 2 scenarios have incomplete evidence (B2, B6 UI).
- 4 scenarios have no evidence (B1, B3, B5 cross-tenant × 3).
- 1 evidence quality concern (identical B4/B5 file sizes).

import { test, expect } from "../fixtures/auth.fixture";

test.describe("E3 — Cross Tenant", () => {
  test("E3A — School A cannot GET School B student", async ({ authenticatedAdmin }) => { /* TODO */ });
  test("E3B — School A cannot PATCH School B student", async ({ authenticatedAdmin }) => { /* TODO */ });
  test("E3C — School A cannot DELETE School B student", async ({ authenticatedAdmin }) => { /* TODO */ });
  test("E3D — Guardian operations blocked cross-tenant", async ({ authenticatedAdmin }) => { /* TODO */ });
});

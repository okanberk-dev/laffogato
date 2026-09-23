import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * A throttled admin login never reached the credential check. Writing a
 * `login_fail` row for it let anyone fill `audit_logs` by hammering a locked
 * key (docs/AUDIT.md §8).
 */
describe("admin login audit", () => {
  it("records no login_fail for an attempt the limiter refused", () => {
    const action = readFileSync("src/app/admin/giris/actions.ts", "utf8");
    const throttled = action.indexOf("if (result.throttled)");
    expect(throttled).toBeGreaterThan(0);
    expect(throttled).toBeLessThan(action.indexOf('action: "login_fail"'));
    const branch = action.slice(
      throttled,
      action.indexOf('action: "login_fail"'),
    );
    expect(branch).toMatch(/return \{ error:/);
  });

  it("is told by signInAdmin when the limiter refused", () => {
    const auth = readFileSync("src/lib/admin/auth.ts", "utf8");
    expect(auth).toMatch(/throttled: true/);
    expect(auth).toContain('reserveLoginAttempt("admin-login"');
  });
});

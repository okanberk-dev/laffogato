import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Every export of a "use server" file is a public POST endpoint. The 2FA setup
 * page's `freshEnrollment` helper lived in its actions file, so anyone holding
 * an admin session cookie could call it and overwrite an ENABLED enrollment
 * with a fresh draft (`enabled: false`) - 2FA off, and no `2fa_disable` audit
 * row, because the disable path was never taken.
 */
describe("2FA enrollment", () => {
  it("is not reachable as a server action", () => {
    const actions = readFileSync(
      "src/app/admin/2fa-kurulum/actions.ts",
      "utf8",
    );
    expect(actions).not.toMatch(/export async function freshEnrollment/);
    expect(actions).not.toContain("startEnrollment(");
  });

  it("refuses to start over an enabled enrollment", () => {
    // Behaviour, including a row enabled between the read and the write:
    // tests/admin-2fa-draft.test.ts.
    const twofa = readFileSync("src/lib/admin/twofa.ts", "utf8");
    const body = twofa.slice(
      twofa.indexOf("export async function startEnrollment"),
    );
    const guard = body.indexOf("if (entry?.enabled)");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(body.indexOf(".update("));
    expect(guard).toBeLessThan(body.indexOf(".upsert("));
    // Both writes are conditional on the row as it was read.
    expect(body).toContain('.eq("enabled", false)');
    expect(body).toContain("ignoreDuplicates: true");
  });

  it("takes a current code, not just the session, to turn 2FA off", () => {
    const actions = readFileSync(
      "src/app/admin/2fa-kurulum/actions.ts",
      "utf8",
    );
    const body = actions.slice(
      actions.indexOf("export async function disable2FAAction"),
    );
    expect(body.indexOf("verifyToken(session.email, token)")).toBeGreaterThan(
      -1,
    );
    expect(body.indexOf("verifyToken(session.email, token)")).toBeLessThan(
      body.indexOf("await disable2FA(session.email)"),
    );
    expect(body).toContain('reserveLoginAttempt("admin-2fa"');
    // The account-wide budget too: per address alone, a stolen cookie could
    // keep guessing from fresh addresses.
    expect(body).toContain('reserveLoginAttempt("admin-2fa-account", "*"');
    expect(body.indexOf('"admin-2fa-account"')).toBeLessThan(
      body.indexOf("verifyToken(session.email, token)"),
    );
  });
});

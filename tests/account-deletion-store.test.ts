import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompiledQuery } from "@/lib/db/sql";

/**
 * The rows behind the web deletion request: one statement opens it (so two
 * presses at once open one request), the withdrawal only clears the stamp
 * it read, and the closure (`deleteMe`, the app's DELETE /me as well)
 * clears the request with the rest of the row.
 */

const h = vi.hoisted(() => ({
  queries: [] as CompiledQuery[],
  answers: [] as Array<{ rows: Record<string, unknown>[] }>,
}));

vi.mock("@/lib/db", async () => {
  const { createDb } = await import("@/lib/db/client");
  const db = createDb(async (q: CompiledQuery) => {
    h.queries.push(q);
    const next = h.answers.shift() ?? { rows: [] };
    return { rows: next.rows, rowCount: next.rows.length };
  });
  return {
    getDb: () => db,
    TABLES: new Proxy({}, { get: (_t, key) => String(key) }),
  };
});

const { getDeletionRequest, openDeletionRequest, withdrawDeletionRequest } =
  await import("@/lib/customer/deletion-request");

const AT = "2026-10-18T09:15:00.000Z";
const NOW = new Date(AT);

beforeEach(() => {
  h.queries.length = 0;
  h.answers.length = 0;
});

describe("openDeletionRequest", () => {
  it("writes the stamp only while none is open, in one statement", async () => {
    h.answers.push({ rows: [{ deletionRequestedAt: AT }] });
    await expect(
      openDeletionRequest(" Eda@Example.com ", "Taşınıyorum", NOW),
    ).resolves.toEqual({ status: "created", requestedAt: AT });
    expect(h.queries).toHaveLength(1);
    const [q] = h.queries;
    expect(q.text).toMatch(/^UPDATE "customers" SET /);
    expect(q.text).toContain('"deletionRequestedAt" IS NULL');
    expect(q.text).toContain('"isActive" = ');
    expect(q.text).toContain('RETURNING "deletionRequestedAt"');
    expect(q.params).toContain("eda@example.com");
    expect(q.params).toContain("Taşınıyorum");
    expect(q.params).toContain(AT);
  });

  it("answers the open request's own date when one was already there", async () => {
    // The conditional update matched nothing; the read finds the first one.
    h.answers.push({ rows: [] });
    h.answers.push({
      rows: [
        {
          deletionRequestedAt: "2026-10-10T08:00:00.000Z",
          deletionReason: "",
        },
      ],
    });
    await expect(
      openDeletionRequest("eda@example.com", "", NOW),
    ).resolves.toEqual({
      status: "exists",
      requestedAt: "2026-10-10T08:00:00.000Z",
    });
  });

  it("reports a missing or closed account", async () => {
    h.answers.push({ rows: [] });
    h.answers.push({ rows: [] });
    await expect(
      openDeletionRequest("yok@example.com", "", NOW),
    ).resolves.toEqual({ status: "not_found" });
  });
});

describe("withdrawDeletionRequest", () => {
  it("clears the stamp it read, and nothing newer", async () => {
    h.answers.push({
      rows: [{ deletionRequestedAt: AT, deletionReason: "x" }],
    });
    h.answers.push({ rows: [{ id: "cus-0042" }] });
    const later = new Date("2026-10-19T08:00:00.000Z");
    await expect(
      withdrawDeletionRequest("eda@example.com", later),
    ).resolves.toEqual({ status: "withdrawn", requestedAt: AT });
    const update = h.queries[1];
    expect(update.text).toMatch(/^UPDATE "customers" SET /);
    expect(update.text).toContain('"deletionRequestedAt" = ');
    // The SET writes NULL; the WHERE pins the stamp that was read.
    expect(update.params).toContain(null);
    expect(update.params.filter((p) => p === AT)).toHaveLength(1);
  });

  it("is a no-op without an open request", async () => {
    h.answers.push({
      rows: [{ deletionRequestedAt: null, deletionReason: "" }],
    });
    await expect(
      withdrawDeletionRequest("eda@example.com", NOW),
    ).resolves.toEqual({ status: "none" });
    expect(h.queries).toHaveLength(1);
  });
});

describe("getDeletionRequest", () => {
  it("reads the two columns of the member's row", async () => {
    h.answers.push({
      rows: [{ deletionRequestedAt: AT, deletionReason: "x" }],
    });
    await expect(getDeletionRequest("Eda@example.com")).resolves.toEqual({
      requestedAt: AT,
      reason: "x",
    });
    expect(h.queries[0].text).toContain(
      'SELECT "deletionRequestedAt", "deletionReason" FROM "customers"',
    );
  });
});

describe("the closure answers the request", () => {
  it("deleteMe blanks the request and its reason with the rest of the row", () => {
    // One update writes the anonymised row (lib/mobile/me.ts): the same one
    // the app's DELETE /me runs, so an app deletion closes a web request too.
    const src = readFileSync("src/lib/mobile/me.ts", "utf8");
    const update = src.slice(
      src.indexOf("email: anonymizedEmail(customer.id),"),
      src.indexOf('.eq("email", customer.email);'),
    );
    expect(update).toContain("deletionRequestedAt: null,");
    expect(update).toContain('deletionReason: "",');
  });

  it("the migration adds the columns nullable and the bundle carries it", () => {
    const sql = readFileSync(
      "db/migrations/20261018090000_customer_deletion_request.sql",
      "utf8",
    );
    expect(sql).toContain(
      'add column if not exists "deletionRequestedAt" text;',
    );
    expect(sql).toContain(
      `add column if not exists "deletionReason" text not null default ''`,
    );
    expect(readFileSync("db/schema.sql", "utf8")).toContain(
      "20261018090000_customer_deletion_request.sql",
    );
  });
});

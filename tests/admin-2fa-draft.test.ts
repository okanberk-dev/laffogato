import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The 2FA setup page minted a new secret on every render, so a reload, a
 * second tab or a detour through the dashboard killed the QR the phone had
 * already scanned, and the refusal blamed the phone's clock (admin audit
 * SHE-09). A draft is now shown again for 15 minutes, and no write can land
 * on a row that was enabled after it was read.
 */

type Row = Record<string, unknown>;
let rows: Row[] = [];
/** Runs right after the next read, before the write: a second tab. */
let afterRead: (() => void) | null = null;
const writes: string[] = [];

class Query implements PromiseLike<unknown> {
  private filters: Array<[string, unknown]> = [];
  private single = false;
  private returning = false;
  constructor(
    private op: "select" | "update" | "upsert",
    private payload?: Row,
    private ignoreDuplicates = false,
  ) {}
  select() {
    if (this.op !== "select") this.returning = true;
    return this;
  }
  eq(col: string, value: unknown) {
    this.filters.push([col, value]);
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
  private matched() {
    return rows.filter((r) => this.filters.every(([c, v]) => r[c] === v));
  }
  then<A, B = never>(
    ok?: ((v: unknown) => A | PromiseLike<A>) | null,
    err?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    let data: unknown = null;
    if (this.op === "select") {
      const found = this.matched();
      data = this.single ? (found[0] ?? null) : found;
      const hook = afterRead;
      afterRead = null;
      hook?.();
    } else if (this.op === "update") {
      const hit = this.matched();
      for (const r of hit) Object.assign(r, this.payload);
      writes.push(`update:${hit.length}`);
      data = this.returning ? hit.map((r) => ({ email: r.email })) : null;
    } else {
      const incoming = this.payload as Row;
      const exists = rows.some((r) => r.email === incoming.email);
      if (exists && !this.ignoreDuplicates) {
        throw new Error("fake db: plain upsert over an existing row");
      }
      if (!exists) rows.push({ lastStep: 0, ...incoming });
      writes.push(`insert:${exists ? 0 : 1}`);
      data = this.returning && !exists ? [{ email: incoming.email }] : [];
    }
    return Promise.resolve({ data, error: null }).then(ok, err);
  }
}

vi.mock("@/lib/db", () => ({
  TABLES: { admin2fa: "admin_2fa" },
  getDb: () => ({
    from: () => ({
      select: () => new Query("select"),
      update: (patch: Row) => new Query("update", patch),
      upsert: (values: Row, opts?: { ignoreDuplicates?: boolean }) =>
        new Query("upsert", values, opts?.ignoreDuplicates === true),
      delete: () => new Query("select"),
    }),
  }),
}));

const { startEnrollment, DRAFT_REUSE_MS } = await import("@/lib/admin/twofa");

const EMAIL = "kasa@laffogato.net";
const T0 = Date.parse("2026-10-17T12:00:00.000Z");
const row = () => rows.find((r) => r.email === EMAIL);

beforeEach(() => {
  rows = [];
  writes.length = 0;
  afterRead = null;
});

describe("startEnrollment", () => {
  it("shows the same QR on every render for 15 minutes", async () => {
    const first = await startEnrollment(EMAIL, "L'Affogato Admin", T0);
    expect(row()).toMatchObject({ secret: first.secret, enabled: false });
    // A reload, a second tab, a trip through the dashboard.
    const again = await startEnrollment(EMAIL, "L'Affogato Admin", T0 + 60_000);
    const later = await startEnrollment(
      EMAIL,
      "L'Affogato Admin",
      T0 + DRAFT_REUSE_MS - 1,
    );
    expect(again.secret).toBe(first.secret);
    expect(later.secret).toBe(first.secret);
    expect(again.otpauthUrl).toBe(first.otpauthUrl);
    expect(writes).toEqual(["insert:1"]);
  });

  it("replaces a draft that is 15 minutes old", async () => {
    const first = await startEnrollment(EMAIL, "L'Affogato Admin", T0);
    const fresh = await startEnrollment(
      EMAIL,
      "L'Affogato Admin",
      T0 + DRAFT_REUSE_MS,
    );
    expect(fresh.secret).not.toBe(first.secret);
    expect(row()).toMatchObject({
      secret: fresh.secret,
      updatedAt: new Date(T0 + DRAFT_REUSE_MS).toISOString(),
    });
  });

  it("never starts over an enabled enrollment", async () => {
    rows = [
      {
        email: EMAIL,
        secret: "LIVESECRET",
        enabled: true,
        enrolledAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
    ];
    await expect(startEnrollment(EMAIL, "x", T0)).rejects.toThrow(
      /already enabled/,
    );
    expect(row()).toMatchObject({ secret: "LIVESECRET", enabled: true });
    expect(writes).toEqual([]);
  });

  it("does not switch 2FA off when it is enabled between the read and the write", async () => {
    rows = [
      {
        email: EMAIL,
        secret: "OLDDRAFT",
        enabled: false,
        enrolledAt: "",
        updatedAt: new Date(T0 - DRAFT_REUSE_MS * 2).toISOString(),
      },
    ];
    // The other tab finishes the old draft just after this one read it.
    afterRead = () => Object.assign(row()!, { enabled: true });
    await expect(startEnrollment(EMAIL, "x", T0)).rejects.toThrow(
      /already enabled/,
    );
    expect(row()).toMatchObject({ secret: "OLDDRAFT", enabled: true });
  });

  it("shows the other tab's draft when both start at once", async () => {
    // This tab read "no row"; the other one inserted in the meantime.
    afterRead = () =>
      rows.push({
        email: EMAIL,
        secret: "OTHERTAB",
        enabled: false,
        enrolledAt: "",
        updatedAt: new Date(T0).toISOString(),
        lastStep: 0,
      });
    const draft = await startEnrollment(EMAIL, "x", T0);
    expect(draft.secret).toBe("OTHERTAB");
    expect(rows).toHaveLength(1);
  });
});

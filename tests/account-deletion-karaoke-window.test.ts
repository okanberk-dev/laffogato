import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A closure that answers the member's web deletion request is judged at the
 * request, not at the moment the team closes the account (ASK-Y3-4 (d),
 * TKHK m.4/2: our delay does not shorten the member's window).
 *
 * - The two-hour rule reads the request's stamp; the refund and every
 *   stamp on the row are the closure's own instant.
 * - A paid booking that was in its free window at the request and whose
 *   start came before the closure is no longer dropped as "past": it is
 *   refunded in full and the money team is told, unless the person closing
 *   the account recorded that the room was used.
 * - Without a request (the app's DELETE /me, the panel's Yönetim card) the
 *   closure is judged now, as before.
 *
 * The real karaoke.ts and karaoke-payment.ts over an in-memory table; the
 * POS, the mail and the audit log are scripted.
 */

type Row = Record<string, unknown>;

const h = vi.hoisted(() => ({
  tables: new Map<string, Row[]>(),
  pos: "ok" as "ok" | "refused",
  refunds: [] as Array<{ ref: string; amountMinor: number }>,
  cancellations: [] as Array<Record<string, unknown>>,
  alerts: [] as Array<Record<string, unknown>>,
  audits: [] as Array<Record<string, unknown>>,
}));

// ─── An in-memory stand-in for the query builder (src/lib/db/client.ts) ────

type Filter = (row: Row) => boolean;

function fakeDb() {
  const table = (name: string) => {
    if (!h.tables.has(name)) h.tables.set(name, []);
    return h.tables.get(name)!;
  };
  return {
    from(name: string) {
      const filters: Filter[] = [];
      let op: "select" | "insert" | "update" | "delete" = "select";
      let payload: Row | Row[] | null = null;
      let returning = false;
      let single = false;
      let limit = Infinity;
      const q = {
        select() {
          if (op !== "select") returning = true;
          return q;
        },
        insert(rows: Row | Row[]) {
          op = "insert";
          payload = rows;
          return q;
        },
        update(patch: Row) {
          op = "update";
          payload = patch;
          return q;
        },
        delete() {
          op = "delete";
          return q;
        },
        eq(col: string, v: unknown) {
          filters.push((r) => (v === null ? r[col] == null : r[col] === v));
          return q;
        },
        neq(col: string, v: unknown) {
          filters.push((r) => r[col] !== v);
          return q;
        },
        ieq(col: string, v: string) {
          filters.push(
            (r) => String(r[col] ?? "").toLowerCase() === v.toLowerCase(),
          );
          return q;
        },
        in(col: string, list: unknown[]) {
          filters.push((r) => list.includes(r[col]));
          return q;
        },
        order() {
          return q;
        },
        limit(n: number) {
          limit = n;
          return q;
        },
        maybeSingle() {
          single = true;
          return q;
        },
        then<T>(
          resolve: (v: {
            data: unknown;
            error: { code?: string; message: string } | null;
            status: number;
          }) => T,
        ) {
          const rows = table(name);
          const match = () => rows.filter((r) => filters.every((f) => f(r)));
          if (op === "insert") {
            const list = Array.isArray(payload) ? payload : [payload as Row];
            for (const row of list) {
              // The (provider, providerRef) unique index of payment rows.
              if (
                name === "payment_transactions" &&
                rows.some(
                  (r) =>
                    r.provider === row.provider &&
                    r.providerRef === row.providerRef,
                )
              ) {
                return Promise.resolve(
                  resolve({
                    data: null,
                    error: { code: "23505", message: "duplicate" },
                    status: 409,
                  }),
                );
              }
              rows.push(structuredClone(row));
            }
            return Promise.resolve(
              resolve({ data: null, error: null, status: 201 }),
            );
          }
          if (op === "update") {
            const hit = match();
            for (const r of hit) Object.assign(r, structuredClone(payload));
            return Promise.resolve(
              resolve({
                data: returning ? hit.map((r) => ({ id: r.id })) : null,
                error: null,
                status: 200,
              }),
            );
          }
          if (op === "delete") {
            const hit = new Set(match());
            h.tables.set(
              name,
              rows.filter((r) => !hit.has(r)),
            );
            return Promise.resolve(
              resolve({ data: null, error: null, status: 200 }),
            );
          }
          const found = match()
            .slice(0, limit)
            .map((r) => structuredClone(r));
          return Promise.resolve(
            resolve({
              data: single ? (found[0] ?? null) : found,
              error: null,
              status: 200,
            }),
          );
        },
      };
      return q;
    },
  };
}

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = fakeDb();
  return { ...real, getDb: () => db };
});
vi.mock("@/lib/admin/store", () => ({
  getSettings: vi.fn(async () => ({
    karaokePrepay: true,
    karaokeHourlyMinor: 100_000,
    karaokeCapacity: 8,
    karaokeNotifyEmail: "",
    email: "kosk@example.com",
  })),
}));
vi.mock("@/lib/admin/audit", () => ({
  logAudit: vi.fn(async (row: Record<string, unknown>) => {
    h.audits.push(row);
  }),
}));
vi.mock("@/lib/admin/rate-limit", () => ({
  clearLoginLimit: vi.fn(async () => {}),
  reserveLoginAttempt: vi.fn(async () => ({
    blocked: false,
    retryAfterSeconds: 0,
  })),
}));
vi.mock("@/lib/customer/store", () => ({ ensureCardUserKey: async () => "" }));
vi.mock("@/lib/mobile/loyalty", () => ({ getLoyalty: async () => null }));
vi.mock("@/lib/mobile/checkout-ref", () => ({
  recordPendingCheckout: vi.fn(async () => {}),
}));
vi.mock("@/lib/mobile/karaoke-notify", () => ({
  notifyOperatorOfReservation: vi.fn(async () => {}),
}));
vi.mock("@/lib/mobile/karaoke-link", () => ({
  karaokeLinkUrl: () => "https://laffogato.net/rezervasyon?t=x",
  verifyKaraokeLink: () => true,
}));
vi.mock("@/lib/email/send", () => ({
  sendKaraokeCancellationEmail: vi.fn(async (k: Record<string, unknown>) => {
    h.cancellations.push(k);
    return true;
  }),
  sendKaraokeConfirmationEmail: vi.fn(async () => true),
  sendKaraokeMoneyAlertEmail: vi.fn(async (a: Record<string, unknown>) => {
    h.alerts.push(a);
    return { ok: true };
  }),
  sendKaraokePaidOperatorEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/payment", async () => {
  const { PaymentRefusedError } = await import("@/lib/payment/provider");
  return {
    getPaymentProvider: () => ({
      name: "fakepos",
      refund: async (ref: string, amountMinor: number) => {
        if (h.pos === "refused") {
          throw new PaymentRefusedError("paynkolay refund reddedildi");
        }
        h.refunds.push({ ref, amountMinor });
        return { providerRef: ref, status: "succeeded" };
      },
    }),
  };
});

const { cancelKaraokeForClosedAccount } =
  await import("@/lib/mobile/karaoke-payment");
const { startedSinceRequest } = await import("@/lib/mobile/karaoke-time");

const EMAIL = "eda@example.com";
// 30 Ekim 2026, 20:00 in Tuzla.
const START = Date.parse("2026-10-30T17:00:00.000Z");
const HOUR = 3600_000;
const at = (hoursFromStart: number) => new Date(START + hoursFromStart * HOUR);
const TITLE =
  "Silme talebi sırasında süresinde olan ödenmiş rezervasyonun saati geçti";

/** A paid, confirmed booking of the member's, with its payment row. */
function seedPaid(over: Partial<Row> = {}): void {
  h.tables.set("karaoke_reservations", [
    {
      id: "krk-00042",
      customerEmail: EMAIL,
      customerName: "Eda Yılmaz",
      date: "2026-10-30",
      startHour: 20,
      hours: 2,
      guests: 4,
      status: "confirmed",
      priceMinor: 200_000,
      discountMinor: 0,
      totalMinor: 200_000,
      note: "",
      createdAt: "2026-10-20T09:00:00.000Z",
      updatedAt: "2026-10-20T09:05:00.000Z",
      paymentStatus: "paid",
      paymentDueAt: "",
      paidAt: "2026-10-20T09:05:00.000Z",
      refundedAt: "",
      paidMinor: 200_000,
      paymentRef: "PNK-1",
      channel: "web",
      guest: false,
      contactEmail: "",
      ...over,
    },
  ]);
  h.tables.set("payment_transactions", [
    {
      orderId: "krk-00042",
      provider: "fakepos",
      providerRef: "PNK-1",
      status: "succeeded",
      amountMinor: 200_000,
      trxDate: "2026-10-20",
    },
  ]);
}

const booking = () => h.tables.get("karaoke_reservations")![0]!;

// The money paths log every alert and refusal; the assertions read them.
vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  h.tables.clear();
  h.pos = "ok";
  h.refunds.length = 0;
  h.cancellations.length = 0;
  h.alerts.length = 0;
  h.audits.length = 0;
});

describe("the request's instant decides the two-hour rule", () => {
  it("refunds in full when the request came in time, though the closure is inside the last two hours", async () => {
    seedPaid();
    const closedAt = at(-1);
    await cancelKaraokeForClosedAccount(EMAIL, closedAt, {
      windowAt: at(-5),
    });
    expect(h.refunds).toEqual([{ ref: "PNK-1", amountMinor: 200_000 }]);
    // The money moved at the closure, and the row says so.
    expect(booking()).toMatchObject({
      status: "cancelled",
      paymentStatus: "refunded",
      refundedAt: closedAt.toISOString(),
      updatedAt: closedAt.toISOString(),
    });
    // The start has not come: an ordinary refund, no extra alert.
    expect(h.alerts).toEqual([]);
  });

  it("judges the same closure now when no request is passed (DELETE /me, Yönetim)", async () => {
    seedPaid();
    await cancelKaraokeForClosedAccount(EMAIL, at(-1));
    expect(h.refunds).toEqual([]);
    expect(booking()).toMatchObject({
      status: "confirmed",
      paymentStatus: "paid",
    });
    expect(h.alerts.at(-1)).toMatchObject({ key: "account-late" });
  });

  it("gives nothing back when the request itself came inside the last two hours", async () => {
    seedPaid();
    await cancelKaraokeForClosedAccount(EMAIL, at(-0.5), {
      windowAt: at(-1),
    });
    expect(h.refunds).toEqual([]);
    expect(booking()).toMatchObject({ paymentStatus: "paid" });
    expect(h.alerts.at(-1)).toMatchObject({ key: "account-late" });
  });

  it("ignores a request stamp that is not before the closure", async () => {
    seedPaid();
    await cancelKaraokeForClosedAccount(EMAIL, at(-1), {
      windowAt: at(+1),
    });
    expect(h.refunds).toEqual([]);
    expect(h.alerts.at(-1)).toMatchObject({ key: "account-late" });
  });
});

describe("a paid booking whose start came between the request and the closure", () => {
  it("is refunded in full and put in front of a person, not dropped as past", async () => {
    seedPaid();
    // Asked three days ahead; closed the morning after the evening.
    const closedAt = at(+15);
    await cancelKaraokeForClosedAccount(EMAIL, closedAt, {
      windowAt: at(-72),
    });
    expect(h.refunds).toEqual([{ ref: "PNK-1", amountMinor: 200_000 }]);
    expect(booking()).toMatchObject({
      status: "cancelled",
      paymentStatus: "refunded",
      refundedAt: closedAt.toISOString(),
    });
    const alert = h.alerts.find((a) => a.key === "account-passed");
    expect(alert).toMatchObject({ title: TITLE });
    expect(String(alert!.summary)).toContain("tutarın tamamı karta iade edildi");
    expect(h.audits).toContainEqual(
      expect.objectContaining({
        entityId: "krk-00042",
        payload: expect.objectContaining({
          event: "account_closed_passed_since_request",
          refunded: true,
          requestedAt: at(-72).toISOString(),
        }),
      }),
    );
  });

  it("keeps the payment when the person closing the account recorded the room as used", async () => {
    seedPaid();
    await cancelKaraokeForClosedAccount(EMAIL, at(+15), {
      windowAt: at(-72),
      roomUsed: ["krk-00042"],
    });
    expect(h.refunds).toEqual([]);
    expect(booking()).toMatchObject({
      status: "confirmed",
      paymentStatus: "paid",
    });
    expect(h.cancellations).toEqual([]);
    const alert = h.alerts.find((a) => a.key === "account-room-used");
    expect(alert).toMatchObject({ title: TITLE });
    expect(String(alert!.summary)).toContain("iade yapılmadı");
  });

  it("says so when the POS declines, and still releases the booking", async () => {
    seedPaid();
    h.pos = "refused";
    await cancelKaraokeForClosedAccount(EMAIL, at(+15), {
      windowAt: at(-72),
    });
    expect(booking()).toMatchObject({
      status: "cancelled",
      paymentStatus: "paid",
    });
    const alert = h.alerts.find((a) => a.key === "account-passed");
    expect(String(alert!.summary)).toContain("iade hemen tamamlanmadı");
  });

  it("stays untouched without a request: a past evening is not the closure's", async () => {
    seedPaid();
    await cancelKaraokeForClosedAccount(EMAIL, at(+15));
    expect(h.refunds).toEqual([]);
    expect(booking()).toMatchObject({
      status: "confirmed",
      paymentStatus: "paid",
    });
    expect(h.alerts).toEqual([]);
  });

  it("leaves a past evening that was not paid online alone, request or not", async () => {
    seedPaid({ paymentStatus: "none", paidMinor: 0, paymentRef: "" });
    await cancelKaraokeForClosedAccount(EMAIL, at(+15), {
      windowAt: at(-72),
    });
    expect(booking()).toMatchObject({ status: "confirmed" });
    expect(h.cancellations).toEqual([]);
    expect(h.alerts).toEqual([]);
  });

  it("is read by one rule: in the window at the request, started by the closure", () => {
    const r = { date: "2026-10-30", startHour: 20 };
    expect(startedSinceRequest(r, at(-72), at(+15))).toBe(true);
    expect(startedSinceRequest(r, at(-72), at(0))).toBe(true);
    expect(startedSinceRequest(r, at(-72), at(-0.5))).toBe(false);
    // Asked inside the last two hours: the request gave no refund to keep.
    expect(startedSinceRequest(r, at(-1), at(+15))).toBe(false);
  });
});

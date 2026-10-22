import pg from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * Order notifications against a real Postgres (20261022170000), with the
 * real query layer and Expo's API faked at `fetch`:
 *
 * - `register_customer_device` takes a token over from another member and
 *   keeps each member within the cap, oldest out first;
 * - `unregisterDevice` forgets only the caller's own token;
 * - `notifyOrderStage` claims (order, kind) once, sends to the member's
 *   phones, forgets a token Expo says is gone, keeps the accepted tickets,
 *   mails "siparişin hazır" only when no phone was reached, and tells a
 *   member whose "Sipariş durumu" switch is off nothing at all;
 * - `checkPushReceipts` forgets a token whose receipt says
 *   DeviceNotRegistered and clears the tokens it kept.
 *
 * One transaction, rolled back. Skipped without TEST_DATABASE_URL.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

const holder = vi.hoisted(() => ({ client: null as pg.PoolClient | null }));
const execute: Executor = async (q) => {
  if (!holder.client) throw new Error("client not ready");
  const r = await holder.client.query(q.text, q.params as unknown[]);
  return {
    rows: (r.rows ?? []) as Record<string, unknown>[],
    rowCount: r.rowCount ?? 0,
  };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const { createDb: create } = await import("@/lib/db/client");
  const db = create((q) => execute(q));
  return { ...real, getDb: () => db };
});

const fakes = vi.hoisted(() => ({
  order: null as Record<string, unknown> | null,
  member: null as Record<string, unknown> | null,
  readyMails: [] as string[],
}));
vi.mock("@/lib/admin/store", () => ({
  getOrder: async () => fakes.order,
}));
vi.mock("@/lib/customer/store", () => ({
  getCustomerByEmail: async () => fakes.member,
}));
vi.mock("@/lib/email/order-notices", () => ({
  notifyOrderReady: async (o: { id: string }) => {
    fakes.readyMails.push(o.id);
    return "sent";
  },
}));

const TOKEN = (s: string) => `ExponentPushToken[${s.padEnd(12, "x")}]`;

maybe("order notifications in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;
  let pool: pg.Pool | null = null;
  let devices: typeof import("@/lib/push/devices");
  let push: typeof import("@/lib/push/order-push");
  const sent: unknown[][] = [];
  let tickets: (count: number) => unknown[];
  let receipts: Record<string, unknown> = {};

  const q = (text: string, params: unknown[] = []) =>
    holder.client!.query(text, params);

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 2 });
    await applyBundledSchema(pool);
    holder.client = await pool.connect();
    await q("begin");
    await q("delete from public.customer_devices");
    await q("delete from public.order_push_notices");
    vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      if (String(url).endsWith("/push/send")) {
        sent.push(body);
        return new Response(JSON.stringify({ data: tickets(body.length) }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ data: receipts }), { status: 200 });
    });
    devices = await import("@/lib/push/devices");
    push = await import("@/lib/push/order-push");
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    vi.unstubAllGlobals();
    try {
      if (holder.client) {
        await q("rollback");
        holder.client.release();
      }
    } finally {
      holder.client = null;
      await pool?.end();
      await release?.();
    }
  });

  beforeEach(() => {
    sent.length = 0;
    fakes.readyMails.length = 0;
    tickets = (n) =>
      Array.from({ length: n }, (_, i) => ({ status: "ok", id: `tk-${i}` }));
  });

  it("moves a token to whoever registers it last and keeps each member within the cap", async () => {
    await devices.registerDevice({
      token: TOKEN("shared"),
      email: "A@Example.com",
      platform: "ios",
    });
    expect(await devices.deviceTokensFor("a@example.com")).toEqual([
      TOKEN("shared"),
    ]);
    await devices.registerDevice({
      token: TOKEN("shared"),
      email: "b@example.com",
      platform: "",
    });
    expect(await devices.deviceTokensFor("a@example.com")).toEqual([]);
    expect(await devices.deviceTokensFor("b@example.com")).toEqual([
      TOKEN("shared"),
    ]);
    // An empty platform does not wipe a known one.
    const row = await q(
      `select platform from public.customer_devices where token = $1`,
      [TOKEN("shared")],
    );
    expect(row.rows[0].platform).toBe("ios");

    for (let i = 0; i < 12; i++) {
      await devices.registerDevice({
        token: TOKEN(`c${i}`),
        email: "c@example.com",
        platform: "android",
        now: new Date(Date.UTC(2026, 9, 22, 8, i)),
      });
    }
    const kept = await devices.deviceTokensFor("c@example.com");
    expect(kept).toHaveLength(10);
    expect(kept).not.toContain(TOKEN("c0"));
    expect(kept).not.toContain(TOKEN("c1"));
    expect(kept[0]).toBe(TOKEN("c11"));
  });

  it("forgets only the caller's own token", async () => {
    await devices.registerDevice({
      token: TOKEN("mine"),
      email: "d@example.com",
      platform: "ios",
    });
    expect(await devices.unregisterDevice(TOKEN("mine"), "e@example.com")).toBe(
      false,
    );
    expect(await devices.unregisterDevice(TOKEN("mine"), "D@example.com")).toBe(
      true,
    );
    expect(await devices.deviceTokensFor("d@example.com")).toEqual([]);
  });

  it("tells a member's phones once, forgets a gone token, keeps the accepted ticket", async () => {
    await devices.registerDevice({
      token: TOKEN("p1"),
      email: "m@example.com",
      platform: "ios",
      now: new Date(Date.UTC(2026, 9, 22, 8, 0)),
    });
    await devices.registerDevice({
      token: TOKEN("p2"),
      email: "m@example.com",
      platform: "android",
      now: new Date(Date.UTC(2026, 9, 22, 8, 1)),
    });
    fakes.order = {
      id: "ord-p1",
      orderNo: 10301,
      status: "shipped",
      kind: "cafe",
      fulfillment: "pickup",
      customerEmail: "m@example.com",
      source: "",
    };
    fakes.member = {
      email: "m@example.com",
      isActive: true,
      notificationPrefs: {
        orderUpdates: true,
        marketing: false,
        newsletter: false,
      },
    };
    tickets = () => [
      { status: "ok", id: "tk-ok" },
      {
        status: "error",
        message: "gone",
        details: { error: "DeviceNotRegistered" },
      },
    ];
    // The newest device first: p2 got the ok ticket, p1 is gone.
    expect(await push.notifyOrderStage("ord-p1", "preparing", "shipped")).toBe(
      "sent",
    );
    expect(sent).toHaveLength(1);
    expect(
      (sent[0] as { channelId: string; title: string }[])[0],
    ).toMatchObject({ channelId: "orders", title: "Siparişin hazır" });
    expect(await devices.deviceTokensFor("m@example.com")).toEqual([
      TOKEN("p2"),
    ]);
    const row = await q(
      `select status, tickets from public.order_push_notices where "orderId" = 'ord-p1' and kind = 'ready'`,
    );
    expect(row.rows[0].status).toBe("sent");
    expect(row.rows[0].tickets).toEqual([{ token: TOKEN("p2"), id: "tk-ok" }]);
    // A phone was told: no mail.
    expect(fakes.readyMails).toEqual([]);
    // Once.
    expect(await push.notifyOrderStage("ord-p1", "preparing", "shipped")).toBe(
      "duplicate",
    );
    expect(sent).toHaveLength(1);
  });

  it("mails 'siparişin hazır' to a guest, and when no phone took the push", async () => {
    fakes.order = {
      id: "ord-g1",
      orderNo: 10302,
      status: "shipped",
      kind: "cafe",
      fulfillment: "pickup",
      customerEmail: "guest@example.com",
      source: "",
    };
    fakes.member = null;
    expect(await push.notifyOrderStage("ord-g1", "paid", "shipped")).toBe(
      "none",
    );
    expect(fakes.readyMails).toEqual(["ord-g1"]);

    await devices.registerDevice({
      token: TOKEN("r1"),
      email: "r@example.com",
      platform: "ios",
    });
    fakes.order = {
      id: "ord-r1",
      orderNo: 10303,
      status: "shipped",
      kind: "cafe",
      fulfillment: "pickup",
      customerEmail: "r@example.com",
      source: "",
    };
    fakes.member = {
      email: "r@example.com",
      isActive: true,
      notificationPrefs: { orderUpdates: true },
    };
    tickets = () => [
      {
        status: "error",
        message: "x",
        details: { error: "MessageRateExceeded" },
      },
    ];
    expect(await push.notifyOrderStage("ord-r1", "paid", "shipped")).toBe(
      "failed",
    );
    expect(fakes.readyMails).toEqual(["ord-g1", "ord-r1"]);
  });

  it("tells a member whose 'Sipariş durumu' is off nothing, phone or mail", async () => {
    await devices.registerDevice({
      token: TOKEN("off"),
      email: "off@example.com",
      platform: "ios",
    });
    fakes.order = {
      id: "ord-o1",
      orderNo: 10304,
      status: "shipped",
      kind: "cafe",
      fulfillment: "pickup",
      customerEmail: "off@example.com",
      source: "",
    };
    fakes.member = {
      email: "off@example.com",
      isActive: true,
      notificationPrefs: { orderUpdates: false },
    };
    expect(await push.notifyOrderStage("ord-o1", "paid", "shipped")).toBe(
      "not_due",
    );
    expect(sent).toHaveLength(0);
    expect(fakes.readyMails).toEqual([]);
  });

  it("says nothing when the order moved on before the notification ran", async () => {
    fakes.order = {
      id: "ord-s1",
      orderNo: 10305,
      status: "completed",
      kind: "cafe",
      fulfillment: "pickup",
      customerEmail: "m@example.com",
      source: "",
    };
    expect(await push.notifyOrderStage("ord-s1", "preparing", "shipped")).toBe(
      "not_due",
    );
  });

  it("reads the receipts, forgets a gone device and clears the kept tokens", async () => {
    await q(
      `update public.order_push_notices set "sentAt" = $1 where "orderId" = 'ord-p1'`,
      [new Date(Date.now() - 30 * 60_000).toISOString()],
    );
    receipts = {
      "tk-ok": { status: "error", details: { error: "DeviceNotRegistered" } },
    };
    const result = await push.checkPushReceipts();
    expect(result.forgotten).toBe(1);
    expect(await devices.deviceTokensFor("m@example.com")).toEqual([]);
    const row = await q(
      `select tickets, "receiptsCheckedAt" from public.order_push_notices where "orderId" = 'ord-p1'`,
    );
    expect(row.rows[0].tickets).toEqual([]);
    expect(row.rows[0].receiptsCheckedAt).not.toBe("");
  });

  // The texts promise the token leaves a notice row within 48 hours: a row
  // past Expo's 24-hour receipt window is cleared even when the receipts
  // cannot be read; a younger one waits for tomorrow's read.
  it("clears the tokens even when the receipts read fails (tomorrow they would be unreadable)", async () => {
    const now = Date.now();
    await q(
      `insert into public.order_push_notices
         ("orderId", kind, status, tickets, "createdAt", "sentAt", "receiptsCheckedAt")
       values ('ord-old', 'ready', 'sent', $1::jsonb, $2, $2, ''),
              ('ord-young', 'ready', 'sent', $1::jsonb, $3, $3, '')`,
      [
        JSON.stringify([{ token: TOKEN("eski"), id: "tk-eski" }]),
        new Date(now - 25 * 3_600_000).toISOString(),
        new Date(now - 2 * 3_600_000).toISOString(),
      ],
    );
    vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
      if (String(url).endsWith("/push/send")) {
        return new Response(
          JSON.stringify({ data: tickets(JSON.parse(init.body).length) }),
          { status: 200 },
        );
      }
      return new Response("upstream down", { status: 503 });
    });
    const result = await push.checkPushReceipts();
    expect(result.read).toBe(0);
    const rows = await q(
      `select "orderId", tickets, "receiptsCheckedAt" from public.order_push_notices
        where "orderId" in ('ord-old', 'ord-young') order by "orderId"`,
    );
    expect(
      rows.rows.map((r) => [
        r.orderId,
        (r.tickets as unknown[]).length,
        r.receiptsCheckedAt !== "",
      ]),
    ).toEqual([
      ["ord-old", 0, true],
      ["ord-young", 0, true],
    ]);
  });
});

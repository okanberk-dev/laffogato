import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderOperatorNotice } from "@/lib/email/send";
import {
  buildStaffNoticeContent,
  firstName,
  normalizeNotifyRoles,
  parseNotifyEmails,
  resolveStaffRecipients,
  type RecipientSources,
  type StaffNoticeOrder,
} from "@/lib/email/staff-order-notice-core";

/**
 * The team's "yeni sipariş" mail: who gets it, what it says (and above all
 * what it does not say), and that it goes once per paid order.
 */

function sources(over: Partial<RecipientSources> = {}): RecipientSources {
  return {
    enabled: true,
    roles: ["owner", "manager", "cashier"],
    extraEmails: "",
    notificationEmail: "",
    panelUsers: [],
    envAdmins: [],
    ...over,
  };
}

describe("recipients", () => {
  it("are the active panel users whose role is ticked", () => {
    const out = resolveStaffRecipients(
      sources({
        roles: ["manager", "cashier"],
        panelUsers: [
          { email: "Sahip@Ornek.com", role: "owner", isActive: true },
          { email: "mudur@ornek.com", role: "manager", isActive: true },
          { email: "kasa@ornek.com", role: "cashier", isActive: true },
          { email: "eski@ornek.com", role: "manager", isActive: false },
          { email: "personel@ornek.com", role: "staff", isActive: true },
        ],
      }),
    );
    expect(out.map((r) => r.email).sort()).toEqual([
      "kasa@ornek.com",
      "mudur@ornek.com",
    ]);
  });

  it("point a cashier at the till, everyone else at the order", () => {
    const out = resolveStaffRecipients(
      sources({
        panelUsers: [
          { email: "kasa@ornek.com", role: "cashier", isActive: true },
          { email: "mudur@ornek.com", role: "manager", isActive: true },
        ],
      }),
    );
    const byEmail = Object.fromEntries(out.map((r) => [r.email, r]));
    expect(byEmail["kasa@ornek.com"].canOpenOrders).toBe(false);
    expect(byEmail["mudur@ornek.com"].canOpenOrders).toBe(true);
  });

  it("include the env break-glass admins by their env role", () => {
    const out = resolveStaffRecipients(
      sources({
        roles: ["owner"],
        envAdmins: [
          { email: "patron@ornek.com", role: "owner" },
          { email: "yedek@ornek.com", role: "staff" },
        ],
      }),
    );
    expect(out.map((r) => r.email)).toEqual(["patron@ornek.com"]);
  });

  it("let an active panel row decide an env admin's role, as the login does", () => {
    const out = resolveStaffRecipients(
      sources({
        roles: ["owner"],
        // Demoted in the panel: no longer an owner, so no owner mail.
        panelUsers: [
          { email: "patron@ornek.com", role: "cashier", isActive: true },
        ],
        envAdmins: [{ email: "patron@ornek.com", role: "owner" }],
      }),
    );
    expect(out).toEqual([]);
    // An INACTIVE panel row leaves the env account in charge.
    const back = resolveStaffRecipients(
      sources({
        roles: ["owner"],
        panelUsers: [
          { email: "patron@ornek.com", role: "cashier", isActive: false },
        ],
        envAdmins: [{ email: "patron@ornek.com", role: "owner" }],
      }),
    );
    expect(back.map((r) => r.email)).toEqual(["patron@ornek.com"]);
  });

  it("add the extra addresses and the operations address, lower-cased and once each", () => {
    const out = resolveStaffRecipients(
      sources({
        panelUsers: [
          { email: "Mudur@Ornek.com", role: "manager", isActive: true },
        ],
        extraEmails:
          "mutfak@ornek.com, MUDUR@ornek.com\nbar@ornek.com;mutfak@ornek.com",
        notificationEmail: "Info@Ornek.com",
      }),
    );
    expect(out.map((r) => r.email)).toEqual([
      "mudur@ornek.com",
      "mutfak@ornek.com",
      "bar@ornek.com",
      "info@ornek.com",
    ]);
  });

  it("drop invalid addresses instead of mailing them", () => {
    const out = resolveStaffRecipients(
      sources({
        extraEmails: "bu bir adres değil, @eksik.com, iyi@ornek.com, a@b",
        notificationEmail: "yok",
      }),
    );
    expect(out.map((r) => r.email)).toEqual(["iyi@ornek.com"]);
    expect(parseNotifyEmails("x@y.com, kötü").invalid).toEqual(["kötü"]);
  });

  it("are nobody while the switch is off", () => {
    expect(
      resolveStaffRecipients(
        sources({
          enabled: false,
          notificationEmail: "info@ornek.com",
          panelUsers: [
            { email: "m@ornek.com", role: "manager", isActive: true },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("trust only known roles from the stored list", () => {
    expect(normalizeNotifyRoles(["cashier", "root", "owner", "owner"])).toEqual(
      ["owner", "cashier"],
    );
    expect(normalizeNotifyRoles("owner")).toEqual([
      "owner",
      "manager",
      "cashier",
    ]);
    expect(normalizeNotifyRoles([])).toEqual([]);
  });
});

const ORDER: StaffNoticeOrder & Record<string, unknown> = {
  id: "ord-0900",
  orderNo: 10900,
  customerName: "Eda Nur Mancuso",
  // Everything below must stay out of the mail.
  customerEmail: "eda.mancuso@example.com",
  customerPhone: "+90 532 111 22 33",
  shippingAddress: "Postane Mah. Atatürk Cad. No: 28, Tuzla",
  channel: "app",
  kind: "cafe",
  fulfillment: "table",
  tableCode: "ABCDEFGH23",
  tableName: "Bahçe 3",
  scheduledFor: "",
  deliveryNote: "şekersiz olsun",
  totalMinor: 52000,
  items: [
    { productName: "Cappuccino", qty: 2, detail: "M · yulaf" },
    { productName: "San Sebastian", qty: 1 },
  ],
};

function rendered(order = ORDER, provider = "paynkolay") {
  const content = buildStaffNoticeContent(order, provider);
  const mail = renderOperatorNotice({
    ...content,
    to: "mudur@ornek.com",
    button: {
      label: "SİPARİŞİ AÇ",
      url: "https://laffogato.net/admin/siparisler/ord-0900",
    },
  });
  return { content, all: `${mail.subject}\n${mail.html}\n${mail.text}` };
}

describe("content", () => {
  it("says what to make, where it goes, what it cost and how it was paid", () => {
    const { content, all } = rendered();
    expect(content.subject).toContain("#10900");
    expect(content.subject).toContain("Masa: Bahçe 3");
    expect(all).toContain("2 × Cappuccino (M · yulaf)");
    expect(all).toContain("1 × San Sebastian");
    expect(all).toContain("Uygulama");
    expect(all).toContain("Kafe");
    expect(all).toContain("Kart (PayNkolay)");
    expect(all).toContain("520,00");
    expect(all).toContain("şekersiz olsun");
  });

  it("names the customer by first name only - no surname, phone, e-mail or address", () => {
    const { all } = rendered();
    expect(all).toContain("Eda");
    expect(all).not.toContain("Mancuso");
    expect(all).not.toContain("Nur");
    expect(all).not.toContain("eda.mancuso@example.com");
    expect(all).not.toContain("532");
    expect(all).not.toContain("Postane");
    expect(firstName("  Ali  Veli ")).toBe("Ali");
  });

  it("drops a 'name' that is really an address or a phone number", () => {
    expect(firstName("eda.mancuso@example.com")).toBe("");
    expect(firstName("05321112233")).toBe("");
    expect(firstName("+905321112233 Eda")).toBe("");
    const { all } = rendered({ ...ORDER, customerName: "eda@example.com" });
    expect(all).not.toContain("eda@example.com");
  });

  it("leaves a courier order's note out: it carries the door code", () => {
    const courier = {
      ...ORDER,
      fulfillment: "delivery",
      tableCode: "",
      tableName: "",
      deliveryNote: "Kapı kodu 4821 · acil",
    };
    const { all } = rendered(courier);
    expect(all).not.toContain("4821");
    expect(all).toContain("Kurye");
  });

  it("prints a scheduled order's time on the köşk's clock", () => {
    const pickup = {
      ...ORDER,
      fulfillment: "pickup",
      tableCode: "",
      tableName: "",
      scheduledFor: "2026-10-16T06:30:00.000Z",
    };
    const { all } = rendered(pickup);
    expect(all).toContain("09:30");
    expect(all).toContain("Gel-al");
  });
});

// ── once per order ────────────────────────────────────────────────────────

const {
  claimOrderNotice,
  settleOrderNotice,
  deliverBatch,
  getSettings,
  getOrder,
  listAdminUsers,
} = vi.hoisted(() => ({
  claimOrderNotice: vi.fn(),
  settleOrderNotice: vi.fn(async () => {}),
  deliverBatch: vi.fn(),
  getSettings: vi.fn(),
  getOrder: vi.fn(),
  listAdminUsers: vi.fn(),
}));

vi.mock("@/lib/email/order-notices", () => ({
  claimOrderNotice,
  settleOrderNotice,
}));
vi.mock("@/lib/email/send", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/send")>()),
  deliverBatch,
}));
vi.mock("@/lib/admin/store", () => ({ getSettings, getOrder }));
vi.mock("@/lib/admin/users", () => ({ listAdminUsers }));
vi.mock("@/lib/admin/auth", () => ({
  listEnvAdminContacts: () => [{ email: "patron@ornek.com", role: "owner" }],
}));

const { notifyStaffNewOrder, STAFF_NEW_ORDER_KIND, FRESH_MS } =
  await import("@/lib/email/staff-order-notice");

const SETTINGS = {
  orderNotifyEnabled: true,
  orderNotifyRoles: ["owner", "manager", "cashier"],
  orderNotifyEmails: "mutfak@ornek.com",
  notificationEmail: "",
};

const NOW = Date.parse("2026-10-15T10:05:00.000Z");
const PAID_AT = "2026-10-15T10:04:00.000Z";
const sleeps: number[] = [];
const deps = {
  sleep: async (ms: number) => {
    sleeps.push(ms);
  },
  now: () => NOW,
};
const notify = (orderId = "ord-0900") =>
  notifyStaffNewOrder(orderId, { provider: "paynkolay" }, deps);

type Batch = Array<{ to: string; subject: string; html: string; text: string }>;
const batchCalls = () =>
  deliverBatch.mock.calls.map((c) => ({
    messages: c[0] as Batch,
    key: c[1] as string,
  }));

beforeEach(() => {
  sleeps.length = 0;
  process.env.RESEND_API_KEY = "re_test";
  claimOrderNotice.mockReset();
  claimOrderNotice.mockResolvedValue(true);
  settleOrderNotice.mockClear();
  deliverBatch.mockReset();
  deliverBatch.mockResolvedValue({ ok: true, ids: [] });
  getSettings.mockReset();
  getSettings.mockResolvedValue(SETTINGS);
  getOrder.mockReset();
  getOrder.mockResolvedValue({ ...ORDER, status: "paid", paidAt: PAID_AT });
  listAdminUsers.mockReset();
  listAdminUsers.mockResolvedValue([
    { email: "kasa@ornek.com", role: "cashier", isActive: true },
  ]);
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
});

describe("notifyStaffNewOrder", () => {
  it("claims the order once and mails every recipient in one request", async () => {
    expect(await notify()).toBe("sent");
    expect(claimOrderNotice).toHaveBeenCalledWith(
      "ord-0900",
      STAFF_NEW_ORDER_KIND,
    );
    expect(STAFF_NEW_ORDER_KIND).toBe("staff-new");
    const calls = batchCalls();
    expect(calls).toHaveLength(1);
    const [{ messages, key }] = calls;
    expect(messages.map((m) => m.to).sort()).toEqual([
      "kasa@ornek.com",
      "mutfak@ornek.com",
      "patron@ornek.com",
    ]);
    expect(key).toMatch(/^order-ord-0900-staff-new-[0-9a-f]{16}-b0$/);
    // The key never carries an address.
    expect(key).not.toContain("@");
    const cashier = messages.find((m) => m.to === "kasa@ornek.com");
    expect(cashier?.html).toContain("/admin/kasa");
    expect(cashier?.html).not.toContain("/admin/siparisler/ord-0900");
    const owner = messages.find((m) => m.to === "patron@ornek.com");
    expect(owner?.html).toContain("/admin/siparisler/ord-0900");
    expect(settleOrderNotice).toHaveBeenCalledWith("ord-0900", "staff-new", {
      ok: true,
    });
    expect(sleeps).toEqual([]);
  });

  it("keeps the key when the list is the same and changes it when the list does", async () => {
    await notify();
    getSettings.mockResolvedValue({
      ...SETTINGS,
      orderNotifyEmails: "bar@ornek.com",
    });
    await notify();
    getSettings.mockResolvedValue(SETTINGS);
    await notify();
    const [a, b, c] = batchCalls().map((x) => x.key);
    expect(a).toBe(c);
    expect(a).not.toBe(b);
  });

  it("does not send one request per recipient however long the list", async () => {
    const extra = Array.from({ length: 20 }, (_, i) => `ek${i}@ornek.com`);
    getSettings.mockResolvedValue({
      ...SETTINGS,
      orderNotifyEmails: extra.join("\n"),
    });
    expect(await notify()).toBe("sent");
    expect(deliverBatch).toHaveBeenCalledTimes(1);
    expect(batchCalls()[0].messages).toHaveLength(22);
  });

  it("retries a rate-limited request with the same key, then counts it delivered", async () => {
    deliverBatch
      .mockResolvedValueOnce({
        ok: false,
        error: "Too many requests",
        status: 429,
        retryAfterMs: 1_500,
      })
      .mockResolvedValueOnce({ ok: false, error: "bad gateway", status: 502 })
      .mockResolvedValueOnce({ ok: true, ids: [] });
    expect(await notify()).toBe("sent");
    const keys = batchCalls().map((c) => c.key);
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
    // Retry-After honoured, then the default pause.
    expect(sleeps).toEqual([1_500, 2_500]);
    expect(settleOrderNotice).toHaveBeenCalledWith("ord-0900", "staff-new", {
      ok: true,
    });
  });

  it("caps a long Retry-After instead of waiting it out in after()", async () => {
    deliverBatch
      .mockResolvedValueOnce({
        ok: false,
        error: "slow down",
        status: 429,
        retryAfterMs: 60_000,
      })
      .mockResolvedValueOnce({ ok: true, ids: [] });
    expect(await notify()).toBe("sent");
    expect(sleeps).toEqual([3_000]);
  });

  it("does not retry what a retry cannot fix", async () => {
    deliverBatch.mockResolvedValue({
      ok: false,
      error: "domain not verified",
      status: 403,
    });
    expect(await notify()).toBe("failed");
    expect(deliverBatch).toHaveBeenCalledTimes(1);
    delete process.env.RESEND_API_KEY;
    deliverBatch.mockClear();
    deliverBatch.mockResolvedValue({
      ok: false,
      error: "RESEND_API_KEY tanımlı değil.",
      status: 0,
    });
    expect(await notify()).toBe("failed");
    expect(deliverBatch).toHaveBeenCalledTimes(1);
  });

  it("releases the claim when every attempt failed, so a later confirmation can retry", async () => {
    deliverBatch.mockResolvedValue({ ok: false, error: "down", status: 503 });
    expect(await notify()).toBe("failed");
    expect(deliverBatch).toHaveBeenCalledTimes(3);
    expect(settleOrderNotice).toHaveBeenCalledWith(
      "ord-0900",
      "staff-new",
      expect.objectContaining({ ok: false }),
    );
  });

  it("goes out for a member who typed brackets into the name or the note", async () => {
    getOrder.mockResolvedValue({
      ...ORDER,
      status: "paid",
      paidAt: PAID_AT,
      customerName: "[BUTON_URL] Veli",
      deliveryNote: "Şekersiz [OK] masa [2]",
      items: [{ productName: "Kahve [250G]", qty: 1, detail: "[AD]" }],
    });
    expect(await notify()).toBe("sent");
    const [{ messages }] = batchCalls();
    const owner = messages.find((m) => m.to === "patron@ornek.com");
    expect(owner?.text).toContain("Şekersiz [OK] masa [2]");
    expect(owner?.text).toContain("Kahve [250G] ([AD])");
    // The name is text, not the button's link.
    expect(owner?.html).toContain("[BUTON_URL]");
  });

  it("sends nothing when another trigger already claimed the order", async () => {
    claimOrderNotice.mockResolvedValue(false);
    expect(await notify()).toBe("duplicate");
    expect(deliverBatch).not.toHaveBeenCalled();
  });

  it("sends nothing for an order that is not paid", async () => {
    getOrder.mockResolvedValue({ ...ORDER, status: "pending_payment" });
    expect(await notify()).toBe("not_due");
    expect(claimOrderNotice).not.toHaveBeenCalled();
    getOrder.mockResolvedValue({
      ...ORDER,
      status: "cancelled",
      paidAt: PAID_AT,
    });
    expect(await notify()).toBe("not_due");
  });

  it("sends nothing once the order is no longer news", async () => {
    getOrder.mockResolvedValue({
      ...ORDER,
      status: "paid",
      paidAt: new Date(NOW - FRESH_MS - 1_000).toISOString(),
    });
    expect(await notify()).toBe("not_due");
    getOrder.mockResolvedValue({ ...ORDER, status: "paid", paidAt: "" });
    expect(await notify()).toBe("not_due");
    expect(claimOrderNotice).not.toHaveBeenCalled();
  });

  it("sends nothing while the switch is off", async () => {
    getSettings.mockResolvedValue({ ...SETTINGS, orderNotifyEnabled: false });
    expect(await notify()).toBe("not_due");
    expect(claimOrderNotice).not.toHaveBeenCalled();
  });

  it("never throws into the payment it follows", async () => {
    getSettings.mockRejectedValue(new Error("db down"));
    await expect(notify()).resolves.toBe("failed");
    getSettings.mockResolvedValue(SETTINGS);
    deliverBatch.mockRejectedValue(new Error("boom"));
    await expect(notify()).resolves.toBe("failed");
    expect(settleOrderNotice).toHaveBeenLastCalledWith(
      "ord-0900",
      "staff-new",
      expect.objectContaining({ ok: false }),
    );
  });
});

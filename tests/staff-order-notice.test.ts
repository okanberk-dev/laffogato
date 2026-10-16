import { beforeEach, describe, expect, it, vi } from "vitest";

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
  sendOperatorNotice,
  getSettings,
  getOrder,
  listAdminUsers,
} = vi.hoisted(() => ({
  claimOrderNotice: vi.fn(),
  settleOrderNotice: vi.fn(async () => {}),
  sendOperatorNotice: vi.fn(),
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
  sendOperatorNotice,
}));
vi.mock("@/lib/admin/store", () => ({ getSettings, getOrder }));
vi.mock("@/lib/admin/users", () => ({ listAdminUsers }));
vi.mock("@/lib/admin/auth", () => ({
  listEnvAdminContacts: () => [{ email: "patron@ornek.com", role: "owner" }],
}));

const { notifyStaffNewOrder, STAFF_NEW_ORDER_KIND } =
  await import("@/lib/email/staff-order-notice");

const SETTINGS = {
  orderNotifyEnabled: true,
  orderNotifyRoles: ["owner", "manager", "cashier"],
  orderNotifyEmails: "mutfak@ornek.com",
  notificationEmail: "",
};

beforeEach(() => {
  claimOrderNotice.mockReset();
  claimOrderNotice.mockResolvedValue(true);
  settleOrderNotice.mockClear();
  sendOperatorNotice.mockReset();
  sendOperatorNotice.mockResolvedValue({ ok: true });
  getSettings.mockReset();
  getSettings.mockResolvedValue(SETTINGS);
  getOrder.mockReset();
  getOrder.mockResolvedValue({ ...ORDER, status: "paid" });
  listAdminUsers.mockReset();
  listAdminUsers.mockResolvedValue([
    { email: "kasa@ornek.com", role: "cashier", isActive: true },
  ]);
});

describe("notifyStaffNewOrder", () => {
  it("claims the order once and mails each recipient with its own key", async () => {
    const out = await notifyStaffNewOrder("ord-0900", {
      provider: "paynkolay",
    });
    expect(out).toBe("sent");
    expect(claimOrderNotice).toHaveBeenCalledWith(
      "ord-0900",
      STAFF_NEW_ORDER_KIND,
    );
    expect(STAFF_NEW_ORDER_KIND).toBe("staff-new");
    const calls = sendOperatorNotice.mock.calls.map(
      (c) =>
        c[0] as { to: string; idempotencyKey: string; button: { url: string } },
    );
    expect(calls.map((c) => c.to).sort()).toEqual([
      "kasa@ornek.com",
      "mutfak@ornek.com",
      "patron@ornek.com",
    ]);
    const keys = new Set(calls.map((c) => c.idempotencyKey));
    expect(keys.size).toBe(3);
    for (const key of keys)
      expect(key).toMatch(/^order-ord-0900-staff-new-[0-9a-f]{16}$/);
    // The key never carries the address itself.
    for (const c of calls) expect(c.idempotencyKey).not.toContain("@");
    const cashier = calls.find((c) => c.to === "kasa@ornek.com");
    expect(cashier?.button.url).toMatch(/\/admin\/kasa$/);
    const owner = calls.find((c) => c.to === "patron@ornek.com");
    expect(owner?.button.url).toMatch(/\/admin\/siparisler\/ord-0900$/);
    expect(settleOrderNotice).toHaveBeenCalledWith("ord-0900", "staff-new", {
      ok: true,
    });
  });

  it("sends nothing when another trigger already claimed the order", async () => {
    claimOrderNotice.mockResolvedValue(false);
    expect(
      await notifyStaffNewOrder("ord-0900", { provider: "paynkolay" }),
    ).toBe("duplicate");
    expect(sendOperatorNotice).not.toHaveBeenCalled();
  });

  it("sends nothing for an order that is not paid", async () => {
    getOrder.mockResolvedValue({ ...ORDER, status: "pending_payment" });
    expect(
      await notifyStaffNewOrder("ord-0900", { provider: "paynkolay" }),
    ).toBe("not_due");
    expect(claimOrderNotice).not.toHaveBeenCalled();
    getOrder.mockResolvedValue({ ...ORDER, status: "cancelled" });
    expect(
      await notifyStaffNewOrder("ord-0900", { provider: "paynkolay" }),
    ).toBe("not_due");
  });

  it("sends nothing while the switch is off", async () => {
    getSettings.mockResolvedValue({ ...SETTINGS, orderNotifyEnabled: false });
    expect(
      await notifyStaffNewOrder("ord-0900", { provider: "paynkolay" }),
    ).toBe("not_due");
    expect(claimOrderNotice).not.toHaveBeenCalled();
  });

  it("hands the claim back when no inbox could be reached", async () => {
    sendOperatorNotice.mockResolvedValue({ ok: false, error: "down" });
    expect(
      await notifyStaffNewOrder("ord-0900", { provider: "paynkolay" }),
    ).toBe("failed");
    expect(settleOrderNotice).toHaveBeenCalledWith(
      "ord-0900",
      "staff-new",
      expect.objectContaining({ ok: false }),
    );
  });

  it("never throws into the payment it follows", async () => {
    getSettings.mockRejectedValue(new Error("db down"));
    await expect(
      notifyStaffNewOrder("ord-0900", { provider: "paynkolay" }),
    ).resolves.toBe("failed");
  });
});

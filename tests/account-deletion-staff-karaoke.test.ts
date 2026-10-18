import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The team's mail about an opened web deletion request names the member's
 * paid karaoke bookings with their start and their refund (ASK-Y3-4 (d)):
 * closed before the start, the refund needs nobody's judgement. The
 * notifier reads the bookings itself, so the member's action does not
 * change; a booking list it cannot read is said, never skipped silently.
 */

const h = vi.hoisted(() => ({
  bookings: [] as Record<string, unknown>[],
  listFails: false,
  listCalls: 0,
  notices: [] as Array<{
    rows: Array<{ label: string; value: string }>;
    footnote: string;
  }>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/auth", () => ({ listEnvAdminContacts: () => [] }));
vi.mock("@/lib/admin/store", () => ({
  getSettings: vi.fn(async () => ({
    notificationEmail: "ops@laffogato.net",
    email: "",
  })),
}));
vi.mock("@/lib/admin/users", () => ({ listAdminUsers: vi.fn(async () => []) }));
vi.mock("@/lib/mobile/karaoke", () => ({
  listMine: vi.fn(async () => {
    h.listCalls += 1;
    if (h.listFails) throw new Error("db down");
    return h.bookings;
  }),
}));
vi.mock("@/lib/email/send", () => ({
  renderOperatorNotice: vi.fn(
    (n: {
      rows: Array<{ label: string; value: string }>;
      footnote: string;
    }) => {
      h.notices.push({ rows: n.rows, footnote: n.footnote });
      return { subject: "s", html: "h", text: "t" };
    },
  ),
  deliverBatch: vi.fn(async () => ({ ok: true, ids: ["1"] })),
}));

const { notifyStaffOfDeletionRequest } =
  await import("@/lib/email/account-deletion-notice");

// Asked at 12:15 on 18 Ekim (Tuzla).
const AT = "2026-10-18T09:15:00.000Z";
const input = {
  kind: "opened" as const,
  customerId: "cus-0042",
  name: "Eda Yılmaz",
  email: "eda@example.com",
  requestedAt: AT,
  hasReason: false,
};

function booking(over: Record<string, unknown> = {}) {
  return {
    id: "krk-00042",
    customerEmail: "eda@example.com",
    date: "2026-10-30",
    startHour: 20,
    hours: 2,
    status: "confirmed",
    paymentStatus: "paid",
    paidMinor: 200_000,
    createdAt: "2026-10-10T09:00:00.000Z",
    guest: false,
    ...over,
  };
}

const karaokeRows = () =>
  h.notices.at(-1)!.rows.filter((r) => r.label === "Ödenmiş karaoke");

beforeEach(() => {
  h.bookings = [];
  h.listFails = false;
  h.listCalls = 0;
  h.notices.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(AT));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the team's mail names the paid karaoke", () => {
  it("by its start and its refund, so the account is closed before it", async () => {
    h.bookings = [
      booking(),
      // Paid at the venue: no money for the closure to send back.
      booking({ id: "krk-00043", paymentStatus: "none", paidMinor: 0 }),
      // Sung last week.
      booking({ id: "krk-00044", date: "2026-10-11" }),
    ];
    await expect(notifyStaffOfDeletionRequest(input)).resolves.toBe(true);
    expect(karaokeRows()).toEqual([
      {
        label: "Ödenmiş karaoke",
        value: "30 Ekim 2026, 20:00 - 22:00 (tam iade)",
      },
    ]);
    expect(h.notices.at(-1)!.footnote).toContain(
      "ilk rezervasyonun başlangıç saatinden önce kapat",
    );
  });

  it("says nothing of karaoke when there is none", async () => {
    await notifyStaffOfDeletionRequest(input);
    expect(karaokeRows()).toEqual([]);
    expect(h.notices.at(-1)!.footnote).not.toContain("karaoke");
  });

  it("still mails, and says so, when the bookings cannot be read", async () => {
    h.listFails = true;
    await expect(notifyStaffOfDeletionRequest(input)).resolves.toBe(true);
    expect(karaokeRows()).toEqual([
      { label: "Ödenmiş karaoke", value: "Okunamadı, panelde bak" },
    ]);
    expect(h.notices.at(-1)!.footnote).toContain(
      "Karaoke rezervasyonları okunamadı",
    );
  });

  it("does not read the bookings for a request taken back", async () => {
    h.bookings = [booking()];
    await notifyStaffOfDeletionRequest({ ...input, kind: "withdrawn" });
    expect(h.listCalls).toBe(0);
    expect(karaokeRows()).toEqual([]);
  });
});

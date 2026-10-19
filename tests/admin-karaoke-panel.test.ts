import { existsSync, readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { KaraokeReservation } from "@/lib/mobile/karaoke-core";

/**
 * The karaoke panel (/admin/mobil/karaoke, 17 Eki 2026) as the köşk reads it:
 * which badge, which warning, which buttons, which tab and which history a
 * booking gets. All of it is one pure module (lib/admin/karaoke-panel.ts), so
 * the list, the booking's page and the dashboard card cannot disagree; the
 * bugs it closes are named in each block (map-admin-other §2).
 */

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
  }) => createElement("a", { href, ...rest }, children),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  unstable_rethrow: vi.fn(),
}));
vi.mock("@/app/admin/mobil/karaoke/actions", () => ({
  cancelReservationAction: vi.fn(),
  confirmReservationAction: vi.fn(),
  retryKaraokeRefundAction: vi.fn(),
  settleKaraokeRefundAction: vi.fn(),
}));

const panel = await import("@/lib/admin/karaoke-panel");
const { paymentStatusOf, KARAOKE_PAYMENT_STATUSES } =
  await import("@/lib/mobile/karaoke-core");
const { formatReservationTime } = await import("@/lib/mobile/karaoke-format");
const { KaraokeActions, KaraokeBadges, unpaidCancelText } =
  await import("@/components/admin/karaoke-panel");
const { KaraokeTodayCard } =
  await import("@/components/admin/karaoke-today-card");
const { activeNavHref } = await import("@/lib/admin/nav-match");
const { canAccess, sectionsFor } = await import("@/lib/admin/roles");

const read = (p: string) => readFileSync(p, "utf8");
const html = (node: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(node);

// 15:00 in Tuzla on 17 Ekim; the booking is tonight 20:00 - 22:00.
const NOW = new Date("2026-10-17T12:00:00.000Z");
const TODAY = "2026-10-17";
const CTX = { today: TODAY, now: NOW, prepay: true, canRefund: true };

function booking(over: Partial<KaraokeReservation> = {}): KaraokeReservation {
  return {
    id: "krk-00042",
    customerEmail: "eda@example.com",
    customerName: "Eda Yılmaz",
    date: TODAY,
    startHour: 20,
    hours: 2,
    guests: 4,
    status: "confirmed",
    priceMinor: 200_000,
    discountMinor: 0,
    totalMinor: 200_000,
    note: "",
    createdAt: "2026-10-16T10:00:00.000Z",
    updatedAt: "2026-10-16T10:05:00.000Z",
    contactPhone: "+905321234567",
    paymentStatus: "paid",
    paymentDueAt: "2026-10-16T10:30:00.000Z",
    paidAt: "2026-10-16T10:05:00.000Z",
    paidMinor: 200_000,
    paymentRef: "PNK2026101612345",
    channel: "web",
    ...over,
  };
}

const view = (
  over: Partial<KaraokeReservation> = {},
  ctx: Partial<Parameters<typeof panel.karaokeRowView>[1]> = {},
  sameDay: KaraokeReservation[] = [],
) => panel.karaokeRowView(booking(over), { ...CTX, ...ctx }, sameDay);

describe("money state", () => {
  it("reads the payment column exactly like karaoke-core", () => {
    for (const s of [...KARAOKE_PAYMENT_STATUSES, undefined, "junk"]) {
      const r = { paymentStatus: s as KaraokeReservation["paymentStatus"] };
      expect(panel.moneyOf(r)).toBe(paymentStatusOf(r));
    }
  });

  it("refunds what was collected", () => {
    expect(
      panel.refundAmountMinor({ paidMinor: 150_000, totalMinor: 200_000 }),
    ).toBe(150_000);
    expect(panel.refundAmountMinor({ paidMinor: 0, totalMinor: 200_000 })).toBe(
      200_000,
    );
  });
});

describe("bug 11: one time format", () => {
  it("is formatReservationTime, and the page's own copy is gone", () => {
    expect(view().time).toBe(formatReservationTime(20, 2));
    expect(view().time).toBe("20:00 - 22:00");
    const page = read("src/app/admin/mobil/karaoke/page.tsx");
    expect(page).not.toMatch(/function hourRange/);
  });
});

describe("bug 6: a hold the köşk cancelled does not vanish", () => {
  const released = booking({
    id: "krk-00007",
    status: "cancelled",
    paymentStatus: "expired",
    paidAt: "",
    paidMinor: 0,
    paymentRef: "",
  });
  const lapsed = { ...released, id: "krk-00008" };
  const audit = [
    {
      entityId: "krk-00007",
      action: "transition",
      payload: { status: "cancelled", paymentStatus: "expired", by: "staff" },
    },
    // The member's own unfinished checkout and a confirm: not a köşk release.
    {
      entityId: "krk-00008",
      action: "transition",
      payload: { status: "cancelled", paymentStatus: "expired", by: "member" },
    },
    {
      entityId: "krk-00009",
      action: "transition",
      payload: { status: "confirmed" },
    },
  ];

  it("tells a staff release from a lapse by its audit row", () => {
    const ids = panel.staffReleasedIds(audit);
    expect([...ids]).toEqual(["krk-00007"]);
    expect(panel.isLapsedHold(released, ids)).toBe(false);
    expect(panel.isLapsedHold(lapsed, ids)).toBe(true);
    // Without the log, every release reads as a lapse (the old list).
    expect(panel.isLapsedHold(released)).toBe(true);
    expect(panel.isLapsedHold(booking())).toBe(false);
  });

  it("a hold let go without the POS's answer is never 'unpaid' and never hidden (rule 29)", () => {
    const unknown = { ...released, id: "krk-00010" };
    const ids = panel.unverifiedReleaseIds([
      {
        entityId: "krk-00010",
        action: "update",
        payload: { event: "hold_released_payment_unknown" },
      },
      {
        entityId: "krk-00011",
        action: "update",
        payload: { event: "account_closed_payment_unknown" },
      },
      // Another money alert: not a release.
      {
        entityId: "krk-00012",
        action: "update",
        payload: { event: "cancel_refund_unknown" },
      },
    ]);
    expect([...ids].sort()).toEqual(["krk-00010", "krk-00011"]);
    expect(panel.isLapsedHold(unknown, new Set(), ids)).toBe(false);
    const v = panel.karaokeRowView(unknown, { ...CTX, unverified: ids });
    expect(v.paymentLabel).toBe("Ödeme doğrulanamadı");
    expect(v.paymentTone).toBe("warning");
    const list = panel.karaokeList([v], {
      tab: "iptal",
      filters: {},
      sort: panel.defaultKaraokeSort("iptal"),
      page: 1,
      today: TODAY,
    });
    expect(list.rows.map((x) => x.r.id)).toEqual(["krk-00010"]);
    expect(list.hiddenLapsed).toBe(0);
    // Only a released hold reads so: the same event on a paid row changes nothing.
    expect(
      panel.karaokeRowView(booking({ id: "krk-00010" }), {
        ...CTX,
        unverified: ids,
      }).paymentLabel,
    ).toBe("Ödendi");
  });

  it("lists the köşk's release under İptal / İade and hides the lapse with a count", () => {
    const views = panel.karaokeRowViews([released, lapsed], {
      ...CTX,
      staffReleased: panel.staffReleasedIds(audit),
    });
    expect(views[0]!.paymentLabel).toBe("Ödeme alınmamıştı");
    expect(views[1]!.paymentLabel).toBe("Ödenmedi, süresi doldu");
    const list = panel.karaokeList(views, {
      tab: "iptal",
      filters: {},
      sort: panel.defaultKaraokeSort("iptal"),
      page: 1,
      today: TODAY,
    });
    expect(list.rows.map((v) => v.r.id)).toEqual(["krk-00007"]);
    expect(list.hiddenLapsed).toBe(1);
    expect(list.counts.iptal).toBe(1);

    const asked = panel.karaokeList(views, {
      tab: "iptal",
      filters: { odeme: "expired" },
      sort: panel.defaultKaraokeSort("iptal"),
      page: 1,
      today: TODAY,
    });
    expect(asked.rows.map((v) => v.r.id).sort()).toEqual([
      "krk-00007",
      "krk-00008",
    ]);
  });
});

describe("bug 10: a cancelled booking still paid is a refund owed", () => {
  const v = view({ status: "cancelled" });

  it("is flagged on the row and in Dikkat", () => {
    expect(v.attention).toContain("refund_owed");
    expect(v.refundOwed).toBe(true);
    expect(panel.inKaraokeTab(v, "dikkat", TODAY)).toBe(true);
    expect(panel.inKaraokeTab(v, "iptal", TODAY)).toBe(true);
    expect(html(createElement(KaraokeBadges, { view: v }))).toContain(
      "İade borcu",
    );
  });

  it("matches the İade borcu payment filter", () => {
    expect(panel.matchesKaraokeFilters(v, { odeme: "borc" })).toBe(true);
    expect(panel.matchesKaraokeFilters(view(), { odeme: "borc" })).toBe(false);
  });
});

describe("bug 2: a cancelled + paid row is refunded first, or recorded", () => {
  it("offers 'İadeyi başlat' (not a retry) and 'PayNkolay'da iade edildi'", () => {
    const plan = view({ status: "cancelled" }).plan;
    expect(plan.refund).toEqual({ kind: "first" });
    expect(plan.settle).toEqual({ kind: "after_cancel" });
    expect(plan.cancel).toBeNull();
    const markup = html(
      createElement(KaraokeActions, {
        view: view({ status: "cancelled" }),
        layout: "page",
      }),
    );
    expect(markup).toContain("İadeyi başlat");
    expect(markup).toContain("PayNkolay&#x27;da iade edildi");
    expect(markup).not.toContain("İadeyi yeniden dene");
  });

  it("an unanswered refund offers the retry and 'İade POS'ta görüldü'", () => {
    const plan = view({ paymentStatus: "refunding" }).plan;
    expect(plan.refund).toEqual({ kind: "retry" });
    expect(plan.settle).toEqual({ kind: "pending_answer" });
    expect(view({ paymentStatus: "refunding" }).attention).toContain(
      "refund_pending",
    );
  });
});

describe("bugs 1, 3, 5: one dialog per action, each asks first", () => {
  const triggers = (markup: string) =>
    markup.match(/aria-haspopup="dialog"/g)?.length ?? 0;

  it("every action is its own dialog trigger: no shared result line", () => {
    const markup = html(
      createElement(KaraokeActions, {
        view: view({ status: "cancelled" }),
        layout: "page",
      }),
    );
    expect(triggers(markup)).toBe(2);
    // The old row printed a merged message under its buttons.
    expect(markup).not.toMatch(/role="status"/);
    expect(
      existsSync("src/components/admin/karaoke-reservation-actions.tsx"),
    ).toBe(false);
  });

  it("the refund retry opens a dialog rather than moving money on click", () => {
    const markup = html(
      createElement(KaraokeActions, {
        view: view({ paymentStatus: "refunding" }),
        layout: "page",
      }),
    );
    expect(markup).toMatch(/aria-haspopup="dialog"[^>]*>İadeyi yeniden dene</);
  });

  it("cancelling an unpaid booking opens a dialog too", () => {
    for (const money of ["none", "pending"] as const) {
      const v = view(
        { status: "requested", paymentStatus: money, paidMinor: 0 },
        { prepay: false },
      );
      expect(v.plan.cancel?.kind).toBe(money === "none" ? "plain" : "hold");
      const markup = html(
        createElement(KaraokeActions, { view: v, layout: "page" }),
      );
      expect(markup).toMatch(/aria-haspopup="dialog"[^>]*>İptal et</);
    }
  });
});

describe("Personel sees money actions off, with the reason", () => {
  it("draws them disabled instead of hiding them", () => {
    const v = view({}, { canRefund: false });
    expect(v.plan.cancel).toEqual({
      kind: "refund",
      disabledReason: panel.REFUND_PERMISSION_REASON,
    });
    const markup = html(
      createElement(KaraokeActions, { view: v, layout: "page" }),
    );
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain(panel.REFUND_PERMISSION_REASON);
  });

  it("keeps the non-money actions open", () => {
    const v = view(
      { status: "requested", paymentStatus: "none", paidMinor: 0 },
      { canRefund: false, prepay: false },
    );
    expect(v.plan.confirm).toEqual({});
    expect(v.plan.cancel).toEqual({ kind: "plain" });
  });
});

describe("bug 7: an old pay-at-the-venue request while prepayment is on", () => {
  const v = view({ status: "requested", paymentStatus: "none", paidMinor: 0 });

  it("is never offered Onayla, is explained and can be cancelled", () => {
    expect(v.plan.confirm).toBeNull();
    expect(v.plan.cancel).toEqual({ kind: "plain" });
    expect(v.attention).toEqual(["venue_request"]);
    expect(panel.KARAOKE_ATTENTION.venue_request.text).toMatch(/onaylanmaz/);
  });

  it("with prepayment off it is the normal request, confirmed by hand", () => {
    const off = view(
      { status: "requested", paymentStatus: "none", paidMinor: 0 },
      { prepay: false },
    );
    expect(off.plan.confirm).toEqual({});
    expect(off.attention).toEqual(["awaiting_confirm"]);
  });
});

describe("bug 8: paid but still a request (the hour was lost)", () => {
  const other = booking({
    id: "krk-00041",
    status: "confirmed",
    startHour: 21,
    hours: 1,
  });

  it("explains, disables Onayla and offers cancel + refund", () => {
    const v = view({ status: "requested" }, {}, [other]);
    expect(v.attention).toEqual(["slot_lost"]);
    expect(v.plan.confirm?.disabledReason).toMatch(/başka bir onaylı/);
    expect(v.plan.cancel).toEqual({ kind: "refund" });
  });

  it("a free hour may simply be confirmed", () => {
    const free = view({ status: "requested" }, {}, [
      { ...other, startHour: 18, hours: 2 },
    ]);
    expect(free.attention).toEqual(["confirm_pending"]);
    expect(free.plan.confirm).toEqual({});
  });

  it("once the evening is over it asks for the refund, not a confirm", () => {
    const past = view({ status: "requested", date: "2026-10-16" });
    expect(past.attention).toEqual(["paid_unconfirmed_past"]);
    expect(past.plan.confirm).toBeNull();
    expect(past.plan.cancel).toEqual({ kind: "refund" });
  });
});

describe("KAR-13: an evening that is over (karar D7)", () => {
  it("offers no Onayla, and writes off a pay-at-the-venue one without a mail", () => {
    const past = view(
      {
        status: "confirmed",
        paymentStatus: "none",
        paidMinor: 0,
        date: "2026-10-10",
      },
      { prepay: false },
    );
    expect(past.plan.confirm).toBeNull();
    expect(past.plan.cancel).toEqual({ kind: "plain", ended: true });
    const text = unpaidCancelText(past.plan.cancel!);
    expect(text.title).toBe("Geçmiş rezervasyonu iptal et");
    expect(text.description).toContain("müşteriye e-posta gitmez");
    expect(text.description).not.toContain("iptal e-postası gider");
    // Still a dialog that asks first.
    const markup = html(
      createElement(KaraokeActions, { view: past, layout: "page" }),
    );
    expect(markup).toMatch(/aria-haspopup="dialog"[^>]*>İptal et</);
  });

  it("a request still to come keeps the mail in its dialog", () => {
    const v = view(
      { status: "requested", paymentStatus: "none", paidMinor: 0 },
      { prepay: false },
    );
    expect(v.plan.cancel).toEqual({ kind: "plain" });
    expect(unpaidCancelText(v.plan.cancel!).description).toContain(
      "müşteriye iptal e-postası gider",
    );
  });

  it("a paid evening that is over is still refunded in full by the köşk", () => {
    const v = view({ status: "requested", date: "2026-10-10" });
    expect(v.plan.cancel).toEqual({ kind: "refund" });
  });

  it("the history says the write-off sent no mail", () => {
    const items = panel.karaokeHistory(booking(), [
      {
        id: "aud-1",
        entityId: "krk-00042",
        actor: "kosk@laffogato",
        action: "transition",
        payload: { status: "cancelled", by: "staff", ended: true },
        createdAt: "2026-10-17T10:00:00.000Z",
      },
    ]);
    expect(items.map((i) => i.title)).toContain(
      "İptal edildi (saati geçmişti, müşteriye e-posta gitmedi)",
    );
  });
});

describe("bug 9: payment evidence", () => {
  it("masks the POS reference to its ends", () => {
    expect(panel.maskPaymentRef("PNK2026101612345")).toBe("PN…2345");
    expect(panel.maskPaymentRef("12345678")).toBe("…5678");
    expect(panel.maskPaymentRef("")).toBe("");
    expect(panel.maskPaymentRef(undefined)).toBe("");
  });

  it("names the channel", () => {
    expect(panel.channelLabel("app")).toBe("Uygulama");
    expect(panel.channelLabel("web")).toBe("Web");
    expect(panel.channelLabel("")).toBe("Bilinmiyor");
  });

  it("a pending hold's badge says until when, on the köşk's clock", () => {
    const v = view({
      status: "requested",
      paymentStatus: "pending",
      paidMinor: 0,
      paymentDueAt: "2026-10-17T11:30:00.000Z",
    });
    expect(v.paymentLabel).toBe("Ödeme bekleniyor · son 14:30");
  });

  it("an unpaid hold past its page and grace asks to be let go", () => {
    const v = view({
      status: "requested",
      paymentStatus: "pending",
      paidMinor: 0,
      paymentDueAt: "2026-10-17T11:30:00.000Z",
    });
    expect(v.attention).toEqual(["hold_overdue"]);
    const fresh = view({
      status: "requested",
      paymentStatus: "pending",
      paidMinor: 0,
      paymentDueAt: "2026-10-17T11:50:00.000Z",
    });
    expect(fresh.attention).toEqual([]);
  });
});

describe("tabs", () => {
  const rows = [
    booking({ id: "krk-1", date: TODAY }),
    booking({ id: "krk-2", date: "2026-10-20" }),
    booking({ id: "krk-3", date: "2026-10-10" }),
    booking({
      id: "krk-4",
      date: "2026-10-20",
      status: "cancelled",
      paymentStatus: "refunded",
      refundedAt: "2026-10-17T09:00:00.000Z",
    }),
    booking({ id: "krk-5", date: TODAY, paymentStatus: "refunding" }),
  ];
  const views = panel.karaokeRowViews(rows, CTX);
  const ids = (tab: Parameters<typeof panel.inKaraokeTab>[1]) =>
    views.filter((v) => panel.inKaraokeTab(v, tab, TODAY)).map((v) => v.r.id);

  it("splits the standing bookings by day, the rest by what happened", () => {
    expect(ids("bugun")).toEqual(["krk-1", "krk-5"]);
    expect(ids("yaklasan")).toEqual(["krk-2"]);
    expect(ids("gecmis")).toEqual(["krk-3"]);
    expect(ids("iptal")).toEqual(["krk-4", "krk-5"]);
    expect(ids("dikkat")).toEqual(["krk-5"]);
  });

  it("counts every tab with the filters applied", () => {
    const list = panel.karaokeList(views, {
      tab: "bugun",
      filters: { odeme: "paid" },
      sort: panel.defaultKaraokeSort("bugun"),
      page: 1,
      today: TODAY,
    });
    expect(list.counts).toEqual({
      bugun: 1,
      yaklasan: 1,
      gecmis: 1,
      iptal: 0,
      dikkat: 0,
    });
  });

  it("reads the tab from the URL, Bugün when unknown", () => {
    expect(panel.parseKaraokeTab({ sekme: "gecmis" })).toBe("gecmis");
    expect(panel.parseKaraokeTab({ sekme: "x" })).toBe("bugun");
    expect(panel.parseKaraokeTab({})).toBe("bugun");
  });

  it("sorts history newest first and pages it", () => {
    const past = panel.karaokeRowViews(
      Array.from({ length: 7 }, (_, i) =>
        booking({ id: `krk-${i + 10}`, date: `2026-10-0${i + 1}` }),
      ),
      CTX,
    );
    const page2 = panel.karaokeList(past, {
      tab: "gecmis",
      filters: {},
      sort: panel.defaultKaraokeSort("gecmis"),
      page: 2,
      pageSize: 3,
      today: TODAY,
    });
    expect(page2.total).toBe(7);
    expect(page2.rows.map((v) => v.r.date)).toEqual([
      "2026-10-04",
      "2026-10-03",
      "2026-10-02",
    ]);
    const beyond = panel.karaokeList(past, {
      tab: "gecmis",
      filters: {},
      sort: panel.defaultKaraokeSort("gecmis"),
      page: 99,
      pageSize: 3,
      today: TODAY,
    });
    expect(beyond.page).toBe(3);
  });
});

describe("search", () => {
  const r = booking({
    customerName: "İlkay Işık",
    contactEmail: "ilkay@example.com",
  });

  it("finds a name the Turkish way, either e-mail, the code and the phone", () => {
    for (const q of [
      "ilkay ışık",
      "IŞIK",
      "isik",
      "eda@example",
      "ILKAY@",
      "krk-00042",
      "KRK-42",
      "42",
      "0532 123 45",
      "+90 532",
      "5321234567",
    ]) {
      expect(panel.matchesKaraokeSearch(r, q), q).toBe(true);
    }
    for (const q of ["ayşe", "krk-43", "0533"]) {
      expect(panel.matchesKaraokeSearch(r, q), q).toBe(false);
    }
  });

  it("filters by date range, both ends inclusive", () => {
    const v = view();
    expect(panel.matchesKaraokeFilters(v, { bas: TODAY, bit: TODAY })).toBe(
      true,
    );
    expect(panel.matchesKaraokeFilters(v, { bas: "2026-10-18" })).toBe(false);
    expect(panel.matchesKaraokeFilters(v, { bit: "2026-10-16" })).toBe(false);
  });
});

describe("the booking's history", () => {
  const items = panel.karaokeHistory(
    booking({
      refundedAt: "2026-10-17T09:00:00.000Z",
      status: "cancelled",
      paymentStatus: "refunded",
    }),
    [
      {
        id: "aud-1",
        entityId: "krk-00042",
        actor: "kosk@laffogato",
        action: "refund",
        payload: {
          status: "cancelled",
          amountMinor: 200_000,
          reason: "Oda arızalı",
        },
        createdAt: "2026-10-17T09:00:00.000Z",
      },
      {
        id: "aud-2",
        actor: "system",
        action: "update",
        payload: { event: "cancel_refund_unknown", amountMinor: 200_000 },
        createdAt: "2026-10-17T08:59:00.000Z",
      },
      {
        id: "aud-3",
        actor: "owner@laffogato",
        action: "refund",
        payload: { event: "refund_settled_by_hand", from: "paid" },
        createdAt: "2026-10-17T09:30:00.000Z",
      },
      {
        id: "aud-4",
        actor: "customer",
        action: "transition",
        payload: { status: "cancelled", paymentStatus: "expired" },
        createdAt: "2026-10-17T09:40:00.000Z",
      },
    ],
  );
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));

  it("stamps the row's own moments", () => {
    expect(byId["row-created"]!.description).toBe("Web");
    expect(byId["row-paid"]!.title).toBe("Ödeme alındı");
    expect(byId["row-refunded"]!.title).toBe("Ödeme iade edildi");
  });

  it("reads each audit row in words, with the reason and who", () => {
    expect(byId["aud-1"]!.title).toBe("İptal edildi, ödeme karta iade edildi");
    expect(byId["aud-1"]!.description).toContain("Neden: Oda arızalı");
    expect(byId["aud-1"]!.actor).toBe("kosk@laffogato");
    expect(byId["aud-2"]!.title).toBe("İptalde iade sonucu belirsiz");
    expect(byId["aud-2"]!.tone).toBe("danger");
    expect(byId["aud-2"]!.actor).toBe("Sistem");
    expect(byId["aud-3"]!.title).toMatch(/elle kaydedildi/);
    expect(byId["aud-4"]!.title).toBe("İptal edildi (ödeme alınmamıştı)");
    expect(byId["aud-4"]!.actor).toBe("Üye");
  });
});

describe("the dashboard card", () => {
  it("counts tonight, lists what is still to come and points at Dikkat", () => {
    const today = panel.karaokeRowViews(
      [
        booking({ id: "krk-1", startHour: 20 }),
        booking({ id: "krk-2", startHour: 14, hours: 1 }),
        booking({
          id: "krk-3",
          status: "requested",
          paymentStatus: "pending",
          paidMinor: 0,
          startHour: 22,
          paymentDueAt: "2026-10-17T12:20:00.000Z",
        }),
        booking({
          id: "krk-4",
          status: "cancelled",
          paymentStatus: "refunded",
        }),
      ],
      CTX,
    );
    const owed = panel.karaokeRowViews(
      [booking({ id: "krk-9", date: "2026-10-12", status: "cancelled" })],
      CTX,
    );
    const markup = html(
      createElement(KaraokeTodayCard, { today, attention: owed, now: NOW }),
    );
    // Three standing, two paid, one waiting for its payment.
    expect(markup).toMatch(/Rezervasyon<\/dt><dd[^>]*>3</);
    expect(markup).toMatch(/Ödendi<\/dt><dd[^>]*>2</);
    expect(markup).toMatch(/Ödeme bekliyor<\/dt><dd[^>]*>1</);
    // The 14:00 booking is over; the card lists what is still to come.
    expect(markup).toContain("20:00 - 22:00");
    expect(markup).not.toContain("14:00 - 15:00");
    expect(markup).toContain('href="/admin/mobil/karaoke?sekme=dikkat"');
    expect(markup).toContain("1 rezervasyon bir işlem bekliyor");
  });

  it("says so when the bookings could not be read", () => {
    const markup = html(
      createElement(KaraokeTodayCard, {
        today: null,
        attention: null,
        now: NOW,
      }),
    );
    expect(markup).toContain("okunamadı");
  });
});

describe("roles: the köşk shift runs the evening", () => {
  it("opens the karaoke panel to owner, manager and staff, not the cashier", () => {
    expect(canAccess("karaoke", "owner")).toBe(true);
    expect(canAccess("karaoke", "manager")).toBe(true);
    expect(canAccess("karaoke", "staff")).toBe(true);
    expect(canAccess("karaoke", "cashier")).toBe(false);
    expect(sectionsFor("cashier")).toEqual(["till"]);
  });

  it("keeps refunds with owner and manager", () => {
    expect(canAccess("refunds", "staff")).toBe(false);
    expect(canAccess("refunds", "manager")).toBe(true);
  });

  it("the nav item and every karaoke page use the karaoke section", () => {
    const layout = read("src/app/admin/layout.tsx");
    expect(layout).toMatch(
      /href: "\/admin\/mobil\/karaoke", label: "Karaoke", section: "karaoke"/,
    );
    for (const file of [
      "src/app/admin/mobil/karaoke/page.tsx",
      "src/app/admin/mobil/karaoke/[id]/page.tsx",
      "src/app/admin/mobil/karaoke/actions.ts",
    ]) {
      const src = read(file);
      expect(src, file).toContain('requireRole("karaoke")');
      expect(src, file).not.toContain('requireRole("mobileApp")');
    }
  });
});

describe("sidebar", () => {
  it("lights exactly one entry", () => {
    const hrefs = [
      "/admin",
      "/admin/bulten",
      "/admin/bulten/kampanya",
      "/admin/mobil/karaoke",
    ];
    expect(activeNavHref("/admin/bulten/kampanya", hrefs)).toBe(
      "/admin/bulten/kampanya",
    );
    expect(activeNavHref("/admin/bulten", hrefs)).toBe("/admin/bulten");
    expect(activeNavHref("/admin/bulten/abone/3", hrefs)).toBe("/admin/bulten");
    expect(activeNavHref("/admin/mobil/karaoke/krk-00042", hrefs)).toBe(
      "/admin/mobil/karaoke",
    );
    expect(activeNavHref("/admin", hrefs)).toBe("/admin");
    expect(activeNavHref("/admin/stok", hrefs)).toBeNull();
    // A prefix that is not a path segment does not count.
    expect(activeNavHref("/admin/bultenler", hrefs)).toBeNull();
  });

  it("draws its own icon for the entries that used the dashboard's, and a karaoke badge", async () => {
    // The icons are lucide's now, one map in ui/icons.tsx; the sidebar
    // looks them up by `item.icon ?? item.section`.
    const { ADMIN_ICONS } = await import("@/components/admin/ui/icons");
    const keys = [
      "till",
      "tables",
      "mobileApp",
      "adminUsers",
      "karaoke",
    ] as const;
    for (const key of keys) {
      expect(ADMIN_ICONS[key], key).toBeDefined();
      expect(ADMIN_ICONS[key], key).not.toBe(ADMIN_ICONS.dashboard);
    }
    expect(new Set(keys.map((k) => ADMIN_ICONS[k])).size).toBe(keys.length);
    const src = read("src/components/admin/admin-sidebar.tsx");
    expect(src).toContain("<NavIcon name={item.icon ?? item.section} />");
    expect(read("src/components/admin/nav-icon.tsx")).toContain("ADMIN_ICONS");
    expect(src).toContain("karaokeTodayCountAction");
    // One active entry, over item and tab hrefs (nav-match.ts).
    expect(src).toContain("activeNavPlace(");
    expect(src).not.toMatch(/function isActive\(/);
  });
});

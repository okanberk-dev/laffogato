import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The karaoke cancellation policy in the panel (P2a): Ayarlar > Karaoke
 * saves it (owner only, Turkish refusals, the fairness limits, the app
 * lock), the tab previews what a customer will read, and the karaoke panel
 * shows an owed late share with "Elle iade edildi" instead of a POS retry.
 * The revenue report's half is tests/admin-reports-ltv.test.ts.
 */

const h = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  updates: [] as Array<Record<string, unknown>>,
  audits: [] as Array<Record<string, unknown>>,
  roles: [] as string[],
  appVersion: null as string | null,
  overrides: {} as Record<string, Record<string, unknown> | null>,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async (section: string) => {
    h.roles.push(section);
    return { email: "sahip@kosk", role: "owner" };
  }),
}));
vi.mock("@/lib/admin/audit", () => ({
  logAudit: vi.fn(async () => {}),
  safeAudit: vi.fn(async (row: Record<string, unknown>) => {
    h.audits.push(row);
    return true;
  }),
}));
vi.mock("@/lib/admin/store", () => ({
  getSettings: vi.fn(async () => h.settings),
  updateSettings: vi.fn(async (patch: Record<string, unknown>) => {
    h.updates.push(patch);
    return { ...h.settings, ...patch };
  }),
}));
vi.mock("@/lib/legal/store", () => ({
  getLegalDocOverride: vi.fn(async (slug: string) => h.overrides[slug] ?? null),
}));
// The lock is the code's own null; a test opens it as the app follow-up
// would (KARAOKE_POLICY_APP_VERSION).
vi.mock("@/lib/mobile/karaoke-time", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/lib/mobile/karaoke-time")>();
  return {
    ...real,
    karaokePolicyLockReason: (v: string) =>
      real.karaokePolicyLockReason(v, h.appVersion),
  };
});

const { revalidatePath } = await import("next/cache");
const { saveKaraokeAction } =
  await import("@/app/admin/ayarlar/karaoke-actions");
const { KaraokeTab } = await import("@/app/admin/ayarlar/karaoke-tab");
const roles = await import("@/lib/admin/roles");
const panel = await import("@/lib/admin/karaoke-panel");

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

const BASE = {
  karaokeHourly: "1000",
  karaokeCapacity: "8",
  karaokeNotifyEmail: "",
  karaokePrepay: "on",
};

function baseSettings(minVersion = "1.0.0") {
  return {
    email: "kosk@example.com",
    karaokeHourlyMinor: 100_000,
    karaokeCapacity: 8,
    karaokeNotifyEmail: "",
    karaokePrepay: true,
    karaokeFreeCancelHours: 2,
    karaokeLateRefundPercent: 0,
    karaokeCancelPolicyAt: "",
    mobileApp: { minSupportedAppVersion: minVersion },
  };
}

beforeEach(() => {
  h.settings = baseSettings();
  h.updates.length = 0;
  h.audits.length = 0;
  h.roles.length = 0;
  h.appVersion = null;
  h.overrides = {};
  vi.mocked(revalidatePath).mockClear();
});

/** The paths a save asked Next to render again. */
const revalidated = () =>
  vi.mocked(revalidatePath).mock.calls.map(([path]) => path);

describe("saveKaraokeAction: the cancellation policy", () => {
  it("is the owner's: the action asks for the settings section", async () => {
    await saveKaraokeAction({}, form(BASE));
    expect(h.roles).toEqual(["settings"]);
    expect(roles.canAccess("settings", "owner")).toBe(true);
    for (const role of ["manager", "cashier", "staff"]) {
      expect(roles.canAccess("settings", role as never)).toBe(false);
    }
  });

  it.each([
    ["abc", "0", "karaokeFreeCancelHours", /0 ile 72 saat/],
    ["73", "0", "karaokeFreeCancelHours", /0 ile 72 saat/],
    ["-1", "0", "karaokeFreeCancelHours", /0 ile 72 saat/],
    ["2.5", "0", "karaokeFreeCancelHours", /0 ile 72 saat/],
    ["2", "101", "karaokeLateRefundPercent", /0 ile 100/],
    ["2", "", "karaokeLateRefundPercent", /0 ile 100/],
  ])(
    "refuses %s h / %s %% in Turkish, on its field",
    async (hours, percent, field, message) => {
      const state = await saveKaraokeAction(
        {},
        form({
          ...BASE,
          karaokeFreeCancelHours: hours,
          karaokeLateRefundPercent: percent,
        }),
      );
      expect(state.error).toMatch(message);
      expect(state.fieldErrors?.[field]).toMatch(message);
      expect(h.updates).toEqual([]);
    },
  );

  it("holds the fairness limits even with the app lock open", async () => {
    h.appVersion = "1.1.0";
    h.settings = baseSettings("1.1.0");
    const longNoRefund = await saveKaraokeAction(
      {},
      form({
        ...BASE,
        karaokeFreeCancelHours: "48",
        karaokeLateRefundPercent: "0",
      }),
    );
    expect(longNoRefund.fieldErrors?.karaokeFreeCancelHours).toMatch(
      /en fazla 24 saat/,
    );
    const longLittleBack = await saveKaraokeAction(
      {},
      form({
        ...BASE,
        karaokeFreeCancelHours: "30",
        karaokeLateRefundPercent: "40",
      }),
    );
    expect(longLittleBack.fieldErrors?.karaokeLateRefundPercent).toMatch(
      /en az %50/,
    );
    // No free window makes every cancel after booking late: the longest
    // window of all, so it needs half back too.
    const noWindowNothingBack = await saveKaraokeAction(
      {},
      form({
        ...BASE,
        karaokeFreeCancelHours: "0",
        karaokeLateRefundPercent: "0",
      }),
    );
    expect(noWindowNothingBack.fieldErrors?.karaokeLateRefundPercent).toMatch(
      /en az %50/,
    );
    expect(h.updates).toEqual([]);
  });

  it("while the app lock is shut, only 2 h / 0 % can be saved", async () => {
    const state = await saveKaraokeAction(
      {},
      form({
        ...BASE,
        karaokeFreeCancelHours: "24",
        karaokeLateRefundPercent: "50",
      }),
    );
    expect(state.error).toMatch(/yalnız 2 saat ve %0/);
    expect(h.updates).toEqual([]);

    const same = await saveKaraokeAction(
      {},
      form({
        ...BASE,
        karaokeFreeCancelHours: "2",
        karaokeLateRefundPercent: "0",
      }),
    );
    expect(same.error).toBeUndefined();
  });

  it("with the lock open, saves the policy, dates it and audits before/after", async () => {
    h.appVersion = "1.1.0";
    h.settings = baseSettings("1.1.0");
    const state = await saveKaraokeAction(
      {},
      form({
        ...BASE,
        karaokeFreeCancelHours: "24",
        karaokeLateRefundPercent: "50",
      }),
    );
    expect(state.error).toBeUndefined();
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0]).toMatchObject({
      karaokeFreeCancelHours: 24,
      karaokeLateRefundPercent: 50,
    });
    expect(
      Number.isFinite(Date.parse(String(h.updates[0]!.karaokeCancelPolicyAt))),
    ).toBe(true);
    expect(h.audits.at(-1)?.payload).toMatchObject({
      section: "karaoke",
      before: { karaokeFreeCancelHours: 2, karaokeLateRefundPercent: 0 },
      after: { karaokeFreeCancelHours: 24, karaokeLateRefundPercent: 50 },
    });
    // The karaoke terms are rendered for the policy, the booking page
    // quotes it: both are rendered again.
    expect(revalidated()).toEqual(
      expect.arrayContaining([
        "/hukuk/karaoke-odasi-rezervasyon",
        "/hukuk",
        "/karaoke",
      ]),
    );
  });

  describe("while an edit of the karaoke terms is published", () => {
    /**
     * /hukuk and the app show a published edit (Yasal belgeler) instead of
     * the text written for the policy, and it does not follow the policy:
     * under a new rule a customer would read the old one while their consent
     * records the rule's date (karaokePolicyVersion).
     */
    const live = {
      slug: "karaoke-odasi-rezervasyon",
      isPublished: true,
      bodyMarkdown: "## 7. İptal\n\n2 saatten az kala iade yapılmaz.",
      effectiveDate: "",
      updatedAt: "2026-10-17T09:00:00.000Z",
    };
    const policyForm = (hours: string, percent: string, extra = {}) =>
      form({
        ...BASE,
        ...extra,
        karaokeFreeCancelHours: hours,
        karaokeLateRefundPercent: percent,
      });

    beforeEach(() => {
      h.appVersion = "1.1.0";
      h.settings = baseSettings("1.1.0");
      h.overrides = { "karaoke-odasi-rezervasyon": live };
    });

    it("refuses a new rule until the edit is taken down", async () => {
      const state = await saveKaraokeAction({}, policyForm("24", "50"));
      expect(state.error).toMatch(/Yasal belgeler/);
      expect(state.fieldErrors?.karaokeFreeCancelHours).toMatch(
        /yayından kaldır/,
      );
      expect(h.updates).toEqual([]);

      const percentOnly = await saveKaraokeAction({}, policyForm("2", "50"));
      expect(percentOnly.fieldErrors?.karaokeLateRefundPercent).toMatch(
        /Yasal belgeler/,
      );
      expect(h.updates).toEqual([]);
    });

    it("an unreadable edit table stops the save, the rule stays", async () => {
      const { getLegalDocOverride } = await import("@/lib/legal/store");
      vi.mocked(getLegalDocOverride).mockRejectedValueOnce(
        new Error("getLegalDocOverride: connection refused"),
      );
      await expect(
        saveKaraokeAction({}, policyForm("24", "50")),
      ).rejects.toThrow(/getLegalDocOverride/);
      expect(h.updates).toEqual([]);
    });

    it("a draft or an empty edit is not shown, so it does not count", async () => {
      h.overrides = {
        "karaoke-odasi-rezervasyon": { ...live, isPublished: false },
      };
      expect(
        (await saveKaraokeAction({}, policyForm("24", "50"))).error,
      ).toBeUndefined();
      h.updates.length = 0;
      h.overrides = {
        "karaoke-odasi-rezervasyon": { ...live, bodyMarkdown: "  " },
      };
      expect(
        (await saveKaraokeAction({}, policyForm("12", "50"))).error,
      ).toBeUndefined();
      expect(h.updates).toHaveLength(1);
    });

    it("going back to 2 h / 0 % and saves that keep the rule still go through", async () => {
      h.settings = {
        ...baseSettings("1.1.0"),
        karaokeFreeCancelHours: 24,
        karaokeLateRefundPercent: 50,
      };
      const same = await saveKaraokeAction(
        {},
        policyForm("24", "50", { karaokeCapacity: "10" }),
      );
      expect(same.error).toBeUndefined();
      expect(h.updates).toHaveLength(1);
      expect(h.updates[0]).not.toHaveProperty("karaokeCancelPolicyAt");

      const back = await saveKaraokeAction({}, policyForm("2", "0"));
      expect(back.error).toBeUndefined();
      expect(h.updates.at(-1)).toMatchObject({
        karaokeFreeCancelHours: 2,
        karaokeLateRefundPercent: 0,
      });
    });
  });

  it("a save that moves nothing else leaves the policy's date alone", async () => {
    const state = await saveKaraokeAction(
      {},
      form({
        ...BASE,
        karaokeCapacity: "10",
        karaokeFreeCancelHours: "2",
        karaokeLateRefundPercent: "0",
      }),
    );
    expect(state.error).toBeUndefined();
    expect(h.updates[0]).not.toHaveProperty("karaokeCancelPolicyAt");
    expect(revalidated()).not.toContain("/hukuk/karaoke-odasi-rezervasyon");
  });

  it("a post without the two boxes leaves the policy as it is", async () => {
    await saveKaraokeAction({}, form({ ...BASE, karaokeCapacity: "10" }));
    expect(h.updates[0]).not.toHaveProperty("karaokeFreeCancelHours");
    expect(h.updates[0]).not.toHaveProperty("karaokeLateRefundPercent");
  });
});

describe("the Karaoke tab", () => {
  const settingsFor = (minVersion: string, hours = 2, percent = 0) =>
    ({
      ...baseSettings(minVersion),
      karaokeFreeCancelHours: hours,
      karaokeLateRefundPercent: percent,
    }) as never;

  it("shows the two boxes, the forward-only note and the customer's sentences", () => {
    const html = renderToStaticMarkup(
      createElement(KaraokeTab, { settings: settingsFor("1.0.0") }),
    );
    expect(html).toContain('name="karaokeFreeCancelHours"');
    expect(html).toContain('name="karaokeLateRefundPercent"');
    expect(html).toContain(
      "Değişiklik yalnız bundan sonra yapılan rezervasyonlara uygulanır.",
    );
    expect(html).toContain(
      "Rezervasyon saatine 2 saatten fazla varken iptal edersen ödediğin tutarın tamamı kartına iade edilir.",
    );
    // The lock says why only the default can be saved.
    expect(html).toContain("yalnız 2 saat ve %0");
  });

  it("previews a saved non-default policy in its own words", () => {
    h.appVersion = "1.1.0";
    const html = renderToStaticMarkup(
      createElement(KaraokeTab, { settings: settingsFor("1.1.0", 24, 50) }),
    );
    expect(html).toContain("%50&#x27;si kartına iade edilir");
    expect(html).not.toContain("yalnız 2 saat ve %0");
    expect(html).toContain("Elle iade edildi");
  });
});

describe("the karaoke panel: an owed late share", () => {
  const ctx = {
    today: "2026-10-30",
    now: new Date("2026-10-30T08:00:00.000Z"),
    prepay: true,
    canRefund: true,
  };
  const owed = {
    id: "krk-00042",
    customerEmail: "eda@example.com",
    customerName: "Eda",
    date: "2026-10-30",
    startHour: 20,
    hours: 2,
    guests: 4,
    status: "cancelled" as const,
    priceMinor: 200_000,
    discountMinor: 0,
    totalMinor: 200_000,
    note: "",
    createdAt: "2026-10-20T09:00:00.000Z",
    updatedAt: "2026-10-30T07:00:00.000Z",
    paymentStatus: "refunding" as const,
    paidMinor: 200_000,
    refundMinor: 100_000,
    freeCancelHours: 24,
    lateRefundPercent: 50,
  };

  it("needs a person, says how much, and offers only Elle iade edildi", () => {
    const view = panel.karaokeRowView(owed, ctx);
    expect(view.attention).toEqual(["share_owed"]);
    expect(view.refundOwed).toBe(true);
    expect(view.paymentLabel).toBe("Kısmi iade bekliyor");
    expect(view.plan.refund).toBeNull();
    expect(view.plan.settle).toEqual({ kind: "share" });
    expect(panel.refundAmountMinor(owed)).toBe(100_000);
  });

  it("a whole refund that went unanswered still offers the POS retry", () => {
    const view = panel.karaokeRowView(
      { ...owed, status: "confirmed", refundMinor: null },
      ctx,
    );
    expect(view.attention).toContain("refund_pending");
    expect(view.plan.refund).toEqual({ kind: "retry" });
    expect(view.plan.settle).toEqual({ kind: "pending_answer" });
  });

  it("the history names the share", () => {
    const items = panel.karaokeHistory(
      {
        ...owed,
        paymentStatus: "refunded",
        refundedAt: "2026-10-30T09:00:00.000Z",
      },
      [
        {
          id: "a1",
          createdAt: "2026-10-30T07:00:00.000Z",
          actor: "customer",
          action: "refund",
          entityId: "krk-00042",
          payload: {
            event: "late_cancel_share_owed",
            lateRefundPercent: 50,
            amountMinor: 100_000,
          },
        },
      ] as never,
    );
    expect(items.map((i) => i.title)).toEqual(
      expect.arrayContaining([
        "Ödemenin bir kısmı iade edildi",
        "Geç iptal edildi; kurala göre %50 iade bekliyor",
      ]),
    );
  });
});

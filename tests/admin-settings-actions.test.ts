import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Settings actions guard the numbers that price live orders, and the
 * switches that stop sales, search traffic or staff mail.
 *
 * `parseMoneyMinor` used to fall back to 0 on anything it could not read, so
 * "₺75" in Kurye ücreti made every kurye order that evening free, and the
 * audit row said only "settings shipping update".
 */

const updateSettings = vi.fn();
const logAudit = vi.fn();
const revalidatePath = vi.fn();
const listAdminUsers = vi.fn();
const listEnvAdminContacts = vi.fn();
const senderDomainStatus = vi.fn();
const forgetEmailHealth = vi.fn();
const sendTestEmail = vi.fn();

function baseSettings() {
  return {
    name: "L'Affogato",
    tagline: "Drink it. Eat the cup.",
    phone: "+90 536 429 09 19",
    email: "info@laffogato.net",
    address: "Postane Mah. Atatürk Cad. No: 28, Tuzla",
    heroImageUrl: "",
    isShopOpen: true,
    shippingFlatMinor: 4900,
    shippingFreeThresholdMinor: 75000,
    courierFeeMinor: 5500,
    pickupReadyMinutes: 15,
    karaokeHourlyMinor: 90000,
    karaokeCapacity: 8,
    karaokeNotifyEmail: "",
    karaokePrepay: true,
    taxRates: {
      menu: 10,
      karaoke: 20,
      beans: 10,
      pantry: 10,
      gift: 20,
      gear: 20,
      merch: 20,
      shipping: 20,
    },
    // jsonb hands the hours back with its own key order (days sorted, then
    // open / close / closed): not the order the form posts them in.
    weeklyHours: Object.fromEntries(
      [
        "friday",
        "monday",
        "saturday",
        "sunday",
        "thursday",
        "tuesday",
        "wednesday",
      ].map((d) => [d, { open: "09:00", close: "00:00", closed: false }]),
    ),
    openingHours: "eski",
    seoTitle: "",
    seoOgImageUrl: "",
    seoIndexable: true,
    notificationEmail: "",
    orderNotifyEnabled: true,
    orderNotifyRoles: ["owner", "manager", "cashier"],
    orderNotifyEmails: "",
    emailFromName: "L'Affogato",
    emailFromAddress: "",
    emailReplyTo: "",
  };
}

let SETTINGS = baseSettings();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({})),
  listEnvAdminContacts,
}));
vi.mock("@/lib/admin/users", () => ({ listAdminUsers }));
// The real safeAudit: logAudit, with a failed insert caught.
vi.mock("@/lib/admin/audit", () => ({
  logAudit,
  safeAudit: async (input: unknown) => {
    try {
      await logAudit(input);
      return true;
    } catch {
      return false;
    }
  },
}));
vi.mock("@/lib/email/health", () => ({
  forgetEmailHealth,
  senderDomainStatus,
}));
vi.mock("@/lib/email/send", () => ({ sendTestEmail }));
vi.mock("@/lib/admin/store", () => ({
  DAYS_OF_WEEK: [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ],
  getSettings: vi.fn(async () => SETTINGS),
  updateSettings,
}));

const {
  saveEmailSenderAction,
  saveGeneralAction,
  saveShippingAction,
  saveHoursAction,
  saveNotificationsAction,
  saveSeoAction,
  saveTaxAction,
  sendTestEmailAction,
} = await import("@/app/admin/ayarlar/actions");
const { saveKaraokeAction } =
  await import("@/app/admin/ayarlar/karaoke-actions");
const { requireRole } = await import("@/lib/admin/auth");

function form(fields: Record<string, string>, confirmed: string[] = []) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  for (const key of confirmed) fd.append("confirmed", key);
  return fd;
}

const shipping = (over: Partial<Record<string, string>> = {}) =>
  form({
    shippingFlat: "49",
    shippingFreeThreshold: "750",
    courierFee: "55",
    ...over,
  });

const general = (
  over: Partial<Record<string, string | undefined>> = {},
  confirmed: string[] = [],
) => {
  const fields: Record<string, string> = {
    name: SETTINGS.name,
    tagline: SETTINGS.tagline,
    phone: SETTINGS.phone,
    email: SETTINGS.email,
    address: SETTINGS.address,
    heroImageUrl: SETTINGS.heroImageUrl,
    isShopOpen: "on",
  };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete fields[k];
    else fields[k] = v;
  }
  return form(fields, confirmed);
};

/** The last audit row written. */
const lastAudit = () =>
  logAudit.mock.calls.at(-1)?.[0] as {
    action: string;
    entity: string;
    entityId: string;
    payload: Record<string, unknown>;
  };

beforeEach(() => {
  SETTINGS = baseSettings();
  updateSettings.mockReset();
  logAudit.mockReset();
  logAudit.mockResolvedValue(undefined);
  revalidatePath.mockClear();
  listAdminUsers.mockReset();
  listAdminUsers.mockResolvedValue([
    { email: "eda@laffogato.net", role: "manager", isActive: true },
  ]);
  listEnvAdminContacts.mockReset();
  listEnvAdminContacts.mockReturnValue([
    { email: "owner@laffogato.net", role: "owner" },
  ]);
  senderDomainStatus.mockReset();
  senderDomainStatus.mockResolvedValue("verified");
  forgetEmailHealth.mockClear();
  sendTestEmail.mockReset();
});

describe("saveShippingAction", () => {
  it("refuses a courier fee it cannot read instead of storing 0", async () => {
    const state = await saveShippingAction(
      {},
      shipping({ courierFee: "75 lira" }),
    );
    expect(state.error).toBeTruthy();
    // The message sits under the field it is about.
    expect(state.fieldErrors?.courierFee).toBe(state.error);
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("reads ₺75 as 75 TL (parseMoneyInput drops the sign), never 0", async () => {
    const state = await saveShippingAction({}, shipping({ courierFee: "₺75" }));
    expect(state.error).toBeUndefined();
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ courierFeeMinor: 7500 }),
    );
  });

  it("refuses a zero courier fee - cafe delivery is never free", async () => {
    const state = await saveShippingAction({}, shipping({ courierFee: "0" }));
    expect(state.error).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("refuses a non-numeric shipping fee", async () => {
    const state = await saveShippingAction(
      {},
      shipping({ shippingFlat: "kırk dokuz" }),
    );
    expect(state.error).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it.each([
    ["shippingFlat", "25.000.000"],
    ["shippingFreeThreshold", "1.000.000,01"],
    ["courierFee", "50000000"],
  ])(
    "refuses %s = %s under its field instead of overflowing the integer column",
    async (field, value) => {
      // "25.000.000" is 2.500.000.000 kuruş: Postgres 22003 and the panel's
      // error page, with the typed form gone.
      const state = await saveShippingAction({}, shipping({ [field]: value }));
      expect(state.error).toBe("Tutar en fazla 1.000.000 TL olabilir.");
      expect(state.fieldErrors?.[field]).toBe(state.error);
      expect(updateSettings).not.toHaveBeenCalled();
    },
  );

  it("stores kuruş integers and audits the before/after of what moved", async () => {
    const state = await saveShippingAction(
      {},
      shipping({ courierFee: "60,5" }),
    );
    expect(state.error).toBeUndefined();
    expect(updateSettings).toHaveBeenCalledWith({
      shippingFlatMinor: 4900,
      shippingFreeThresholdMinor: 75000,
      courierFeeMinor: 6050,
    });
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        entity: "settings",
        payload: {
          section: "shipping",
          before: { courierFeeMinor: 5500 },
          after: { courierFeeMinor: 6050 },
        },
      }),
    );
  });

  it("writes nothing, and no audit row, when nothing changed", async () => {
    const state = await saveShippingAction({}, shipping());
    expect(state.message).toContain("Değişiklik yok");
    expect(updateSettings).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("answers 'kaydedildi' when the save landed but the audit insert failed", async () => {
    // ok() awaited logAudit after updateSettings: a failed insert threw the
    // operator onto the error page for a save that had gone through.
    logAudit.mockRejectedValueOnce(new Error("audit_logs down"));
    const state = await saveShippingAction({}, shipping({ courierFee: "60" }));
    expect(updateSettings).toHaveBeenCalled();
    expect(state.message).toBe("Kargo ve kurye ayarları kaydedildi.");
  });
});

describe("Gel-al hazırlık süresi (the home page's order card)", () => {
  it("stores whole minutes and audits the change", async () => {
    const state = await saveShippingAction(
      {},
      shipping({ pickupReadyMinutes: "20" }),
    );
    expect(state.error).toBeUndefined();
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ pickupReadyMinutes: 20 }),
    );
    expect(lastAudit().payload).toEqual(
      expect.objectContaining({
        before: expect.objectContaining({ pickupReadyMinutes: 15 }),
        after: expect.objectContaining({ pickupReadyMinutes: 20 }),
      }),
    );
  });

  it.each(["0", "181", "12.5", "on beş", "", "-5"])(
    "refuses %j and saves nothing",
    async (value) => {
      const state = await saveShippingAction(
        {},
        shipping({ pickupReadyMinutes: value }),
      );
      expect(state.error).toMatch(/Gel-al/);
      expect(state.fieldErrors?.pickupReadyMinutes).toBeTruthy();
      expect(updateSettings).not.toHaveBeenCalled();
    },
  );

  it("leaves the stored value alone when an old form does not send it", async () => {
    await saveShippingAction({}, shipping({ shippingFlat: "59" }));
    const saved = updateSettings.mock.calls[0][0] as Record<string, unknown>;
    expect(saved).not.toHaveProperty("pickupReadyMinutes");
  });
});

describe("amounts typed the Turkish way (parseMoneyInput)", () => {
  // The panel prints the karaoke hour as "1.000₺". The settings read it with
  // parseFloat after one comma swap, so "1.000" was 1,00 TL: a prepaid hour
  // for one lira, and "1.500" as the free-shipping line meant free shipping
  // on almost every order.
  it("reads 1.000 as a thousand lira for the karaoke hour", async () => {
    const state = await saveKaraokeAction(
      {},
      form({
        karaokeHourly: "1.000",
        karaokeCapacity: "8",
        karaokePrepay: "on",
      }),
    );
    expect(state.error).toBeUndefined();
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ karaokeHourlyMinor: 100_000 }),
    );
  });

  it("reads 1.500 and 1.250,50 in the shipping box", async () => {
    const state = await saveShippingAction(
      {},
      shipping({ shippingFreeThreshold: "1.500", shippingFlat: "1.250,50" }),
    );
    expect(state.error).toBeUndefined();
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        shippingFreeThresholdMinor: 150_000,
        shippingFlatMinor: 125_050,
      }),
    );
  });

  it("still reads what the form fills in itself (toFixed(2))", async () => {
    await saveShippingAction(
      {},
      shipping({ shippingFlat: "49.90", shippingFreeThreshold: "750.00" }),
    );
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        shippingFlatMinor: 4990,
        shippingFreeThresholdMinor: 75_000,
      }),
    );
  });

  it("refuses an English grouping or a third decimal it cannot be sure of", async () => {
    for (const courierFee of ["1,250.00", "55,555", "1.2.3"]) {
      const state = await saveShippingAction({}, shipping({ courierFee }));
      expect(state.error, courierFee).toBeTruthy();
    }
    expect(updateSettings).not.toHaveBeenCalled();
  });
});

describe("saveKaraokeAction", () => {
  it("still refuses an unreadable hourly price", async () => {
    const state = await saveKaraokeAction(
      {},
      form({ karaokeHourly: "bin lira", karaokeCapacity: "8" }),
    );
    expect(state.error).toBeTruthy();
    expect(state.fieldErrors?.karaokeHourly).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("refuses an hourly price past the money ceiling", async () => {
    const state = await saveKaraokeAction(
      {},
      form({ karaokeHourly: "25.000.000", karaokeCapacity: "8" }),
    );
    expect(state.error).toBe("Tutar en fazla 1.000.000 TL olabilir.");
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it.each(["8.5", "8 kişi", "60", "0"])(
    "refuses the capacity %j (parseInt read 8.5 and 8 kişi as 8)",
    async (karaokeCapacity) => {
      const state = await saveKaraokeAction(
        {},
        form({ karaokeHourly: "1000", karaokeCapacity }),
      );
      expect(state.fieldErrors?.karaokeCapacity).toBeTruthy();
      expect(updateSettings).not.toHaveBeenCalled();
    },
  );

  it("audits the before/after of the karaoke settings", async () => {
    const state = await saveKaraokeAction(
      {},
      form({
        karaokeHourly: "1000",
        karaokeCapacity: "10",
        karaokeNotifyEmail: " karaoke@nextgenlab.com.tr ",
        // Online prepayment cannot be switched off (OP-KARAOKE-PREPAY, 18
        // Eki 2026): the box always comes ticked, an unticked one is refused
        // (tests/admin-karaoke-cancel-policy.test.ts).
        karaokePrepay: "on",
      }),
    );
    expect(state.message).toBeTruthy();
    expect(updateSettings).toHaveBeenCalledWith({
      karaokeHourlyMinor: 100000,
      karaokeCapacity: 10,
      karaokeNotifyEmail: "karaoke@nextgenlab.com.tr",
      karaokePrepay: true,
    });
    expect(lastAudit().payload).toEqual({
      section: "karaoke",
      before: {
        karaokeHourlyMinor: 90000,
        karaokeCapacity: 8,
        karaokeNotifyEmail: "",
      },
      after: {
        karaokeHourlyMinor: 100000,
        karaokeCapacity: 10,
        karaokeNotifyEmail: "karaoke@nextgenlab.com.tr",
      },
    });
  });

  it("refuses a karaoke notice address that is not an e-mail", async () => {
    const state = await saveKaraokeAction(
      {},
      form({
        karaokeHourly: "1000",
        karaokeCapacity: "8",
        karaokeNotifyEmail: "karaoke",
      }),
    );
    expect(state.error).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("accepts an empty notice address - the notice falls back to the contact e-mail", async () => {
    const state = await saveKaraokeAction(
      {},
      form({
        karaokeHourly: "1000",
        karaokeCapacity: "8",
        karaokePrepay: "on",
      }),
    );
    expect(state.message).toBeTruthy();
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ karaokeNotifyEmail: "" }),
    );
  });
});

describe("saveHoursAction - every time within 00:00-23:59 (S6-01)", () => {
  const DAYS = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const week = (over: Record<string, string> = {}) => {
    const fields: Record<string, string> = {};
    for (const d of DAYS) {
      fields[`${d}-open`] = "09:00";
      fields[`${d}-close`] = "00:00";
    }
    return form({ ...fields, ...over });
  };

  it("saves well-formed hours, a midnight close written as 00:00", async () => {
    const res = await saveHoursAction({}, week({ "monday-open": "8:30" }));
    expect(res.error).toBeUndefined();
    const saved = updateSettings.mock.calls.at(-1)?.[0];
    expect(saved.weeklyHours.monday).toEqual({
      open: "08:30",
      close: "00:00",
      closed: false,
    });
  });

  it("refuses 24:00 and other out-of-range or malformed times instead of storing them", async () => {
    for (const bad of ["24:00", "24:30", "23:60", "99:99", "", "9", "ab:cd"]) {
      updateSettings.mockClear();
      const res = await saveHoursAction({}, week({ "friday-close": bad }));
      expect(res.error, bad).toMatch(/00:00 ile 23:59/);
      expect(res.fieldErrors?.["friday-close"], bad).toBeTruthy();
      expect(updateSettings, bad).not.toHaveBeenCalled();
    }
  });

  it("lets a day marked closed keep empty time boxes", async () => {
    const res = await saveHoursAction(
      {},
      week({ "sunday-closed": "on", "sunday-open": "", "sunday-close": "" }),
    );
    expect(res.error).toBeUndefined();
    expect(updateSettings.mock.calls[0][0].weeklyHours.sunday.closed).toBe(
      true,
    );
  });

  it("is a no-op when the same week comes back in another key order", async () => {
    const res = await saveHoursAction({}, week());
    expect(res.message).toContain("Değişiklik yok");
    expect(updateSettings).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });
});

describe("saveGeneralAction (Genel)", () => {
  it("records what moved: before/after of the changed keys only", async () => {
    const state = await saveGeneralAction(
      {},
      general({ phone: "0216 000 00 00" }),
    );
    expect(state.message).toBe("Genel bilgiler kaydedildi.");
    expect(lastAudit().payload).toEqual({
      section: "general",
      before: { phone: "+90 536 429 09 19" },
      after: { phone: "0216 000 00 00" },
    });
  });

  it("refuses an http:// hero image under its field (the CSP would block it)", async () => {
    const state = await saveGeneralAction(
      {},
      general({ heroImageUrl: "http://cdn.example/hero.jpg" }),
    );
    expect(state.fieldErrors?.heroImageUrl).toMatch(/https:\/\//);
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it.each([
    ["email", "info@laffogato"],
    ["name", "X"],
    ["name", "a".repeat(81)],
    ["tagline", "a".repeat(161)],
    ["phone", "1".repeat(41)],
    ["address", "a".repeat(501)],
  ])("refuses %s = %j with a field error", async (field, value) => {
    const state = await saveGeneralAction({}, general({ [field]: value }));
    expect(state.fieldErrors?.[field]).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("asks before closing the shop, and writes nothing until confirmed", async () => {
    const asked = await saveGeneralAction(
      {},
      general({ isShopOpen: undefined }),
    );
    expect(asked.confirm?.keys).toEqual(["shop-off"]);
    expect(asked.confirm?.lines.join(" ")).toMatch(/kargolu ürün/);
    expect(updateSettings).not.toHaveBeenCalled();

    const saved = await saveGeneralAction(
      {},
      general({ isShopOpen: undefined }, ["shop-off"]),
    );
    expect(saved.message).toBeTruthy();
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ isShopOpen: false }),
    );
    expect(lastAudit().payload).toEqual({
      section: "general",
      before: { isShopOpen: true },
      after: { isShopOpen: false },
    });
  });

  it("does not ask when the shop opens again", async () => {
    SETTINGS.isShopOpen = false;
    const state = await saveGeneralAction({}, general());
    expect(state.confirm).toBeUndefined();
    expect(updateSettings).toHaveBeenCalled();
  });

  // Values saved before these checks existed (verifier SS-F2): an http://
  // hero image or a long phone must not stand between the operator and
  // closing the shop. They are checked again once that field is edited.
  it.each([
    ["heroImageUrl", "http://cdn.example.com/hero.jpg"],
    ["phone", "1".repeat(41)],
    ["address", "a".repeat(501)],
  ])(
    "closes the shop although the stored %s would fail today's check",
    async (field, stored) => {
      Object.assign(SETTINGS, { [field]: stored });
      const asked = await saveGeneralAction(
        {},
        general({ isShopOpen: undefined }),
      );
      expect(asked.error).toBeUndefined();
      expect(asked.confirm?.keys).toEqual(["shop-off"]);

      const saved = await saveGeneralAction(
        {},
        general({ isShopOpen: undefined }, ["shop-off"]),
      );
      expect(saved.message).toBe("Genel bilgiler kaydedildi.");
      expect(updateSettings).toHaveBeenCalledWith({ isShopOpen: false });
      expect(lastAudit().payload).toEqual({
        section: "general",
        before: { isShopOpen: true },
        after: { isShopOpen: false },
      });
    },
  );

  it("still refuses a stored http:// hero image once it is edited", async () => {
    SETTINGS.heroImageUrl = "http://cdn.example.com/hero.jpg";
    const state = await saveGeneralAction(
      {},
      general({ heroImageUrl: "http://cdn.example.com/yeni.jpg" }),
    );
    expect(state.fieldErrors?.heroImageUrl).toMatch(/https:\/\//);
    expect(updateSettings).not.toHaveBeenCalled();
  });
});

describe("saveSeoAction", () => {
  const seo = (over: Record<string, string> = {}, confirmed: string[] = []) =>
    form(
      { seoTitle: "", seoOgImageUrl: "", seoIndexable: "on", ...over },
      confirmed,
    );

  it("asks before closing the site to search engines", async () => {
    const fd = seo();
    fd.delete("seoIndexable");
    const asked = await saveSeoAction({}, fd);
    expect(asked.confirm?.keys).toEqual(["indexing-off"]);
    // Plain about what it does not do.
    expect(asked.confirm?.lines.join(" ")).toMatch(/kendiliğinden düşmez/);
    expect(updateSettings).not.toHaveBeenCalled();

    fd.append("confirmed", "indexing-off");
    await saveSeoAction({}, fd);
    expect(lastAudit().payload).toEqual({
      section: "seo",
      before: { seoIndexable: true },
      after: { seoIndexable: false },
    });
  });

  it("logs the title it replaced", async () => {
    await saveSeoAction({}, seo({ seoTitle: "Yeni başlık" }));
    expect(lastAudit().payload).toEqual({
      section: "seo",
      before: { seoTitle: "" },
      after: { seoTitle: "Yeni başlık" },
    });
  });

  it("refuses a share image that is not an http(s) address", async () => {
    const state = await saveSeoAction(
      {},
      seo({ seoOgImageUrl: "javascript:alert(1)" }),
    );
    expect(state.fieldErrors?.seoOgImageUrl).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });
});

describe("saveTaxAction (KDV oranları, 17 Eki 2026)", () => {
  const tax = (over: Partial<Record<string, string>> = {}) =>
    form({
      taxRate_menu: "10",
      taxRate_karaoke: "20",
      taxRate_beans: "10",
      taxRate_pantry: "10",
      taxRate_gift: "20",
      taxRate_gear: "20",
      taxRate_merch: "20",
      taxRate_shipping: "20",
      ...over,
    });

  it("is the settings role's, like every other tab", async () => {
    vi.mocked(requireRole).mockClear();
    await saveTaxAction({}, tax());
    expect(requireRole).toHaveBeenCalledWith("settings");
  });

  it("stores one whole-number rate per kind of sale and audits before/after", async () => {
    const state = await saveTaxAction({}, tax({ taxRate_menu: "%8" }));
    expect(state.error).toBeUndefined();
    expect(updateSettings).toHaveBeenCalledWith({
      taxRates: {
        menu: 8,
        karaoke: 20,
        beans: 10,
        pantry: 10,
        gift: 20,
        gear: 20,
        merch: 20,
        shipping: 20,
      },
    });
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        entity: "settings",
        payload: expect.objectContaining({
          section: "tax",
          before: { taxRates: SETTINGS.taxRates },
          after: { taxRates: expect.objectContaining({ menu: 8 }) },
        }),
      }),
    );
  });

  it.each(["1.5", "8,5", "20,5"])(
    "refuses the fraction %j under its field instead of writing it into an integer column",
    async (value) => {
      // The old action kept "1.5" (two decimals) for "taxRatePct integer",
      // which Postgres refused with 22P02 on save.
      const state = await saveTaxAction({}, tax({ taxRate_beans: value }));
      expect(state.error).toContain("kahve çekirdeği");
      expect(state.fieldErrors?.taxRate_beans).toBe(state.error);
      expect(updateSettings).not.toHaveBeenCalled();
    },
  );

  it("refuses an empty, negative or over-100 rate and text", async () => {
    for (const bad of ["", "-1", "101", "yirmi"]) {
      updateSettings.mockClear();
      const state = await saveTaxAction({}, tax({ taxRate_karaoke: bad }));
      expect(state.error, bad).toContain("Karaoke");
      expect(updateSettings).not.toHaveBeenCalled();
    }
  });

  it("writes no row for the rates it already has", async () => {
    const state = await saveTaxAction({}, tax());
    expect(state.message).toContain("Değişiklik yok");
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("stores the shipping and courier fee's own rate (18 Eki 2026)", async () => {
    const state = await saveTaxAction({}, tax({ taxRate_shipping: "10" }));
    expect(state.error).toBeUndefined();
    expect(updateSettings).toHaveBeenCalledWith({
      taxRates: expect.objectContaining({ shipping: 10, beans: 10 }),
    });
    updateSettings.mockClear();
    const empty = await saveTaxAction({}, tax({ taxRate_shipping: "" }));
    expect(empty.error).toContain("Kargo ve kurye ücreti");
    expect(empty.fieldErrors?.taxRate_shipping).toBe(empty.error);
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("a form from before the shipping field existed keeps the stored fee rate", async () => {
    // A tab opened before the deploy posts the seven old fields only: the
    // other rates save, the fee keeps what was stored.
    const fd = tax({ taxRate_menu: "8" });
    fd.delete("taxRate_shipping");
    const state = await saveTaxAction({}, fd);
    expect(state.error).toBeUndefined();
    expect(updateSettings).toHaveBeenCalledWith({
      taxRates: { ...SETTINGS.taxRates, menu: 8 },
    });
  });
});

describe("saveNotificationsAction", () => {
  function notifications(
    fields: Record<string, string>,
    roles: string[] = [],
    confirmed: string[] = [],
  ): FormData {
    const fd = form(fields, confirmed);
    for (const r of roles) fd.append("orderNotifyRoles", r);
    return fd;
  }

  it("is the owner's: it checks the settings section first", async () => {
    await saveNotificationsAction({}, notifications({}));
    expect(requireRole).toHaveBeenCalledWith("settings");
  });

  it("stores the switch, the known roles and the cleaned address list", async () => {
    const state = await saveNotificationsAction(
      {},
      notifications(
        {
          notificationEmail: "info@ornek.com",
          orderNotifyEnabled: "on",
          orderNotifyEmails:
            "Mutfak@Ornek.com, bar@ornek.com\nmutfak@ornek.com",
        },
        ["cashier", "owner"],
      ),
    );
    expect(state.error).toBeUndefined();
    expect(updateSettings).toHaveBeenCalledWith({
      notificationEmail: "info@ornek.com",
      orderNotifyEnabled: true,
      orderNotifyRoles: ["owner", "cashier"],
      orderNotifyEmails: "mutfak@ornek.com\nbar@ornek.com",
    });
    // The audit row counts the addresses rather than copying them.
    const payload = JSON.stringify(logAudit.mock.calls.at(-1));
    expect(payload).not.toContain("mutfak@ornek.com");
  });

  it("makes a swapped address visible in the audit row without writing it out", async () => {
    Object.assign(SETTINGS, {
      notificationEmail: "ops@laffogato.net",
      orderNotifyEmails: "kasa@laffogato.net",
    });
    await saveNotificationsAction(
      {},
      notifications(
        {
          notificationEmail: "ops@laffogato.net",
          orderNotifyEnabled: "on",
          orderNotifyEmails: "biri@disari.example",
        },
        ["owner"],
      ),
    );
    const entry = lastAudit() as unknown as {
      payload: {
        before: Record<string, unknown>;
        after: Record<string, unknown>;
        changed: Record<string, unknown>;
      };
    };
    // Same count on both sides - the old audit row read as a no-op.
    expect(entry.payload.before.orderNotifyEmailCount).toBe(1);
    expect(entry.payload.after.orderNotifyEmailCount).toBe(1);
    expect(entry.payload.before.orderNotifyEmailDomains).toEqual([
      "laffogato.net",
    ]);
    expect(entry.payload.after.orderNotifyEmailDomains).toEqual([
      "disari.example",
    ]);
    expect(entry.payload.changed).toEqual({
      notificationEmail: false,
      orderNotifyEmails: true,
      orderNotifyEmailsAdded: 1,
      orderNotifyEmailsRemoved: 1,
    });
    const text = JSON.stringify(entry);
    expect(text).not.toContain("kasa@");
    expect(text).not.toContain("biri@");
    expect(text).not.toContain("ops@");
  });

  it("refuses an address it cannot mail, saving nothing", async () => {
    const state = await saveNotificationsAction(
      {},
      notifications({ orderNotifyEmails: "iyi@ornek.com, kötü-adres" }),
    );
    expect(state.error).toContain("kötü-adres");
    expect(state.fieldErrors?.orderNotifyEmails).toContain("kötü-adres");
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("refuses a personal webmail inbox in either field, saving nothing", async () => {
    // KVKK m.9: staff mail keeps customer data; Gmail keeps it abroad.
    const extra = await saveNotificationsAction(
      {},
      notifications({ orderNotifyEmails: "iyi@ornek.com\npatron@gmail.com" }),
    );
    expect(extra.fieldErrors?.orderNotifyEmails).toContain("patron@gmail.com");
    expect(extra.error).toContain("kişisel");
    const ops = await saveNotificationsAction(
      {},
      notifications({ notificationEmail: "Ops@Hotmail.com" }),
    );
    expect(ops.fieldErrors?.notificationEmail).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("refuses a role that does not exist", async () => {
    const state = await saveNotificationsAction(
      {},
      notifications({ orderNotifyEnabled: "on" }, ["owner", "root"]),
    );
    expect(state.error).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("asks before turning the mail off, then turns it off", async () => {
    const asked = await saveNotificationsAction(
      {},
      notifications({}, ["owner"]),
    );
    expect(asked.confirm?.keys).toEqual(["order-mail-off"]);
    expect(updateSettings).not.toHaveBeenCalled();

    await saveNotificationsAction(
      {},
      notifications({}, ["owner"], ["order-mail-off"]),
    );
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ orderNotifyEnabled: false }),
    );
  });

  it("asks when the mail stays on but nobody would receive it", async () => {
    // Kasiyer ticked, no active cashier, no operations or extra address.
    const asked = await saveNotificationsAction(
      {},
      notifications({ orderNotifyEnabled: "on" }, ["cashier"]),
    );
    expect(asked.confirm?.keys).toEqual(["no-recipients"]);
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("does not ask when someone receives it", async () => {
    const state = await saveNotificationsAction(
      {},
      notifications({ orderNotifyEnabled: "on" }, ["manager"]),
    );
    expect(state.confirm).toBeUndefined();
    expect(updateSettings).toHaveBeenCalled();
  });

  it("does not guess 'nobody' when the panel accounts cannot be read", async () => {
    listAdminUsers.mockRejectedValueOnce(new Error("db down"));
    const state = await saveNotificationsAction(
      {},
      notifications({ orderNotifyEnabled: "on" }, ["cashier"]),
    );
    expect(state.confirm).toBeUndefined();
    expect(updateSettings).toHaveBeenCalled();
  });

  it("writes nothing for an unchanged form", async () => {
    const state = await saveNotificationsAction(
      {},
      notifications({ orderNotifyEnabled: "on" }, [
        "owner",
        "manager",
        "cashier",
      ]),
    );
    expect(state.message).toContain("Değişiklik yok");
    expect(updateSettings).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });
});

describe("saveEmailSenderAction", () => {
  const sender = (
    over: Record<string, string> = {},
    confirmed: string[] = [],
  ) =>
    form(
      {
        emailFromName: "L'Affogato",
        emailFromAddress: "",
        emailReplyTo: "",
        ...over,
      },
      confirmed,
    );

  it("asks before saving a sender on a domain Resend has not verified", async () => {
    senderDomainStatus.mockResolvedValue("pending");
    const asked = await saveEmailSenderAction(
      {},
      sender({ emailFromAddress: "siparis@yeni.example" }),
    );
    expect(senderDomainStatus).toHaveBeenCalledWith("siparis@yeni.example");
    expect(asked.confirm?.keys).toEqual(["sender-unverified:yeni.example"]);
    expect(asked.confirm?.lines.join(" ")).toMatch(/hiçbir e-posta/);
    expect(updateSettings).not.toHaveBeenCalled();

    await saveEmailSenderAction(
      {},
      sender({ emailFromAddress: "siparis@yeni.example" }, [
        "sender-unverified:yeni.example",
      ]),
    );
    expect(updateSettings).toHaveBeenCalled();
  });

  it.each(["verified", "unknown"])(
    "saves without asking when the domain reads %s",
    async (status) => {
      senderDomainStatus.mockResolvedValue(status);
      const state = await saveEmailSenderAction(
        {},
        sender({ emailFromAddress: "siparis@laffogato.net" }),
      );
      expect(state.confirm).toBeUndefined();
      expect(updateSettings).toHaveBeenCalled();
    },
  );

  it("keeps the sender it replaced in the audit row", async () => {
    SETTINGS.emailFromAddress = "eski@laffogato.net";
    await saveEmailSenderAction(
      {},
      sender({ emailFromAddress: "siparis@laffogato.net" }),
    );
    expect(lastAudit().payload).toEqual({
      section: "email",
      before: { emailFromAddress: "eski@laffogato.net" },
      after: { emailFromAddress: "siparis@laffogato.net" },
    });
  });

  it("refuses a malformed reply-to under its field", async () => {
    const state = await saveEmailSenderAction(
      {},
      sender({ emailReplyTo: "yanit@" }),
    );
    expect(state.fieldErrors?.emailReplyTo).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  // Verifier SS-F3: Kaydet without an edit is how an operator back from
  // Resend's Domains page asks again; the banner's 2-minute cache would
  // keep the old verdict otherwise.
  it("re-reads the banner on a save that changes nothing", async () => {
    const state = await saveEmailSenderAction({}, sender());
    expect(state.message).toMatch(/Değişiklik yok/);
    expect(updateSettings).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
    expect(forgetEmailHealth).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/ayarlar");
  });
});

describe("sendTestEmailAction", () => {
  it("logs the test as send_test (Test gönderimi), not as a settings update", async () => {
    sendTestEmail.mockResolvedValue({ ok: true });
    const state = await sendTestEmailAction(
      {},
      form({ testEmailTo: "Okan@Ornek.com" }),
    );
    expect(state.message).toContain("okan@ornek.com");
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "send_test",
        entity: "settings",
        entityId: "email-test",
        payload: { section: "email-test", to: "okan@ornek.com" },
      }),
    );
  });

  it("re-reads the banner after a failed test too", async () => {
    sendTestEmail.mockResolvedValue({
      ok: false,
      error: "laffogato.net alan adı Resend'de doğrulanmamış.",
    });
    const state = await sendTestEmailAction(
      {},
      form({ testEmailTo: "okan@ornek.com" }),
    );
    expect(state.error).toBe(
      "Gönderilemedi: laffogato.net alan adı Resend'de doğrulanmamış.",
    );
    expect(forgetEmailHealth).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/admin/ayarlar");
    expect(logAudit).not.toHaveBeenCalled();
  });
});

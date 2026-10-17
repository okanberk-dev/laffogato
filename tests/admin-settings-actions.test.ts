import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Settings actions guard the numbers that price live orders.
 *
 * `parseMoneyMinor` used to fall back to 0 on anything it could not read, so
 * "₺75" in Kurye ücreti made every kurye order that evening free, and the
 * audit row said only "settings shipping update".
 */

const updateSettings = vi.fn();
const logAudit = vi.fn();

const SETTINGS = {
  shippingFlatMinor: 4900,
  shippingFreeThresholdMinor: 75000,
  courierFeeMinor: 5500,
  karaokeHourlyMinor: 90000,
  karaokeCapacity: 8,
  karaokeNotifyEmail: "",
  taxRates: {
    menu: 10,
    karaoke: 20,
    beans: 1,
    pantry: 1,
    gift: 20,
    gear: 20,
    merch: 20,
  },
  openingHours: "eski",
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireRole: vi.fn(async () => ({})) }));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
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
  saveShippingAction,
  saveKaraokeAction,
  saveHoursAction,
  saveNotificationsAction,
  saveTaxAction,
} = await import("@/app/admin/ayarlar/actions");
const { requireRole } = await import("@/lib/admin/auth");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const shipping = (over: Partial<Record<string, string>> = {}) =>
  form({
    shippingFlat: "49",
    shippingFreeThreshold: "750",
    courierFee: "55",
    ...over,
  });

beforeEach(() => {
  updateSettings.mockClear();
  logAudit.mockClear();
});

describe("saveShippingAction", () => {
  it("refuses a courier fee it cannot read instead of storing 0", async () => {
    const state = await saveShippingAction(
      {},
      shipping({ courierFee: "75 lira" }),
    );
    expect(state.error).toBeTruthy();
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

  it("stores kuruş integers and audits before/after for every key", async () => {
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
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "settings",
        payload: expect.objectContaining({
          section: "shipping",
          before: expect.objectContaining({ courierFeeMinor: 5500 }),
          after: expect.objectContaining({ courierFeeMinor: 6050 }),
        }),
      }),
    );
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
      form({ karaokeHourly: "1.000", karaokeCapacity: "8" }),
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
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("audits the before/after of the karaoke settings", async () => {
    const state = await saveKaraokeAction(
      {},
      form({
        karaokeHourly: "1000",
        karaokeCapacity: "10",
        karaokeNotifyEmail: " bizimfutbol9@gmail.com ",
      }),
    );
    expect(state.message).toBeTruthy();
    expect(updateSettings).toHaveBeenCalledWith({
      karaokeHourlyMinor: 100000,
      karaokeCapacity: 10,
      karaokeNotifyEmail: "bizimfutbol9@gmail.com",
      // An unticked checkbox sends nothing: the switch goes off.
      karaokePrepay: false,
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          section: "karaoke",
          before: expect.objectContaining({
            karaokeHourlyMinor: 90000,
            karaokeCapacity: 8,
            karaokeNotifyEmail: "",
          }),
          after: {
            karaokeHourlyMinor: 100000,
            karaokeCapacity: 10,
            karaokeNotifyEmail: "bizimfutbol9@gmail.com",
            karaokePrepay: false,
          },
        }),
      }),
    );
  });

  it("refuses a karaoke notice address that is not an e-mail", async () => {
    const state = await saveKaraokeAction(
      {},
      form({
        karaokeHourly: "1000",
        karaokeCapacity: "8",
        karaokeNotifyEmail: "bizimfutbol9",
      }),
    );
    expect(state.error).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("accepts an empty notice address - the notice falls back to the contact e-mail", async () => {
    const state = await saveKaraokeAction(
      {},
      form({ karaokeHourly: "1000", karaokeCapacity: "8" }),
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
      expect(updateSettings, bad).not.toHaveBeenCalled();
    }
  });

  it("lets a day marked closed keep empty time boxes", async () => {
    updateSettings.mockClear();
    const res = await saveHoursAction(
      {},
      week({ "sunday-closed": "on", "sunday-open": "", "sunday-close": "" }),
    );
    expect(res.error).toBeUndefined();
    expect(updateSettings.mock.calls[0][0].weeklyHours.sunday.closed).toBe(
      true,
    );
  });
});

describe("saveNotificationsAction", () => {
  function notifications(
    fields: Record<string, string>,
    roles: string[] = [],
  ): FormData {
    const fd = form(fields);
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
          orderNotifyEmails: "Mutfak@Ornek.com, bar@ornek.com\nmutfak@ornek.com",
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
    const saved = { ...SETTINGS };
    Object.assign(SETTINGS, {
      notificationEmail: "ops@laffogato.net",
      orderNotifyEmails: "kasa@laffogato.net",
    });
    try {
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
    } finally {
      for (const k of Object.keys(SETTINGS)) {
        if (!(k in saved)) delete (SETTINGS as Record<string, unknown>)[k];
      }
      Object.assign(SETTINGS, saved);
    }
    const entry = logAudit.mock.calls.at(-1)?.[0] as {
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

  it("turns the mail off when the box is unticked", async () => {
    await saveNotificationsAction({}, notifications({}, ["owner"]));
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ orderNotifyEnabled: false }),
    );
  });
});

describe("saveTaxAction (KDV oranları, 17 Eki 2026)", () => {
  const tax = (over: Partial<Record<string, string>> = {}) =>
    form({
      taxRate_menu: "10",
      taxRate_karaoke: "20",
      taxRate_beans: "1",
      taxRate_pantry: "1",
      taxRate_gift: "20",
      taxRate_gear: "20",
      taxRate_merch: "20",
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
        beans: 1,
        pantry: 1,
        gift: 20,
        gear: 20,
        merch: 20,
      },
    });
    expect(logAudit).toHaveBeenCalledWith(
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

  it("refuses a fraction instead of writing it into an integer column", async () => {
    // The old action kept "1.5" (two decimals) for "taxRatePct integer",
    // which Postgres refused with 22P02 on save.
    const state = await saveTaxAction({}, tax({ taxRate_beans: "1.5" }));
    expect(state.error).toContain("kahve çekirdeği");
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("refuses an empty, negative or over-100 rate and text", async () => {
    for (const bad of ["", "-1", "101", "yirmi"]) {
      updateSettings.mockClear();
      const state = await saveTaxAction({}, tax({ taxRate_karaoke: bad }));
      expect(state.error, bad).toContain("Karaoke");
      expect(updateSettings).not.toHaveBeenCalled();
    }
  });
});

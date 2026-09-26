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
  taxRatePct: 10,
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

const { saveShippingAction, saveKaraokeAction } =
  await import("@/app/admin/ayarlar/actions");

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
    const state = await saveShippingAction({}, shipping({ courierFee: "₺75" }));
    expect(state.error).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
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
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          section: "karaoke",
          before: {
            karaokeHourlyMinor: 90000,
            karaokeCapacity: 8,
            karaokeNotifyEmail: "",
          },
          after: {
            karaokeHourlyMinor: 100000,
            karaokeCapacity: 10,
            karaokeNotifyEmail: "bizimfutbol9@gmail.com",
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

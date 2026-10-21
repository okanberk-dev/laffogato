import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminSettings } from "@/lib/admin/store";
import {
  istanbulToday,
  MENU_PRICES_DATE_ERROR,
  MENU_PRICES_DATE_FIELD,
  MENU_PRICES_DATE_FUTURE_ERROR,
  MENU_PRICES_DATE_OLD_ERROR,
  menuPriceNote,
  menuPricesDateLabel,
  parseMenuPricesDate,
} from "@/lib/menu/price-list";
import { LEGAL_TAX_RATES } from "@/lib/utils/kdv";

/**
 * The day the menu prices started to apply (18 Oct 2026, decision
 * OP-PRICE-LISTS, Fiyat Etiketi Yön. m.5/2-d and m.8/2): an Istanbul day in
 * Ayarlar > Vergi, kept as "YYYY-MM-DD", printed under /menu and /masa.
 */

const h = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  logAudit: vi.fn(async (_input: unknown) => {}),
  settings: {} as Record<string, unknown>,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({})),
  listEnvAdminContacts: vi.fn(),
}));
vi.mock("@/lib/admin/users", () => ({ listAdminUsers: vi.fn() }));
vi.mock("@/lib/admin/audit", () => ({
  logAudit: h.logAudit,
  safeAudit: async (input: unknown) => {
    await h.logAudit(input);
    return true;
  },
}));
vi.mock("@/lib/email/health", () => ({
  forgetEmailHealth: vi.fn(),
  senderDomainStatus: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({ sendTestEmail: vi.fn() }));
vi.mock("@/lib/admin/store", () => ({
  DAYS_OF_WEEK: [],
  getSettings: vi.fn(async () => h.settings),
  updateSettings: h.updateSettings,
}));

const { saveTaxAction } = await import("@/app/admin/ayarlar/actions");

describe("the Istanbul day", () => {
  it("is tomorrow already at 21:00 UTC, and not before", () => {
    expect(istanbulToday(new Date("2026-10-17T20:59:00Z"))).toBe("2026-10-17");
    expect(istanbulToday(new Date("2026-10-17T21:00:00Z"))).toBe("2026-10-18");
  });

  it("takes '' or a real day from 2020 to today, nothing later", () => {
    // 01:30 in Tuzla on 18 Oct, 22:30 on the 17th in UTC.
    const now = new Date("2026-10-17T22:30:00Z");
    expect(parseMenuPricesDate("", now)).toEqual({ ok: true, value: "" });
    expect(parseMenuPricesDate(" 2026-10-18 ", now)).toEqual({
      ok: true,
      value: "2026-10-18",
    });
    expect(parseMenuPricesDate("2026-10-19", now)).toEqual({
      ok: false,
      error: MENU_PRICES_DATE_FUTURE_ERROR,
    });
    expect(parseMenuPricesDate("2019-12-31", now)).toEqual({
      ok: false,
      error: MENU_PRICES_DATE_OLD_ERROR,
    });
    for (const bad of ["2026-02-30", "18.10.2026", "2026-13-01", "dün"]) {
      expect(parseMenuPricesDate(bad, now), bad).toEqual({
        ok: false,
        error: MENU_PRICES_DATE_ERROR,
      });
    }
  });

  it("reads as the regulation's words under the menu", () => {
    expect(menuPricesDateLabel("2026-10-18")).toBe("18 Ekim 2026");
    expect(menuPricesDateLabel("2026-02-30")).toBeNull();
    expect(menuPricesDateLabel("")).toBeNull();
    expect(menuPriceNote("2026-10-08")).toBe(
      "Fiyatlarımıza KDV dahildir · Fiyatların uygulanmaya başladığı tarih: 8 Ekim 2026",
    );
    expect(menuPriceNote("")).toBe("Fiyatlarımıza KDV dahildir.");
    expect(menuPriceNote(undefined)).toBe("Fiyatlarımıza KDV dahildir.");
  });
});

describe("the settings column", () => {
  it("is text, empty by default, never guessed from a row", () => {
    const sql = readFileSync(
      "db/migrations/20261018210200_menu_prices_effective_date.sql",
      "utf8",
    ).replace(/--[^\n]*/g, "");
    expect(sql.trim()).toBe(
      `alter table public.settings add column if not exists "menuPricesEffectiveDate" text not null default '';`,
    );
    const store = readFileSync("src/lib/admin/store.ts", "utf8");
    expect(store).toMatch(/\n {4}menuPricesEffectiveDate: "",\n/);
  });
});

describe("saveTaxAction: the menu price list's day", () => {
  const RATES = {
    taxRate_menu: "10",
    taxRate_karaoke: "20",
    taxRate_beans: "10",
    taxRate_pantry: "10",
    taxRate_gift: "20",
    taxRate_gear: "20",
    taxRate_merch: "20",
    taxRate_shipping: "20",
  };
  const tax = (date?: string) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(RATES)) fd.set(k, v);
    if (date !== undefined) fd.set(MENU_PRICES_DATE_FIELD, date);
    return fd;
  };

  beforeEach(() => {
    h.updateSettings.mockReset();
    h.logAudit.mockClear();
    h.settings = {
      taxRates: { ...LEGAL_TAX_RATES },
      menuPricesEffectiveDate: "",
    };
  });

  it("stores the day and audits before and after", async () => {
    const state = await saveTaxAction({}, tax("2026-10-01"));
    expect(state.error).toBeUndefined();
    expect(h.updateSettings).toHaveBeenCalledWith({
      taxRates: { ...LEGAL_TAX_RATES },
      menuPricesEffectiveDate: "2026-10-01",
    });
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          before: { menuPricesEffectiveDate: "" },
          after: { menuPricesEffectiveDate: "2026-10-01" },
        }),
      }),
    );
  });

  it("refuses a day after today under the field, and writes nothing", async () => {
    const state = await saveTaxAction({}, tax("2099-01-01"));
    expect(state.error).toBe(MENU_PRICES_DATE_FUTURE_ERROR);
    expect(state.fieldErrors?.[MENU_PRICES_DATE_FIELD]).toBe(state.error);
    expect(h.updateSettings).not.toHaveBeenCalled();
  });

  it("clears the day with an empty field", async () => {
    h.settings.menuPricesEffectiveDate = "2026-10-01";
    await saveTaxAction({}, tax(""));
    expect(h.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ menuPricesEffectiveDate: "" }),
    );
  });

  it("leaves the stored day alone for a form without the field", async () => {
    h.settings.menuPricesEffectiveDate = "2026-10-01";
    h.settings.taxRates = { ...LEGAL_TAX_RATES, menu: 8 };
    await saveTaxAction({}, tax());
    expect(h.updateSettings).toHaveBeenCalledWith({
      taxRates: { ...LEGAL_TAX_RATES },
    });
  });
});

describe("Ayarlar > Vergi", () => {
  it("has the day as a date field, filled from the settings", async () => {
    vi.resetModules();
    vi.doMock("@/app/admin/ayarlar/actions", () => {
      const noop = async () => ({});
      return {
        saveEmailSenderAction: noop,
        saveGeneralAction: noop,
        saveHoursAction: noop,
        saveNotificationsAction: noop,
        saveSeoAction: noop,
        saveShippingAction: noop,
        saveTaxAction: noop,
        sendTestEmailAction: noop,
      };
    });
    vi.doMock("@/app/admin/ayarlar/karaoke-actions", () => ({
      saveKaraokeAction: async () => ({}),
    }));
    const { SettingsForm } = await import("@/app/admin/ayarlar/settings-form");
    const { parseSettingsTab } =
      await import("@/app/admin/ayarlar/settings-core");
    const html = renderToStaticMarkup(
      createElement(SettingsForm, {
        settings: {
          weeklyHours: Object.fromEntries(
            ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [
              d,
              { open: "09:00", close: "02:00", closed: false },
            ]),
          ),
          taxRates: { ...LEGAL_TAX_RATES },
          orderNotifyRoles: [],
          menuPricesEffectiveDate: "2026-10-01",
        } as unknown as AdminSettings,
        mail: { hasProvider: false } as never,
        initialTab: parseSettingsTab("tax"),
      }),
    );
    const panel = html.slice(html.indexOf('id="settings-panel-tax"'));
    const input = panel.match(
      new RegExp(`<input[^>]*name="${MENU_PRICES_DATE_FIELD}"[^>]*>`),
    )?.[0];
    expect(input).toContain('type="date"');
    expect(input).toContain('value="2026-10-01"');
    expect(panel).toContain("Fiyatların uygulanmaya başladığı tarih");
  });
});

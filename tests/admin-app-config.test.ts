import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_MOBILE_APP_CONFIG,
  type MobileAppConfig,
} from "@/lib/mobile/app-config";

/**
 * Mobil → Uygulama ayarları (admin audit CON-03, CON-05, CON-12, CON-20,
 * CON-21, CON-25, CON-27, KAR-02, KAR-12, KAR-17):
 *
 * - the nine tabs post by hand, so a refused save keeps what was typed and
 *   the ticked boxes (React reset every `<form action>` on any answer);
 * - every refusal lands under its own field, a reminder's names its row;
 * - maintenance going on and the minimum version going up are not written
 *   on the first press: the action asks first, against the saved document;
 * - the tabs are real tabs, and the open one is in the address (?bolum=).
 */

const updateSettings = vi.fn(async (_patch: unknown) => ({}));
const logAudit = vi.fn(async (_input: unknown) => {});
let saved: MobileAppConfig = DEFAULT_MOBILE_APP_CONFIG;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireRole: vi.fn(async () => ({})) }));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
vi.mock("@/lib/admin/store", () => ({
  getSettings: vi.fn(async () => ({ mobileApp: saved })),
  updateSettings,
}));

const actions = await import("@/app/admin/mobil/ayarlar/actions");
const core = await import("@/app/admin/mobil/ayarlar/app-config-core");
const { AppConfigForm } =
  await import("@/app/admin/mobil/ayarlar/app-config-form");

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const one of Array.isArray(v) ? v : [v]) fd.append(k, one);
  }
  return fd;
}

const VERSION = {
  minSupportedAppVersion: "1.0.0",
  maintenanceTitle: "Kısa bir mola",
  maintenanceMessage: "Uygulama bakımda.",
};

function config(patch: Partial<MobileAppConfig> = {}): MobileAppConfig {
  return { ...structuredClone(DEFAULT_MOBILE_APP_CONFIG), ...patch };
}

beforeEach(() => {
  updateSettings.mockClear();
  logAudit.mockClear();
  saved = config();
});

describe("Sürüm ve bakım asks before closing the app (D26)", () => {
  it("does not write maintenance on until the operator says yes", async () => {
    const asked = await actions.saveVersionAction(
      {},
      form({ ...VERSION, maintenanceEnabled: "on" }),
    );
    expect(updateSettings).not.toHaveBeenCalled();
    expect(asked.confirm?.keys).toEqual(["maintenance"]);
    expect(asked.confirm?.title).toMatch(/bakıma alınsın mı/);
    expect(asked.confirm?.lines.join(" ")).toContain("Kısa bir mola");
    expect(asked.confirm?.phrase).toBeUndefined();

    const yes = await actions.saveVersionAction(
      {},
      form({
        ...VERSION,
        maintenanceEnabled: "on",
        [core.CONFIRMED_FIELD]: "maintenance",
      }),
    );
    expect(yes.message).toBeTruthy();
    expect(updateSettings).toHaveBeenCalledTimes(1);
  });

  it("asks for a version raise with the new version typed back, once per version", async () => {
    const asked = await actions.saveVersionAction(
      {},
      form({ ...VERSION, minSupportedAppVersion: "2.0.0" }),
    );
    expect(updateSettings).not.toHaveBeenCalled();
    expect(asked.confirm?.keys).toEqual(["version:2.0.0"]);
    expect(asked.confirm?.phrase).toBe("2.0.0");
    // No store address yet: the forced-update screen has no way out.
    expect(asked.confirm?.lines.join(" ")).toMatch(
      /App Store ve Google Play adresi boş/,
    );

    // A yes given for another version does not carry over.
    const stale = await actions.saveVersionAction(
      {},
      form({
        ...VERSION,
        minSupportedAppVersion: "2.0.0",
        [core.CONFIRMED_FIELD]: "version:1.5.0",
      }),
    );
    expect(stale.confirm).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();

    const yes = await actions.saveVersionAction(
      {},
      form({
        ...VERSION,
        minSupportedAppVersion: "2.0.0",
        [core.CONFIRMED_FIELD]: "version:2.0.0",
      }),
    );
    expect(yes.message).toBeTruthy();
    expect(updateSettings).toHaveBeenCalledTimes(1);
  });

  it("reads the saved document, not the form: lowering, keeping or ending maintenance saves at once", async () => {
    saved = config({
      minSupportedAppVersion: "1.4.0",
      maintenance: { enabled: true, title: "x", message: "y" },
    });
    for (const fields of [
      { ...VERSION, minSupportedAppVersion: "1.4.0", maintenanceEnabled: "on" },
      { ...VERSION, minSupportedAppVersion: "1.2.0" },
    ]) {
      const res = await actions.saveVersionAction({}, form(fields));
      expect(res.confirm).toBeUndefined();
      expect(res.message).toBeTruthy();
    }
    expect(updateSettings).toHaveBeenCalledTimes(2);
  });

  it("names the store that is still missing when only one is set", () => {
    const ask = core.versionGateConfirm(
      config({
        store: {
          ...DEFAULT_MOBILE_APP_CONFIG.store,
          appStoreUrl: "https://apps.apple.com/tr/app/id1",
        },
      }),
      {
        minSupportedAppVersion: "1.1.0",
        maintenance: { enabled: true, title: "Mola" },
      },
      [],
    );
    expect(ask?.keys).toEqual(["maintenance", "version:1.1.0"]);
    expect(ask?.phrase).toBe("1.1.0");
    expect(ask?.lines.join(" ")).toContain("Google Play adresi boş");
    expect(ask?.lines.join(" ")).not.toContain("App Store");
  });

  it("puts a refusal under its field", async () => {
    const res = await actions.saveVersionAction(
      {},
      form({
        ...VERSION,
        minSupportedAppVersion: "1,2",
        maintenanceTitle: " ",
      }),
    );
    expect(res.fieldErrors?.minSupportedAppVersion).toMatch(/x\.y\.z/);
    expect(res.fieldErrors?.maintenanceTitle).toMatch(/boş olamaz/);
    expect(res.error).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });
});

describe("other tabs name the field they refuse", () => {
  it("Sipariş: a lower bound above the upper one", async () => {
    const res = await actions.saveOrderingAction(
      {},
      form({ etaMin: "40", etaMax: "30", closedMessage: "Kapalı." }),
    );
    expect(Object.keys(res.fieldErrors ?? {})).toEqual(["etaMin"]);
  });

  it("Sadakat: the reward value under its own input", async () => {
    const res = await actions.saveLoyaltyAction(
      {},
      form({
        stampTarget: "6",
        rewardTitle: "Kahve",
        rewardValue: "12abc",
        rewardTtlDays: "30",
      }),
    );
    expect(Object.keys(res.fieldErrors ?? {})).toEqual(["rewardValue"]);
  });

  it("Mutlu saatler: the end before the start", async () => {
    const res = await actions.saveHappyHourAction(
      {},
      form({
        happyDays: "weekday",
        happyFrom: "17:00",
        happyTo: "14:00",
        happyPct: "20",
      }),
    );
    expect(Object.keys(res.fieldErrors ?? {})).toEqual(["happyTo"]);
  });
});

describe("Hatırlatmalar (CON-21)", () => {
  const row = (i: number, r: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [`reminder-${i}-${k}`, v]),
    );
  const ok = { id: "sabah", hour: "10", minute: "0", title: "Günaydın" };

  it("refuses a row with text but no kimlik instead of dropping it under 'Kaydedildi'", async () => {
    const res = await actions.saveRemindersAction(
      {},
      form({
        remindersEnabled: "on",
        ...row(0, { ...ok, body: "Menü hazır." }),
        ...row(1, { id: "", hour: "15", minute: "0", title: "İkindi" }),
      }),
    );
    expect(res.error).toMatch(/^Hatırlatma 2 · Kimlik yaz/);
    expect(res.fieldErrors?.["reminder-1-id"]).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("names the row of a sales word and of a repeated kimlik", async () => {
    const sales = await actions.saveRemindersAction(
      {},
      form({
        ...row(0, { ...ok, body: "Menü hazır." }),
        ...row(1, { ...ok, id: "ikindi", body: "Bugün %20 indirim." }),
      }),
    );
    expect(sales.error).toMatch(/^Hatırlatma 2 · Metin:/);
    expect(sales.fieldErrors?.["reminder-1-body"]).toBeTruthy();

    const twice = await actions.saveRemindersAction(
      {},
      form({
        ...row(0, { ...ok, body: "Menü hazır." }),
        ...row(2, { ...ok, body: "Yine menü." }),
      }),
    );
    expect(twice.fieldErrors?.["reminder-2-id"]).toMatch(
      /1\. hatırlatmada da var/,
    );
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("skips a row with nothing written in it and saves the rest", async () => {
    const res = await actions.saveRemindersAction(
      {},
      form({
        remindersEnabled: "on",
        ...row(0, { ...ok, body: "Menü hazır." }),
        // An unused row still posts the form's default hour and minute.
        ...row(1, { id: "", hour: "10", minute: "0", title: "", body: "" }),
      }),
    );
    expect(res.error).toBeUndefined();
    const patch = updateSettings.mock.calls[0][0] as {
      mobileApp: MobileAppConfig;
    };
    expect(patch.mobileApp.reminders.items.map((it) => it.id)).toEqual([
      "sabah",
    ]);
  });
});

describe("tabs in the address (CON-20)", () => {
  it("reads and writes ?bolum=", () => {
    expect(core.parseAppConfigTab("store")).toBe("store");
    expect(core.parseAppConfigTab(["reminders", "x"])).toBe("reminders");
    expect(core.parseAppConfigTab("nope")).toBe("version");
    expect(core.parseAppConfigTab(undefined)).toBe("version");
    expect(core.appConfigTabHref("version")).toBe("/admin/mobil/ayarlar");
    expect(core.appConfigTabHref("happy")).toBe(
      "/admin/mobil/ayarlar?bolum=happy",
    );
  });

  it("moves with the arrows, Home and End, and wraps", () => {
    expect(core.tabAfterKey("version", "ArrowRight")).toBe("ordering");
    expect(core.tabAfterKey("version", "ArrowLeft")).toBe("store");
    expect(core.tabAfterKey("loyalty", "ArrowUp")).toBe("ordering");
    expect(core.tabAfterKey("loyalty", "End")).toBe("store");
    expect(core.tabAfterKey("store", "Home")).toBe("version");
    expect(core.tabAfterKey("store", "Enter")).toBeNull();
  });
});

describe("the form as the server renders it", () => {
  const render = (
    initialTab?: Parameters<typeof AppConfigForm>[0]["initialTab"],
  ) =>
    renderToStaticMarkup(
      createElement(AppConfigForm, {
        config: config({
          maintenance: { enabled: true, title: "Mola", message: "Bakımda." },
        }),
        initialTab,
      }),
    );

  it("draws ARIA tabs and opens the tab the address names", () => {
    const html = render("store");
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(9);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(9);
    // The selected tab is Mağaza; its panel is the one not hidden.
    const tab = html.match(
      /<button[^>]*aria-selected="true"[^>]*>[\s\S]*?<\/button>/,
    )?.[0];
    expect(tab).toContain("Mağaza ve bağlantılar");
    const panels = [...html.matchAll(/<div[^>]*role="tabpanel"[^>]*>/g)].map(
      (m) => m[0],
    );
    expect(panels.filter((p) => !p.includes("hidden"))).toHaveLength(1);
    // A phone gets a select, not a sideways strip with a hidden scrollbar.
    expect(html).toContain("Bölüm");
    expect(html).not.toContain("[&amp;::-webkit-scrollbar]:hidden");
    // The live state on its tab.
    expect(html).toContain("Bakımda");
  });

  it("posts by hand: no form action that React would reset", () => {
    const html = render();
    expect(html.match(/<form /g)).toHaveLength(9);
    expect(html).not.toMatch(/<form[^>]*\saction=/);
    const src = readFileSync(
      "src/app/admin/mobil/ayarlar/app-config-form.tsx",
      "utf8",
    );
    expect(src).not.toMatch(/<form action=|useActionState/);
  });

  it("keeps Bakım modu out of a label, and its hint off the checkbox (CON-05)", () => {
    const html = render();
    const fieldset = html.match(
      /<fieldset[^>]*>\s*<legend[^>]*>Bakım modu<\/legend>[\s\S]*?<\/fieldset>/,
    )?.[0];
    expect(fieldset).toContain('name="maintenanceEnabled"');
    expect(html).not.toMatch(/<label[^>]*>(?:(?!<\/label>)[\s\S])*<label/);
  });

  it("types a version on a Turkish iPhone and checks IDs in a real monospace (CON-27)", () => {
    const html = render();
    const version = html.match(
      /<input[^>]*name="minSupportedAppVersion"[^>]*>/,
    )?.[0];
    expect(version).toContain('inputMode="text"');
    for (const name of ["appleTeamId", "androidSha256"]) {
      const el = html.match(
        new RegExp(`<(?:input|textarea)[^>]*name="${name}"[^>]*>`),
      )?.[0];
      expect(el, name).toContain("ui-monospace");
    }
  });

  it("gives the reminder kimlik a pattern the browser can compile (v flag)", () => {
    const html = render();
    const pattern =
      html.match(/name="reminder-0-id"[^>]*pattern="([^"]+)"/)?.[1] ??
      html.match(/pattern="([^"]+)"[^>]*name="reminder-0-id"/)?.[1];
    expect(pattern).toBeTruthy();
    expect(() => new RegExp(`^(?:${pattern})$`, "v")).not.toThrow();
    expect(new RegExp(`^(?:${pattern})$`, "v").test("sabah-2")).toBe(true);
    expect(new RegExp(`^(?:${pattern})$`, "v").test("Sabah")).toBe(false);
  });

  it("says what is true for the reader (CON-25, KAR-12, KAR-17)", () => {
    const html = render();
    expect(html).not.toContain("karar 20");
    expect(html).toContain("yalnız eski uygulama sürümleri");
    // Ayarlar is the owner's page; a manager is told who sets the price.
    expect(html).toMatch(/kapasitesini sahip, Ayarlar → Karaoke/);
    expect(html).not.toMatch(/font-style:\s*italic/);
    expect(html).not.toMatch(/text-neutral-|text-red-600|text-emerald-|amber-/);
  });
});

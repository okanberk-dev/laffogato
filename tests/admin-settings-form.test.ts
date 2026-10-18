import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AdminSettings } from "@/lib/admin/store";
import { LEGAL_TAX_RATES } from "@/lib/utils/kdv";

/**
 * Ayarlar as markup (no DOM in these tests): the forms post by hand, the
 * open tab follows ?sekme=, the switches sit in fieldsets, and the copy
 * says what the settings really do. The pure helpers behind the tabs and
 * the unsaved-changes check are tested directly.
 */

vi.mock("@/app/admin/ayarlar/actions", () => {
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
vi.mock("@/app/admin/ayarlar/karaoke-actions", () => ({
  saveKaraokeAction: async () => ({}),
}));

const { SettingsForm } = await import("@/app/admin/ayarlar/settings-form");
const { SaveBar } = await import("@/app/admin/ayarlar/settings-ui");
const core = await import("@/app/admin/ayarlar/settings-core");

const SETTINGS = {
  name: "L'Affogato",
  tagline: "",
  phone: "",
  email: "info@laffogato.net",
  address: "",
  heroImageUrl: "",
  isShopOpen: true,
  weeklyHours: Object.fromEntries(
    ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [
      d,
      { open: "09:00", close: "02:00", closed: false },
    ]),
  ),
  taxRates: { ...LEGAL_TAX_RATES },
  shippingFlatMinor: 4900,
  shippingFreeThresholdMinor: 50000,
  courierFeeMinor: 5500,
  pickupReadyMinutes: 15,
  karaokeHourlyMinor: 100000,
  karaokeCapacity: 8,
  karaokeNotifyEmail: "",
  karaokePrepay: true,
  seoTitle: "",
  seoOgImageUrl: "",
  seoIndexable: true,
  notificationEmail: "",
  orderNotifyEnabled: true,
  orderNotifyRoles: ["owner"],
  orderNotifyEmails: "",
  emailFromName: "",
  emailFromAddress: "",
  emailReplyTo: "",
} as unknown as AdminSettings;

const MAIL = {
  hasProvider: true,
  from: "L'Affogato <siparis@laffogato.net>",
  domain: "laffogato.net",
  status: "verified",
  ok: true,
  message: "",
} as never;

function render(initialTab?: string) {
  return renderToStaticMarkup(
    createElement(SettingsForm, {
      settings: SETTINGS,
      mail: MAIL,
      ...(initialTab ? { initialTab: core.parseSettingsTab(initialTab) } : {}),
    }),
  );
}

/** The opening tag of the element with this id. */
function tagWithId(html: string, id: string): string {
  const m = html.match(new RegExp(`<[a-z]+[^>]*id="${id}"[^>]*>`));
  expect(m, id).not.toBeNull();
  return m![0];
}

/** How many <label> elements are open at `index` in `html`. */
function labelDepthAt(html: string, index: number): number {
  const before = html.slice(0, index);
  return (
    (before.match(/<label[\s>]/g) ?? []).length -
    (before.match(/<\/label>/g) ?? []).length
  );
}

describe("posting without React's form reset (SYS-01, KAR-02)", () => {
  it("no settings form is a <form action>: each posts by hand", () => {
    // A function action renders as action="javascript:throw…", and React
    // resets that form's fields after every answer, refusals included:
    // the shop switch came back ON after "Kafe adı en az 2 karakter".
    const html = render();
    const forms = html.match(/<form[^>]*>/g) ?? [];
    expect(forms.length).toBe(9);
    for (const tag of forms) expect(tag).not.toContain("action=");
  });

  it("a press before hydration posts: the fields never land in the address", () => {
    // Before the JS runs there is no onSubmit, and a bare <form> is a GET to
    // the page: Kaydet put ?notificationEmail=…&orderNotifyEmails=… in the
    // address bar, the history and the request log (rule 9). A POST to the
    // page carries them in the body and only renders the page again.
    const html = render("notifications");
    const forms = html.match(/<form[^>]*>/g) ?? [];
    expect(forms.length).toBe(9);
    for (const tag of forms) expect(tag).toContain('method="post"');
  });
});

describe("tabs (SYS-08, SHE-24, KAR-12)", () => {
  it("?sekme=email opens E-posta: its tab is selected, its panel shown", () => {
    const html = render("email");
    expect(tagWithId(html, "settings-tab-email")).toContain(
      'aria-selected="true"',
    );
    expect(tagWithId(html, "settings-tab-general")).toContain(
      'aria-selected="false"',
    );
    expect(tagWithId(html, "settings-panel-email")).not.toContain("hidden");
    expect(tagWithId(html, "settings-panel-general")).toContain("hidden");
  });

  it("is a real tab list: roles, controls, one tab stop", () => {
    const html = render("karaoke");
    expect(html).toContain('role="tablist"');
    const tabs = html.match(/<button[^>]*role="tab"[^>]*>/g) ?? [];
    expect(tabs).toHaveLength(8);
    expect(tabs.filter((t) => t.includes('tabindex="0"'))).toHaveLength(1);
    expect(tagWithId(html, "settings-panel-karaoke")).toContain(
      'aria-labelledby="settings-tab-karaoke"',
    );
    expect(html.match(/role="tabpanel"/g)).toHaveLength(8);
  });

  it("offers every tab in a select for the phone, the open one chosen", () => {
    const html = render("seo");
    const select = html.match(/<select[\s\S]*?<\/select>/)?.[0] ?? "";
    for (const t of core.SETTINGS_TABS) {
      expect(select).toContain(`value="${t.id}"`);
    }
    expect(select).toMatch(/<option value="seo" selected="">/);
  });

  it("reads ?sekme= forgivingly and links back to each tab", () => {
    expect(core.parseSettingsTab("karaoke")).toBe("karaoke");
    expect(core.parseSettingsTab(" EMAIL ")).toBe("email");
    expect(core.parseSettingsTab(["tax", "seo"])).toBe("tax");
    // An audit row's entity id for the test mail.
    expect(core.parseSettingsTab("email-test")).toBe("email");
    expect(core.parseSettingsTab("yok")).toBe("general");
    expect(core.parseSettingsTab(undefined)).toBe("general");
    expect(core.settingsTabHref("email")).toBe("/admin/ayarlar?sekme=email");
    expect(core.settingsTabHref("general")).toBe("/admin/ayarlar");
  });

  it("moves with the arrow keys, wrapping, and jumps with Home / End", () => {
    expect(core.tabAfterKey("general", "ArrowRight")).toBe("hours");
    expect(core.tabAfterKey("general", "ArrowLeft")).toBe("email");
    expect(core.tabAfterKey("email", "ArrowDown")).toBe("general");
    expect(core.tabAfterKey("seo", "Home")).toBe("general");
    expect(core.tabAfterKey("seo", "End")).toBe("email");
    expect(core.tabAfterKey("seo", "Enter")).toBeNull();
  });

  it("the page reads the tab from the address", () => {
    const page = readFileSync("src/app/admin/ayarlar/page.tsx", "utf8");
    expect(page).toContain("parseSettingsTab(params[SETTINGS_TAB_PARAM])");
  });
});

describe("switches outside a label (SYS-05)", () => {
  it.each([
    ["isShopOpen", "Yalnızca kargolu mağaza siparişlerini durdurur"],
    ["seoIndexable", "Kapatırsan arama motorlarına"],
  ])(
    "%s: its hint is not inside a label, so tapping it flips nothing",
    (name, hint) => {
      // Field was a <label> around the Checkbox's own label: a tap on the
      // hint toggled the switch.
      const html = render();
      const at = html.indexOf(hint);
      expect(at, hint).toBeGreaterThan(0);
      expect(labelDepthAt(html, at)).toBe(0);
      const input = html.indexOf(`name="${name}"`);
      const fieldset = html.lastIndexOf("<fieldset", input);
      expect(fieldset).toBeGreaterThan(0);
      expect(html.indexOf("</fieldset>", fieldset)).toBeGreaterThan(at);
    },
  );
});

describe("Saatler (SYS-19)", () => {
  it("names every time box and groups each day under its name", () => {
    const html = render("hours");
    for (const day of ["Pazartesi", "Salı", "Pazar"]) {
      expect(html).toContain(`aria-label="${day} açılış"`);
      expect(html).toContain(`aria-label="${day} kapanış"`);
      expect(html).toContain(`aria-label="Kapalı: ${day}"`);
    }
    expect(html.match(/role="group"/g)?.length).toBeGreaterThanOrEqual(7);
  });
});

describe("unsaved changes (SYS-07)", () => {
  it("a snapshot sees a ticked box go off and ignores the confirm keys", () => {
    const on = core.formSnapshot([
      ["name", "L'Affogato"],
      ["isShopOpen", "on"],
    ]);
    const off = core.formSnapshot([["name", "L'Affogato"]]);
    expect(on).not.toBe(off);
    expect(
      core.formSnapshot([
        ["name", "L'Affogato"],
        ["isShopOpen", "on"],
        [core.CONFIRMED_FIELD, "shop-off"],
      ]),
    ).toBe(on);
  });
});

describe("the saved state, read from the form's own defaults", () => {
  it("matches what FormData would post for the form as rendered", () => {
    const controls = [
      {
        tagName: "INPUT",
        name: "name",
        type: "text",
        defaultValue: "L'Affogato",
      },
      {
        tagName: "INPUT",
        name: "isShopOpen",
        type: "checkbox",
        value: "on",
        defaultChecked: true,
      },
      {
        tagName: "INPUT",
        name: "seoIndexable",
        type: "checkbox",
        value: "on",
        defaultChecked: false,
      },
      {
        tagName: "INPUT",
        name: "orderNotifyRoles",
        type: "checkbox",
        value: "manager",
        defaultChecked: true,
      },
      { tagName: "TEXTAREA", name: "address", defaultValue: "Tuzla" },
      { tagName: "BUTTON", name: "", type: "submit" },
      {
        tagName: "INPUT",
        name: "old",
        type: "text",
        disabled: true,
        defaultValue: "x",
      },
      {
        tagName: "SELECT",
        name: "kind",
        options: [
          { value: "a", defaultSelected: false },
          { value: "b", defaultSelected: true },
        ],
      },
    ];
    expect(core.defaultsSnapshot(controls)).toBe(
      core.formSnapshot([
        ["name", "L'Affogato"],
        ["isShopOpen", "on"],
        ["orderNotifyRoles", "manager"],
        ["address", "Tuzla"],
        ["kind", "b"],
      ]),
    );
  });
});

describe("SaveBar (SYS-18, SYS-23)", () => {
  const api = (over: Record<string, unknown> = {}) =>
    ({
      state: {},
      pending: false,
      dirty: false,
      edited: false,
      onSubmit: () => {},
      onEdit: () => {},
      ask: null,
      cancelAsk: () => {},
      confirmAsk: () => {},
      errorId: (n: string) => `e-${n}`,
      ...over,
    }) as never;
  const bar = (form: unknown, extra: Record<string, unknown> = {}) =>
    renderToStaticMarkup(createElement(SaveBar, { form, ...extra } as never));

  it("reads a refusal out", () => {
    const html = bar(api({ state: { error: "Kurye ücreti sıfırdan büyük…" } }));
    expect(html).toMatch(/<p role="alert"[^>]*>Kurye ücreti/);
  });

  it("drops an old 'kaydedildi' once the form is typed into", () => {
    const saved = { state: { message: "Genel bilgiler kaydedildi." } };
    expect(bar(api(saved))).toContain("kaydedildi");
    const typed = bar(api({ ...saved, edited: true, dirty: true }));
    expect(typed).not.toContain("kaydedildi");
    expect(typed).toContain("Kaydedilmemiş değişiklik var.");
  });

  it("holds 'Test gönder' back with the reason next to it", () => {
    const html = bar(api(), {
      label: "Test gönder",
      disabledReason: "Önce yukarıdaki gönderen ayarlarını kaydet",
    });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby=/);
    expect(html).toContain("Önce yukarıdaki gönderen ayarlarını kaydet");
  });

  it("does not promise the app sees a change at once", () => {
    // bootstrap is cached s-maxage=300.
    expect(bar(api())).toContain("uygulamaya birkaç dakika içinde yansır");
  });
});

describe("copy says what the settings do (SYS-03, SYS-20, SYS-21)", () => {
  it("KDV: prices include it, these are defaults, nothing stored changes", () => {
    const html = render("tax");
    expect(html).toContain("Fiyatlar KDV dahildir.");
    expect(html).toContain("hiçbir fiyatı ya da toplamı değiştirmez");
    expect(html).toContain("varsayılan oranlardır");
    expect(html).toContain("verilmiş siparişlerin kaydı değişmez");
    expect(html).not.toContain("Sepet alt toplamına uygulanır");
  });

  it("SEO: home page only, and indexing off does not remove pages", () => {
    const html = render("seo");
    expect(html).toContain("Ana sayfa başlığı");
    expect(html).toContain("Ana sayfa paylaşım görseli");
    expect(html).toContain("kendiliğinden kalkmaz");
    expect(html).not.toContain("Tüm sayfaların varsayılan başlığı");
    expect(html).not.toContain("meta title");
    expect(html).not.toContain("sitemap yayınla");
  });

  it("free shipping at the threshold itself, 0 switches it off", () => {
    const html = render("shipping");
    expect(html).toContain("bu tutara ulaşınca kargo ücretsiz");
    expect(html).toContain("0 yazarsan ücretsiz kargo kapalı");
  });

  it("no developer jargon, no formal 'siz', no real-looking placeholder", () => {
    const sources = [
      "src/app/admin/ayarlar/settings-form.tsx",
      "src/app/admin/ayarlar/settings-ui.tsx",
      "src/app/admin/ayarlar/karaoke-tab.tsx",
      "src/app/admin/ayarlar/page.tsx",
    ]
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    for (const phrase of [
      "EMAIL_FROM",
      "docs/EMAIL-RESEND.md",
      "siz@ornek.com",
      "nextgenlab",
      "anında uygulanır",
      "SVG placeholder",
      "footer ve Visit sayfasını besler",
    ]) {
      expect(sources, phrase).not.toContain(phrase);
    }
  });
});

describe("kit look (KAR-06, KAR-17, SYS-24)", () => {
  it("no hand-picked Tailwind palette or italic headings in Ayarlar", () => {
    for (const file of [
      "src/app/admin/ayarlar/settings-form.tsx",
      "src/app/admin/ayarlar/settings-ui.tsx",
      "src/app/admin/ayarlar/karaoke-tab.tsx",
      "src/app/admin/ayarlar/identity-status.tsx",
    ]) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toMatch(
        /\b(?:text|bg|border)-(?:neutral|emerald|rose|red)-\d{2,3}\b/,
      );
      expect(src, file).not.toContain('fontStyle: "italic"');
    }
  });
});

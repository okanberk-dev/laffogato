import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { expectReactGuard, formOpenTags } from "./_support/form-guard";

/**
 * The people forms: member edit, promo code, coupon grant, counter stamp,
 * the panel-user forms and the campaign test send.
 *
 * React 19 resets a `<form action={fn}>` once the action finishes, whatever
 * it answers. A refused promo came back with the value on 10, the limit on
 * 0 (unlimited), no expiry and the code re-ticked active; a refused coupon
 * put "Tür" back on %, so a retyped 15 became 15% instead of 15 TL; a
 * refused panel user went back to Kasiyer. They now post by hand
 * (useHandPost, the kit's tested path, tests/admin-action-form) and a
 * thrown store error becomes an answer (withPanelCatch) instead of the
 * full-page error screen.
 */

vi.mock("@/app/admin/musteriler/actions", () => ({
  closeCustomerAccountAction: vi.fn(),
  grantCustomerCouponAction: vi.fn(),
  resendVerificationAction: vi.fn(),
  revokeCustomerCouponAction: vi.fn(),
  setCustomerActiveAction: vi.fn(),
}));
vi.mock("@/app/admin/musteriler/[email]/actions", () => ({
  addCounterStampAction: vi.fn(),
  reverseCounterStampAction: vi.fn(),
}));
vi.mock("@/app/admin/kullanicilar/actions", () => ({
  createAdminUserAction: vi.fn(),
  deleteAdminUserAction: vi.fn(),
  grantBaristaAction: vi.fn(),
  reset2FAAction: vi.fn(),
  resetAdminPasswordAction: vi.fn(),
  revokeBaristaAction: vi.fn(),
  saveAdminUserAction: vi.fn(),
}));

const FORMS = [
  "src/components/admin/promo-form.tsx",
  "src/components/admin/customer-form.tsx",
  "src/components/admin/customer-coupons.tsx",
  "src/components/admin/customer-stamps.tsx",
  "src/components/admin/customer-actions.tsx",
  "src/app/admin/kullanicilar/user-forms.tsx",
  "src/app/admin/bulten/kampanya/campaign-mail-controls.tsx",
];

describe("the people forms keep what was typed after a refusal", () => {
  it.each(FORMS)(
    "%s posts by hand; its action is only React's guard",
    (path) => {
      const src = readFileSync(path, "utf8");
      // Every form posts from onSubmit, and keeps the dispatcher as its
      // action only so React draws its guard for an Enter before hydration
      // (the prevented submit skips it, so nothing is reset).
      const tags = src.match(/<form\b[^>]*>/g) ?? [];
      expect(tags.length).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(tag).toMatch(/\saction=\{/);
        expect(tag).toMatch(/\sonSubmit=\{/);
      }
      expect(src).toContain("useHandPost(");
      // A throw is an answer, not the error page that discarded the form.
      expect(src).toContain("withPanelCatch");
    },
  );

  it.each(FORMS)("%s shows its answers in the kit's tones", (path) => {
    const src = readFileSync(path, "utf8");
    // The raw Tailwind reds and greens (and the grey hint as an error).
    expect(src).not.toMatch(/text-red-\d|bg-red-\d|text-emerald-\d/);
    expect(src).not.toMatch(/hint=\{\s*fe\(/);
  });
});

describe("answer lines", () => {
  it("announce a refusal in danger ink, tied to its field", async () => {
    const { FieldErrorText, FormError, FormSuccess } =
      await import("@/components/admin/form-feedback");
    const field = renderToStaticMarkup(
      createElement(FieldErrorText, { id: "f-err-code", message: "Kod boş." }),
    );
    expect(field).toContain('id="f-err-code"');
    expect(field).toContain('role="alert"');
    expect(field).toContain("--admin-danger-ink");
    const form = renderToStaticMarkup(
      createElement(FormError, { message: "Formdaki uyarıları gider." }),
    );
    expect(form).toContain('role="alert"');
    expect(form).toContain("--admin-danger-soft");
    const ok = renderToStaticMarkup(
      createElement(FormSuccess, { message: "Kupon tanımlandı." }),
    );
    expect(ok).toContain('role="status"');
    // Nothing to say, nothing drawn.
    expect(
      renderToStaticMarkup(createElement(FormError, { message: undefined })),
    ).toBe("");
  });
});

/** Markup checks: one control per tab stop, one label per control. */
function expectCleanNesting(html: string) {
  // A <button> inside an <a>: two tab stops for one "Vazgeç".
  expect(html).not.toMatch(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<button/);
  // A <label> inside a <label>: Field around Checkbox.
  for (const m of html.matchAll(/<label\b[\s\S]*?<\/label>/g)) {
    expect(m[0].slice(1)).not.toMatch(/<label\b/);
  }
}

describe("markup", () => {
  it("promo form: Vazgeç is one link, Durum is a fieldset", async () => {
    const { PromoForm } = await import("@/components/admin/promo-form");
    const html = renderToStaticMarkup(
      createElement(PromoForm, {
        action: vi.fn(),
        submitLabel: "Kodu oluştur",
      } as never),
    );
    expectCleanNesting(html);
    expect(html).toMatch(/<a [^>]*href="\/admin\/promosyon"[^>]*>Vazgeç<\/a>/);
    expect(html).toMatch(/<fieldset[\s\S]*<legend[^>]*>Durum<\/legend>/);
  });

  it("promo form: an expired code says what its date and a blank do", async () => {
    const { PromoForm } = await import("@/components/admin/promo-form");
    const promo = {
      id: "prm-0003",
      code: "YAZ25",
      kind: "pct",
      value: 25,
      minSubtotalMinor: 0,
      usageLimit: 50,
      usageCount: 12,
      expiresAt: "2026-10-01T20:59:00.000Z",
      isActive: true,
    };
    const render = (expired: boolean) =>
      renderToStaticMarkup(
        createElement(PromoForm, {
          action: vi.fn(),
          promo,
          submitLabel: "Kaydet",
          expired,
        } as never),
      );
    // The stored past date comes back as the Istanbul wall clock.
    const html = render(true);
    expect(html).toContain('value="2026-10-01T23:59"');
    expect(html).toContain("Tarihe dokunmazsan öyle kalır");
    expect(html).toContain("boş (süresiz) kodu yeniden açar");
    expect(render(false)).toContain(
      "Boş = süresiz. Geçmiş bir tarih kabul edilmez.",
    );
  });

  it("member form: Vazgeç is one link, the preferences are a fieldset", async () => {
    const { CustomerForm } = await import("@/components/admin/customer-form");
    const html = renderToStaticMarkup(
      createElement(CustomerForm, {
        action: vi.fn(),
        customer: {
          email: "uye@ornek.com",
          name: "Ayşe",
          phone: "",
          birthday: "",
          notificationPrefs: {
            orderUpdates: true,
            marketing: true,
            newsletter: false,
          },
          marketingConsentAt: "2026-09-01T09:00:00.000Z",
        },
      } as never),
    );
    expectCleanNesting(html);
    expect(html).toMatch(
      /<a [^>]*href="\/admin\/musteriler\/uye%40ornek.com"[^>]*>Vazgeç<\/a>/,
    );
    expect(html).toMatch(/<legend[^>]*>Bildirim tercihleri<\/legend>/);
    // Commercial consent: a switch that is off cannot be turned on here.
    const input = (name: string) =>
      html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0] ?? "";
    expect(input("notifyNewsletter")).toContain('disabled=""');
    expect(input("notifyMarketing")).not.toContain("disabled");
    expect(html).toContain("yalnız üye açabilir");
    // A disabled switch is not posted: the form says how it drew each one,
    // so a member's opt-in after the page loaded is not read as an untick.
    expect(input("shownMarketing")).toContain('value="on"');
    expect(input("shownNewsletter")).toContain('value="off"');
    expect(input("shownNewsletter")).toContain('type="hidden"');
    // And the date the audiences need is on screen.
    expect(html).toMatch(/Ticari ileti izni:\s*(<!-- -->)?01 Eyl 2026/);
  });
});

describe("an Enter before hydration sends nothing", () => {
  // Before the page's JavaScript runs there is no onSubmit. A form with
  // neither action nor method then GETs the page with its fields in the
  // address: a member's phone, a coupon, a panel user's new password. Each
  // form is drawn with React's guard instead.
  const STAMP = "2026-10-01T09:00:00.000Z";

  it("every people form is drawn with React's guard", async () => {
    const { PromoForm } = await import("@/components/admin/promo-form");
    const { CustomerForm } = await import("@/components/admin/customer-form");
    const { CustomerCoupons } =
      await import("@/components/admin/customer-coupons");
    const { CustomerStamps } =
      await import("@/components/admin/customer-stamps");
    const { CustomerActions } =
      await import("@/components/admin/customer-actions");
    const { AdminUserRow, CreateAdminUserForm, GrantBaristaForm } =
      await import("@/app/admin/kullanicilar/user-forms");
    const { CampaignTestForm } =
      await import("@/app/admin/bulten/kampanya/campaign-mail-controls");

    const rendered: Record<string, string> = {
      promo: renderToStaticMarkup(
        createElement(PromoForm, {
          action: vi.fn(),
          submitLabel: "Kodu oluştur",
        } as never),
      ),
      member: renderToStaticMarkup(
        createElement(CustomerForm, {
          action: vi.fn(),
          customer: {
            email: "uye@ornek.com",
            name: "Ayşe",
            phone: "05551112233",
            birthday: "",
            notificationPrefs: {
              orderUpdates: true,
              marketing: false,
              newsletter: false,
            },
          },
        } as never),
      ),
      coupons: renderToStaticMarkup(
        createElement(CustomerCoupons, {
          email: "uye@ornek.com",
          coupons: [],
        } as never),
      ),
      stamps: renderToStaticMarkup(
        createElement(CustomerStamps, {
          email: "uye@ornek.com",
          loyalty: {
            tierLabel: "Bronz",
            stamps: 3,
            stampTarget: 6,
            rewardsReady: 0,
            lifetimeStamps: 3,
          },
          history: [],
        } as never),
      ),
      resend: renderToStaticMarkup(
        createElement(CustomerActions, {
          email: "uye@ornek.com",
          isActive: true,
          emailVerified: false,
        }),
      ),
      newUser: renderToStaticMarkup(
        createElement(CreateAdminUserForm, { minPasswordLength: 10 }),
      ),
      userRow: renderToStaticMarkup(
        createElement(AdminUserRow, {
          user: {
            email: "kasa@laffogato.net",
            name: "Eda",
            role: "cashier",
            isActive: true,
            updatedAt: STAMP,
            has2FA: false,
          },
          minPasswordLength: 10,
        }),
      ),
      barista: renderToStaticMarkup(createElement(GrantBaristaForm)),
      campaignTest: renderToStaticMarkup(
        createElement(CampaignTestForm, {
          action: vi.fn(),
          defaultTo: "sahip@laffogato.net",
        }),
      ),
    };
    // The row holds two forms: Kaydet, and the new password.
    const expected: Record<string, number> = { userRow: 2 };
    for (const [name, html] of Object.entries(rendered)) {
      const tags = formOpenTags(html);
      expect(tags, name).toHaveLength(expected[name] ?? 1);
      for (const tag of tags) expectReactGuard(tag);
    }
  });
});

describe("Hesabı sil says what stays", () => {
  it("the orders keep the invoice name, phone and address", () => {
    // The dialog's copy renders only once it opens; read it from the source.
    const src = readFileSync(
      "src/components/admin/customer-actions.tsx",
      "utf8",
    );
    // "Siparişler muhasebe için anonim olarak kalır" was not true: the order
    // sweep replaces the e-mail only (ANON_SWEEPS in lib/mobile/me.ts).
    expect(src).not.toContain("anonim olarak kalır");
    expect(src).toMatch(
      /faturadaki ad, telefon ve teslimat adresi\s+siparişte kalır/,
    );
  });
});

describe("2FA on the users page", () => {
  const user = {
    email: "kasa@laffogato.net",
    name: "Eda",
    role: "cashier",
    isActive: true,
    updatedAt: "2026-10-01T09:00:00.000Z",
  };

  it("shows who has 2FA and offers the owner a reset behind a dialog", async () => {
    const { AdminUserRow } =
      await import("@/app/admin/kullanicilar/user-forms");
    const html = renderToStaticMarkup(
      createElement(AdminUserRow, {
        user: { ...user, has2FA: true },
        minPasswordLength: 10,
      }),
    );
    expect(html).toContain("2FA açık");
    expect(html).toMatch(
      /<button[^>]*aria-haspopup="dialog"[^>]*>2FA&#x27;yı sıfırla<\/button>/,
    );
    const off = renderToStaticMarkup(
      createElement(AdminUserRow, {
        user: { ...user, has2FA: false },
        minPasswordLength: 10,
      }),
    );
    expect(off).toContain("2FA kapalı");
    expect(off).not.toContain("2FA&#x27;yı sıfırla");
  });

  it("switches the reset off on the owner's own row, with the reason", async () => {
    const { AdminUserRow } =
      await import("@/app/admin/kullanicilar/user-forms");
    const html = renderToStaticMarkup(
      createElement(AdminUserRow, {
        user: { ...user, has2FA: true, isSelf: true },
        minPasswordLength: 10,
      }),
    );
    expect(html).toMatch(
      /<button[^>]*aria-disabled="true"[^>]*>2FA&#x27;yı sıfırla/,
    );
    expect(html).toContain("2FA kurulumu sayfasından");
  });

  it("saves the owner's own name only: no role and no access field on the row", async () => {
    // The action keeps the stored role and access for your own row and
    // refuses a request that sends either (kullanicilar/actions.ts).
    const { AdminUserRow } =
      await import("@/app/admin/kullanicilar/user-forms");
    const own = renderToStaticMarkup(
      createElement(AdminUserRow, {
        user: { ...user, isSelf: true },
        minPasswordLength: 10,
      }),
    );
    expect(own).toContain('name="name"');
    expect(own).not.toContain('name="role"');
    expect(own).not.toContain('name="isActive"');
    const other = renderToStaticMarkup(
      createElement(AdminUserRow, { user, minPasswordLength: 10 }),
    );
    expect(other).toContain('name="role"');
    expect(other).toContain('name="isActive"');
  });
});

describe("campaign Gönder", () => {
  it("opens a dialog instead of posting on one click", async () => {
    const { CampaignSendForm } =
      await import("@/app/admin/bulten/kampanya/campaign-mail-controls");
    const html = renderToStaticMarkup(
      createElement(CampaignSendForm, {
        action: vi.fn(),
        audienceCount: 128,
        audienceLabel: "Kampanya izni olan üyeler",
      }),
    );
    expect(html).toMatch(
      /<button[^>]*aria-haspopup="dialog"[^>]*>Gönder<\/button>/,
    );
    expect(html).not.toContain('type="submit"');
    expect(html).not.toContain("<form");
  });
});

describe("the member page's stamp is a correction (ASK-LOYALTY)", () => {
  // The till stamps only a member who shows their own code since 21 Ekim
  // 2026; the member page adds a stamp the till missed, at the member's
  // request, with the reason (musteriler/[email]/actions.ts refuses one under
  // ten characters).
  async function render(history: unknown[] = []): Promise<string> {
    const { CustomerStamps } =
      await import("@/components/admin/customer-stamps");
    return renderToStaticMarkup(
      createElement(CustomerStamps, {
        email: "uye@ornek.com",
        canReverse: true,
        loyalty: {
          tierLabel: "Bronz",
          stamps: 3,
          stampTarget: 6,
          rewardsReady: 0,
          lifetimeStamps: 3,
        },
        history,
      } as never),
    );
  }

  it("asks for the reason and says what the button does", async () => {
    const html = await render();
    expect(html).toContain("Damga düzelt (+1)");
    expect(html).not.toContain("+1 damga");
    expect(html).toContain("Düzeltme sebebi");
    expect(html).not.toContain("opsiyonel");
    const input = html.match(/<input[^>]*name="note"[^>]*>/)?.[0] ?? "";
    expect(input).toContain('required=""');
    expect(input).toContain('minLength="10"');
    // 120 the ledger keeps, minus "Düzeltme · ".
    expect(input).toContain('maxLength="109"');
    // The form's names are the action's (frontend-form-contract): note, force.
    expect(html).toContain('name="force"');
  });

  it("still prints a stamp the till gave by e-mail before the change", async () => {
    const html = await render([
      {
        id: "stamp-000041",
        customerEmail: "uye@ornek.com",
        kind: "earn",
        delta: 1,
        source: "counter",
        orderId: "",
        note: "Kasa · e-posta",
        actor: "kasa@laffogato.net",
        createdAt: "2026-10-10T09:00:00.000Z",
      },
      {
        id: "stamp-000042",
        customerEmail: "uye@ornek.com",
        kind: "earn",
        delta: 1,
        source: "counter",
        orderId: "",
        note: "Düzeltme · QR okunmadı, üye kayıtlı e-postasından yazdı",
        actor: "yonetici@laffogato.net",
        createdAt: "2026-10-22T09:00:00.000Z",
      },
    ]);
    expect(html).toContain("Kasa · Kasa · e-posta · kasa@laffogato.net");
    expect(html).toContain(
      "Kasa · Düzeltme · QR okunmadı, üye kayıtlı e-postasından yazdı · yonetici@laffogato.net",
    );
  });
});

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The seam between the customer UI and the server actions behind it.
 *
 * A server action reads its input by NAME - `formData.get("legalConsent")` -
 * and a form supplies it by the `name="…"` of an input. Nothing else ties the
 * two together: TypeScript does not see it, the build does not see it, and a
 * redesign that renames a field or drops a hidden input compiles cleanly and
 * ships a checkout whose consent box is never "on" (every order refused) or a
 * register form whose `acceptedTerms` never arrives.
 *
 * So this table is the contract (CLAUDE.md → "Ön yüz ↔ arka yüz sınırı"). Each
 * row says: this action reads these fields, and this form file still sends
 * them. A frontend rewrite that moves a form to another file updates `form`
 * here - deliberately, with the field list in front of it. A backend change
 * that stops reading a field fails the first assertion, so the list cannot
 * quietly rot either.
 */
interface FormContract {
  action: string;
  actionFile: string;
  /** Files that render the form; every field must appear in at least one. */
  forms: string[];
  fields: string[];
}

const CONTRACTS: FormContract[] = [
  {
    // The one-page checkout (16 Eki 2026) replaced placeOrderAction and its
    // 3-step wizard. Its ORDER form carries no card field - the card goes
    // from the native pay form to /odeme/paynkolay (contract below).
    action: "startCheckoutAction",
    actionFile: "src/app/odeme/actions.ts",
    // The hidden `legalConsent` lives in the consent block, which renders it
    // only once both document boxes are ticked (tests/checkout-consent.test.ts).
    forms: ["src/app/odeme/checkout.tsx", "src/app/odeme/checkout-consent.tsx"],
    // `items` is JSON: [{ productId, variantId, name, price, qty }] in lira.
    // The server re-prices every line from the database (resolveOrderLines);
    // the client `price` only raises the "fiyat güncellendi" flag.
    fields: [
      "items",
      "legalConsent",
      "customerName",
      "customerPhone",
      "shippingAddress",
      "promoCode",
      // The pending order a declined attempt left, offered back for reuse
      // (src/lib/checkout/reuse.ts). No personal data, no card.
      "reuseOrderId",
      "reuseData",
      "reuseSignature",
      "reuseCartKey",
    ],
  },
  {
    action: "previewPromoAction",
    actionFile: "src/app/odeme/actions.ts",
    forms: ["src/app/odeme/checkout.tsx"],
    fields: ["code", "subtotal"],
  },
  {
    // Deleting a saved card from the checkout: the browser names the card
    // by its `tranId` only; the member's key comes from the session.
    action: "deleteSavedCardAction",
    actionFile: "src/app/odeme/actions.ts",
    forms: ["src/app/odeme/checkout.tsx", "src/app/odeme/card-payment.tsx"],
    fields: ["tranId"],
  },
  {
    // Not a Server Action: the checkout's NATIVE pay form posts here, and
    // the route reads it by name all the same. The card's own four fields
    // are named through CARD_FORM_FIELDS on both sides
    // (tests/checkout-pay-form.test.ts).
    action: "POST /odeme/paynkolay",
    actionFile: "src/app/odeme/paynkolay/route.ts",
    forms: ["src/app/odeme/card-payment.tsx"],
    fields: ["d", "s", "return", "cardChoice", "saveCard"],
  },
  {
    action: "registerAction",
    actionFile: "src/app/uye/actions.ts",
    forms: ["src/app/uye/kayit/register-form.tsx"],
    fields: [
      "email",
      "name",
      "phone",
      "password",
      "passwordConfirm",
      "acceptedTerms",
      "marketing",
      "newsletter",
    ],
  },
  {
    action: "loginAction",
    actionFile: "src/app/uye/actions.ts",
    forms: ["src/app/uye/giris/login-form.tsx"],
    // `next` is how /odeme and /karaoke get the visitor back after login.
    fields: ["email", "password", "next"],
  },
  {
    action: "requestPasswordResetAction",
    actionFile: "src/app/uye/actions.ts",
    forms: ["src/app/uye/sifremi-unuttum/forgot-form.tsx"],
    fields: ["email"],
  },
  {
    action: "resetPasswordAction",
    actionFile: "src/app/uye/actions.ts",
    forms: ["src/app/uye/sifre-sifirla/reset-form.tsx"],
    fields: ["token", "password", "passwordConfirm"],
  },
  {
    action: "updateProfileAction",
    actionFile: "src/app/uye/actions.ts",
    forms: ["src/app/uye/hesap/profile-form.tsx"],
    fields: ["name", "phone", "birthday"],
  },
  {
    action: "changePasswordAction",
    actionFile: "src/app/uye/actions.ts",
    forms: ["src/app/uye/hesap/sifre/password-form.tsx"],
    fields: ["currentPassword", "newPassword", "newPasswordConfirm"],
  },
  {
    action: "createAddressAction / updateAddressAction",
    actionFile: "src/app/uye/actions.ts",
    forms: ["src/app/uye/hesap/adreslerim/address-form.tsx"],
    fields: [
      "label",
      "recipientName",
      "phone",
      "line1",
      "line2",
      "district",
      "city",
      "zip",
      "isDefault",
    ],
  },
  {
    action: "deleteAddressAction / setDefaultAddressAction",
    actionFile: "src/app/uye/actions.ts",
    forms: ["src/app/uye/hesap/adreslerim/page.tsx"],
    fields: ["addressId"],
  },
  {
    action: "toggleWishlistAction",
    actionFile: "src/app/uye/actions.ts",
    forms: [
      "src/components/laffogato/ui.tsx",
      "src/app/uye/hesap/favorilerim/page.tsx",
    ],
    fields: ["productId", "back"],
  },
  {
    action: "updateNotificationsAction",
    actionFile: "src/app/uye/actions.ts",
    forms: ["src/app/uye/hesap/bildirimler/notifications-form.tsx"],
    fields: ["orderUpdates", "marketing", "newsletter"],
  },
  {
    // The site no longer deletes on the member's click (18 Eki 2026): the
    // page sends the team a request, an optional reason and one box.
    action: "requestAccountDeletionAction",
    actionFile: "src/app/uye/actions.ts",
    forms: ["src/app/uye/hesap/sil/deletion-request-form.tsx"],
    fields: ["reason", "confirm"],
  },
  {
    action: "bookKaraokeAction",
    actionFile: "src/app/karaoke/actions.ts",
    forms: ["src/components/laffogato/karaoke-booking.tsx"],
    fields: [
      "date",
      "startHour",
      "hours",
      "guests",
      "note",
      "contactName",
      "contactEmail",
      "contactPhone",
      // A booking without an account types its own name (16 Eki 2026).
      "guestFirstName",
      "guestLastName",
      // Three separate boxes before a paid booking: pre-information
      // confirmed, contract accepted, privacy notice acknowledged.
      "consentPreInfo",
      "consentContract",
      "consentKvkk",
      // The cancellation rule the form printed, echoed back (18 Eki 2026):
      // a rule changed while the page was open refuses the booking.
      "expectedFreeCancelHours",
      "expectedLateRefundPercent",
    ],
  },
  {
    action: "subscribeNewsletterAction",
    actionFile: "src/app/newsletter/actions.ts",
    forms: ["src/components/laffogato/newsletter-form.tsx"],
    fields: ["email", "consent"],
  },
  {
    // The confirmation mail's button (6563 double opt-in). A POST, not the
    // link: mail scanners open links, and a GET that subscribed would turn
    // their visit into consent.
    action: "confirmNewsletterAction",
    actionFile: "src/app/newsletter/actions.ts",
    forms: ["src/app/bulten/onay/page.tsx"],
    fields: ["token"],
  },
  {
    // Same reason: the page only shows the button, the press unsubscribes.
    action: "unsubscribeNewsletterAction",
    actionFile: "src/app/newsletter/actions.ts",
    forms: ["src/app/bulten/cikis/page.tsx"],
    fields: ["token"],
  },
];

const read = (path: string) => readFileSync(path, "utf8");

/** `formData.get("x")`, `num("x")` and the other spellings the actions use. */
function actionReads(source: string, field: string): boolean {
  return new RegExp(`\\(\\s*["']${field}["']\\s*\\)`).test(source);
}

/**
 * An input with that `name`, or - for the checkout's actions that are called
 * with a FormData built in code, not submitted from a <form> - a
 * `fd.set("field", …)`.
 */
function formSends(source: string, field: string): boolean {
  return (
    new RegExp(`name=(?:"${field}"|\\{\\s*["']${field}["']\\s*\\})`).test(
      source,
    ) || new RegExp(`\\bfd\\.set\\(\\s*["']${field}["']`).test(source)
  );
}

describe("frontend ↔ server action form contract", () => {
  for (const c of CONTRACTS) {
    describe(c.action, () => {
      it("the action still reads every field in the contract", () => {
        const src = read(c.actionFile);
        const missing = c.fields.filter((f) => !actionReads(src, f));
        expect(missing, `${c.actionFile} no longer reads`).toEqual([]);
      });

      it("the form still sends every field the action reads", () => {
        const sources = c.forms.map(read);
        const missing = c.fields.filter(
          (f) => !sources.some((s) => formSends(s, f)),
        );
        expect(missing, `${c.forms.join(", ")} does not send`).toEqual([]);
      });
    });
  }
});

describe("consent boxes a redesign must not pre-tick", () => {
  // Mesafeli satış (CLAUDE.md rule 12) and 6563 (rule 19): a box that is
  // already ticked is not consent, and the order/subscription record it
  // writes is not evidence.
  //
  // Each box is found by the attribute that identifies it. The checkout's two
  // document boxes carry an `id`, not a `name`: the server reads only the
  // hidden `legalConsent` they unlock together, so the boxes send nothing.
  const CONSENT_INPUTS: [file: string, attr: string][] = [
    ["src/app/odeme/checkout-consent.tsx", 'id="consentPreInfo"'],
    ["src/app/odeme/checkout-consent.tsx", 'id="consentContract"'],
    ["src/app/uye/kayit/register-form.tsx", 'name="acceptedTerms"'],
    ["src/app/uye/kayit/register-form.tsx", 'name="marketing"'],
    ["src/app/uye/kayit/register-form.tsx", 'name="newsletter"'],
    ["src/components/laffogato/newsletter-form.tsx", 'name="consent"'],
    ["src/components/laffogato/karaoke-booking.tsx", 'name="consentPreInfo"'],
    ["src/components/laffogato/karaoke-booking.tsx", 'name="consentContract"'],
    ["src/components/laffogato/karaoke-booking.tsx", 'name="consentKvkk"'],
    // "Hesabımın silinmesini istiyorum": a request nobody ticked for the
    // member is no request.
    ["src/app/uye/hesap/sil/deletion-request-form.tsx", 'name="confirm"'],
  ];

  for (const [file, attr] of CONSENT_INPUTS) {
    it(`${attr} in ${file} starts unticked`, () => {
      const src = read(file);
      // The <input …> element that carries this attribute, and all the rest.
      const tag = src.match(
        new RegExp(`<input(?:(?!/>)[\\s\\S])*?${attr}[\\s\\S]*?/>`),
      );
      expect(tag, `no <input ${attr}> in ${file}`).not.toBeNull();
      // `defaultChecked={values.x}` is allowed: it echoes the visitor's
      // own tick back after a failed submit, and starts undefined. A literal
      // `defaultChecked`, `defaultChecked={true}` or any `checked` is not.
      expect(tag![0]).not.toMatch(
        /\bdefaultChecked(?:=\{\s*true\s*\})?(?=[\s/>])/,
      );
      expect(tag![0]).not.toMatch(/\bchecked(?:=\{\s*true\s*\})?(?=[\s/>])/);
    });
  }
});

describe("redirect query strings the pages must keep handling", () => {
  // placeOrderAction answers a refused cart with `/?cart=<reason>`; the home
  // page turns each into a notice. A redesigned home page that drops one
  // leaves the customer on the shop with no word about why nothing happened.
  it("every ?cart= reason the checkout sends has a notice on the home page", () => {
    const home = read("src/app/page.tsx");
    for (const reason of [
      "empty",
      "out_of_stock",
      "shop_closed",
      "not_found",
      "qty_too_high",
    ]) {
      expect(home, `?cart=${reason}`).toContain(`"${reason}"`);
    }
  });

  it("every /odeme?error= the backend sends has a notice on /odeme", () => {
    // A declined card used to come back as ?durum=basarisiz, which the page
    // never read: no message at all. The page reads its query through
    // readCheckoutReturn (src/lib/checkout/return-codes.ts) since 16 Eki 2026.
    const page = read("src/lib/checkout/return-codes.ts");
    expect(read("src/app/odeme/(checkout)/page.tsx")).toContain(
      "readCheckoutReturn(",
    );
    const senders = [
      "src/app/odeme/actions.ts",
      "src/app/odeme/donus/route.ts",
      "src/app/odeme/paynkolay/route.ts",
    ].map(read);
    const reasons = new Set<string>();
    for (const src of senders) {
      for (const m of src.matchAll(/\/odeme\?error=([a-z_]+)/g))
        reasons.add(m[1]);
      expect(src).not.toContain("/odeme?durum=");
    }
    // `consent` is still read (an old link, a bookmarked return) although
    // the one-page checkout answers a missing consent in place.
    expect(["consent", "payment"]).toEqual(
      expect.arrayContaining([...reasons]),
    );
    expect(reasons.has("payment")).toBe(true);
    for (const reason of ["consent", "payment"]) {
      expect(page, `?error=${reason}`).toContain(`case "${reason}":`);
      expect(page, `?error=${reason}`).toContain(`error === "${reason}"`);
    }
  });

  it("every /odeme?odeme= code the payment route sends has a notice", async () => {
    // The route answers the web checkout's card POST with fixed codes only
    // (never the POS's own words). The list is pinned here deliberately.
    const { CHECKOUT_RETURN_CODES, checkoutReturnCopy, readCheckoutReturn } =
      await import("@/lib/checkout/return-codes");
    expect([...CHECKOUT_RETURN_CODES].sort()).toEqual([
      "baslatilamadi",
      "cok_deneme",
      "kart_hatali",
      "kart_secimi",
      "kart_yok",
      "reddedildi",
      "sure_doldu",
    ]);
    const route = read("src/app/odeme/paynkolay/route.ts");
    const sent = new Set(
      [...route.matchAll(/back\("([a-z_]+)"/g)].map((m) => m[1]),
    );
    expect([...sent].sort()).toEqual([...CHECKOUT_RETURN_CODES].sort());
    for (const code of CHECKOUT_RETURN_CODES) {
      const ret = readCheckoutReturn({ odeme: code });
      expect(ret?.reason, code).toBe(code);
      const copy = checkoutReturnCopy(ret!);
      expect(copy.title.length, code).toBeGreaterThan(0);
      expect(copy.reason.length, code).toBeGreaterThan(0);
    }
  });

  it("the account deletion's /?hesap=... is acknowledged", () => {
    // Two values: "silindi" once the sign-in identity went too, "kapatildi"
    // otherwise (src/lib/customer/account-closure.ts); the home page reads
    // both through the same helper. Since 18 Eki 2026 no action sends it -
    // the site sends a deletion request instead - but the links already in
    // mails and bookmarks still land on a notice.
    expect(read("src/app/uye/actions.ts")).not.toContain("/?hesap=");
    expect(read("src/app/page.tsx")).toContain("accountClosureNotice(hesap)");
    const closure = read("src/lib/customer/account-closure.ts");
    expect(closure).toMatch(/silindi:\s*"/);
    expect(closure).toMatch(/kapatildi:\s*"/);
  });

  it("the login page carries ?next= through to the form", () => {
    // /odeme and /karaoke link to /uye/giris?next=…; the page used to ignore
    // it and every login landed on /uye/hesap, out of the checkout.
    const page = read("src/app/uye/giris/page.tsx");
    expect(page).toMatch(/next\??:\s*string/);
    expect(page).toContain("<LoginForm next={next}");
    expect(read("src/app/odeme/(checkout)/page.tsx")).toContain(
      "/uye/giris?next=/odeme",
    );
  });
});

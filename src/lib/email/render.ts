/**
 * Template + values -> the three strings `send()` wants.
 *
 * Everything a template says about the business - address, hours, phone,
 * socials - is baked into the HTML, and every one of those values was
 * checked against `SITE` and `LEGAL_ENTITY` when the templates were
 * migrated. The sender's registered title and MERSİS number on commercial
 * mail are the exception: they come from `LEGAL_ENTITY` through
 * `commonVars`, so `entity.ts` stays the single source. What varies per
 * message comes through `vars`.
 *
 * Deliberately NO "server-only": `templates.test.ts` renders every template
 * here, and that test is the thing standing between an unfilled `[FIELD]` and
 * a customer's inbox.
 */

import { LEGAL_ENTITY } from "@/lib/legal/entity";
import {
  hasAppLinks,
  APP_STORE_URL,
  PLAY_STORE_URL,
} from "@/lib/mobile/app-store";
import { SITE } from "@/lib/seo/site";

import {
  assertNoneMissing,
  fill,
  fillText,
  type MissingFields,
  type TemplateVars,
} from "./fill";
import { EMAIL_TEMPLATES, type EmailTemplateName } from "./templates.generated";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  /** Set only for 6563 commercial mail; `send()` turns it into a header. */
  unsubscribeUrl?: string;
}

export interface RenderInput {
  vars: TemplateVars;
  loops?: Record<string, TemplateVars[]>;
  /** The plain-text alternative, with the same `[FIELD]`s as the HTML. */
  text: string;
  /**
   * Required on a commercial template, rejected on a transactional one - the
   * asymmetry is the law's, not a preference (see `send.ts`).
   */
  unsubscribeUrl?: string;
  /**
   * Sections whose switch is a fact about the event rather than a field of
   * it: was the cancelled order paid, did the refund go back to a card. The
   * field-derived flags below win over these, so a caller can never open a
   * block whose fields it did not fill.
   */
  flags?: Record<string, boolean>;
}

/**
 * The values every template shares. A caller may override any of them; the
 * order paths do, because their links point at one order rather than the list.
 */
export function commonVars(): TemplateVars {
  return {
    APP_STORE_URL,
    PLAY_STORE_URL,
    HESAP_URL: `${SITE.url}/uye/hesap`,
    SIPARIS_URL: `${SITE.url}/uye/hesap/siparislerim`,
    MENU_URL: `${SITE.url}/menu`,
    // Ticari İletişim Yönetmeliği m.8/1: a tacir's commercial message names
    // the ticaret unvanı and the MERSİS number in its content. One line in
    // the commercial footers, both halves.
    UNVAN: LEGAL_ENTITY.legalName,
    MERSIS: LEGAL_ENTITY.mersisNo,
  };
}

export function renderEmail(
  name: EmailTemplateName,
  input: RenderInput,
): RenderedEmail {
  const template = EMAIL_TEMPLATES[name];
  if (!template) throw new Error(`Bilinmeyen e-posta şablonu: ${name}`);

  if (template.commercial && !input.unsubscribeUrl) {
    throw new Error(
      `${name}: ticari ileti çıkış bağlantısı olmadan gönderilemez (6563).`,
    );
  }
  if (!template.commercial && input.unsubscribeUrl) {
    throw new Error(
      `${name}: işlemsel iletiye çıkış bağlantısı konmaz - abonelikten çıkılamayan bir mesajda çıkış teklif etmek yanıltıcıdır.`,
    );
  }

  // The link in the footer and the `List-Unsubscribe` header have to be the
  // same URL - a body link that outlives the header (or vice versa) is the
  // failure 6563 actually punishes. So the caller gives it once, here.
  const vars: TemplateVars = {
    ...commonVars(),
    ...input.vars,
    ...(input.unsubscribeUrl
      ? { ABONELIK_CIKIS_URL: input.unsubscribeUrl }
      : {}),
  };

  const flags = {
    ...(input.flags ?? {}),
    // The app is not listed yet; without both links the strip is dropped
    // rather than shipped with buttons that go nowhere.
    APP_LINKS: hasAppLinks(),
    // Guest checkout can leave the name empty, and "Merhaba ," is not a
    // greeting. Both halves of the message drop it the same way.
    AD: Boolean(vars.AD),
    // The campaign family's optional blocks follow their field: no image URL,
    // no hero row; no code, no code box. A dropped block takes the fields
    // inside it along, so the fill never asks for a value the operator
    // deliberately left blank - but a block that IS open still needs every
    // field in it (a code without an expiry is a render error, not a gap).
    GORSEL: Boolean(vars.KAMPANYA_GORSEL_URL),
    KOD: Boolean(vars.KUPON_KODU),
    TARIH: Boolean(vars.KAMPANYA_TARIH),
    DIPNOT: Boolean(vars.KAMPANYA_DIPNOT),
    VURGU: Boolean(vars.KAMPANYA_VURGU),
    // Order notices: the carrier's page and name only when there is one.
    // The panel's shipping form takes no URL, and a Geliver event carries no
    // carrier name, so either can be missing on a real parcel.
    TAKIP_LINKI: Boolean(vars.TAKIP_URL),
    FIRMA: Boolean(vars.KARGO_FIRMASI),
    // "Siparişiniz alındı": the cargo row and the free-shipping line follow
    // the fee. A table order leaves KARGO empty - it is carried across the
    // room, and the mail must not talk about cargo (15 Eki 2026).
    KARGO_SATIRI: Boolean(vars.KARGO),
    // The paid-order stamp card only when the order earned stamps: an app
    // cafe order of at least 140 TL of goods, one per started 320 TL. A shop
    // or web order used to be told "+1 damga" for a stamp it never got.
    DAMGA: Boolean(vars.DAMGA_SAYISI) && vars.DAMGA_SAYISI !== "0",
  };

  // The holes are counted on the template's own fields while it is filled,
  // not looked for in the result: a value may contain "[OK]" (a member's
  // note, a product called "Kahve [250G]") and that is text, not a field.
  const missing = {
    html: new Set() as MissingFields,
    subject: new Set() as MissingFields,
    text: new Set() as MissingFields,
  };
  const html = fill(
    template.html,
    { vars, loops: input.loops, flags },
    missing.html,
  );
  const subject = fillText(template.subject, vars, flags, missing.subject);
  const text = fillText(input.text, vars, flags, missing.text);

  assertNoneMissing(missing.html, name);
  assertNoneMissing(missing.subject, `${name} (konu)`);
  assertNoneMissing(missing.text, `${name} (düz metin)`);

  return {
    subject,
    html,
    text,
    ...(input.unsubscribeUrl ? { unsubscribeUrl: input.unsubscribeUrl } : {}),
  };
}

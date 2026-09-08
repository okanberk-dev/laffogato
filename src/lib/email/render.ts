/**
 * Template + values -> the three strings `send()` wants.
 *
 * Everything a template says about the business — address, hours, phone,
 * socials, the legal name in the footer — is baked into the HTML, and every
 * one of those values was checked against `SITE` and `LEGAL_ENTITY` when the
 * templates were migrated. What varies per message comes through `vars`.
 *
 * Deliberately NO "server-only": `templates.test.ts` renders every template
 * here, and that test is the thing standing between an unfilled `[FIELD]` and
 * a customer's inbox.
 */

import {
  hasAppLinks,
  APP_STORE_URL,
  PLAY_STORE_URL,
} from "@/lib/mobile/app-store";
import { SITE } from "@/lib/seo/site";

import { assertFilled, fill, fillText, type TemplateVars } from "./fill";
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
   * Required on a commercial template, rejected on a transactional one — the
   * asymmetry is the law's, not a preference (see `send.ts`).
   */
  unsubscribeUrl?: string;
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
      `${name}: işlemsel iletiye çıkış bağlantısı konmaz — abonelikten çıkılamayan bir mesajda çıkış teklif etmek yanıltıcıdır.`,
    );
  }

  // The link in the footer and the `List-Unsubscribe` header have to be the
  // same URL — a body link that outlives the header (or vice versa) is the
  // failure 6563 actually punishes. So the caller gives it once, here.
  const vars: TemplateVars = {
    ...commonVars(),
    ...input.vars,
    ...(input.unsubscribeUrl
      ? { ABONELIK_CIKIS_URL: input.unsubscribeUrl }
      : {}),
  };

  const flags = {
    // The app is not listed yet; without both links the strip is dropped
    // rather than shipped with buttons that go nowhere.
    APP_LINKS: hasAppLinks(),
    // Guest checkout can leave the name empty, and "Merhaba ," is not a
    // greeting. Both halves of the message drop it the same way.
    AD: Boolean(vars.AD),
  };

  const html = fill(template.html, { vars, loops: input.loops, flags });
  const subject = fillText(template.subject, vars, flags);
  const text = fillText(input.text, vars, flags);

  assertFilled(html, name);
  assertFilled(subject, `${name} (konu)`);
  assertFilled(text, `${name} (düz metin)`);

  return {
    subject,
    html,
    text,
    ...(input.unsubscribeUrl ? { unsubscribeUrl: input.unsubscribeUrl } : {}),
  };
}

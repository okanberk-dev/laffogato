// Types only (erased): both modules are server-only.
import type { CampaignAudience } from "@/lib/email/campaigns";
import type { CampaignTemplateName } from "@/lib/email/send";

import type { ConfirmAsk } from "../confirm-dialog";

// The question a post's save asks before its member mail. It was the
// browser's own confirm(): "TÜM üyelere" without saying how many, and one OK
// was enough for a commercial send to the whole member base. Now it is the
// same step as "Gönder" on the Kampanya e-postası page (decision D15): the
// count, typed back. Client-safe and pure: the form and its tests read it.

/**
 * The campaign a post's mail becomes (`campaignFromPost`). The pages count
 * this audience for the dialog; a test holds the two together.
 */
export const POST_MAIL_AUDIENCE: CampaignAudience = "marketing";
export const POST_MAIL_TEMPLATE: CampaignTemplateName = "kampanya-duyuru";

/**
 * The dialog for `count` members with marketing consent right now, or
 * null when the database could not be asked (said so, rather than shown as
 * a zero). The phrase is the count, or GÖNDER without one: the Kampanya
 * e-postası page's rule (`campaignSendPhrase`).
 */
export function postMailConfirm(count: number | null): ConfirmAsk {
  const who =
    count === null
      ? "Alıcı sayısı şu an okunamadı. Kaydedince, gönderi yayındaysa pazarlama izni olan bütün üyelere bir kez kampanya e-postası gider."
      : count === 0
        ? "Pazarlama izni olan üye şu an yok: kaydedince e-posta kimseye gitmez, gönderi yine kaydedilir."
        : `Kaydedince, gönderi yayındaysa pazarlama izni olan ${count} üyeye bir kez kampanya e-postası gider.`;
  return {
    title: "Üyelere kampanya e-postası gitsin mi?",
    lines: [
      who,
      "Gönderi kapalıysa ya da başlangıç tarihi gelmediyse e-posta gitmez. Kitle kuyruğa alınırken yeniden sayılır; gönderim başlayınca geri alınamaz.",
    ],
    submitLabel: "Kaydet ve gönder",
    phrase: count === null ? "GÖNDER" : String(count),
  };
}

/**
 * When the post form may post. With the box off, always; with it ticked,
 * only the one post right after the operator's yes: every other press asks
 * first, and a save the server refused asks again on the next press.
 * Pure, exported for tests.
 */
export function createMailGate() {
  let passed = false;
  return {
    /** For `beforeSubmit`: true posts now, false means ask first. */
    allows(emailMembers: boolean): boolean {
      if (!emailMembers) return true;
      if (!passed) return false;
      passed = false;
      return true;
    },
    /** The operator said yes: the next post goes through. */
    open(): void {
      passed = true;
    },
  };
}

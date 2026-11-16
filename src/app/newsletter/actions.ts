"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { clientIp, reserveLoginAttempt } from "@/lib/admin/rate-limit";
import { sendNewsletterConfirmEmail } from "@/lib/email/send";
import { unsubscribeCustomerByToken } from "@/lib/customer/unsubscribe";
import {
  confirmNewsletterByToken,
  subscribeNewsletter,
  unsubscribeByToken,
} from "@/lib/newsletter/store";
import {
  NEWSLETTER_LINK_COOKIES,
  type NewsletterLinkPath,
} from "@/lib/newsletter/link-token";
import { SITE } from "@/lib/seo/site";

export interface NewsletterFormState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/**
 * Public footer newsletter signup - double opt-in.
 *
 * 6563 sayılı kanun ticari elektronik ileti için ÖNCEDEN açık onay ister ve
 * onayın varlığını ispat yükümlülüğünü hizmet sağlayıcıya yükler. The form
 * used to put whatever address was typed straight on the list, so anyone
 * could subscribe anyone - someone who had opted out included - and the
 * "consent" record carried the stranger's IP. Now the request is stored
 * pending and a confirmation mail goes to the address; the subscription
 * starts when its owner presses the button in it (/bulten/onay).
 *
 * The answer is the same whether or not the address is already on the list,
 * so the form does not tell a stranger who subscribes. Three requests per
 * address per window, counted on success too, so it cannot flood an inbox.
 */
export async function subscribeNewsletterAction(
  _prev: NewsletterFormState,
  formData: FormData,
): Promise<NewsletterFormState> {
  const email = String(formData.get("email") ?? "");
  if (formData.get("consent") !== "on") {
    return { error: "Devam etmek için onay kutusunu işaretle." };
  }
  // Per sender first: the per-address budget below stops flooding one inbox,
  // but a script cycling through a list of strangers' addresses never met it
  // and every request mailed somebody new under our domain.
  const ip = await clientIp();
  const perSender = await reserveLoginAttempt("newsletter-signup-ip", ip, "*");
  if (perSender.blocked) {
    return {
      error: `Çok fazla istek geldi. ${Math.ceil(perSender.retryAfterSeconds / 60)} dakika sonra tekrar dene.`,
    };
  }
  const limit = await reserveLoginAttempt(
    "newsletter-signup",
    "*",
    email.trim().toLowerCase(),
  );
  if (limit.blocked) {
    return {
      error: `Bu adres için çok fazla istek geldi. ${Math.ceil(limit.retryAfterSeconds / 60)} dakika sonra tekrar dene.`,
    };
  }
  const result = await subscribeNewsletter(email, "", "footer", {
    at: new Date().toISOString(),
    ip,
  });
  if (!result.ok) return { error: result.error };
  if (result.pending && result.confirmToken) {
    await sendNewsletterConfirmEmail(
      email.trim(),
      `${SITE.url}/bulten/onay?token=${encodeURIComponent(result.confirmToken)}`,
    );
  }
  return {
    ok: true,
    message:
      "Teşekkürler! E-postana bir onay bağlantısı gönderdik - aboneliğin, bağlantıdaki düğmeye bastığında başlar. 🤍",
  };
}

/**
 * The button on /bulten/onay. A POST, not the link itself: mail security
 * scanners open every link in a message, and a GET that subscribed would
 * turn their visit into "consent".
 */
export async function confirmNewsletterAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  await forgetLinkToken("/bulten/onay");
  let email: string | null = null;
  try {
    email = await confirmNewsletterByToken(token, await clientIp());
  } catch (err) {
    console.error("[newsletter] confirmation failed", err);
    redirect("/bulten/onay?sonuc=hata");
  }
  redirect(email ? "/bulten/onay?sonuc=tamam" : "/bulten/onay?sonuc=gecersiz");
}

/**
 * The page's parked link token (lib/newsletter/link-token.ts) is spent or
 * refused once its button is pressed: drop it, whatever the answer, so the
 * page does not ask again. Not exported: every export here is a public
 * endpoint (CLAUDE.md rule 27).
 */
async function forgetLinkToken(path: NewsletterLinkPath): Promise<void> {
  try {
    (await cookies()).delete({ name: NEWSLETTER_LINK_COOKIES[path], path });
  } catch {
    // Outside a request (a test calling the action directly): nothing parked.
  }
}

/** "ayse@<domain>" → "a***@<domain>": enough to recognise, not to log. */
function maskedAddress(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "";
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * The button on /bulten/cikis - one press, no login, no typing the address.
 *
 * The page used to spend the token on arrival. Mail security scanners
 * (Outlook Safe Links, Gmail's pre-fetch, corporate gateways) open every link
 * in a message, so recipients were unsubscribed by a robot and then saw
 * "Bağlantı geçersiz" when they clicked themselves. A GET now only shows the
 * button; the mail client's own one-click button (RFC 8058 POST to
 * /api/bulten/cikis) is unchanged and still needs no page at all.
 */
export async function unsubscribeNewsletterAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  await forgetLinkToken("/bulten/cikis");
  let email: string | null = null;
  try {
    // A token belongs to the subscriber list or to a member row; either way
    // both stores end up off for the address (lib/customer/unsubscribe.ts).
    email = token
      ? ((await unsubscribeByToken(token)) ??
        (await unsubscribeCustomerByToken(token)))
      : null;
  } catch (err) {
    console.error("[newsletter] unsubscribe failed", err);
    redirect("/bulten/cikis?sonuc=hata");
  }
  redirect(
    email
      ? `/bulten/cikis?sonuc=tamam&adres=${encodeURIComponent(maskedAddress(email))}`
      : "/bulten/cikis?sonuc=gecersiz",
  );
}

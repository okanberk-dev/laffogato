"use server";

import { clientIp } from "@/lib/admin/rate-limit";
import { subscribeNewsletter } from "@/lib/newsletter/store";

export interface NewsletterFormState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/**
 * Public footer newsletter signup.
 *
 * 6563 sayılı kanun ticari elektronik ileti için ÖNCEDEN açık onay ister ve
 * onayın varlığını ispat yükümlülüğünü hizmet sağlayıcıya yükler. Form
 * eskiden yalnızca adresi alıp kaydediyordu: ne onay kutusu vardı, ne kaydı,
 * ne de sitede herhangi bir çıkış yolu.
 */
export async function subscribeNewsletterAction(
  _prev: NewsletterFormState,
  formData: FormData,
): Promise<NewsletterFormState> {
  const email = String(formData.get("email") ?? "");
  if (formData.get("consent") !== "on") {
    return { error: "Devam etmek için onay kutusunu işaretle." };
  }
  const result = await subscribeNewsletter(email, "", "footer", {
    at: new Date().toISOString(),
    ip: await clientIp(),
  });
  if (!result.ok) return { error: result.error };
  return {
    ok: true,
    message: result.already
      ? "Bu e-posta zaten kayıtlı — teşekkürler! 🤍"
      : "Abone oldun! Ayda bir mektubumuzu bekle. 🤍",
  };
}

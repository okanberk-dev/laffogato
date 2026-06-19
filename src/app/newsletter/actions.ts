"use server";

import { subscribeNewsletter } from "@/lib/newsletter/store";

export interface NewsletterFormState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/** Public footer newsletter signup. */
export async function subscribeNewsletterAction(
  _prev: NewsletterFormState,
  formData: FormData,
): Promise<NewsletterFormState> {
  const email = String(formData.get("email") ?? "");
  const result = await subscribeNewsletter(email, "", "footer");
  if (!result.ok) return { error: result.error };
  return {
    ok: true,
    message: result.already
      ? "Bu e-posta zaten kayıtlı — teşekkürler! 🤍"
      : "Abone oldun! Ayda bir mektubumuzu bekle. 🤍",
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { reserveLoginAttempt } from "@/lib/admin/rate-limit";
import { getActiveCustomer } from "@/lib/customer/auth";
import { deleteCheckoutSavedCard } from "@/lib/payment/saved-cards";

/**
 * Hesabım › Kayıtlı kartlarım: the member deletes one of the cards PayNkolay
 * keeps for them (docs/PAYNKOLAY.md §16.3).
 *
 * This file's only export is a public POST endpoint (CLAUDE.md rule 27): it
 * reads the session itself, and the card is found again from the signed-in
 * account's own key and a fresh list at PayNkolay
 * (`deleteCheckoutSavedCard`). The browser names the card by PayNkolay's
 * `tranId` only; no token, no key and no card number ever reaches it.
 * Counted per member like the checkout's delete (`card-delete`): each one is
 * two calls to the POS.
 */

export interface DeleteSavedCardState {
  ok: boolean;
  message: string;
}

const TranIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._:-]{1,64}$/);

export async function deleteAccountSavedCardAction(
  _prev: DeleteSavedCardState | null,
  formData: FormData,
): Promise<DeleteSavedCardState> {
  const customer = await getActiveCustomer();
  if (!customer || !customer.emailVerified) {
    return {
      ok: false,
      message:
        "Oturumun kapanmış görünüyor. Sayfayı yenileyip yeniden giriş yap.",
    };
  }
  const parsed = TranIdSchema.safeParse(formData.get("tranId"));
  if (!parsed.success) {
    return { ok: false, message: "Silinecek kart bulunamadı." };
  }
  const budget = await reserveLoginAttempt("card-delete", "", customer.email);
  if (budget.blocked) {
    const minutes = Math.max(1, Math.ceil(budget.retryAfterSeconds / 60));
    return {
      ok: false,
      message: `Çok fazla deneme yapıldı. ${minutes} dakika sonra yeniden dene.`,
    };
  }
  const result = await deleteCheckoutSavedCard(customer.email, parsed.data);
  revalidatePath("/uye/hesap/kartlarim");
  if (result.ok) return { ok: true, message: "Kayıtlı kart silindi." };
  return {
    ok: false,
    message:
      result.reason === "not_found"
        ? "Bu kart artık kayıtlı değil."
        : "Kart şu an silinemedi. Birazdan yeniden dene.",
  };
}

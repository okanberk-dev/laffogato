"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { clientIp } from "@/lib/admin/rate-limit";
import { requireCustomer } from "@/lib/customer/auth";
import {
  cancelNoticeCode,
  cancelResultCode,
  payNoticeCode,
} from "@/lib/mobile/karaoke-notices";
import {
  cancelKaraokeReservation,
  reopenKaraokePayment,
} from "@/lib/mobile/karaoke-payment";

/**
 * "Karaoke rezervasyonlarım" - the member cancels, or pays a hold again.
 * Each export is its own public POST endpoint (CLAUDE.md rule 27): each reads
 * the session itself, and ownership (the member's own, verified address; never
 * a guest booking that only carries it; never the id alone) is checked again
 * inside `cancelKaraokeReservation` / `reopenKaraokePayment`, with the
 * two-hour rule and the POS (rule 29) after it.
 */

const IdSchema = z
  .string()
  .trim()
  .regex(/^krk-\d{1,12}$/);

function detail(id: string, key: string, code: string): never {
  redirect(`/uye/hesap/karaoke/${encodeURIComponent(id)}?${key}=${code}`);
}

export async function cancelMyKaraokeAction(formData: FormData): Promise<void> {
  const customer = await requireCustomer();
  const parsed = IdSchema.safeParse(formData.get("id"));
  if (!parsed.success) redirect("/uye/hesap/karaoke");
  const id = parsed.data;
  if (formData.get("confirm") !== "yes") detail(id, "hata", "onay-gerekli");

  const result = await cancelKaraokeReservation(id, {
    kind: "member",
    email: customer.email,
    emailVerified: customer.emailVerified,
  });
  revalidatePath("/uye/hesap/karaoke");
  revalidatePath("/karaoke");
  revalidatePath("/admin/mobil/karaoke");
  if (!result.ok) {
    if (result.reason === "not_found") redirect("/uye/hesap/karaoke");
    detail(id, "hata", cancelNoticeCode(result.reason));
  }
  detail(id, "sonuc", cancelResultCode(result));
}

export async function payMyKaraokeAction(formData: FormData): Promise<void> {
  const customer = await requireCustomer();
  const parsed = IdSchema.safeParse(formData.get("id"));
  if (!parsed.success) redirect("/uye/hesap/karaoke");
  const id = parsed.data;
  const result = await reopenKaraokePayment({ kind: "member", customer }, id, {
    buyerIp: await clientIp(),
  });
  if (!result.ok) {
    if (result.reason === "not_found") redirect("/uye/hesap/karaoke");
    detail(id, "hata", payNoticeCode(result.reason));
  }
  redirect(result.payment.redirectUrl);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { clientIp } from "@/lib/admin/rate-limit";
import { karaokeLinkId } from "@/lib/mobile/karaoke-link";
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
 * The guest's signed booking page (`/rezervasyon?t=…`) - cancel and pay
 * again. Each action is its own public POST endpoint (CLAUDE.md rule 27), so
 * each proves the right to act on its own: the token is verified against
 * the row (id + address + expiry, karaoke-link.ts) inside
 * `cancelKaraokeReservation` / `reopenKaraokePayment`. A token that does not
 * verify is answered like a missing booking.
 */

const TokenSchema = z
  .string()
  .trim()
  .max(120)
  .regex(/^krk-\d{1,12}\.\d{1,12}\.[A-Za-z0-9_-]{43}$/);

function back(token: string, key: string, code: string): never {
  redirect(`/rezervasyon?t=${encodeURIComponent(token)}&${key}=${code}`);
}

export async function cancelKaraokeByLinkAction(
  formData: FormData,
): Promise<void> {
  const parsed = TokenSchema.safeParse(formData.get("t"));
  const id = parsed.success ? karaokeLinkId(parsed.data) : null;
  if (!parsed.success || !id) redirect("/rezervasyon");
  const token = parsed.data;
  // The quiet link opens a step; only its own button sends `confirm=yes`.
  if (formData.get("confirm") !== "yes") back(token, "hata", "onay-gerekli");

  const result = await cancelKaraokeReservation(id, { kind: "link", token });
  revalidatePath("/karaoke");
  revalidatePath("/admin/mobil/karaoke");
  if (!result.ok) {
    if (result.reason === "not_found") redirect("/rezervasyon");
    back(token, "hata", cancelNoticeCode(result.reason));
  }
  back(token, "sonuc", cancelResultCode(result));
}

export async function payKaraokeByLinkAction(
  formData: FormData,
): Promise<void> {
  const parsed = TokenSchema.safeParse(formData.get("t"));
  const id = parsed.success ? karaokeLinkId(parsed.data) : null;
  if (!parsed.success || !id) redirect("/rezervasyon");
  const token = parsed.data;
  const result = await reopenKaraokePayment({ kind: "link", token }, id, {
    buyerIp: await clientIp(),
  });
  if (!result.ok) {
    if (result.reason === "not_found") redirect("/rezervasyon");
    back(token, "hata", payNoticeCode(result.reason));
  }
  redirect(result.payment.redirectUrl);
}

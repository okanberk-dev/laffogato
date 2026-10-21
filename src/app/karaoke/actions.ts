"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { clientIp } from "@/lib/admin/rate-limit";
import { getSettings } from "@/lib/admin/store";
import { getActiveCustomer } from "@/lib/customer/auth";
import { isDbUnreachable } from "@/lib/db/health";
import { karaokeConsentVersion } from "@/lib/legal/store";
import { KARAOKE_CONSENT_DOCS } from "@/lib/legal/meta";
import {
  KARAOKE_CONFIRMATIONS,
  karaokeEndInstant,
  validateReservationContact,
  type KaraokeLegalConsent,
  type KaraokeReservation,
} from "@/lib/mobile/karaoke-core";
import {
  KARAOKE_LINK_COOKIE,
  KARAOKE_LINK_PATH,
  signKaraokeLink,
} from "@/lib/mobile/karaoke-link";
import { bookKaraoke } from "@/lib/mobile/karaoke-payment";

export interface BookKaraokeState {
  error?: string;
  /** Set once a request paid at the venue is taken (prepayment switched off). */
  booked?: { date: string; startHour: number; hours: number; guests: number };
}

const MSG = {
  unverified:
    "Rezervasyon için önce e-postanı doğrula. Bağlantıyı hesabından yeniden gönderebilirsin.",
  consent:
    "Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi kutularını işaretle.",
  kvkk: "Aydınlatma Metni'ni okuduğunu belirten kutuyu işaretle.",
  dbDown:
    "Rezervasyon servisine şu an ulaşılamıyor. Kısa süre içinde tekrar dene.",
  internal: "Beklenmeyen bir hata oluştu. Tekrar dener misin?",
  guestName: "Adını ve soyadını ayrı ayrı yaz.",
} as const;

/** What the form posts; every field a string, parsed before anything runs. */
const FormSchema = z.object({
  date: z.string().max(10),
  startHour: z.coerce.number().int(),
  hours: z.coerce.number().int(),
  guests: z.coerce.number().int(),
  note: z.string().max(400).default(""),
  contactName: z.string().max(120).default(""),
  contactEmail: z.string().max(200).default(""),
  contactPhone: z.string().max(40).default(""),
  guestFirstName: z.string().max(60).default(""),
  guestLastName: z.string().max(60).default(""),
  consentPreInfo: z.literal("on").optional(),
  consentContract: z.literal("on").optional(),
  consentKvkk: z.literal("on").optional(),
  // The cancellation rule the form printed, echoed back: a rule the panel
  // changed while the page was open refuses the booking (createReservation).
  expectedFreeCancelHours: z
    .string()
    .regex(/^\d{1,3}$/)
    .optional(),
  expectedLateRefundPercent: z
    .string()
    .regex(/^\d{1,3}$/)
    .optional(),
});

/** A posted value as a string, or undefined (absent, or a file). */
function text(v: FormDataEntryValue | null): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/**
 * Book the karaoke room from the web - signed in, or without an account
 * (operator, 16 Eki 2026).
 *
 * Both land on `bookKaraoke`, the function `POST /api/mobile/v1/karaoke/
 * reservations` also calls, so one set of rules (hours, cap, overlap, price,
 * prepayment) holds on every surface.
 *
 * With prepayment on (the default) the booking is an unpaid hold and the
 * browser goes straight to the card page; it is confirmed only by its
 * payment. The three boxes are separate acts and each is required: the
 * pre-information confirmed (MSY m.7), the contract accepted, the privacy
 * notice acknowledged (KVKK m.10 - an acknowledgement, not a consent). They
 * are recorded on the row with the time, revision, IP and browser.
 */
export async function bookKaraokeAction(
  _prev: BookKaraokeState,
  formData: FormData,
): Promise<BookKaraokeState> {
  const parsed = FormSchema.safeParse({
    date: text(formData.get("date")),
    startHour: text(formData.get("startHour")),
    hours: text(formData.get("hours")),
    guests: text(formData.get("guests")),
    note: text(formData.get("note")),
    contactName: text(formData.get("contactName")),
    contactEmail: text(formData.get("contactEmail")),
    contactPhone: text(formData.get("contactPhone")),
    guestFirstName: text(formData.get("guestFirstName")),
    guestLastName: text(formData.get("guestLastName")),
    consentPreInfo: text(formData.get("consentPreInfo")),
    consentContract: text(formData.get("consentContract")),
    consentKvkk: text(formData.get("consentKvkk")),
    expectedFreeCancelHours: text(formData.get("expectedFreeCancelHours")),
    expectedLateRefundPercent: text(formData.get("expectedLateRefundPercent")),
  });
  if (!parsed.success) {
    return { error: "Formdaki bilgileri kontrol edip yeniden dene." };
  }
  const form = parsed.data;

  let destination: string;
  try {
    const customer = await getActiveCustomer();
    if (customer && !customer.emailVerified) return { error: MSG.unverified };
    const settings = await getSettings();
    const prepay = settings.karaokePrepay;
    // Without an account there is no request flow to fall back on.
    if (!customer && !prepay) {
      return {
        error:
          "Üye olmadan rezervasyon şu an alınmıyor. Giriş yaparak rezervasyon yapabilirsin.",
      };
    }

    // A member's name and address come from the account (the form shows
    // them, it does not ask); a guest types them.
    let name = form.contactName;
    if (!customer) {
      const first = form.guestFirstName.replace(/\s+/g, " ").trim();
      const last = form.guestLastName.replace(/\s+/g, " ").trim();
      if (first.length < 2 || last.length < 2) return { error: MSG.guestName };
      name = `${first} ${last}`;
    }
    const contact = validateReservationContact({
      name,
      email: customer ? customer.email : form.contactEmail,
      phone: form.contactPhone,
      consent: form.consentKvkk === "on",
    });
    if (!contact.ok) {
      return {
        error: form.consentKvkk === "on" ? contact.message : MSG.kvkk,
      };
    }

    const now = new Date();
    const ip = await clientIp();
    let legalConsent: KaraokeLegalConsent | undefined;
    if (prepay) {
      if (form.consentPreInfo !== "on" || form.consentContract !== "on") {
        return { error: MSG.consent };
      }
      const h = await headers();
      legalConsent = {
        acceptedAt: now.toISOString(),
        documents: [...KARAOKE_CONSENT_DOCS],
        version: await karaokeConsentVersion(),
        confirmations: [...KARAOKE_CONFIRMATIONS],
        surface: "web",
        ip,
        userAgent: (h.get("user-agent") ?? "").slice(0, 300),
      };
    }

    const result = await bookKaraoke(
      customer,
      {
        date: form.date,
        startHour: form.startHour,
        hours: form.hours,
        guests: form.guests,
        note: form.note,
        ...(form.expectedFreeCancelHours !== undefined &&
        form.expectedLateRefundPercent !== undefined
          ? {
              expectedCancelPolicy: {
                freeCancelHours: Number(form.expectedFreeCancelHours),
                lateRefundPercent: Number(form.expectedLateRefundPercent),
              },
            }
          : {}),
      },
      {
        channel: "web",
        prepay,
        contact: { ...contact.value, consentAt: now.toISOString() },
        legalConsent,
        buyerIp: ip,
        now,
      },
    );
    if (!result.ok) return { error: result.message };
    revalidatePath("/karaoke");

    const r = result.reservation;
    if (r.paymentStatus === "none") {
      // Prepayment switched off: the old request, confirmed by hand.
      return {
        booked: {
          date: r.date,
          startHour: r.startHour,
          hours: r.hours,
          guests: r.guests,
        },
      };
    }
    // The browser that made the booking can open it again when it comes
    // back from the bank - the return itself proves nothing (karaoke-link.ts).
    if (r.guest) await rememberGuestLink(r, now);
    destination = result.payment
      ? result.payment.redirectUrl
      : // Nothing was owed (a 100 % discount): settled already.
        resultPath(r);
  } catch (err) {
    if (isDbUnreachable(err)) return { error: MSG.dbDown };
    console.error(
      "[karaoke/bookKaraokeAction]",
      err instanceof Error ? err.message : "unknown error",
    );
    return { error: MSG.internal };
  }
  // Outside the try: `redirect` throws by design.
  redirect(destination);
}

function resultPath(r: KaraokeReservation): string {
  return r.guest
    ? `${KARAOKE_LINK_PATH}?ref=${encodeURIComponent(r.id)}&odeme=basarili`
    : `/uye/hesap/karaoke/${encodeURIComponent(r.id)}?odeme=basarili`;
}

async function rememberGuestLink(
  r: KaraokeReservation,
  now: Date,
): Promise<void> {
  const maxAge = Math.floor(
    (karaokeEndInstant(r).getTime() - now.getTime()) / 1000,
  );
  if (maxAge <= 0) return;
  const jar = await cookies();
  jar.set({
    name: KARAOKE_LINK_COOKIE,
    value: signKaraokeLink(r),
    httpOnly: true,
    // Lax: sent on the top-level GET the bank's return redirects to, never
    // on a cross-site POST.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: KARAOKE_LINK_PATH,
    maxAge,
  });
}

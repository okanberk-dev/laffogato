"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { getSettings, updateSettings } from "@/lib/admin/store";
import { isLiveLegalOverride } from "@/lib/legal/consent-version";
import { KARAOKE_CONSENT_DOCS } from "@/lib/legal/meta";
import { getLegalDocOverride } from "@/lib/legal/store";
import {
  DEFAULT_KARAOKE_CANCEL_POLICY,
  KARAOKE_FREE_CANCEL_HOURS_MAX,
  karaokeCancelPolicyRefusal,
  karaokePolicyLockReason,
  samePolicy,
  type KaraokeCancelPolicy,
} from "@/lib/mobile/karaoke-time";
import { MONEY_TOO_LARGE_ERROR } from "@/lib/utils/format";

import {
  changedKeys,
  EMAIL_RE,
  NO_CHANGE,
  ok,
  readMoney,
  readWholeNumber,
  refuse,
  revalidateAll,
} from "./action-helpers";
import type { SettingsState } from "./settings-core";

/**
 * The cancellation policy's two boxes (P2a, operator 17 Eki 2026): digits
 * only, in range, with the panel's own words. Fairness limits and the app
 * lock come after (`karaokeCancelPolicyRefusal`, `karaokePolicyLockReason`).
 */
const wholeField = (max: number, message: string) =>
  z
    .string({ error: message })
    .trim()
    .regex(/^\d{1,3}$/, message)
    .transform(Number)
    .pipe(z.number().int(message).min(0, message).max(max, message));

const CancelPolicySchema = z.object({
  karaokeFreeCancelHours: wholeField(
    KARAOKE_FREE_CANCEL_HOURS_MAX,
    `Ücretsiz iptal süresi 0 ile ${KARAOKE_FREE_CANCEL_HOURS_MAX} saat arasında tam sayı olmalı.`,
  ),
  karaokeLateRefundPercent: wholeField(
    100,
    "Geç iptalde iade oranı 0 ile 100 arasında tam sayı olmalı.",
  ),
});

/** The box a refusal of `policy` points at: the one off the default. */
function policyField(
  policy: KaraokeCancelPolicy,
): "karaokeFreeCancelHours" | "karaokeLateRefundPercent" {
  return policy.freeCancelHours !==
    DEFAULT_KARAOKE_CANCEL_POLICY.freeCancelHours
    ? "karaokeFreeCancelHours"
    : "karaokeLateRefundPercent";
}

const MSG_TERMS_EDITED =
  "Karaoke odası koşullarının Yasal belgeler bölümünde yayında bir düzenlemesi var. Sitede ve uygulamada o metin görünür ve yeni kurala göre kendiliğinden değişmez; önce o düzenlemeyi yayından kaldır, sonra kuralı değiştir.";

/**
 * Is an edit of the karaoke terms published? /hukuk and the app show it
 * instead of the text written for the policy (karaoke-doc.ts), and it does
 * not follow the policy. Read so that it throws: an unreadable table is no
 * reason to let the rule move.
 */
async function karaokeTermsEdited(): Promise<boolean> {
  const rows = await Promise.all(
    KARAOKE_CONSENT_DOCS.map((slug) => getLegalDocOverride(slug)),
  );
  return rows.some((row) => isLiveLegalOverride(row));
}

/**
 * The policy the form posted, or the refusal. A post without either box (a
 * hand-made one, an older form) leaves the policy as it is.
 */
function readCancelPolicy(
  formData: FormData,
  minSupportedAppVersion: string,
):
  | { ok: true; policy: KaraokeCancelPolicy | null }
  | { ok: false; state: SettingsState } {
  const hours = formData.get("karaokeFreeCancelHours");
  const percent = formData.get("karaokeLateRefundPercent");
  if (hours === null && percent === null) return { ok: true, policy: null };
  const parsed = CancelPolicySchema.safeParse({
    karaokeFreeCancelHours: hours ?? "",
    karaokeLateRefundPercent: percent ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? "karaokeFreeCancelHours");
    return {
      ok: false,
      state: refuse(issue?.message ?? "İptal kuralı geçersiz.", field),
    };
  }
  const policy: KaraokeCancelPolicy = {
    freeCancelHours: parsed.data.karaokeFreeCancelHours,
    lateRefundPercent: parsed.data.karaokeLateRefundPercent,
  };
  const unfair = karaokeCancelPolicyRefusal(policy);
  if (unfair) return { ok: false, state: refuse(unfair.message, unfair.field) };
  // Until the app prints the booking's own rule on every screen, a policy
  // other than the default would show an app user a rule they did not book
  // under (karaoke-time.ts, KARAOKE_POLICY_APP_VERSION).
  const locked = karaokePolicyLockReason(minSupportedAppVersion);
  if (locked && !samePolicy(policy, DEFAULT_KARAOKE_CANCEL_POLICY)) {
    return { ok: false, state: refuse(locked, policyField(policy)) };
  }
  return { ok: true, policy };
}

export async function saveKaraokeAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("settings");
  const hourly = readMoney(formData.get("karaokeHourly"));
  if (!hourly.ok || hourly.minor <= 0) {
    return refuse(
      !hourly.ok && hourly.tooLarge
        ? MONEY_TOO_LARGE_ERROR
        : "Karaoke saatlik ücreti sıfırdan büyük bir sayı olmalı.",
      "karaokeHourly",
    );
  }
  // Digits only: parseInt read "8.5" as 8 and "8 kişi" as 8 without a word.
  const capacity = readWholeNumber(formData.get("karaokeCapacity"));
  if (capacity === null || capacity < 1 || capacity > 50) {
    return refuse(
      "Karaoke kapasitesi 1 ile 50 arasında tam sayı olmalı.",
      "karaokeCapacity",
    );
  }
  const notifyEmail = String(formData.get("karaokeNotifyEmail") ?? "").trim();
  if (
    notifyEmail &&
    (!EMAIL_RE.test(notifyEmail) || notifyEmail.length > 254)
  ) {
    return refuse(
      "Talep bildirimi için geçerli bir e-posta gir.",
      "karaokeNotifyEmail",
    );
  }
  // The online-prepayment switch (16 Eki 2026). A checkbox: absent = off.
  const prepay = formData.get("karaokePrepay") === "on";
  const before = await getSettings();
  const cancel = readCancelPolicy(
    formData,
    before.mobileApp?.minSupportedAppVersion ?? "0.0.0",
  );
  if (!cancel.ok) return cancel.state;
  const next: {
    karaokeHourlyMinor: number;
    karaokeCapacity: number;
    karaokeNotifyEmail: string;
    karaokePrepay: boolean;
    karaokeFreeCancelHours?: number;
    karaokeLateRefundPercent?: number;
  } = {
    karaokeHourlyMinor: hourly.minor,
    karaokeCapacity: capacity,
    karaokeNotifyEmail: notifyEmail,
    karaokePrepay: prepay,
    ...(cancel.policy
      ? {
          karaokeFreeCancelHours: cancel.policy.freeCancelHours,
          karaokeLateRefundPercent: cancel.policy.lateRefundPercent,
        }
      : {}),
  };
  const moved = changedKeys(before, next);
  if (!moved) return NO_CHANGE;
  // The day the rule changed dates the karaoke document's new text and the
  // version a booking's consent records (karaokePolicyVersion). Bookings
  // already made keep their own snapshot.
  const policyMoved =
    "karaokeFreeCancelHours" in moved.after ||
    "karaokeLateRefundPercent" in moved.after;
  // A published edit of the karaoke terms would keep showing the old rule
  // while a booking's consent records the new one's date
  // (karaokePolicyVersion). Back to the default, or a save that keeps the
  // rule, creates no such gap.
  if (
    policyMoved &&
    cancel.policy &&
    !samePolicy(cancel.policy, DEFAULT_KARAOKE_CANCEL_POLICY) &&
    (await karaokeTermsEdited())
  ) {
    return refuse(MSG_TERMS_EDITED, policyField(cancel.policy));
  }
  await updateSettings(
    policyMoved
      ? { ...next, karaokeCancelPolicyAt: new Date().toISOString() }
      : next,
  );
  revalidateAll();
  if (policyMoved) {
    // The pages that print the rule a booking made now gets: the karaoke
    // terms are rendered for it (karaoke-doc.ts), the booking page quotes it.
    for (const slug of KARAOKE_CONSENT_DOCS) revalidatePath(`/hukuk/${slug}`);
    revalidatePath("/hukuk");
    revalidatePath("/karaoke");
  }
  return ok("karaoke", "Karaoke ayarları kaydedildi.", moved);
}

import "server-only";

import { getSettings } from "@/lib/admin/store";
import {
  sendFranchiseReceivedEmail,
  sendOperatorNotice,
  type SendResult,
} from "@/lib/email/send";
import { SITE } from "@/lib/seo/site";

import {
  BUDGET_OPTIONS,
  EXPERIENCE_OPTIONS,
  FRANCHISE_RETENTION_MONTHS,
  franchiseOptionLabel,
  LOCATION_OPTIONS,
  TIMELINE_OPTIONS,
} from "./franchise-core";
import type { FranchiseApplication } from "./store";

/** The panel page of one application. */
export function franchiseAdminUrl(id: string): string {
  return `${SITE.url}/admin/franchise/${encodeURIComponent(id)}`;
}

/**
 * Where a new application is mailed: the operations address (Ayarlar →
 * Bildirimler, `notificationEmail`), else the operator address in Ayarlar
 * (`email`). "" when neither is set.
 */
export function franchiseNoticeRecipient(s: {
  notificationEmail?: string;
  email?: string;
}): string {
  return s.notificationEmail?.trim() || s.email?.trim() || "";
}

/**
 * Tells the team a franchise application came in, in the customer mails'
 * design (`operasyon-bildirim`, through `sendOperatorNotice`). INTERNAL
 * mail: the applicant's address and phone are printed in full because the
 * team has to call them back, and reply-to is the applicant. No unsubscribe
 * line (not a commercial message).
 */
export async function sendFranchiseOperatorNotice(
  app: FranchiseApplication,
): Promise<SendResult> {
  const to = franchiseNoticeRecipient(await getSettings());
  if (!to)
    return { ok: false, error: "Ayarlar'da bildirim adresi tanımlı değil." };
  const place = app.district ? `${app.city} / ${app.district}` : app.city;
  return sendOperatorNotice({
    to,
    subject: `Franchise başvurusu · ${place} (${app.id})`,
    summary: `${place} için yeni franchise başvurusu: ${franchiseOptionLabel(BUDGET_OPTIONS, app.budget)}`,
    label: "FRANCHISE · YENİ BAŞVURU",
    title: "Yeni franchise başvurusu",
    subtitle: `${place} · siteden geldi`,
    rows: [
      { label: "Başvuru", value: app.id },
      { label: "Ad soyad", value: app.name },
      { label: "E-posta", value: app.email },
      { label: "Telefon", value: app.phone },
      { label: "İl", value: app.city },
      { label: "İlçe", value: app.district },
      {
        label: "Yer",
        value: franchiseOptionLabel(LOCATION_OPTIONS, app.locationStatus),
      },
      {
        label: "Yatırım",
        value: franchiseOptionLabel(BUDGET_OPTIONS, app.budget),
      },
      {
        label: "Deneyim",
        value: franchiseOptionLabel(EXPERIENCE_OPTIONS, app.experience),
      },
      {
        label: "Başlangıç",
        value: franchiseOptionLabel(TIMELINE_OPTIONS, app.timeline),
      },
    ],
    note: app.message ? { label: "Başvuranın notu", text: app.message } : undefined,
    button: { label: "Başvuruyu aç", url: franchiseAdminUrl(app.id) },
    footnote: `Bu e-postayı yanıtlarsan başvurana yazarsın. Başvuru ${FRANCHISE_RETENTION_MONTHS} ay sonra kendiliğinden silinir.`,
    replyTo: app.email,
    idempotencyKey: `franchise-${app.id}-operator`,
  });
}

/**
 * The applicant's receipt ("Başvurunu aldık", `franchise-basvuru`): what
 * they sent, that the application is free of charge and how long it is
 * kept. Transactional, no unsubscribe line.
 */
export async function sendFranchiseApplicantReceipt(
  app: FranchiseApplication,
): Promise<SendResult> {
  return sendFranchiseReceivedEmail(app.email, {
    name: app.name,
    applicationId: app.id,
    place: app.district ? `${app.district} / ${app.city}` : app.city,
    locationLabel: franchiseOptionLabel(LOCATION_OPTIONS, app.locationStatus),
    budgetLabel: franchiseOptionLabel(BUDGET_OPTIONS, app.budget),
    timelineLabel: franchiseOptionLabel(TIMELINE_OPTIONS, app.timeline),
    retentionMonths: FRANCHISE_RETENTION_MONTHS,
    idempotencyKey: `franchise-${app.id}-applicant`,
  });
}

/**
 * Everything a new application sets off, run after the response
 * (`after()` in src/app/franchise/actions.ts): the team's notice and the
 * applicant's receipt, independently (one failing does not stop the other).
 * Never throws: the application is stored and shows in the panel whatever
 * the mail does. Logs carry the application id only, never the applicant's
 * address or phone (CLAUDE.md rule 9).
 */
export async function notifyFranchiseApplication(
  app: FranchiseApplication,
): Promise<void> {
  const jobs: [string, () => Promise<SendResult>][] = [
    ["ekip bildirimi", () => sendFranchiseOperatorNotice(app)],
    ["başvuru onayı", () => sendFranchiseApplicantReceipt(app)],
  ];
  await Promise.all(
    jobs.map(async ([what, send]) => {
      try {
        const sent = await send();
        if (!sent.ok) {
          console.warn(`[franchise] ${app.id} ${what} gitmedi: ${sent.error}`);
        }
      } catch (err) {
        console.error(
          `[franchise] ${app.id} ${what} hazırlanamadı`,
          err instanceof Error ? err.message : "unknown error",
        );
      }
    }),
  );
}

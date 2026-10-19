import Link from "next/link";

import { Card, PageHeader, formatDateTime } from "@/components/admin/forms";
import {
  Badge,
  BUTTON,
  ConfirmButton,
  EmptyState,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/admin/auth";
import {
  campaignAudienceCounts,
  campaignAudienceKey,
} from "@/lib/admin/campaign-mail";
import {
  CAMPAIGN_MAIL_AUDIENCE_LABELS,
  CAMPAIGN_MAIL_TEMPLATE_LABELS,
} from "@/lib/admin/campaign-mail-schema";
import { listCampaignEmails } from "@/lib/email/campaigns";

import { deleteCampaignMailAction, sendCampaignMailAction } from "./actions";
import { CampaignSendForm } from "./campaign-mail-controls";
import { CampaignStatusPill, canSendCampaign } from "./campaign-status";

export const metadata = { title: "Admin · Kampanya e-postası" };
export const dynamic = "force-dynamic";
// "Gönder" on this page hands the batches to `after()`, which runs for the
// route's max duration; the runner itself stops at 240 s (campaign-mail.ts).
export const maxDuration = 300;

const LIST_PATH = "/admin/bulten/kampanya";

const NEW_CAMPAIGN = (
  <Link
    href={`${LIST_PATH}/yeni`}
    className={`${BUTTON.primary} w-full sm:w-auto`}
  >
    + Yeni kampanya
  </Link>
);

export default async function CampaignMailListPage() {
  await requireRole("newsletter");
  const rows = await listCampaignEmails();

  // One dry count per distinct (audience, preference) among the rows that can
  // be sent from here - the confirm on "Gönder" quotes it. Two campaigns to
  // the same audience share a number, not a second query; the others are
  // asked at once.
  const counts = await campaignAudienceCounts(
    rows.filter((c) => canSendCampaign(c.status)),
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Pazarlama"
        title="Kampanya e-postası"
        description="Rıza vermiş üyelere ve bülten abonelerine giden ticari iletiler. Taslak → test → gönder; gönderim arka planda parti parti çıkar, eksik kalan partileri günlük görev tamamlar."
        action={NEW_CAMPAIGN}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Henüz kampanya yok."
          description="Yayına giren bir mobil gönderi de burada bir kampanya olarak görünür."
          action={NEW_CAMPAIGN}
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((c) => {
            const sendable = canSendCampaign(c.status);
            const count =
              counts.get(campaignAudienceKey(c.audience, c.template)) ?? null;
            const audienceLabel =
              CAMPAIGN_MAIL_AUDIENCE_LABELS[c.audience] ?? c.audience;
            return (
              <Card key={c.id}>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge>
                        {CAMPAIGN_MAIL_TEMPLATE_LABELS[c.template] ??
                          c.template}
                      </Badge>
                      <CampaignStatusPill status={c.status} />
                    </div>
                    <p className="truncate font-medium text-[var(--admin-text)]">
                      {c.subject || "(başlıksız)"}
                    </p>
                    <p className="text-sm text-[var(--admin-text-soft)]">
                      {audienceLabel}
                    </p>
                    {/* The failure count is real information: soft ink
                        (8.88:1), not the palette's light grey (2.59:1; PEO-10). */}
                    <p className="mt-1 text-xs text-[var(--admin-text-soft)]">
                      {c.status === "draft" ? (
                        c.scheduledAt ? (
                          `${formatDateTime(c.scheduledAt)} için zamanlandı`
                        ) : (
                          "Henüz kuyruğa alınmadı"
                        )
                      ) : (
                        <span>
                          {c.total} alıcı · {c.sentCount} gönderildi ·{" "}
                          <span
                            className={
                              c.failedCount > 0
                                ? "text-[var(--admin-danger-ink)]"
                                : undefined
                            }
                          >
                            {c.failedCount} başarısız
                          </span>
                        </span>
                      )}
                      {c.createdAt ? ` · ${formatDateTime(c.createdAt)}` : ""}
                      {c.createdBy ? ` · ${c.createdBy}` : ""}
                    </p>
                    {c.sourcePostId && (
                      <p className="mt-1 text-xs text-[var(--admin-text-soft)]">
                        Mobil gönderiden:{" "}
                        <Link
                          href={`/admin/mobil/gonderiler/${c.sourcePostId}`}
                          className="text-[var(--admin-primary)] underline underline-offset-4"
                        >
                          {c.sourcePostId}
                        </Link>
                      </p>
                    )}
                    {c.lastError && (
                      <p className="mt-1 text-xs break-words text-[var(--admin-danger-ink)]">
                        {c.lastError}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <Link
                      href={`${LIST_PATH}/${c.id}`}
                      className={BUTTON.ghost}
                    >
                      {c.status === "draft" ? "Düzenle" : "Ayrıntı"}
                    </Link>
                    {sendable && (
                      <CampaignSendForm
                        action={sendCampaignMailAction.bind(null, c.id)}
                        audienceCount={count}
                        audienceLabel={audienceLabel}
                        label={
                          c.status === "failed" ? "Yeniden gönder" : "Gönder"
                        }
                      />
                    )}
                    {c.status === "draft" && (
                      <ConfirmButton
                        action={deleteCampaignMailAction}
                        hidden={{ id: c.id }}
                        label="Sil"
                        ariaLabel={`Sil: ${c.subject || "başlıksız taslak"}`}
                        title="Taslak silinsin mi?"
                        description="Taslak kalıcı olarak silinir. Kuyruğa alınmış ya da gönderilmiş bir kampanya silinmez."
                      />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}

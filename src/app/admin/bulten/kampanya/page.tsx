import Link from "next/link";

import { DeleteRowForm } from "@/components/admin/delete-row-form";
import { Card, PageHeader, formatDateTime } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { campaignAudienceCount } from "@/lib/admin/campaign-mail";
import {
  CAMPAIGN_MAIL_AUDIENCE_LABELS,
  CAMPAIGN_MAIL_TEMPLATE_LABELS,
} from "@/lib/admin/campaign-mail-schema";
import { listCampaignEmails, prefForTemplate } from "@/lib/email/campaigns";

import { deleteCampaignMailAction, sendCampaignMailAction } from "./actions";
import { CampaignSendForm } from "./campaign-mail-controls";
import { CampaignStatusPill, canSendCampaign } from "./campaign-status";

export const metadata = { title: "Admin · Kampanya e-postası" };
export const dynamic = "force-dynamic";
// "Gönder" on this page hands the batches to `after()`, which runs for the
// route's max duration; the runner itself stops at 240 s (campaign-mail.ts).
export const maxDuration = 300;

export default async function CampaignMailListPage() {
  await requireRole("newsletter");
  const rows = await listCampaignEmails();

  // One dry count per distinct (audience, preference) among the rows that can
  // be sent from here - the confirm on "Gönder" quotes it. Two campaigns to
  // the same audience share a number, not a second query.
  const counts = new Map<string, number | null>();
  for (const c of rows) {
    if (!canSendCampaign(c.status)) continue;
    const key = `${c.audience}:${prefForTemplate(c.template)}`;
    if (!counts.has(key)) {
      counts.set(key, await campaignAudienceCount(c.audience, c.template));
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Pazarlama"
        title="Kampanya e-postası"
        description="Rıza vermiş üyelere ve bülten abonelerine giden ticari iletiler. Taslak → test → gönder; gönderim arka planda parti parti çıkar, eksik kalan partileri günlük görev tamamlar."
        action={
          <Link
            href="/admin/bulten/kampanya/yeni"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--admin-primary-hover)] sm:w-auto"
          >
            + Yeni kampanya
          </Link>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-500">
            Henüz kampanya yok. Yayına giren bir mobil gönderi de burada bir
            kampanya olarak görünür.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((c) => {
            const sendable = canSendCampaign(c.status);
            const count =
              counts.get(`${c.audience}:${prefForTemplate(c.template)}`) ??
              null;
            return (
              <Card key={c.id}>
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--admin-surface-2)] px-2.5 py-0.5 text-[10px] tracking-[0.18em] text-[var(--admin-text-soft)] uppercase">
                        {CAMPAIGN_MAIL_TEMPLATE_LABELS[c.template] ??
                          c.template}
                      </span>
                      <CampaignStatusPill status={c.status} />
                    </div>
                    <p className="truncate font-medium">
                      {c.subject || "(başlıksız)"}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {CAMPAIGN_MAIL_AUDIENCE_LABELS[c.audience] ?? c.audience}
                    </p>
                    <p
                      className="mt-1 text-xs text-neutral-400"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {c.status === "draft"
                        ? c.scheduledAt
                          ? `${formatDateTime(c.scheduledAt)} için zamanlandı`
                          : "henüz kuyruğa alınmadı"
                        : `${c.total} alıcı · ${c.sentCount} gönderildi · ${c.failedCount} başarısız`}
                      {c.createdAt ? ` · ${formatDateTime(c.createdAt)}` : ""}
                      {c.createdBy ? ` · ${c.createdBy}` : ""}
                    </p>
                    {c.sourcePostId && (
                      <p className="mt-1 text-xs text-neutral-400">
                        Mobil gönderiden:{" "}
                        <Link
                          href={`/admin/mobil/gonderiler/${c.sourcePostId}`}
                          className="underline"
                        >
                          {c.sourcePostId}
                        </Link>
                      </p>
                    )}
                    {c.lastError && (
                      <p className="mt-1 text-xs text-red-600">{c.lastError}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <Link
                      href={`/admin/bulten/kampanya/${c.id}`}
                      className="inline-flex min-h-[40px] items-center rounded-lg border border-[var(--admin-border)] px-4 text-sm"
                    >
                      {c.status === "draft" ? "Düzenle" : "Ayrıntı"}
                    </Link>
                    {sendable && (
                      <CampaignSendForm
                        action={sendCampaignMailAction.bind(null, c.id)}
                        audienceCount={count}
                        audienceLabel={
                          CAMPAIGN_MAIL_AUDIENCE_LABELS[c.audience] ??
                          c.audience
                        }
                        label={
                          c.status === "failed" ? "Yeniden gönder" : "Gönder"
                        }
                      />
                    )}
                    {c.status === "draft" && (
                      <DeleteRowForm
                        action={deleteCampaignMailAction}
                        id={c.id}
                        confirmMessage="Bu taslağı silmek istediğine emin misin?"
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

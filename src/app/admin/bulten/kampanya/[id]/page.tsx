import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, PageHeader, formatDateTime } from "@/components/admin/forms";
import { requireRole } from "@/lib/admin/auth";
import { campaignAudienceCount } from "@/lib/admin/campaign-mail";
import {
  CAMPAIGN_MAIL_AUDIENCE_LABELS,
  CAMPAIGN_MAIL_TEMPLATE_LABELS,
  campaignMailFieldsFor,
} from "@/lib/admin/campaign-mail-schema";
import {
  getCampaignEmail,
  previewCampaignEmail,
  scheduledAtInputValue,
  type CampaignEmail,
} from "@/lib/email/campaigns";

import {
  sendCampaignMailAction,
  sendCampaignMailTestAction,
  updateCampaignMailAction,
} from "../actions";
import { CampaignSendForm, CampaignTestForm } from "../campaign-mail-controls";
import { CampaignMailForm } from "../campaign-mail-form";
import {
  CampaignStatusPill,
  canResumeCampaign,
  canSendCampaign,
} from "../campaign-status";

export const metadata = { title: "Admin · Kampanya e-postası" };
export const dynamic = "force-dynamic";
// Hosts "Gönder": the Server Actions on this page get the route's max
// duration, and `after()` keeps sending batches inside it (240 s, then cron).
export const maxDuration = 300;

/** The preview, or the reason there is none — a hole in the template, named. */
function preview(c: CampaignEmail): { html: string } | { error: string } {
  try {
    return { html: previewCampaignEmail(c, { name: "Örnek Üye" }).html };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function CampaignMailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("newsletter");
  const { id } = await params;
  const c = await getCampaignEmail(id);
  if (!c) notFound();

  const isDraft = c.status === "draft";
  const sendable = canSendCampaign(c.status);
  const resumable = canResumeCampaign(c.status);
  const count =
    sendable || resumable
      ? await campaignAudienceCount(c.audience, c.template)
      : null;
  const rendered = preview(c);
  const templateLabel = CAMPAIGN_MAIL_TEMPLATE_LABELS[c.template] ?? c.template;
  const audienceLabel = CAMPAIGN_MAIL_AUDIENCE_LABELS[c.audience] ?? c.audience;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Pazarlama · Kampanya e-postası"
        title={c.subject || "Kampanya"}
        description={`${templateLabel} · ${audienceLabel}`}
        action={
          <Link
            href="/admin/bulten/kampanya"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] px-4 text-sm text-[var(--admin-text-soft)] sm:w-auto"
          >
            ← Kampanyalar
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="min-w-0">
          {isDraft ? (
            <CampaignMailForm
              action={updateCampaignMailAction.bind(null, c.id)}
              defaults={{
                template: c.template,
                audience: c.audience,
                fields: c.fields,
                scheduledAt: scheduledAtInputValue(c.scheduledAt),
              }}
              submitLabel="Taslağı kaydet"
            />
          ) : (
            <StoredFields c={c} />
          )}
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-6">
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2
                className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
                style={{ fontFamily: "var(--mono), monospace" }}
              >
                Durum
              </h2>
              <CampaignStatusPill status={c.status} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {!isDraft && (
                <>
                  <dt className="text-neutral-500">Alıcı</dt>
                  <dd>{c.total}</dd>
                  <dt className="text-neutral-500">Gönderildi</dt>
                  <dd>{c.sentCount}</dd>
                  <dt className="text-neutral-500">Başarısız</dt>
                  <dd>{c.failedCount}</dd>
                </>
              )}
              {isDraft && c.scheduledAt && (
                <>
                  <dt className="text-neutral-500">Zamanlandı</dt>
                  <dd>{formatDateTime(c.scheduledAt)}</dd>
                </>
              )}
              {c.queuedAt && (
                <>
                  <dt className="text-neutral-500">Kuyruk</dt>
                  <dd>{formatDateTime(c.queuedAt)}</dd>
                </>
              )}
              {c.sentAt && (
                <>
                  <dt className="text-neutral-500">Bitti</dt>
                  <dd>{formatDateTime(c.sentAt)}</dd>
                </>
              )}
              <dt className="text-neutral-500">Oluşturan</dt>
              <dd className="truncate">
                {c.createdBy || "—"}
                {c.createdAt ? ` · ${formatDateTime(c.createdAt)}` : ""}
              </dd>
              {c.sourcePostId && (
                <>
                  <dt className="text-neutral-500">Kaynak</dt>
                  <dd>
                    <Link
                      href={`/admin/mobil/gonderiler/${c.sourcePostId}`}
                      className="underline"
                    >
                      Mobil gönderi
                    </Link>
                  </dd>
                </>
              )}
            </dl>
            {c.lastError && (
              <p className="mt-3 text-xs text-red-600">{c.lastError}</p>
            )}
            {isDraft && c.scheduledAt && (
              <p className="mt-3 text-xs text-neutral-500">
                Bu taslak zamanı gelince kendiliğinden kuyruğa alınır; saatlik
                görev onu yakalar. Beklemek istemezsen aşağıdan şimdi
                gönderebilirsin.
              </p>
            )}
            {resumable && (
              <p className="mt-3 text-xs text-neutral-500">
                Gönderim sürüyor ya da yarım kaldı; kalan partileri günlük görev
                tamamlar. Beklemek istemezsen aşağıdan sürdür — kimse iki kez
                almaz.
              </p>
            )}
          </Card>

          <Card>
            <h2
              className="mb-3 text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              Test
            </h2>
            <p className="mb-3 text-xs text-neutral-500">
              Gerçek bir e-posta; AD &ldquo;Test&rdquo; olur, çıkış bağlantısı
              sahtedir, gönderim defterine yazılmaz.
            </p>
            <CampaignTestForm
              action={sendCampaignMailTestAction.bind(null, c.id)}
              defaultTo={session.email}
            />
          </Card>

          {(sendable || resumable) && (
            <Card>
              <h2
                className="mb-3 text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
                style={{ fontFamily: "var(--mono), monospace" }}
              >
                Gönderim
              </h2>
              <p className="mb-1 text-sm">{audienceLabel}</p>
              <p className="mb-3 text-xs text-neutral-500">
                {count === null
                  ? "Kitle şu an sayılamadı."
                  : `Şu an ${count} adres. Kuyruğa alınırken yeniden sayılır.`}
                {count !== null && count > 100
                  ? " Resend'in ücretsiz planı günde 100 e-posta ile sınırlıdır; göndermeden önce planın buna yettiğinden emin ol."
                  : ""}
              </p>
              <CampaignSendForm
                action={sendCampaignMailAction.bind(null, c.id)}
                audienceCount={count}
                audienceLabel={audienceLabel}
                label={
                  resumable
                    ? "Gönderimi sürdür"
                    : c.status === "failed"
                      ? "Yeniden gönder"
                      : "Gönder"
                }
              />
              {isDraft && (
                <p className="mt-3 text-xs text-neutral-500">
                  Kaydedilmemiş değişiklik varsa önce &ldquo;Taslağı
                  kaydet&rdquo;. Kuyruğa alınan kampanya bir daha düzenlenemez.
                </p>
              )}
            </Card>
          )}
        </aside>
      </div>

      <Card className="mt-4">
        <h2
          className="mb-3 text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          Önizleme
        </h2>
        {"html" in rendered ? (
          // Sandboxed: no scripts, opaque origin, so the mail's markup cannot
          // reach the panel; images still load from laffogato.net/email.
          <iframe
            title="E-posta önizleme"
            srcDoc={rendered.html}
            sandbox=""
            referrerPolicy="no-referrer"
            className="h-[900px] w-full rounded-xl border border-[var(--admin-border)] bg-white"
          />
        ) : (
          <p className="text-sm text-amber-700">
            Önizleme hazırlanamadı: {rendered.error}
          </p>
        )}
      </Card>
    </main>
  );
}

/** A queued or sent campaign's fields, read-only: what the members got. */
function StoredFields({ c }: { c: CampaignEmail }) {
  const known = campaignMailFieldsFor(c.template);
  const knownKeys = new Set(known.map((f) => f.key));
  const rows: Array<{ label: string; value: string }> = [];
  for (const f of known) {
    const value = c.fields[f.key];
    if (value) rows.push({ label: f.label, value });
  }
  for (const [key, value] of Object.entries(c.fields)) {
    if (!knownKeys.has(key) && value) rows.push({ label: key, value });
  }
  return (
    <Card>
      <h2
        className="mb-3 text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
        style={{ fontFamily: "var(--mono), monospace" }}
      >
        İçerik
      </h2>
      <p className="mb-4 text-xs text-neutral-500">
        Kuyruğa alınan kampanya düzenlenemez: gönderim defteri bu alanlarla
        kuruldu ve bir yeniden deneme aynı mesaj olmak zorunda.
      </p>
      <dl className="grid gap-3 text-sm">
        {rows.map((r) => (
          <div key={r.label}>
            <dt
              className="text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              {r.label}
            </dt>
            <dd className="break-words whitespace-pre-wrap">{r.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

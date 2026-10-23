import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/admin/back-link";
import { CampaignSendLog } from "@/components/admin/campaign-send-log";
import { Card, PageHeader, formatDateTime } from "@/components/admin/forms";
import { EYEBROW, MONO_STYLE } from "@/components/admin/ui/styles";
import { requireRole } from "@/lib/admin/auth";
import { campaignAudienceCount } from "@/lib/admin/campaign-mail";
import {
  CAMPAIGN_MAIL_AUDIENCE_LABELS,
  CAMPAIGN_MAIL_TEMPLATE_LABELS,
  campaignMailFieldsFor,
} from "@/lib/admin/campaign-mail-schema";
import {
  campaignServerVars,
  getCampaignEmail,
  previewCampaignEmail,
  scheduledAtInputValue,
  type CampaignEmail,
} from "@/lib/email/campaigns";
import { hasAppLinks } from "@/lib/mobile/app-store";

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

const LIST_PATH = "/admin/bulten/kampanya";
const DT = "text-[var(--admin-text-soft)]";
const NOTE = "mt-3 text-xs text-[var(--admin-text-soft)]";
const TEXT_LINK =
  "text-[var(--admin-primary)] underline underline-offset-4 hover:text-[var(--admin-primary-hover)]";
export const dynamic = "force-dynamic";
// Hosts "Gönder": the Server Actions on this page get the route's max
// duration, and `after()` keeps sending batches inside it (240 s, then cron).
export const maxDuration = 300;

/**
 * The preview, or the reason there is none - a hole in the template, named,
 * or the app announcement still waiting for its store links. The values the
 * server fills in (the stamp target) are resolved first, as the send does.
 */
async function preview(
  c: CampaignEmail,
): Promise<{ html: string } | { error: string }> {
  try {
    const serverVars = await campaignServerVars(c.template);
    return {
      html: previewCampaignEmail(c, { name: "Örnek Üye" }, serverVars).html,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function CampaignMailDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole("newsletter");
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const c = await getCampaignEmail(id);
  if (!c) notFound();

  const isDraft = c.status === "draft";
  const sendable = canSendCampaign(c.status);
  const resumable = canResumeCampaign(c.status);
  const count =
    sendable || resumable
      ? await campaignAudienceCount(c.audience, c.template)
      : null;
  const rendered = await preview(c);
  const templateLabel = CAMPAIGN_MAIL_TEMPLATE_LABELS[c.template] ?? c.template;
  const audienceLabel = CAMPAIGN_MAIL_AUDIENCE_LABELS[c.audience] ?? c.audience;

  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5">
      <BackLink href={LIST_PATH}>Kampanyalar</BackLink>
      <PageHeader
        title={c.subject || "Kampanya"}
        description={`${templateLabel} · ${audienceLabel}`}
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
              appLinksReady={hasAppLinks()}
            />
          ) : (
            <StoredFields c={c} />
          )}
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-6">
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className={EYEBROW} style={MONO_STYLE}>
                Durum
              </h2>
              <CampaignStatusPill status={c.status} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {!isDraft && (
                <>
                  <dt className={DT}>Alıcı</dt>
                  <dd>{c.total}</dd>
                  <dt className={DT}>Gönderildi</dt>
                  <dd>{c.sentCount}</dd>
                  <dt className={DT}>Başarısız</dt>
                  <dd>{c.failedCount}</dd>
                </>
              )}
              {isDraft && c.scheduledAt && (
                <>
                  <dt className={DT}>Zamanlandı</dt>
                  <dd>{formatDateTime(c.scheduledAt)}</dd>
                </>
              )}
              {c.queuedAt && (
                <>
                  <dt className={DT}>Kuyruk</dt>
                  <dd>{formatDateTime(c.queuedAt)}</dd>
                </>
              )}
              {c.sentAt && (
                <>
                  <dt className={DT}>Bitti</dt>
                  <dd>{formatDateTime(c.sentAt)}</dd>
                </>
              )}
              <dt className={DT}>Oluşturan</dt>
              <dd className="truncate">
                {c.createdBy || "-"}
                {c.createdAt ? ` · ${formatDateTime(c.createdAt)}` : ""}
              </dd>
              {c.sourcePostId && (
                <>
                  <dt className={DT}>Kaynak</dt>
                  <dd>
                    <Link
                      href={`/admin/mobil/gonderiler/${c.sourcePostId}`}
                      className={TEXT_LINK}
                    >
                      Mobil gönderi
                    </Link>
                  </dd>
                </>
              )}
            </dl>
            {c.lastError && (
              <p
                role="alert"
                className="mt-3 text-xs text-[var(--admin-danger-ink)]"
              >
                {c.lastError}
              </p>
            )}
            {isDraft && c.scheduledAt && (
              <p className={NOTE}>
                Bu taslak zamanı geldikten sonraki ilk görev turunda (genelde
                birkaç saat içinde) kendiliğinden kuyruğa alınır. Beklemek
                istemezsen aşağıdan şimdi gönderebilirsin.
              </p>
            )}
            {resumable && (
              <p className={NOTE}>
                Gönderim sürüyor ya da yarım kaldı; kalan partileri günlük görev
                tamamlar. Beklemek istemezsen aşağıdan sürdür - kimse iki kez
                almaz.
              </p>
            )}
          </Card>

          <Card>
            <h2 className={`mb-3 ${EYEBROW}`} style={MONO_STYLE}>
              Test
            </h2>
            <p className="mb-3 text-xs text-[var(--admin-text-soft)]">
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
              <h2 className={`mb-3 ${EYEBROW}`} style={MONO_STYLE}>
                Gönderim
              </h2>
              <p className="mb-1 text-sm">{audienceLabel}</p>
              <p className="mb-3 text-xs text-[var(--admin-text-soft)]">
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
                <p className={NOTE}>
                  Kaydedilmemiş değişiklik varsa önce &ldquo;Taslağı
                  kaydet&rdquo;. Kuyruğa alınan kampanya bir daha düzenlenemez.
                </p>
              )}
            </Card>
          )}
        </aside>
      </div>

      {/* "Kime gitti": who the queued or sent campaign reached, row by row.
          Under 6563 the proof is the sender's to produce, and three counters
          named nobody. A draft has sent nothing. */}
      {!isDraft && (
        <CampaignSendLog
          campaignId={c.id}
          searchParams={sp}
          pathname={`${LIST_PATH}/${encodeURIComponent(c.id)}`}
        />
      )}

      <Card className="mt-4">
        <h2 className={`mb-3 ${EYEBROW}`} style={MONO_STYLE}>
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
            className="h-[900px] w-full rounded-lg border border-[var(--admin-border)] bg-white"
          />
        ) : (
          <p role="alert" className="text-sm text-[var(--admin-warning)]">
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
      <h2 className={`mb-3 ${EYEBROW}`} style={MONO_STYLE}>
        İçerik
      </h2>
      <p className="mb-4 text-xs text-[var(--admin-text-soft)]">
        Kuyruğa alınan kampanya düzenlenemez: gönderim defteri bu alanlarla
        kuruldu ve bir yeniden deneme aynı mesaj olmak zorunda.
      </p>
      {rows.length === 0 && (
        <p className="text-sm text-[var(--admin-text-soft)]">
          Bu şablon sabit metinlidir; doldurulan alan yok. Gönderilen ileti
          aşağıdaki önizlemededir.
        </p>
      )}
      <dl className="grid gap-3 text-sm">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className={EYEBROW} style={MONO_STYLE}>
              {r.label}
            </dt>
            <dd className="break-words whitespace-pre-wrap">{r.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

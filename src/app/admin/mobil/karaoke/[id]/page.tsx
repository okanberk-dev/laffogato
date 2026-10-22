import Link from "next/link";
import { notFound } from "next/navigation";

import {
  PageHeader,
  formatDateTime,
  formatTRY,
} from "@/components/admin/forms";
import { InvoiceCard } from "@/components/admin/invoice-card";
import {
  KaraokeMakeGoodHour,
  KaraokeMakeGoodPaid,
} from "@/components/admin/karaoke-make-good-dialog";
import {
  KaraokeActions,
  KaraokeAttentionNotices,
  KaraokeBadges,
} from "@/components/admin/karaoke-panel";
import {
  KeyValueGrid,
  PageShell,
  Section,
  Timeline,
  type KeyValueItem,
} from "@/components/admin/ui";
import { MONO_STYLE, NUMERIC_STYLE } from "@/components/admin/ui/styles";
import { requireRole } from "@/lib/admin/auth";
import { listKaraokeAudit } from "@/lib/admin/karaoke-audit";
import {
  channelLabel,
  KARAOKE_BACK_PARAM,
  karaokeBackHref,
  karaokeBillableMinor,
  karaokeDetailHref,
  karaokeHistory,
  karaokeRowView,
  makeGoodHourMarketValue,
  maskPaymentRef,
  moneyOf,
  refundAmountMinor,
  refundOwedNowMinor,
  staffReleasedIds,
  unverifiedReleaseIds,
  type KaraokeAuditRow,
} from "@/lib/admin/karaoke-panel";
import { firstParam } from "@/lib/admin/list-params";
import { canAccess } from "@/lib/admin/roles";
import { getSettings } from "@/lib/admin/store";
import { karaokeTaxRate } from "@/lib/utils/kdv";
import { earsivConfigStatus } from "@/lib/invoice/config";
import { getInvoiceForSource } from "@/lib/invoice/store";
import { KARAOKE_ROOM_DOC } from "@/lib/legal/content-karaoke";
import {
  getMakeGoodHourFor,
  getReservation,
  listReservationsForDate,
} from "@/lib/mobile/karaoke";
import { DEFAULT_KARAOKE_RULES } from "@/lib/mobile/karaoke-core";
import { formatReservationDate } from "@/lib/mobile/karaoke-format";
import {
  isPartialRefund,
  karaokeCancelDeadline,
  karaokeCancelPolicyOf,
  karaokeRulesOf,
} from "@/lib/mobile/karaoke-time";
import { istanbulClock } from "@/lib/mobile/venue";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const ID_RE = /^krk-\d{1,12}$/;

/** The booking id from the path, or null for anything else ("%E0" too). */
function readId(raw: string): string | null {
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return ID_RE.test(id) ? id : null;
}

export async function generateMetadata({ params }: PageProps) {
  const id = readId((await params).id);
  return { title: id ? `Admin · Karaoke ${id}` : "Admin · Karaoke" };
}

/**
 * The documents a booking's consent names, by title rather than slug
 * (KARAOKE_CONSENT_DOCS); a slug the panel does not know stays as it is.
 * The stored consent record keeps the slugs.
 */
const DOCUMENT_TITLES: Record<string, string> = {
  [KARAOKE_ROOM_DOC.slug]: KARAOKE_ROOM_DOC.title,
};

/** The boxes a paid booking ticks (KARAOKE_CONFIRMATIONS), for a reader. */
const CONFIRMATION_LABELS: Record<string, string> = {
  "on-bilgilendirme": "Ön bilgilendirme",
  "hizmet-sozlesmesi": "Mesafeli hizmet sözleşmesi",
  "kvkk-aydinlatma": "Aydınlatma metni okundu",
};

function when(iso: string | undefined): string {
  return iso ? formatDateTime(iso) : "";
}

/**
 * One karaoke booking (Filament's view page): what, who, the money and its
 * evidence, the confirmations, and its history from the audit log; every
 * action the list offers, as buttons. Personel sees all of it and does the
 * non-money actions; the buyer's IP and browser show only to someone who
 * may move money, who is also the one answering a chargeback.
 */
/**
 * The booking's audit rows, or null when they could not be read: the page
 * stands without its history (admin audit KAR-15) instead of taking the
 * money actions down with it.
 */
async function readAudit(id: string): Promise<KaraokeAuditRow[] | null> {
  try {
    return await listKaraokeAudit(id);
  } catch (err) {
    console.error("[admin/karaoke] geçmiş okunamadı", err);
    return null;
  }
}

/** `day` (YYYY-MM-DD) plus `days` calendar days. */
function addIstanbulDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, m - 1, d + Math.max(0, days)))
    .toISOString()
    .slice(0, 10);
}

export default async function KaraokeReservationPage({
  params,
  searchParams,
}: PageProps) {
  const session = await requireRole("karaoke");
  const id = readId((await params).id);
  if (!id) notFound();
  const r = await getReservation(id);
  if (!r) notFound();
  const back = karaokeBackHref(
    firstParam(await searchParams, KARAOKE_BACK_PARAM),
  );

  const now = new Date();
  const canRefund = canAccess("refunds", session.role);
  const [sameDay, settings, auditRead, makeGoodHour, madeGood, invoiceRead] =
    await Promise.all([
      listReservationsForDate(r.date),
      getSettings(),
      readAudit(r.id),
      // The free hour given for this booking, and the booking a free hour
      // makes good (karaoke terms §8).
      r.makeGoodUntil ? getMakeGoodHourFor(r.id) : Promise.resolve(null),
      r.makeGoodFor ? getReservation(r.makeGoodFor) : Promise.resolve(null),
      // The e-Arşiv invoice of a paid evening (docs/EARSIV.md); a failed
      // read says so on its card.
      getInvoiceForSource("karaoke", r.id).then(
        (row) => ({ row, failed: false }),
        (err: unknown) => {
          console.error("[admin/karaoke] e-Arşiv fatura okunamadı", err);
          return { row: null, failed: true };
        },
      ),
    ]);
  const audit = auditRead ?? [];
  // A released hold whose history is unreadable may have been let go
  // without the POS's answer: it is never called unpaid (rule 29).
  const releaseUnknown =
    !auditRead && r.status === "cancelled" && moneyOf(r) === "expired";
  const unverified = releaseUnknown
    ? new Set([r.id])
    : unverifiedReleaseIds(audit);
  const view = karaokeRowView(
    r,
    {
      today: istanbulClock(now).date,
      now,
      prepay: settings.karaokePrepay,
      canRefund,
      staffReleased: staffReleasedIds(audit),
      unverified,
    },
    sameDay,
  );
  const email = r.contactEmail || r.customerEmail;
  const consent = r.legalConsent ?? null;
  const memberHref =
    !r.guest && canAccess("customers", session.role)
      ? `/admin/musteriler/${encodeURIComponent(r.customerEmail)}`
      : null;

  const booking: KeyValueItem[] = [
    {
      label: "Kod",
      value: <span style={NUMERIC_STYLE}>{r.id}</span>,
      hint: "Girişte sorulan kod",
    },
    { label: "Tarih", value: view.day },
    { label: "Saat", value: view.time },
    { label: "Süre · kişi", value: `${r.hours} saat · ${r.guests} kişi` },
    { label: "Durum", value: view.statusLabel },
    { label: "Alındı", value: when(r.createdAt) },
    { label: "Son değişiklik", value: when(r.updatedAt) },
    { label: "Not", value: r.note, full: true },
  ];

  const contact: Array<KeyValueItem | false> = [
    { label: "Ad", value: r.customerName },
    {
      label: "E-posta",
      value: email ? (
        <a
          href={`mailto:${email}`}
          className="underline underline-offset-4 hover:text-[var(--admin-primary)]"
        >
          {email}
        </a>
      ) : (
        ""
      ),
    },
    {
      label: "Telefon",
      value: r.contactPhone ? (
        <a
          href={`tel:${r.contactPhone}`}
          className="underline underline-offset-4 hover:text-[var(--admin-primary)]"
          style={MONO_STYLE}
        >
          {r.contactPhone}
        </a>
      ) : (
        ""
      ),
      hint: r.contactPhone
        ? undefined
        : "Uygulamadan gelen rezervasyonda telefon olmaz.",
    },
    {
      label: "Hesap",
      value: r.guest ? (
        "Üyeliksiz (misafir)"
      ) : memberHref ? (
        <Link
          href={memberHref}
          className="underline underline-offset-4 hover:text-[var(--admin-primary)]"
        >
          {r.customerEmail}
        </Link>
      ) : (
        r.customerEmail
      ),
      hint: r.guest
        ? "Rezervasyon e-postadaki imzalı bağlantıyla yönetilir."
        : "Üye hesabı",
    },
    {
      label: "İletişim izni",
      value: when(r.contactConsentAt),
    },
  ];

  // The rule the booking was made under (its snapshot); a row from before
  // the snapshot reads 2 hours / 0 % and the default sentences.
  const policy = karaokeCancelPolicyOf(r);
  const legacyPolicy =
    typeof r.freeCancelHours !== "number" ||
    typeof r.lateRefundPercent !== "number";
  const shareOwed = view.money === "refunding" && isPartialRefund(r);
  const resaleOwed = shareOwed && (r.resaleRefundMinor ?? 0) > 0;
  const rules = karaokeRulesOf(r);
  const cancelRule: KeyValueItem[] = [
    {
      label: "Ücretsiz iptal süresi",
      value:
        policy.freeCancelHours > 0
          ? `${policy.freeCancelHours} saat`
          : "0 saat (rezervasyon saatine kadar ücretsiz)",
    },
    {
      label: "Geç iptalde iade",
      value: (
        <>
          <span style={NUMERIC_STYLE}>%{policy.lateRefundPercent}</span>
          {policy.lateRefundPercent > 0 ? null : " (geç iptal kabul edilmez)"}
        </>
      ),
      hint: "Rezervasyon saatinden önce; gelmeyene iade yok.",
    },
    {
      label: "Tam iade için son an",
      value: when(karaokeCancelDeadline(r).toISOString()),
      hint: "Bu an da dâhil.",
    },
    {
      label: "Müşterinin gördüğü kural",
      value: (
        <span className="grid gap-1">
          <span>{rules[0]}</span>
          <span>{rules[1]}</span>
        </span>
      ),
      full: true,
    },
  ];

  // An evening that is over: what the köşk keeps is what is invoiced
  // (ASK-KAR-KDV), at the booking's own rate (its snapshot, 17 Eki 2026).
  const billable = karaokeBillableMinor(r, now);
  const billRate =
    typeof r.taxRatePct === "number"
      ? r.taxRatePct
      : karaokeTaxRate(settings.taxRates);

  const payment: Array<KeyValueItem | false> = [
    {
      label: "Ödeme durumu",
      value: view.paymentLabel,
      hint: releaseUnknown
        ? "Geçmiş okunamadı: saatin POS'a sorularak bırakılıp bırakılmadığı denetlenemedi. PayNkolay panelinde bu rezervasyona başarılı bir ödeme varsa tutarı oradan iade et."
        : view.money === "expired" && unverified.has(r.id)
          ? "POS'a sorulamadan saat bırakıldı. PayNkolay panelinde bu rezervasyona başarılı bir ödeme varsa tutarı oradan iade et."
          : undefined,
    },
    {
      label: "Tutar",
      value: <span style={NUMERIC_STYLE}>{formatTRY(r.totalMinor)}</span>,
      hint:
        r.discountMinor > 0 ? (
          <span style={NUMERIC_STYLE}>
            Liste {formatTRY(r.priceMinor)} · indirim{" "}
            {formatTRY(r.discountMinor)}
          </span>
        ) : undefined,
    },
    (r.paidMinor ?? 0) > 0 && {
      label: "Tahsil edilen",
      value: <span style={NUMERIC_STYLE}>{formatTRY(r.paidMinor ?? 0)}</span>,
    },
    { label: "Ödeme zamanı", value: when(r.paidAt) },
    shareOwed && {
      label: resaleOwed
        ? "İade edilecek (yeniden satılan saat)"
        : "İade edilecek (geç iptal)",
      value: (
        <span style={NUMERIC_STYLE}>{formatTRY(refundOwedNowMinor(r))}</span>
      ),
      hint: resaleOwed
        ? `Geç iptal edilen saat başka bir misafire satıldı; o saat için misafirde kalan tutar. PayNkolay panelinden iade et, sonra "Elle iade edildi".`
        : `Kurala göre %${policy.lateRefundPercent}. PayNkolay panelinden iade et, sonra "Elle iade edildi".`,
    },
    shareOwed &&
      (r.refundSettledMinor ?? 0) > 0 && {
        label: "Daha önce iade edilen",
        value: (
          <span style={NUMERIC_STYLE}>
            {formatTRY(r.refundSettledMinor ?? 0)}
          </span>
        ),
        hint: "Elle kaydedilmişti; yeniden iade etme.",
      },
    (r.resoldHours ?? []).length > 0 && {
      label: "Yeniden satılan saatler",
      value: (r.resoldHours ?? [])
        .map((h) => `${String(h).padStart(2, "0")}:00`)
        .join(", "),
      hint: `Bunlar için misafirde kalan tutardan ${formatTRY(r.resaleRefundMinor ?? 0)} iade edildi ya da edilecek.`,
    },
    view.money === "refunded" && {
      label: "İade edilen",
      value: (
        <span style={NUMERIC_STYLE}>{formatTRY(refundAmountMinor(r))}</span>
      ),
    },
    Boolean(r.refundedAt) && {
      label: "İade zamanı",
      value: when(r.refundedAt),
    },
    billable !== null && {
      label: `Faturalanacak tutar (KDV %${billRate} dahil)`,
      value: <span style={NUMERIC_STYLE}>{formatTRY(billable)}</span>,
      hint:
        billable > 0
          ? "Köşkte kalan tutar: e-Arşiv fatura rezervasyon saati bittikten sonra, en geç 7 gün içinde kesilir."
          : "Tamamı iade edildi ya da edilecek: fatura kesilmez.",
    },
    { label: "Kanal", value: channelLabel(r.channel) },
    view.money === "pending" && {
      label: "Ödeme sayfası kapanır",
      value: when(r.paymentDueAt),
    },
    {
      label: "POS referansı",
      value: r.paymentRef ? (
        <span style={NUMERIC_STYLE}>{maskPaymentRef(r.paymentRef)}</span>
      ) : (
        ""
      ),
      hint: r.paymentRef
        ? "Ortası gizli. PayNkolay panelinde rezervasyon kodu, tarih ve tutarla bul."
        : undefined,
    },
  ];

  // The köşk's late cancel made good (karaoke terms §8): its amount, last
  // day and how it was used; on the free hour, the booking it makes good
  // and the value the köşk declares KDV on (KDV K. m.5, m.27/1).
  const today = istanbulClock(now).date;
  const roomRules = settings.mobileApp?.karaoke ?? DEFAULT_KARAOKE_RULES;
  const makeGood: Array<KeyValueItem | false> =
    view.makeGood === "none"
      ? []
      : [
          {
            label: "Telafi",
            value: (
              <span style={NUMERIC_STYLE}>
                {formatTRY(r.makeGoodMinor ?? 0)}
              </span>
            ),
            hint: "Geç iptalde misafirde kalacak tutar kadar.",
          },
          {
            label: "Ücretsiz saat için son gün",
            value: formatReservationDate(r.makeGoodUntil ?? ""),
            hint: "Ödeme seçeneğinin son günü yok.",
          },
          {
            label: "Durum",
            value:
              view.makeGood === "open" ? (
                "Açık: misafir henüz seçmedi"
              ) : view.makeGood === "paid" ? (
                <span style={NUMERIC_STYLE}>
                  Banka hesabına ödendi: {formatTRY(r.makeGoodPaidMinor ?? 0)},{" "}
                  {formatReservationDate(r.makeGoodPaidOn ?? "")}
                </span>
              ) : makeGoodHour ? (
                <Link
                  href={karaokeDetailHref(makeGoodHour.id)}
                  className="underline underline-offset-4 hover:text-[var(--admin-primary)]"
                >
                  Telafi saati verildi: {makeGoodHour.id.toUpperCase()}
                </Link>
              ) : (
                "Telafi saati verildi"
              ),
          },
        ];
  const makeGoodProps = {
    id: r.id,
    amount: formatTRY(r.makeGoodMinor ?? 0),
    // "2000,00": what parseMoneyInput reads back (the order refund form's).
    amountInput: ((r.makeGoodMinor ?? 0) / 100).toFixed(2).replace(".", ","),
    hours: r.hours,
    until: formatReservationDate(r.makeGoodUntil ?? ""),
    today,
    // The guest asks by the last day (karaoke terms §8: "6 ay içinde ...
    // ayırtabilirsiniz"); the hour itself is any day the room's calendar
    // is open, as for every booking (the server checks the same window).
    lastDay: addIstanbulDays(today, roomRules.bookingWindowDays),
    firstHour: roomRules.firstHour,
    closeHour: roomRules.closeHour,
  };
  // The free hour's market value, on which the köşk declares KDV.
  const marketValue = makeGoodHourMarketValue(
    settings.karaokeHourlyMinor,
    r.hours,
    billRate,
  );
  const madeGoodItems: KeyValueItem[] = r.makeGoodFor
    ? [
        {
          label: "Telafi edilen rezervasyon",
          value: madeGood ? (
            <Link
              href={karaokeDetailHref(madeGood.id)}
              className="underline underline-offset-4 hover:text-[var(--admin-primary)]"
            >
              {madeGood.id.toUpperCase()}
            </Link>
          ) : (
            r.makeGoodFor.toUpperCase()
          ),
        },
        {
          label: "Emsal bedel",
          value: (
            <span style={NUMERIC_STYLE}>
              {formatTRY(marketValue.amountMinor)}
            </span>
          ),
          hint: marketValue.note,
        },
      ]
    : [];

  const consents: Array<KeyValueItem | false> = consent
    ? [
        { label: "Onay zamanı", value: when(consent.acceptedAt) },
        { label: "Sürüm", value: consent.version },
        {
          label: "Belgeler",
          value: (consent.documents ?? []).map((slug, i) => (
            <span key={slug}>
              {i > 0 ? ", " : null}
              {DOCUMENT_TITLES[slug] ? (
                <a
                  href={`/hukuk/${encodeURIComponent(slug)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-[var(--admin-primary)]"
                >
                  {DOCUMENT_TITLES[slug]}
                </a>
              ) : (
                <span style={MONO_STYLE}>{slug}</span>
              )}
            </span>
          )),
          hint: "Belgenin bugünkü metni açılır; onaylanan sürüm yukarıda.",
        },
        {
          label: "İşaretlenen kutular",
          value: (consent.confirmations ?? [])
            .map((c) => CONFIRMATION_LABELS[c] ?? c)
            .join(", "),
        },
        {
          label: "Ekran",
          value:
            consent.surface === "app"
              ? "Uygulama"
              : consent.surface === "web"
                ? "Web"
                : "",
        },
        canRefund && { label: "IP", value: consent.ip ?? "", mono: true },
        canRefund && {
          label: "Tarayıcı",
          value: consent.userAgent ?? "",
          full: true,
        },
      ]
    : [];

  return (
    <PageShell width="detail">
      <Link
        href={back}
        className="mb-4 inline-flex min-h-[44px] items-center text-sm text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
      >
        ← Karaoke rezervasyonları
      </Link>

      <PageHeader
        meta={<span style={MONO_STYLE}>{r.id}</span>}
        title={`${view.day}, ${view.time}`}
        description={`${r.customerName || "İsimsiz"} · ${r.guests} kişi`}
        badges={<KaraokeBadges view={view} />}
        action={<KaraokeActions view={view} layout="page" />}
      />

      <div className="flex flex-col gap-6">
        <KaraokeAttentionNotices view={view} />

        <Section title="Rezervasyon">
          <KeyValueGrid items={booking} columns={3} />
        </Section>

        <Section
          title="İletişim"
          description={
            r.guest
              ? "Üyeliksiz rezervasyon: bilgiler formdan."
              : "Üye rezervasyonu."
          }
        >
          <KeyValueGrid items={contact} />
        </Section>

        <Section title="Ödeme">
          <KeyValueGrid items={payment} columns={3} />
        </Section>

        {view.makeGood !== "none" ? (
          <Section
            title="Telafi"
            description="Köşk, misafirin ücretsiz iptal süresi geçtikten sonra kendi sebebiyle iptal etti: tam iadeye ek olarak misafir ya aynı uzunlukta ücretsiz bir saat ya da bu tutarın kendi banka hesabına ödenmesini seçer. Biri kullanılınca diğeri kapanır."
          >
            <KeyValueGrid items={makeGood} columns={3} />
            {view.plan.makeGoodHour || view.plan.makeGoodPaid ? (
              <div className="mt-4 flex flex-wrap items-start gap-2">
                {view.plan.makeGoodHour ? (
                  <KaraokeMakeGoodHour
                    {...makeGoodProps}
                    variant="primary"
                    hourDisabledReason={view.plan.makeGoodHour.disabledReason}
                  />
                ) : null}
                {view.plan.makeGoodPaid ? (
                  <KaraokeMakeGoodPaid
                    {...makeGoodProps}
                    variant="ghost"
                    paidDisabledReason={view.plan.makeGoodPaid.disabledReason}
                  />
                ) : null}
              </div>
            ) : null}
          </Section>
        ) : null}

        {r.makeGoodFor ? (
          <Section
            title="Telafi saati"
            description="Köşkün geç iptal ettiği bir rezervasyon için verilen ücretsiz saat."
          >
            <KeyValueGrid items={madeGoodItems} columns={3} />
          </Section>
        ) : null}

        <Section
          title="İptal kuralı"
          description={
            legacyPolicy
              ? "Kural kaydı tutulmadan önce alınmış rezervasyon: o günün kuralı (2 saat, %0) geçerli."
              : "Rezervasyon anındaki kural; panelde sonradan yapılan değişiklik bu rezervasyonu etkilemez. Köşk iptal ederse her zaman tamamı iade edilir."
          }
        >
          <KeyValueGrid items={cancelRule} columns={3} />
        </Section>

        {consent ? (
          <Section
            title="Onaylar"
            description="Ödemeden önce işaretlenen kutular: ön bilgilendirme, sözleşme ve aydınlatma metni."
          >
            <KeyValueGrid items={consents} />
          </Section>
        ) : (
          // Nothing to list: one line, not a card of its own.
          <p className="px-1 text-sm text-[var(--admin-text-soft)]">
            Onay kaydı yok: ön ödeme öncesi alınmış ya da köşkte ödenecek bir
            rezervasyon.
          </p>
        )}

        {moneyOf(r) === "paid" ||
        moneyOf(r) === "refunding" ||
        moneyOf(r) === "refunded" ||
        invoiceRead.row ? (
          <InvoiceCard
            row={invoiceRead.row}
            source={{ kind: "karaoke", id: r.id, label: r.id }}
            mode={earsivConfigStatus(process.env).mode}
            canManage={canAccess("invoices", session.role)}
            unread={invoiceRead.failed}
            now={now}
          />
        ) : null}

        <Section title="Geçmiş" description="Yeniden eskiye, köşk saatiyle.">
          {auditRead ? null : (
            <p
              role="status"
              className="mb-4 rounded-xl bg-[var(--admin-warning-soft)] px-4 py-3 text-sm text-[var(--admin-warning)]"
            >
              Geçmiş okunamadı; aşağıda yalnız rezervasyonun kendi kayıtları
              var. Sayfayı birazdan yenile.
            </p>
          )}
          <Timeline items={karaokeHistory(r, audit, { canRefund })} />
        </Section>
      </div>
    </PageShell>
  );
}

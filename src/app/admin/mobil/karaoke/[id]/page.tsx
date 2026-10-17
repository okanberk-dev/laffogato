import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDateTime, formatTRY } from "@/components/admin/forms";
import {
  KaraokeActions,
  KaraokeAttentionNotices,
  KaraokeBadges,
} from "@/components/admin/karaoke-panel";
import {
  KeyValueGrid,
  Section,
  Timeline,
  type KeyValueItem,
} from "@/components/admin/ui";
import { MONO_STYLE } from "@/components/admin/ui/styles";
import { requireRole } from "@/lib/admin/auth";
import { listKaraokeAudit } from "@/lib/admin/karaoke-audit";
import {
  channelLabel,
  KARAOKE_PANEL_PATH,
  karaokeHistory,
  karaokeRowView,
  maskPaymentRef,
  refundAmountMinor,
  staffReleasedIds,
} from "@/lib/admin/karaoke-panel";
import { canAccess } from "@/lib/admin/roles";
import { getSettings } from "@/lib/admin/store";
import { getReservation, listReservationsForDate } from "@/lib/mobile/karaoke";
import { istanbulClock } from "@/lib/mobile/venue";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
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
export default async function KaraokeReservationPage({ params }: PageProps) {
  const session = await requireRole("karaoke");
  const id = readId((await params).id);
  if (!id) notFound();
  const r = await getReservation(id);
  if (!r) notFound();

  const now = new Date();
  const canRefund = canAccess("refunds", session.role);
  const [sameDay, settings, audit] = await Promise.all([
    listReservationsForDate(r.date),
    getSettings(),
    listKaraokeAudit(r.id),
  ]);
  const view = karaokeRowView(
    r,
    {
      today: istanbulClock(now).date,
      now,
      prepay: settings.karaokePrepay,
      canRefund,
      staffReleased: staffReleasedIds(audit),
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
    { label: "Kod", value: r.id, mono: true, hint: "Girişte sorulan kod" },
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

  const payment: Array<KeyValueItem | false> = [
    { label: "Ödeme durumu", value: view.paymentLabel },
    {
      label: "Tutar",
      value: formatTRY(r.totalMinor),
      mono: true,
      hint:
        r.discountMinor > 0
          ? `${formatTRY(r.priceMinor)}, indirim ${formatTRY(r.discountMinor)}`
          : undefined,
    },
    (r.paidMinor ?? 0) > 0 && {
      label: "Tahsil edilen",
      value: formatTRY(r.paidMinor ?? 0),
      mono: true,
    },
    { label: "Ödeme zamanı", value: when(r.paidAt) },
    view.money === "refunded" && {
      label: "İade edilen",
      value: formatTRY(refundAmountMinor(r)),
      mono: true,
    },
    Boolean(r.refundedAt) && {
      label: "İade zamanı",
      value: when(r.refundedAt),
    },
    { label: "Kanal", value: channelLabel(r.channel) },
    view.money === "pending" && {
      label: "Ödeme sayfası kapanır",
      value: when(r.paymentDueAt),
    },
    {
      label: "POS referansı",
      value: maskPaymentRef(r.paymentRef),
      mono: true,
      hint: r.paymentRef
        ? "Ortası gizli. PayNkolay panelinde rezervasyon kodu, tarih ve tutarla bul."
        : undefined,
    },
  ];

  const consents: Array<KeyValueItem | false> = consent
    ? [
        { label: "Onay zamanı", value: when(consent.acceptedAt) },
        { label: "Sürüm", value: consent.version },
        {
          label: "Belgeler",
          value: (consent.documents ?? []).join(", "),
          mono: true,
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
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href={KARAOKE_PANEL_PATH}
        className="mb-4 inline-flex min-h-[44px] items-center text-sm text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
      >
        ← Karaoke rezervasyonları
      </Link>

      <header className="mb-6 flex flex-col gap-3">
        <div
          className="text-[10px] tracking-[0.22em] text-[var(--admin-text-mute)] uppercase"
          style={MONO_STYLE}
        >
          Karaoke · {r.id}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-text)] sm:text-3xl">
          {view.day}, {view.time}
        </h1>
        <p className="text-sm text-[var(--admin-text-soft)]">
          {r.customerName || "İsimsiz"} · {r.guests} kişi
        </p>
        <KaraokeBadges view={view} />
        <div className="flex flex-wrap items-start gap-2">
          <KaraokeActions view={view} layout="page" />
        </div>
      </header>

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

        <Section
          title="Onaylar"
          description="Ödemeden önce işaretlenen kutular: ön bilgilendirme, sözleşme ve aydınlatma metni."
        >
          {consent ? (
            <KeyValueGrid items={consents} />
          ) : (
            <p className="text-sm text-[var(--admin-text-soft)]">
              Onay kaydı yok: ön ödeme öncesi alınmış ya da köşkte ödenecek bir
              rezervasyon.
            </p>
          )}
        </Section>

        <Section title="Geçmiş" description="Yeniden eskiye, köşk saatiyle.">
          <Timeline items={karaokeHistory(r, audit)} />
        </Section>
      </div>
    </main>
  );
}

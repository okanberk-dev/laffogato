import { notFound } from "next/navigation";

import { BackLink } from "@/components/admin/back-link";
import { formatDateTime } from "@/components/admin/forms";
import {
  Badge,
  KeyValueGrid,
  Section,
  type KeyValueItem,
} from "@/components/admin/ui";
import { EYEBROW, MONO_STYLE } from "@/components/admin/ui/styles";
import { requireRole } from "@/lib/admin/auth";
import {
  confirmLinkState,
  NEWSLETTER_PATH,
  SUBSCRIBER_STATE_LABELS,
  SUBSCRIBER_STATE_TONES,
  sourceLabel,
  subscriberState,
} from "@/lib/admin/newsletter-list";
import {
  getNewsletterSubscriber,
  NEWSLETTER_CONFIRM_TTL_MS,
} from "@/lib/newsletter/store";

import { DeactivateSubscriber } from "../subscriber-actions-ui";

export const metadata = { title: "Admin · Bülten abonesi" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Subscriber ids are `nws-<time>-<random>`; anything else is not looked up. */
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

const STATE_HINT: Record<ReturnType<typeof subscriberState>, string> = {
  aktif: "Bülten bu adrese gider.",
  "onay-bekliyor":
    "Abone olmak istedi, e-postasındaki onay bağlantısına henüz basmadı. Basana kadar bülten gitmez.",
  pasif:
    "Bülten gitmez. Panelden geri açılamaz; kişi yeniden abone olup onaylamalı.",
};

function when(iso: string | undefined): string {
  return iso ? formatDateTime(iso) : "";
}

/**
 * One subscriber and the consent record behind them (admin audit PEO-14,
 * D37): when, from where and to which wording they said yes. Under 6563 the
 * burden of proving consent is the sender's; the wording used to be readable
 * only in a hover tooltip on the list. Read-only, plus "Pasifleştir". The
 * confirmation and unsubscribe tokens are never shown.
 */
export default async function SubscriberPage({ params }: PageProps) {
  await requireRole("newsletter");
  const { id } = await params;
  const s = ID_RE.test(id) ? await getNewsletterSubscriber(id) : null;
  if (!s) notFound();
  const state = subscriberState(s);
  const pending = state === "onay-bekliyor";
  const requestedAt = s.confirmRequestedAt ?? "";
  const link = confirmLinkState(
    requestedAt,
    NEWSLETTER_CONFIRM_TTL_MS,
    new Date().getTime(),
  );

  // KeyValueGrid skips a `false` row: "Çıkış" only once they left.
  const subscriber: Array<KeyValueItem | false> = [
    { label: "E-posta", value: <span className="break-all">{s.email}</span> },
    { label: "Ad", value: s.name },
    { label: "Kaynak", value: sourceLabel(s.source) },
    { label: "Kayıt", value: when(s.createdAt) },
    Boolean(s.unsubscribedAt) && {
      label: "Çıkış",
      value: when(s.unsubscribedAt),
    },
  ];

  const consent: KeyValueItem[] = s.consentAt
    ? [
        {
          label: "Onay zamanı",
          value: when(s.consentAt),
          hint: "İstanbul saatiyle.",
        },
        { label: "Onay IP'si", value: s.consentIp, mono: true },
        {
          label: "Onay verilen metin",
          value: s.consentText ? (
            <span className="whitespace-pre-wrap">{s.consentText}</span>
          ) : (
            ""
          ),
          full: true,
        },
      ]
    : [];
  if (pending) {
    consent.push(
      { label: "Onay isteği", value: when(requestedAt) },
      { label: "İsteğin IP'si", value: s.confirmRequestIp ?? "", mono: true },
      {
        label: "Onay bağlantısı",
        value: link.expired
          ? link.expiresAt
            ? `Süresi geçti (${when(link.expiresAt)})`
            : "Süresi geçti"
          : `${when(link.expiresAt ?? "")} tarihine kadar geçerli`,
        // Only the footer form mails a link; a member's own verification
        // confirms the request with no deadline (activatePendingNewsletter).
        hint: "Site altı formunun e-postayla gönderdiği bağlantı. Bu adresle açılmış üye hesabı e-postasını doğrularsa abonelik bağlantısız da onaylanır.",
      },
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <BackLink href={NEWSLETTER_PATH}>Bülten aboneleri</BackLink>

      <header className="mb-6 flex flex-col gap-3">
        <div className={EYEBROW} style={MONO_STYLE}>
          Bülten abonesi
        </div>
        <h1 className="text-2xl font-semibold tracking-tight break-all text-[var(--admin-text)] sm:text-3xl">
          {s.email}
        </h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--admin-text-soft)]">
          <Badge tone={SUBSCRIBER_STATE_TONES[state]} dot>
            {SUBSCRIBER_STATE_LABELS[state]}
          </Badge>
          {STATE_HINT[state]}
        </p>
        {s.isActive ? (
          <div>
            <DeactivateSubscriber subscriber={s} />
          </div>
        ) : null}
      </header>

      <div className="grid gap-6">
        <Section title="Abone">
          <KeyValueGrid items={subscriber} />
        </Section>

        <Section
          title="Onay kaydı (6563)"
          description="Şikâyette onayın varlığını göstermek gönderenin işi: ne zaman, nereden, hangi metne onay verildi."
        >
          {consent.length > 0 ? (
            <KeyValueGrid items={consent} />
          ) : (
            <p role="note" className="text-sm text-[var(--admin-warning)]">
              Bu abonenin onay kaydı yok. Kampanya yalnız onay kaydı olan
              abonelere çıkar, bu adrese gitmez; kişi yeniden abone olup
              e-postasından onaylarsa kayıt oluşur.
            </p>
          )}
        </Section>
      </div>
    </main>
  );
}

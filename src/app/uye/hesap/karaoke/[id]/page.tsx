import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountCard, AccountShell } from "@/components/uye/account-shell";
import {
  KaraokeReservationView,
  type KaraokeViewNotice,
} from "@/components/uye/karaoke-reservation-view";
import { requireCustomer } from "@/lib/customer/auth";
import { getReservation, paymentStatusOf } from "@/lib/mobile/karaoke";
import {
  KARAOKE_RESULT_NOTICES,
  KARAOKE_RETURN_NOTICES,
} from "@/lib/mobile/karaoke-notices";
import { ownsReservation } from "@/lib/mobile/karaoke-payment";
import { isKaraokeRef } from "@/lib/mobile/karaoke-ref";

import { cancelMyKaraokeAction, payMyKaraokeAction } from "../actions";

export const metadata = { title: "Karaoke rezervasyonu · L'Affogato" };
export const dynamic = "force-dynamic";

/**
 * One of the member's karaoke bookings. The id in the path finds the row;
 * it grants nothing: the row must be the signed-in member's own (verified
 * address, not a guest booking), or the page is a 404 like a missing one.
 */
export default async function KaraokeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    iptal?: string;
    sonuc?: string;
    hata?: string;
    odeme?: string;
  }>;
}) {
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const customer = await requireCustomer();
  if (!isKaraokeRef(id)) notFound();
  const now = new Date();
  const r = await getReservation(id);
  if (!r || !ownsReservation({ kind: "member", customer }, r, now)) notFound();

  const notice: KaraokeViewNotice | undefined =
    (q.sonuc && KARAOKE_RESULT_NOTICES[q.sonuc]) ||
    (q.hata && KARAOKE_RESULT_NOTICES[q.hata]) ||
    (q.odeme && r.status !== "cancelled"
      ? KARAOKE_RETURN_NOTICES[q.odeme]
      : undefined) ||
    undefined;
  const self = `/uye/hesap/karaoke/${encodeURIComponent(r.id)}`;

  return (
    <AccountShell customer={customer} active="karaoke">
      <div style={{ marginBottom: 14 }}>
        <Link
          href="/uye/hesap/karaoke"
          className="eyebrow"
          style={{ display: "inline-block" }}
        >
          ← Karaoke rezervasyonlarım
        </Link>
      </div>
      <AccountCard title="Karaoke rezervasyonu">
        <KaraokeReservationView
          r={{ ...r, paymentStatus: paymentStatusOf(r) }}
          now={now}
          hidden={{ id: r.id }}
          cancelAction={cancelMyKaraokeAction}
          payAction={payMyKaraokeAction}
          cancelHref={`${self}?iptal=1#karaoke-cancel-title`}
          backHref={self}
          confirming={q.iptal === "1"}
          notice={notice}
        />
      </AccountCard>
    </AccountShell>
  );
}

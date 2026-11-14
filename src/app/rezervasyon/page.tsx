import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Illustration } from "@/components/laffogato/illustration";
import { PixelConversion } from "@/components/laffogato/pixel-events";
import { SiteChrome } from "@/components/laffogato/site-chrome";
import Link from "@/components/link";
import {
  KaraokeReservationView,
  type KaraokeViewNotice,
} from "@/components/uye/karaoke-reservation-view";
import { getPublicSettings } from "@/lib/admin/store";
import { getActiveCustomer } from "@/lib/customer/auth";
import { karaokeConversion } from "@/lib/consent/meta-pixel";
import { karaokeDurableCopyAvailable } from "@/lib/legal/durable-copy-load";
import { getReservation, paymentStatusOf } from "@/lib/mobile/karaoke";
import { KARAOKE_LINK_COOKIE, karaokeLinkId } from "@/lib/mobile/karaoke-link";
import {
  KARAOKE_RETURN_NOTICES,
  karaokeNoticeFor,
} from "@/lib/mobile/karaoke-notices";
import { ownsReservation } from "@/lib/mobile/karaoke-payment";
import { isKaraokeRef } from "@/lib/mobile/karaoke-ref";
import { SITE } from "@/lib/seo/site";
import { footerSettings } from "@/lib/seo/contact";

import { cancelKaraokeByLinkAction, payKaraokeByLinkAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Karaoke rezervasyonun",
  robots: { index: false, follow: false },
  // The URL carries the booking's signed token: never hand it to another
  // site in a Referer header.
  referrer: "no-referrer",
};

interface PageProps {
  searchParams: Promise<{
    t?: string;
    ref?: string;
    odeme?: string;
    iptal?: string;
    sonuc?: string;
    hata?: string;
  }>;
}

/**
 * A karaoke booking for whoever holds its signed link (operator, 16 Eki
 * 2026: bookings without an account), and where a web payment return lands.
 *
 * Who sees what:
 * - `?t=<token>` (the e-mail) or the booking form's own cookie: the booking,
 *   its payment, the cancel step - once the token verifies against the row.
 * - the signed-in member who booked it: sent on to "Karaoke rezervasyonlarım".
 * - anyone else, including a forged return for some other id: a page that
 *   names nothing (no date, no name, no status) and points at the e-mail.
 *
 * Deliberately NOT under `/karaoke` (see karaoke-link.ts: the app claims that
 * path prefix as an Android App Link).
 */
export default async function KaraokeLinkPage({ searchParams }: PageProps) {
  const q = await searchParams;
  const settings = await getPublicSettings();
  const now = new Date();
  const ref = q.ref && isKaraokeRef(q.ref) ? q.ref : null;

  const jar = await cookies();
  const fromCookie = jar.get(KARAOKE_LINK_COOKIE)?.value ?? null;
  const cookieId = karaokeLinkId(fromCookie);
  const token =
    q.t ?? (fromCookie && (!ref || cookieId === ref) ? fromCookie : null);
  const tokenId = karaokeLinkId(token);

  let body: React.ReactNode = null;
  if (token && tokenId) {
    const r = await getReservation(tokenId).catch(() => null);
    if (r && ownsReservation({ kind: "link", token }, r, now)) {
      const notice: KaraokeViewNotice | undefined =
        (q.sonuc && karaokeNoticeFor(q.sonuc, r)) ||
        // A late-cancel refusal speaks this booking's own rule (its snapshot).
        (q.hata && karaokeNoticeFor(q.hata, r)) ||
        (q.odeme && r.status !== "cancelled"
          ? KARAOKE_RETURN_NOTICES[q.odeme]
          : undefined) ||
        undefined;
      const self = `/rezervasyon?t=${encodeURIComponent(token)}`;
      // The confirmed terms as a file, for a booking whose payment made them
      // a contract and whose recorded text the route can build (ASK-DURABLE;
      // never a link to a 404, review B); the download checks the same link
      // again (./sozlesme/route.ts). A failing check hides the link.
      const paymentStatus = paymentStatusOf(r);
      const contracted =
        paymentStatus === "paid" ||
        paymentStatus === "refunding" ||
        paymentStatus === "refunded";
      const contractHref =
        contracted &&
        (await karaokeDurableCopyAvailable(r).catch(() => false))
          ? `/rezervasyon/sozlesme?t=${encodeURIComponent(token)}`
          : undefined;
      // The payment's confirmation, reported to the Meta Pixel once and only
      // for a visitor who consented: the bank's return that the server
      // verified (`odeme=basarili`) on a row that is paid.
      const converted =
        q.odeme === "basarili" &&
        paymentStatus === "paid" &&
        r.status !== "cancelled";
      body = (
        <>
          {converted ? <PixelConversion {...karaokeConversion(r)} /> : null}
          <KaraokeReservationView
            r={{ ...r, paymentStatus }}
            now={now}
            hidden={{ t: token }}
            cancelAction={cancelKaraokeByLinkAction}
            payAction={payKaraokeByLinkAction}
            cancelHref={`${self}&iptal=1#karaoke-cancel-title`}
            backHref={self}
            confirming={q.iptal === "1"}
            notice={notice}
            contractHref={contractHref}
          />
        </>
      );
    }
  }

  if (!body && ref) {
    // A member coming back from the bank: their booking lives in the account.
    const customer = await getActiveCustomer();
    if (customer) {
      const r = await getReservation(ref).catch(() => null);
      if (r && ownsReservation({ kind: "member", customer }, r, now)) {
        const odeme = q.odeme === "basarili" ? "basarili" : "sonuc";
        redirect(
          `/uye/hesap/karaoke/${encodeURIComponent(ref)}?odeme=${odeme}`,
        );
      }
    }
  }

  return (
    <SiteChrome settings={footerSettings(settings)}>
      <div className="wrap karaoke-page">
        <div className="karaoke-link-page">
          <div className="karaoke-link-head">
            <div>
              <div className="eyebrow">Karaoke · rezervasyon</div>
              <h1 className="h2" style={{ marginTop: 12 }}>
                Karaoke rezervasyonun
              </h1>
            </div>
            <Illustration
              name="karaoke-room"
              width={220}
              className="karaoke-link-art illo-framed"
              sizes="(max-width: 620px) 120px, 180px"
              priority
            />
          </div>
          {body ?? (
            <div className="karaoke-mine">
              <p>
                {q.odeme === "basarili"
                  ? "Ödemen alındıysa rezervasyonun kesinleşti; ayrıntılar e-postanda."
                  : "Rezervasyonunun ayrıntıları ve iptal bağlantısı e-postanda."}
              </p>
              <p>Sorun olursa ara: {settings.phone || SITE.phone}.</p>
              <p style={{ marginTop: 16 }}>
                <Link href="/karaoke" className="btn btn-primary btn-sm">
                  Karaoke sayfasına git
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </SiteChrome>
  );
}

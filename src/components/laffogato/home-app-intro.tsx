import {
  STAMP_MIN_ORDER_MINOR,
  STAMP_STEP_MINOR,
} from "@/lib/mobile/loyalty-core";

import { AppStoreLinks } from "./app-links";
import { LafMark } from "./brand-mark";

/**
 * The home page's door into the app (#uygulama). Owner's brief, 6 Kas 2026:
 * a headline and a few sentences beside a phone, three benefit cards under
 * them, on a warm cream ground.
 *
 * The phone is drawn, not photographed: a short stack of the app's own
 * cards that tells the real flow at the köşk - the table's QR, an order, the
 * stage it is in, the stamp card, Kahve Modu. Only what the app does: table and pickup
 * ordering (the courier only while Mobil → Ayarlar offers it), order
 * stages, the stamp card at the panel's target. It is a picture of the
 * benefits listed under it, so it is hidden from assistive tech.
 *
 * The App Store button is the shared `AppStoreLinks` (src/lib/mobile/
 * app-store.ts): the iOS listing is live; no Android app is promised.
 */

/** The three cards under the phone. The courier is named only while it runs. */
export function appBenefits(stampTarget: number, courierEnabled: boolean) {
  const min = Math.round(STAMP_MIN_ORDER_MINOR / 100);
  const step = Math.round(STAMP_STEP_MINOR / 100);
  return [
    {
      key: "order",
      title: "Masadan sipariş",
      body: courierEnabled
        ? "Masadaki QR'ı okut ya da gel-al seç; Tuzla içi kurye de uygulamada."
        : "Masadaki QR'ı okut ya da gel-al seç; kafe menüsünün tamamı uygulamada.",
    },
    {
      key: "stamps",
      title: "Damga topla",
      body: `${min} TL'den itibaren başlayan her ${step} TL bir damga, ${stampTarget} damgada bir içecek bizden.`,
    },
    {
      key: "track",
      title: "Siparişini izle",
      body: "Hazırlanıyor, hazır: her adım uygulamada, istersen bildirimle.",
    },
  ] as const;
}

export function HomeAppIntro({
  stampTarget,
  courierEnabled,
}: {
  stampTarget: number;
  courierEnabled: boolean;
}) {
  // Four of the target filled, or one short of it on a very small card.
  const filled = Math.min(4, stampTarget - 1);
  return (
    <section
      className="app-intro-band"
      id="uygulama"
      aria-labelledby="app-intro-title"
    >
      <div className="wrap">
        <div className="app-intro">
          <div className="app-intro-copy reveal">
            <p className="app-intro-eyebrow">L&apos;Affogato uygulaması</p>
            <h2 id="app-intro-title" className="app-intro-title">
              Köşkün kahve kulübü, <span className="script">cebinde</span>
            </h2>
            <p className="app-intro-text">
              Masadan siparişini ver, hazırlanırken adım adım izle, her kahvede
              damganı topla. Karaoke odasını ayırtmak ve köşkteki kampanyaları
              ilk görmek de aynı uygulamada.
            </p>
            <AppStoreLinks className="app-intro-links" />
            <p className="app-intro-note">
              Sipariş, damga, masa QR&apos;ı ve karaoke Tuzla köşkü içindir.
            </p>
          </div>

          <div className="apm reveal r1" aria-hidden="true">
            <div className="apm-frame">
              <div className="apm-screen">
                <span className="apm-island" />
                <div className="apm-top">
                  <LafMark tone="green" height={22} />
                  <span className="apm-chip">Masa 4</span>
                </div>
                <p className="apm-hello">
                  Hoş geldin,
                  <strong>köşkte bir masa seç</strong>
                </p>
                <div className="apm-stack">
                  <div className="apm-card">
                    <span className="apm-ico">
                      <QrGlyph />
                    </span>
                    <span>
                      <strong>Masadaki QR&apos;ı okut</strong>
                      <span className="apm-sub">Masa 4 seçildi</span>
                    </span>
                  </div>
                  <div className="apm-card apm-card--me">
                    <span>
                      <strong>Latte · M · badem sütü</strong>
                      <span className="apm-sub">1 adet · masaya</span>
                    </span>
                  </div>
                  <div className="apm-card apm-card--status">
                    <span className="apm-live" />
                    <span className="apm-grow">
                      <strong>Siparişin hazırlanıyor</strong>
                      <span className="apm-steps">
                        <i className="on" />
                        <i className="on" />
                        <i />
                      </span>
                    </span>
                  </div>
                  <div className="apm-stamp">
                    <span className="apm-stamp-head">
                      <span>Damga kartın</span>
                      <strong className="tabular">
                        {filled}/{stampTarget}
                      </strong>
                    </span>
                    <span className="apm-stamp-row">
                      {Array.from({ length: stampTarget }, (_, i) => (
                        <i key={i} className={i < filled ? "on" : undefined} />
                      ))}
                    </span>
                    <span className="apm-sub">
                      {stampTarget - filled} damga sonra içecek bizden
                    </span>
                  </div>
                  <div className="apm-card apm-card--mode">
                    <span className="apm-ico">
                      <StoryGlyph />
                    </span>
                    <span>
                      <strong>Kahve Modu</strong>
                      <span className="apm-sub">
                        Günün modu fotoğrafına, Story&apos;ne
                      </span>
                    </span>
                  </div>
                </div>
                <div className="apm-tabbar">
                  <i />
                  <i className="on" />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          </div>
        </div>

        <ul className="app-benefits">
          {appBenefits(stampTarget, courierEnabled).map((b) => (
            <li key={b.key} className="app-benefit reveal">
              <span className="app-benefit-ico" aria-hidden="true">
                <BenefitGlyph kind={b.key} />
              </span>
              <h3>{b.title}</h3>
              <p>{b.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function QrGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StoryGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect
        x="6"
        y="3"
        width="12"
        height="18"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="11"
        r="2.75"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function BenefitGlyph({ kind }: { kind: "order" | "stamps" | "track" }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "order" ? (
        <>
          <path d="M5 8.25h11.5v4.25a5 5 0 0 1-5 5h-1.5a5 5 0 0 1-5-5V8.25Z" />
          <path d="M16.5 9.5h1.75a2.25 2.25 0 0 1 0 4.5H16.3" />
        </>
      ) : kind === "stamps" ? (
        <>
          <circle cx="12" cy="12" r="7.5" />
          <path d="m9 12.2 2 2 4-4.4" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 8v4.25l2.75 1.75" />
        </>
      )}
    </svg>
  );
}

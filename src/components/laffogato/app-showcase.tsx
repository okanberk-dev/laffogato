import Image from "next/image";
import type { ReactNode } from "react";

import { cx } from "./cx";

/**
 * The app, shown (22 Kas 2026; operator: "Uygulama mockuplarını da ekle
 * ... masadan da sipariş verebildiklerinin farkında olsunlar").
 *
 * Two screens are the app's own App Store screenshots (lafmobil
 * `store/screenshots/6.7-inch/01-ana-sayfa.jpg`, `02-menu.jpg`, 600px
 * webp in public/brand). The app's store set has no table screen, so the
 * middle phone draws it in markup from the app's own strings (lafmobil
 * `src/i18n/screens/table.ts`: "Masan: …", "Masaya servis", "Siparişin bu
 * masaya getirilir."). Nothing here shows a feature the app does not have,
 * a price, a rating or a download count.
 *
 * Every image is lazy and sized: the section sits far below the film, so
 * none of it joins the first paint.
 */

export function AppPhones({
  className,
  only,
}: {
  className?: string;
  /** `table` draws the table screen alone (the visit page). */
  only?: "table";
}) {
  if (only === "table") {
    return (
      <div className={cx("app-phones app-phones--one", className)}>
        <TablePhone />
      </div>
    );
  }
  return (
    <div className={cx("app-phones", className)}>
      <figure className="app-device app-device--side">
        <div className="app-device-screen">
          <Image
            src="/brand/app-screen-menu.webp"
            alt="Uygulamanın menü ekranı: kategoriler ve içecekler."
            width={600}
            height={1300}
            loading="lazy"
            unoptimized
          />
        </div>
        <figcaption className="t-micro">Menü</figcaption>
      </figure>
      <TablePhone lead />
      <figure className="app-device app-device--side">
        <div className="app-device-screen">
          <Image
            src="/brand/app-screen-home.webp"
            alt="Uygulamanın ana sayfası: sipariş düğmesi ve damga kartı."
            width={600}
            height={1300}
            loading="lazy"
            unoptimized
          />
        </div>
        <figcaption className="t-micro">Ana sayfa ve damga kartı</figcaption>
      </figure>
    </div>
  );
}

function TablePhone({ lead = false }: { lead?: boolean }) {
  return (
    <figure className={cx("app-device", lead && "app-device--lead")}>
      <div
        className="app-device-screen app-mock"
        role="img"
        aria-label="Uygulamada masadan sipariş: sepette seçilen içecekler, seçili masa ve Siparişi ver düğmesi."
      >
        <div className="app-mock-status" aria-hidden="true">
          <span>21:48</span>
          <span className="app-mock-island" />
          <span className="app-mock-signal" />
        </div>
        <div className="app-mock-body" aria-hidden="true">
          <p className="app-mock-title">Sepet</p>
          <p className="app-mock-chip">
            <span className="app-mock-dot" />
            Masan: Bahçe 3
          </p>
          <ul className="app-mock-rows">
            {MOCK_ROWS.map((r) => (
              <li key={r.name}>
                <span className={cx("app-mock-cup", r.tone)} />
                <span className="app-mock-name">{r.name}</span>
                <span className="app-mock-qty">
                  <i>−</i>
                  {r.qty}
                  <i>+</i>
                </span>
              </li>
            ))}
          </ul>
          <div className="app-mock-card">
            <p className="app-mock-card-k">Masaya servis</p>
            <p className="app-mock-card-v">Siparişin bu masaya getirilir.</p>
          </div>
          <p className="app-mock-cta">Siparişi ver</p>
        </div>
      </div>
      <figcaption className="t-micro">Masadan sipariş</figcaption>
    </figure>
  );
}

const MOCK_ROWS = [
  { name: "L'Affogato", qty: "1", tone: "is-brass" },
  { name: "Matcha Latte", qty: "2", tone: "is-sage" },
  { name: "Çilekli Matcha", qty: "1", tone: "is-rose" },
] as const;

/** The three steps of a table order, as the app runs them (pre-paid in the
    app; API-MOBILE §3, §22). */
const TABLE_STEPS = [
  {
    title: "QR'ı okut",
    body: "Masandaki QR kodunu telefonunun kamerasıyla okut; uygulama o masayla açılır.",
  },
  {
    title: "Seç ve öde",
    body: "Menünün tamamı uygulamada. İçeceğini seç, kartınla uygulamada öde; kasada sıra beklemezsin.",
  },
  {
    title: "Masana gelsin",
    body: "Siparişin bar ekranına düşer, hazır olunca masana getirilir. Kafe siparişin damga da kazandırır.",
  },
] as const;

function TableSteps() {
  return (
    <ol className="table-steps" role="list">
      {TABLE_STEPS.map((s, i) => (
        <li key={s.title}>
          <span className="table-steps-n t-label" aria-hidden="true">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div>
            <h3 className="t-title">{s.title}</h3>
            <p className="t-body">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The table-order band: charcoal, a picture on one side (the page's own:
 * a photograph on the home page, the drawn table screen on /ziyaret), the
 * three steps on the other. White on charcoal only (CLAUDE.md "Gri kömür
 * zemine yazılmaz").
 */
export function TableOrderBand({
  headingId,
  media,
  mediaSide = "start",
  children,
}: {
  headingId: string;
  media: ReactNode;
  /** `end` puts the picture after the text (and narrow: a phone). */
  mediaSide?: "start" | "end";
  children?: ReactNode;
}) {
  return (
    <section
      id="masadan-siparis"
      className="section section--dark table-order"
      data-ground="dark"
      aria-labelledby={headingId}
    >
      <div
        className={cx(
          "wrap table-order-grid",
          mediaSide === "end" && "table-order-grid--phone",
        )}
      >
        <div className="table-order-media">{media}</div>
        <div className="table-order-copy">
          <p className="t-label">Masadan sipariş</p>
          <h2 id={headingId} className="t-display">
            Yerinden kalkmadan sipariş ver
          </h2>
          <p className="t-body table-order-lede">
            Köşkte masana otur, masandaki QR kodunu okut. Sipariş ve ödeme
            uygulamada, içeceğin masanda.
          </p>
          <TableSteps />
          {children}
        </div>
      </div>
    </section>
  );
}

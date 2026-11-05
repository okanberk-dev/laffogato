import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  hasAnyAppLink,
} from "@/lib/mobile/app-store";

import { cx } from "./cx";

/**
 * The store buttons - the site's only door into the app.
 *
 * The listings come from src/lib/mobile/app-store.ts (the same pair the
 * e-mails use): the App Store listing is compiled in since the iOS app went
 * live (5 Kas 2026), Google Play's is read from NEXT_PUBLIC_PLAY_STORE_URL.
 * Each listing that exists gets a button; the one that does not yet is an
 * honest "yakında" line next to it, never a button that goes nowhere. With
 * neither, the whole block is that line. Setting the Play variable on Vercel
 * turns its button on everywhere; nothing else has to change.
 *
 * Text buttons, not Apple's and Google's badge artwork: the badges come with
 * their own licence terms, and a plain capsule in the house style says the
 * same thing.
 */
export function AppStoreLinks({
  tone = "light",
  className,
}: {
  /** `light` on porcelain, `dark` on the green blocks. */
  tone?: "light" | "dark";
  className?: string;
}) {
  if (!hasAnyAppLink()) {
    return (
      <SoonLine tone={tone} className={className}>
        Çok yakında App Store ve Google Play&apos;de.
      </SoonLine>
    );
  }
  return (
    <div className={cx("app-links", tone === "dark" && "on-dark", className)}>
      {APP_STORE_URL ? (
        <a
          className="store-btn"
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <PhoneGlyph />
          <span className="store-btn-text">
            <span className="store-btn-small">iPhone için</span>
            <span className="store-btn-big">App Store</span>
          </span>
        </a>
      ) : (
        <SoonLine tone={tone}>iPhone uygulaması yakında.</SoonLine>
      )}
      {PLAY_STORE_URL ? (
        <a
          className="store-btn"
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <PhoneGlyph />
          <span className="store-btn-text">
            <span className="store-btn-small">Android için</span>
            <span className="store-btn-big">Google Play</span>
          </span>
        </a>
      ) : (
        <SoonLine tone={tone}>Android uygulaması yakında.</SoonLine>
      )}
    </div>
  );
}

function SoonLine({
  tone,
  className,
  children,
}: {
  tone: "light" | "dark";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cx("app-links-soon", tone === "dark" && "on-dark", className)}
    >
      <span className="app-links-soon-dot" aria-hidden="true" />
      {children}
    </p>
  );
}

function PhoneGlyph() {
  return (
    <svg
      className="store-btn-glyph"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="6.5"
        y="2.75"
        width="11"
        height="18.5"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10.5 5.75h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17.6" r="0.9" fill="currentColor" />
    </svg>
  );
}

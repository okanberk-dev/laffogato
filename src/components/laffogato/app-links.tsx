import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  hasAppLinks,
} from "@/lib/mobile/app-store";

/**
 * The two store buttons - the site's only door into the app.
 *
 * The listings are read from NEXT_PUBLIC_APP_STORE_URL / _PLAY_STORE_URL
 * (src/lib/mobile/app-store.ts, the same pair the e-mails use), and like the
 * e-mails the pair is all or nothing: until both are set this renders an
 * honest "yakında" line instead of two buttons that go nowhere. Setting the
 * two variables on Vercel turns every app block on the site into real links;
 * nothing else has to change.
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
  if (!hasAppLinks()) {
    return (
      <p
        className={`app-links-soon${tone === "dark" ? " on-dark" : ""}${className ? ` ${className}` : ""}`}
      >
        <span className="app-links-soon-dot" aria-hidden="true" />
        Çok yakında App Store ve Google Play&apos;de.
      </p>
    );
  }
  return (
    <div
      className={`app-links${tone === "dark" ? " on-dark" : ""}${className ? ` ${className}` : ""}`}
    >
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
    </div>
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

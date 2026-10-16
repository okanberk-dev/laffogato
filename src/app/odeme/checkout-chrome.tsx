import { LafMark } from "@/components/laffogato/brand-mark";
import type { FooterSettings } from "@/components/laffogato/chrome";

/**
 * The checkout's own chrome: the mark, "Güvenli ödeme" and a way to reach a
 * person. No main nav, no footer link farm - the page has one job, like the
 * checkouts of the big Turkish shops.
 *
 * Every link here is a plain <a>, never next/link: leaving /odeme must be a
 * full page load. The checkout document runs under a policy that admits no
 * third party (src/proxy.ts), and the page the visitor goes to should get
 * its own policy and its own tags, not inherit this one.
 */
export function CheckoutChrome({
  settings,
  children,
}: {
  settings?: FooterSettings;
  children: React.ReactNode;
}) {
  const phone = settings?.phone?.trim() ?? "";
  const tel = phone.replace(/[^\d+]/g, "");
  return (
    <>
      <a href="#main" className="skip-link">
        İçeriğe geç
      </a>
      <header className="co-chrome">
        <div className="co-chrome-inner">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load on purpose: the checkout document keeps its own policy (checkout-chrome.tsx) */}
          <a
            href="/"
            className="co-chrome-brand"
            aria-label="L'Affogato ana sayfa"
          >
            <LafMark tone="duo" />
          </a>
          <span className="checkout-secure co-chrome-secure">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4.5 7V5.2a3.5 3.5 0 0 1 7 0V7" />
              <rect x="3" y="7" width="10" height="7" rx="2" />
            </svg>
            Güvenli ödeme
          </span>
          {tel ? (
            <a
              className="co-chrome-help"
              href={`tel:${tel}`}
              aria-label={`Yardım: ${phone}`}
            >
              <span className="co-chrome-help-label">Yardım</span>
              <span className="tabular co-chrome-help-number">{phone}</span>
            </a>
          ) : null}
        </div>
      </header>
      <main className="co-chrome-body" id="main">
        {children}
      </main>
      <footer className="co-chrome-foot">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load on purpose: the checkout document keeps its own policy (checkout-chrome.tsx) */}
        <a href="/magaza">Alışverişe dön</a>
        <a href="/hukuk/iade-ve-cayma" target="_blank" rel="noopener">
          İptal, iade ve cayma
        </a>
        <a href="/hukuk/kvkk-aydinlatma-metni" target="_blank" rel="noopener">
          KVKK aydınlatma
        </a>
        <span>© L&apos;Affogato</span>
      </footer>
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "@/components/link";
import {
  CONSENT_DENIED,
  CONSENT_VERSION,
  readConsent,
  writeConsent,
  type ConsentState,
} from "@/lib/consent/cookie";
import { CONSENT_OPEN_EVENT, pushConsentUpdate } from "@/lib/consent/script";

import { useClientValue } from "./use-client-value";
import { useDialog } from "./use-dialog";

type Choice = Omit<ConsentState, "decidedAt">;

const ALL_GRANTED: Choice = {
  version: CONSENT_VERSION,
  preferences: true,
  analytics: true,
  marketing: true,
};

const CATEGORIES: Array<{
  key: "preferences" | "analytics" | "marketing";
  title: string;
  body: string;
}> = [
  {
    key: "preferences",
    title: "Tercih çerezleri",
    body: "Dil, görünüm ve hatırlanan filtreler gibi seçimlerinizi saklar. Kapatırsanız site çalışır ama tercihleriniz her ziyarette sıfırlanır.",
  },
  {
    key: "analytics",
    title: "Analitik çerezler",
    body: "Hangi sayfaların işe yaradığını toplu ve anonim biçimde ölçer. Kimliğinizi tespit etmek için kullanılmaz.",
  },
  {
    key: "marketing",
    title: "Pazarlama çerezleri",
    body: "Reklamların ilginizi çekecek biçimde gösterilmesini ve kampanya sonuçlarının ölçülmesini sağlar.",
  },
];

/** What the site runs that the consent categories exist for. */
export interface ConsentTags {
  /** Google Tag Manager: analytics and marketing tags. */
  tagManager: boolean;
  /** The Meta Pixel: marketing only. */
  metaPixel?: boolean;
}

/** Whether a category has anything on the site to switch. */
function categoryShown(key: string, { tagManager, metaPixel }: ConsentTags) {
  if (key === "analytics") return tagManager;
  if (key === "marketing") return tagManager || metaPixel === true;
  return true;
}

/**
 * The marketing switch's own wording. With the Meta Pixel on, it names Meta
 * and says what a yes sends where: the panel is where the transfer abroad is
 * consented to (draft, awaiting the lawyer: docs/META-PIXEL.md).
 */
function marketingBody({ metaPixel }: ConsentTags): string {
  return metaPixel === true
    ? "Meta (Facebook ve Instagram) reklamlarının ilginizi çekecek kişilere gösterilmesini ve reklam sonuçlarının ölçülmesini sağlar. İzin verirseniz gezdiğiniz sayfalar ve rezervasyon, sipariş gibi işlemleriniz (kişisel bilgiler olmadan) Meta Platforms Ireland Ltd.'ye ve onun üzerinden yurt dışına aktarılır; Meta, siz izin verene kadar hiçbir istek almaz. İzni istediğiniz zaman buradan geri alabilirsiniz."
    : "Reklamların ilginizi çekecek biçimde gösterilmesini ve kampanya sonuçlarının ölçülmesini sağlar.";
}

/** The switches the panel shows: only what the site runs, preferences always. */
export function consentCategories(tags: ConsentTags): typeof CATEGORIES {
  return CATEGORIES.filter((c) => categoryShown(c.key, tags)).map((c) =>
    c.key === "marketing" ? { ...c, body: marketingBody(tags) } : c,
  );
}

/**
 * The choice as it is recorded. A category the panel did not show is never
 * recorded as a yes - not by "Tümünü kabul et", not from an older cookie the
 * panel was filled from. If a tag comes back, it asks: the consent version
 * moves with the tags (`consentVersionFor`), so no stored choice survives the
 * switch.
 */
export function recordedChoice(choice: Choice, tags: ConsentTags): Choice {
  return {
    ...choice,
    analytics: categoryShown("analytics", tags) && choice.analytics,
    marketing: categoryShown("marketing", tags) && choice.marketing,
  };
}

/** The banner's sentence about what runs only with the visitor's yes. */
export function bannerSentence({ tagManager, metaPixel }: ConsentTags): string {
  if (tagManager) {
    return "Sitenin çalışması için zorunlu çerezleri kullanıyoruz. Analitik ve pazarlama çerezleri ise yalnızca siz izin verirseniz çalışır.";
  }
  if (metaPixel === true) {
    return "Sitenin çalışması için zorunlu çerezleri kullanıyoruz. Tercih çerezleri ve reklam ölçümü için Meta Pixel (pazarlama çerezleri) ise yalnızca siz izin verirseniz çalışır.";
  }
  return "Sitenin çalışması için zorunlu çerezleri kullanıyoruz. Sitede analitik veya reklam çerezi yok; tercih çerezleri yalnızca siz izin verirseniz çalışır.";
}

/**
 * `tagManager`: whether Google Tag Manager runs on the site. Off (no Google
 * standard contract, 19 Ekim 2026) there are no analytics or ad tags of
 * Google's. `metaPixel`: whether the Meta Pixel runs (25 Ekim 2026), which
 * brings the marketing switch back and nothing else. With neither, the banner
 * and the panel speak of the necessary and preference cookies only and
 * "Tümünü kabul et" grants preferences alone (Çerez Politikası §7).
 */
export function CookieConsent({
  tagManager,
  metaPixel = false,
}: {
  tagManager: boolean;
  metaPixel?: boolean;
}) {
  const tags: ConsentTags = { tagManager, metaPixel };
  const categories = consentCategories(tags);
  // `null` = henüz okumadık; sunucu ile istemci HTML'i aynı kalsın diye ilk
  // render'da hiçbir şey basmıyoruz. The cookie is read once hydration is
  // done (useClientValue), not in a mount effect.
  const storedDecision = useClientValue<boolean | null>(
    () => readConsent() !== null,
    null,
  );
  // Set by commit(): the banner goes away on the click itself, whether or
  // not the panel was open to force a re-render.
  const [committed, setCommitted] = useState(false);
  const decided = storedDecision === null ? null : committed || storedDecision;
  const [panelOpen, setPanelOpen] = useState(false);
  // Only the panel reads the draft, and openPanel() refills it from the
  // cookie every time the panel opens.
  const [draft, setDraft] = useState<Choice>(CONSENT_DENIED);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const openPanel = useCallback(() => {
    const stored = readConsent();
    setDraft(
      stored
        ? {
            version: CONSENT_VERSION,
            preferences: stored.preferences,
            analytics: stored.analytics,
            marketing: stored.marketing,
          }
        : CONSENT_DENIED,
    );
    setPanelOpen(true);
  }, []);

  // Footer'daki "Çerez Tercihleri" bağlantısı bu olayı yollar. Rızanın geri
  // alınabilmesi KVKK'nın şartı; bandı bir kez kapatmak son söz olamaz.
  useEffect(() => {
    window.addEventListener(CONSENT_OPEN_EVENT, openPanel);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, openPanel);
  }, [openPanel]);

  // A real modal: Escape, focus in and back to whatever opened it, Tab kept
  // inside, the page behind locked (it used to scroll under the wheel).
  useDialog(panelOpen, () => setPanelOpen(false), panelRef);

  const commit = useCallback(
    (choice: Choice) => {
      const shown = recordedChoice(choice, { tagManager, metaPixel });
      writeConsent(shown);
      pushConsentUpdate(shown);
      setCommitted(true);
      setPanelOpen(false);
    },
    [tagManager, metaPixel],
  );

  // Before hydration (`decided === null`) the banner is rendered, not
  // withheld: it is server HTML, painted with the page. Rendered only after
  // hydration it arrived seconds late on a slow phone and was the page's
  // largest paint. A visitor who has already decided never sees it - the
  // inline script in the root layout marks <html data-consent="set"> before
  // the first paint, the stylesheet hides the banner, and once hydrated this
  // component drops it.
  const bannerVisible = decided === null || (!decided && !panelOpen);

  return (
    <>
      {bannerVisible && (
        <div
          className="cookie-banner"
          data-pending={decided === null ? "" : undefined}
          role="region"
          aria-label="Çerez tercihleri"
        >
          <div className="cookie-banner-body">
            <p className="cookie-banner-title">Çerezler</p>
            <p className="cookie-banner-text">
              {bannerSentence(tags)} Ayrıntı için{" "}
              <Link href="/hukuk/cerez-politikasi">Çerez Politikası</Link> ve{" "}
              <Link href="/hukuk/kvkk-aydinlatma-metni">
                KVKK Aydınlatma Metni
              </Link>
              .
            </p>
          </div>
          <div className="cookie-banner-actions">
            <button type="button" className="btn" onClick={openPanel}>
              Ayarla
            </button>
            {/* Refusing is exactly as easy and as prominent as accepting -
                the same capsule, side by side (KVKK Çerez Uygulamaları
                Rehberi). The accept used to be the only filled button. */}
            <button
              type="button"
              className="btn btn-dark"
              onClick={() => commit(CONSENT_DENIED)}
            >
              Yalnızca zorunlu
            </button>
            <button
              type="button"
              className="btn btn-dark"
              onClick={() => commit(ALL_GRANTED)}
            >
              Tümünü kabul et
            </button>
          </div>
        </div>
      )}

      {panelOpen && (
        <div
          className="cookie-modal-scrim"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPanelOpen(false);
          }}
        >
          <div
            className="cookie-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-modal-title"
            ref={panelRef}
          >
            <div className="cookie-modal-head">
              <h2 id="cookie-modal-title">Çerez tercihleri</h2>
              <button
                type="button"
                className="cookie-modal-close"
                onClick={() => setPanelOpen(false)}
                aria-label="Kapat"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    d="M3 3 L13 13 M13 3 L3 13"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                </svg>
              </button>
            </div>

            <div className="cookie-cat cookie-cat-locked">
              <div className="cookie-cat-head">
                <span className="cookie-cat-title">Zorunlu çerezler</span>
                <span className="cookie-cat-always">Her zaman açık</span>
              </div>
              <p className="cookie-cat-body">
                Oturum, sepet ve güvenlik (CSRF) çerezleri. Bunlar olmadan giriş
                yapılamaz ve sipariş verilemez; bu nedenle rızaya bağlı
                değildir.
              </p>
            </div>

            {categories.map((c) => (
              <div className="cookie-cat" key={c.key}>
                <div className="cookie-cat-head">
                  <label className="cookie-switch">
                    <input
                      type="checkbox"
                      checked={draft[c.key]}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [c.key]: e.target.checked }))
                      }
                    />
                    <span className="cookie-switch-track" aria-hidden="true">
                      <span className="cookie-switch-thumb" />
                    </span>
                    <span className="cookie-cat-title">{c.title}</span>
                  </label>
                </div>
                <p className="cookie-cat-body">{c.body}</p>
              </div>
            ))}

            <div className="cookie-modal-actions">
              <button
                type="button"
                className="btn btn-dark"
                onClick={() => commit(CONSENT_DENIED)}
              >
                Tümünü reddet
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => commit(draft)}
              >
                Seçimimi kaydet
              </button>
              <button
                type="button"
                className="btn btn-dark"
                onClick={() => commit(ALL_GRANTED)}
              >
                Tümünü kabul et
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

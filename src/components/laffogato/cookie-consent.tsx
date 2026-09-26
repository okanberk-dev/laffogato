"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CONSENT_DENIED,
  CONSENT_VERSION,
  readConsent,
  writeConsent,
  type ConsentState,
} from "@/lib/consent/cookie";
import { CONSENT_OPEN_EVENT, pushConsentUpdate } from "@/lib/consent/script";

import { useClientValue } from "./use-client-value";

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

export function CookieConsent() {
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
  const openerRef = useRef<HTMLElement | null>(null);

  const openPanel = useCallback(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
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

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector("button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen && openerRef.current) {
      openerRef.current.focus?.();
      openerRef.current = null;
    }
  }, [panelOpen]);

  const commit = useCallback((choice: Choice) => {
    writeConsent(choice);
    pushConsentUpdate(choice);
    setCommitted(true);
    setPanelOpen(false);
  }, []);

  if (decided === null) return null;

  const bannerVisible = !decided && !panelOpen;

  return (
    <>
      {bannerVisible && (
        <div
          className="cookie-banner"
          role="region"
          aria-label="Çerez tercihleri"
        >
          <div className="cookie-banner-body">
            <p className="cookie-banner-title">Çerezler</p>
            <p className="cookie-banner-text">
              Sitenin çalışması için zorunlu çerezleri kullanıyoruz. Analitik ve
              pazarlama çerezleri ise yalnızca siz izin verirseniz çalışır.
              Ayrıntı için{" "}
              <Link href="/hukuk/cerez-politikasi">Çerez Politikası</Link> ve{" "}
              <Link href="/hukuk/kvkk-aydinlatma-metni">
                KVKK Aydınlatma Metni
              </Link>
              .
            </p>
          </div>
          <div className="cookie-banner-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={openPanel}
            >
              Ayarla
            </button>
            {/* Refusing is exactly as easy and as prominent as accepting -
                the same capsule, side by side (KVKK Çerez Uygulamaları
                Rehberi). The accept used to be the only filled button. */}
            <button
              type="button"
              className="btn btn-ink btn-sm"
              onClick={() => commit(CONSENT_DENIED)}
            >
              Yalnızca zorunlu
            </button>
            <button
              type="button"
              className="btn btn-ink btn-sm"
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
                ×
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

            {CATEGORIES.map((c) => (
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
                className="btn btn-ink btn-sm"
                onClick={() => commit(CONSENT_DENIED)}
              >
                Tümünü reddet
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => commit(draft)}
              >
                Seçimimi kaydet
              </button>
              <button
                type="button"
                className="btn btn-ink btn-sm"
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

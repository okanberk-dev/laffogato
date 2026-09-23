import { CONSENT_COOKIE, CONSENT_VERSION, type ConsentState } from "./cookie";

/**
 * The Consent Mode v2 bootstrap that has to run *before* Google Tag Manager.
 *
 * GTM reads the consent state at load time; if the default is not already on
 * the dataLayer when the container initialises, tags fire once with no consent
 * signal at all - which is exactly the KVKK breach the banner exists to
 * prevent. So this is emitted inline in <head>, ahead of the GTM script tag.
 *
 * It re-reads the cookie itself rather than being server-rendered with the
 * visitor's choice, because the layout is statically rendered and cached: a
 * server-baked "granted" would leak one visitor's consent to the next.
 */
export const CONSENT_BOOTSTRAP = `
(function(){
  window.dataLayer = window.dataLayer || [];
  function gtag(){window.dataLayer.push(arguments);}
  window.gtag = window.gtag || gtag;
  var s = null;
  try {
    var m = document.cookie.split('; ').find(function(c){
      return c.indexOf('${CONSENT_COOKIE}=') === 0;
    });
    if (m) {
      var p = JSON.parse(decodeURIComponent(m.slice(${CONSENT_COOKIE.length + 1})));
      if (p && p.version === ${CONSENT_VERSION}) s = p;
    }
  } catch (e) { s = null; }
  var g = function(v){ return v === true ? 'granted' : 'denied'; };
  gtag('consent', 'default', {
    ad_storage: g(s && s.marketing),
    ad_user_data: g(s && s.marketing),
    ad_personalization: g(s && s.marketing),
    analytics_storage: g(s && s.analytics),
    functionality_storage: g(s && s.preferences),
    personalization_storage: g(s && s.preferences),
    security_storage: 'granted',
    wait_for_update: 500
  });
  gtag('set', 'ads_data_redaction', !(s && s.marketing));
  gtag('set', 'url_passthrough', true);
})();
`.trim();

/** Pushes the visitor's decision to GTM once the banner records it. */
export function pushConsentUpdate(state: Omit<ConsentState, "decidedAt">) {
  const w = window as unknown as {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  if (typeof w.gtag !== "function") return;
  w.gtag("consent", "update", {
    ad_storage: state.marketing ? "granted" : "denied",
    ad_user_data: state.marketing ? "granted" : "denied",
    ad_personalization: state.marketing ? "granted" : "denied",
    analytics_storage: state.analytics ? "granted" : "denied",
    functionality_storage: state.preferences ? "granted" : "denied",
    personalization_storage: state.preferences ? "granted" : "denied",
    security_storage: "granted",
  });
  w.gtag("set", "ads_data_redaction", !state.marketing);
  w.dataLayer?.push({ event: "cookie_consent_update" });
}

/** Event the footer link dispatches to reopen the preference centre. */
export const CONSENT_OPEN_EVENT = "laffogato:open-cookie-preferences";

"use client";

import { GoogleTagManager } from "@next/third-parties/google";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { CONSENT_BOOTSTRAP, CONSENT_SEEN } from "@/lib/consent/script";
import { isCheckoutPath } from "@/lib/security/checkout-document";

import { CookieConsent } from "./cookie-consent";

/**
 * The root layout's tags - the cookie-consent scripts, Google Tag Manager and
 * the cookie banner - for every document EXCEPT the checkout.
 *
 * The card is typed on /odeme (docs/PAYNKOLAY.md §15.5) and that document
 * runs under a nonce policy with no third party (src/proxy.ts). Nothing here
 * may render there: GTM is a third-party script by definition, and the
 * inline consent scripts would only be blocked by the policy. With no tags
 * there is nothing to consent to on that page, so the banner stays away too
 * (it would also sit on top of the mobile pay bar).
 *
 * "Document", not "page": the decision is made once, from the path the
 * document was LOADED at, and kept for its whole life. A document loaded at
 * /odeme keeps its strict policy after a client-side navigation away, so GTM
 * could not run in it anyway; one loaded elsewhere already ran GTM, which is
 * why the checkout reloads itself when it is reached that way
 * (`checkout.tsx`). The root layout must not read `headers()` for this -
 * that would make every page dynamic - so the path comes from
 * `usePathname()`, which server-renders with the request's path.
 */
function useOutsideCheckoutDocument(): boolean {
  const pathname = usePathname();
  const [outside] = useState(() => !isCheckoutPath(pathname));
  return outside;
}

/** In <head>, before GTM: the banner flag and the Consent Mode defaults. */
export function ConsentScripts({
  withTagManager,
}: {
  withTagManager: boolean;
}) {
  const outside = useOutsideCheckoutDocument();
  if (!outside) return null;
  return (
    <>
      <script
        id="consent-seen"
        dangerouslySetInnerHTML={{ __html: CONSENT_SEEN }}
      />
      {/* Consent Mode v2 defaults - must be on the dataLayer before the GTM
          container initialises, otherwise the first tag fires with no
          consent signal at all. Everything except strictly-necessary storage
          starts denied and is only raised by an explicit choice. */}
      {withTagManager ? (
        <script
          id="consent-bootstrap"
          dangerouslySetInnerHTML={{ __html: CONSENT_BOOTSTRAP }}
        />
      ) : null}
    </>
  );
}

export function TagManager({ gtmId }: { gtmId: string }) {
  const outside = useOutsideCheckoutDocument();
  return outside && gtmId ? <GoogleTagManager gtmId={gtmId} /> : null;
}

export function CookieBanner() {
  const outside = useOutsideCheckoutDocument();
  return outside ? <CookieConsent /> : null;
}

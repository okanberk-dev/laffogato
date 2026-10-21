"use client";

import { GoogleTagManager } from "@next/third-parties/google";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { CONSENT_BOOTSTRAP, CONSENT_SEEN } from "@/lib/consent/script";
import { isAdminDocumentPath } from "@/lib/security/admin-document";
import { isCheckoutPath } from "@/lib/security/checkout-document";

import { CookieConsent } from "./cookie-consent";

/**
 * The root layout's tags - the cookie-consent scripts, Google Tag Manager and
 * the cookie banner - for every document EXCEPT the checkout's and the admin
 * panel's.
 *
 * The card is typed on /odeme (docs/PAYNKOLAY.md §15.5) and that document
 * runs under a nonce policy with no third party (src/proxy.ts). Nothing here
 * may render there: GTM is a third-party script by definition, and the
 * inline consent scripts would only be blocked by the policy. With no tags
 * there is nothing to consent to on that page, so the banner stays away too
 * (it would also sit on top of the mobile pay bar).
 *
 * The panel (/admin) is left out for the same reason, the other way round:
 * whoever can publish the GTM container can run any script there (a Custom
 * HTML tag passes the site policy), next to customer names, addresses and
 * phones and with the signed-in admin's session behind every server action
 * (refunds, settings). Its addresses and titles carry customer e-mails
 * (`/admin/musteriler/[email]`), which GA's page_location would report, and
 * the banner (z-index 200) covered the panel's toasts and bulk bar. The
 * panel's documents also carry a nonce policy of their own with no third
 * party (src/lib/security/admin-document.ts, src/proxy.ts).
 *
 * Neither this nor that policy walls the panel off from GTM. The admin
 * cookies are scoped to `/admin` (lib/admin/session-cookie.ts), but a
 * cookie's path is matched against where a request goes, not where it comes
 * from: a tag on any site page can still fetch /admin and call its actions
 * as an admin who browses the site signed in. Only a separate origin for the
 * panel closes that (docs/AUDIT.md §13, open).
 *
 * "Document", not "page": the decision is made once, from the path the
 * document was LOADED at, and kept for its whole life. A document loaded at
 * /odeme keeps its strict policy after a client-side navigation away, so GTM
 * could not run in it anyway; one loaded elsewhere already ran GTM, which is
 * why the checkout reloads itself when it is reached that way
 * (`checkout.tsx`). No site page links into /admin, so the panel is always
 * a document of its own; a site page reached from it by a client-side link
 * keeps that document, and with it no tags, until the next full load. The
 * root layout must not read `headers()` for this - that would make every
 * page dynamic - so the path comes from `usePathname()`, which
 * server-renders with the request's path.
 */
function useTagsAllowed(): boolean {
  const pathname = usePathname();
  const [allowed] = useState(
    () => !isCheckoutPath(pathname) && !isAdminDocumentPath(pathname),
  );
  return allowed;
}

/** In <head>, before GTM: the banner flag and the Consent Mode defaults. */
export function ConsentScripts({
  withTagManager,
}: {
  withTagManager: boolean;
}) {
  const allowed = useTagsAllowed();
  if (!allowed) return null;
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
  const allowed = useTagsAllowed();
  return allowed && gtmId ? <GoogleTagManager gtmId={gtmId} /> : null;
}

/**
 * `tagManager`: whether GTM runs on the site. Without it there are no
 * analytics or ad tags to consent to, so the banner offers only the
 * necessary and preference cookies.
 */
export function CookieBanner({ tagManager }: { tagManager: boolean }) {
  const allowed = useTagsAllowed();
  return allowed ? <CookieConsent tagManager={tagManager} /> : null;
}

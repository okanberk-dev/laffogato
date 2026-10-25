"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useEffectEvent, useRef } from "react";

import type { ConsentState } from "@/lib/consent/cookie";
import {
  pixelPageKey,
  revokeMetaPixel,
  trackPixel,
} from "@/lib/consent/meta-pixel";
import { CONSENT_UPDATED_EVENT } from "@/lib/consent/script";

/**
 * The Meta Pixel's page-level tracking, mounted once in the root layout when
 * the site has a pixel id (docs/META-PIXEL.md).
 *
 * - One PageView per App Router route change (path or query; not the karaoke
 *   wizard's step, `pixelPageKey`), sent only while the visitor has said yes
 *   to the marketing category.
 * - The moment the visitor says yes in the banner or the panel, a PageView
 *   for the page they are on; the moment they withdraw it, the pixel is
 *   closed and its cookies removed. Both ride `CONSENT_UPDATED_EVENT`.
 * - A click on any `tel:` link is a Contact.
 *
 * It renders nothing. `trackPixel` itself refuses on the admin panel, on the
 * card page, on a preview or localhost and without consent, so this component
 * needs no such checks of its own.
 */
export function MetaPixel() {
  return (
    <Suspense fallback={null}>
      <RouteTracker />
    </Suspense>
  );
}

function RouteTracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const key = pixelPageKey(pathname, search?.toString() ?? "");
  // The page a PageView has gone out for, and the page on screen now.
  const sentFor = useRef<string | null>(null);
  const current = useRef(key);

  useEffect(() => {
    current.current = key;
    if (sentFor.current === key) return;
    if (trackPixel("PageView")) sentFor.current = key;
  }, [key]);

  const onConsent = useEffectEvent((event: Event) => {
    const choice = (event as CustomEvent<Partial<ConsentState>>).detail;
    if (choice?.marketing === true) {
      // Saving the panel again with the marketing switch still on is not a
      // new page: the page on screen already has its PageView.
      if (sentFor.current !== current.current && trackPixel("PageView")) {
        sentFor.current = current.current;
      }
    } else {
      sentFor.current = null;
      revokeMetaPixel();
    }
  });
  useEffect(() => {
    const listener = (event: Event) => onConsent(event);
    window.addEventListener(CONSENT_UPDATED_EVENT, listener);
    return () => window.removeEventListener(CONSENT_UPDATED_EVENT, listener);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('a[href^="tel:"]')) trackPixel("Contact");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}

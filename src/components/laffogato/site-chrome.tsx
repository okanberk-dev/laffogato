"use client";

import { useEffect, useState } from "react";

import { Footer, Nav, type FooterSettings } from "./chrome";

const CART_STORAGE_KEY = "laffogato_cart_v1";

/**
 * Site-wide chrome (nav + footer) for pages OUTSIDE the homepage SPA —
 * /uye/*, /odeme, /hukuk/* etc. Nav and Footer used here render without
 * a `navigate` prop, so their links degrade to plain anchor navigation
 * targeting real route URLs (/menu, /magaza, ...).
 *
 * Live cart count is read from localStorage so the cart badge stays in
 * sync across pages. We listen to the storage event so an update on
 * another tab is reflected too.
 */
export function SiteChrome({
  children,
  settings,
}: {
  children: React.ReactNode;
  settings?: FooterSettings;
}) {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const read = () => {
      try {
        const raw = window.localStorage.getItem(CART_STORAGE_KEY);
        if (!raw) {
          setCartCount(0);
          return;
        }
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) {
          setCartCount(0);
          return;
        }
        setCartCount(
          data.reduce(
            (sum: number, it: { qty?: number }) => sum + (Number(it?.qty) || 1),
            0,
          ),
        );
      } catch {
        setCartCount(0);
      }
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <>
      {/* The SPA shell had a skip link; checkout, the legal documents and the
          member pages did not, so a keyboard user tabbed the whole header on
          every one of them. */}
      <a href="#main" className="skip-link">
        İçeriğe geç
      </a>
      <Nav
        cart={cartCount}
        onSearch={() => {
          window.location.assign("/magaza");
        }}
      />
      <main className="site-chrome-body" id="main">
        {children}
      </main>
      <Footer settings={settings} />
    </>
  );
}

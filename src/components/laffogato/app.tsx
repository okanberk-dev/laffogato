"use client";

import { useEffect, useRef, useState } from "react";

import { Footer, Nav, type FooterSettings, type Route } from "./chrome";
import {
  PageFranchise,
  PageHome,
  PageMenu,
  PageReels,
  PageShop,
  PageStory,
  PageVisit,
} from "./pages";
import { CartDrawer, ProductModal, type CartItem } from "./ui";
import type { MenuCategory, Product } from "./data";

const VALID_ROUTES: Route[] = [
  "home",
  "menu",
  "shop",
  "story",
  "reels",
  "visit",
  "franchise",
];

const CART_STORAGE_KEY = "laffogato_cart_v1";

function readInitialRoute(): Route {
  if (typeof window === "undefined") return "home";
  const initial = (window.location.hash || "#home").replace("#", "") as Route;
  return VALID_ROUTES.includes(initial) ? initial : "home";
}

function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (it): it is CartItem =>
        typeof it === "object" &&
        it !== null &&
        typeof (it as CartItem).name === "string",
    );
  } catch {
    return [];
  }
}

export function LaffogatoApp({
  products,
  settings,
  notice,
  menu,
  seoSlot,
  wishlist,
  isAuthenticated,
}: {
  products?: Product[];
  settings?: FooterSettings;
  notice?: string;
  menu?: Record<string, MenuCategory>;
  /** Server-rendered SEO content (FAQ, address block) inserted just above the footer on every route. */
  seoSlot?: React.ReactNode;
  /** Wishlist product IDs for the authenticated customer. Empty when guest. */
  wishlist?: string[];
  /** Whether the visitor is signed in. Drives the heart button login redirect. */
  isAuthenticated?: boolean;
}) {
  const [noticeOpen, setNoticeOpen] = useState(Boolean(notice));

  useEffect(() => {
    setNoticeOpen(Boolean(notice));
    if (!notice) return;
    const t = window.setTimeout(() => setNoticeOpen(false), 7000);
    return () => window.clearTimeout(t);
  }, [notice]);
  const [route, setRoute] = useState<Route>("home");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [productOpen, setProductOpen] = useState<Product | null>(null);
  const [mounted, setMounted] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setRoute(readInitialRoute());
    setCart(readStoredCart());
    hydratedRef.current = true;
    setMounted(true);
    const onHash = () => {
      const r = (window.location.hash || "#home").replace("#", "") as Route;
      if (VALID_ROUTES.includes(r)) setRoute(r);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) setCart(readStoredCart());
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      if (cart.length === 0) {
        window.localStorage.removeItem(CART_STORAGE_KEY);
      } else {
        window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      }
    } catch {
      // localStorage may be unavailable (private mode, etc.) — silent no-op.
    }
  }, [cart]);

  const navigate = (r: Route) => {
    setRoute(r);
    window.location.hash = r;
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.name === item.name);
      if (existing) {
        return prev.map((p) =>
          p.name === item.name ? { ...p, qty: (p.qty || 1) + 1 } : p,
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
    setCartOpen(true);
  };

  const removeFromCart = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const dark = route === "home" || route === "franchise" || route === "visit";

  const pages: Record<Route, typeof PageHome> = {
    home: PageHome,
    menu: PageMenu,
    shop: PageShop,
    story: PageStory,
    reels: PageReels,
    visit: PageVisit,
    franchise: PageFranchise,
  };
  const Page = pages[route];

  const cartCount = cart.reduce((s, it) => s + (it.qty || 1), 0);

  // Avoid hydration mismatch — render only after we read the hash on the client.
  if (!mounted) {
    return (
      <>
        <Nav route="home" navigate={navigate} dark cart={0} onCart={() => setCartOpen(true)} />
        <PageHome
          navigate={navigate}
          addToCart={addToCart}
          openProduct={setProductOpen}
          products={products}
          menu={menu}
        />
        {seoSlot}
        <Footer navigate={navigate} settings={settings} />
      </>
    );
  }

  return (
    <>
      <Nav
        route={route}
        navigate={navigate}
        dark={dark}
        cart={cartCount}
        onCart={() => setCartOpen(true)}
      />
      <Page
        navigate={navigate}
        addToCart={addToCart}
        openProduct={setProductOpen}
        products={products}
        menu={menu}
      />
      {seoSlot}
      <Footer navigate={navigate} settings={settings} />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        removeItem={removeFromCart}
      />
      <ProductModal
        product={productOpen}
        onClose={() => setProductOpen(null)}
        addToCart={addToCart}
        wishlist={wishlist}
        isAuthenticated={isAuthenticated}
      />
      {notice && noticeOpen && (
        <div
          role="alert"
          style={{
            position: "fixed",
            top: 96,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 80,
            maxWidth: "min(540px, calc(100vw - 32px))",
            background: "var(--ink)",
            color: "#FFF",
            padding: "14px 18px",
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            gap: 14,
            boxShadow: "0 20px 40px rgba(20, 16, 11, 0.25)",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          <span style={{ flex: 1 }}>{notice}</span>
          <button
            onClick={() => setNoticeOpen(false)}
            aria-label="Kapat"
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.12)",
              color: "#FFF",
              display: "grid",
              placeItems: "center",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 16 16">
              <path
                d="M3 3 L13 13 M13 3 L3 13"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}

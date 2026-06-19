"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  Footer,
  Nav,
  ROUTE_PATHS,
  type FooterSettings,
  type Route,
} from "./chrome";
import {
  PageFranchise,
  PageHome,
  PageMenu,
  PageReels,
  PageShop,
  PageStory,
  PageVisit,
} from "./pages";
import {
  CartDrawer,
  ProductModal,
  SearchOverlay,
  cartItemKey,
  type CartItem,
} from "./ui";
import type { ShopHeroSlide } from "./shop-hero-slider";
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
  shopHeroSlides,
  reels,
  press,
  storyTimeline,
  franchisePackages,
  franchiseSteps,
  content,
  visit,
  freeShippingThreshold = 0,
  initialRoute = "home",
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
  /** Admin-managed shop hero slides — PageShop renders them at the top. */
  shopHeroSlides?: ShopHeroSlide[];
  /** Admin-managed editorial content (reels / press / story / franchise). */
  reels?: { caption: string; meta: string; accent: string }[];
  press?: { name: string; quote: string }[];
  storyTimeline?: { y: string; t: string; d: string }[];
  franchisePackages?: {
    name: string;
    area: string;
    seats: string;
    invest: string;
    monthly: string;
    ideal: string;
    includes: string[];
    featured?: boolean;
  }[];
  franchiseSteps?: { n: string; t: string; d: string }[];
  /** Admin-managed editable site copy (key → value). */
  content?: Record<string, string>;
  /** Visit page contact block, derived from admin settings. */
  visit?: {
    addressLines: string[];
    phone: string;
    email: string;
    hours: [string, string][];
  };
  /** Free-shipping threshold in major units (₺) — drives the cart progress bar. */
  freeShippingThreshold?: number;
  /** The SPA section to render on first paint. Set by sub-page routes
      (e.g. /menu → initialRoute="menu"); defaults to "home" for `/`. */
  initialRoute?: Route;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [noticeOpen, setNoticeOpen] = useState(Boolean(notice));

  useEffect(() => {
    setNoticeOpen(Boolean(notice));
    if (!notice) return;
    const t = window.setTimeout(() => setNoticeOpen(false), 7000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // `route` is fixed for an instance's lifetime: every navigation goes through a
  // real Next route that re-mounts this shell with the correct initialRoute, so
  // there is no in-instance route switching (and thus no optimistic setRoute —
  // see navigate()).
  const [route] = useState<Route>(initialRoute);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [productOpen, setProductOpen] = useState<Product | null>(null);
  const [mounted, setMounted] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    // Backward-compat: if user lands on `/` with a legacy hash like #menu,
    // route them to the real sub-page so their bookmark still works.
    if (typeof window !== "undefined" && initialRoute === "home") {
      const hash = window.location.hash.replace("#", "") as Route;
      if (hash && VALID_ROUTES.includes(hash) && hash !== "home") {
        router.replace(ROUTE_PATHS[hash]);
        return;
      }
    }
    setCart(readStoredCart());
    hydratedRef.current = true;
    setMounted(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) setCart(readStoredCart());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [initialRoute, router]);

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
    const target = ROUTE_PATHS[r];
    if (pathname === target) {
      // Already on the exact same URL — just scroll to the top so the click
      // feels responsive (e.g. user clicking "Menü" while on /menu).
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    // Navigate via the real route ONLY. We deliberately do not optimistically
    // setRoute() here: the target is a real Next route that re-mounts this shell
    // with the right initialRoute, so an optimistic swap would paint the new
    // page once immediately and then a second time when the route loads — the
    // "every page renders twice" double the user was seeing.
    router.push(target);
  };

  const addToCart = (item: CartItem) => {
    const key = cartItemKey(item);
    setCart((prev) => {
      const existing = prev.find((p) => cartItemKey(p) === key);
      if (existing) {
        const cap = existing.maxStock ?? item.maxStock ?? 99;
        const nextQty = Math.min(cap, (existing.qty || 1) + 1);
        return prev.map((p) =>
          cartItemKey(p) === key ? { ...p, ...item, qty: nextQty } : p,
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
    setCartOpen(true);
  };

  const setCartQty = (idx: number, qty: number) => {
    setCart((prev) =>
      prev
        .map((it, i) => {
          if (i !== idx) return it;
          const cap = it.maxStock ?? 99;
          return { ...it, qty: Math.min(cap, Math.max(0, qty)) };
        })
        .filter((it) => (it.qty ?? 1) > 0),
    );
  };

  const removeFromCart = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const dark =
    route === "home" ||
    route === "franchise" ||
    route === "visit" ||
    route === "menu";

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

  // Avoid hydration mismatch — render only after we read localStorage on the
  // client. The initial markup matches what the server emitted (cart=0).
  if (!mounted) {
    return (
      <>
        <Nav
          route={route}
          navigate={navigate}
          dark={dark}
          cart={0}
          onCart={() => setCartOpen(true)}
          onSearch={() => setSearchOpen(true)}
        />
        <Page
          navigate={navigate}
          addToCart={addToCart}
          openProduct={setProductOpen}
          products={products}
          menu={menu}
          shopHeroSlides={shopHeroSlides}
          reels={reels}
          press={press}
          storyTimeline={storyTimeline}
          franchisePackages={franchisePackages}
          franchiseSteps={franchiseSteps}
          content={content}
          visit={visit}
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
        onSearch={() => setSearchOpen(true)}
      />
      <Page
        navigate={navigate}
        addToCart={addToCart}
        openProduct={setProductOpen}
        products={products}
        menu={menu}
        shopHeroSlides={shopHeroSlides}
        reels={reels}
        press={press}
        storyTimeline={storyTimeline}
        franchisePackages={franchisePackages}
        franchiseSteps={franchiseSteps}
        content={content}
        visit={visit}
      />
      {seoSlot}
      <Footer navigate={navigate} settings={settings} />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        removeItem={removeFromCart}
        setQty={setCartQty}
        freeShippingThreshold={freeShippingThreshold}
      />
      <ProductModal
        product={productOpen}
        onClose={() => setProductOpen(null)}
        addToCart={addToCart}
        wishlist={wishlist}
        isAuthenticated={isAuthenticated}
      />
      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={products ?? []}
        menu={menu ?? {}}
        onOpenProduct={setProductOpen}
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

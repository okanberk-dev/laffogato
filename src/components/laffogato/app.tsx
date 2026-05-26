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
import type { Product } from "./data";

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
}: {
  products?: Product[];
  settings?: FooterSettings;
}) {
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
        />
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
      />
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
      />
    </>
  );
}

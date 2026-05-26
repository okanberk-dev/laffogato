"use client";

import { useEffect, useState } from "react";

import { Footer, Nav, type Route } from "./chrome";
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

function readInitialRoute(): Route {
  if (typeof window === "undefined") return "home";
  const initial = (window.location.hash || "#home").replace("#", "") as Route;
  return VALID_ROUTES.includes(initial) ? initial : "home";
}

export function LaffogatoApp({ products }: { products?: Product[] }) {
  const [route, setRoute] = useState<Route>("home");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [productOpen, setProductOpen] = useState<Product | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setRoute(readInitialRoute());
    setMounted(true);
    const onHash = () => {
      const r = (window.location.hash || "#home").replace("#", "") as Route;
      if (VALID_ROUTES.includes(r)) setRoute(r);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

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
        <Footer navigate={navigate} />
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
      <Footer navigate={navigate} />
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

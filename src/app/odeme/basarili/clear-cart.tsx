"use client";

import { useEffect } from "react";

const CART_STORAGE_KEY = "laffogato_cart_v1";

/**
 * Mounted on the order success page to empty the cart that LaffogatoApp
 * keeps in localStorage. Without this, navigating back to /#shop would
 * still show the just-purchased items.
 */
export function ClearCart() {
  useEffect(() => {
    try {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // localStorage may be unavailable — silent no-op.
    }
  }, []);
  return null;
}

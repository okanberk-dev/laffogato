"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The phone's account menu is a strip that scrolls sideways. It opens with
 * the current page's tab in the middle of the strip: on Kayıtlı kartlarım
 * or Şifre the tab would otherwise be off the right edge, and the strip
 * would not say where you are. Only the strip is scrolled, never the page.
 */
export function AccountTabStrip({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = ref.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !current) return;
    const box = list.getBoundingClientRect();
    const tab = current.getBoundingClientRect();
    if (box.width === 0) return;
    const left = tab.left - box.left + list.scrollLeft;
    list.scrollLeft = Math.max(0, left - (box.width - tab.width) / 2);
  }, []);
  return (
    <ul ref={ref} className="account-topnav-list">
      {children}
    </ul>
  );
}

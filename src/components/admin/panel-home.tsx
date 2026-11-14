"use client";

import { createContext, useContext, type ReactNode } from "react";

import Link from "@/components/link";

/**
 * Where "the panel" is for the signed-in role: /admin for most, /admin/kasa
 * for a cashier, who has no dashboard. Links that said "/admin" (the logo,
 * "Panele dön" on the error and 404 screens) sent a cashier to a page that
 * only bounced them on to /admin/kasa?denied=1 (admin audit SHE-25).
 *
 * The layout knows the session and provides it here; the error screen is a
 * client component and cannot ask the server itself. Outside the provider
 * (the signed-out screens, a test) it is /admin.
 */
const PanelHomeContext = createContext("/admin");

export function PanelHomeProvider({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <PanelHomeContext.Provider value={href}>
      {children}
    </PanelHomeContext.Provider>
  );
}

export function usePanelHome(): string {
  return useContext(PanelHomeContext);
}

/** A link to the role's landing page. */
export function PanelHomeLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={usePanelHome()} className={className}>
      {children}
    </Link>
  );
}

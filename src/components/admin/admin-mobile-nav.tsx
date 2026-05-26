"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { logoutAction } from "@/app/admin/actions";

interface NavItem {
  href: string;
  label: string;
}

interface Props {
  items: NavItem[];
  email: string;
  roleLabel: string;
}

export function AdminMobileNav({ items, email, roleLabel }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-900 lg:hidden"
        aria-label="Menüyü aç"
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M2 5h14M2 9h14M2 13h14"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div
        className={`fixed inset-0 z-[80] bg-neutral-900/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 right-0 z-[81] flex w-[min(360px,90vw)] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Yönetim menüsü"
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: "var(--mono), monospace" }}
            >
              {roleLabel}
            </div>
            <div
              className="mt-0.5 max-w-[220px] truncate text-sm text-neutral-900"
              style={{ fontFamily: "var(--mono), monospace" }}
              title={email}
            >
              {email}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
            aria-label="Kapat"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3 3 L13 13 M13 3 L3 13"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="flex flex-col gap-0.5">
            {items.map((n) => {
              const isActive =
                n.href === "/admin"
                  ? pathname === "/admin"
                  : pathname?.startsWith(n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className={`flex min-h-[48px] items-center rounded-lg px-4 text-base transition-colors ${
                      isActive
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <footer className="border-t border-neutral-200 p-4">
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
            >
              Çıkış yap
            </button>
          </form>
        </footer>
      </aside>
    </>
  );
}

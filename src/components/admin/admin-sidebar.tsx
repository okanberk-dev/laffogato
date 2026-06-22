"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export interface AdminNavItem {
  href: string;
  label: string;
  section: string;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

/* Compact line-icon set, one per admin section. 24×24 stroke icons. */
const ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  menu: (
    <>
      <path d="M5 8h12v4a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z" />
      <path d="M17 9h2.5a2 2 0 0 1 0 4H17" />
      <path d="M8 3v2M12 3v2" />
    </>
  ),
  products: (
    <>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9" />
    </>
  ),
  categories: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </>
  ),
  shopHero: (
    <>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m21 15-5-5L5 18" />
    </>
  ),
  reels: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 4l1 5M15 4l1 5" />
      <path d="m11 12.5 3.5 2-3.5 2v-4Z" />
    </>
  ),
  press: (
    <>
      <path d="M5 5h12v14H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z" />
      <path d="M17 9h3v8a2 2 0 0 1-2 2" />
      <path d="M8 9h6M8 12h6M8 15h4" />
    </>
  ),
  story: (
    <>
      <path d="M5 4a1 1 0 0 1 1-1h12v15H6a2 2 0 0 0-2 2V5a1 1 0 0 1 1-1Z" />
      <path d="M4 18a2 2 0 0 0 2 2h12" />
    </>
  ),
  content: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  orders: (
    <>
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5M20.5 20a5.5 5.5 0 0 0-3.5-5.1" />
    </>
  ),
  promos: (
    <>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h15A1.5 1.5 0 0 1 21 8.5a2 2 0 0 0 0 4 1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 12.5a2 2 0 0 0 0-4Z" />
      <path d="M14 7.5v9" />
    </>
  ),
  newsletter: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  leads: (
    <>
      <path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="3.2" />
      <path d="M19 8v6M22 11h-6" />
    </>
  ),
  legal: (
    <>
      <path d="M12 3v17M7 20h10" />
      <path d="M5 7h14l-3 1.5L12 7 8 8.5 5 7Z" />
      <path d="m5 7-2.2 5.5a3 3 0 0 0 5.4 0L6 7" />
      <path d="m19 7-2.2 5.5a3 3 0 0 0 5.4 0L20 7" />
    </>
  ),
  stock: (
    <>
      <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" />
      <path d="m3 12 9 4.5L21 12M3 16.5 12 21l9-4.5" />
    </>
  ),
  reports: (
    <>
      <path d="M3 21h18" />
      <rect x="5" y="11" width="3.2" height="7" rx="0.5" />
      <rect x="10.4" y="6" width="3.2" height="12" rx="0.5" />
      <rect x="15.8" y="13" width="3.2" height="5" rx="0.5" />
    </>
  ),
  audit: (
    <>
      <path d="M12 3 20 6v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
};

function NavIcon({ section }: { section: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {ICONS[section] ?? ICONS.dashboard}
    </svg>
  );
}

interface SidebarProps {
  groups: AdminNavGroup[];
  email: string;
  roleLabel: string;
  logout: () => void;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarBody({
  groups,
  email,
  roleLabel,
  logout,
  pathname,
  onNavigate,
}: SidebarProps & { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <Link
        href="/admin"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-5 py-4"
        aria-label="L'Affogato Admin"
      >
        <span
          className="brand-mark h-8"
          style={{ color: "var(--brand, #43301D)" }}
          aria-hidden="true"
        />
        <span
          className="text-[11px] tracking-[0.26em] text-neutral-400 uppercase"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          Admin
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.title} className="mb-1">
            <div className="px-3 pt-4 pb-1.5 text-[10px] font-semibold tracking-[0.16em] text-neutral-400 uppercase">
              {group.title}
            </div>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
                        active
                          ? "font-medium"
                          : "text-neutral-600 hover:bg-neutral-100 hover:text-[var(--admin-primary)]"
                      }`}
                      style={
                        active
                          ? {
                              backgroundColor: "#F3EADB",
                              color: "var(--brand, #43301D)",
                            }
                          : undefined
                      }
                    >
                      <NavIcon section={item.section} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t border-[var(--admin-border)] px-4 py-3">
        <div className="mb-2 min-w-0">
          <div className="truncate text-[13px] font-medium text-neutral-800">
            {email}
          </div>
          <div
            className="text-[10px] tracking-[0.18em] text-neutral-400 uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            {roleLabel}
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--admin-border)] px-3 py-2 text-[13px] text-neutral-600 transition-colors hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5M21 12H9" />
            </svg>
            Çıkış
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminSidebar(props: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-[var(--admin-border)] bg-white lg:block">
        <SidebarBody {...props} pathname={pathname} />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--admin-border)] bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menüyü aç"
          className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--admin-border)] text-neutral-700 hover:border-[var(--admin-primary)]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link
          href="/admin"
          className="flex items-center gap-2"
          aria-label="L'Affogato Admin"
        >
          <span
            className="brand-mark h-7"
            style={{ color: "var(--brand, #43301D)" }}
            aria-hidden="true"
          />
          <span
            className="text-[10px] tracking-[0.24em] text-neutral-400 uppercase"
            style={{ fontFamily: "var(--mono), monospace" }}
          >
            Admin
          </span>
        </Link>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-[var(--admin-primary)]/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[80%] max-w-[300px] flex-col bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Menüyü kapat"
              className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
            <SidebarBody
              {...props}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}

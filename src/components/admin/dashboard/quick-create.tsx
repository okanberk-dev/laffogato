import Link from "next/link";

import { CREATE_ENTRIES } from "@/lib/admin/palette-core";
import { canAccess, type AdminRole } from "@/lib/admin/roles";

import { AdminIcon, type AdminIconName } from "../ui/icons";

/** Each record's icon: the nav item's where the record has one. */
const ICON_BY_HREF: Record<string, AdminIconName> = {
  "/admin/siparisler/yeni": "orders",
  "/admin/urunler/yeni": "products",
  "/admin/menu/yeni": "menu",
  "/admin/kategoriler/yeni": "categories",
  "/admin/promosyon/yeni": "promos",
  "/admin/bulten/kampanya/yeni": "newsletter",
  "/admin/anasayfa-hero/yeni": "slides",
  "/admin/magaza-hero/yeni": "slides",
  "/admin/mobil/slaytlar/yeni": "mobileApp",
  "/admin/mobil/duyurular/yeni": "announcement",
  "/admin/mobil/gonderiler/yeni": "post",
  "/admin/masalar/yeni": "tables",
};

export interface QuickCreateEntry {
  href: string;
  /** What the tile shows under "Hızlı ekle" ("Sipariş"). */
  short: string;
  icon: AdminIconName;
}

/**
 * The "Yeni …" pages the role may open, in the palette's order (one list:
 * palette-core's CREATE_ENTRIES, each gated by the section its page asks
 * for). Only pages that start a record: the CSV import and the table cards'
 * print are not here.
 */
export function quickCreateEntries(role: AdminRole): QuickCreateEntry[] {
  return CREATE_ENTRIES.filter(
    (e) => e.href.endsWith("/yeni") && canAccess(e.section, role),
  ).map((e) => {
    const noun = e.label.replace(/^Yeni\s+/, "");
    return {
      href: e.href,
      short: noun.charAt(0).toLocaleUpperCase("tr-TR") + noun.slice(1),
      icon: ICON_BY_HREF[e.href] ?? "create",
    };
  });
}

/**
 * One tap to a new record from the landing page: the role's "Yeni …"
 * pages as a row of quiet chips under the tiles (a hairline and a muted
 * icon; 44 px on a touch screen, 36 px where the pointer can aim), full
 * width so the words never break. They wrap from `sm`; on a phone the row
 * scrolls sideways instead of pushing the widgets five rows down.
 * Server-safe.
 */
export function QuickCreate({
  entries,
}: {
  entries: readonly QuickCreateEntry[];
}) {
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="quick-create-title" className="mt-6 min-w-0">
      <h2
        id="quick-create-title"
        className="mb-2 text-sm font-semibold text-[var(--admin-text)]"
      >
        Hızlı ekle
      </h2>
      <ul className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 text-sm sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {entries.map((e) => (
          <li key={e.href} className="shrink-0">
            <Link
              href={e.href}
              className="group inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--admin-border)] px-3 text-[13px] whitespace-nowrap text-[var(--admin-text-soft)] transition-colors hover:border-[var(--admin-border-strong)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none pointer-fine:min-h-9"
            >
              <AdminIcon
                name={e.icon}
                size={16}
                className="text-[var(--admin-text-mute)] transition-colors group-hover:text-[var(--admin-text)]"
              />
              {/* Its name is "Yeni sipariş": the visible word is in it, so a
                  voice command that says the chip finds it (WCAG 2.5.3). */}
              <span>
                <span className="sr-only">Yeni </span>
                {e.short}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

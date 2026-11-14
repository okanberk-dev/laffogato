import { Fragment } from "react";

import Link from "@/components/link";
import { CREATE_ENTRIES } from "@/lib/admin/palette-core";
import { canAccess, type AdminRole } from "@/lib/admin/roles";

import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
} from "../ui/action-menu";
import { HUE_INK, SECTION_HUE, type AdminHue } from "../ui/hues";
import { AdminIcon, type AdminIconName } from "../ui/icons";
import { BUTTON } from "../ui/styles";

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
  /** What the "Yeni" menu's item says ("Sipariş"). */
  short: string;
  icon: AdminIconName;
  /** The icon's colour: its section's nav group (ui/hues.ts). */
  hue: AdminHue;
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
      hue: SECTION_HUE[e.section],
    };
  });
}

/**
 * A new record from the landing page (Innex, 22 Eki 2026): the header's one
 * solid button. With one page to start ("Yeni sipariş" for staff) it is
 * that page's link; with more it opens a menu of them, in the palette's
 * order, a rule between the nav groups. It replaced the "Hızlı ekle" row of
 * twelve chips that pushed the day's figures down a screen. Server-safe;
 * the menu is the kit's ActionMenu.
 */
export function QuickCreate({
  entries,
}: {
  entries: readonly QuickCreateEntry[];
}) {
  if (entries.length === 0) return null;
  const plus = <AdminIcon name="create" size={16} strokeWidth={2} />;
  if (entries.length === 1) {
    const only = entries[0];
    return (
      <Link href={only.href} className={BUTTON.primary}>
        {plus}
        <span>Yeni {only.short.toLocaleLowerCase("tr-TR")}</span>
      </Link>
    );
  }
  return (
    <ActionMenu label="Yeni" primary icon={plus}>
      {entries.map((e, i) => (
        <Fragment key={e.href}>
          {i > 0 && entries[i - 1].hue !== e.hue ? (
            <ActionMenuSeparator />
          ) : null}
          <ActionMenuLink href={e.href}>
            <AdminIcon name={e.icon} size={16} className={HUE_INK[e.hue]} />
            {/* Its name is "Yeni sipariş": the visible word is in it, so a
                voice command that says the item finds it (WCAG 2.5.3). */}
            <span>
              <span className="sr-only">Yeni </span>
              {e.short}
            </span>
          </ActionMenuLink>
        </Fragment>
      ))}
    </ActionMenu>
  );
}

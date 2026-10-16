import type { Metadata } from "next";

import { LaffogatoApp } from "@/components/laffogato/app";
import { TableBanner } from "@/components/laffogato/table-banner";
import { clientIp } from "@/lib/admin/rate-limit";
import { isDbUnreachable } from "@/lib/db/health";
import { lookupTableLimited } from "@/lib/mobile/tables";
import { loadAppProps } from "@/lib/seo/app-props";

export const dynamic = "force-dynamic";

/**
 * `/masa/<code>` - what a table's printed QR opens in a browser. The app does
 * not claim this URL yet (AASA, Android): it will with the release that ships
 * its table screen (docs/API-MOBILE.md §22).
 *
 * The menu, view-only as on /menu, under a banner naming the table. An unknown,
 * retired or rotated code still gets the menu, with a neutral line - never a
 * 404 and never a redirect: a guest holding an old card should still see
 * what the köşk serves.
 *
 * Kept out of search: one URL per table, all showing the same menu.
 */
export const metadata: Metadata = {
  title: "Masa · Menü",
  robots: { index: false, follow: false },
};

async function tableNameFor(code: string): Promise<string | null> {
  try {
    const lookup = await lookupTableLimited(code, await clientIp());
    return lookup.ok ? lookup.table.name : null;
  } catch (err) {
    // The banner is a nicety; the menu below has its own outage handling.
    if (!isDbUnreachable(err)) console.error("[masa] table lookup failed", err);
    return null;
  }
}

export default async function TablePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const [tableName, { appProps }] = await Promise.all([
    tableNameFor(code),
    loadAppProps({ withShopHero: false }),
  ]);
  return (
    <LaffogatoApp
      {...appProps}
      initialRoute="menu"
      leadSlot={<TableBanner tableName={tableName} />}
    />
  );
}

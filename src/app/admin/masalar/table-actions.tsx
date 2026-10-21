import Link from "next/link";
import type { ReactNode } from "react";

import { ActionButton } from "@/components/admin/action-form";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  BUTTON,
  ConfirmButton,
} from "@/components/admin/ui";
import { tableUrl } from "@/lib/admin/cafe-tables-core";
import type { CafeTable } from "@/lib/admin/cafe-tables";
import {
  cafeTableEditHref,
  cafeTableHref,
  cafeTablePrintHref,
  cafeTableQrHref,
} from "@/lib/admin/cafe-tables-panel";

import { rotateCafeTableCodeAction, setCafeTableActiveAction } from "./actions";
import { CopyTableLink } from "./table-row-actions";

// A table's actions, the way the karaoke panel draws a booking's: rows of
// the list's ⋯ menu, or one row of same-size buttons on the table's page
// (admin audit KAR-05: the old card mixed 12 px links and 16 px buttons).
// Each repeated control carries the table's name for a screen reader
// (KAR-22). Server-safe: the buttons are client components with plain props.

/** Pasifleştir (asks first) or Etkinleştir, then Kodu yenile (asks first). */
function serviceActions(table: CafeTable, menu: boolean): ReactNode[] {
  const out: ReactNode[] = [];
  out.push(
    table.isActive ? (
      <ConfirmButton
        key="active"
        action={setCafeTableActiveAction}
        hidden={{ id: table.id, isActive: "false" }}
        label="Pasifleştir"
        ariaLabel={`Pasifleştir: ${table.name}`}
        variant={menu ? "menu" : "ghost"}
        title={`${table.name} pasifleşsin mi?`}
        description="Masanın QR'ı menüyü açmaya devam eder ama bu masaya sipariş verilemez. Kod değişmez; istediğin zaman yeniden etkinleştirebilirsin."
      />
    ) : (
      <ActionButton
        key="active"
        action={setCafeTableActiveAction}
        hidden={{ id: table.id, isActive: "true" }}
        ariaLabel={`Etkinleştir: ${table.name}`}
        variant={menu ? "menu" : "ghost"}
        pendingLabel="Etkinleştiriliyor…"
      >
        Etkinleştir
      </ActionButton>
    ),
  );
  out.push(
    <ConfirmButton
      key="rotate"
      action={rotateCafeTableCodeAction}
      hidden={{ id: table.id }}
      label="Kodu yenile"
      ariaLabel={`Kodu yenile: ${table.name}`}
      variant={menu ? "menuDanger" : "danger"}
      title={`${table.name} için kod yenilensin mi?`}
      description="Masadaki basılı QR hemen çalışmaz olur. Yeni kartı yazdırıp eskisini masadan hemen kaldırman gerekir."
      confirmLabel="Kodu yenile"
    />,
  );
  return out;
}

/** The list row's ⋯ menu. */
export function CafeTableRowMenu({ table }: { table: CafeTable }) {
  return (
    <ActionMenu label={`${table.name} işlemleri`}>
      <ActionMenuLink href={cafeTableHref(table.id)}>Görüntüle</ActionMenuLink>
      <ActionMenuLink href={cafeTableEditHref(table.id)}>
        Düzenle
      </ActionMenuLink>
      <ActionMenuLink href={cafeTablePrintHref(table.id)}>
        Kartı yazdır
      </ActionMenuLink>
      {/* A route handler's download, not a page: a plain link. */}
      <a href={cafeTableQrHref(table.id)} download className={BUTTON.menu}>
        SVG indir
      </a>
      <CopyTableLink
        url={tableUrl(table.code)}
        tableName={table.name}
        variant="menu"
      />
      <ActionMenuSeparator />
      {serviceActions(table, true)}
    </ActionMenu>
  );
}

/** The table page's buttons, all one size. */
export function CafeTablePageActions({ table }: { table: CafeTable }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <Link href={cafeTableEditHref(table.id)} className={BUTTON.ghost}>
        Düzenle
      </Link>
      <Link href={cafeTablePrintHref(table.id)} className={BUTTON.ghost}>
        Kartı yazdır
      </Link>
      <a
        href={cafeTableQrHref(table.id)}
        download
        className={BUTTON.ghost}
        aria-label={`SVG indir: ${table.name}`}
      >
        SVG indir
      </a>
      <CopyTableLink url={tableUrl(table.code)} tableName={table.name} />
      {serviceActions(table, false)}
    </div>
  );
}

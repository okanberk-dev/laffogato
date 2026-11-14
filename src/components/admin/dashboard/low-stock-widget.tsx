import Link from "@/components/link";
import type { LowStockRow } from "@/lib/admin/store";

import { Badge } from "../ui/badge";
import { WidgetCard } from "./widget-card";

/**
 * Active products at or under their low-stock line, the emptiest first
 * (decision D38). Each row opens where that role fixes stock: the product
 * for owner and manager, the stock page for staff.
 */
export function LowStockWidget({
  rows,
  count,
  productHref,
  allHref,
}: {
  rows: readonly LowStockRow[];
  count: number;
  productHref: (id: string) => string | null;
  allHref: string | null;
}) {
  return (
    <WidgetCard title="Azalan stok" href={count > 0 ? allHref : null}>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--admin-text-soft)]">
          Satıştaki her ürünün stoğu yeterli.
        </p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-[var(--admin-border)]">
            {rows.map((p) => {
              const href = productHref(p.id);
              const inner = (
                <>
                  <span title={p.name} className="min-w-0 truncate">
                    {p.name}
                  </span>
                  {p.stock <= 0 ? (
                    <Badge tone="danger">Tükendi</Badge>
                  ) : (
                    <Badge tone="warning">{p.stock} kaldı</Badge>
                  )}
                </>
              );
              const row =
                "flex min-h-11 pointer-fine:min-h-9 items-center justify-between gap-3 py-1 text-sm text-[var(--admin-text)]";
              return (
                <li key={p.id}>
                  {href ? (
                    <Link
                      href={href}
                      className={`${row} hover:text-[var(--admin-primary)]`}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className={row}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {count > rows.length ? (
            <p className="mt-2 text-xs text-[var(--admin-text-soft)]">
              ve {count - rows.length} ürün daha
            </p>
          ) : null}
        </>
      )}
    </WidgetCard>
  );
}

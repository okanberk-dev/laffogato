import Link from "next/link";

import type { AdminAuditLog } from "@/lib/admin/audit";
import { AUDIT_LOG_PATH } from "@/lib/admin/audit-view";
import { auditActorLabel } from "@/lib/admin/karaoke-panel";
import { withParams } from "@/lib/admin/list-params";
import {
  menuAuditSummary,
  menuItemCopyHref,
  menuItemEditHref,
  menuItemHref,
  menuTagChip,
} from "@/lib/admin/menu-panel";
import type { AdminMenuItem } from "@/lib/admin/store";
import { timeAgo } from "@/lib/admin/time-ago";
import {
  MENU_ALLERGENS,
  NUTS_ALLERGEN,
  normalizeMenuAllergens,
} from "@/lib/menu/allergens";

import { formatDateTime, formatTRY } from "./forms";
import { SoldOutToggleRow } from "./menu-list";
import { Badge, BUTTON, NUMERIC_STYLE } from "./ui";
import { ListSearchButton } from "./ui/list-search-button";
import { QuickLook } from "./ui/quick-look";
import {
  QuickLookActionLink,
  QuickLookActions,
  QuickLookActivity,
  QuickLookChips,
  QuickLookPhoto,
  QuickLookSection,
  QuickLookStates,
} from "./ui/quick-look-parts";
import { CODE_STYLE } from "./ui/styles";

/** The changes the drawer lists; the rest are in the audit log. */
export const QUICK_LOOK_CHANGES = 5;

/**
 * A cafe menu item in the menu's quick look (Innex's right drawer, recipe
 * §3.8): the photo, its code, category and tags, "Satış durumu" beside its
 * prices, its allergens as chips (TGK Ek-1, "Tümünü göster" past four),
 * the steps (Tükendi / Satışa aç, the price, a copy) and, for the owner,
 * its last changes from the audit log. A manager, who does not read the
 * log, gets the time of the last change instead.
 */
export function MenuQuickLook({
  item,
  categoryLabel,
  photo,
  taxRate,
  changes,
  closeHref,
  selfHref,
  now,
}: {
  item: AdminMenuItem;
  categoryLabel: string;
  /** The served photo URL, or "". */
  photo: string;
  /** The item's KDV rate, whole %. */
  taxRate: number;
  /** Its newest audit rows, newest first; null when the role reads no log. */
  changes: readonly AdminAuditLog[] | null;
  closeHref: string;
  selfHref: string;
  now: Date;
}) {
  const allergens = normalizeMenuAllergens(item.allergens);
  const twoSizes = item.priceMinorL > 0;

  return (
    <QuickLook
      title={item.name}
      eyebrow={`Menü kalemi · ${categoryLabel}`}
      subtitle={item.desc || undefined}
      closeHref={closeHref}
      selfHref={selfHref}
      footer={
        <>
          <Link href={menuItemHref(item.id)} className={BUTTON.ghost}>
            Tam sayfa
          </Link>
          <Link href={menuItemEditHref(item.id)} className={BUTTON.primary}>
            Düzenle
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <QuickLookPhoto src={photo} fallback="menu" />
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="mr-1 text-xs text-[var(--admin-text-soft)]"
            style={CODE_STYLE}
          >
            {item.id}
          </span>
          {item.tags.map((t) => {
            const chip = menuTagChip(t);
            return (
              <Badge
                key={t}
                tone={t === "nuts" ? "warning" : "neutral"}
                className="normal-case"
              >
                {chip.label}
              </Badge>
            );
          })}
        </div>
      </div>

      <QuickLookStates
        items={[
          {
            label: "Satış durumu",
            value: (
              <Badge tone={item.isActive ? "success" : "neutral"} dot>
                {item.isActive ? "Satışta" : "Tükendi"}
              </Badge>
            ),
            hint: item.isActive
              ? "Menüde, sitede ve uygulamada."
              : "Menüden gizli; silinmedi.",
          },
          {
            label: twoSizes ? "Fiyat (M / L)" : "Fiyat",
            value: (
              <span style={NUMERIC_STYLE}>
                {formatTRY(item.priceMinor)}
                {twoSizes ? ` / ${formatTRY(item.priceMinorL)}` : ""}
              </span>
            ),
            hint: `KDV dahil · %${taxRate}`,
          },
        ]}
      />

      <QuickLookSection title="Alerjenler">
        {allergens === null ? (
          <p className="text-sm text-[var(--admin-warning)]">
            Girilmemiş: menüde ve uygulamada &quot;baristaya danış&quot; yazar.
            Düzenle&apos;den işaretle.
          </p>
        ) : allergens.length === 0 ? (
          <p className="text-sm text-[var(--admin-text-soft)]">
            On dört gruptan hiçbirini içermiyor.
          </p>
        ) : (
          <QuickLookChips
            chips={allergens.map((key) => ({
              key,
              chip: (
                <Badge
                  tone={key === NUTS_ALLERGEN ? "warning" : "neutral"}
                  className="normal-case"
                >
                  {MENU_ALLERGENS.find((a) => a.key === key)?.label ?? key}
                </Badge>
              ),
            }))}
          />
        )}
      </QuickLookSection>

      <QuickLookSection title="İşlemler">
        <QuickLookActions>
          <SoldOutToggleRow
            item={{ id: item.id, name: item.name, isActive: item.isActive }}
          />
          <QuickLookActionLink
            href={menuItemEditHref(item.id)}
            icon="price"
            hue="green"
            title="Fiyatı değiştir"
            description={
              twoSizes ? "M ve L fiyatları, KDV oranı." : "Fiyat ve KDV oranı."
            }
          />
          <QuickLookActionLink
            href={menuItemCopyHref(item.id)}
            icon="copy"
            hue="violet"
            title="Kopyala"
            description="Aynı kalemden yenisi: buzlusu, büyüğü."
          />
        </QuickLookActions>
      </QuickLookSection>

      {changes ? (
        <QuickLookSection
          title="Son değişiklikler"
          action={
            <ListSearchButton
              href={withParams({}, { entity: "menu_item" }, AUDIT_LOG_PATH)}
              terms={{ entityId: item.id }}
              className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
              ariaLabel={`Tümü: ${item.name} olay kaydı`}
            >
              Tümü
            </ListSearchButton>
          }
        >
          <QuickLookActivity
            empty="Olay kaydında bu kalemin değişikliği yok."
            events={changes.map((c) => ({
              key: c.id,
              title: menuAuditSummary(c, formatTRY),
              meta: [timeAgo(c.createdAt, now), auditActorLabel(c.actor)]
                .filter(Boolean)
                .join(" · "),
            }))}
          />
        </QuickLookSection>
      ) : (
        <p className="text-xs text-[var(--admin-text-soft)]">
          Son değişiklik {formatDateTime(item.updatedAt)}
        </p>
      )}
    </QuickLook>
  );
}

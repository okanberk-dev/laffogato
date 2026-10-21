import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/admin/back-link";
import { formatDateTime, formatTRY } from "@/components/admin/forms";
import {
  DeleteMenuItem,
  MenuTags,
  SoldOutToggle,
} from "@/components/admin/menu-list";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  Badge,
  BUTTON,
  KeyValueGrid,
  NUMERIC_STYLE,
  Section,
} from "@/components/admin/ui";
import { EYEBROW, MONO_STYLE } from "@/components/admin/ui/styles";
import { requireRole } from "@/lib/admin/auth";
import { imageVersion } from "@/lib/admin/image-bytes";
import { menuImagePath, servedImage } from "@/lib/admin/image-url";
import {
  MENU_PATH,
  menuItemCopyHref,
  menuItemEditHref,
} from "@/lib/admin/menu-panel";
import {
  getMenuItem,
  getSettings,
  MENU_CATEGORY_LABELS,
} from "@/lib/admin/store";
import { kdvRateLabel, menuItemTaxRate } from "@/lib/utils/kdv";

export const metadata = { title: "Admin · Menü kalemi" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * One menu item, read-only (Filament's view page, admin audit P2b / D37):
 * its prices, tags, Sıra and photo, with "Düzenle" and the one-click
 * "Tükendi". The list had no page per item. Server-rendered; the toggle
 * gets the id, the name and the state, nothing else.
 */
export default async function MenuItemPage({ params }: PageProps) {
  await requireRole("menu");
  const { id } = await params;
  const [item, settings] = await Promise.all([getMenuItem(id), getSettings()]);
  if (!item) notFound();

  const rate = menuItemTaxRate(item, settings.taxRates);
  const ownRate = item.taxRatePct !== null && item.taxRatePct !== undefined;
  const photo = item.image
    ? servedImage(item.image, menuImagePath(item.id, imageVersion(item.image)))
    : "";

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <BackLink href={MENU_PATH}>Kafe menüsü</BackLink>

      <header className="mb-6 flex flex-col gap-3">
        <div className={EYEBROW} style={MONO_STYLE}>
          Menü kalemi ·{" "}
          {MENU_CATEGORY_LABELS[item.categoryKey] ?? item.categoryKey}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight break-words text-[var(--admin-text)] sm:text-3xl">
          {item.name}
        </h1>
        <span>
          <Badge tone={item.isActive ? "success" : "neutral"} dot>
            {item.isActive ? "Satışta" : "Tükendi"}
          </Badge>
        </span>
        <div className="flex flex-wrap items-start gap-2">
          <Link href={menuItemEditHref(item.id)} className={BUTTON.primary}>
            Düzenle
          </Link>
          <SoldOutToggle
            item={{ id: item.id, name: item.name, isActive: item.isActive }}
          />
          <ActionMenu label={`${item.name} işlemleri`} framed>
            <ActionMenuLink href={menuItemCopyHref(item.id)}>
              Kopyala
            </ActionMenuLink>
            <ActionMenuSeparator />
            <DeleteMenuItem item={{ id: item.id, name: item.name }} thenList />
          </ActionMenu>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <Section title="Kalem">
          <KeyValueGrid
            items={[
              {
                label: item.priceMinorL > 0 ? "Fiyat (M)" : "Fiyat",
                value: (
                  <span style={NUMERIC_STYLE}>
                    {formatTRY(item.priceMinor)}
                  </span>
                ),
                hint: "KDV dahil.",
              },
              {
                label: "Fiyat (L)",
                value:
                  item.priceMinorL > 0 ? (
                    <span style={NUMERIC_STYLE}>
                      {formatTRY(item.priceMinorL)}
                    </span>
                  ) : (
                    ""
                  ),
                hint: item.priceMinorL > 0 ? undefined : "Tek boy.",
              },
              {
                label: "KDV oranı",
                value: kdvRateLabel(rate),
                hint: ownRate
                  ? "Kalemin kendi oranı."
                  : "Menünün varsayılanı (Ayarlar · Vergi).",
              },
              {
                label: "Kategori",
                value:
                  MENU_CATEGORY_LABELS[item.categoryKey] ?? item.categoryKey,
              },
              {
                label: "Sıra",
                value: (
                  <span style={NUMERIC_STYLE}>
                    {String(item.sortOrder).padStart(2, "0")}
                  </span>
                ),
                hint: "Kategorisinde küçükten büyüğe.",
              },
              {
                label: "Etiketler",
                value:
                  item.tags.length > 0 ? <MenuTags tags={item.tags} /> : "",
              },
              { label: "Açıklama", value: item.desc, full: true },
            ]}
          />
        </Section>

        <Section title="Fotoğraf">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={item.name}
              loading="lazy"
              className="aspect-square w-full rounded-xl object-cover ring-1 ring-[var(--admin-border)]"
            />
          ) : (
            <p className="text-sm text-[var(--admin-text-soft)]">
              Fotoğraf yok; menü kalemin çizimini gösterir.
            </p>
          )}
        </Section>
      </div>

      <p className="mt-6 text-xs text-[var(--admin-text-soft)]">
        Son değişiklik {formatDateTime(item.updatedAt)}
      </p>
    </main>
  );
}

import Link from "next/link";

import { TONE_RULE, TONE_SOFT } from "@/components/admin/ui/tone";
import { normalizeMenuAllergens } from "@/lib/menu/allergens";
import {
  menuPricesDateLabel,
  menuPricesDateStale,
} from "@/lib/menu/price-list";

/**
 * What the menu still owes a guest before they order (18 Oct 2026): every
 * item's allergens (TGK Etiketleme Yön. m.15/5) and the day the prices
 * started to apply (Fiyat Etiketi Yön. m.5/2-d). An item without allergens
 * shows nothing next to it on the site, and the app keeps "Alerjenler için
 * baristaya danış."; the count says how far the panel is from done.
 */
export function MenuFoodInfoStatus({
  items,
  priceDate,
  pricesChangedAt = "",
}: {
  items: ReadonlyArray<{ allergens?: unknown }>;
  /** `settings.menuPricesEffectiveDate`, "" when not entered. */
  priceDate: string;
  /** `settings.menuPricesChangedAt`: the last price change, here or from the köşk's panel. */
  pricesChangedAt?: string;
}) {
  const missing = items.filter(
    (it) => normalizeMenuAllergens(it.allergens) === null,
  ).length;
  const dateLabel = menuPricesDateLabel(priceDate);
  const staleDay = menuPricesDateStale(priceDate, pricesChangedAt);
  const tone =
    missing > 0 || !dateLabel || staleDay ? "warning" : "success";
  return (
    <div
      data-testid="menu-food-info-status"
      className={`mb-4 grid gap-1.5 rounded-xl border-l-4 px-3.5 py-2.5 text-sm ${TONE_SOFT[tone]} ${TONE_RULE[tone]}`}
    >
      <p>
        {missing > 0 ? (
          <>
            <strong>
              Alerjeni girilmemiş kalem: {missing} / {items.length}.
            </strong>{" "}
            Bu kalemlerin yanında menüde alerjen yazmaz. Köşkteki alerjen
            tablosuna bakarak her kalemi aç ve Alerjenler kutularını işaretle.
          </>
        ) : (
          <strong>
            Alerjenler bütün kalemlerde girildi ({items.length} / {items.length}
            ).
          </strong>
        )}
      </p>
      <p>
        {dateLabel && staleDay ? (
          <>
            <strong>
              Fiyatlar {menuPricesDateLabel(staleDay)} günü değişti; fiyat
              listesinin tarihi hâlâ {dateLabel}.
            </strong>{" "}
            Tarihi{" "}
            <Link href="/admin/ayarlar?sekme=tax" className="underline">
              Ayarlar &gt; Vergi
            </Link>
            &apos;den o güne çek ve köşkteki basılı listeleri yenile.
          </>
        ) : dateLabel ? (
          <>
            <strong>Fiyat listesinin tarihi: {dateLabel}.</strong> Bir fiyatı
            değiştirdiğin gün bu tarihi de{" "}
            <Link href="/admin/ayarlar?sekme=tax" className="underline">
              Ayarlar &gt; Vergi
            </Link>
            &apos;den o güne çek ve köşkteki basılı listeleri yenile.
          </>
        ) : (
          <>
            <strong>Fiyat listesinin tarihi girilmedi.</strong> Menünün altında
            fiyatların uygulanmaya başladığı gün yazmaz;{" "}
            <Link href="/admin/ayarlar?sekme=tax" className="underline">
              Ayarlar &gt; Vergi
            </Link>
            &apos;den gir.
          </>
        )}
      </p>
    </div>
  );
}

import { TONE_RULE, TONE_SOFT } from "@/components/admin/ui/tone";
import { normalizeMenuAllergens } from "@/lib/menu/allergens";

/**
 * What the menu still owes a guest before they order (18 Oct 2026): every
 * item's allergens (TGK Etiketleme Yön. m.15/5). An item without them shows
 * nothing next to it on the site, and the app keeps "Alerjenler için
 * baristaya danış."; the count says how far the panel is from done.
 */
export function MenuFoodInfoStatus({
  items,
}: {
  items: ReadonlyArray<{ allergens?: unknown }>;
}) {
  const missing = items.filter(
    (it) => normalizeMenuAllergens(it.allergens) === null,
  ).length;
  const tone = missing > 0 ? "warning" : "success";
  return (
    <p
      data-testid="menu-allergen-status"
      className={`mb-4 rounded-xl border-l-4 px-3.5 py-2.5 text-sm ${TONE_SOFT[tone]} ${TONE_RULE[tone]}`}
    >
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
          Alerjenler bütün kalemlerde girildi ({items.length} / {items.length}).
        </strong>
      )}
    </p>
  );
}

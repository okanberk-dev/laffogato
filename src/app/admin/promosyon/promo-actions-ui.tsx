import { ActionButton } from "@/components/admin/action-form";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  ConfirmButton,
} from "@/components/admin/ui";
import { promoEditHref, promoHref } from "@/lib/admin/promo-list";
import type { AdminPromo } from "@/lib/admin/store";

import { deletePromoAction, setPromoActiveAction } from "./actions";

/**
 * The promo list's and the view page's buttons. Server-safe: the client
 * parts are the kit's ActionButton and ConfirmButton.
 */

/** Aktif / Pasif in one click; the answer as a toast. */
export function PromoActiveToggle({
  promo,
  variant = "ghost",
}: {
  promo: AdminPromo;
  variant?: "ghost" | "primary";
}) {
  return (
    <ActionButton
      action={setPromoActiveAction}
      hidden={{ id: promo.id, isActive: promo.isActive ? "false" : "true" }}
      pendingLabel="Kaydediliyor…"
      variant={variant}
      ariaLabel={`${promo.isActive ? "Pasife al" : "Aktifleştir"}: ${promo.code}`}
      title={
        promo.isActive
          ? "Kodu durdur: sepette kabul edilmez"
          : "Kodu yeniden sepete aç"
      }
    >
      {promo.isActive ? "Pasife al" : "Aktifleştir"}
    </ActionButton>
  );
}

/**
 * The row's ⋯ menu. "Sil" lives here only: on the view page a deleted code
 * would leave the operator on a page that no longer exists.
 */
export function PromoRowMenu({ promo }: { promo: AdminPromo }) {
  return (
    <ActionMenu label={`${promo.code} işlemleri`}>
      <ActionMenuLink href={promoHref(promo.id)}>Ayrıntı</ActionMenuLink>
      <ActionMenuLink href={promoEditHref(promo.id)}>Düzenle</ActionMenuLink>
      <ActionMenuSeparator />
      <ConfirmButton
        action={deletePromoAction}
        hidden={{ id: promo.id }}
        label="Sil"
        variant="menuDanger"
        title={`${promo.code} silinsin mi?`}
        description="Kod kalıcı olarak silinir; daha önce kullanıldığı siparişlerdeki kayıt kalır. Yalnız durdurmak istiyorsan pasife al."
      />
    </ActionMenu>
  );
}

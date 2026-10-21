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

/** The row's ⋯ menu. */
export function PromoRowMenu({ promo }: { promo: AdminPromo }) {
  return (
    <ActionMenu label={`${promo.code} işlemleri`}>
      <ActionMenuLink href={promoHref(promo.id)}>Ayrıntı</ActionMenuLink>
      <ActionMenuLink href={promoEditHref(promo.id)}>Düzenle</ActionMenuLink>
      <ActionMenuSeparator />
      <DeletePromo promo={promo} />
    </ActionMenu>
  );
}

/**
 * "Sil" in a ⋯ menu: a confirm dialog, then a toast. On the code's own page
 * (`thenList`) the page has nothing left to show, so the answer is the
 * list, with the toast.
 */
export function DeletePromo({
  promo,
  thenList = false,
}: {
  promo: Pick<AdminPromo, "id" | "code">;
  thenList?: boolean;
}) {
  return (
    <ConfirmButton
      action={deletePromoAction}
      hidden={thenList ? { id: promo.id, then: "list" } : { id: promo.id }}
      label="Sil"
      ariaLabel={`Sil: ${promo.code}`}
      variant="menuDanger"
      title={`${promo.code} silinsin mi?`}
      description="Kod kalıcı olarak silinir; daha önce kullanıldığı siparişlerdeki kayıt kalır. Yalnız durdurmak istiyorsan pasife al."
    />
  );
}

import { ActionButton } from "@/components/admin/action-form";
import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  ConfirmButton,
} from "@/components/admin/ui";
import type { ButtonVariant } from "@/components/admin/ui/styles";
import type { AdminTone } from "@/lib/admin/tone";
import {
  FRANCHISE_STATUSES,
  type FranchiseStatus,
} from "@/lib/franchise/franchise-core";
import type { FranchiseApplication } from "@/lib/franchise/store";

import {
  deleteFranchiseApplicationAction,
  setFranchiseStatusAction,
} from "./actions";

export const FRANCHISE_PATH = "/admin/franchise";

export function franchiseHref(id: string): string {
  return `${FRANCHISE_PATH}/${encodeURIComponent(id)}`;
}

export const FRANCHISE_STATUS_TONES: Record<FranchiseStatus, AdminTone> = {
  new: "info",
  contacted: "success",
  archived: "neutral",
};

/** The verb for moving to a status ("Görüşüldü yap"). */
const MOVE_LABEL: Record<FranchiseStatus, string> = {
  new: "Yeniye al",
  contacted: "Görüşüldü yap",
  archived: "Arşivle",
};

/**
 * The application page's buttons: the two statuses it is not in, then
 * "Sil" behind a confirm. Server-safe: the client parts are the kit's.
 */
export function FranchiseStatusButtons({
  app,
}: {
  app: Pick<FranchiseApplication, "id" | "name" | "status">;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FRANCHISE_STATUSES.filter((s) => s !== app.status).map((s) => (
        <ActionButton
          key={s}
          action={setFranchiseStatusAction}
          hidden={{ id: app.id, status: s }}
          variant={s === "contacted" ? "primary" : "ghost"}
        >
          {MOVE_LABEL[s]}
        </ActionButton>
      ))}
      <DeleteFranchise app={app} back />
    </div>
  );
}

function DeleteFranchise({
  app,
  back = false,
  variant,
}: {
  app: Pick<FranchiseApplication, "id" | "name">;
  back?: boolean;
  variant?: ButtonVariant;
}) {
  return (
    <ConfirmButton
      action={deleteFranchiseApplicationAction}
      hidden={back ? { id: app.id, back: "list" } : { id: app.id }}
      label="Sil"
      variant={variant}
      ariaLabel={`Sil: ${app.name}`}
      title={`${app.name} başvurusu silinsin mi?`}
      description="Başvuru ve onay kaydı kalıcı olarak silinir. Silinmezse başvurudan 12 ay sonra kendiliğinden silinir."
    />
  );
}

/** The list's ⋯ menu. */
export function FranchiseRowMenu({ app }: { app: FranchiseApplication }) {
  return (
    <ActionMenu label={`${app.name} işlemleri`}>
      <ActionMenuLink href={franchiseHref(app.id)}>Başvuruyu aç</ActionMenuLink>
      {FRANCHISE_STATUSES.filter((s) => s !== app.status).map((s) => (
        <ActionButton
          key={s}
          action={setFranchiseStatusAction}
          hidden={{ id: app.id, status: s }}
          variant="menu"
        >
          {MOVE_LABEL[s]}
        </ActionButton>
      ))}
      <ActionMenuSeparator />
      <DeleteFranchise app={app} variant="menuDanger" />
    </ActionMenu>
  );
}

import {
  ActionMenu,
  ActionMenuLink,
  ActionMenuSeparator,
  ConfirmButton,
} from "@/components/admin/ui";
import type { ButtonVariant } from "@/components/admin/ui/styles";
import { subscriberHref } from "@/lib/admin/newsletter-list";
import type { NewsletterSubscriber } from "@/lib/newsletter/store";

import {
  deactivateNewsletterAction,
  deleteNewsletterSubscriberAction,
} from "./actions";

/**
 * The Bülten list's ⋯ menu and the view page's button. Server-safe: the
 * client parts are the kit's ConfirmButton.
 *
 * Off only: re-subscribing is the person's own act, confirmed from their
 * inbox (6563).
 */
export function DeactivateSubscriber({
  subscriber,
  variant = "ghost",
}: {
  subscriber: Pick<NewsletterSubscriber, "id" | "email">;
  variant?: ButtonVariant;
}) {
  return (
    <ConfirmButton
      action={deactivateNewsletterAction}
      hidden={{ id: subscriber.id }}
      label="Pasifleştir"
      variant={variant}
      ariaLabel={`Pasifleştir: ${subscriber.email}`}
      title={`${subscriber.email} pasifleşsin mi?`}
      description="Bu adrese bülten gitmez. Panelden geri açılamaz; kişi yeniden abone olup e-postasından onaylamalı."
    />
  );
}

/** "Sil" lives here only: on the view page it would leave a dead page. */
export function SubscriberRowMenu({
  subscriber,
}: {
  subscriber: NewsletterSubscriber;
}) {
  return (
    <ActionMenu label={`${subscriber.email} işlemleri`}>
      <ActionMenuLink href={subscriberHref(subscriber.id)}>
        Onay kaydı
      </ActionMenuLink>
      {subscriber.isActive ? (
        <DeactivateSubscriber subscriber={subscriber} variant="menu" />
      ) : null}
      <ActionMenuSeparator />
      <ConfirmButton
        action={deleteNewsletterSubscriberAction}
        hidden={{ id: subscriber.id }}
        label="Sil"
        variant="menuDanger"
        title={`${subscriber.email} silinsin mi?`}
        description="Abone ve onay kaydı (tarih, IP, metin) kalıcı olarak silinir. Şikâyette onayı göstermen gerekebilir: yalnız göndermeyi durdurmak için Pasifleştir yeterli."
      />
    </ActionMenu>
  );
}

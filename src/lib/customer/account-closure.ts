import type { IdentityDeletion } from "@/lib/supabase/admin";

/**
 * What the site tells a member after `/uye/hesap/sil` closed their account.
 *
 * Since 18 Eki 2026 that page no longer closes anything: it sends the team
 * a request (`requestAccountDeletionAction`) and the team closes the
 * account from the panel. The notice stays for the `/?hesap=` links already
 * out there (front-end contract item 4).
 *
 * `deleteMe` always anonymises the member row, but the Supabase sign-in
 * identity - which still carries the e-mail address and the name - is deleted
 * only when the deployment holds the service-role key and the delete
 * succeeds (`identity === "deleted"`). The app already says "kişisel
 * bilgilerin silindi" on `deleted` alone (docs/API-MOBILE.md §4, O28); the
 * site used to say "Kişisel verilerin silindi ya da anonimleştirildi" after
 * every closure, including the ones that left the identity in place.
 *
 * The outcome travels as `/?hesap=<value>` because the action ends in a
 * redirect. Anything but `deleted` - `skipped`, `failed`, a missing or
 * unknown value - gets the short sentence, the same rule the contract sets
 * for the app.
 */
export type AccountClosureParam = "silindi" | "kapatildi";

export function accountClosureParam(
  identity: IdentityDeletion | undefined | null,
): AccountClosureParam {
  return identity === "deleted" ? "silindi" : "kapatildi";
}

const NOTICES: Record<AccountClosureParam, string> = {
  silindi: "Hesabın silindi. Kişisel verilerin silindi ya da anonimleştirildi.",
  kapatildi: "Hesabın kapatıldı.",
};

/** The home page's notice for `?hesap=`, or undefined for anything else. */
export function accountClosureNotice(
  param: string | undefined,
): string | undefined {
  return param === "silindi" || param === "kapatildi"
    ? NOTICES[param]
    : undefined;
}

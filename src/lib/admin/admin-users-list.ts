import "server-only";

import { createHash } from "node:crypto";

import { firstParam, type SearchParamsInput } from "./list-params";
import { ADMIN_ROLES } from "./roles";
import type { PublicAdminUser } from "./users";

/**
 * How the Kullanıcılar list reads its panel accounts, and the key a user's
 * page is found by.
 *
 * A panel account's only id is its e-mail (the table's primary key), and a
 * page per account would have put that address in the URL: the browser's
 * history, a proxy's log, the host's request log. The page is found by an
 * opaque key derived from the address instead; the list is a handful of
 * accounts, so the page reads them all and picks the one whose key matches.
 */

export const ADMIN_USERS_PATH = "/admin/kullanicilar";

/** Sixteen URL-safe characters of a hash: stable, and not the address. */
export function adminUserKey(email: string): string {
  return createHash("sha256")
    .update(`admin-user:${email.trim().toLowerCase()}`)
    .digest("base64url")
    .slice(0, 16);
}

export function adminUserHref(email: string): string {
  return `${ADMIN_USERS_PATH}/${adminUserKey(email)}`;
}

export function findAdminUserByKey<T extends Pick<PublicAdminUser, "email">>(
  users: readonly T[],
  key: string,
): T | null {
  if (!/^[A-Za-z0-9_-]{16}$/.test(key)) return null;
  return users.find((u) => adminUserKey(u.email) === key) ?? null;
}

export type AdminUserTab = "tumu" | "aktif" | "pasif";

export const ADMIN_USER_TAB_PARAM = "durum";

export const ADMIN_USER_TABS: ReadonlyArray<{
  tab: AdminUserTab;
  value: string | null;
  label: string;
}> = [
  { tab: "tumu", value: null, label: "Tümü" },
  { tab: "aktif", value: "aktif", label: "Aktif" },
  { tab: "pasif", value: "pasif", label: "Pasif" },
];

export function parseAdminUserTab(sp: SearchParamsInput): AdminUserTab {
  const raw = firstParam(sp, ADMIN_USER_TAB_PARAM) ?? "";
  return ADMIN_USER_TABS.find((t) => t.value === raw)?.tab ?? "tumu";
}

/**
 * The accounts in a tab, the most privileged first (Sahip, Yönetici,
 * Personel, Kasiyer), then by address; and every tab's count.
 */
export function adminUsersList<
  T extends Pick<PublicAdminUser, "email" | "role" | "isActive">,
>(
  users: readonly T[],
  tab: AdminUserTab,
): { rows: T[]; counts: Record<AdminUserTab, number> } {
  const counts: Record<AdminUserTab, number> = { tumu: 0, aktif: 0, pasif: 0 };
  const rows: T[] = [];
  for (const u of users) {
    const state: AdminUserTab = u.isActive ? "aktif" : "pasif";
    counts.tumu += 1;
    counts[state] += 1;
    if (tab === "tumu" || tab === state) rows.push(u);
  }
  rows.sort(
    (a, b) =>
      ADMIN_ROLES.indexOf(a.role) - ADMIN_ROLES.indexOf(b.role) ||
      a.email.localeCompare(b.email),
  );
  return { rows, counts };
}

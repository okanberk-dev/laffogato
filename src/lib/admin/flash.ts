import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import {
  ADMIN_FLASH_COOKIE,
  ADMIN_FLASH_MAX_AGE,
  ADMIN_FLASH_PATH,
  decodeFlash,
  encodeFlash,
  type AdminFlash,
  type AdminFlashTone,
} from "./flash-core";

/**
 * Leave a toast for the page a Server Action redirects to:
 *
 *   await setAdminFlash("Sipariş oluşturuldu.");
 *   redirect(`/admin/siparisler/${order.id}`);
 *
 * Only for actions that REDIRECT. An action that stays on the page returns an
 * ActionResult and ActionModal shows the toast itself.
 *
 * Not httpOnly on purpose: the panel deletes it from the browser as soon as
 * the toast is on screen (components/admin/ui/toast.tsx), which is what makes
 * it one-shot. It holds a message, never data or a secret.
 *
 * Callable from a Server Action or a Route Handler only (Next refuses to set
 * a cookie while a Server Component renders). This is a plain server module,
 * not a "use server" file, so it is not a public endpoint (rule 27).
 */
export async function setAdminFlash(
  message: string,
  tone: AdminFlashTone = "success",
): Promise<void> {
  const text = message.trim();
  if (!text) return;
  const store = await cookies();
  store.set(
    ADMIN_FLASH_COOKIE,
    encodeFlash({ id: randomUUID().slice(0, 12), message: text, tone }),
    {
      path: ADMIN_FLASH_PATH,
      maxAge: ADMIN_FLASH_MAX_AGE,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    },
  );
}

/** The pending flash, read by app/admin/layout.tsx; null when none. */
export async function readAdminFlash(): Promise<AdminFlash | null> {
  const store = await cookies();
  return decodeFlash(store.get(ADMIN_FLASH_COOKIE)?.value);
}

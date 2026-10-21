import "server-only";

import { redirect } from "next/navigation";

import { actionOk, type ActionResult } from "./action-result";
import { setAdminFlash } from "./flash";

/**
 * What a "Sil" answers once the row is gone. From a list's row it is the
 * toast itself. From the record's own page (the form posts `then=list`) that
 * page has nothing left to show, so the toast rides a flash to `list`, a
 * fixed path the action names (never one from the request).
 */
export async function deletedAnswer(
  formData: FormData,
  message: string,
  list: string,
): Promise<ActionResult> {
  if (formData.get("then") === "list") {
    await setAdminFlash(message);
    redirect(list);
  }
  return actionOk(message);
}

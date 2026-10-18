import "server-only";

import { listEnvAdminContacts } from "@/lib/admin/auth";
import { ADMIN_ROLES, canAccess } from "@/lib/admin/roles";
import { getSettings } from "@/lib/admin/store";
import { listAdminUsers } from "@/lib/admin/users";
import {
  buildDeletionStaffNotice,
  DELETION_ADMIN_PATH,
  deletionMailKey,
  maskedAddress,
  type DeletionStaffNoticeInput,
} from "@/lib/customer/deletion-request-core";
import { SITE } from "@/lib/seo/site";

import { deliverBatch, renderOperatorNotice, type SendResult } from "./send";
import { resolveStaffRecipients } from "./staff-order-notice-core";

/**
 * Tells the team about a web account-deletion request (opened, or taken
 * back), in the operator-notice design (`operasyon-bildirim`).
 *
 * Who: the panel accounts whose role may close an account (`customers`:
 * owner, manager), resolved exactly as the "yeni sipariş" mail resolves
 * its recipients (an active panel row decides the role, env break-glass
 * accounts otherwise), plus the operations address from Ayarlar →
 * Bildirimler - or, when that is empty, the shop's public address. The
 * order-notice switch and its role list do not apply: a KVKK application
 * has to reach somebody whatever the kitchen's mail settings are.
 *
 * One provider request for every inbox (`deliverBatch`) under one
 * idempotency key, so a retry cannot mail anyone twice. Never throws: the
 * request is already stored and listed in the panel; a mail that did not go
 * is logged (counts and a masked address only, rule 9) and answered `false`.
 */
export async function notifyStaffOfDeletionRequest(
  n: DeletionStaffNoticeInput,
): Promise<boolean> {
  try {
    const settings = await getSettings();
    let panelUsers: Awaited<ReturnType<typeof listAdminUsers>> = [];
    try {
      panelUsers = await listAdminUsers();
    } catch (err) {
      // The env accounts and the operations address still get it.
      console.error("[account-deletion] admin users unreadable", err);
    }
    const recipients = resolveStaffRecipients({
      enabled: true,
      roles: ADMIN_ROLES.filter((r) => canAccess("customers", r)),
      extraEmails: "",
      notificationEmail:
        settings.notificationEmail?.trim() || settings.email?.trim() || "",
      panelUsers,
      envAdmins: listEnvAdminContacts(),
    });
    if (recipients.length === 0) {
      console.error(
        `[account-deletion] no staff address for ${n.kind} ${n.customerId}`,
      );
      return false;
    }
    const content = buildDeletionStaffNotice(n);
    const rendered = renderOperatorNotice({
      ...content,
      to: recipients[0].email,
      button: { label: "PANELDE AÇ", url: `${SITE.url}${DELETION_ADMIN_PATH}` },
    });
    const result = await deliverBatch(
      recipients.map((r) => ({
        to: r.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      })),
      deletionMailKey(
        n.customerId,
        n.requestedAt,
        n.kind === "opened" ? "staff-opened" : "staff-withdrawn",
      ),
    );
    if (!result.ok) {
      console.error(
        `[account-deletion] staff mail failed ${n.kind} ${n.customerId} (${maskedAddress(n.email)}): ${result.error}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      `[account-deletion] staff mail not sent ${n.kind} ${n.customerId}`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/** A mail result for the log line, without the address (rule 9). */
export function logMemberMail(
  what: string,
  customerId: string,
  email: string,
  result: SendResult,
): void {
  if (result.ok) return;
  console.error(
    `[account-deletion] ${what} mail failed ${customerId} (${maskedAddress(email)}): ${result.error}`,
  );
}

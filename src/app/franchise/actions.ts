"use server";

import { headers } from "next/headers";
import { after } from "next/server";

import { clientIp, reserveLoginAttempt } from "@/lib/admin/rate-limit";
import { isDbUnreachable } from "@/lib/db/health";
import {
  FRANCHISE_HONEYPOT,
  franchiseApplicationSchema,
  franchiseFieldErrors,
  franchiseFormInput,
  type FranchiseFormState,
} from "@/lib/franchise/franchise-core";
import { notifyFranchiseApplication } from "@/lib/franchise/notify";
import { createFranchiseApplication } from "@/lib/franchise/store";

/**
 * The /franchise application form (operator, 22 Kas 2026). Public: no
 * session, so the checks are the form's own. The honeypot first (a script
 * that filled the hidden `website` box is told "thank you" and nothing is
 * stored or mailed), then the sender's daily budget, then the schema, then
 * the row; the team's mail goes after the response and cannot break it.
 *
 * Every field name here is the form's contract
 * (src/lib/franchise/franchise-core.ts FRANCHISE_FIELDS,
 * docs/FRONTEND-SINIR.md §2).
 */
export async function submitFranchiseApplicationAction(
  _prev: FranchiseFormState,
  formData: FormData,
): Promise<FranchiseFormState> {
  const trap = formData.get(FRANCHISE_HONEYPOT);
  if (typeof trap === "string" && trap.trim() !== "") return { ok: true };

  const parsed = franchiseApplicationSchema.safeParse(
    franchiseFormInput(formData),
  );
  if (!parsed.success) {
    return {
      error: "Formda düzeltilecek alanlar var.",
      fieldErrors: franchiseFieldErrors(parsed.error),
    };
  }

  try {
    // Counted after the schema: a visitor fixing a typo does not spend the
    // day's budget, a stored application (or a failed attempt to store one)
    // does.
    const ip = await clientIp();
    const limit = await reserveLoginAttempt("franchise-apply-ip", ip, "*");
    if (limit.blocked) {
      return {
        error: `Bugün bu bağlantıdan çok fazla başvuru geldi. ${Math.ceil(limit.retryAfterSeconds / 3600)} saat sonra tekrar dene ya da bize e-postayla yaz.`,
      };
    }
    const h = await headers();
    const app = await createFranchiseApplication(parsed.data, {
      ip,
      userAgent: (h.get("user-agent") ?? "").slice(0, 300),
    });
    after(() => notifyFranchiseApplication(app));
    return { ok: true };
  } catch (err) {
    if (isDbUnreachable(err)) {
      return {
        error:
          "Başvurunu şu an kaydedemiyoruz. Birkaç dakika sonra tekrar dene.",
      };
    }
    // The error text can quote a value it refused: the message only, and
    // never the applicant's address or phone (CLAUDE.md rule 9).
    console.error(
      "[franchise/submit]",
      err instanceof Error ? err.message.slice(0, 200) : "unknown error",
    );
    return {
      error: "Başvurun gönderilemedi. Birkaç dakika sonra tekrar dene.",
    };
  }
}

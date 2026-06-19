"use server";

import { logAudit } from "@/lib/admin/audit";
import {
  createFranchiseApplication,
  type FranchiseApplicationInput,
} from "@/lib/franchise/store";

export interface FranchiseApplyResult {
  ok: boolean;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Public franchise application submission from the franchise page form. */
export async function submitFranchiseApplicationAction(
  input: FranchiseApplicationInput & { honeypot?: string },
): Promise<FranchiseApplyResult> {
  // Honeypot: a hidden field no human fills. Bots that auto-fill it get a
  // success response but no row is written — silent anti-spam.
  if (input.honeypot && input.honeypot.trim()) {
    return { ok: true };
  }

  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const phone = (input.phone ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Lütfen ad soyad gir." };
  if (!EMAIL_RE.test(email))
    return { ok: false, error: "Geçerli bir e-posta gir." };
  if (phone.length < 7) return { ok: false, error: "Geçerli bir telefon gir." };

  const app = await createFranchiseApplication({
    name,
    email,
    phone,
    city: input.city ?? "",
    experience: input.experience ?? "",
    budget: input.budget ?? "",
    package: input.package ?? "",
    message: input.message ?? "",
  });
  // Audit is secondary to lead capture — never let a logging hiccup surface as
  // a submission failure (which would prompt a duplicate resubmit).
  try {
    await logAudit({
      action: "create",
      entity: "franchise_application",
      entityId: app.id,
      payload: { city: app.city, package: app.package },
      actor: "public",
    });
  } catch {
    // non-fatal
  }
  return { ok: true };
}

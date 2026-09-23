import { NextResponse } from "next/server";

import {
  suppressionFrom,
  verifyResendSignature,
} from "@/lib/email/resend-webhook";
import { recordSuppression } from "@/lib/email/suppressions";

/**
 * Resend's delivery webhook - where a permanent bounce or a spam complaint
 * arrives, so the next campaign leaves that address out
 * (`email_suppressions`, docs/EMAIL-RESEND.md §7).
 *
 * **Inert until `RESEND_WEBHOOK_SECRET` is set** (the `whsec_...` signing
 * secret the Resend dashboard shows for this endpoint): an unset secret
 * answers 503, never 200, so nobody can suppress addresses by guessing the
 * URL. The operator registers `https://laffogato.net/api/webhooks/resend`
 * for `email.bounced` and `email.complained`.
 *
 * Status codes are messages to the sender's retry loop:
 *
 *   503  secret unset               - come back when configured
 *   401  missing, stale or wrong signature
 *   400  a signed body that is not JSON - retrying the same bytes cannot help
 *   500  the database refused the write - retry
 *   200  everything else, including events that suppress nothing (a
 *        delivery, an open, a transient bounce); the body says which
 *
 * No address is ever logged or echoed: only counts and the event type.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) return json({ error: "resend_webhook_secret_unset" }, 503);

  // The exact bytes that arrived: the signature is over these.
  const raw = await request.text();
  const headers = {
    id: request.headers.get("svix-id") ?? "",
    timestamp: request.headers.get("svix-timestamp") ?? "",
    signature: request.headers.get("svix-signature") ?? "",
  };
  const check = verifyResendSignature(secret, headers, raw);
  if (!check.ok) {
    if (check.reason === "bad_secret") {
      console.error("[webhooks/resend] RESEND_WEBHOOK_SECRET okunamadı");
    }
    return json({ error: "unauthorized", reason: check.reason }, 401);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const type =
    typeof body === "object" && body !== null
      ? String((body as { type?: unknown }).type ?? "")
      : "";
  const event = suppressionFrom(body);
  if (!event) return json({ ok: true, ignored: type || "unknown" }, 200);

  try {
    const recorded = await recordSuppression(event, headers.id.trim());
    return json({ ok: true, suppressed: recorded, reason: event.reason }, 200);
  } catch (err) {
    console.error(
      `[webhooks/resend] bastırma kaydı yazılamadı (${event.reason})`,
      err instanceof Error ? err.message : err,
    );
    return json({ error: "db_error" }, 500);
  }
}

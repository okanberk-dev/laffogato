import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resend's webhook signature (Svix): pure, so it can be tested without a
 * request.
 *
 * Every delivery carries three headers - `svix-id`, `svix-timestamp` (Unix
 * seconds) and `svix-signature` (space-separated `v1,<base64>` entries, more
 * than one while a secret is being rotated). The signed content is
 * `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 keyed with the base64 part of
 * the `whsec_...` secret. The body must be the exact bytes that arrived:
 * re-serialising parsed JSON changes them and fails every check.
 *
 * The timestamp is checked against a five-minute window so a captured
 * delivery cannot be replayed later.
 */

/** How far a delivery's timestamp may be from our clock, either way. */
export const RESEND_WEBHOOK_TOLERANCE_S = 5 * 60;

export interface SvixHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

export type SignatureCheck =
  | { ok: true }
  | {
      ok: false;
      reason: "missing_headers" | "bad_secret" | "stale" | "mismatch";
    };

/** The key bytes of a `whsec_<base64>` secret; `null` when unreadable. */
export function webhookKey(secret: string): Buffer | null {
  const trimmed = secret.trim();
  const b64 = trimmed.startsWith("whsec_") ? trimmed.slice(6) : trimmed;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  const key = Buffer.from(b64, "base64");
  return key.length > 0 ? key : null;
}

/** `v1,<base64>` for the given delivery, as Resend would sign it. */
export function signResendPayload(
  secret: string,
  id: string,
  timestamp: string,
  rawBody: string,
): string {
  const key = webhookKey(secret);
  if (!key) throw new Error("resend webhook: secret okunamadı");
  const digest = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");
  return `v1,${digest}`;
}

export function verifyResendSignature(
  secret: string,
  headers: SvixHeaders,
  rawBody: string,
  nowMs: number = Date.now(),
): SignatureCheck {
  const id = headers.id.trim();
  const timestamp = headers.timestamp.trim();
  const signature = headers.signature.trim();
  if (!id || !timestamp || !signature) {
    return { ok: false, reason: "missing_headers" };
  }
  const key = webhookKey(secret);
  if (!key) return { ok: false, reason: "bad_secret" };

  if (!/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: "stale" };
  const skew = Math.abs(nowMs / 1000 - Number(timestamp));
  if (skew > RESEND_WEBHOOK_TOLERANCE_S) return { ok: false, reason: "stale" };

  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest();
  for (const entry of signature.split(" ")) {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) continue;
    const given = Buffer.from(value, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "mismatch" };
}

/** What the route does with one verified event. */
export interface SuppressionEvent {
  reason: "bounced" | "complained";
  /** Lower-cased recipient addresses. */
  emails: string[];
  /** Resend's own e-mail id, for tracing the message in the dashboard. */
  emailId: string;
  /** A short, address-free description (bounce type and sub-type). */
  detail: string;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Reads a verified event body into a suppression, or `null` when the event
 * is not one that suppresses.
 *
 * `email.bounced` is documented as a PERMANENT rejection, and its
 * `bounce.type` says so ("Permanent"); a bounce whose type says anything
 * else (a transient one, should Resend ever send it under this name) is not
 * suppressed - the next campaign may well reach that inbox. `email.complained`
 * always suppresses: the recipient marked the message as spam.
 */
export function suppressionFrom(body: unknown): SuppressionEvent | null {
  if (typeof body !== "object" || body === null) return null;
  const event = body as { type?: unknown; data?: unknown };
  const type = str(event.type);
  const data =
    typeof event.data === "object" && event.data !== null
      ? (event.data as Record<string, unknown>)
      : {};
  const rawTo = data.to;
  const emails = (Array.isArray(rawTo) ? rawTo : [rawTo])
    .map((v) => str(v).trim().toLowerCase())
    .filter((v) => v.includes("@"));
  if (emails.length === 0) return null;
  const emailId = str(data.email_id);

  if (type === "email.bounced") {
    const bounce =
      typeof data.bounce === "object" && data.bounce !== null
        ? (data.bounce as Record<string, unknown>)
        : {};
    const kind = str(bounce.type);
    if (kind && kind.toLowerCase() !== "permanent") return null;
    const subType = str(bounce.subType);
    return {
      reason: "bounced",
      emails,
      emailId,
      detail: [kind || "Permanent", subType].filter(Boolean).join(" / "),
    };
  }
  if (type === "email.complained") {
    return { reason: "complained", emails, emailId, detail: "spam" };
  }
  return null;
}

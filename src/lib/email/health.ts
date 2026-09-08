import "server-only";

import { emailIdentity } from "./send";

/**
 * Whether mail can actually leave the building.
 *
 * The panel could already send a test message, but that is a question the
 * operator has to think to ask. This is the answer sitting on the dashboard
 * before they ask it - and it matters because an unverified sending domain
 * does not merely lose the odd e-mail: `/odeme` refuses to take an order from
 * a member whose address is unverified, and the verification link is itself an
 * e-mail. No mail, no first order, and nothing on any screen saying so.
 *
 * Resend is asked rather than remembered. A domain's status changes in DNS,
 * outside this codebase and without telling us, so a value stored at send time
 * would be stale exactly when it mattered.
 */

export type DomainStatus =
  | "verified"
  | "pending"
  | "failed"
  | "not_started"
  | "temporary_failure"
  | "absent"
  | "unknown";

export interface EmailHealth {
  /** `RESEND_API_KEY` present. Without it nothing is sent at all. */
  hasProvider: boolean;
  /** `Name <address>` as messages will carry it. */
  from: string;
  /** The domain part of the sender, which is what Resend verifies. */
  domain: string;
  status: DomainStatus;
  /** True when a member would receive what the site sends right now. */
  ok: boolean;
  /** One Turkish sentence for the operator; empty when everything is fine. */
  message: string;
}

interface ResendDomain {
  name?: unknown;
  status?: unknown;
}

/**
 * Short, in-process cache.
 *
 * Every admin page render would otherwise cost a round trip to Resend on a
 * request that has nothing to do with e-mail. Two minutes is far shorter than
 * DNS propagation, so an operator who has just fixed a record still sees it go
 * green while they are watching.
 */
const TTL_MS = 120_000;
let cached: { at: number; value: EmailHealth } | null = null;

function domainOf(from: string): string {
  const at = from.lastIndexOf("@");
  if (at < 0) return "";
  return from
    .slice(at + 1)
    .replace(/>.*$/, "")
    .trim()
    .toLowerCase();
}

function describe(status: DomainStatus, domain: string): string {
  switch (status) {
    case "verified":
      return "";
    case "absent":
      return `${domain} Resend hesabında kayıtlı değil. Resend → Domains'ten ekleyip DNS kayıtlarını gir.`;
    case "not_started":
    case "pending":
      return `${domain} henüz doğrulanmadı - DNS kayıtları bekleniyor. Doğrulanana kadar hiçbir e-posta gönderilmez.`;
    case "failed":
      return `${domain} doğrulaması başarısız. DKIM veya SPF kaydı eksik ya da hatalı; Resend → Domains ekranı hangisinin tutmadığını gösterir.`;
    case "temporary_failure":
      return `${domain} doğrulaması geçici olarak tutmadı. Resend yeniden deneyecek; sürerse DNS kayıtlarını kontrol et.`;
    default:
      return `${domain} durumu okunamadı. Resend'e ulaşılamıyor olabilir.`;
  }
}

async function lookup(domain: string, key: string): Promise<DomainStatus> {
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      // Never cached by the fetch layer; the cache above is the one we want.
      cache: "no-store",
    });
    if (!res.ok) return "unknown";
    const body: unknown = await res.json();
    const list =
      body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)
        ? ((body as { data: ResendDomain[] }).data)
        : [];
    const match = list.find(
      (d) => typeof d.name === "string" && d.name.toLowerCase() === domain,
    );
    if (!match) return "absent";
    const status = typeof match.status === "string" ? match.status : "";
    return status === "verified" ||
      status === "pending" ||
      status === "failed" ||
      status === "not_started" ||
      status === "temporary_failure"
      ? status
      : "unknown";
  } catch {
    return "unknown";
  }
}

export async function emailHealth(): Promise<EmailHealth> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;

  const identity = await emailIdentity();
  const domain = domainOf(identity.from);
  const key = process.env.RESEND_API_KEY;

  let value: EmailHealth;
  if (!key) {
    value = {
      hasProvider: false,
      from: identity.from,
      domain,
      status: "unknown",
      ok: false,
      message:
        "RESEND_API_KEY tanımlı değil - e-postalar gönderilmiyor, yalnızca sunucu günlüğüne yazılıyor.",
    };
  } else {
    const status = await lookup(domain, key);
    value = {
      hasProvider: true,
      from: identity.from,
      domain,
      status,
      // `unknown` is not proof of breakage - Resend may simply be unreachable
      // from this render - so it does not raise an alarm on the dashboard.
      ok: status === "verified" || status === "unknown",
      message: describe(status, domain),
    };
  }
  cached = { at: now, value };
  return value;
}

/** Drops the cache so a save or a test send is reflected at once. */
export function forgetEmailHealth(): void {
  cached = null;
}

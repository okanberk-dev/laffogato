import "server-only";

import type { ExpoPushMessage, ExpoTicket } from "./order-push-core";

/**
 * The Expo Push API (https://exp.host/--/api/v2/push), by hand: two small
 * calls, the way `src/lib/email/send.ts` talks to Resend, not another
 * dependency (lafmobil docs/INFRA.md §7: Expo's push service, not FCM
 * directly).
 *
 * `EXPO_ACCESS_TOKEN` is optional. When the project turns on Expo's
 * "enhanced push security", every send must carry it, and a leaked device
 * token alone can no longer be used to push to that phone. Server-only,
 * never `NEXT_PUBLIC_*` (CLAUDE.md rule 10).
 *
 * Nothing here throws: a phone notification that could not be sent must
 * never fail the order move that triggered it.
 */

const SEND_URL = "https://exp.host/--/api/v2/push/send";
const RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

/** Expo takes at most 100 messages per send and 1000 ids per receipt read. */
export const EXPO_SEND_CHUNK = 100;
export const EXPO_RECEIPT_CHUNK = 1000;

const TIMEOUT_MS = 5_000;

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  const token = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

async function post(
  url: string,
  body: unknown,
): Promise<{ ok: true; json: unknown } | { ok: false; error: string; retry: boolean }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      return {
        ok: false,
        error: `HTTP ${res.status}`,
        retry: res.status === 429 || res.status >= 500,
      };
    }
    return { ok: true, json };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.name || err.message : "network",
      retry: true,
    };
  }
}

/** Posts once, and once more after a short pause on a 429, 5xx or network error. */
async function postWithRetry(url: string, body: unknown) {
  const first = await post(url, body);
  if (first.ok || !first.retry) return first;
  await new Promise((r) => setTimeout(r, 1_000));
  return post(url, body);
}

/**
 * Sends the messages, in chunks, and returns one ticket per message in the
 * same order. A chunk that could not be sent at all yields error tickets.
 */
export async function sendExpoPush(
  messages: readonly ExpoPushMessage[],
): Promise<ExpoTicket[]> {
  const tickets: ExpoTicket[] = [];
  for (let i = 0; i < messages.length; i += EXPO_SEND_CHUNK) {
    const chunk = messages.slice(i, i + EXPO_SEND_CHUNK);
    const res = await postWithRetry(SEND_URL, chunk);
    const data =
      res.ok && res.json && typeof res.json === "object"
        ? (res.json as { data?: unknown }).data
        : null;
    if (!Array.isArray(data)) {
      const error = res.ok ? "unexpected answer" : res.error;
      for (let k = 0; k < chunk.length; k++) {
        tickets.push({ status: "error", message: error });
      }
      continue;
    }
    for (let k = 0; k < chunk.length; k++) {
      const t = data[k] as ExpoTicket | undefined;
      tickets.push(
        t && (t.status === "ok" || t.status === "error")
          ? t
          : { status: "error", message: "no ticket" },
      );
    }
  }
  return tickets;
}

export interface ExpoReceipt {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

/**
 * Reads the receipts for ticket ids (Expo keeps them for a day). Ids Expo
 * has no receipt for yet are simply absent. Null when the read failed.
 */
export async function getExpoReceipts(
  ids: readonly string[],
): Promise<Record<string, ExpoReceipt> | null> {
  const out: Record<string, ExpoReceipt> = {};
  for (let i = 0; i < ids.length; i += EXPO_RECEIPT_CHUNK) {
    const chunk = ids.slice(i, i + EXPO_RECEIPT_CHUNK);
    const res = await postWithRetry(RECEIPTS_URL, { ids: chunk });
    if (!res.ok) return null;
    const data =
      res.json && typeof res.json === "object"
        ? (res.json as { data?: unknown }).data
        : null;
    if (!data || typeof data !== "object") return null;
    Object.assign(out, data as Record<string, ExpoReceipt>);
  }
  return out;
}

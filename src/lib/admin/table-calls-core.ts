// Client-safe (no server-only, no database, no zod): "Garson çağır" from the
// table's QR (6 Kas 2026). What a call is, when it counts as open, what the
// app, the köşk panel's bar screen and this panel's alert are told about
// it. The mobile routes (docs/API-MOBILE.md §22.1), the panel feed
// (docs/PANEL-ORDERS.md "Masa çağrıları") and the order alert
// (order-alerts-core.ts) all read this one file.

/** What a guest can ask for from the table. */
export const TABLE_CALL_REASONS = ["waiter", "water", "napkin"] as const;

export type TableCallReason = (typeof TABLE_CALL_REASONS)[number];

/** The staff's words for each reason: "Masa 4 · Su istiyor". */
export const TABLE_CALL_REASON_LABELS: Record<TableCallReason, string> = {
  waiter: "Garson çağırıyor",
  water: "Su istiyor",
  napkin: "Peçete istiyor",
};

/**
 * How long an unanswered call stays open. Past it the guest has been seen
 * to, has left, or has waved: the call stops ringing and leaves the bar
 * screen, and the app reads it as `expired`.
 */
export const TABLE_CALL_OPEN_MS = 15 * 60_000;

/** Days a call row is kept (src/lib/retention.ts, rule `table-calls`). */
export const TABLE_CALL_RETENTION_DAYS = 30;

/** Open calls one read returns at most (the feed and the alert). */
export const TABLE_CALL_LIST_MAX = 50;

/** A clock this far ahead of ours still counts (as order-alerts-core.ts). */
const FUTURE_SKEW_MS = 5 * 60_000;

/** `tcl-` and 16 Crockford base32 characters, lower case: 80 random bits. */
const ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const ID_LENGTH = 16;
const ID_RE = /^tcl-[0-9a-z]{16}$/;

/**
 * A new call id. Random, not sequential: the id travels to the app and
 * back, and a counter would tell anyone how many calls the köşk gets.
 */
export function newTableCallId(
  randomBytes: (n: number) => Uint8Array = (n) =>
    globalThis.crypto.getRandomValues(new Uint8Array(n)),
): string {
  const bytes = randomBytes(ID_LENGTH);
  let out = "tcl-";
  for (let i = 0; i < ID_LENGTH; i++) out += ID_ALPHABET[bytes[i] & 31];
  return out;
}

export function isTableCallId(value: unknown): value is string {
  return typeof value === "string" && ID_RE.test(value);
}

export function isTableCallReason(value: unknown): value is TableCallReason {
  return (
    typeof value === "string" &&
    (TABLE_CALL_REASONS as readonly string[]).includes(value)
  );
}

/** A `table_calls` row as the store reads it. */
export interface TableCallRow {
  id: string;
  tableCode: string;
  tableName: string;
  reason: TableCallReason;
  /** The member who asked (lower case); never leaves this site. */
  customerEmail?: string;
  createdAt: string;
  /** "" while nobody answered. */
  ackedAt: string;
  /** "panel:<name>", "lafpos:<name>", "admin:<name>"; "" while open. */
  ackedBy?: string;
  /**
   * The table's branch when the call was made (21 Kas 2026,
   * src/lib/panel/branches.ts); absent on a row read before it: Tuzla.
   */
  branch?: string;
}

export type TableCallStatus = "open" | "acked" | "expired";

/**
 * Where a call stands: `acked` once someone answered it, `expired` when it
 * was never answered and is older than TABLE_CALL_OPEN_MS, `open`
 * otherwise. An unreadable `createdAt` is expired: it can ring nowhere.
 */
export function tableCallStatus(
  row: Pick<TableCallRow, "createdAt" | "ackedAt">,
  nowMs: number,
): TableCallStatus {
  if (row.ackedAt) return "acked";
  const created = Date.parse(row.createdAt);
  if (!Number.isFinite(created)) return "expired";
  return nowMs - created < TABLE_CALL_OPEN_MS ? "open" : "expired";
}

/** Still ringing at `nowMs`: unanswered, younger than the window. */
export function tableCallRings(createdAtMs: number, nowMs: number): boolean {
  return (
    Number.isFinite(createdAtMs) &&
    createdAtMs > 0 &&
    nowMs - createdAtMs < TABLE_CALL_OPEN_MS &&
    createdAtMs <= nowMs + FUTURE_SKEW_MS
  );
}

/** The ISO instant the open calls are read from (`createdAt` sorts). */
export function tableCallsOpenSince(nowMs: number): string {
  return new Date(nowMs - TABLE_CALL_OPEN_MS).toISOString();
}

/**
 * "Masa 4" from a table's name (a name that already says "Masa ..." is kept
 * as it is), its code when it has no name. The order alert and the bar
 * screen print tables the same way.
 */
export function tableLabel(table: { code: string; name: string }): string {
  const name = table.name.trim() || table.code.trim();
  return /^masa(?:\s|\d|$)/.test(name.toLocaleLowerCase("tr-TR"))
    ? name
    : `Masa ${name}`;
}

// ── The app's view (docs/API-MOBILE.md §22.1) ─────────────────────────────

export interface MobileTableCall {
  id: string;
  reason: TableCallReason;
  status: TableCallStatus;
  createdAt: string;
  /** ISO, or "" while nobody answered. */
  ackedAt: string;
  table: { code: string; name: string };
}

/** The call as the app reads it: no member, no staff name. */
export function toMobileTableCall(
  row: TableCallRow,
  nowMs: number,
): MobileTableCall {
  return {
    id: row.id,
    reason: row.reason,
    status: tableCallStatus(row, nowMs),
    createdAt: row.createdAt,
    ackedAt: row.ackedAt || "",
    table: { code: row.tableCode, name: row.tableName },
  };
}

/**
 * `POST /tables/{code}/calls` body: exactly `{ "reason": ... }`. Read by
 * hand rather than with zod so this file stays light enough for the
 * panel's alert bundle.
 */
export function parseTableCallBody(
  raw: unknown,
): { ok: true; reason: TableCallReason } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "İstek gövdesi bir nesne olmalı." };
  }
  const extra = Object.keys(raw).find((key) => key !== "reason");
  if (extra !== undefined) {
    return { ok: false, message: `Bilinmeyen alan: ${extra.slice(0, 40)}.` };
  }
  const reason = (raw as { reason?: unknown }).reason;
  if (!isTableCallReason(reason)) {
    return {
      ok: false,
      message: "reason: waiter, water ya da napkin olmalı.",
    };
  }
  return { ok: true, reason };
}

/** The Turkish answers of the call routes (docs/API-MOBILE.md §22.1). */
export const TABLE_CALL_MESSAGES = {
  unavailable: "Masadan çağrı şu an kapalı. Bir görevliye el sallayabilirsin.",
  notFound: "Çağrı bulunamadı.",
  limited: (seconds: number) => {
    const s = Math.max(1, Math.ceil(seconds));
    return s < 120
      ? `Az önce çağırdın. ${s} saniye sonra yeniden çağırabilirsin.`
      : `Çok sık çağırdın. ${Math.ceil(s / 60)} dakika sonra yeniden çağırabilirsin; bu arada bir görevliye el sallayabilirsin.`;
  },
} as const;

// ── The köşk panel's bar screen (docs/PANEL-ORDERS.md) ─────────────────────

/** One open call on the bar screen: the table and the reason, no guest. */
export interface PanelTableCall {
  id: string;
  tableCode: string;
  /** "Masa 4". */
  label: string;
  reason: TableCallReason;
  createdAt: string;
}

/**
 * The feed's `calls`: open calls younger than the window, oldest first
 * (the one waiting longest is the next to answer), at most
 * TABLE_CALL_LIST_MAX. Whitelisted: who asked never leaves.
 */
export function toPanelTableCalls(
  rows: readonly TableCallRow[],
  nowMs: number,
): PanelTableCall[] {
  return rows
    .filter((row) => tableCallStatus(row, nowMs) === "open")
    .filter((row) => Date.parse(row.createdAt) <= nowMs + FUTURE_SKEW_MS)
    .sort(
      (a, b) =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, TABLE_CALL_LIST_MAX)
    .map((row) => ({
      id: row.id,
      tableCode: row.tableCode,
      label: tableLabel({ code: row.tableCode, name: row.tableName }),
      reason: row.reason,
      createdAt: row.createdAt,
    }));
}

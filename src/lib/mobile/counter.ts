import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { getCustomerByEmail } from "@/lib/customer/store";
import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import { addCounterStamp, getLoyalty } from "./loyalty";
import type { LoyaltyView } from "./loyalty-core";

/**
 * Counter tokens — the QR the member shows at the till (docs/API-MOBILE.md §17).
 *
 * A barcode derived from the member's identity would be a permanent stamp
 * machine the moment somebody photographs it, so what the app draws is a
 * rotating, short-lived, single-use value issued by this module. Only its
 * sha256 reaches the database: whoever can read `counter_tokens` still cannot
 * produce a QR that scans.
 */
const TABLE = TABLES.counterTokens;

/** Long enough to walk from the queue to the till, short enough to be worthless in a photo. */
export const COUNTER_TOKEN_TTL_SECONDS = 120;

/** Two QRs valid at the same till at once is a confusion; three is the ceiling. */
const MAX_OPEN_TOKENS = 3;

/** Per member: ten tokens a minute. The app refreshes one every ~110 seconds. */
const ISSUE_WINDOW_MS = 60_000;
const MAX_ISSUES_PER_WINDOW = 10;

/** Spent and expired rows are swept a day later, on the redeem path. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** No O/0, no I/1/L: the cashier reads this out loud when the camera fails. */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

/**
 * The QR payload's alphabet, and why it is not base64url.
 *
 * A QR encoder picks its mode from the characters it is given. Base64url
 * mixes upper and lower case, so the payload can only go in **byte mode** at
 * 8 bits a character; the 43-character token that produced measured out at
 * version 4 — a 33x33 grid — at error-correction level M.
 *
 * QR's *alphanumeric* mode covers `0-9 A-Z` and nine symbols, and packs two
 * characters into 11 bits (5.5 bits each). Spending the entropy in that
 * alphabet instead buys the scan two things at once:
 *
 *   43 chars base64url, EC M  ->  version 4, 33x33 modules, 15% recoverable
 *   26 chars base32,    EC Q  ->  version 2, 25x25 modules, 25% recoverable
 *
 * Fewer modules in the same drawn square means each module is physically
 * larger, which is the single thing a camera cares about most; the freed
 * capacity goes straight back into error correction, which is what survives
 * glare and fingerprints on a phone screen. Both measured with `qrcode`
 * itself, not estimated.
 *
 * 16 bytes rather than 32: this is a single-use value that lives 120 seconds
 * behind a per-member rate limit, so 128 bits is already far past anything
 * that could be guessed inside its own lifetime, and the 16 bytes we do not
 * spend are what pays for the smaller grid.
 *
 * Crockford's alphabet (no I, L, O or U) is a subset of QR's alphanumeric
 * set, so the encoder keeps the cheap mode. Nothing reads the token's shape —
 * the app draws the SVG, the till submits the decoded string verbatim and
 * this module compares `sha256` — so tokens minted by an older deploy keep
 * working until they expire on their own.
 */
const TOKEN_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TOKEN_BYTES = 16;

export const MIN_COUNTER_STAMPS = 1;
export const MAX_COUNTER_STAMPS = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CounterTokenRow {
  tokenHash: string;
  customerEmail: string;
  code: string;
  expiresAt: string;
  usedAt: string;
  usedBy: string;
  createdAt: string;
}

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

function normalizeEmail(raw: string): string {
  return (raw ?? "").trim().toLowerCase();
}

function toRow(row: Record<string, unknown>): CounterTokenRow {
  return {
    tokenHash: String(row.tokenHash ?? ""),
    customerEmail: String(row.customerEmail ?? ""),
    code: String(row.code ?? ""),
    expiresAt: String(row.expiresAt ?? ""),
    usedAt: String(row.usedAt ?? ""),
    usedBy: String(row.usedBy ?? ""),
    createdAt: String(row.createdAt ?? ""),
  };
}

export function hashCounterToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The 8 characters the cashier may have to type — unbiased, 32 = 2^5 per byte. */
function newCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (const byte of bytes) out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return out;
}

/**
 * The QR payload: `TOKEN_BYTES` of randomness re-spelled in base32.
 *
 * Five bits are taken off the front of a rolling window at a time, so every
 * bit of every byte reaches the output exactly once — a per-byte `% 32` would
 * throw away three bits of each and leave 80 of the 128.
 */
function newToken(): string {
  const bytes = randomBytes(TOKEN_BYTES);
  let acc = 0;
  let bits = 0;
  let out = "";
  for (const byte of bytes) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += TOKEN_ALPHABET[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  // 16 bytes is not a multiple of 5 bits; the last 3 are padded out rather
  // than dropped.
  if (bits > 0) out += TOKEN_ALPHABET[(acc << (5 - bits)) & 31];
  return out;
}

/** Accepts what a cashier types: spaces, dashes and lower case all normalise away. */
export function normalizeCounterCode(raw: string): string {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * What the till may show of a member's address.
 *
 * A cashier has no `customers` access on purpose, so the QR path must not hand
 * them the full address either — it only has to be enough for the member to
 * recognise themselves.
 */
export function maskEmail(email: string): string {
  const owner = normalizeEmail(email);
  const at = owner.indexOf("@");
  if (at <= 0) return owner ? "***" : "";
  return `${owner.slice(0, 1)}***${owner.slice(at)}`;
}

export interface CounterTokenIssue {
  code: string;
  /** The QR payload. Returned once, here; the database only ever sees its hash. */
  token: string;
  expiresAt: string;
  ttlSeconds: number;
}

export type IssueCounterTokenResult =
  | { ok: true; issue: CounterTokenIssue }
  | { ok: false; error: "rate_limited"; retryAfterSeconds: number };

async function openTokens(
  owner: string,
  nowIso: string,
): Promise<CounterTokenRow[]> {
  const { data, error } = await getDb()
    .from(TABLE)
    .select("*")
    .eq("customerEmail", owner)
    .eq("usedAt", "")
    .order("createdAt", { ascending: false });
  checkErr(error, "counter.openTokens");
  return ((data as Record<string, unknown>[] | null) ?? [])
    .map(toRow)
    .filter((row) => row.expiresAt > nowIso);
}

/**
 * How many tokens this member asked for inside the window.
 *
 * Counted from the rows themselves rather than from a module-scoped map: this
 * deployment is serverless, and a per-instance counter hands a caller a fresh
 * budget on every cold start (the same mistake `src/lib/admin/rate-limit.ts`
 * was rewritten to undo).
 */
async function issuesInWindow(
  owner: string,
  now: number,
): Promise<CounterTokenRow[]> {
  const since = new Date(now - ISSUE_WINDOW_MS).toISOString();
  const { data, error } = await getDb()
    .from(TABLE)
    .select("*")
    .eq("customerEmail", owner)
    .gte("createdAt", since)
    .order("createdAt", { ascending: true });
  checkErr(error, "counter.issuesInWindow");
  return ((data as Record<string, unknown>[] | null) ?? []).map(toRow);
}

/**
 * Retires the tokens a newer one replaces, by ending their life now.
 *
 * Deliberately NOT a delete. The row is this member's own rate-limit evidence
 * for the next minute, and deleting it would make the tenth request of a
 * minute indistinguishable from the first. It also keeps the till honest: a
 * superseded QR reads as "süresi doldu", which is what happened, rather than
 * as "kod bulunamadı", which sounds like a typo.
 */
async function retireSurplus(
  owner: string,
  nowIso: string,
  keep: string,
): Promise<void> {
  const open = await openTokens(owner, nowIso);
  const surplus = open
    .filter((row) => row.tokenHash !== keep)
    .slice(MAX_OPEN_TOKENS - 1);
  for (const row of surplus) {
    const { error } = await getDb()
      .from(TABLE)
      .update({ expiresAt: nowIso })
      .eq("tokenHash", row.tokenHash);
    checkErr(error, "counter.retireSurplus");
  }
}

/** Opportunistic sweep of rows nobody can use any more — no cron needed. */
async function purgeStale(now: number): Promise<void> {
  const cutoff = new Date(now - STALE_AFTER_MS).toISOString();
  const { error } = await getDb().from(TABLE).delete().lt("expiresAt", cutoff);
  // A failed sweep must not fail the redemption standing in front of it.
  if (error) console.error("[counter] purge failed", error);
}

/**
 * Issues the value the app turns into a QR (docs/API-MOBILE.md §17).
 *
 * The token is 32 random bytes; the database stores `sha256(token)` and the
 * short code, never the token. The code only has to be unique among the
 * tokens that are still open, so a collision is simply drawn again.
 */
export async function issueCounterToken(
  email: string,
): Promise<IssueCounterTokenResult> {
  const owner = normalizeEmail(email);
  if (!owner) throw new Error("issueCounterToken: e-mail required");

  const now = Date.now();
  const recent = await issuesInWindow(owner, now);
  if (recent.length >= MAX_ISSUES_PER_WINDOW) {
    const oldest = Date.parse(recent[0].createdAt);
    const retryAfterSeconds = Number.isFinite(oldest)
      ? Math.max(1, Math.ceil((oldest + ISSUE_WINDOW_MS - now) / 1000))
      : Math.ceil(ISSUE_WINDOW_MS / 1000);
    return { ok: false, error: "rate_limited", retryAfterSeconds };
  }

  const nowIso = new Date(now).toISOString();
  const expiresAt = new Date(
    now + COUNTER_TOKEN_TTL_SECONDS * 1000,
  ).toISOString();
  const token = newToken();
  const tokenHash = hashCounterToken(token);

  let code = newCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const taken = await openTokens(owner, nowIso);
    const { data, error } = await getDb()
      .from(TABLE)
      .select("code")
      .eq("code", code)
      .eq("usedAt", "");
    checkErr(error, "counter.codeCollision");
    const collides =
      ((data as unknown[] | null) ?? []).length > 0 ||
      taken.some((row) => row.code === code);
    if (!collides) break;
    code = newCode();
  }

  const row: CounterTokenRow = {
    tokenHash,
    customerEmail: owner,
    code,
    expiresAt,
    usedAt: "",
    usedBy: "",
    createdAt: nowIso,
  };
  const { error } = await getDb().from(TABLE).insert(row);
  checkErr(error, "counter.issue");

  await retireSurplus(owner, nowIso, tokenHash);

  return {
    ok: true,
    issue: {
      code,
      token,
      expiresAt,
      ttlSeconds: COUNTER_TOKEN_TTL_SECONDS,
    },
  };
}

export type CounterRedeemKind = "token" | "code" | "email";

export interface RedeemCounterTokenInput {
  kind: CounterRedeemKind;
  /** The QR payload, the typed code, or the member's address. */
  value: string;
  stamps: number;
  /** The cashier's e-mail; written onto every ledger row. */
  actor: string;
  note?: string;
}

export type CounterRedeemError =
  | "invalid_stamps"
  | "invalid_email"
  | "expired"
  | "already_used"
  | "not_found";

export interface CounterRedemption {
  /** The member's name, empty when the account has none. */
  name: string;
  /** What the till may print: masked on the QR and code paths. */
  memberLabel: string;
  /** Empty on the e-mail path — there was no code to burn. */
  code: string;
  stampsGiven: number;
  loyalty: LoyaltyView;
}

export type RedeemCounterTokenResult =
  | { ok: true; redemption: CounterRedemption }
  | { ok: false; error: CounterRedeemError; message: string };

const MESSAGES: Record<CounterRedeemError, string> = {
  invalid_stamps: `Damga sayısı ${MIN_COUNTER_STAMPS} ile ${MAX_COUNTER_STAMPS} arasında olmalı.`,
  invalid_email: "Geçerli bir üye e-postası gir.",
  expired: "Bu kodun süresi doldu. Üyeden yeni QR göstermesini iste.",
  already_used: "Bu kod kullanıldı. Aynı QR ikinci kez damga vermez.",
  not_found: "Kod bulunamadı. Kodu kontrol et ya da e-posta ile ara.",
};

function fail(error: CounterRedeemError): RedeemCounterTokenResult {
  return { ok: false, error, message: MESSAGES[error] };
}

const NOTE_PREFIX: Record<CounterRedeemKind, string> = {
  token: "Kasa · QR",
  code: "Kasa · kod",
  email: "Kasa · e-posta",
};

function noteFor(kind: CounterRedeemKind, extra: string): string {
  const own = extra.trim().slice(0, 80);
  return own ? `${NOTE_PREFIX[kind]} · ${own}` : NOTE_PREFIX[kind];
}

async function rowsWithCode(code: string): Promise<CounterTokenRow[]> {
  const { data, error } = await getDb()
    .from(TABLE)
    .select("*")
    .eq("code", code)
    .order("createdAt", { ascending: false });
  checkErr(error, "counter.byCode");
  return ((data as Record<string, unknown>[] | null) ?? []).map(toRow);
}

async function rowWithHash(hash: string): Promise<CounterTokenRow | null> {
  const { data, error } = await getDb()
    .from(TABLE)
    .select("*")
    .eq("tokenHash", hash)
    .maybeSingle();
  checkErr(error, "counter.byHash");
  return data ? toRow(data as Record<string, unknown>) : null;
}

/**
 * Burns the row, once.
 *
 * The `usedAt = ''` predicate is part of the UPDATE rather than a read before
 * it: two cashiers scanning the same QR in the same second both pass a
 * separate check, but only one of them updates a row. Zero rows back means
 * this request lost that race, which is the same answer as a code somebody
 * already redeemed yesterday.
 */
async function burn(
  hash: string,
  actor: string,
  nowIso: string,
): Promise<boolean> {
  const { data, error } = await getDb()
    .from(TABLE)
    .update({ usedAt: nowIso, usedBy: actor })
    .eq("tokenHash", hash)
    .eq("usedAt", "")
    .select("tokenHash");
  checkErr(error, "counter.burn");
  return ((data as unknown[] | null) ?? []).length > 0;
}

/**
 * Hands out the stamps behind one scan (docs/API-MOBILE.md §17, spec §5).
 *
 * All three paths at the till — camera, typed code, typed address — end here
 * so they cannot drift apart: the same validation, the same ledger rows, the
 * same answer on screen.
 */
export async function redeemCounterToken(
  input: RedeemCounterTokenInput,
): Promise<RedeemCounterTokenResult> {
  const stamps = Math.trunc(Number(input.stamps));
  if (
    !Number.isFinite(stamps) ||
    stamps < MIN_COUNTER_STAMPS ||
    stamps > MAX_COUNTER_STAMPS
  ) {
    return fail("invalid_stamps");
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const actor = normalizeEmail(input.actor);
  await purgeStale(now);

  let owner = "";
  let code = "";

  if (input.kind === "email") {
    owner = normalizeEmail(input.value);
    if (!EMAIL_RE.test(owner)) return fail("invalid_email");
  } else {
    let row: CounterTokenRow | null = null;
    if (input.kind === "token") {
      row = await rowWithHash(hashCounterToken((input.value ?? "").trim()));
      if (!row) return fail("not_found");
      if (row.usedAt) return fail("already_used");
      if (row.expiresAt <= nowIso) return fail("expired");
    } else {
      const typed = normalizeCounterCode(input.value);
      if (typed.length !== CODE_LENGTH) return fail("not_found");
      const candidates = await rowsWithCode(typed);
      if (candidates.length === 0) return fail("not_found");
      row = candidates.find((c) => !c.usedAt && c.expiresAt > nowIso) ?? null;
      if (!row) {
        // A code is only unique among open tokens, so the same eight
        // characters can exist twice: say "used" only when one of them
        // actually was.
        return candidates.some((c) => c.usedAt)
          ? fail("already_used")
          : fail("expired");
      }
    }

    if (!(await burn(row.tokenHash, actor, nowIso))) {
      return fail("already_used");
    }
    owner = normalizeEmail(row.customerEmail);
    code = row.code;
  }

  const note = noteFor(input.kind, input.note ?? "");
  for (let i = 0; i < stamps; i += 1) {
    await addCounterStamp(owner, actor, note);
  }

  const [loyalty, customer] = await Promise.all([
    getLoyalty(owner),
    getCustomerByEmail(owner),
  ]);

  return {
    ok: true,
    redemption: {
      name: customer?.name ?? "",
      // The cashier typed the address on the e-mail path, so masking it there
      // would hide nothing and only make the receipt harder to check.
      memberLabel: input.kind === "email" ? owner : maskEmail(owner),
      code,
      stampsGiven: stamps,
      loyalty,
    },
  };
}

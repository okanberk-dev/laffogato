import "server-only";

import { getMenuItem } from "@/lib/admin/store";
import type { PublicCustomer } from "@/lib/customer/store";
import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import {
  ANTHROPIC_MESSAGES_URL,
  ANTHROPIC_VERSION,
  FAL_CONSENT_VERSION,
  FAL_DISCLOSED_PROVIDER,
  FAL_FEATURE,
  FAL_TIMEOUT_MS,
  anthropicReplyText,
  anthropicRequestBody,
  falAiEnabled,
  falApiKey,
  falModel,
  falProvider,
  falRequestBody,
  falTransferSafeguardInForce,
  parseFalReply,
  responseText,
  visitsWord,
  type FalAiReading,
  type FalContext,
  type FalProvider,
  type FalReportReason,
} from "./fal-core";
import { getLoyalty } from "./loyalty";
import { istanbulClock } from "./venue";

/**
 * fA'L read by AI (karar 177) - the half that touches the database and the
 * network. The rules are in `fal-core.ts`; this module only carries them out.
 *
 * Retired on 27 Oct 2026 (App Review 4.3(b), lafmobil karar 330): the
 * reading is off in code (`falAiEnabled`), so `readCupWithAI` sends nothing
 * and POST /fal no longer takes a seat. What still runs is what v1 keeps
 * answering: the consent row (GET, POST, DELETE /fal/consent), the reports
 * (POST /fal/report) and the panel's read-only list of old reports.
 */

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

type ConsentRow = {
  customerEmail: string;
  feature: string;
  version: string;
  grantedAt: string;
  revokedAt: string;
};

function owner(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

/** Whether the member's R12 consent stands at the current version. */
export async function hasFalConsent(email: string): Promise<boolean> {
  const { data, error } = await getDb()
    .from(TABLES.featureConsents)
    .select("*")
    .eq("customerEmail", owner(email))
    .eq("feature", FAL_FEATURE)
    .maybeSingle();
  checkErr(error, "hasFalConsent");
  const row = data as ConsentRow | null;
  return Boolean(row && row.version === FAL_CONSENT_VERSION && !row.revokedAt && row.grantedAt);
}

/**
 * Records the consent - who, which text version, when. The row is the proof
 * KVKK asks a data controller to keep; a withdrawal keeps it and stamps
 * `revokedAt` rather than deleting the record of what was agreed.
 */
export async function grantFalConsent(email: string, now: Date = new Date()): Promise<void> {
  const row: ConsentRow = {
    customerEmail: owner(email),
    feature: FAL_FEATURE,
    version: FAL_CONSENT_VERSION,
    grantedAt: now.toISOString(),
    revokedAt: "",
  };
  const { error } = await getDb().from(TABLES.featureConsents).upsert(row, { onConflict: "customerEmail,feature" });
  checkErr(error, "grantFalConsent");
}

export async function revokeFalConsent(email: string, now: Date = new Date()): Promise<void> {
  const { error } = await getDb()
    .from(TABLES.featureConsents)
    .update({ revokedAt: now.toISOString() })
    .eq("customerEmail", owner(email))
    .eq("feature", FAL_FEATURE);
  checkErr(error, "revokeFalConsent");
}

/** AI readings this member asked for on this Istanbul day. */
export async function falReadingsToday(email: string, now: Date = new Date()): Promise<number> {
  const { data, error } = await getDb()
    .from(TABLES.falReadings)
    .select("id")
    .eq("customerEmail", owner(email))
    .eq("day", istanbulClock(now).date);
  checkErr(error, "falReadingsToday");
  return ((data as unknown[] | null) ?? []).length;
}

/**
 * A seat on today's quota, taken BEFORE the photo goes to the model.
 *
 * The count used to be read, the model asked, and the row written only after
 * the answer came back. Two requests from the same member in the same second
 * both read "2 of 3", both paid for a reading, and both recorded one - the
 * daily cap held for a patient caller and not for a scripted one (CLAUDE.md
 * rule 20/30: count first, then do the costly thing).
 *
 * So the row is the reservation, and `reserve_fal_reading` takes it in one
 * statement: an advisory lock on the member and the Istanbul day, a count,
 * and the insert only under the limit. Ranking an inserted row by id was not
 * enough - an earlier id can still be uncommitted when a later one ranks
 * itself, and a real Postgres let a fourth of six parallel requests through
 * (tests/db-integration-fal-seat.test.ts). `used` is how many seats were
 * taken before this one.
 *
 * A failed reading gives the seat back (`releaseFalReading`), so a model
 * error never spends a member's turn, as before; a successful one fills the
 * row in (`completeFalReading`). A process that dies between the two leaves
 * an empty row that counts - the model may well have been paid for.
 */
export type FalSeat = { ok: true; id: number; used: number } | { ok: false };

export async function reserveFalReading(
  email: string,
  limit: number,
  now: Date = new Date(),
): Promise<FalSeat> {
  const { data, error } = await getDb().rpc<{ id: number | string; used: number | string } | null>(
    "reserve_fal_reading",
    {
      p_email: owner(email),
      p_day: istanbulClock(now).date,
      p_limit: limit,
      p_created_at: now.toISOString(),
    },
  );
  checkErr(error, "reserveFalReading");
  if (!data) return { ok: false };
  const id = Number(data.id);
  const used = Number(data.used);
  if (!Number.isFinite(id) || !Number.isFinite(used)) {
    throw new Error("reserveFalReading: the seat came back without an id");
  }
  return { ok: true, id, used };
}

/** Gives a seat back: the reading did not happen, so it does not count. */
export async function releaseFalReading(id: number): Promise<void> {
  const { error } = await getDb().from(TABLES.falReadings).delete().eq("id", id);
  checkErr(error, "releaseFalReading");
}

/**
 * The usage record: whether a cup was seen, the model. Never the photo,
 * never the words - R12 promises exactly this much and no more.
 */
export async function completeFalReading(id: number, cupSeen: boolean, model: string): Promise<void> {
  const { error } = await getDb().from(TABLES.falReadings).update({ cupSeen, model }).eq("id", id);
  checkErr(error, "completeFalReading");
}

/** One "Bu yorumu bildir" report, as the table records it. */
export type FalReport = {
  id?: number;
  customerEmail: string;
  day: string;
  reason: FalReportReason;
  text: string;
  model: string;
  createdAt: string;
};

/**
 * The words of the reports this member sent on this Istanbul day - their
 * count is the daily cap, and a repeat of the same words is not stored twice.
 */
export async function falReportsToday(email: string, now: Date = new Date()): Promise<string[]> {
  const { data, error } = await getDb()
    .from(TABLES.falReports)
    .select("text")
    .eq("customerEmail", owner(email))
    .eq("day", istanbulClock(now).date);
  checkErr(error, "falReportsToday");
  return ((data as { text?: unknown }[] | null) ?? []).map((r) => String(r.text ?? ""));
}

/**
 * Records a report: the member, the day, the reason, the reading's words and
 * the model. Never the photo - it was never kept, and a report does not
 * change that. Swept after ninety days (`src/lib/retention.ts`).
 */
export async function recordFalReport(
  email: string,
  report: { reason: FalReportReason; text: string; model: string },
  now: Date = new Date(),
): Promise<number | null> {
  const row: FalReport = {
    customerEmail: owner(email),
    day: istanbulClock(now).date,
    reason: report.reason,
    text: report.text,
    model: report.model,
    createdAt: now.toISOString(),
  };
  const { data, error } = await getDb()
    .from(TABLES.falReports)
    .insert(row)
    .select("id");
  checkErr(error, "recordFalReport");
  const id = Number((data as { id?: unknown }[] | null)?.[0]?.id);
  return Number.isFinite(id) ? id : null;
}

/**
 * Takes back a report the daily cap turned out not to cover (the route
 * re-counts after its own insert; see POST /fal/report).
 */
export async function withdrawFalReport(id: number): Promise<void> {
  const { error } = await getDb().from(TABLES.falReports).delete().eq("id", id);
  checkErr(error, "withdrawFalReport");
}

/**
 * The reports the panel shows, newest first. No address: the operator reads
 * what the AI wrote and why it was flagged, not who flagged it.
 */
export async function listFalReports(limit = 200): Promise<Omit<FalReport, "customerEmail">[]> {
  const { data, error } = await getDb()
    .from(TABLES.falReports)
    .select("id, day, reason, text, model, createdAt")
    .order("createdAt", { ascending: false })
    .limit(limit);
  checkErr(error, "listFalReports");
  return (data as Omit<FalReport, "customerEmail">[] | null) ?? [];
}

/** What the model is told about the member: tier, frequency, usual. No identity. */
export async function buildFalContext(customer: PublicCustomer): Promise<FalContext> {
  const loyalty = await getLoyalty(customer.email);
  let usual = "";
  const usualId = customer.usual?.menuItemId;
  if (usualId) {
    try {
      usual = (await getMenuItem(usualId))?.name ?? "";
    } catch {
      usual = "";
    }
  }
  return { tier: loyalty.tierLabel, visits: visitsWord(loyalty.ordersLast365), usual };
}

export type FalAiOutcome =
  | { ok: true; reading: FalAiReading; model: string }
  | { ok: false; reason: "failed" | "unfit" };

type Env = Record<string, string | undefined>;

/** Where one provider's request goes, with what, and how its answer is read. */
type ProviderCall = {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  /** The reply's JSON text, or the stop reason to log (a short word, never content). */
  read: (reply: unknown) => { text: string } | { stop: string };
};

function providerCall(provider: FalProvider, env: Env, model: string, context: FalContext, jpegBase64: string): ProviderCall {
  const key = falApiKey(env, provider);
  if (provider === "anthropic") {
    return {
      url: ANTHROPIC_MESSAGES_URL,
      headers: { "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION, "content-type": "application/json" },
      body: anthropicRequestBody(model, context, jpegBase64),
      read: (reply) => {
        const r = anthropicReplyText(reply);
        return r.ok ? { text: r.text } : { stop: r.stop };
      },
    };
  }
  return {
    url: "https://api.openai.com/v1/responses",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: falRequestBody(model, context, jpegBase64),
    read: (reply) => {
      const text = responseText(reply);
      return text ? { text } : { stop: "empty" };
    },
  };
}

/** An error's class name for the log ("AbortError", "TypeError") - never its message. */
function errorName(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  return /^[A-Za-z]{1,40}$/.test(name) ? name : "Error";
}

/**
 * One reading from the chosen provider (`falProvider`): Anthropic's Messages
 * API or OpenAI's Responses API, with the downscaled photo, the identity-free
 * note and the reply held to `FAL_SCHEMA`. Times out after `FAL_TIMEOUT_MS`;
 * any failure is a reason, never a throw, so the app can read the cup itself.
 *
 * The log says which provider, and only a status code, a stop reason or an
 * error's class name: never the photo, the prompt, the member or the key.
 *
 * Since 27 Oct 2026 it asks `falAiEnabled` first and sends nothing: the AI
 * reading is retired (App Review 4.3(b), lafmobil karar 330), whoever calls
 * this and whatever the environment says. The older locks stay behind it:
 * a provider the published texts do not name (`FAL_DISCLOSED_PROVIDER`) was
 * asked nothing, and nothing was sent before the standard contract was
 * signed and notified (`fal-safeguard.ts`), as R12 promised.
 */
export async function readCupWithAI(
  jpegBase64: string,
  context: FalContext,
  env: Env = process.env,
  fetcher: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<FalAiOutcome> {
  if (!falAiEnabled()) return { ok: false, reason: "failed" };
  if (!falTransferSafeguardInForce(now)) return { ok: false, reason: "failed" };
  const provider = falProvider(env);
  if (!provider || provider !== FAL_DISCLOSED_PROVIDER) return { ok: false, reason: "failed" };
  const model = falModel(env, provider);
  const call = providerCall(provider, env, model, context, jpegBase64);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FAL_TIMEOUT_MS);
  try {
    const res = await fetcher(call.url, {
      method: "POST",
      headers: call.headers,
      body: JSON.stringify(call.body),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[fal] ${provider} status`, res.status);
      return { ok: false, reason: "failed" };
    }
    const reply = call.read(await res.json());
    if ("stop" in reply) {
      console.warn(`[fal] ${provider} no reading`, reply.stop);
      return { ok: false, reason: "unfit" };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(reply.text);
    } catch {
      return { ok: false, reason: "unfit" };
    }
    const reading = parseFalReply(parsed);
    return reading ? { ok: true, reading, model } : { ok: false, reason: "unfit" };
  } catch (err) {
    console.error(`[fal] ${provider} request failed`, errorName(err));
    return { ok: false, reason: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

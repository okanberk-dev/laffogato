import "server-only";

import { getMenuItem } from "@/lib/admin/store";
import type { PublicCustomer } from "@/lib/customer/store";
import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import {
  FAL_CONSENT_VERSION,
  FAL_FEATURE,
  FAL_TIMEOUT_MS,
  falModel,
  falRequestBody,
  parseFalReply,
  responseText,
  visitsWord,
  type FalAiReading,
  type FalContext,
  type FalReportReason,
} from "./fal-core";
import { getLoyalty } from "./loyalty";
import { istanbulClock } from "./venue";

/**
 * fA'L read by AI (karar 177) - the half that touches the database and the
 * network. The rules are in `fal-core.ts`; this module only carries them out.
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
 * So the row is the reservation. It is inserted first, and the member's seat
 * is its RANK among today's rows - how many of their rows carry a smaller
 * id. Ranking by id rather than re-counting after the insert matters: two
 * concurrent inserts would both re-count "4 of 3" and both give up, while by
 * rank exactly one of them is third. A seat past the limit deletes its own
 * row and answers `{ ok: false }`.
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
  const db = getDb();
  const who = owner(email);
  const day = istanbulClock(now).date;
  const { data, error } = await db
    .from(TABLES.falReadings)
    .insert({ customerEmail: who, day, createdAt: now.toISOString(), model: "", cupSeen: false })
    .select("id");
  checkErr(error, "reserveFalReading");
  const id = Number(((data as { id: number | string }[] | null) ?? [])[0]?.id);
  if (!Number.isFinite(id)) throw new Error("reserveFalReading: insert returned no id");

  const before = await db
    .from(TABLES.falReadings)
    .select("id")
    .eq("customerEmail", who)
    .eq("day", day)
    .lt("id", id);
  checkErr(before.error, "reserveFalReading");
  const used = ((before.data as unknown[] | null) ?? []).length;
  if (used >= limit) {
    await releaseFalReading(id);
    return { ok: false };
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
): Promise<void> {
  const row: FalReport = {
    customerEmail: owner(email),
    day: istanbulClock(now).date,
    reason: report.reason,
    text: report.text,
    model: report.model,
    createdAt: now.toISOString(),
  };
  const { error } = await getDb().from(TABLES.falReports).insert(row);
  checkErr(error, "recordFalReport");
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

/**
 * One reading from the Responses API: the downscaled photo, the identity-free
 * note, a strict JSON schema, `store: false`. Times out after
 * `FAL_TIMEOUT_MS`; any failure is a reason, never a throw, so the app can
 * read the cup itself.
 */
export async function readCupWithAI(
  jpegBase64: string,
  context: FalContext,
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<FalAiOutcome> {
  const model = falModel(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FAL_TIMEOUT_MS);
  try {
    const res = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(falRequestBody(model, context, jpegBase64)),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[fal] openai status", res.status);
      return { ok: false, reason: "failed" };
    }
    const text = responseText(await res.json());
    if (!text) return { ok: false, reason: "unfit" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, reason: "unfit" };
    }
    const reading = parseFalReply(parsed);
    return reading ? { ok: true, reading, model } : { ok: false, reason: "unfit" };
  } catch (err) {
    console.error("[fal] openai request failed", err instanceof Error ? err.name : err);
    return { ok: false, reason: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

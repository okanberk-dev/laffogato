import "server-only";

import { getDb, TABLES } from "@/lib/db";

/**
 * Periodic destruction (KVKK m.7 / Silme, Yok Etme veya Anonim Hale Getirme
 * Yönetmeliği) — the executable half of the published Veri Saklama ve İmha
 * Politikası.
 *
 * The policy is a binding public undertaking: it names a retention period per
 * data category and promises that periodic destruction runs in the last work
 * week of June and December. Nothing in the code did any of it, so
 * `auth_attempts` — whose primary key is literally `<purpose>::<IP>::<e-mail>`
 * — grew without a ceiling for a counter whose purpose expires in five
 * minutes. That is a data-minimisation failure (KVKK m.4/2-d) on top of an
 * unkept promise.
 *
 * Two rules govern every number below:
 *
 *   1. **The period is READ from the policy, never invented.** Each rule
 *      carries the sentence it comes from, and `tests/mobile-retention.test.ts`
 *      fails if that sentence is no longer in `src/lib/legal/content.ts`.
 *   2. **Never destroy early.** Where the policy sets a MANDATORY minimum
 *      (10 years of audit log, 3 years of commercial-mail send records) the
 *      year is counted as 366 days, so a decade of leap years cannot round a
 *      record out of existence a day before it is allowed to go.
 *
 * Where the policy states a CEILING rather than a minimum, the sweep may be
 * shorter — minimisation requires it. `auth_attempts` is the case: the policy
 * allows a year for security logs, the row is useless after five minutes, so
 * it goes at a week.
 */

/** A mandatory-minimum year, rounded up so leap days can never shorten it. */
const YEAR_DAYS = 366;

export interface RetentionRule {
  /** Stable id — used by the report and by the test that locks the periods. */
  id: string;
  table: string;
  /** ISO-8601 text column the row's age is measured from. */
  column: string;
  /** Primary key, so a destruction can be counted without reading the row. */
  idColumn: string;
  /** How long a row may live. */
  days: number;
  /**
   * The published sentence this period comes from. Must still appear in
   * `src/lib/legal/content.ts`, verbatim.
   */
  basis: string;
  /** Why this number, when it is not simply the published one. */
  note?: string;
}

export const RETENTION_RULES: readonly RetentionRule[] = [
  {
    id: "auth-attempts",
    table: TABLES.authAttempts,
    column: "updatedAt",
    idColumn: "key",
    days: 7,
    basis:
      "5651 sayılı Kanun kapsamındaki asgari süreye uygun olarak 1 yıl; güvenlik olayına konu kayıtlar olayın incelenmesi tamamlanana kadar ayrıca muhafaza edilir.",
    note:
      "Published period is a CEILING for security logs, not a minimum. This " +
      "table's key carries an IP and an e-mail address for a counter whose " +
      "window is five minutes and whose lockout is one, so KVKK m.4/2-d " +
      "requires the shortest period that still serves the purpose. A week " +
      "leaves room to read a credential-stuffing wave; a record that is " +
      "evidence in an actual security incident is preserved separately, which " +
      "is what the published sentence reserves.",
  },
  {
    id: "campaign-email-sends",
    table: TABLES.campaignEmailSends,
    column: "createdAt",
    idColumn: "id",
    days: 3 * YEAR_DAYS,
    basis:
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik uyarınca kayıt tarihinden itibaren 3 yıl.",
    note:
      "A MINIMUM: the regulation requires the send record to be producible " +
      "for three years. Nothing here may shorten it.",
  },
  {
    id: "audit-logs",
    table: TABLES.auditLogs,
    column: "createdAt",
    idColumn: "id",
    days: 10 * YEAR_DAYS,
    basis:
      "İşlemin gerçekleştiği tarihten itibaren 10 yıl. Kayıtlar değiştirilemez (append-only) olarak tutulur.",
    note:
      "A MINIMUM, and the table is append-only: this rule exists so the " +
      "decade eventually ends, not so the log can be trimmed. Today it " +
      "matches nothing — the oldest row is months old — and that is correct.",
  },
  {
    id: "counter-tokens",
    table: TABLES.counterTokens,
    column: "expiresAt",
    idColumn: "tokenHash",
    days: 1,
    basis:
      "Otomatik imha kuralları (kamera kayıtlarının üzerine yazılması, jeton sürelerinin dolması, çerez ömürleri) için sistem tarafından üretilen kayıtlar dönemsel olarak örnekleme yöntemiyle doğrulanır.",
    note:
      "The till QR carries the member's e-mail and its own life is two " +
      "minutes. The DURABLE record of a café visit is the `loyalty_stamps` " +
      "row `redeemCounterToken` writes, which this rule does not touch; the " +
      "token is the ephemeral half. `redeemCounterToken` already sweeps a " +
      "day past expiry, but only when somebody scans something — a quiet " +
      "week leaves the rows standing. Same cutoff, on a schedule.",
  },
] as const;

export interface RetentionOutcome {
  id: string;
  table: string;
  /** Rows older than this instant are in scope. */
  cutoff: string;
  /** How many rows the rule matched. */
  matched: number;
  /** How many were actually destroyed — always 0 in report mode. */
  destroyed: number;
  /** Set when the rule could not be evaluated; the run carries on. */
  error?: string;
}

export interface RetentionReport {
  at: string;
  /** False = report only. Destruction is irreversible, so it is opt-in. */
  applied: boolean;
  results: RetentionOutcome[];
  totalMatched: number;
  totalDestroyed: number;
}

function cutoffFor(rule: RetentionRule, now: Date): string {
  return new Date(now.getTime() - rule.days * 86_400_000).toISOString();
}

/**
 * Whether this deployment is allowed to actually destroy anything.
 *
 * Opt-in, and deliberately not a boolean an operator can set by accident:
 * the first runs of a destruction job should be read in the response body
 * before anything is removed (docs/DATABASE.md, "Periyodik imha").
 */
export function destructionEnabled(
  value: string | undefined = process.env.RETENTION_APPLY,
): boolean {
  return (value ?? "").trim().toLowerCase() === "destroy";
}

async function runRule(
  rule: RetentionRule,
  now: Date,
  apply: boolean,
): Promise<RetentionOutcome> {
  const cutoff = cutoffFor(rule, now);
  const base = { id: rule.id, table: rule.table, cutoff };

  // `neq(column, "")` matters: every timestamp column in this schema defaults
  // to the empty string, and "" sorts before any ISO-8601 instant. Without it
  // a row whose stamp was never written would be destroyed by every rule on
  // its first run, whatever its real age.
  const counted = await getDb()
    .from(rule.table)
    .select("*", { count: "exact", head: true })
    .lt(rule.column, cutoff)
    .neq(rule.column, "");
  if (counted.error) {
    return { ...base, matched: 0, destroyed: 0, error: counted.error.message };
  }
  const matched = counted.count ?? 0;
  if (!apply || matched === 0) return { ...base, matched, destroyed: 0 };

  const removed = await getDb()
    .from(rule.table)
    .delete()
    .select(rule.idColumn)
    .lt(rule.column, cutoff)
    .neq(rule.column, "");
  if (removed.error) {
    return { ...base, matched, destroyed: 0, error: removed.error.message };
  }
  const rows = removed.data as unknown;
  return {
    ...base,
    matched,
    destroyed: Array.isArray(rows) ? rows.length : matched,
  };
}

/**
 * Evaluates every rule, newest first is irrelevant here — each is independent
 * and a failing one does not stop the others (a report that covers three of
 * four categories is worth more than an exception).
 *
 * `apply: false` (the default) counts and reports without removing anything.
 */
export async function runRetention(
  options: { now?: Date; apply?: boolean } = {},
): Promise<RetentionReport> {
  const now = options.now ?? new Date();
  const apply = options.apply === true;
  const results: RetentionOutcome[] = [];
  for (const rule of RETENTION_RULES) {
    results.push(await runRule(rule, now, apply));
  }
  return {
    at: now.toISOString(),
    applied: apply,
    results,
    totalMatched: results.reduce((n, r) => n + r.matched, 0),
    totalDestroyed: results.reduce((n, r) => n + r.destroyed, 0),
  };
}

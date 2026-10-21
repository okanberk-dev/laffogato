import "server-only";

import { safeAudit } from "@/lib/admin/audit";
import { getDb, TABLES } from "@/lib/db";

/**
 * Periodic destruction (KVKK m.7 / Silme, Yok Etme veya Anonim Hale Getirme
 * Yönetmeliği) - the executable half of the published Veri Saklama ve İmha
 * Politikası.
 *
 * The policy is a binding public undertaking: it names a retention period per
 * data category and promises that periodic destruction runs in the last work
 * week of June and December. Nothing in the code did any of it, so
 * `auth_attempts` - whose primary key is literally `<purpose>::<IP>::<e-mail>`
 * - grew without a ceiling for a counter whose purpose expires in five
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
 * shorter - minimisation requires it. `auth_attempts` is the case: the policy
 * allows a year for security logs, the row is useless after five minutes, so
 * it goes at a week.
 *
 * Every run that destroys leaves one record, and it holds no personal data:
 * an `audit_logs` row (actor `system`, action `bulk_delete`, entity
 * `retention`) with the rule-by-rule counts. The Silme Yönetmeliği m.7/3
 * asks for a record of every destruction, kept at least three years; the
 * audit log keeps it ten (rule `audit-logs`). A report run records nothing.
 */

/** A mandatory-minimum year, rounded up so leap days can never shorten it. */
const YEAR_DAYS = 366;

const DAY_MS = 86_400_000;

/** The köşk's clock: Türkiye keeps UTC+3 all year (CLAUDE.md rule 22). */
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface RetentionRule {
  /** Stable id - used by the report and by the test that locks the periods. */
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
  /**
   * A SQL function `(p_cutoff text, p_apply boolean) returns integer` that
   * counts (and, when applying, deletes or clears) the rows in scope, for a
   * period the single `column < cutoff` test cannot express. It honours the
   * same cutoff; `column` then only names the stamp the function reads. One
   * cell back, so it is called through `rpc()` (CLAUDE.md rule 23;
   * tests/mobile-retention.test.ts reads the schema for `returns integer`).
   */
  rpc?: string;
  /**
   * The function also takes `p_keep jsonb`: ids that must stay whatever
   * their age, given by the caller (`runRetention({ keep: { [id]: [...] } })`).
   * Without that list the rule counts and removes nothing.
   */
  keep?: true;
  /**
   * `column` holds a calendar day on the köşk's clock ("YYYY-MM-DD",
   * Europe/Istanbul), not an instant. The cutoff is then written on that
   * clock ("…+03:00"), so its first ten characters are the köşk's day: the
   * UTC form would name yesterday between 00:00 and 03:00 (CLAUDE.md rule
   * 22). The function compares `column < left(p_cutoff, 10)`.
   */
  istanbulDay?: boolean;
  /**
   * The function empties the personal fields of a row instead of deleting
   * it; the destruction record names the method (`destructionRecord`).
   */
  clears?: true;
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
    id: "email-suppressions",
    table: TABLES.emailSuppressions,
    column: "updatedAt",
    idColumn: "email",
    days: 3 * YEAR_DAYS,
    basis:
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik uyarınca kayıt tarihinden itibaren 3 yıl.",
    note:
      "The bounce and complaint list is part of the commercial-mail send " +
      "record: what happened to a message sent to that address. Measured " +
      "from the LATEST event (updatedAt), so an address that keeps bouncing " +
      "stays suppressed; three years without one, and the address may be " +
      "mailed again if its owner still consents.",
  },
  {
    id: "customer-consents",
    table: TABLES.customerConsents,
    column: "createdAt",
    idColumn: "id",
    days: 3 * YEAR_DAYS,
    rpc: "customer_consents_retention",
    basis:
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik uyarınca onayın geçerliliğinin sona erdiği tarihten itibaren 3 yıl; onayın geri alınması hâlinde ret kaydı, aynı alıcıya tekrar ileti gönderilmemesini sağlamak amacıyla bu süre boyunca tutulur.",
    note:
      "Measured from the moment the consent STOPPED being valid, which no " +
      "single column holds: a row goes once a withdrawal for the same " +
      "address and purpose, appended at or after it, is three years old " +
      "(the withdrawal record itself included). A consent that still " +
      "stands is never in scope, however old - it is the proof the member's " +
      "mail rests on. Counted in 366-day years.",
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
      "matches nothing - the oldest row is months old - and that is correct.",
  },
  {
    id: "legal-override-history",
    table: TABLES.legalOverrideHistory,
    column: "archivedAt",
    idColumn: "id",
    days: 11 * YEAR_DAYS,
    basis:
      "Sözleşmenin ifasından itibaren 10 yıl; uyuşmazlık hâlinde uyuşmazlığın kesin olarak sonuçlanmasına kadar.",
    note:
      "The panel's replaced and reset legal texts (admin audit CON-02). An " +
      "order's consent records only a version label (`belge sürümü` in the " +
      "Mesafeli satış onay kaydı); the text behind an old label lives here, " +
      "so a row lives as long as a consent recorded under it may: the text " +
      "was accepted until archivedAt, the contract is performed after that " +
      "(goods within 30 days, Mesafeli Sözleşmeler Yönetmeliği m.16; a " +
      "karaoke evening when it takes place), and ten years run from the " +
      "performance. One year past the decade covers the performance; " +
      "counted in 366-day years so nothing goes early. The only personal " +
      "datum is archivedBy, the panel user's address for the act.",
  },
  {
    id: "legal-doc-versions",
    table: TABLES.legalDocVersions,
    column: "createdAt",
    idColumn: "hash",
    days: 11 * YEAR_DAYS,
    rpc: "legal_doc_versions_retention",
    // The texts shown today (`recordShownLegalVersions`): a text replaced
    // long ago can be shown again (a reset to the coded text) and keeps its
    // first "createdAt" (review R1, 21 Eki 2026).
    keep: true,
    basis:
      "Sözleşmenin ifasından itibaren 10 yıl; uyuşmazlık hâlinde uyuşmazlığın kesin olarak sonuçlanmasına kadar.",
    note:
      "Every legal text shown, by hash (decision D-VERSIONS-TABLE; the İşlem " +
      "Rehberi says the confirmed version 'en az 11 yıl saklanır'). The same " +
      "reasoning as legal-override-history: the text is what a consent's " +
      "`textHashes` points at, and the contract it proves is performed after " +
      "the consent and kept ten years from then; one year past the decade " +
      "covers the performance, in 366-day years. `createdAt` is when a text " +
      "was FIRST stored, which says nothing of when it was last shown, so a " +
      "row goes only through the SQL function: stored before the cutoff, " +
      "replaced by a newer text of its document before the cutoff too, and " +
      "named by no order or karaoke consent accepted at or after it. The " +
      "table's trigger refuses any other DELETE of a row younger than eleven " +
      "years. No personal data: the texts are public.",
  },
  {
    id: "fal-readings",
    table: TABLES.falReadings,
    column: "createdAt",
    idColumn: "id",
    days: 90,
    basis: "kullanım kaydı günlük sınırın uygulanması için doksan gün saklanır ve ardından silinir.",
    note:
      "Karar 177. The row holds the day, whether a cup was seen and the " +
      "model - never the photo or the words - and the daily limit only needs " +
      "today's. Ninety days is what Açık Rıza Metni R12 publishes.",
  },
  {
    id: "fal-reports",
    table: TABLES.falReports,
    column: "createdAt",
    idColumn: "id",
    days: 90,
    basis: "Bildirim tarihinden itibaren 90 gün saklanır ve ardından silinir; fotoğraf bildirime girmez.",
    note:
      "'Bu yorumu bildir' (Google Play's AI-generated content policy). The " +
      "row holds the reported reading's words, the reason and the model - " +
      "never the photo - for the operator to review and tighten the " +
      "instructions. Ninety days is what the Veri Saklama ve İmha Politikası " +
      "and Açık Rıza Metni R12 publish.",
  },
  {
    id: "feature-consents",
    table: TABLES.featureConsents,
    column: "revokedAt",
    idColumn: "customerEmail",
    days: 3 * YEAR_DAYS,
    basis: "geri çekme tarihinden itibaren 3 yıl saklanır ve ardından silinir.",
    note:
      "Karar 177. Measured from the WITHDRAWAL: a consent that still stands " +
      "has revokedAt '' and is never in scope (the neq guard). Three years " +
      "of proof that the processing had a consent, counted in 366-day years " +
      "so nothing goes early.",
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
      "day past expiry, but only when somebody scans something - a quiet " +
      "week leaves the rows standing. Same cutoff, on a schedule.",
  },
  {
    id: "karaoke-guest-data",
    table: TABLES.karaokeReservations,
    column: "date",
    idColumn: "id",
    days: 3 * YEAR_DAYS,
    rpc: "karaoke_guest_retention",
    istanbulDay: true,
    clears: true,
    basis:
      "rezervasyon tarihinden itibaren 3 yıl sonra, takip eden ilk periyodik imha döneminde silinir",
    note:
      "Decision ASK-RETENTION. Not a delete (clears): on a guest booking the name " +
      "goes and the address becomes 'anon-<id>@anon.local'; on every " +
      "booking the contact address, phone and note go, and the consent " +
      "record loses its IP and user agent (its time, documents and version " +
      "stay with the row, MSY m.20). A booking whose money is still open " +
      "('pending', 'refunding'), still owed (paid and cancelled or never " +
      "confirmed), with a 'refunding' payment claim, or under a " +
      "retentionHold is skipped; " +
      "a row already cleared is not counted again. Counted in 366-day years " +
      "from the booking day on the köşk's clock.",
  },
  {
    id: "karaoke-reservations",
    table: TABLES.karaokeReservations,
    column: "date",
    idColumn: "id",
    days: 11 * YEAR_DAYS,
    rpc: "karaoke_reservation_retention",
    istanbulDay: true,
    basis:
      "ödeme işlem kayıtlarının saklama süresince (10 yıl) tutulur ve bu sürenin sonunda rezervasyon kaydı tümüyle silinir",
    note: "TTK m.82/6: süre takvim yılının bitişiyle başlar; 11 yıl rezervasyon günü, ödeme ve iadenin en geç olanından sayılır ve hiçbir kaydı erken silmez. Hâlâ borçlu olunan (ödenmiş ve iptal edilmiş ya da onaylanmamış) ve POS'ta iadesi açık rezervasyon silinmez.",
  },
] as const;

export interface RetentionOutcome {
  id: string;
  table: string;
  /**
   * Rows older than this instant are in scope. On an `istanbulDay` rule it
   * is written on the köşk's clock ("…+03:00") and rows whose day is before
   * its first ten characters are.
   */
  cutoff: string;
  /** How many rows the rule matched. */
  matched: number;
  /** How many were actually destroyed - always 0 in report mode. */
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
  /**
   * Whether this run left its destruction record in `audit_logs`: false in
   * report mode, which records nothing, and when the row could not be
   * written (`safeAudit` logs that loudly; the destruction itself stands).
   */
  recorded: boolean;
}

/** An instant on the köşk's clock: "2026-10-21T01:30:00.000+03:00". */
function istanbulIso(ms: number): string {
  return new Date(ms + ISTANBUL_OFFSET_MS)
    .toISOString()
    .replace(/Z$/, "+03:00");
}

function cutoffFor(rule: RetentionRule, now: Date): string {
  const at = now.getTime() - rule.days * DAY_MS;
  return rule.istanbulDay ? istanbulIso(at) : new Date(at).toISOString();
}

/**
 * The destruction record of an applied run (Silme Yönetmeliği m.7/3): when,
 * and rule by rule which table, by which method (`delete` the row, or
 * `clear` its personal fields), from which cutoff, how many rows matched and
 * how many went. Counts only - never a row, a key, an address or an error
 * text (a database error can quote the value it refused). A rule that could
 * not run says so with `failed`, so its zero is not read as "nothing to do".
 */
export function destructionRecord(report: RetentionReport): {
  at: string;
  results: Array<{
    id: string;
    table: string;
    method: "delete" | "clear";
    cutoff: string;
    matched: number;
    destroyed: number;
    failed?: true;
  }>;
} {
  return {
    at: report.at,
    results: report.results.map((r) => ({
      id: r.id,
      table: r.table,
      method: RETENTION_RULES.find((rule) => rule.id === r.id)?.clears
        ? ("clear" as const)
        : ("delete" as const),
      cutoff: r.cutoff,
      matched: r.matched,
      destroyed: r.destroyed,
      ...(r.error !== undefined ? { failed: true as const } : {}),
    })),
  };
}

/**
 * The one line both cron routes log for a run (`/api/cron/retention` and the
 * daily run's last step), so a search for it finds every run. Counts only:
 * nothing here may name a key, an address or an IP - `auth_attempts.key` is
 * all three at once.
 */
export function retentionLogLine(
  report: Pick<RetentionReport, "applied" | "totalMatched" | "totalDestroyed">,
): string {
  return `[cron/retention] ${report.applied ? "destroy" : "report"} matched=${report.totalMatched} destroyed=${report.totalDestroyed}`;
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

/** Ids a rule must keep whatever their age, by rule id (`RetentionRule.keep`). */
export type RetentionKeep = Readonly<Record<string, readonly string[]>>;

async function runRule(
  rule: RetentionRule,
  now: Date,
  apply: boolean,
  keep: RetentionKeep,
): Promise<RetentionOutcome> {
  const cutoff = cutoffFor(rule, now);
  const base = { id: rule.id, table: rule.table, cutoff };

  if (rule.keep && !keep[rule.id]) {
    return {
      ...base,
      matched: 0,
      destroyed: 0,
      error: "keep list not given: nothing counted or removed",
    };
  }

  if (rule.rpc) {
    const { data, error } = await getDb().rpc<number>(rule.rpc, {
      p_cutoff: cutoff,
      p_apply: apply,
      ...(rule.keep ? { p_keep: [...keep[rule.id]] } : {}),
    });
    if (error) {
      return { ...base, matched: 0, destroyed: 0, error: error.message };
    }
    const affected = Number(data ?? 0);
    return { ...base, matched: affected, destroyed: apply ? affected : 0 };
  }

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
 * Evaluates every rule, newest first is irrelevant here - each is independent
 * and a failing one does not stop the others (a report that covers three of
 * four categories is worth more than an exception).
 *
 * `apply: false` (the default) counts and reports without removing anything,
 * and writes nothing at all. `apply: true` destroys, then writes exactly one
 * `audit_logs` row for the run (`destructionRecord`) through `safeAudit`,
 * which never throws: the destruction is done by then, and a failed record
 * must not turn it into an error the cron would retry.
 */
export async function runRetention(
  options: { now?: Date; apply?: boolean; keep?: RetentionKeep } = {},
): Promise<RetentionReport> {
  const now = options.now ?? new Date();
  const apply = options.apply === true;
  const results: RetentionOutcome[] = [];
  for (const rule of RETENTION_RULES) {
    results.push(await runRule(rule, now, apply, options.keep ?? {}));
  }
  const report: RetentionReport = {
    at: now.toISOString(),
    applied: apply,
    results,
    totalMatched: results.reduce((n, r) => n + r.matched, 0),
    totalDestroyed: results.reduce((n, r) => n + r.destroyed, 0),
    recorded: false,
  };
  if (apply) {
    report.recorded = await safeAudit({
      actor: "system",
      action: "bulk_delete",
      entity: "retention",
      entityId: report.at,
      payload: destructionRecord(report),
    });
  }
  return report;
}

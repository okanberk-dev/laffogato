import "server-only";

import { randomUUID } from "node:crypto";

import type { DbError } from "@/lib/db";

import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import { getPaymentProvider } from "./index";
import {
  customerScope,
  memberKeyFingerprint,
  openMemberKey,
  rebindMemberKey,
} from "./card-vault";
import { PaynkolayPaymentProvider } from "./paynkolay";

/**
 * Saved cards a closed account still has at PayNkolay (docs/PAYNKOLAY.md
 * §16.3, migration 20261119175128_card_vault_purges.sql).
 *
 * Closing an account deletes the member's cards at the POS first. When the
 * POS does not answer in time the closure goes on (a member is never kept
 * from leaving), and the member key - sealed, bound to the queue row - waits
 * in `card_vault_purges` until the daily run deletes the cards. Nothing is
 * written to the log but a fingerprint.
 */

/** Rows tried per daily run; each is two POS calls per card. */
const PURGE_BATCH = 25;
/** One POS round for one closed account, at most. */
const PURGE_ROW_DEADLINE_MS = 10_000;

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

function purgeScope(id: string): string {
  return `purge:${id}`;
}

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

function paynkolay(): PaynkolayPaymentProvider | null {
  try {
    const provider = getPaymentProvider();
    return provider instanceof PaynkolayPaymentProvider ? provider : null;
  } catch {
    return null;
  }
}

/**
 * Queues a closed account's cards for deletion at the POS. `stored` is the
 * customer row's column as stored (sealed for `customerId`, or a legacy
 * clear key); it is sealed again for the queue row. Returns whether the
 * row was written. Never throws.
 */
export async function queueCardPurge(
  customerId: string,
  stored: string,
): Promise<boolean> {
  const id = randomUUID();
  try {
    const sealed = rebindMemberKey(
      stored,
      customerScope(customerId),
      purgeScope(id),
    );
    if (!sealed) {
      console.error(
        "[card-purge] closed account's card key does not open; cards left at the POS",
      );
      return false;
    }
    const { error } = await getDb().from(TABLES.cardVaultPurges).insert({
      id,
      sealedKey: sealed,
      createdAt: new Date().toISOString(),
    });
    checkErr(error, "cardPurge.queue");
    return true;
  } catch (err) {
    console.error(
      "[card-purge] not queued",
      err instanceof Error ? err.message : "unknown",
    );
    return false;
  }
}

interface PurgeRow {
  id: string;
  sealedKey: string;
  attempts: number;
}

export interface CardPurgeReport {
  /** Rows whose cards are gone now (the row is deleted). */
  purged: number;
  /** Rows the POS did not answer for; tried again tomorrow. */
  pending: number;
  /** Rows no configured vault key opens; left for the operator. */
  unreadable: number;
  /** Card storage is not configured here: nothing was tried. */
  skipped?: "no-provider";
}

/**
 * The daily step: asks PayNkolay to delete the queued accounts' cards and
 * drops each row once its cards are gone. A failure leaves the row (and
 * counts the attempt); nothing here throws for a single row.
 */
export async function runCardPurges(): Promise<CardPurgeReport> {
  const report: CardPurgeReport = { purged: 0, pending: 0, unreadable: 0 };
  const { data, error } = await getDb()
    .from(TABLES.cardVaultPurges)
    .select("id, sealedKey, attempts")
    .order("createdAt", { ascending: true })
    .limit(PURGE_BATCH);
  checkErr(error, "cardPurge.list");
  const rows = (data ?? []) as PurgeRow[];
  if (rows.length === 0) return report;
  const provider = paynkolay();
  if (!provider) return { ...report, skipped: "no-provider" };

  for (const row of rows) {
    const opened = openMemberKey(row.sealedKey, purgeScope(row.id));
    if (!opened.ok || !opened.key) {
      report.unreadable += 1;
      await markAttempt(row, "unreadable");
      continue;
    }
    try {
      await withDeadline(
        provider.deleteAllSavedCards(opened.key),
        PURGE_ROW_DEADLINE_MS,
      );
      const { error: delError } = await getDb()
        .from(TABLES.cardVaultPurges)
        .delete()
        .eq("id", row.id);
      checkErr(delError, "cardPurge.done");
      report.purged += 1;
    } catch (err) {
      report.pending += 1;
      console.error(
        `[card-purge] cards not deleted yet fp=${memberKeyFingerprint(opened.key)}`,
        err instanceof Error ? err.message : "unknown",
      );
      await markAttempt(row, "pos");
    }
  }
  return report;
}

async function markAttempt(row: PurgeRow, reason: string): Promise<void> {
  try {
    const { error } = await getDb()
      .from(TABLES.cardVaultPurges)
      .update({
        attempts: (row.attempts ?? 0) + 1,
        lastAttemptAt: new Date().toISOString(),
        lastError: reason,
      })
      .eq("id", row.id);
    checkErr(error, "cardPurge.attempt");
  } catch {
    // Bookkeeping only; the row is tried again either way.
  }
}

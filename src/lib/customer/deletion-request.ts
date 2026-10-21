import "server-only";

import type { DbError } from "@/lib/db";
import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import {
  deletionRequestOf,
  type DeletionRequest,
} from "./deletion-request-core";

/**
 * The rows behind a web account-deletion request (`customers."deletionRequestedAt"`,
 * migration 20261018090000). The rules and the words are in
 * `./deletion-request-core`; the closure itself stays `deleteMe`
 * (lib/mobile/me.ts), run from the panel, which also clears the request.
 */

function checkErr(error: DbError | null, ctx: string): void {
  // An empty code means the request never reached Postgres (health.ts).
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

function normalizeEmail(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

/** The member's open request, or null (none, or no such account). */
export async function getDeletionRequest(
  email: string,
): Promise<DeletionRequest | null> {
  const needle = normalizeEmail(email);
  if (!needle) return null;
  const { data, error } = await getDb()
    .from(TABLES.customers)
    .select("deletionRequestedAt, deletionReason")
    .eq("email", needle)
    .maybeSingle();
  checkErr(error, "getDeletionRequest");
  return data ? deletionRequestOf(data as Record<string, unknown>) : null;
}

export type OpenDeletionResult =
  /** This call opened it: mail the team and the member. */
  | { status: "created"; requestedAt: string }
  /** One was already open: nothing written, nobody mailed again. */
  | { status: "exists"; requestedAt: string }
  /** No active account under the address. */
  | { status: "not_found" };

/**
 * Opens the member's request, once.
 *
 * One statement decides it: the stamp is written only while the column is
 * NULL and the account is active, and the row comes back only when it was.
 * Two presses at the same moment (a double click, two tabs) therefore open
 * ONE request with one date and one pair of mails; a read-then-write here
 * would let both through (rule 20's reason, on a smaller stage).
 */
export async function openDeletionRequest(
  email: string,
  reason: string,
  now: Date = new Date(),
): Promise<OpenDeletionResult> {
  const needle = normalizeEmail(email);
  if (!needle) return { status: "not_found" };
  const at = now.toISOString();
  const { data, error } = await getDb()
    .from(TABLES.customers)
    .update({ deletionRequestedAt: at, deletionReason: reason, updatedAt: at })
    .eq("email", needle)
    .eq("isActive", true)
    .eq("deletionRequestedAt", null)
    .select("deletionRequestedAt");
  checkErr(error, "openDeletionRequest");
  if (Array.isArray(data) && data.length > 0) {
    return { status: "created", requestedAt: at };
  }
  const existing = await getDeletionRequest(needle);
  return existing
    ? { status: "exists", requestedAt: existing.requestedAt }
    : { status: "not_found" };
}

export type WithdrawDeletionResult =
  { status: "withdrawn"; requestedAt: string } | { status: "none" };

/**
 * Takes the member's request back: the stamp and the reason go, the
 * account stays. Conditioned on the stamp that was read, so a request the
 * panel closed (the row is anonymised then) or that was opened anew in
 * another tab is never cleared by a stale press.
 */
export async function withdrawDeletionRequest(
  email: string,
  now: Date = new Date(),
): Promise<WithdrawDeletionResult> {
  const needle = normalizeEmail(email);
  const open = needle ? await getDeletionRequest(needle) : null;
  if (!open) return { status: "none" };
  const { data, error } = await getDb()
    .from(TABLES.customers)
    .update({
      deletionRequestedAt: null,
      deletionReason: "",
      updatedAt: now.toISOString(),
    })
    .eq("email", needle)
    .eq("deletionRequestedAt", open.requestedAt)
    .select("id");
  checkErr(error, "withdrawDeletionRequest");
  return Array.isArray(data) && data.length > 0
    ? { status: "withdrawn", requestedAt: open.requestedAt }
    : { status: "none" };
}

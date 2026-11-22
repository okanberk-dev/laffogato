import type { SignedCaller } from "./signed-callers";

/**
 * Şubeler: which branch an order, a table, a table call, a sold-out mark
 * and a signed caller belong to (21 Kas 2026; docs/LAFPOS.md "Şube").
 *
 * Until then the site had no branch at all: every app order, table, table
 * call and karaoke booking was the Tuzla köşk's, and both signed callers
 * (the köşk's panel and LafPOS) got the same lists. The first LafPOS till
 * went to Marina (lafpos docs/03-ENTEGRASYON.md, lafmaliyet docs/SUBE.md
 * `LAFPOS_BRANCH_ID = "marina"`), so with one key on the café's machine
 * Marina would have rung, moved and closed Tuzla's paid orders and calls,
 * and one shared "Satışta / Tükendi" flag let each branch close the other's
 * item (the owner's decision of 4 Kas 2026: sold out is per branch).
 *
 * The rule, the same in every signed route:
 *
 * - A branch id is lafmaliyet's (`src/lib/branches.ts` there): a letter,
 *   then lower-case letters, digits or hyphens, 2-24 characters.
 * - The site knows `SITE_BRANCHES` (env `SITE_BRANCHES`, comma list, to add
 *   one without a release; default `tuzla,marina`). Everything written
 *   before branches existed, and everything the app or the web takes that is
 *   not at a table (gel-al, kurye, kargo), is `HOME_BRANCH`: the app and the
 *   web serve the Tuzla köşk alone (CLAUDE.md "Marina şubesi").
 * - The panel's key (`KARAOKE_SYNC_SECRET`) is the owner's back office: it
 *   may act for any branch and, saying none, acts for `HOME_BRANCH`, so a
 *   panel that predates this change reads and writes exactly Tuzla.
 * - LafPOS's key (`LAFPOS_SYNC_SECRET`) acts for the branches in
 *   `LAFPOS_BRANCHES` (comma list, default `marina`; the first is what it
 *   gets saying none). Every LafPOS install shares the one key, so a second
 *   till in another branch is added there and names its branch.
 * - A request names its branch as `branch`: in the query of a GET, in the
 *   body of a POST or PUT. Both are signed (karaoke-sync-core.ts), so the
 *   name cannot be changed on the way. Malformed or unknown: 400 `invalid`
 *   with `field: "branch"`; a branch the key may not act for: 403
 *   `forbidden` with `field: "branch"`, before anything is read.
 *
 * Pure (no `server-only`, no database): the routes and the tests share it.
 */

/** Where everything without a branch of its own belongs. */
export const HOME_BRANCH = "tuzla";

/** The branches the site knows when `SITE_BRANCHES` is unset. */
export const DEFAULT_SITE_BRANCHES: readonly string[] = ["tuzla", "marina"];

/** LafPOS's branches when `LAFPOS_BRANCHES` is unset: the first till's. */
export const DEFAULT_LAFPOS_BRANCHES: readonly string[] = ["marina"];

/**
 * The karaoke room's branch. One room, in the Tuzla köşk: a booking has no
 * branch of its own, and a caller acting for another branch reads none.
 * A second room is a new feature (slots, prices, the booking form), not a
 * column.
 */
export const KARAOKE_BRANCH = HOME_BRANCH;

/** The names the site panel shows; another id shows as itself, capitalised. */
export const BRANCH_LABELS: Readonly<Record<string, string>> = {
  tuzla: "Tuzla",
  marina: "Marina",
};

export function branchLabel(branch: string): string {
  return (
    BRANCH_LABELS[branch] ??
    branch.charAt(0).toLocaleUpperCase("tr-TR") + branch.slice(1)
  );
}

/** lafmaliyet's id rule (`branches_id_ck` there); the database checks it too. */
export const BRANCH_ID_PATTERN = /^[a-z][a-z0-9-]{1,23}$/;

export function isBranchId(value: unknown): value is string {
  return typeof value === "string" && BRANCH_ID_PATTERN.test(value);
}

function listFrom(
  raw: string | undefined,
  fallback: readonly string[],
): string[] {
  const named = (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(isBranchId);
  return [...new Set(named.length > 0 ? named : fallback)];
}

/** The branches this deployment knows, `HOME_BRANCH` always among them. */
export function siteBranches(
  env: Record<string, string | undefined>,
): string[] {
  const list = listFrom(env.SITE_BRANCHES, DEFAULT_SITE_BRANCHES);
  return list.includes(HOME_BRANCH) ? list : [HOME_BRANCH, ...list];
}

/**
 * The branches a caller may act for, its default first. LafPOS's are the
 * ones of `LAFPOS_BRANCHES` the site knows; none known leaves it none, and
 * every LafPOS request then answers 403 (a mistyped setting stops the till
 * from reading anyone's orders rather than reading Tuzla's).
 */
export function callerBranches(
  env: Record<string, string | undefined>,
  caller: SignedCaller,
): string[] {
  const known = siteBranches(env);
  if (caller === "panel") {
    return [HOME_BRANCH, ...known.filter((b) => b !== HOME_BRANCH)];
  }
  return listFrom(env.LAFPOS_BRANCHES, DEFAULT_LAFPOS_BRANCHES).filter((b) =>
    known.includes(b),
  );
}

export type BranchChoice =
  | { ok: true; branch: string }
  | { ok: false; status: 400; error: "invalid"; field: "branch" }
  | { ok: false; status: 403; error: "forbidden"; field: "branch" };

/**
 * The branch a signed request acts for: the one it names, else the
 * caller's default. `requested` is the raw value (absent, "" and null name
 * none).
 */
export function chooseBranch(
  env: Record<string, string | undefined>,
  caller: SignedCaller,
  requested: unknown,
): BranchChoice {
  const allowed = callerBranches(env, caller);
  if (requested === undefined || requested === null || requested === "") {
    const fallback = allowed[0];
    return fallback
      ? { ok: true, branch: fallback }
      : { ok: false, status: 403, error: "forbidden", field: "branch" };
  }
  if (!isBranchId(requested) || !siteBranches(env).includes(requested)) {
    return { ok: false, status: 400, error: "invalid", field: "branch" };
  }
  if (!allowed.includes(requested)) {
    return { ok: false, status: 403, error: "forbidden", field: "branch" };
  }
  return { ok: true, branch: requested };
}

/** A stored row's branch: `HOME_BRANCH` for a row from before branches. */
export function branchOf(row: { branch?: unknown } | null | undefined): string {
  return isBranchId(row?.branch) ? row.branch : HOME_BRANCH;
}

/**
 * Takes the optional `branch` out of a write's raw JSON, so the write's own
 * strict schema (which predates it) parses the rest unchanged. A body that
 * is not an object is left for that schema to refuse.
 */
export function splitBranch(raw: unknown): { branch: unknown; rest: unknown } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { branch: undefined, rest: raw };
  }
  const { branch, ...rest } = raw as Record<string, unknown>;
  return { branch, rest };
}

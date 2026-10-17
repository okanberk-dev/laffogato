import "server-only";

import { getCustomerByEmail } from "@/lib/customer/store";
import { getDb, TABLES, type DbError } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

/**
 * App members who may stamp at the till from the mobile app (barista).
 *
 * The panel's `cashier` role is a panel account with a password, opened on a
 * shared device. A barista behind the bar already carries the app, signed in
 * with their own member account; this table is the panel's permission for
 * that account to scan a member's QR (`POST /api/mobile/v1/staff/stamp`,
 * docs/API-MOBILE.md §21). Granted and revoked on /admin/kullanicilar.
 *
 * Revoking flips `isActive` rather than deleting the row, so the panel can
 * still show who once held the till and who took it away.
 */

const TABLE = TABLES.staffMembers;

export type StaffRole = "barista";

export interface StaffMember {
  email: string;
  role: StaffRole;
  isActive: boolean;
  grantedBy: string;
  grantedAt: string;
  updatedAt: string;
  /** The member's name from `customers`; empty when the account has none. */
  name: string;
}

export type StaffMemberErrorCode =
  | "invalid_email"
  | "no_member"
  | "closed_member"
  | "already_active"
  | "not_found";

export type StaffMemberResult =
  | { ok: true; value: StaffMember }
  | { ok: false; error: StaffMemberErrorCode; message: string };

const MESSAGES: Record<StaffMemberErrorCode, string> = {
  invalid_email: "Geçerli bir e-posta gir.",
  no_member:
    "Bu adrese ait üye hesabı yok. Barista önce uygulamaya bu e-postayla üye olmalı.",
  closed_member: "Bu üye hesabı kapalı; kasa yetkisi verilemez.",
  already_active: "Bu üye zaten uygulamadan kasa yapabiliyor.",
  not_found: "Bu adres için açık bir barista yetkisi yok.",
};

function fail(error: StaffMemberErrorCode): StaffMemberResult {
  return { ok: false, error, message: MESSAGES[error] };
}

function checkErr(error: DbError | null, ctx: string): void {
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

export function normalizeStaffEmail(raw: string): string {
  return (raw ?? "").trim().toLowerCase();
}

function toMember(row: Record<string, unknown>, name = ""): StaffMember {
  return {
    email: String(row.email ?? ""),
    role: "barista",
    isActive: row.isActive === true,
    grantedBy: String(row.grantedBy ?? ""),
    grantedAt: String(row.grantedAt ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
    name,
  };
}

async function fetchRow(email: string): Promise<StaffMember | null> {
  const { data, error } = await getDb()
    .from(TABLE)
    .select("*")
    .eq("email", email)
    .maybeSingle();
  checkErr(error, "staff.fetch");
  return data ? toMember(data as Record<string, unknown>) : null;
}

/** Every row, active first, with the member's current name beside it. */
export async function listStaffMembers(): Promise<StaffMember[]> {
  const { data, error } = await getDb()
    .from(TABLE)
    .select("*")
    .order("email", { ascending: true });
  checkErr(error, "staff.list");
  const rows = ((data as Record<string, unknown>[] | null) ?? []).map((r) =>
    toMember(r),
  );
  const named = await Promise.all(
    rows.map(async (row) => {
      const customer = await getCustomerByEmail(row.email);
      return { ...row, name: customer?.name ?? "" };
    }),
  );
  return named.sort((a, b) => Number(b.isActive) - Number(a.isActive));
}

/**
 * Whether this member may stamp from the app right now.
 *
 * Only the row is read here. A closed member account never gets this far:
 * `requireMobileCustomer` refuses it before any route runs.
 */
export async function isActiveBarista(email: string): Promise<boolean> {
  const needle = normalizeStaffEmail(email);
  if (!needle) return false;
  const row = await fetchRow(needle);
  return row?.isActive === true;
}

export interface GrantBaristaInput {
  email: string;
  /** The admin who pressed the button. */
  grantedBy: string;
}

/**
 * Lets an existing, open member account stamp from the app.
 *
 * The address must already be a member: a grant to an address nobody holds
 * would sit waiting for whoever signs up with it first - and the Supabase
 * sign-up is open to anyone - so the panel refuses instead of guessing.
 */
export async function grantBarista(
  input: GrantBaristaInput,
): Promise<StaffMemberResult> {
  const email = normalizeStaffEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("invalid_email");

  const customer = await getCustomerByEmail(email);
  if (!customer) return fail("no_member");
  if (!customer.isActive) return fail("closed_member");

  const existing = await fetchRow(email);
  if (existing?.isActive) return fail("already_active");

  const now = new Date().toISOString();
  const row = {
    email,
    role: "barista" as const,
    isActive: true,
    grantedBy: normalizeStaffEmail(input.grantedBy),
    grantedAt: now,
    updatedAt: now,
  };
  const { error } = existing
    ? await getDb()
        .from(TABLE)
        .update({
          isActive: true,
          grantedBy: row.grantedBy,
          grantedAt: now,
          updatedAt: now,
        })
        .eq("email", email)
    : await getDb().from(TABLE).insert(row);
  checkErr(error, "staff.grant");
  return { ok: true, value: toMember(row, customer.name) };
}

/**
 * Takes the till away from the app account; the row stays as a record of who
 * granted it. Who revoked it is in the audit log.
 */
export async function revokeBarista(
  rawEmail: string,
): Promise<StaffMemberResult> {
  const email = normalizeStaffEmail(rawEmail);
  if (!email) return fail("invalid_email");
  const now = new Date().toISOString();
  const { data, error } = await getDb()
    .from(TABLE)
    .update({ isActive: false, updatedAt: now })
    .eq("email", email)
    .eq("isActive", true)
    .select("*");
  checkErr(error, "staff.revoke");
  const row = ((data as Record<string, unknown>[] | null) ?? [])[0];
  if (!row) return fail("not_found");
  return { ok: true, value: toMember(row) };
}

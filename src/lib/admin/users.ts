import "server-only";

import bcrypt from "bcryptjs";

import { getDb, TABLES, type DbError } from "@/lib/db";

import { forgetAdminActivity } from "./activity";
import { isAdminRole, type AdminRole } from "./roles";

/**
 * Panel-managed admin accounts.
 *
 * Until now the only way to hand someone panel access was to edit the
 * ADMIN_USERS environment variable and redeploy, which made "add a cashier for
 * the weekend" a release. These rows are the primary source; the env record
 * stays as the break-glass path so nobody can lock themselves out of the panel
 * from inside the panel.
 */

const TABLE = TABLES.adminUsers;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ten characters, not eight: this password opens the till and the catalog. */
export const MIN_ADMIN_PASSWORD_LENGTH = 10;
const MAX_ADMIN_PASSWORD_LENGTH = 200;

export interface AdminUserRow {
  email: string;
  passwordHash: string;
  role: AdminRole;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/** Everything about an account except the one field nothing may echo back. */
export type PublicAdminUser = Omit<AdminUserRow, "passwordHash">;

export type AdminUserErrorCode =
  | "invalid_email"
  | "invalid_role"
  | "invalid_name"
  | "weak_password"
  | "exists"
  | "not_found"
  | "last_owner";

export type AdminUserResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AdminUserErrorCode; message: string };

const MESSAGES: Record<AdminUserErrorCode, string> = {
  invalid_email: "Geçerli bir e-posta gir.",
  invalid_role: "Rol seçimi geçersiz.",
  invalid_name: "Ad en az 2 karakter olmalı.",
  weak_password: `Parola en az ${MIN_ADMIN_PASSWORD_LENGTH} karakter olmalı.`,
  exists: "Bu e-posta zaten kayıtlı.",
  not_found: "Kullanıcı bulunamadı.",
  last_owner:
    "Son aktif sahip hesabı kapatılamaz, silinemez veya rolü düşürülemez. Önce başka bir sahip ekle.",
};

function fail(error: AdminUserErrorCode): AdminUserResult<never> {
  return { ok: false, error, message: MESSAGES[error] };
}

function checkErr(error: DbError | null, where: string): void {
  if (error) throw new Error(`${where}: ${error.message}`);
}

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublic(row: AdminUserRow): PublicAdminUser {
  const { passwordHash: _hash, ...rest } = row;
  void _hash;
  return rest;
}

/** Rows come back from Postgres untyped; role is the only field worth pinning. */
function withDefaults(row: Record<string, unknown>): AdminUserRow {
  const role = String(row.role ?? "");
  return {
    email: String(row.email ?? ""),
    passwordHash: String(row.passwordHash ?? ""),
    role: isAdminRole(role) ? role : "cashier",
    name: String(row.name ?? ""),
    isActive: row.isActive !== false,
    createdAt: String(row.createdAt ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
    createdBy: String(row.createdBy ?? ""),
  };
}

async function fetchRow(email: string): Promise<AdminUserRow | null> {
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("email", email)
    .maybeSingle();
  checkErr(error, "fetchAdminUser");
  return data ? withDefaults(data as Record<string, unknown>) : null;
}

export async function listAdminUsers(): Promise<PublicAdminUser[]> {
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .order("email", { ascending: true });
  checkErr(error, "listAdminUsers");
  return ((data as Record<string, unknown>[] | null) ?? [])
    .map(withDefaults)
    .map(toPublic);
}

/** Whether the panel has any account of its own - used only for the "env eksik" message. */
export async function anyAdminUserExists(): Promise<boolean> {
  try {
    const sb = getDb();
    const { data, error } = await sb.from(TABLE).select("email").limit(1);
    if (error) return false;
    return ((data as unknown[] | null) ?? []).length > 0;
  } catch {
    return false;
  }
}

/**
 * The account the login flow should use for this address, or null when the
 * database has nothing active for it.
 *
 * Never throws: an unreachable database must not take the env break-glass
 * login down with it.
 */
export async function resolveAdminUser(
  email: string,
): Promise<AdminUserRow | null> {
  const needle = normalizeAdminEmail(email);
  if (!needle) return null;
  try {
    const row = await fetchRow(needle);
    return row && row.isActive ? row : null;
  } catch {
    return null;
  }
}

export async function verifyAdminPassword(
  row: AdminUserRow,
  password: string,
): Promise<boolean> {
  if (!row.passwordHash) return false;
  return bcrypt.compare(password, row.passwordHash);
}

/**
 * Refuses a change that would leave the panel without a single active owner.
 * `next` describes the account's state AFTER the change ("deleted" for a
 * removal); an account that is not an active owner today can never be the one
 * that closes the last door.
 */
async function wouldRemoveLastOwner(
  row: AdminUserRow,
  next: { role: AdminRole; isActive: boolean } | "deleted",
): Promise<boolean> {
  if (row.role !== "owner" || !row.isActive) return false;
  if (next !== "deleted" && next.role === "owner" && next.isActive) {
    return false;
  }
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLE)
    .select("email")
    .eq("role", "owner")
    .eq("isActive", true)
    .neq("email", row.email)
    .limit(1);
  checkErr(error, "wouldRemoveLastOwner");
  return ((data as unknown[] | null) ?? []).length === 0;
}

export interface CreateAdminUserInput {
  email: string;
  name: string;
  role: string;
  password: string;
  /** Who pressed the button; recorded on the row, never the password. */
  createdBy: string;
}

export async function createAdminUser(
  input: CreateAdminUserInput,
): Promise<AdminUserResult<PublicAdminUser>> {
  const email = normalizeAdminEmail(input.email);
  const name = input.name.trim().slice(0, 100);
  if (!EMAIL_RE.test(email)) return fail("invalid_email");
  if (name.length < 2) return fail("invalid_name");
  if (!isAdminRole(input.role)) return fail("invalid_role");
  if (
    input.password.length < MIN_ADMIN_PASSWORD_LENGTH ||
    input.password.length > MAX_ADMIN_PASSWORD_LENGTH
  ) {
    return fail("weak_password");
  }
  if (await fetchRow(email)) return fail("exists");

  const now = new Date().toISOString();
  const row: AdminUserRow = {
    email,
    passwordHash: await bcrypt.hash(input.password, 10),
    role: input.role,
    name,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy: normalizeAdminEmail(input.createdBy),
  };
  const sb = getDb();
  const { error } = await sb.from(TABLE).insert(row);
  if (error) {
    // Unique violation = someone created the same address in the meantime.
    if (error.code === "23505") return fail("exists");
    throw new Error(`createAdminUser: ${error.message}`);
  }
  return { ok: true, value: toPublic(row) };
}

export interface UpdateAdminUserInput {
  name?: string;
  role?: string;
  isActive?: boolean;
}

export async function updateAdminUser(
  email: string,
  patch: UpdateAdminUserInput,
): Promise<AdminUserResult<PublicAdminUser>> {
  const needle = normalizeAdminEmail(email);
  const row = await fetchRow(needle);
  if (!row) return fail("not_found");

  const name =
    patch.name === undefined ? row.name : patch.name.trim().slice(0, 100);
  if (name.length < 2) return fail("invalid_name");
  let role = row.role;
  if (patch.role !== undefined) {
    if (!isAdminRole(patch.role)) return fail("invalid_role");
    role = patch.role;
  }
  const isActive = patch.isActive === undefined ? row.isActive : patch.isActive;

  if (await wouldRemoveLastOwner(row, { role, isActive })) {
    return fail("last_owner");
  }

  const updatedAt = new Date().toISOString();
  const sb = getDb();
  const { error } = await sb
    .from(TABLE)
    .update({ name, role, isActive, updatedAt })
    .eq("email", needle);
  checkErr(error, "updateAdminUser");
  return {
    ok: true,
    value: toPublic({ ...row, name, role, isActive, updatedAt }),
  };
}

export async function setAdminPassword(
  email: string,
  password: string,
): Promise<AdminUserResult<PublicAdminUser>> {
  const needle = normalizeAdminEmail(email);
  const row = await fetchRow(needle);
  if (!row) return fail("not_found");
  if (
    password.length < MIN_ADMIN_PASSWORD_LENGTH ||
    password.length > MAX_ADMIN_PASSWORD_LENGTH
  ) {
    return fail("weak_password");
  }
  const updatedAt = new Date().toISOString();
  const sb = getDb();
  const { error } = await sb
    .from(TABLE)
    .update({ passwordHash: await bcrypt.hash(password, 10), updatedAt })
    .eq("email", needle);
  checkErr(error, "setAdminPassword");
  return { ok: true, value: toPublic({ ...row, updatedAt }) };
}

export async function deleteAdminUser(
  email: string,
): Promise<AdminUserResult<PublicAdminUser>> {
  const needle = normalizeAdminEmail(email);
  const row = await fetchRow(needle);
  if (!row) return fail("not_found");
  if (await wouldRemoveLastOwner(row, "deleted")) return fail("last_owner");
  const sb = getDb();
  const { error } = await sb.from(TABLE).delete().eq("email", needle);
  checkErr(error, "deleteAdminUser");
  // Its "Şu an aktif" record goes with it. The account is gone either way:
  // a failure leaves one timestamp under an address nobody signs in with.
  try {
    await forgetAdminActivity(needle);
  } catch (err) {
    console.error("[admin/users] etkinlik kaydı silinemedi", err);
  }
  return { ok: true, value: toPublic(row) };
}

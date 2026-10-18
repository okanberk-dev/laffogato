import "server-only";

import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import type { DbError } from "@/lib/db";

import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";
import {
  newPaynkolayMemberKey,
  PAYNKOLAY_MEMBER_KEY,
} from "@/lib/payment/paynkolay";
import { updateSupabasePassword } from "@/lib/supabase/admin";
import { getSupabaseAnonClient } from "@/lib/supabase/anon";

import { appendConsentChanges, type ConsentSource } from "./consent-ledger";
import { grantWelcomeCoupon } from "./coupons";
import {
  deletionRequestOf,
  type DeletionRequest,
} from "./deletion-request-core";

export interface CustomerAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  district: string;
  city: string;
  zip: string;
  isDefault: boolean;
  /**
   * The mahalle as the app typed it, kept in its own key (S8-02). `line1`
   * still carries it folded in front ("Postane Mah., Atatürk Cad. …"), so
   * the site, the order text and the courier read one complete line; this
   * key is what lets the app read it back exactly. Absent on rows written
   * by the site or before the key existed - those keep the old split.
   */
  neighbourhood?: string;
}

export interface NotificationPrefs {
  orderUpdates: boolean;
  marketing: boolean;
  newsletter: boolean;
}

/**
 * The member's saved "usual" cafe order (docs/API-MOBILE.md §4). References a
 * `menu_items` row; the price is never stored here - it is resolved from the
 * database at order time like every other line.
 */
export interface CustomerUsual {
  menuItemId: string;
  size: "M" | "L" | "single";
  options: Record<string, unknown>;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone: string;
  passwordHash: string;
  birthday: string;
  addresses: CustomerAddress[];
  wishlist: string[];
  notificationPrefs: NotificationPrefs;
  /**
   * Supabase Auth user id this row is linked to; "" for a legacy web member
   * that has not signed in through the app yet. Identity only - orders and
   * money stay in this database (docs/API-MOBILE.md §0).
   */
  supabaseUserId: string;
  /**
   * ISO instant of the last attempt to link this row to a Supabase user, so a
   * failed link is not retried on every request. "" when never attempted.
   */
  supabaseLinkAttemptedAt: string;
  /**
   * ISO instant at which a password written HERE was confirmed written to
   * Supabase too; "" when the last such write did not reach it (no service
   * role, no linked identity, or the call failed).
   *
   * Non-empty means Supabase holds a password at least as new as this row's
   * hash. That is the only thing that makes a disagreement between the two
   * readable: it says the app moved, not us. Empty means we cannot tell, and
   * this row's own copy stays the authority.
   */
  passwordMirroredAt: string;
  /** Referral code the member shares ("LAF-EDA24"); "" until generated. */
  inviteCode: string;
  /** E-mail of the member whose invite this account claimed; "" if none. */
  invitedBy: string;
  /** Saved usual cafe order, or null. */
  usual: CustomerUsual | null;
  /** True once the customer clicked the e-mail verification link. */
  emailVerified: boolean;
  /** Single-use verification token (cleared after use). */
  verifyToken: string;
  /** ISO expiry for the verification token. */
  verifyExpires: string;
  verifiedAt: string;
  /**
   * Single-use password-reset token, cleared the moment it is spent.
   * Deliberately separate from `verifyToken`: sharing one would let a pending
   * verification link double as a password reset, and issuing a reset would
   * silently invalidate a verification the member had not finished.
   */
  resetToken: string;
  /** ISO expiry for the reset token. */
  resetExpires: string;
  /** False once an admin deactivates the account (blocks login + ordering). */
  isActive: boolean;
  /** ISO timestamp the member accepted the terms + privacy policy at signup. */
  termsAcceptedAt: string;
  /** ISO timestamp of explicit marketing opt-in (empty when not consented). */
  marketingConsentAt: string;
  /**
   * ISO instant of the member's open web deletion request (/uye/hesap/sil);
   * null when there is none. Read through `deletionRequestOf`. Not part of
   * `PublicCustomer`: the app neither sends nor reads it.
   */
  deletionRequestedAt?: string | null;
  /** The member's optional reason for that request; "" when none. */
  deletionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCustomer {
  id: string;
  email: string;
  name: string;
  phone: string;
  birthday: string;
  addresses: CustomerAddress[];
  wishlist: string[];
  notificationPrefs: NotificationPrefs;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  inviteCode: string;
  usual: CustomerUsual | null;
}

function defaultPrefs(): NotificationPrefs {
  return { orderUpdates: true, marketing: false, newsletter: false };
}

function withDefaults(c: Customer): Customer {
  return {
    ...c,
    birthday: c.birthday ?? "",
    addresses: c.addresses ?? [],
    wishlist: c.wishlist ?? [],
    notificationPrefs: c.notificationPrefs ?? defaultPrefs(),
    emailVerified: c.emailVerified ?? false,
    verifyToken: c.verifyToken ?? "",
    verifyExpires: c.verifyExpires ?? "",
    verifiedAt: c.verifiedAt ?? "",
    resetToken: c.resetToken ?? "",
    resetExpires: c.resetExpires ?? "",
    isActive: c.isActive ?? true,
    termsAcceptedAt: c.termsAcceptedAt ?? "",
    marketingConsentAt: c.marketingConsentAt ?? "",
    supabaseUserId: c.supabaseUserId ?? "",
    supabaseLinkAttemptedAt: c.supabaseLinkAttemptedAt ?? "",
    inviteCode: c.inviteCode ?? "",
    invitedBy: c.invitedBy ?? "",
    usual: normalizeUsual(c.usual),
  };
}

/**
 * The `usual` column is JSONB with a JSON-null default, so a row reads as
 * `null`, an object, or - from a hand edit - anything at all. Only a shape the
 * order path can resolve is kept; the rest reads as "no usual".
 */
function normalizeUsual(raw: unknown): CustomerUsual | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  const u = raw as Partial<CustomerUsual>;
  if (typeof u.menuItemId !== "string" || !u.menuItemId) return null;
  const size = u.size === "L" || u.size === "single" ? u.size : "M";
  const options =
    typeof u.options === "object" && u.options !== null
      ? (u.options as Record<string, unknown>)
      : {};
  return { menuItemId: u.menuItemId, size, options };
}

/**
 * What to write into `customers.usual`.
 *
 * The column is `jsonb not null default 'null'::jsonb` and the query builder
 * binds a JS `null` as SQL NULL, which the constraint rejects. A JSON-null is
 * therefore written as the text `"null"`, which Postgres parses into the
 * jsonb null the column expects; an object is bound as JSON text as usual.
 */
export function usualColumnValue(
  usual: CustomerUsual | null,
): CustomerUsual | string {
  return usual === null ? "null" : usual;
}

/**
 * The public view of a full `customers` row.
 *
 * Exported so a caller that already holds the row (the Supabase bridge, after
 * its own read) can narrow it instead of issuing a second identical
 * `select * from customers where email = $1` - one extra round-trip on a pool
 * of `max: 1`, on every bearer request the app makes.
 */
export function toPublicCustomer(c: Customer): PublicCustomer {
  const full = withDefaults(c);
  return {
    id: full.id,
    email: full.email,
    name: full.name,
    phone: full.phone,
    birthday: full.birthday,
    addresses: full.addresses,
    wishlist: full.wishlist,
    notificationPrefs: full.notificationPrefs,
    emailVerified: full.emailVerified,
    isActive: full.isActive,
    createdAt: full.createdAt,
    inviteCode: full.inviteCode,
    usual: full.usual,
  };
}

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 saat

function newVerifyToken(): { token: string; expires: string } {
  return {
    token: randomBytes(32).toString("hex"),
    expires: new Date(Date.now() + VERIFY_TTL_MS).toISOString(),
  };
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function checkErr(error: DbError | null, ctx: string): void {
  // An empty code means the request never reached Postgres, so it is classified
  // as unreachable rather than as a rejected query. See src/lib/db/health.ts.
  if (error) raiseDbError(ctx, error, error.code === "" ? 0 : 400);
}

/** Fetch a full customer row by (already-normalized) email, or null. */
async function fetchCustomer(email: string): Promise<Customer | null> {
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.customers)
    .select("*")
    .eq("email", email)
    .maybeSingle();
  checkErr(error, "fetchCustomer");
  return (data as Customer | null) ?? null;
}

export interface RegisterInput {
  email: string;
  name: string;
  phone: string;
  password: string;
  /** Required: terms of use + privacy policy acceptance (KVKK aydınlatma). */
  acceptedTerms: boolean;
  /** Optional explicit marketing opt-in. */
  marketing: boolean;
  /** Optional newsletter opt-in. */
  newsletter: boolean;
}

export type RegisterResult =
  | { ok: true; customer: PublicCustomer; verifyToken: string }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerCustomer(
  input: RegisterInput,
): Promise<RegisterResult> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim().slice(0, 100);
  const phone = input.phone.trim().slice(0, 30);
  const password = input.password;

  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Geçerli bir e-posta gir." };
  }
  if (name.length < 2) {
    return { ok: false, error: "Adın en az 2 karakter olmalı." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Şifre en az 8 karakter olmalı." };
  }
  if (password.length > 200) {
    return { ok: false, error: "Şifre çok uzun." };
  }
  if (!input.acceptedTerms) {
    return {
      ok: false,
      error:
        "Devam etmek için kullanım şartları ve gizlilik politikasını kabul etmelisin.",
    };
  }

  const existing = await fetchCustomer(email);
  if (existing) {
    return {
      ok: false,
      error: "Bu e-posta zaten kayıtlı. Giriş yapmayı denedin mi?",
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const { token, expires } = newVerifyToken();
  const customer: Customer = {
    id: `cst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email,
    name,
    phone,
    passwordHash,
    birthday: "",
    addresses: [],
    wishlist: [],
    notificationPrefs: {
      orderUpdates: true,
      marketing: !!input.marketing,
      newsletter: !!input.newsletter,
    },
    emailVerified: false,
    verifyToken: token,
    verifyExpires: expires,
    verifiedAt: "",
    resetToken: "",
    resetExpires: "",
    isActive: true,
    termsAcceptedAt: now,
    marketingConsentAt: input.marketing ? now : "",
    supabaseUserId: "",
    passwordMirroredAt: "",
    supabaseLinkAttemptedAt: "",
    inviteCode: "",
    invitedBy: "",
    usual: null,
    createdAt: now,
    updatedAt: now,
  };
  const sb = getDb();
  // `usual` is `jsonb not null default 'null'::jsonb`; the query builder binds
  // a JS null as SQL NULL, which that column rejects. Leaving the key off the
  // row takes the column default (JSON null) instead. Writers that clear it
  // later must go through `usualColumnValue()` for the same reason.
  const { usual: _usual, ...row } = customer;
  void _usual;
  const { error } = await sb.from(TABLES.customers).insert(row);
  if (error) {
    // Unique violation = race on email → treat as already registered.
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Bu e-posta zaten kayıtlı. Giriş yapmayı denedin mi?",
      };
    }
    throw new Error(`registerCustomer: ${error.message}`);
  }
  // The boxes ticked on the sign-up form, into the consent history.
  await appendConsentChanges(email, null, customer.notificationPrefs, {
    source: "site-signup",
    now: new Date(now),
  });
  return { ok: true, customer: toPublicCustomer(customer), verifyToken: token };
}

export type VerifyResult =
  { ok: true; email: string } | { ok: false; error: string };

/** Marks a customer verified given a valid, unexpired token (single-use). */
export async function verifyCustomerEmail(
  token: string,
): Promise<VerifyResult> {
  const clean = (token ?? "").trim();
  if (!clean || clean.length < 16)
    return { ok: false, error: "Geçersiz doğrulama bağlantısı." };
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.customers)
    .select("*")
    .eq("verifyToken", clean)
    .maybeSingle();
  checkErr(error, "verifyCustomerEmail");
  const customer = data as Customer | null;
  if (!customer)
    return { ok: false, error: "Bağlantı geçersiz ya da zaten kullanılmış." };
  if (customer.emailVerified) return { ok: true, email: customer.email };
  if (
    customer.verifyExpires &&
    new Date(customer.verifyExpires).getTime() < Date.now()
  ) {
    return {
      ok: false,
      error: "Doğrulama bağlantısının süresi dolmuş. Yeni bir bağlantı iste.",
    };
  }
  const { error: upErr } = await sb
    .from(TABLES.customers)
    .update({
      emailVerified: true,
      verifyToken: "",
      verifyExpires: "",
      verifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", customer.id);
  checkErr(upErr, "verifyCustomerEmail.update");
  // Reward a freshly-verified member with a one-time welcome coupon. Idempotent
  // and best-effort - a coupon hiccup must never block account verification.
  try {
    await grantWelcomeCoupon(customer.email);
  } catch (err) {
    console.error("[coupons] welcome grant failed", err);
  }
  await activatePendingNewsletter(customer.email);
  return { ok: true, email: customer.email };
}

/**
 * The address is proven now: a bulletin request the member made while it was
 * not (registration form, account toggle) becomes a subscription. Lazily
 * imported - the newsletter module reaches back into this one - and
 * best-effort, like the welcome coupon: it must never block verification.
 */
export async function activatePendingNewsletter(email: string): Promise<void> {
  try {
    const [{ confirmPendingNewsletterForEmail }, { clientIp }] =
      await Promise.all([
        import("@/lib/newsletter/store"),
        import("@/lib/admin/rate-limit"),
      ]);
    await confirmPendingNewsletterForEmail(email, await clientIp());
  } catch (err) {
    console.error("[newsletter] activating a pending request failed", err);
  }
}

export type ResendResult =
  | { ok: true; token: string; name: string; email: string }
  | { ok: false; error: string; alreadyVerified?: boolean };

/** Issues a fresh verification token for an unverified customer (resend). */
export async function createVerificationToken(
  email: string,
): Promise<ResendResult> {
  const needle = normalizeEmail(email);
  const customer = await fetchCustomer(needle);
  if (!customer) return { ok: false, error: "Kayıt bulunamadı." };
  if (customer.emailVerified) {
    return {
      ok: false,
      error: "E-posta zaten doğrulanmış.",
      alreadyVerified: true,
    };
  }
  const { token, expires } = newVerifyToken();
  const sb = getDb();
  const { error } = await sb
    .from(TABLES.customers)
    .update({
      verifyToken: token,
      verifyExpires: expires,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", customer.id);
  checkErr(error, "createVerificationToken");
  return { ok: true, token, name: customer.name, email: customer.email };
}

// ─── Password reset ───────────────────────────────────────────────────────

/** A reset link is short-lived on purpose: it is a bearer key to an account. */
const RESET_TTL_MS = 60 * 60 * 1000;

export interface ResetRequest {
  token: string;
  name: string;
  email: string;
}

/**
 * Issues a password-reset token, or nothing.
 *
 * Returns `null` for an address with no account AND for a deactivated one -
 * the caller shows the same message either way, so the form cannot be used to
 * find out who has an account here.
 *
 * Any previously issued token is replaced, so the newest link is the only one
 * that works.
 */
export async function createPasswordResetToken(
  email: string,
): Promise<ResetRequest | null> {
  const needle = normalizeEmail(email);
  if (!needle) return null;
  const customer = await fetchCustomer(needle);
  if (!customer || !customer.isActive) return null;

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + RESET_TTL_MS).toISOString();
  const sb = getDb();
  const { error } = await sb
    .from(TABLES.customers)
    .update({
      resetToken: token,
      resetExpires: expires,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", customer.id);
  checkErr(error, "createPasswordResetToken");
  return { token, name: customer.name, email: customer.email };
}

export type ResetResult =
  { ok: true; email: string } | { ok: false; error: string };

/**
 * Spends a reset token and sets the new password.
 *
 * The token is cleared in the same UPDATE that writes the hash, and the write
 * is conditioned on the token still being present, so a link cannot be used
 * twice - including by two requests racing each other.
 *
 * Resetting also marks the address verified: the member proved they can read
 * mail at it, which is exactly what the verification link tests.
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<ResetResult> {
  const clean = token.trim();
  if (!clean) return { ok: false, error: "Bağlantı geçersiz." };
  if (newPassword.length < 8) {
    return { ok: false, error: "Şifre en az 8 karakter olmalı." };
  }
  if (newPassword.length > 200) return { ok: false, error: "Şifre çok uzun." };

  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.customers)
    .select("*")
    .eq("resetToken", clean)
    .maybeSingle();
  checkErr(error, "resetPasswordWithToken.lookup");
  const customer = data as Customer | null;
  if (!customer) {
    return { ok: false, error: "Bağlantı geçersiz veya kullanılmış." };
  }
  if (!customer.isActive) {
    return { ok: false, error: "Bu hesap kapalı." };
  }
  if (
    !customer.resetExpires ||
    new Date(customer.resetExpires).getTime() < Date.now()
  ) {
    return {
      ok: false,
      error: "Bağlantının süresi dolmuş. Yeni bir sıfırlama isteyin.",
    };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const now = new Date().toISOString();
  const { data: written, error: writeErr } = await sb
    .from(TABLES.customers)
    .update({
      passwordHash,
      resetToken: "",
      resetExpires: "",
      // Reading mail at the address is what the verification link tests, and
      // this proves it.
      emailVerified: true,
      verifiedAt: customer.verifiedAt || now,
      verifyToken: "",
      verifyExpires: "",
      updatedAt: now,
    })
    .eq("id", customer.id)
    .eq("resetToken", clean)
    .select("id");
  checkErr(writeErr, "resetPasswordWithToken.write");
  if (((written as { id: string }[] | null) ?? []).length === 0) {
    return { ok: false, error: "Bağlantı geçersiz veya kullanılmış." };
  }
  // Site and app share one identity (docs/AUTH-BRIDGE.md). Writing only the
  // bcrypt hash would retire the old password HERE and leave it opening the
  // app - which is precisely the credential a reset exists to kill. Ordered
  // after the conditional write so a losing race never touches Supabase.
  await recordPasswordMirror(customer.id, customer.supabaseUserId, newPassword);
  return { ok: true, email: customer.email };
}

export interface LoginInput {
  email: string;
  password: string;
}

export type LoginResult =
  { ok: true; customer: PublicCustomer } | { ok: false; error: string };

export async function verifyCustomerLogin(
  input: LoginInput,
): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  if (!email || !input.password) {
    return { ok: false, error: "E-posta ve şifre gerekli." };
  }
  const customer = await fetchCustomer(email);
  if (!customer) {
    await bcrypt.compare(
      input.password,
      "$2a$10$invalidhashforuserenumprotection000000000000000000000",
    );
    return { ok: false, error: "E-posta veya şifre hatalı." };
  }
  const ok = await bcrypt.compare(input.password, customer.passwordHash);
  if (!ok) return { ok: false, error: "E-posta veya şifre hatalı." };
  if (withDefaults(customer).isActive === false) {
    return {
      ok: false,
      error: "Hesabın devre dışı bırakılmış. Lütfen bizimle iletişime geç.",
    };
  }
  return { ok: true, customer: toPublicCustomer(customer) };
}

/**
 * Whether the site's own (bcrypt) password agrees with what was just typed.
 *
 * `none` - the row has no site password (created through Supabase), so there
 * is nothing to disagree with. Used by the login bridge: a Supabase sign-in
 * is honoured only when the site password, if any, matches too - otherwise a
 * password changed on the site would keep working through Supabase.
 */
export async function checkSitePassword(
  email: string,
  password: string,
): Promise<"none" | "match" | "mismatch"> {
  const customer = await fetchCustomer(normalizeEmail(email));
  if (!customer || !customer.passwordHash) return "none";
  return (await bcrypt.compare(password, customer.passwordHash))
    ? "match"
    : "mismatch";
}

/**
 * Brings this site's password copy in line with one Supabase just accepted.
 *
 * The app can now reset a password on its own (`updatePassword` there, the
 * screen the recovery mail lands on), and it changes Supabase only. Without
 * this the member came back to the website and found the OPPOSITE of what a
 * reset is for: the new password refused, and the old one still working -
 * because the site kept its own bcrypt hash and treated it as the newer truth.
 *
 * Only ever called with a password Supabase has already authenticated, so it
 * grants nothing; it copies a decision already made. Rewriting the hash also
 * moves the session fingerprint, which is the point: every cookie issued
 * against the old password stops working, here as well as there.
 */
export async function adoptSupabasePassword(
  email: string,
  password: string,
): Promise<boolean> {
  const customer = await fetchCustomer(normalizeEmail(email));
  if (!customer || !customer.isActive) return false;
  const { error } = await getDb()
    .from(TABLES.customers)
    .update({
      passwordHash: await bcrypt.hash(password, 10),
      // The two copies now agree, and they agree ON SUPABASE'S value - which
      // is exactly the state the flag describes.
      passwordMirroredAt: new Date().toISOString(),
      // A reset elsewhere spends this site's outstanding link too: two live
      // ways to set a password is one more than anybody needs.
      resetToken: "",
      resetExpires: "",
      updatedAt: new Date().toISOString(),
    })
    .eq("id", customer.id);
  checkErr(error, "adoptSupabasePassword");
  return true;
}

export async function getCustomerByEmail(
  email: string,
): Promise<PublicCustomer | null> {
  const needle = normalizeEmail(email);
  if (!needle) return null;
  const doc = await fetchCustomer(needle);
  return doc ? toPublicCustomer(doc) : null;
}

/**
 * A short, non-reversible fingerprint of the account's current credentials.
 *
 * Session cookies carry it, so changing the password invalidates every cookie
 * already issued: a stolen session used to survive the very act taken to stop
 * it. Derived from the bcrypt hash, which already contains the salt, and
 * truncated - it only has to change when the hash does, never to be reversed.
 */
export async function getSessionFingerprint(
  email: string,
): Promise<string | null> {
  const needle = normalizeEmail(email);
  if (!needle) return null;
  const doc = await fetchCustomer(needle);
  if (!doc) return null;
  return fingerprintOf(doc.passwordHash);
}

export function fingerprintOf(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

export interface UpdateProfileInput {
  name: string;
  phone: string;
  birthday: string;
}

export async function updateCustomerProfile(
  email: string,
  input: UpdateProfileInput,
): Promise<PublicCustomer | null> {
  const needle = normalizeEmail(email);
  const sb = getDb();
  const update = {
    name: input.name.trim().slice(0, 100),
    phone: input.phone.trim().slice(0, 30),
    birthday: input.birthday.trim().slice(0, 10),
    updatedAt: new Date().toISOString(),
  };
  const { error } = await sb
    .from(TABLES.customers)
    .update(update)
    .eq("email", needle);
  checkErr(error, "updateCustomerProfile");
  const updated = await fetchCustomer(needle);
  return updated ? toPublicCustomer(updated) : null;
}

// ─── Password change ──────────────────────────────────────────────────────

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

export async function changeCustomerPassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const needle = normalizeEmail(email);
  if (newPassword.length < 8)
    return { ok: false, error: "Yeni şifre en az 8 karakter olmalı." };
  if (newPassword.length > 200) return { ok: false, error: "Şifre çok uzun." };

  const customer = await fetchCustomer(needle);
  if (!customer) return { ok: false, error: "Hesap bulunamadı." };
  // Where does this member's current password actually live?
  //
  // A member who signed up in the APP has no bcrypt hash here - the row is
  // created with `passwordHash: ""` (docs/AUTH-BRIDGE.md §3). Comparing
  // against an empty hash is always false, so this form told them "Mevcut
  // şifre hatalı" no matter what they typed, forever, and the app has no
  // change-password screen either: the only way out was to pretend they had
  // forgotten it.
  const ok = customer.passwordHash
    ? await bcrypt.compare(currentPassword, customer.passwordHash)
    : await supabaseAcceptsPassword(customer, currentPassword);
  if (!ok) return { ok: false, error: "Mevcut şifre hatalı." };
  if (currentPassword === newPassword) {
    return { ok: false, error: "Yeni şifre, eskisinden farklı olmalı." };
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const sb = getDb();
  const { error } = await sb
    .from(TABLES.customers)
    .update({ passwordHash, updatedAt: new Date().toISOString() })
    .eq("email", needle);
  checkErr(error, "changeCustomerPassword");
  // The same mirror the reset path does. Without it this write left Supabase
  // holding the OLD password while the row held the new one - and the login
  // bridge, seeing the two disagree, would take Supabase's word and adopt the
  // old password back over the one the member had just chosen.
  await recordPasswordMirror(customer.id, customer.supabaseUserId, newPassword);
  return { ok: true };
}

/**
 * Asks the identity provider whether this is the member's current password.
 *
 * Only reached for a row with no bcrypt hash of its own - one born in the app.
 * The stateless anon client is used deliberately: `createSupabaseServerClient`
 * would write session cookies as a side effect of a password CHECK, quietly
 * re-authenticating whoever's browser is making the request.
 *
 * An unlinked row cannot be checked this way and returns false, which is the
 * old behaviour: those members still have to use the reset link.
 */
async function supabaseAcceptsPassword(
  customer: Customer,
  password: string,
): Promise<boolean> {
  if (!customer.supabaseUserId || !password) return false;
  try {
    const { data, error } =
      await getSupabaseAnonClient().auth.signInWithPassword({
        email: customer.email,
        password,
      });
    return !error && data.user?.id === customer.supabaseUserId;
  } catch (err) {
    // PII rule: never the address.
    console.error(
      `[customer] supabase password check failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

/**
 * Writes a password to Supabase as well, and records on the row whether that
 * actually happened.
 *
 * The flag is the whole point. `updateSupabasePassword` answers "updated",
 * "skipped" (no service-role key, or no linked identity) or "failed", and to
 * a later sign-in those three are indistinguishable from each other unless
 * someone writes the answer down. `loginAction` reads it to decide which copy
 * of the password is allowed to be the newer one.
 */
async function recordPasswordMirror(
  customerId: string,
  supabaseUserId: string,
  newPassword: string,
): Promise<void> {
  const sync = await updateSupabasePassword(supabaseUserId, newPassword);
  const { error } = await getDb()
    .from(TABLES.customers)
    .update({
      passwordMirroredAt: sync === "updated" ? new Date().toISOString() : "",
      updatedAt: new Date().toISOString(),
    })
    .eq("id", customerId);
  // Never fatal: the password is already written, and a member who has just
  // set one must not be told it failed because a bookkeeping column did.
  if (error) {
    console.error(
      `[customer] password mirror flag not written: ${error.message}`,
    );
  }
}

/**
 * True when Supabase is known to hold a password at least as new as this
 * row's hash - i.e. the last password written here reached it.
 */
export async function supabaseHoldsLatestPassword(
  email: string,
): Promise<boolean> {
  const customer = await fetchCustomer(normalizeEmail(email));
  return Boolean(
    customer && customer.supabaseUserId && customer.passwordMirroredAt,
  );
}

// ─── Addresses ────────────────────────────────────────────────────────────

export interface AddressInput {
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  district: string;
  city: string;
  zip: string;
  isDefault: boolean;
  /** Only the app sends it; the site's forms leave it out. */
  neighbourhood?: string;
}

function normalizeAddress(input: AddressInput, id: string): CustomerAddress {
  return {
    id,
    label: input.label.trim().slice(0, 40),
    recipientName: input.recipientName.trim().slice(0, 100),
    phone: input.phone.trim().slice(0, 30),
    line1: input.line1.trim().slice(0, 200),
    line2: input.line2.trim().slice(0, 200),
    district: input.district.trim().slice(0, 80),
    city: input.city.trim().slice(0, 80),
    zip: input.zip.trim().slice(0, 12),
    isDefault: !!input.isDefault,
    // Written only when the caller sent it: a site edit (no key) drops a
    // stale one, so the next read splits the line the member just typed.
    ...(typeof input.neighbourhood === "string"
      ? { neighbourhood: input.neighbourhood.trim().slice(0, 80) }
      : {}),
  };
}

export type AddressResult =
  { ok: true; customer: PublicCustomer } | { ok: false; error: string };

function validateAddress(input: AddressInput): string | null {
  if (input.recipientName.trim().length < 2) return "Alıcı adı zorunlu.";
  if (input.phone.trim().length < 7) return "Geçerli bir telefon gir.";
  if (input.line1.trim().length < 5) return "Adres satırı zorunlu.";
  if (input.city.trim().length < 2) return "Şehir zorunlu.";
  return null;
}

/** Persist a new addresses array on a customer and return the public view. */
async function persistAddresses(
  email: string,
  addresses: CustomerAddress[],
  failMsg: string,
): Promise<AddressResult> {
  const sb = getDb();
  const { error } = await sb
    .from(TABLES.customers)
    .update({ addresses, updatedAt: new Date().toISOString() })
    .eq("email", email);
  checkErr(error, "persistAddresses");
  const updated = await fetchCustomer(email);
  return updated
    ? { ok: true, customer: toPublicCustomer(updated) }
    : { ok: false, error: failMsg };
}

export async function addCustomerAddress(
  email: string,
  input: AddressInput,
): Promise<AddressResult> {
  const err = validateAddress(input);
  if (err) return { ok: false, error: err };
  const needle = normalizeEmail(email);
  const customer = await fetchCustomer(needle);
  if (!customer) return { ok: false, error: "Hesap bulunamadı." };
  const existing = withDefaults(customer).addresses;
  if (existing.length >= 20)
    return { ok: false, error: "En fazla 20 adres kaydedebilirsin." };

  const id = `adr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const next = normalizeAddress(input, id);
  // First address is auto-default; or if marked default, demote others.
  const addresses =
    existing.length === 0 || next.isDefault
      ? existing
          .map((a) => ({ ...a, isDefault: false }))
          .concat({ ...next, isDefault: true })
      : existing.concat(next);

  return persistAddresses(needle, addresses, "Kaydedilemedi.");
}

export async function updateCustomerAddress(
  email: string,
  addressId: string,
  input: AddressInput,
): Promise<AddressResult> {
  const err = validateAddress(input);
  if (err) return { ok: false, error: err };
  const needle = normalizeEmail(email);
  const customer = await fetchCustomer(needle);
  if (!customer) return { ok: false, error: "Hesap bulunamadı." };
  const existing = withDefaults(customer).addresses;
  const idx = existing.findIndex((a) => a.id === addressId);
  if (idx === -1) return { ok: false, error: "Adres bulunamadı." };

  const next = normalizeAddress(input, addressId);
  let addresses: CustomerAddress[];
  if (next.isDefault) {
    addresses = existing.map((a) => ({ ...a, isDefault: false }));
    addresses[idx] = { ...next, isDefault: true };
  } else {
    addresses = [...existing];
    addresses[idx] = next;
    // Ensure at least one default exists
    if (!addresses.some((a) => a.isDefault))
      addresses[0] = { ...addresses[0], isDefault: true };
  }

  return persistAddresses(needle, addresses, "Güncellenemedi.");
}

export async function deleteCustomerAddress(
  email: string,
  addressId: string,
): Promise<AddressResult> {
  const needle = normalizeEmail(email);
  const customer = await fetchCustomer(needle);
  if (!customer) return { ok: false, error: "Hesap bulunamadı." };
  const existing = withDefaults(customer).addresses;
  const removed = existing.find((a) => a.id === addressId);
  if (!removed) return { ok: false, error: "Adres bulunamadı." };
  let addresses = existing.filter((a) => a.id !== addressId);
  if (removed.isDefault && addresses.length > 0) {
    addresses = addresses.map((a, i) => ({ ...a, isDefault: i === 0 }));
  }
  return persistAddresses(needle, addresses, "Silinemedi.");
}

export async function setCustomerDefaultAddress(
  email: string,
  addressId: string,
): Promise<AddressResult> {
  const needle = normalizeEmail(email);
  const customer = await fetchCustomer(needle);
  if (!customer) return { ok: false, error: "Hesap bulunamadı." };
  const existing = withDefaults(customer).addresses;
  if (!existing.some((a) => a.id === addressId))
    return { ok: false, error: "Adres bulunamadı." };
  const addresses = existing.map((a) => ({
    ...a,
    isDefault: a.id === addressId,
  }));
  return persistAddresses(needle, addresses, "Güncellenemedi.");
}

// ─── Saved cards ──────────────────────────────────────────────────────────

/**
 * The member's key for the cards PayNkolay stores for them (docs/PAYNKOLAY.md
 * §16): a random 11-character value this server generates, sent to the POS as
 * `csCustomerKey`. Not a card, not a national ID or phone number.
 *
 * Server-only on purpose. It is deliberately NOT part of `PublicCustomer` and
 * never reaches `/me`: the app has no use for it, and a value that only the
 * server needs is a value the client should never be handed. It does point at
 * stored cards, so it is treated as identifying data and cleared when the
 * account is closed (after the cards themselves are deleted at the POS).
 */
export async function getCardUserKey(email: string): Promise<string> {
  const row = await fetchCustomer(normalizeEmail(email));
  const key = (row as { cardUserKey?: unknown } | null)?.cardUserKey;
  return typeof key === "string" ? key : "";
}

/**
 * The member's card key, created on first use.
 *
 * Compare-and-set: the new key is written only while the column still holds
 * what was read, then the stored value is read back. Two checkouts opened at
 * once by the same member therefore end up with ONE key - with a plain write
 * the second would overwrite the first, and a card saved under the first key
 * would vanish from the member's list.
 */
export async function ensureCardUserKey(email: string): Promise<string> {
  const needle = normalizeEmail(email);
  if (!needle) return "";
  const current = await getCardUserKey(needle);
  if (PAYNKOLAY_MEMBER_KEY.test(current)) return current;
  const { error } = await getDb()
    .from(TABLES.customers)
    .update({
      cardUserKey: newPaynkolayMemberKey(),
      updatedAt: new Date().toISOString(),
    })
    .eq("email", needle)
    .eq("cardUserKey", current);
  checkErr(error, "ensureCardUserKey");
  const stored = await getCardUserKey(needle);
  return PAYNKOLAY_MEMBER_KEY.test(stored) ? stored : "";
}

/**
 * Remembers the key the provider handed back, if there is one to remember.
 *
 * Absent means the buyer did not ask to save a card, and absent must never
 * erase a key stored earlier - the member would silently lose the cards they
 * had saved. Writing the same key again is a no-op, so this is safe on every
 * settlement.
 */
export async function rememberCardUserKey(
  email: string,
  cardUserKey: string,
): Promise<void> {
  const key = cardUserKey.trim();
  const needle = normalizeEmail(email);
  if (!key || !needle) return;
  if ((await getCardUserKey(needle)) === key) return;
  const { error } = await getDb()
    .from(TABLES.customers)
    .update({ cardUserKey: key, updatedAt: new Date().toISOString() })
    .eq("email", needle);
  checkErr(error, "rememberCardUserKey");
}

// ─── Wishlist ─────────────────────────────────────────────────────────────

/**
 * Adds or drops one product in the member's wishlist.
 *
 * One statement in the database, not a read-modify-write here: the site and
 * the app edit the same list through this helper, and two surfaces toggling
 * at the same moment each used to write a whole array computed from the state
 * before the other's write - so one of the two toggles was silently lost. The
 * function also refuses an id that names no product, which is why the route
 * can trust whatever the app sends.
 */
export async function toggleWishlist(
  email: string,
  productId: string,
): Promise<{ ok: boolean; isFavorite?: boolean; error?: string }> {
  const needle = normalizeEmail(email);
  const id = productId.trim();
  if (!needle || !id) return { ok: false, error: "Hesap bulunamadı." };
  const { data, error } = await getDb().rpc("toggle_wishlist", {
    p_email: needle,
    p_product_id: id,
    p_now: new Date().toISOString(),
  });
  checkErr(error, "toggleWishlist");
  switch (data as string | null) {
    case "added":
      return { ok: true, isFavorite: true };
    case "removed":
      return { ok: true, isFavorite: false };
    case "not_found":
      return { ok: false, error: "Ürün bulunamadı." };
    case "full":
      return { ok: false, error: "Favori listen dolu (en fazla 200 ürün)." };
    default:
      return { ok: false, error: "Hesap bulunamadı." };
  }
}

// ─── Notification preferences ─────────────────────────────────────────────

export async function updateNotificationPrefs(
  email: string,
  prefs: NotificationPrefs,
  consent: { source: ConsentSource; ip?: string } = { source: "site-account" },
): Promise<PublicCustomer | null> {
  const needle = normalizeEmail(email);
  const sb = getDb();
  const sanitized: NotificationPrefs = {
    orderUpdates: !!prefs.orderUpdates,
    marketing: !!prefs.marketing,
    newsletter: !!prefs.newsletter,
  };
  // KVKK: record WHEN explicit marketing consent is active. Stamp on opt-in
  // (preserving the original grant time across toggles), clear on opt-out.
  const existing = await fetchCustomer(needle);
  const now = new Date().toISOString();
  const marketingConsentAt = sanitized.marketing
    ? existing?.marketingConsentAt || now
    : "";
  const { error } = await sb
    .from(TABLES.customers)
    .update({
      notificationPrefs: sanitized,
      marketingConsentAt,
      updatedAt: now,
    })
    .eq("email", needle);
  checkErr(error, "updateNotificationPrefs");
  if (existing) {
    await appendConsentChanges(needle, existing.notificationPrefs, sanitized, {
      source: consent.source,
      ip: consent.ip,
      now: new Date(now),
    });
  }
  const updated = await fetchCustomer(needle);
  return updated ? toPublicCustomer(updated) : null;
}

// ─── Admin management ───────────────────────────────────────────────────────
//
// Server-only views + mutations used by the admin panel to manage real member
// accounts (TABLES.customers). The password hash is never exposed; everything
// else (profile, addresses, wishlist, prefs, verification, active state) is.

export interface AdminCustomer {
  id: string;
  email: string;
  name: string;
  phone: string;
  birthday: string;
  addresses: CustomerAddress[];
  wishlist: string[];
  notificationPrefs: NotificationPrefs;
  emailVerified: boolean;
  verifiedAt: string;
  isActive: boolean;
  termsAcceptedAt: string;
  marketingConsentAt: string;
  /**
   * The open web deletion request, or null: the panel badges the member and
   * offers "Hesabı sil" first (operator, 18 Eki 2026).
   */
  deletionRequest: DeletionRequest | null;
  createdAt: string;
  updatedAt: string;
}

function toAdminCustomer(c: Customer): AdminCustomer {
  const full = withDefaults(c);
  return {
    id: full.id,
    email: full.email,
    name: full.name,
    phone: full.phone,
    birthday: full.birthday,
    addresses: full.addresses,
    wishlist: full.wishlist,
    notificationPrefs: full.notificationPrefs,
    emailVerified: full.emailVerified,
    verifiedAt: full.verifiedAt,
    isActive: full.isActive,
    termsAcceptedAt: full.termsAcceptedAt,
    marketingConsentAt: full.marketingConsentAt,
    deletionRequest: deletionRequestOf(full),
    createdAt: full.createdAt,
    updatedAt: full.updatedAt,
  };
}

/** All member accounts, newest first. */
export async function listAllCustomers(): Promise<AdminCustomer[]> {
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.customers)
    .select("*")
    .order("createdAt", { ascending: false });
  checkErr(error, "listAllCustomers");
  return ((data as Customer[] | null) ?? []).map(toAdminCustomer);
}

/** A single member account for the admin detail view, or null. */
export async function getAdminCustomerByEmail(
  email: string,
): Promise<AdminCustomer | null> {
  const needle = normalizeEmail(email);
  if (!needle) return null;
  const doc = await fetchCustomer(needle);
  return doc ? toAdminCustomer(doc) : null;
}

/** The commercial purposes only the member can switch on. */
export type CommercialPurpose = "marketing" | "newsletter";

export interface AdminCustomerUpdateInput {
  name: string;
  phone: string;
  birthday: string;
  notificationPrefs: NotificationPrefs;
  /**
   * How the form drew each commercial switch. One drawn off is disabled
   * and never posted, so its absence says nothing about the operator.
   */
  shownPrefs?: Partial<Record<CommercialPurpose, boolean>>;
}

export type AdminCustomerUpdateResult =
  | { ok: true; customer: AdminCustomer }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "consent_grant"; purposes: CommercialPurpose[] };

/**
 * Admin edit of a member's profile (e-mail + password are NOT editable here).
 *
 * Commercial consent (6563) goes one way from the panel: off. Switching
 * `marketing` or `newsletter` on is refused (`consent_grant`), here and not
 * only in the form, because the action is a POST anyone in the panel can
 * send. It used to write the switch as asked and keep `marketingConsentAt`
 * through an opt-out, so panel OFF then ON put a member who had withdrawn
 * back into the campaign and birthday audiences under the old date, and
 * the ledger recorded an admin "grant" stamped with the consent text.
 * Turning marketing off clears the date, as the member's own opt-out does
 * (`updateNotificationPrefs`); a refusal also catches a stale form open
 * while the member opted out. The other stale form, drawn with a switch
 * off while the member opted in, keeps the member's switch: posted as off,
 * it used to wipe the date and log a panel withdrawal nobody made.
 */
export async function adminUpdateCustomer(
  email: string,
  input: AdminCustomerUpdateInput,
): Promise<AdminCustomerUpdateResult> {
  const needle = normalizeEmail(email);
  const sb = getDb();
  const before = await fetchCustomer(needle);
  if (!before) return { ok: false, error: "not_found" };
  const was = withDefaults(before).notificationPrefs;
  const asked: NotificationPrefs = {
    orderUpdates: !!input.notificationPrefs.orderUpdates,
    marketing: !!input.notificationPrefs.marketing,
    newsletter: !!input.notificationPrefs.newsletter,
  };
  const granted = (["marketing", "newsletter"] as const).filter(
    (purpose) => asked[purpose] && !was[purpose],
  );
  if (granted.length > 0) {
    return { ok: false, error: "consent_grant", purposes: granted };
  }
  // A switch the form drew off was not the operator's to untick: it keeps
  // what the row has now.
  const kept = (purpose: CommercialPurpose) =>
    input.shownPrefs?.[purpose] === false ? was[purpose] : asked[purpose];
  const prefs: NotificationPrefs = {
    orderUpdates: asked.orderUpdates,
    marketing: kept("marketing"),
    newsletter: kept("newsletter"),
  };
  const update = {
    name: input.name.trim().slice(0, 100),
    phone: input.phone.trim().slice(0, 30),
    birthday: input.birthday.trim().slice(0, 10),
    notificationPrefs: prefs,
    // Only ever cleared from here; a consent that stays on keeps its date.
    ...(prefs.marketing ? {} : { marketingConsentAt: "" }),
    updatedAt: new Date().toISOString(),
  };
  const { error } = await sb
    .from(TABLES.customers)
    .update(update)
    .eq("email", needle);
  checkErr(error, "adminUpdateCustomer");
  // Recorded as the panel's act, not the member's: no IP, source "admin".
  // The admin's identity is in the audit log the action writes. Only
  // withdrawals can reach here.
  await appendConsentChanges(needle, was, prefs, { source: "admin", ip: "" });
  const customer = await getAdminCustomerByEmail(needle);
  return customer ? { ok: true, customer } : { ok: false, error: "not_found" };
}

/** Toggle a member account active/inactive. */
export async function setCustomerActive(
  email: string,
  isActive: boolean,
): Promise<AdminCustomer | null> {
  const needle = normalizeEmail(email);
  const sb = getDb();
  const { error } = await sb
    .from(TABLES.customers)
    .update({ isActive: !!isActive, updatedAt: new Date().toISOString() })
    .eq("email", needle);
  checkErr(error, "setCustomerActive");
  return getAdminCustomerByEmail(needle);
}

// There is deliberately no "delete the customers row" helper. The panel's
// "Hesabı sil" used one, and it left the member's future karaoke held, the
// barista grant alive and every other record on the live address; an account
// is closed through `deleteMe` (lib/mobile/me.ts), from the app, the site
// and the panel alike.

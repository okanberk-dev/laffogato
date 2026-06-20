import "server-only";

import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import type { PostgrestError } from "@supabase/supabase-js";

import { getSupabaseAdmin, TABLES } from "@/lib/supabase/server";

import { grantWelcomeCoupon } from "./coupons";

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
}

export interface NotificationPrefs {
  orderUpdates: boolean;
  marketing: boolean;
  newsletter: boolean;
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
  /** True once the customer clicked the e-mail verification link. */
  emailVerified: boolean;
  /** Single-use verification token (cleared after use). */
  verifyToken: string;
  /** ISO expiry for the verification token. */
  verifyExpires: string;
  verifiedAt: string;
  /** False once an admin deactivates the account (blocks login + ordering). */
  isActive: boolean;
  /** ISO timestamp the member accepted the terms + privacy policy at signup. */
  termsAcceptedAt: string;
  /** ISO timestamp of explicit marketing opt-in (empty when not consented). */
  marketingConsentAt: string;
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
    isActive: c.isActive ?? true,
    termsAcceptedAt: c.termsAcceptedAt ?? "",
    marketingConsentAt: c.marketingConsentAt ?? "",
  };
}

function toPublic(c: Customer): PublicCustomer {
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

function checkErr(error: PostgrestError | null, ctx: string): void {
  if (error) throw new Error(`${ctx}: ${error.message}`);
}

/** Fetch a full customer row by (already-normalized) email, or null. */
async function fetchCustomer(email: string): Promise<Customer | null> {
  const sb = getSupabaseAdmin();
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
    isActive: true,
    termsAcceptedAt: now,
    marketingConsentAt: input.marketing ? now : "",
    createdAt: now,
    updatedAt: now,
  };
  const sb = getSupabaseAdmin();
  const { error } = await sb.from(TABLES.customers).insert(customer);
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
  return { ok: true, customer: toPublic(customer), verifyToken: token };
}

export type VerifyResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

/** Marks a customer verified given a valid, unexpired token (single-use). */
export async function verifyCustomerEmail(
  token: string,
): Promise<VerifyResult> {
  const clean = (token ?? "").trim();
  if (!clean || clean.length < 16)
    return { ok: false, error: "Geçersiz doğrulama bağlantısı." };
  const sb = getSupabaseAdmin();
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
  // and best-effort — a coupon hiccup must never block account verification.
  try {
    await grantWelcomeCoupon(customer.email);
  } catch (err) {
    console.error("[coupons] welcome grant failed", err);
  }
  return { ok: true, email: customer.email };
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
  const sb = getSupabaseAdmin();
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

export interface LoginInput {
  email: string;
  password: string;
}

export type LoginResult =
  | { ok: true; customer: PublicCustomer }
  | { ok: false; error: string };

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
  return { ok: true, customer: toPublic(customer) };
}

export async function getCustomerByEmail(
  email: string,
): Promise<PublicCustomer | null> {
  const needle = normalizeEmail(email);
  if (!needle) return null;
  const doc = await fetchCustomer(needle);
  return doc ? toPublic(doc) : null;
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
  const sb = getSupabaseAdmin();
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
  return updated ? toPublic(updated) : null;
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
  const ok = await bcrypt.compare(currentPassword, customer.passwordHash);
  if (!ok) return { ok: false, error: "Mevcut şifre hatalı." };
  if (currentPassword === newPassword) {
    return { ok: false, error: "Yeni şifre, eskisinden farklı olmalı." };
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from(TABLES.customers)
    .update({ passwordHash, updatedAt: new Date().toISOString() })
    .eq("email", needle);
  checkErr(error, "changeCustomerPassword");
  return { ok: true };
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
  };
}

export type AddressResult =
  | { ok: true; customer: PublicCustomer }
  | { ok: false; error: string };

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
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from(TABLES.customers)
    .update({ addresses, updatedAt: new Date().toISOString() })
    .eq("email", email);
  checkErr(error, "persistAddresses");
  const updated = await fetchCustomer(email);
  return updated
    ? { ok: true, customer: toPublic(updated) }
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

// ─── Wishlist ─────────────────────────────────────────────────────────────

export async function toggleWishlist(
  email: string,
  productId: string,
): Promise<{ ok: boolean; isFavorite?: boolean; error?: string }> {
  const needle = normalizeEmail(email);
  const customer = await fetchCustomer(needle);
  if (!customer) return { ok: false, error: "Hesap bulunamadı." };
  const current = withDefaults(customer).wishlist;
  const isFavorite = current.includes(productId);
  const wishlist = isFavorite
    ? current.filter((id) => id !== productId)
    : current.concat(productId).slice(0, 200);
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from(TABLES.customers)
    .update({ wishlist, updatedAt: new Date().toISOString() })
    .eq("email", needle);
  checkErr(error, "toggleWishlist");
  return { ok: true, isFavorite: !isFavorite };
}

// ─── Notification preferences ─────────────────────────────────────────────

export async function updateNotificationPrefs(
  email: string,
  prefs: NotificationPrefs,
): Promise<PublicCustomer | null> {
  const needle = normalizeEmail(email);
  const sb = getSupabaseAdmin();
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
  const updated = await fetchCustomer(needle);
  return updated ? toPublic(updated) : null;
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
    createdAt: full.createdAt,
    updatedAt: full.updatedAt,
  };
}

/** All member accounts, newest first. */
export async function listAllCustomers(): Promise<AdminCustomer[]> {
  const sb = getSupabaseAdmin();
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

export interface AdminCustomerUpdateInput {
  name: string;
  phone: string;
  birthday: string;
  notificationPrefs: NotificationPrefs;
}

/** Admin edit of a member's profile (e-mail + password are NOT editable here). */
export async function adminUpdateCustomer(
  email: string,
  input: AdminCustomerUpdateInput,
): Promise<AdminCustomer | null> {
  const needle = normalizeEmail(email);
  const sb = getSupabaseAdmin();
  const update = {
    name: input.name.trim().slice(0, 100),
    phone: input.phone.trim().slice(0, 30),
    birthday: input.birthday.trim().slice(0, 10),
    notificationPrefs: {
      orderUpdates: !!input.notificationPrefs.orderUpdates,
      marketing: !!input.notificationPrefs.marketing,
      newsletter: !!input.notificationPrefs.newsletter,
    },
    updatedAt: new Date().toISOString(),
  };
  const { error } = await sb
    .from(TABLES.customers)
    .update(update)
    .eq("email", needle);
  checkErr(error, "adminUpdateCustomer");
  return getAdminCustomerByEmail(needle);
}

/** Toggle a member account active/inactive. */
export async function setCustomerActive(
  email: string,
  isActive: boolean,
): Promise<AdminCustomer | null> {
  const needle = normalizeEmail(email);
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from(TABLES.customers)
    .update({ isActive: !!isActive, updatedAt: new Date().toISOString() })
    .eq("email", needle);
  checkErr(error, "setCustomerActive");
  return getAdminCustomerByEmail(needle);
}

/** Permanently delete a member account. Returns true when a row was removed. */
export async function adminDeleteCustomer(email: string): Promise<boolean> {
  const needle = normalizeEmail(email);
  if (!needle) return false;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from(TABLES.customers)
    .delete()
    .eq("email", needle)
    .select("id");
  checkErr(error, "adminDeleteCustomer");
  return ((data as { id: string }[] | null) ?? []).length > 0;
}

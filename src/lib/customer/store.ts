import "server-only";

import bcrypt from "bcryptjs";

import { COLLECTIONS } from "@/lib/mongodb/collections";
import { getDb } from "@/lib/mongodb/client";

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
    createdAt: full.createdAt,
  };
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export interface RegisterInput {
  email: string;
  name: string;
  phone: string;
  password: string;
}

export type RegisterResult =
  | { ok: true; customer: PublicCustomer }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerCustomer(input: RegisterInput): Promise<RegisterResult> {
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

  const db = await getDb();
  const existing = await db.collection<Customer>(COLLECTIONS.customers).findOne({ email });
  if (existing) {
    return { ok: false, error: "Bu e-posta zaten kayıtlı. Giriş yapmayı denedin mi?" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const customer: Customer = {
    id: `cst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email,
    name,
    phone,
    passwordHash,
    birthday: "",
    addresses: [],
    wishlist: [],
    notificationPrefs: defaultPrefs(),
    createdAt: now,
    updatedAt: now,
  };
  await db.collection<Customer>(COLLECTIONS.customers).insertOne(customer);
  return { ok: true, customer: toPublic(customer) };
}

export interface LoginInput {
  email: string;
  password: string;
}

export type LoginResult =
  | { ok: true; customer: PublicCustomer }
  | { ok: false; error: string };

export async function verifyCustomerLogin(input: LoginInput): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  if (!email || !input.password) {
    return { ok: false, error: "E-posta ve şifre gerekli." };
  }
  const db = await getDb();
  const customer = await db.collection<Customer>(COLLECTIONS.customers).findOne({ email });
  if (!customer) {
    await bcrypt.compare(input.password, "$2a$10$invalidhashforuserenumprotection000000000000000000000");
    return { ok: false, error: "E-posta veya şifre hatalı." };
  }
  const ok = await bcrypt.compare(input.password, customer.passwordHash);
  if (!ok) return { ok: false, error: "E-posta veya şifre hatalı." };
  return { ok: true, customer: toPublic(customer) };
}

export async function getCustomerByEmail(email: string): Promise<PublicCustomer | null> {
  const needle = normalizeEmail(email);
  if (!needle) return null;
  const db = await getDb();
  const doc = await db.collection<Customer>(COLLECTIONS.customers).findOne({ email: needle });
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
  const db = await getDb();
  const update: Partial<Customer> = {
    name: input.name.trim().slice(0, 100),
    phone: input.phone.trim().slice(0, 30),
    birthday: input.birthday.trim().slice(0, 10),
    updatedAt: new Date().toISOString(),
  };
  const res = await db
    .collection<Customer>(COLLECTIONS.customers)
    .findOneAndUpdate({ email: needle }, { $set: update }, { returnDocument: "after" });
  const doc = res as unknown as Customer | { value: Customer } | null;
  if (!doc) return null;
  if (typeof (doc as { value?: unknown }).value !== "undefined") {
    const v = (doc as { value: Customer | null }).value;
    return v ? toPublic(v) : null;
  }
  return toPublic(doc as Customer);
}

// ─── Password change ──────────────────────────────────────────────────────

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

export async function changeCustomerPassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const needle = normalizeEmail(email);
  if (newPassword.length < 8) return { ok: false, error: "Yeni şifre en az 8 karakter olmalı." };
  if (newPassword.length > 200) return { ok: false, error: "Şifre çok uzun." };

  const db = await getDb();
  const customer = await db.collection<Customer>(COLLECTIONS.customers).findOne({ email: needle });
  if (!customer) return { ok: false, error: "Hesap bulunamadı." };
  const ok = await bcrypt.compare(currentPassword, customer.passwordHash);
  if (!ok) return { ok: false, error: "Mevcut şifre hatalı." };
  if (currentPassword === newPassword) {
    return { ok: false, error: "Yeni şifre, eskisinden farklı olmalı." };
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.collection<Customer>(COLLECTIONS.customers).updateOne(
    { email: needle },
    { $set: { passwordHash, updatedAt: new Date().toISOString() } },
  );
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

export async function addCustomerAddress(
  email: string,
  input: AddressInput,
): Promise<AddressResult> {
  const err = validateAddress(input);
  if (err) return { ok: false, error: err };
  const needle = normalizeEmail(email);
  const db = await getDb();
  const customer = await db.collection<Customer>(COLLECTIONS.customers).findOne({ email: needle });
  if (!customer) return { ok: false, error: "Hesap bulunamadı." };
  const existing = withDefaults(customer).addresses;
  if (existing.length >= 20) return { ok: false, error: "En fazla 20 adres kaydedebilirsin." };

  const id = `adr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const next = normalizeAddress(input, id);
  // First address is auto-default; or if marked default, demote others.
  const addresses =
    existing.length === 0 || next.isDefault
      ? existing.map((a) => ({ ...a, isDefault: false })).concat({ ...next, isDefault: true })
      : existing.concat(next);

  await db.collection<Customer>(COLLECTIONS.customers).updateOne(
    { email: needle },
    { $set: { addresses, updatedAt: new Date().toISOString() } },
  );
  const updated = await db.collection<Customer>(COLLECTIONS.customers).findOne({ email: needle });
  return updated ? { ok: true, customer: toPublic(updated) } : { ok: false, error: "Kaydedilemedi." };
}

export async function updateCustomerAddress(
  email: string,
  addressId: string,
  input: AddressInput,
): Promise<AddressResult> {
  const err = validateAddress(input);
  if (err) return { ok: false, error: err };
  const needle = normalizeEmail(email);
  const db = await getDb();
  const customer = await db.collection<Customer>(COLLECTIONS.customers).findOne({ email: needle });
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
    if (!addresses.some((a) => a.isDefault)) addresses[0] = { ...addresses[0], isDefault: true };
  }

  await db.collection<Customer>(COLLECTIONS.customers).updateOne(
    { email: needle },
    { $set: { addresses, updatedAt: new Date().toISOString() } },
  );
  const updated = await db.collection<Customer>(COLLECTIONS.customers).findOne({ email: needle });
  return updated ? { ok: true, customer: toPublic(updated) } : { ok: false, error: "Güncellenemedi." };
}

export async function deleteCustomerAddress(
  email: string,
  addressId: string,
): Promise<AddressResult> {
  const needle = normalizeEmail(email);
  const db = await getDb();
  const customer = await db.collection<Customer>(COLLECTIONS.customers).findOne({ email: needle });
  if (!customer) return { ok: false, error: "Hesap bulunamadı." };
  const existing = withDefaults(customer).addresses;
  const removed = existing.find((a) => a.id === addressId);
  if (!removed) return { ok: false, error: "Adres bulunamadı." };
  let addresses = existing.filter((a) => a.id !== addressId);
  if (removed.isDefault && addresses.length > 0) {
    addresses = addresses.map((a, i) => ({ ...a, isDefault: i === 0 }));
  }
  await db.collection<Customer>(COLLECTIONS.customers).updateOne(
    { email: needle },
    { $set: { addresses, updatedAt: new Date().toISOString() } },
  );
  const updated = await db.collection<Customer>(COLLECTIONS.customers).findOne({ email: needle });
  return updated ? { ok: true, customer: toPublic(updated) } : { ok: false, error: "Silinemedi." };
}

export async function setCustomerDefaultAddress(
  email: string,
  addressId: string,
): Promise<AddressResult> {
  const needle = normalizeEmail(email);
  const db = await getDb();
  const customer = await db.collection<Customer>(COLLECTIONS.customers).findOne({ email: needle });
  if (!customer) return { ok: false, error: "Hesap bulunamadı." };
  const existing = withDefaults(customer).addresses;
  if (!existing.some((a) => a.id === addressId)) return { ok: false, error: "Adres bulunamadı." };
  const addresses = existing.map((a) => ({ ...a, isDefault: a.id === addressId }));
  await db.collection<Customer>(COLLECTIONS.customers).updateOne(
    { email: needle },
    { $set: { addresses, updatedAt: new Date().toISOString() } },
  );
  const updated = await db.collection<Customer>(COLLECTIONS.customers).findOne({ email: needle });
  return updated ? { ok: true, customer: toPublic(updated) } : { ok: false, error: "Güncellenemedi." };
}

// ─── Wishlist ─────────────────────────────────────────────────────────────

export async function toggleWishlist(
  email: string,
  productId: string,
): Promise<{ ok: boolean; isFavorite?: boolean; error?: string }> {
  const needle = normalizeEmail(email);
  const db = await getDb();
  const customer = await db.collection<Customer>(COLLECTIONS.customers).findOne({ email: needle });
  if (!customer) return { ok: false, error: "Hesap bulunamadı." };
  const current = withDefaults(customer).wishlist;
  const isFavorite = current.includes(productId);
  const wishlist = isFavorite
    ? current.filter((id) => id !== productId)
    : current.concat(productId).slice(0, 200);
  await db.collection<Customer>(COLLECTIONS.customers).updateOne(
    { email: needle },
    { $set: { wishlist, updatedAt: new Date().toISOString() } },
  );
  return { ok: true, isFavorite: !isFavorite };
}

// ─── Notification preferences ─────────────────────────────────────────────

export async function updateNotificationPrefs(
  email: string,
  prefs: NotificationPrefs,
): Promise<PublicCustomer | null> {
  const needle = normalizeEmail(email);
  const db = await getDb();
  const sanitized: NotificationPrefs = {
    orderUpdates: !!prefs.orderUpdates,
    marketing: !!prefs.marketing,
    newsletter: !!prefs.newsletter,
  };
  await db.collection<Customer>(COLLECTIONS.customers).updateOne(
    { email: needle },
    { $set: { notificationPrefs: sanitized, updatedAt: new Date().toISOString() } },
  );
  const updated = await db.collection<Customer>(COLLECTIONS.customers).findOne({ email: needle });
  return updated ? toPublic(updated) : null;
}

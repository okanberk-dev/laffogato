import "server-only";

import bcrypt from "bcryptjs";

import { COLLECTIONS } from "@/lib/mongodb/collections";
import { getDb } from "@/lib/mongodb/client";

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCustomer {
  id: string;
  email: string;
  name: string;
  phone: string;
}

function toPublic(c: Customer): PublicCustomer {
  return { id: c.id, email: c.email, name: c.name, phone: c.phone };
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
    // Aynı timing'i sağlamak için yine hash karşılaştırması yap.
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
    updatedAt: new Date().toISOString(),
  };
  const res = await db
    .collection<Customer>(COLLECTIONS.customers)
    .findOneAndUpdate({ email: needle }, { $set: update }, { returnDocument: "after" });
  const doc = (res as unknown as Customer | { value: Customer } | null);
  if (!doc) return null;
  if (typeof (doc as { value?: unknown }).value !== "undefined") {
    const v = (doc as { value: Customer | null }).value;
    return v ? toPublic(v) : null;
  }
  return toPublic(doc as Customer);
}

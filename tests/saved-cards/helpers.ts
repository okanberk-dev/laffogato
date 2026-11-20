import { createHmac } from "node:crypto";
import { createRequire } from "node:module";

import pg from "pg";

/**
 * Shared pieces of the saved-card tests. They write rows, close accounts and
 * talk to "PayNkolay": every one of them refuses to run unless the database
 * is on this machine and PayNkolay is the local mock
 * (tests/saved-cards/mock-paynkolay.mjs).
 */

export const APP = process.env.TEST_APP_URL ?? "http://localhost:3124";
export const MOCK = process.env.TEST_MOCK_URL ?? "http://127.0.0.1:4010";

function assertLocal(): void {
  const db = new URL(process.env.DATABASE_URL ?? "postgres://invalid");
  if (!["127.0.0.1", "localhost", "::1"].includes(db.hostname)) {
    throw new Error(
      `saved-card tests refuse a non-local DATABASE_URL (${db.hostname})`,
    );
  }
  if (process.env.PAYNKOLAY_BASE_URL !== MOCK) {
    throw new Error("saved-card tests need PAYNKOLAY_BASE_URL = the mock");
  }
}
assertLocal();

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const r = await pool.query(text, params);
  return r.rows as T[];
}

/** One card as PayNkolay's list returns it. */
export interface MockCard {
  Token: string;
  TranId: string;
  Maskedpan: string;
  CARDISSUER: string;
  CARDTYPE: string;
  CARDBRAND: string;
  CARD_ALIACE: string;
  EXP_DATE: string;
}

export interface MockRequest {
  path: string;
  fields: Record<string, string>;
}

export interface MockState {
  cards: Record<string, MockCard[]>;
  requests: MockRequest[];
  down: boolean;
}

export async function mock<T = MockState>(
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(
    MOCK + path,
    body === undefined
      ? {}
      : { method: "POST", body: JSON.stringify(body) },
  );
  return (await res.json()) as T;
}

export const mockState = () => mock<MockState>("/__state");
export const mockReset = () => mock("/__reset");
export const mockDown = (down: boolean) => mock(`/__down?v=${down ? 1 : 0}`);
export const mockSeed = (member: string, cards: MockCard[]) =>
  mock("/__seed", { member, cards });

/** The /Vpos/v1/Payment requests the mock received, oldest first. */
export async function mockPayments(): Promise<Record<string, string>[]> {
  const st = await mockState();
  return st.requests
    .filter((r) => r.path === "/Vpos/v1/Payment")
    .map((r) => r.fields);
}

let n = 0;
function uniqueEmail(tag: string): string {
  n += 1;
  // Lower case: the site normalises every address it looks up.
  return `${tag}-${Date.now()}-${n}@laffogato.test`.toLowerCase();
}

export async function newCustomer(
  tag: string,
  opts: { withAddress?: boolean } = {},
): Promise<{ id: string; email: string }> {
  const email = uniqueEmail(tag);
  const id = `cus-test-${email.split("@")[0]}`;
  const addresses = opts.withAddress
    ? [
        {
          id: "adr1",
          label: "Ev",
          recipientName: "Test Uye",
          phone: "5551234567",
          line1: "Postane Mah. Atatürk Cad. No 1",
          line2: "",
          district: "Tuzla",
          city: "İstanbul",
          zip: "34940",
          isDefault: true,
        },
      ]
    : [];
  await sql(
    `insert into public.customers
       (id, email, name, phone, "emailVerified", "isActive", addresses, "createdAt", "updatedAt")
     values ($1, $2, 'Test Uye', '5551234567', true, true, $3::jsonb, now()::text, now()::text)`,
    [id, email, JSON.stringify(addresses)],
  );
  return { id, email };
}

/** An order waiting for its payment, as the checkout leaves it. */
export async function newOrder(email: string, totalMinor = 12550) {
  const id = `ord-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const no = 50000 + Math.floor(Math.random() * 40000);
  await sql(
    `insert into public.orders (id, "orderNo", status, "totalMinor", "customerEmail", "createdAt")
     values ($1, $2, 'pending_payment', $3, $4, now()::text)`,
    [id, no, totalMinor, email],
  );
  return id;
}

/** A product the checkout can sell (250 TL, in stock). */
export async function ensureTestProduct(): Promise<string> {
  await sql(
    `insert into public.products (id, slug, name, "priceMinor", stock, "isActive", cat, "updatedAt")
     values ('prd-test-cards', 'test-kahve-kart', 'Test Kahve', 25000, 1000, true, 'beans', now()::text)
     on conflict (id) do update set stock = 1000, "isActive" = true`,
  );
  return "prd-test-cards";
}

/** The site's own customer cookie (`email|exp|sig`, no fingerprint). */
export function customerCookie(email: string): string {
  const exp = Date.now() + 3600_000;
  const payload = `${email}|${exp}`;
  const sig = createHmac("sha256", process.env.CUSTOMER_SESSION_SECRET ?? "")
    .update(payload)
    .digest("hex");
  return `${payload}|${sig}`;
}

/** A Luhn-valid test number starting with `prefix`. */
export function luhnCard(prefix: string, length = 16): string {
  let body = prefix;
  while (body.length < length - 1) body += String(Math.floor(Math.random() * 10));
  for (let d = 0; d <= 9; d++) {
    const s = body + d;
    let sum = 0;
    let dbl = false;
    for (let i = s.length - 1; i >= 0; i--) {
      let x = Number(s[i]);
      if (dbl) {
        x *= 2;
        if (x > 9) x -= 9;
      }
      sum += x;
      dbl = !dbl;
    }
    if (sum % 10 === 0) return s;
  }
  throw new Error("no Luhn digit");
}

/** A saved card for the mock's list; its last four are `1000 + i`. */
export function seedCard(i: number, alias = ""): MockCard {
  const r = Math.random().toString(36).slice(2, 8);
  return {
    Token: `seed-tok-${i}-${r}`,
    TranId: `seed-tr-${i}-${r}`,
    Maskedpan: `5528790${i}****${String(1000 + i).slice(-4)}`,
    CARDISSUER: "Seed Bank",
    CARDTYPE: "CREDIT",
    CARDBRAND: "MASTERCARD",
    CARD_ALIACE: alias,
    EXP_DATE: "1230",
  };
}

// ── Playwright, without a dependency ─────────────────────────────────────
// Playwright is not in package.json: the cloud sessions have it installed
// globally; elsewhere install it globally (`npm i -g playwright`, then
// `npx playwright install chromium`) and set NODE_PATH to the global
// node_modules. It is loaded at run time and typed with the little these
// tests use.

export interface PwLocator {
  click(): Promise<void>;
  count(): Promise<number>;
  isVisible(): Promise<boolean>;
  isChecked(): Promise<boolean>;
  waitFor(opts?: { timeout?: number }): Promise<void>;
}

export interface PwPage {
  goto(url: string, opts?: { waitUntil?: string }): Promise<{ status(): number } | null>;
  url(): string;
  content(): Promise<string>;
  fill(selector: string, value: string): Promise<void>;
  check(selector: string): Promise<void>;
  evaluate<R, A>(fn: (arg: A) => R, arg?: A): Promise<R>;
  waitForFunction(fn: () => boolean): Promise<unknown>;
  locator(selector: string): PwLocator;
  getByText(text: string | RegExp): PwLocator;
  getByRole(role: string, opts: { name: string | RegExp }): PwLocator;
  route(
    url: string,
    handler: (route: {
      fulfill(r: { status: number; contentType: string; body: string }): Promise<void>;
    }) => Promise<void>,
  ): Promise<void>;
}

export interface PwContext {
  addCookies(cookies: { name: string; value: string; url: string }[]): Promise<void>;
  newPage(): Promise<PwPage>;
  close(): Promise<void>;
}

export interface PwBrowser {
  newContext(opts?: { viewport?: { width: number; height: number } }): Promise<PwContext>;
  close(): Promise<void>;
}

export function launchBrowser(): Promise<PwBrowser> {
  const require = createRequire(import.meta.url);
  const pw = require("playwright") as {
    chromium: { launch(): Promise<PwBrowser> };
  };
  return pw.chromium.launch();
}

/** A browser context signed in as `email`. */
export async function signedIn(
  browser: PwBrowser,
  email: string,
  width = 1280,
): Promise<{ ctx: PwContext; page: PwPage }> {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
  await ctx.addCookies([
    { name: "laffogato_customer_session", value: customerCookie(email), url: APP },
  ]);
  return { ctx, page: await ctx.newPage() };
}

/**
 * Database: the member key in customers."cardUserKey" is sealed, read,
 * re-sealed, never overwritten when it does not open, and the purge queue
 * deletes a closed account's cards. Local Postgres + the PayNkolay mock.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  CardKeyUnreadableError,
  ensureCardUserKey,
  getCardUserKey,
  getSealedCardUserKey,
  rememberCardUserKey,
} from "@/lib/customer/store";
import { queueCardPurge, runCardPurges } from "@/lib/payment/card-purge";
import { customerScope, openMemberKey } from "@/lib/payment/card-vault";
import { PAYNKOLAY_MEMBER_KEY } from "@/lib/payment/paynkolay";

import {
  mockDown,
  mockReset,
  mockSeed,
  mockState,
  newCustomer,
  pool,
  seedCard,
  sql,
} from "./helpers";

const VAULT = process.env.CARD_VAULT_KEY;

async function column(email: string) {
  const [row] = await sql<{ cardUserKey: string; id: string }>(
    `select id, "cardUserKey" from public.customers where email = $1`,
    [email],
  );
  return row;
}

beforeEach(async () => {
  process.env.CARD_VAULT_KEY = VAULT;
  delete process.env.CARD_VAULT_KEY_PREVIOUS;
  await mockReset();
});
afterAll(async () => {
  process.env.CARD_VAULT_KEY = VAULT;
  await pool.end();
});

describe("member key at rest", () => {
  it("is minted sealed and read back; the column never holds the key", async () => {
    const c = await newCustomer("mint");
    const key = await ensureCardUserKey(c.email);
    expect(key).toMatch(PAYNKOLAY_MEMBER_KEY);
    const row = await column(c.email);
    expect(row.cardUserKey.startsWith("cv1.")).toBe(true);
    expect(row.cardUserKey).not.toContain(key);
    expect(await getCardUserKey(c.email)).toBe(key);
    expect(await ensureCardUserKey(c.email)).toBe(key);
    expect((await column(c.email)).cardUserKey).toBe(row.cardUserKey);
  });

  it("ten checkouts opened at once end up with one key", async () => {
    const c = await newCustomer("race");
    const keys = await Promise.all(
      Array.from({ length: 10 }, () => ensureCardUserKey(c.email)),
    );
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toMatch(PAYNKOLAY_MEMBER_KEY);
    expect(await getCardUserKey(c.email)).toBe(keys[0]);
  });

  it("a key stored in the clear (5-19 Kasım) is read and sealed on that read", async () => {
    const c = await newCustomer("legacy");
    await sql(
      `update public.customers set "cardUserKey" = 'LEGACYKEY01' where email = $1`,
      [c.email],
    );
    expect(await getCardUserKey(c.email)).toBe("LEGACYKEY01");
    const row = await column(c.email);
    expect(row.cardUserKey.startsWith("cv1.")).toBe(true);
    expect(row.cardUserKey).not.toContain("LEGACYKEY01");
    expect(await getCardUserKey(c.email)).toBe("LEGACYKEY01");
  });

  it("a value copied into another member's row does not open there", async () => {
    const a = await newCustomer("copy-a");
    const b = await newCustomer("copy-b");
    await ensureCardUserKey(a.email);
    const sealedA = (await column(a.email)).cardUserKey;
    await sql(`update public.customers set "cardUserKey" = $1 where email = $2`, [
      sealedA,
      b.email,
    ]);
    await expect(getCardUserKey(b.email)).rejects.toBeInstanceOf(
      CardKeyUnreadableError,
    );
    expect(await ensureCardUserKey(b.email)).toBe("");
    expect((await column(b.email)).cardUserKey).toBe(sealedA);
  });

  it("rotation: the old key in _PREVIOUS still opens and the row moves", async () => {
    const c = await newCustomer("rotate");
    const key = await ensureCardUserKey(c.email);
    const before = (await column(c.email)).cardUserKey;
    process.env.CARD_VAULT_KEY = "rotated-vault-key-ZYXWVUTSRQPONMLKJIHGFEDCBA";
    process.env.CARD_VAULT_KEY_PREVIOUS = VAULT;
    expect(await getCardUserKey(c.email)).toBe(key);
    const after = (await column(c.email)).cardUserKey;
    expect(after.split(".")[1]).not.toBe(before.split(".")[1]);
    delete process.env.CARD_VAULT_KEY_PREVIOUS;
    expect(await getCardUserKey(c.email)).toBe(key);
  });

  it("vault key gone: nothing opens, nothing is overwritten; it comes back with the key", async () => {
    const c = await newCustomer("lost");
    await ensureCardUserKey(c.email);
    const sealed = (await column(c.email)).cardUserKey;
    process.env.CARD_VAULT_KEY = "another-vault-key-that-never-sealed-anything-1";
    await expect(getCardUserKey(c.email)).rejects.toBeInstanceOf(
      CardKeyUnreadableError,
    );
    expect(await ensureCardUserKey(c.email)).toBe("");
    expect((await column(c.email)).cardUserKey).toBe(sealed);
    process.env.CARD_VAULT_KEY = VAULT;
    expect(await getCardUserKey(c.email)).toMatch(PAYNKOLAY_MEMBER_KEY);
  });

  it("rememberCardUserKey writes sealed and never erases", async () => {
    const c = await newCustomer("remember");
    await rememberCardUserKey(c.email, "REMEMBER001");
    expect((await column(c.email)).cardUserKey.startsWith("cv1.")).toBe(true);
    expect(await getCardUserKey(c.email)).toBe("REMEMBER001");
    await rememberCardUserKey(c.email, "");
    await rememberCardUserKey(c.email, "not a key!");
    expect(await getCardUserKey(c.email)).toBe("REMEMBER001");
  });

  it("no member has a clear-text key left in the column", async () => {
    const [row] = await sql<{ n: string }>(
      `select count(*)::text as n from public.customers where "cardUserKey" ~ '^[A-Z0-9]{11}$'`,
    );
    expect(row.n).toBe("0");
  });
});

describe("purge queue (account closed while PayNkolay is down)", () => {
  it("queues sealed, retries while down, deletes cards and the row once up", async () => {
    const c = await newCustomer("purge");
    const key = await ensureCardUserKey(c.email);
    await mockSeed(key, [seedCard(1), seedCard(2)]);
    const stored = await getSealedCardUserKey(c.email);
    expect(stored).not.toBeNull();
    expect(await queueCardPurge(stored!.customerId, stored!.stored)).toBe(true);
    const [row] = await sql<{ id: string; sealedKey: string }>(
      `select id, "sealedKey" from public.card_vault_purges order by "createdAt" desc limit 1`,
    );
    expect(row.sealedKey.startsWith("cv1.")).toBe(true);
    expect(row.sealedKey).not.toContain(key);
    expect(row.sealedKey).not.toBe(stored!.stored);
    expect(openMemberKey(row.sealedKey, customerScope(c.id)).ok).toBe(false);

    await mockDown(true);
    expect((await runCardPurges()).pending).toBeGreaterThanOrEqual(1);
    const [after] = await sql<{ attempts: number; lastError: string }>(
      `select attempts, "lastError" from public.card_vault_purges where id = $1`,
      [row.id],
    );
    expect(after).toEqual({ attempts: 1, lastError: "pos" });

    await mockDown(false);
    expect((await runCardPurges()).purged).toBeGreaterThanOrEqual(1);
    expect(
      await sql(`select 1 from public.card_vault_purges where id = $1`, [row.id]),
    ).toHaveLength(0);
    expect((await mockState()).cards[key]).toEqual([]);
  });

  it("a row no key opens is counted and left for the operator", async () => {
    await sql(
      `insert into public.card_vault_purges (id, "sealedKey", "createdAt")
       values ('test-bad-row', 'cv1.zzzzzzzz.a.b.c', now()::text) on conflict do nothing`,
    );
    expect((await runCardPurges()).unreadable).toBeGreaterThanOrEqual(1);
    expect(
      await sql(`select 1 from public.card_vault_purges where id = 'test-bad-row'`),
    ).toHaveLength(1);
    await sql(`delete from public.card_vault_purges where id = 'test-bad-row'`);
  });
});

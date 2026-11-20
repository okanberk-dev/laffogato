/**
 * Account closure: the cards are deleted at PayNkolay; when it does not
 * answer, the key waits sealed in card_vault_purges and the daily run (the
 * real /api/cron/daily of the running app) deletes them.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { ensureCardUserKey, getCustomerByEmail } from "@/lib/customer/store";
import { deleteMe } from "@/lib/mobile/me";

import {
  APP,
  mockDown,
  mockReset,
  mockSeed,
  mockState,
  newCustomer,
  pool,
  seedCard,
  sql,
} from "./helpers";

beforeEach(async () => {
  await mockReset();
});
afterAll(async () => {
  await pool.end();
});

async function close(email: string) {
  const customer = await getCustomerByEmail(email);
  if (!customer) throw new Error("no customer");
  return deleteMe(customer);
}

async function queued(): Promise<number> {
  const [row] = await sql<{ n: number }>(
    `select count(*)::int as n from public.card_vault_purges`,
  );
  return row.n;
}

describe("account closure", () => {
  it("PayNkolay up: cards deleted at once, key cleared, nothing queued", async () => {
    const c = await newCustomer("close-up");
    const key = await ensureCardUserKey(c.email);
    await mockSeed(key, [seedCard(1), seedCard(2)]);
    const before = await queued();
    expect((await close(c.email)).ok).toBe(true);
    expect((await mockState()).cards[key]).toEqual([]);
    const [row] = await sql<{ cardUserKey: string }>(
      `select "cardUserKey" from public.customers where id = $1`,
      [c.id],
    );
    expect(row.cardUserKey).toBe("");
    expect(await queued()).toBe(before);
  });

  it("PayNkolay down: closure goes on, the key waits sealed, the daily run deletes the cards", async () => {
    const c = await newCustomer("close-down");
    const key = await ensureCardUserKey(c.email);
    await mockSeed(key, [seedCard(3), seedCard(4)]);
    await mockDown(true);
    expect((await close(c.email)).ok).toBe(true);
    const [cust] = await sql<{ cardUserKey: string; email: string }>(
      `select email, "cardUserKey" from public.customers where id = $1`,
      [c.id],
    );
    expect(cust.cardUserKey).toBe("");
    expect(cust.email).not.toBe(c.email);
    const rows = await sql<{ id: string; sealedKey: string }>(
      `select id, "sealedKey" from public.card_vault_purges`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(row.sealedKey).not.toContain(key);
      expect(JSON.stringify(row)).not.toContain(c.email);
    }
    expect((await mockState()).cards[key]).toHaveLength(2);

    await mockDown(false);
    const res = await fetch(`${APP}/api/cron/daily`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      cardPurge: { ok: boolean; purged: number };
    };
    expect(body.cardPurge.ok).toBe(true);
    expect(body.cardPurge.purged).toBeGreaterThanOrEqual(1);
    expect((await mockState()).cards[key]).toEqual([]);
    expect(await queued()).toBe(0);
  });

  it("the daily run without the cron secret is refused", async () => {
    expect((await fetch(`${APP}/api/cron/daily`)).status).toBe(401);
  });
});

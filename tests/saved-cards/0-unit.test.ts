/**
 * Unit: the vault (src/lib/payment/card-vault.ts) and the card-name and
 * duplicate helpers (src/lib/payment/paynkolay-card.ts). No database.
 */
import { afterAll, describe, expect, it, vi } from "vitest";

import {
  cardAliasFrom,
  isSameSavedCard,
} from "@/lib/payment/paynkolay-card";

const VARS = [
  "CARD_VAULT_KEY",
  "CARD_VAULT_KEY_PREVIOUS",
  "PAYNKOLAY_MERCHANT_SECRET_KEY",
] as const;
const saved = Object.fromEntries(VARS.map((k) => [k, process.env[k]]));
afterAll(() => {
  for (const k of VARS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

async function vault(env: Partial<Record<(typeof VARS)[number], string>>) {
  vi.resetModules();
  for (const k of VARS) {
    const v = env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import("@/lib/payment/card-vault");
}

const KEY = "ABCDEFGHIJ1";
const A = "a".repeat(40);
const B = "b".repeat(40);
const M = "merchant-secret-xyz";

describe("card vault", () => {
  it("seals and opens, bound to its scope; tampering and fresh IVs", async () => {
    const v = await vault({ CARD_VAULT_KEY: A, PAYNKOLAY_MERCHANT_SECRET_KEY: M });
    const s = v.sealMemberKey(KEY, v.customerScope("cus-1"));
    expect(s.startsWith("cv1.")).toBe(true);
    expect(s).not.toContain(KEY);
    expect(v.openMemberKey(s, v.customerScope("cus-1"))).toEqual({
      ok: true,
      key: KEY,
      reseal: false,
    });
    expect(v.openMemberKey(s, v.customerScope("cus-2"))).toEqual({ ok: false });
    const parts = s.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("A") ? "BB" : "AA");
    expect(v.openMemberKey(parts.join("."), v.customerScope("cus-1"))).toEqual({
      ok: false,
    });
    expect(v.sealMemberKey(KEY, "x")).not.toEqual(v.sealMemberKey(KEY, "x"));
  });

  it("legacy clear text opens and asks to be sealed; garbage does not open", async () => {
    const v = await vault({ PAYNKOLAY_MERCHANT_SECRET_KEY: M });
    expect(v.openMemberKey(KEY, "customer:1")).toEqual({
      ok: true,
      key: KEY,
      reseal: true,
    });
    expect(v.openMemberKey("", "customer:1")).toEqual({
      ok: true,
      key: "",
      reseal: false,
    });
    expect(v.openMemberKey("garbage", "customer:1")).toEqual({ ok: false });
  });

  it("fallback key, then its own key, then rotation through _PREVIOUS", async () => {
    let v = await vault({ PAYNKOLAY_MERCHANT_SECRET_KEY: M });
    expect(v.cardVaultReady()).toBe(true);
    expect(v.cardVaultHasOwnKey()).toBe(false);
    const viaMerchant = v.sealMemberKey(KEY, "customer:1");
    v = await vault({ CARD_VAULT_KEY: A, PAYNKOLAY_MERCHANT_SECRET_KEY: M });
    expect(v.cardVaultHasOwnKey()).toBe(true);
    expect(v.openMemberKey(viaMerchant, "customer:1")).toEqual({
      ok: true,
      key: KEY,
      reseal: true,
    });
    const viaA = v.sealMemberKey(KEY, "customer:1");
    v = await vault({
      CARD_VAULT_KEY: B,
      CARD_VAULT_KEY_PREVIOUS: A,
      PAYNKOLAY_MERCHANT_SECRET_KEY: M,
    });
    expect(v.openMemberKey(viaA, "customer:1")).toEqual({
      ok: true,
      key: KEY,
      reseal: true,
    });
    v = await vault({ CARD_VAULT_KEY: B, PAYNKOLAY_MERCHANT_SECRET_KEY: M });
    expect(v.openMemberKey(viaA, "customer:1")).toEqual({ ok: false });
  });

  it("a CARD_VAULT_KEY shorter than 32 characters turns the vault off", async () => {
    const v = await vault({ CARD_VAULT_KEY: "short", PAYNKOLAY_MERCHANT_SECRET_KEY: M });
    expect(v.cardVaultReady()).toBe(false);
    expect(() => v.sealMemberKey(KEY, "x")).toThrow();
  });

  it("rebind moves a value to another scope only when it opens", async () => {
    const v = await vault({ CARD_VAULT_KEY: A });
    const s = v.sealMemberKey(KEY, "customer:9");
    const moved = v.rebindMemberKey(s, "customer:9", "purge:abc");
    expect(moved).not.toBeNull();
    expect(v.openMemberKey(moved ?? "", "purge:abc")).toEqual({
      ok: true,
      key: KEY,
      reseal: false,
    });
    expect(v.rebindMemberKey(s, "customer:8", "purge:abc")).toBeNull();
    expect(v.rebindMemberKey(KEY, "customer:9", "purge:z")).not.toBeNull();
  });
});

describe("card name and duplicate check", () => {
  it("cleans the name the member types", () => {
    expect(cardAliasFrom(null, "6111")).toBe("Kartım 6111");
    expect(cardAliasFrom("  Maaş   kartım!! ", "6111")).toBe("Maaş kartım");
    expect(cardAliasFrom("<script>", "6111")).toBe("script");
    expect(cardAliasFrom("4155 6501 0000 6111", "6111")).toBe("Kartım 6111");
    expect(cardAliasFrom("çok uzun bir kart adı yazdım burada", "1")).toHaveLength(20);
    expect(cardAliasFrom("", "x")).toBe("Kartım");
  });

  it("matches a new number against a masked saved card by first six and last four", () => {
    expect(isSameSavedCard("41556501****6111", "4155650100006111")).toBe(true);
    expect(isSameSavedCard("41556501****6111", "4155660100006111")).toBe(false);
    expect(isSameSavedCard("41556501****6112", "4155650100006111")).toBe(false);
    expect(isSameSavedCard("", "4155650100006111")).toBe(false);
  });
});

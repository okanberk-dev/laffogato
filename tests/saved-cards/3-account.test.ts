/**
 * Browser: Hesabım › Kayıtlı kartlarım on the running app, signed in with
 * the site's own customer cookie.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ensureCardUserKey } from "@/lib/customer/store";

import {
  APP,
  launchBrowser,
  mockDown,
  mockReset,
  mockSeed,
  mockState,
  newCustomer,
  pool,
  seedCard,
  signedIn,
  type PwBrowser,
} from "./helpers";

let browser: PwBrowser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
  await pool.end();
});
beforeEach(async () => {
  await mockReset();
});

const PAGE = `${APP}/uye/hesap/kartlarim`;

describe("Kayıtlı kartlarım", () => {
  it("is behind sign-in", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(PAGE);
    expect(new URL(page.url()).pathname).toBe("/uye/giris");
    await ctx.close();
  });

  it("a member with no card is told how a card gets saved", async () => {
    const c = await newCustomer("acct-empty");
    const { ctx, page } = await signedIn(browser, c.email);
    await page.goto(PAGE);
    expect(await page.getByText("Kayıtlı kartın yok").isVisible()).toBe(true);
    expect(await page.getByText("0/10 kart kayıtlı").count()).toBe(1);
    await ctx.close();
  });

  it("lists by last four and name; tokens, BIN and key are not in the page", async () => {
    const c = await newCustomer("acct-list");
    const key = await ensureCardUserKey(c.email);
    const cards = [seedCard(1, "Maaş kartım"), seedCard(2)];
    await mockSeed(key, cards);
    const { ctx, page } = await signedIn(browser, c.email);
    await page.goto(PAGE);
    expect(await page.locator(".account-saved-card").count()).toBe(2);
    expect(await page.getByText("Maaş kartım").count()).toBe(1);
    expect(await page.getByText("2/10 kart kayıtlı").count()).toBe(1);
    const html = await page.content();
    for (const card of cards) {
      expect(html).not.toContain(card.Token);
      expect(html).not.toContain(card.Maskedpan.slice(0, 8));
    }
    expect(html).not.toContain(key);
    expect(html).toContain("noindex");
    await ctx.close();
  });

  it("deletes after asking; the card is gone at PayNkolay and from the list (phone width)", async () => {
    const c = await newCustomer("acct-del");
    const key = await ensureCardUserKey(c.email);
    const cards = [seedCard(1, "Silinecek"), seedCard(2, "Kalacak")];
    await mockSeed(key, cards);
    const { ctx, page } = await signedIn(browser, c.email, 390);
    await page.goto(PAGE);
    await page.getByRole("button", { name: "•••• 1001 kartını sil" }).click();
    expect(await page.getByText("Bu kart silinsin mi?").isVisible()).toBe(true);
    expect((await mockState()).cards[key]).toHaveLength(2);
    await page.getByRole("button", { name: "Evet, sil" }).click();
    await page.getByText("Kayıtlı kart silindi.").waitFor();
    await page.waitForFunction(
      () => document.querySelectorAll(".account-saved-card").length === 1,
    );
    expect((await mockState()).cards[key].map((x) => x.TranId)).toEqual([
      cards[1].TranId,
    ]);
    expect(await page.getByText("Kalacak").count()).toBe(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await ctx.close();
  });

  it("a tampered tranId pointing at another member's card deletes nothing", async () => {
    const victim = await newCustomer("acct-victim");
    const vKey = await ensureCardUserKey(victim.email);
    const theirs = seedCard(8, "Kurban");
    await mockSeed(vKey, [theirs]);
    const c = await newCustomer("acct-attacker");
    const key = await ensureCardUserKey(c.email);
    await mockSeed(key, [seedCard(3)]);
    const { ctx, page } = await signedIn(browser, c.email);
    await page.goto(PAGE);
    await page.getByRole("button", { name: /kartını sil/ }).click();
    await page.evaluate((t: string) => {
      const input = document.querySelector<HTMLInputElement>('input[name="tranId"]');
      if (input) input.value = t;
    }, theirs.TranId);
    await page.getByRole("button", { name: "Evet, sil" }).click();
    await page.getByText("Bu kart artık kayıtlı değil.").waitFor();
    const st = await mockState();
    expect(st.cards[vKey]).toHaveLength(1);
    expect(st.cards[key]).toHaveLength(1);
    await ctx.close();
  });

  it("PayNkolay down: the page says so, no error page", async () => {
    const c = await newCustomer("acct-down");
    await ensureCardUserKey(c.email);
    await mockDown(true);
    const { ctx, page } = await signedIn(browser, c.email);
    const res = await page.goto(PAGE);
    expect(res?.status()).toBe(200);
    expect(
      await page.getByText("Kayıtlı kartların şu an gösterilemiyor").count(),
    ).toBe(1);
    await mockDown(false);
    await ctx.close();
  });

  it("the account menu links the page", async () => {
    const c = await newCustomer("acct-nav");
    const { ctx, page } = await signedIn(browser, c.email);
    await page.goto(`${APP}/uye/hesap`);
    expect(
      await page.locator('a[href="/uye/hesap/kartlarim"]').count(),
    ).toBeGreaterThan(0);
    await ctx.close();
  });
});

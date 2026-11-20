/**
 * Browser, the site's own checkout (/odeme): saved cards, the card's name
 * field, the 10-card limit, and a real pay press through the Server Action
 * and the native form post to PayNkolay (the mock).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ensureCardUserKey } from "@/lib/customer/store";

import {
  APP,
  ensureTestProduct,
  launchBrowser,
  luhnCard,
  mockPayments,
  mockReset,
  mockSeed,
  mockState,
  newCustomer,
  pool,
  seedCard,
  signedIn,
  sql,
  type PwBrowser,
  type PwPage,
} from "./helpers";

let browser: PwBrowser;
let productId = "";
beforeAll(async () => {
  browser = await launchBrowser();
  productId = await ensureTestProduct();
});
afterAll(async () => {
  await browser?.close();
  await pool.end();
});
beforeEach(async () => {
  await mockReset();
});

async function member(tag: string) {
  const c = await newCustomer(tag, { withAddress: true });
  return { email: c.email, key: await ensureCardUserKey(c.email) };
}

async function openCheckout(email: string, width = 1280) {
  const { ctx, page } = await signedIn(browser, email, width);
  // The bank's 3D form posts to its ACS host: answer it here.
  await page.route("https://acs.example-bank.test/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>BANKA 3D</p>" }),
  );
  await page.goto(`${APP}/uye/giris`);
  await page.evaluate((id: string) => {
    // Cart prices are in lira (display only; the server prices the order).
    localStorage.setItem(
      "laffogato_cart_v1",
      JSON.stringify([{ productId: id, variantId: "", name: "Test Kahve", price: 250, qty: 1 }]),
    );
  }, productId);
  await page.goto(`${APP}/odeme`, { waitUntil: "networkidle" });
  return { ctx, page };
}

async function fillNewCard(page: PwPage, number: string) {
  // A name with a digit is refused by the form, rightly.
  await page.fill("#cc-name", "TEST UYE");
  await page.fill("#cc-number", number);
  await page.fill("#cc-exp", "12/30");
  await page.fill("#cc-csc", "123");
}

async function consentAndPay(page: PwPage) {
  await page.check("#consentPreInfo");
  await page.check("#consentContract");
  const pay = page.getByRole("button", { name: /Siparişi onayla ve öde/i });
  await pay.click();
  // A total the server changed (shipping) is shown and confirmed with a
  // second press (MSY m.6): the site's own rule.
  const bank = page.getByText("BANKA 3D");
  const repriced = page.getByText(/Fiyatlar güncellendi/);
  await Promise.race([
    bank.waitFor({ timeout: 30_000 }),
    repriced.waitFor({ timeout: 30_000 }),
  ]);
  if (await repriced.isVisible().catch(() => false)) {
    await pay.click();
    await bank.waitFor({ timeout: 30_000 });
  }
}

describe("/odeme with saved cards", () => {
  it("lists saved cards and selects the first; no token in the page", async () => {
    const m = await member("co-list");
    const cards = [seedCard(1, "Maaş kartım"), seedCard(2)];
    await mockSeed(m.key, cards);
    const { ctx, page } = await openCheckout(m.email);
    await page.getByText("Kayıtlı kartların").waitFor();
    expect(await page.getByText("•••• 1001").count()).toBe(1);
    expect(await page.getByText(/Maaş kartım/).count()).toBe(1);
    expect(await page.locator("#saved-card-0").isChecked()).toBe(true);
    const html = await page.content();
    for (const c of cards) {
      expect(html).not.toContain(c.Token);
      expect(html).not.toContain(c.Maskedpan.slice(0, 8));
    }
    expect(html).not.toContain(m.key);
    await ctx.close();
  });

  it("new card, box ticked, named (phone): the name reaches PayNkolay and the card is saved", async () => {
    const m = await member("co-save");
    const { ctx, page } = await openCheckout(m.email, 390);
    expect(await page.locator("#cc-alias").count()).toBe(0);
    await fillNewCard(page, luhnCard("415565"));
    await page.check('input[name="saveCard"]');
    await page.locator("#cc-alias").waitFor();
    await page.fill("#cc-alias", "Maaş kartım");
    await consentAndPay(page);
    const pays = await mockPayments();
    expect(pays).toHaveLength(1);
    expect(pays[0].csAutoSave).toBe("true");
    expect(pays[0].csCardAlias).toBe("Maaş kartım");
    expect(pays[0].csCustomerKey).toBe(m.key);
    expect((await mockState()).cards[m.key]).toHaveLength(1);
    const [order] = await sql<{ status: string }>(
      `select status from public.orders where "customerEmail" = $1`,
      [m.email],
    );
    expect(order.status).toBe("pending_payment");
    await ctx.close();
  });

  it("box left unticked: nothing is saved", async () => {
    const m = await member("co-nosave");
    const { ctx, page } = await openCheckout(m.email);
    await fillNewCard(page, luhnCard("540061"));
    await consentAndPay(page);
    const pays = await mockPayments();
    expect(pays[0].csAutoSave).toBeUndefined();
    expect(pays[0].csCustomerKey).toBeUndefined();
    expect((await mockState()).cards[m.key]).toBeUndefined();
    await ctx.close();
  });

  it("pays with the chosen saved card: PayNkolay's token, no card number", async () => {
    const m = await member("co-saved");
    const cards = [seedCard(1, "Birinci"), seedCard(2, "İkinci")];
    await mockSeed(m.key, cards);
    const { ctx, page } = await openCheckout(m.email);
    await page.getByText("Kayıtlı kartların").waitFor();
    await page.locator('label[for="saved-card-1"]').click();
    await consentAndPay(page);
    const pays = await mockPayments();
    expect(pays).toHaveLength(1);
    expect(pays[0].csToken).toBe(cards[1].Token);
    expect(pays[0].cardNumber).toBeUndefined();
    await ctx.close();
  });

  it("at ten cards the save box gives way to the limit note", async () => {
    const m = await member("co-limit");
    await mockSeed(m.key, Array.from({ length: 10 }, (_, i) => seedCard(i + 1)));
    const { ctx, page } = await openCheckout(m.email);
    await page.locator('label[for="saved-card-new"]').click();
    expect(await page.getByText(/En çok 10 kart kaydedebilirsin/).isVisible()).toBe(true);
    expect(await page.locator('input[name="saveCard"]').count()).toBe(0);
    await ctx.close();
  });

  it("deletes a saved card from the checkout list after asking", async () => {
    const m = await member("co-del");
    const cards = [seedCard(1, "Silinecek"), seedCard(2, "Kalacak")];
    await mockSeed(m.key, cards);
    const { ctx, page } = await openCheckout(m.email);
    await page.getByRole("button", { name: "•••• 1001 kartını sil" }).click();
    await page.getByRole("button", { name: "Evet, sil" }).click();
    await page.getByText("Kayıtlı kart silindi.").waitFor();
    expect((await mockState()).cards[m.key].map((c) => c.TranId)).toEqual([
      cards[1].TranId,
    ]);
    await ctx.close();
  });
});

/**
 * HTTP: /odeme/paynkolay on the running app against the PayNkolay mock. It
 * is the page the app opens and the route the web checkout's native form
 * posts to.
 */
import { readFileSync } from "node:fs";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { ensureCardUserKey } from "@/lib/customer/store";
import { getPaymentProvider } from "@/lib/payment";

import {
  APP,
  luhnCard,
  mockPayments,
  mockReset,
  mockSeed,
  mockState,
  newCustomer,
  newOrder,
  pool,
  seedCard,
} from "./helpers";

const HOLDER = "TEST UYE";
/** Everything that must never show up in a response or in the server log. */
const secrets: string[] = [];

async function bridge(orderId: string, cardUserKey?: string) {
  const session = await getPaymentProvider().createCheckoutSession({
    orderId,
    amountMinor: 12550,
    currency: "TRY",
    customer: { id: "c", email: "x@laffogato.test", fullName: "Test" },
    billingAddress: { city: "", district: "", line1: "" },
    shippingAddress: { city: "", district: "", line1: "" },
    items: [],
    successUrl: `${APP}/odeme/donus`,
    failureUrl: `${APP}/odeme?error=payment`,
    buyerIp: "127.0.0.1",
    cardUserKey,
  });
  const u = new URL(session.redirectUrl);
  return { d: u.searchParams.get("d") ?? "", s: u.searchParams.get("s") ?? "" };
}

async function getPage(b: { d: string; s: string }) {
  const res = await fetch(
    `${APP}/odeme/paynkolay?d=${encodeURIComponent(b.d)}&s=${encodeURIComponent(b.s)}`,
  );
  return { res, html: await res.text() };
}

async function post(
  fields: Record<string, string>,
  headers: Record<string, string> = {},
) {
  const res = await fetch(`${APP}/odeme/paynkolay`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: APP,
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: new URLSearchParams(fields).toString(),
  });
  return {
    status: res.status,
    location: res.headers.get("location"),
    html: await res.text(),
  };
}

function card(number: string, extra: Record<string, string> = {}) {
  secrets.push(number, number.replace(/(\d{4})(?=\d)/g, "$1 "));
  return {
    cardHolderName: HOLDER,
    cardNumber: number,
    cardExpiry: "12/30",
    cardCvv: "742",
    cardChoice: "new",
    ...extra,
  };
}

async function lastPayment() {
  return (await mockPayments()).at(-1);
}

let member = "";
let email = "";
beforeEach(async () => {
  await mockReset();
});
afterAll(async () => {
  await pool.end();
});

describe("card page and payment route", () => {
  it("setup: a member with a sealed key", async () => {
    email = (await newCustomer("route")).email;
    member = await ensureCardUserKey(email);
    expect(member).toMatch(/^[A-Z0-9]{11}$/);
    secrets.push(member);
  });

  it("GET lists saved cards by last four and name; no token, no BIN, no member key", async () => {
    const cards = [seedCard(1, "Maaş kartım"), seedCard(2)];
    await mockSeed(member, cards);
    const b = await bridge(await newOrder(email), member);
    expect(b.d.startsWith("e1.")).toBe(true);
    expect(b.d).not.toContain(member);
    const { res, html } = await getPage(b);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(html).toContain("•••• 1001");
    expect(html).toContain("Maaş kartım");
    for (const c of cards) {
      expect(html).not.toContain(c.Token);
      expect(html).not.toContain(c.Maskedpan.slice(0, 8));
    }
    expect(html).not.toContain(member);
    expect(html).toContain('name="saveCard"');
    expect(html).toContain('name="cardAlias"');
  });

  it("new card, save and name: PayNkolay gets csCustomerKey, csAutoSave and the name", async () => {
    const number = luhnCard("415565");
    const b = await bridge(await newOrder(email), member);
    const r = await post({ ...b, ...card(number, { saveCard: "1", cardAlias: "Maaş kartım" }) });
    expect(r.status).toBe(200);
    expect(r.html).toContain("acs.example-bank.test");
    const last = await lastPayment();
    expect(last?.csCustomerKey).toBe(member);
    expect(last?.csAutoSave).toBe("true");
    expect(last?.csCardAlias).toBe("Maaş kartım");
    expect(last?.cardNumber).toBe(number);
    expect(r.html).not.toContain(number);
    expect(r.html).not.toContain(member);
  });

  it("the same card again with the box ticked: paid, not saved a second time", async () => {
    const number = luhnCard("415565");
    let b = await bridge(await newOrder(email), member);
    await post({ ...b, ...card(number, { saveCard: "1" }) });
    let st = await mockState();
    expect(st.cards[member]).toHaveLength(1);
    expect(st.cards[member][0].CARD_ALIACE).toBe(`Kartım ${number.slice(-4)}`);
    b = await bridge(await newOrder(email), member);
    const r = await post({ ...b, ...card(number, { saveCard: "1", cardAlias: "İkinci" }) });
    expect(r.status).toBe(200);
    const last = await lastPayment();
    expect(last?.csAutoSave).toBeUndefined();
    expect(last?.csCardAlias).toBeUndefined();
    st = await mockState();
    expect(st.cards[member]).toHaveLength(1);
  });

  it("a name that is a card number or markup is not sent as typed", async () => {
    const number = luhnCard("454360");
    let b = await bridge(await newOrder(email), member);
    await post({ ...b, ...card(number, { saveCard: "1", cardAlias: number }) });
    expect((await lastPayment())?.csCardAlias).toBe(`Kartım ${number.slice(-4)}`);
    await mockReset();
    b = await bridge(await newOrder(email), member);
    await post({
      ...b,
      ...card(luhnCard("540061"), {
        saveCard: "1",
        cardAlias: "<img src=x onerror=alert(1)>Kart",
      }),
    });
    const alias = (await lastPayment())?.csCardAlias ?? "";
    expect(alias).not.toMatch(/[<>="()]/);
    expect(alias.length).toBeLessThanOrEqual(20);
  });

  it("at ten cards: no save box, and a ticked box saves nothing", async () => {
    await mockSeed(member, Array.from({ length: 10 }, (_, i) => seedCard(i + 1)));
    const b = await bridge(await newOrder(email), member);
    const { html } = await getPage(b);
    expect(html).toContain("En çok 10 kart kaydedebilirsin");
    expect(html).not.toContain('name="saveCard"');
    const r = await post({ ...b, ...card(luhnCard("979206"), { saveCard: "1" }) });
    expect(r.status).toBe(200);
    expect((await lastPayment())?.csAutoSave).toBeUndefined();
    expect((await mockState()).cards[member]).toHaveLength(10);
  });

  it("paying with a saved card sends PayNkolay's token, never a card number", async () => {
    const cards = [seedCard(7, "İş")];
    await mockSeed(member, cards);
    const b = await bridge(await newOrder(email), member);
    const r = await post({ ...b, cardChoice: cards[0].TranId });
    expect(r.status).toBe(200);
    const last = await lastPayment();
    expect(last?.csToken).toBe(cards[0].Token);
    expect(last?.csCustomerKey).toBe(member);
    expect(last?.cardNumber).toBeUndefined();
    expect(last?.cvv).toBeUndefined();
    expect(r.html).not.toContain(cards[0].Token);
  });

  it("another member's card can be neither chosen nor deleted", async () => {
    const other = await newCustomer("other");
    const otherKey = await ensureCardUserKey(other.email);
    secrets.push(otherKey);
    const theirs = seedCard(9, "Onun kartı");
    await mockSeed(otherKey, [theirs]);
    await mockSeed(member, [seedCard(3)]);
    let b = await bridge(await newOrder(email), member);
    expect((await post({ ...b, cardChoice: theirs.TranId })).status).toBe(422);
    expect(await mockPayments()).toHaveLength(0);
    b = await bridge(await newOrder(email), member);
    const web = await post({ ...b, cardChoice: theirs.TranId, return: "checkout" });
    expect(web.status).toBe(303);
    expect(web.location).toContain("odeme=kart_yok");
    b = await bridge(await newOrder(email), member);
    expect((await post({ ...b, deleteCard: theirs.TranId })).status).toBe(404);
    expect((await mockState()).cards[otherKey]).toHaveLength(1);
  });

  it("the member deletes their own card from the app page", async () => {
    const mine = [seedCard(4), seedCard(5)];
    await mockSeed(member, mine);
    const b = await bridge(await newOrder(email), member);
    const del = await post({ ...b, deleteCard: mine[0].TranId });
    expect(del.status).toBe(200);
    expect(del.html).toContain("Kayıtlı kart silindi.");
    expect((await mockState()).cards[member].map((c) => c.TranId)).toEqual([
      mine[1].TranId,
    ]);
  });

  it("without a member key nothing is stored, even with the box ticked", async () => {
    const b = await bridge(await newOrder(email));
    const r = await post({ ...b, ...card(luhnCard("415565"), { saveCard: "1", cardAlias: "X" }) });
    expect(r.status).toBe(200);
    const last = await lastPayment();
    expect(last?.csCustomerKey).toBeUndefined();
    expect(last?.csAutoSave).toBeUndefined();
  });

  it("a card posted from another site is refused before PayNkolay", async () => {
    const b = await bridge(await newOrder(email), member);
    const r = await post(
      { ...b, ...card(luhnCard("415565")) },
      { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    );
    expect(r.status).toBe(403);
    expect(await mockPayments()).toHaveLength(0);
  });

  it("no card number or member key reached the server log", async () => {
    const logFile = process.env.SERVER_LOG;
    if (!logFile) return; // the runner script always sets it
    await new Promise((r) => setTimeout(r, 300));
    const log = readFileSync(logFile, "utf8");
    for (const secret of secrets) {
      expect(log.includes(secret), `log holds ${secret.slice(0, 4)}…`).toBe(false);
    }
  });
});

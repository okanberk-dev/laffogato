import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Operator, 17 Eki 2026: "checkout: gerekli olmayan, yasal zorunluluğu
 * olmayan bilgileri kaldır; benzer yerlerde de". The checkout itself is held
 * in checkout-layout.test.ts; this file holds the two places around it, the
 * cart drawer and the order success page: each says a thing once, and what
 * the customer needs (the shipping note, the order number, the total) stays.
 */

// ── the cart drawer ─────────────────────────────────────────────────────────

// The drawer's module also holds the wishlist button, whose server action
// is not under test here.
vi.mock("@/app/uye/actions", () => ({ toggleWishlistAction: vi.fn() }));

describe("the cart drawer", () => {
  async function drawer(items: unknown[]) {
    const { CartDrawer } = await import("@/components/laffogato/ui");
    return renderToStaticMarkup(
      createElement(CartDrawer, {
        open: true,
        onClose: () => {},
        items: items as never,
        removeItem: () => {},
        setQty: () => {},
        freeShippingThreshold: 1500,
      }),
    );
  }

  it("keeps the subtotal, the shipping note and one way on; no restated hint", async () => {
    const html = await drawer([
      { productId: "p1", name: "Çekirdek", price: 400, qty: 2 },
    ]);
    expect(html).toContain("Ara toplam");
    // Shipping is not in this figure: said here, priced at checkout.
    expect(html).toContain("Ödeme adımında hesaplanır");
    expect(html).toContain('href="/odeme"');
    expect(html).not.toContain("Adres ve indirim kodu");
    expect(html).not.toContain("cart-foot-hint");
  });

  it("an empty cart says so and offers the shop, without a sales line", async () => {
    const html = await drawer([]);
    expect(html).toContain("Sepetin boş");
    expect(html).toContain('href="/magaza"');
    expect(html).not.toContain("cart-empty-text");
    expect(html).not.toContain("moka pot");
  });
});

// ── the order success page ──────────────────────────────────────────────────

const order = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/admin/store", () => ({
  getOrder: async () => order.value,
}));
vi.mock("@/lib/customer/auth", () => ({
  getActiveCustomer: async () => ({ email: "a@b.c" }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  notFound: () => {
    throw new Error("notFound");
  },
}));

function makeOrder(over: Record<string, unknown> = {}) {
  return {
    orderNo: 10042,
    status: "paid",
    paidAt: "2026-10-17T10:00:00.000Z",
    refunds: [],
    createdAt: "2026-10-17T10:00:00.000Z",
    customerName: "Ayşe Yılmaz",
    customerEmail: "a@b.c",
    items: [
      { productName: "Çekirdek 250 g", qty: 2, unitPriceMinor: 40_000 },
      { productName: "Moka pot", qty: 1, unitPriceMinor: 120_000 },
    ],
    subtotalMinor: 200_000,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor: 200_000,
    ...over,
  };
}

async function successPage(query: Record<string, string> = {}) {
  const { default: OrderSuccessPage } =
    await import("@/app/odeme/basarili/page");
  return renderToStaticMarkup(
    await OrderSuccessPage({
      searchParams: Promise.resolve({ ref: "ord-0042", ...query }),
    }),
  );
}

describe("the order success page", () => {
  beforeEach(() => {
    order.value = makeOrder();
  });

  it("shows the order number, and the total once (in the summary)", async () => {
    const html = await successPage();
    expect(html).toContain("#10042");
    const facts = html.slice(
      html.indexOf('class="order-done-facts"'),
      html.indexOf("</dl>", html.indexOf('class="order-done-facts"')),
    );
    expect(facts).toContain("Sipariş no");
    expect(facts).not.toContain("Toplam");
    expect(facts).not.toContain("Ürün");
    // The total is the summary's last row, the only "Toplam" on the page.
    expect(html.match(/>Toplam</g)).toHaveLength(1);
    expect(html).toContain("Ara toplam");
    expect(html).toContain("Kargo");
  });

  it("a paid, listed order: one way to follow it, no note repeating the button", async () => {
    const html = await successPage();
    expect(html).toContain('href="/uye/hesap/siparislerim/10042"');
    expect(html).toContain("Siparişi takip et");
    expect(html).not.toContain("order-done-foot");
    expect(html).toContain("Ödemen alındı.");
  });

  it("an order whose payment is not confirmed: no link, and the note says when it will show", async () => {
    order.value = makeOrder({ status: "pending_payment", paidAt: "" });
    const html = await successPage();
    expect(html).not.toContain("Siparişi takip et");
    expect(html).toContain("order-done-foot");
    expect(html).toContain("ödemeni bankayla teyit ediyoruz");
    // Not "not paid", not even "not completed yet": /odeme/donus lands here
    // when the bank's answer could not be confirmed, and the card may have
    // been charged (rule 29).
    expect(html).not.toMatch(/tamamlanmadı|ödenmedi|para çekilmedi/i);
  });

  it("a dropped code is said in one short sentence", async () => {
    const html = await successPage({ promo: "dropped" });
    expect(html).toMatch(
      /role="status"[^>]*>İndirim kodun sipariş anında geçerli değildi, bu yüzden\s+uygulanmadı\.</,
    );
  });
});

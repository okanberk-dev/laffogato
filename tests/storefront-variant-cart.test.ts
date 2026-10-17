import {
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Product } from "@/components/laffogato/data";

/**
 * The shop card's quick "+" put a product sold in variants into the cart
 * without a variant: the line was priced at the base price and took its
 * stock from the product total only (found while building the admin audit's
 * catalog package 5a). The card now opens such a product so the variant is
 * chosen first, and toCartItem refuses a variant product's line without one
 * of its own variants. The server-side refusal is a separate back-end change.
 *
 * No DOM library is installed (and none may be added): the card - a
 * component without hooks - is called as a function so its button's own
 * click handler can be run; pages are read as server markup.
 */

vi.mock("@/app/uye/actions", () => ({ toggleWishlistAction: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
  } & Record<string, unknown>) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/magaza",
  useRouter: () => ({ push: () => {} }),
}));

const base: Product = {
  id: "prd-0100",
  name: "Bambu Chasen",
  tag: "Ekipman",
  price: "750₺",
  priceMinor: 75000,
  desc: "80 dişli geleneksel bambu chasen, Nara'dan.",
  cat: "gear",
  img: "matcha",
  slug: "bambu-chasen",
  stock: 5,
};

const gift: Product = {
  ...base,
  id: "prd-0003",
  name: "Yenilebilir Kup - 6'lı Kutu",
  cat: "gift",
  slug: "yenilebilir-kup",
};

const beans: Product = {
  ...base,
  id: "prd-0002",
  name: "Notturna - Filtre Lotu",
  desc: "Kenya AA Nyeri.",
  cat: "beans",
  slug: "notturna",
};

const withVariants: Product = {
  ...beans,
  id: "prd-0001",
  name: "Sirena - Espresso Harmanı",
  slug: "sirena",
  variants: [
    { id: "v-250", name: "250 g", priceDelta: 0, stock: 3, isActive: true },
    { id: "v-1kg", name: "1 kg", priceDelta: 600, stock: 2, isActive: true },
  ],
};

const featured: Product = {
  ...gift,
  id: "prd-0004",
  name: "Affogato Seti - İki Kişilik",
  slug: "affogato-seti-iki-kisilik",
};

type AnyElement = ReactElement<Record<string, unknown>>;

/** Every host element in a tree built by calling components without hooks. */
function hostElements(node: ReactNode): AnyElement[] {
  const out: AnyElement[] = [];
  const walk = (n: ReactNode) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!isValidElement(n)) return;
    const el = n as AnyElement;
    if (typeof el.type === "string") out.push(el);
    walk(el.props.children as ReactNode);
  };
  walk(node);
  return out;
}

async function card(
  product: Product,
  opts: { onOpen?: boolean } = {},
): Promise<{
  add: ReturnType<typeof vi.fn>;
  open: ReturnType<typeof vi.fn>;
  action: AnyElement | undefined;
  html: string;
}> {
  const { ProductCard } = await import("@/components/laffogato/ui");
  const add = vi.fn();
  const open = vi.fn();
  const props = {
    product,
    addToCart: add,
    onOpen: opts.onOpen ? open : undefined,
  };
  const tree = ProductCard(props);
  const action = hostElements(tree).find((el) =>
    String(el.props.className ?? "").includes("product-card-add"),
  );
  const html = renderToStaticMarkup(createElement(ProductCard, props));
  return { add, open, action, html };
}

describe("the shop card never adds a line without its variant", () => {
  it("opens a product sold in variants instead of adding it", async () => {
    const { add, open, action, html } = await card(withVariants, {
      onOpen: true,
    });
    expect(action?.type).toBe("button");
    expect(action?.props["aria-label"]).toBe("Sirena - seçenekleri gör");
    expect(html).not.toContain("sepete ekle");
    (action?.props.onClick as () => void)();
    expect(add).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(withVariants);
  });

  it("links to the product page where there is no quick look", async () => {
    const { add, action } = await card(withVariants);
    expect(action?.type).toBe("a");
    expect(action?.props.href).toBe("/magaza/urun/sirena");
    expect(action?.props.onClick).toBeUndefined();
    expect(add).not.toHaveBeenCalled();
  });

  it("still adds a product without variants in one tap", async () => {
    const { add, action } = await card(base, { onOpen: true });
    expect(action?.props["aria-label"]).toBe("Bambu Chasen - sepete ekle");
    (action?.props.onClick as () => void)();
    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0]![0]).toMatchObject({
      productId: "prd-0100",
      price: 750,
      variantId: undefined,
    });
  });

  it("keeps a sold-out variant product's button disabled", async () => {
    const soldOut = { ...withVariants, stock: 0 };
    const { action } = await card(soldOut, { onOpen: true });
    expect(action?.props.disabled).toBe(true);
    expect(action?.props["aria-label"]).toBe("Sirena - tükendi");
  });
});

describe("toCartItem refuses a variant product without its variant", () => {
  it("returns no line without a variant, or with another product's", async () => {
    const { toCartItem } = await import("@/components/laffogato/ui");
    expect(toCartItem(withVariants)).toBeNull();
    expect(
      toCartItem(withVariants, { id: "v-other", name: "x", priceDelta: 0 }),
    ).toBeNull();
  });

  it("prices and caps the line by the chosen variant", async () => {
    const { toCartItem } = await import("@/components/laffogato/ui");
    const kg = withVariants.variants![1]!;
    expect(toCartItem(withVariants, kg)).toMatchObject({
      productId: "prd-0001",
      variantId: "v-1kg",
      variantName: "1 kg",
      price: 1350,
      maxStock: 2,
    });
  });

  it("treats a product whose variants are all inactive as a plain product", async () => {
    const { toCartItem } = await import("@/components/laffogato/ui");
    const off = {
      ...withVariants,
      variants: withVariants.variants!.map((v) => ({ ...v, isActive: false })),
    };
    expect(toCartItem(off)).toMatchObject({ variantId: undefined, price: 750 });
  });
});

describe("the shop page's featured set", () => {
  async function shop(products: Product[]): Promise<string> {
    const { PageShop } = await import("@/components/laffogato/shop-page");
    return renderToStaticMarkup(
      createElement(PageShop, {
        navigate: () => {},
        addToCart: () => {},
        openProduct: () => {},
        products,
      }),
    );
  }

  it("opens the featured set for its variant instead of adding it", async () => {
    const plain = await shop([featured]);
    expect(plain).toContain("Sepete ekle");
    const sold = await shop([{ ...featured, variants: withVariants.variants }]);
    expect(sold).toContain("Seçenekleri gör");
    expect(sold).not.toContain(">Sepete ekle<");
  });
});

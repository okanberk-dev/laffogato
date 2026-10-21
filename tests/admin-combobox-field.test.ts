import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Select, formatTRY } from "@/components/admin/forms";
import { markFieldErrors } from "@/components/admin/action-form";
import {
  manualProductOption,
  variantOption,
  type ManualProduct,
} from "@/components/admin/manual-order-form";
import { stockOptions } from "@/components/admin/stock-adjust-form";
import { ComboboxField } from "@/components/admin/ui/combobox-field";
import { DATE_WIDGETS_ENABLED } from "@/components/admin/ui/widget-loader";
import type { StockAdjustOption } from "@/lib/admin/stock-moves-panel";

/**
 * The searchable pickers (admin UI v2, UI-16). The page draws the native
 * select (server render, no JavaScript, the widget not fetched), so the
 * markup of the old select is the contract; the swap itself (the list, the
 * keys, the phone keyboard) is in the PR's browser checklist.
 */

const read = (path: string) => readFileSync(path, "utf8");

const stock: StockAdjustOption[] = [
  { id: "prd-1", name: "Şire", stock: 9, variants: [] },
  {
    id: "prd-2",
    name: "Fındık Ezmesi",
    stock: 7,
    variants: [
      { id: "v1", name: "250 g", stock: 4, isActive: true },
      { id: "v2", name: "500 g", stock: 3, isActive: false },
    ],
  },
  { id: "prd-3", name: "Çay", stock: 0, variants: [] },
];

describe("the native fallback", () => {
  it("renders the stock form's old select, byte for byte", () => {
    const old = createElement(
      Select,
      { name: "productId", defaultValue: "", required: true },
      createElement("option", { value: "", disabled: true }, "Ürün seç…"),
      createElement("option", { value: "prd-1" }, "Şire · stok 9"),
      createElement(
        "optgroup",
        { label: "Fındık Ezmesi · toplam 7" },
        createElement(
          "option",
          { value: "prd-2#v1" },
          "Fındık Ezmesi · 250 g · stok 4",
        ),
        createElement(
          "option",
          { value: "prd-2#v2" },
          "Fındık Ezmesi · 500 g · stok 3 · pasif",
        ),
      ),
      createElement("option", { value: "prd-3" }, "Çay · stok 0"),
    );
    const now = createElement(ComboboxField, {
      name: "productId",
      label: "Ürün",
      defaultValue: "",
      required: true,
      placeholder: "Ürün seç…",
      placeholderDisabled: true,
      options: stockOptions(stock),
    });
    const html = renderToStaticMarkup(now);
    expect(html).toBe(renderToStaticMarkup(old));
    expect(html).toContain('name="productId"');
    expect(html).toContain("<select");
    // The widget's own markup (a combobox, a hidden input) is not drawn.
    expect(html).not.toContain("combobox");
    expect(html).not.toContain('type="hidden"');
  });

  it("renders the manual order's old product and variant selects", () => {
    const products: ManualProduct[] = [
      {
        id: "p1",
        name: "Filtre Kahve",
        priceMinor: 25000,
        stock: 3,
        variants: [],
      },
      {
        id: "p2",
        name: "Kupa",
        priceMinor: 12000,
        stock: 0,
        variants: [
          { id: "a", name: "Mavi", priceDeltaMinor: 0, stock: 2 },
          { id: "b", name: "Büyük", priceDeltaMinor: 5000, stock: 0 },
        ],
      },
      { id: "p3", name: "Ham", priceMinor: 100, stock: 0, variants: [] },
    ];
    const oldProducts = renderToStaticMarkup(
      createElement(
        Select,
        { value: "", onChange: () => {} },
        createElement("option", { value: "" }, "Seç…"),
        createElement(
          "option",
          { value: "p1" },
          `Filtre Kahve · ${formatTRY(25000)} (stok: 3)`,
        ),
        createElement("option", { value: "p2" }, `Kupa · ${formatTRY(12000)}`),
        createElement(
          "option",
          { value: "p3", disabled: true },
          `Ham · ${formatTRY(100)} (tükendi)`,
        ),
      ),
    );
    // p2 sells by its variants, one is in stock; p3 has no stock at all.
    const options = products.map(manualProductOption);
    expect(options.map((o) => o.disabled)).toEqual([false, false, true]);
    const nowProducts = renderToStaticMarkup(
      createElement(ComboboxField, {
        label: "Ürün",
        placeholder: "Seç…",
        value: "",
        onChange: () => {},
        options,
      }),
    );
    expect(nowProducts).toBe(oldProducts);

    const variants = products[1].variants.map(variantOption);
    const oldVariants = renderToStaticMarkup(
      createElement(
        Select,
        { value: "a", onChange: () => {} },
        createElement("option", { value: "a" }, "Mavi (stok: 2)"),
        createElement(
          "option",
          { value: "b", disabled: true },
          `Büyük (+${formatTRY(5000)}) (tükendi)`,
        ),
      ),
    );
    const nowVariants = renderToStaticMarkup(
      createElement(ComboboxField, {
        label: "Varyant",
        value: "a",
        onChange: () => {},
        options: variants,
      }),
    );
    expect(nowVariants).toBe(oldVariants);

    // A product without variants: the disabled select with its dash.
    const oldNone = renderToStaticMarkup(
      createElement(
        Select,
        { value: "", disabled: true, onChange: () => {} },
        createElement("option", { value: "" }, "-"),
      ),
    );
    const nowNone = renderToStaticMarkup(
      createElement(ComboboxField, {
        label: "Varyant",
        placeholder: "-",
        value: "",
        disabled: true,
        onChange: () => {},
        options: [],
      }),
    );
    expect(nowNone).toBe(oldNone);
  });
});

describe("the forms keep their field names", () => {
  it("the stock form posts productId, delta and note, as the action reads them", () => {
    const form = read("src/components/admin/stock-adjust-form.tsx");
    const action = read("src/app/admin/stok-hareketleri/actions.ts");
    for (const name of ["productId", "delta", "note"]) {
      expect(form, name).toContain(`name="${name}"`);
      expect(action, name).toContain(`formData.get("${name}")`);
    }
    expect(form).toContain("<ComboboxField");
    expect(form).not.toContain("<Select");
  });

  it("the manual order's pickers post nothing of their own (the lines go in `items`)", () => {
    const form = read("src/components/admin/manual-order-form.tsx");
    expect(form).toContain('name="items"');
    const pickers = form.match(/<ComboboxField[\s\S]*?\/>/g) ?? [];
    expect(pickers.length).toBe(2);
    for (const picker of pickers) expect(picker).not.toContain("name=");
  });

  it("stock options post productId, or productId#variantId for a variant", () => {
    const options = stockOptions(stock);
    expect(options.map((o) => o.value)).toEqual([
      "prd-1",
      "prd-2#v1",
      "prd-2#v2",
      "prd-3",
    ]);
    expect(options[1].group).toBe("Fındık Ezmesi · toplam 7");
    expect(options[0].group).toBeUndefined();
  });
});

describe("the widget", () => {
  it("is switched on, and the picker's chunk keeps React Aria out of the form", () => {
    expect(DATE_WIDGETS_ENABLED).toBe(true);
    const field = read("src/components/admin/ui/combobox-field.tsx");
    expect(field).not.toContain("react-aria-components");
    expect(field).toContain('import("./combobox-picker")');
    const picker = read("src/components/admin/ui/combobox-picker.tsx");
    expect(picker).toContain('"use client"');
    expect(picker).toMatch(/from "react-aria-components\/ComboBox"/);
    expect(picker).not.toMatch(/from "react-aria-components"/);
    // The pop-over is drawn where overlay.ts says, never by hand.
    expect(picker).toContain("popoverPortal(portal)");
    expect(picker).not.toContain("UNSTABLE_");
  });

  it("names its visible box for the form's refusal marks", () => {
    const attrs = (init: Record<string, string>) => {
      const map = new Map(Object.entries(init));
      return {
        getAttribute: (n: string) => map.get(n) ?? null,
        setAttribute: (n: string, v: string) => void map.set(n, v),
        removeAttribute: (n: string) => void map.delete(n),
      };
    };
    // The hidden input carries the name and is skipped; the box carries
    // data-field-name and is marked, and so can take focus.
    const hidden = attrs({ name: "productId", type: "hidden" });
    const box = attrs({ "data-field-name": "productId" });
    const first = markFieldErrors(
      [hidden, box],
      { productId: "Ürünü seç." },
      (n) => `e-${n}`,
    );
    expect(first).toBe(box);
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(box.getAttribute("aria-describedby")).toBe("e-productId");
    expect(hidden.getAttribute("aria-invalid")).toBeNull();
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  contactAttributes,
  productBody,
  productCode,
  salesInvoiceBody,
  type ProductGroup,
} from "@/lib/invoice/invoice-core";
import { LEGAL_ENTITY } from "@/lib/legal/entity";

/**
 * What the site writes in Paraşüt, as docs/EARSIV.md §9 ("Panel bu
 * kayıtları okur") tells the köşk panel (RiosenBeq/lafmaliyet), which reads
 * the same Paraşüt company's purchase bills and incoming e-Faturas. The
 * panel tells the site's records apart by these facts: every contact is a
 * customer, every product code starts with LAF-, every sales invoice is an
 * `invoice`, and the site never cuts a return, a cancellation or a purchase
 * bill (the return document is cut by hand in Paraşüt). A change to any of
 * them changes what the panel sees: update §9 and tell the panel.
 */

const DOC = readFileSync("docs/EARSIV.md", "utf8");
const INVOICE_DIR = "src/lib/invoice";
const SOURCES = readdirSync(INVOICE_DIR)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => ({
    file: f,
    text: readFileSync(join(INVOICE_DIR, f), "utf8"),
  }));

// Every top-level resource of Paraşüt API v4 (spec/swagger.yaml, 5d48af8).
const PARASUT_RESOURCES = [
  "accounts",
  "bank_fees",
  "contacts",
  "e_archives",
  "e_invoice_inboxes",
  "e_invoices",
  "e_smms",
  "employees",
  "item_categories",
  "product",
  "products",
  "purchase_bills",
  "salaries",
  "sales_invoices",
  "sales_offers",
  "sharings",
  "shipment_documents",
  "stock_movements",
  "stock_updates",
  "tags",
  "taxes",
  "trackable_jobs",
  "transactions",
  "warehouses",
];

const billing = {
  city: "İstanbul",
  district: "Tuzla",
  address: "Postane Mah. Atatürk Cad. No 28",
};

describe("docs/EARSIV.md §9: what the panel reads", () => {
  it("the section is there and names the facts the panel relies on", () => {
    expect(DOC).toMatch(/^## 9\. Panel bu kayıtları okur/m);
    const section = DOC.slice(DOC.indexOf("## 9. Panel bu kayıtları okur"));
    for (const fact of [
      'account_type: "customer"',
      "`LAF-`",
      'item_type: "invoice"',
      'item_type: "refund"',
      "`purchase_bills`",
      'direction: "outbound"',
      'direction: "inbound"',
      "filter[account_type]=supplier",
      "filter[item_type]=purchase_bill",
      "relationships.category",
    ]) {
      expect(section, fact).toContain(fact);
    }
  });

  it("every contact the site opens is a customer, a consumer's and a company's", () => {
    const consumer = contactAttributes({
      name: "Eda Mancuso",
      email: "eda@example.com",
      billing,
    });
    const company = contactAttributes({
      name: "Eda Mancuso",
      email: "fatura@example.com",
      billing,
      buyer: {
        kind: "company",
        title: "Örnek Gıda Ticaret A.Ş.",
        taxNumber: LEGAL_ENTITY.taxNo,
        taxOffice: "Tuzla",
      },
    });
    expect(consumer.account_type).toBe("customer");
    expect(company.account_type).toBe("customer");
    // No marker of its own yet (§9.5): the panel goes by account_type.
    expect(consumer).not.toHaveProperty("category");
  });

  it("every product code starts with LAF-", () => {
    const groups: ProductGroup[] = ["KAFE", "MAGAZA", "TESLIMAT", "KARAOKE"];
    for (const g of groups) {
      for (const rate of [0, 10, 20]) {
        expect(productCode(g, rate)).toMatch(/^LAF-/);
        expect(productBody(g, rate).data.attributes.code).toMatch(/^LAF-/);
      }
    }
  });

  it("the sales invoice is an `invoice`, never a refund or a cancellation", () => {
    const si = salesInvoiceBody({
      marker: "L'Affogato #10234",
      note: "Sipariş no: 10234.",
      issueDate: "2026-10-23",
      orderNo: "10234",
      orderDate: "2026-10-23",
      contactId: "1",
      billing,
      lines: [],
      cashSale: null,
    });
    expect(si.data.attributes.item_type).toBe("invoice");
  });

  it("the site's Paraşüt paths are the ones §9.1 lists, and no return, cancel or purchase bill", () => {
    const literal = new RegExp(
      `["'\`](${PARASUT_RESOURCES.join("|")})(?=[/"'\`?])`,
      "g",
    );
    const used = new Set<string>();
    for (const { text } of SOURCES) {
      for (const m of text.matchAll(literal)) used.add(m[1]);
    }
    expect([...used].sort()).toEqual(
      [
        "contacts",
        "e_archives",
        "e_invoice_inboxes",
        "e_invoices",
        "products",
        "sales_invoices",
        "trackable_jobs",
      ].sort(),
    );
    for (const { file, text } of SOURCES) {
      expect(text, file).not.toMatch(/\/cancel\b/);
      expect(text, file).not.toMatch(/item_type:\s*["'`]refund/);
      expect(text, file).not.toMatch(/sales_returns|purchase_bills/);
    }
    // §9.1's table names each of them.
    for (const path of used) expect(DOC, path).toContain(path);
  });
});

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
      "relationships.category",
    ]) {
      expect(section, fact).toContain(fact);
    }
  });

  it("tells the panel what it actually reads: the e_invoices list and every purchase bill", () => {
    const between = (from: string, to: string) =>
      DOC.slice(DOC.indexOf(from), DOC.indexOf(to));
    const s93 = between("### 9.3 ", "### 9.4 ");
    const s94 = between("### 9.4 ", "### 9.5 ");
    // The panel lists inbound e-Faturas with `GET e_invoices` (lafmaliyet
    // src/server/parasut/einvoice.ts; the backticked token, not §9.1's
    // `GET e_invoices/{id}/pdf`): a company's return e-Fatura reaches it
    // there even if never imported, so §9.4 must name it (rule 5).
    expect(s93).not.toMatch(/için liste(leme)? ucu (yoktur|bulunmaz)/);
    expect(s93).toContain("`GET e_invoices` listesinde");
    expect(s93).toContain("panel gelen e-Faturaları onunla okur");
    expect(s94).toMatch(/^5\. \*\*Gelen iade e-Faturası/m);
    for (const fact of ['invoice_type_code:\n   "IADE"', "from_vkn"]) {
      expect(s94.replace(/\n\s+/g, " "), fact).toContain(
        fact.replace(/\n\s+/g, " "),
      );
    }
    // Rule 1 (lafmaliyet src/server/parasut/sync.ts, RECHECK_LIMIT and
    // retire): the panel sees a cancellation in the list and by re-reading
    // the records the list no longer shows, 8 per run, only after a fresh
    // complete round, within the sync window (older ones only if unpaid).
    // A filter leaves both to that narrow re-read, so the doc must not
    // advise it, nor claim the filter stops the cleanup outright, nor that
    // every record is deleted (Excel and manual ones are unlinked).
    expect(s94).not.toMatch(
      /okuması `filter\[item_type\]=purchase_bill` ile yapılmalı/,
    );
    expect(s94).toMatch(/\*\*süzülmeden\*\* okunmaya devam etmeli/);
    const flat94 = s94.replace(/\n\s+/g, " ");
    expect(flat94).toContain('item_type: "cancelled"');
    expect(flat94).toContain("`GET purchase_bills/{id}`");
    const rule1 = flat94.slice(
      flat94.indexOf("1. **`purchase_bills`"),
      flat94.indexOf("2. **Karşı tarafın"),
    );
    for (const claim of [
      "~75 gün geride durur (eşitleme penceresi)",
      "yalnız bu pencere içindeyse ve yalnız yarıda kalıp sürdürülmemiş tam bir turdan sonra yeniden okunur",
      "pencereden eski kayıtlardan yalnız ödenmemiş olanlar",
      "çalıştırma başına en çok 8 kayıt",
      "Paraşüt'ten açtığı kaydı siler",
      "bağını çözüp kontrol notu düşer",
      "varsayılan listede gelip gelmediği doğrulanmadı",
      "yalnız bu dar yeniden okumaya bırakır; kullanılmamalıdır",
      "`refund`'lar ödenmiş açılır",
      "günlük eşitleme süzgeçle de süzgeçsiz de görmez",
      '"Tarihten eşitle" düğmesi, kayıttan önceki bir tarihle, görür',
      '"Oturumu sıfırla" pencereyi `PARASUT_SYNC_FROM`\'a ya da yılbaşına çeker, genişletmez',
    ]) {
      expect(rule1, claim).toContain(claim);
    }
    // The wrong claims of earlier versions, in any wording: the filter
    // "stops" (keser) the cleanup, may be used, the panel never re-reads,
    // or both paths delete every record.
    expect(rule1).not.toMatch(
      /keser|kullanılabilir|okunabilir|yeniden okumaz/i,
    );
    expect(rule1).not.toMatch(/[iİ]ki yolda da[^.]*siler/);
    expect(rule1).not.toMatch(/listede her zaman gelir/i);
    // "Oturumu sıfırla" resets the window to PARASUT_SYNC_FROM or 1 January
    // (lafmaliyet sync.ts windowStart): it widens nothing, re-reads nothing.
    expect(rule1).not.toMatch(
      /"Oturumu sıfırla"[^.;]*(genişletir|baştan okur|yakalar|görür)/,
    );
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

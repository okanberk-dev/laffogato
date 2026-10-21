import { describe, expect, it } from "vitest";

import { detectDelimiter, parseCsv, toCsv } from "@/lib/admin/csv";
import {
  importColumnFor,
  parseActiveCell,
  parseCountCell,
  PRODUCT_IMPORT_COLUMNS,
  productImportTemplate,
} from "@/lib/admin/product-import-core";

/**
 * The repo's own RFC 4180 reader (no dependency): what a spreadsheet saves,
 * read the way the product import needs it.
 */

function cells(text: string) {
  const r = parseCsv(text);
  if (!r.ok) throw new Error(r.error);
  return r.records.map((rec) => rec.cells);
}

describe("parseCsv", () => {
  it("reads quoted cells holding the delimiter, quotes and line breaks", () => {
    const text =
      'sku,name,description\r\nA-1,"Moka, 3 fincan","Klasik ""moka""\r\nikinci satır"\r\n';
    expect(cells(text)).toEqual([
      ["sku", "name", "description"],
      ["A-1", "Moka, 3 fincan", 'Klasik "moka"\nikinci satır'],
    ]);
  });

  it("drops the byte order mark Excel writes", () => {
    const r = parseCsv("﻿sku;name\r\nA-1;Çay Bardağı\r\n");
    expect(r.ok && r.records[0].cells).toEqual(["sku", "name"]);
    expect(r.ok && r.records[1].cells[1]).toBe("Çay Bardağı");
  });

  it("picks ; or , from the first record", () => {
    expect(detectDelimiter("sku;name;price\nA;B;129,90")).toBe(";");
    expect(detectDelimiter("sku,name,price\nA,B,129.90")).toBe(",");
    expect(detectDelimiter('﻿\r\n"a;b",c,d\n')).toBe(",");
    // With ;, a decimal comma needs no quotes.
    expect(cells("sku;price\nA;129,90\n")[1]).toEqual(["A", "129,90"]);
    // With ,, it does.
    expect(cells('sku,price\nA,"129,90"\n')[1]).toEqual(["A", "129,90"]);
  });

  it("takes CRLF, LF and a lone CR between records", () => {
    expect(cells("a;b\r\n1;2\n3;4\r5;6")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
  });

  it("skips empty lines and lines of empty cells, and keeps the line numbers true", () => {
    const r = parseCsv('sku;name\r\n\r\n;;\r\nA;"iki\r\nsatır"\r\n\r\nB;x\r\n');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.records.map((x) => [x.line, x.cells[0]])).toEqual([
      [1, "sku"],
      [4, "A"],
      [7, "B"],
    ]);
  });

  it("keeps an empty last cell and a record without a final line break", () => {
    expect(cells("a;b;c\n1;;\n2;x;y")).toEqual([
      ["a", "b", "c"],
      ["1", "", ""],
      ["2", "x", "y"],
    ]);
  });

  it("refuses a quote that never closes, naming its line", () => {
    const r = parseCsv('sku;name\nA;"açık kaldı\nB;x\n');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.line).toBe(2);
    expect(r.error).toContain("2. satırda açılan tırnak kapanmamış");
  });

  it("refuses text after a closing quote, but allows spaces", () => {
    expect(cells('a;b\n"x"  ;y\n')[1]).toEqual(["x", "y"]);
    const r = parseCsv('a;b\n"x"z;y\n');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.line).toBe(2);
  });

  it("keeps a quote inside an unquoted cell as written", () => {
    expect(cells('a;b\n12" pizza;y\n')[1]).toEqual(['12" pizza', "y"]);
  });

  it("reads back what toCsv writes", () => {
    const rows = [
      ["sku", "description"],
      ["A;1", 'Bir "alıntı"\nve satır'],
    ];
    const text = toCsv(rows, ";", { bom: true });
    expect(text.startsWith("﻿")).toBe(true);
    expect(text.endsWith("\r\n")).toBe(true);
    expect(cells(text)).toEqual(rows);
  });
});

describe("the template", () => {
  it("is UTF-8 with a BOM, ; separated, a header and one example row", () => {
    const text = productImportTemplate("Kahve çekirdeği");
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const r = parseCsv(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.delimiter).toBe(";");
    expect(r.records).toHaveLength(2);
    expect(r.records[0].cells).toEqual(
      PRODUCT_IMPORT_COLUMNS.map((c) => c.key),
    );
    const example = Object.fromEntries(
      r.records[0].cells.map((k, i) => [k, r.records[1].cells[i]]),
    );
    expect(example.category).toBe("Kahve çekirdeği");
    expect(example.price).toBe("129,90");
  });

  it("writes a category label that looks like a formula as text", () => {
    // A manager may name a category; the owner opens the template in Excel.
    const text = productImportTemplate('=HYPERLINK("https://x.test","Aç")');
    const r = parseCsv(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const at = r.records[0].cells.indexOf("category");
    expect(r.records[1].cells[at]).toBe(`'=HYPERLINK("https://x.test","Aç")`);
    for (const lead of ["+", "-", "@"]) {
      const row = parseCsv(productImportTemplate(`${lead}1`));
      if (!row.ok) throw new Error("parse");
      expect(row.records[1].cells[at]).toBe(`'${lead}1`);
    }
  });
});

describe("headers and small cells", () => {
  it("maps the template keys and their Turkish names", () => {
    expect(importColumnFor("sku")).toBe("sku");
    expect(importColumnFor(" compareAtPrice ")).toBe("compareAtPrice");
    expect(importColumnFor("Eski fiyat")).toBe("compareAtPrice");
    expect(importColumnFor("Ürün adı")).toBe("name");
    expect(importColumnFor("KDV ORANI")).toBe("taxRatePct");
    expect(importColumnFor("Açıklama")).toBe("description");
    expect(importColumnFor("Ağırlık")).toBe("weight");
    expect(importColumnFor("renk")).toBeNull();
  });

  it("reads Aktif the ways people write it", () => {
    for (const t of ["evet", "Evet", "1", "aktif", "AÇIK", "true"]) {
      expect(parseActiveCell(t), t).toBe(true);
    }
    for (const f of ["hayır", "HAYIR", "0", "pasif", "kapalı", "false"]) {
      expect(parseActiveCell(f), f).toBe(false);
    }
    expect(parseActiveCell("  ")).toBeNull();
    expect(parseActiveCell("belki")).toBe("invalid");
  });

  it("reads stock and weight as whole numbers only", () => {
    expect(parseCountCell(" 24 ")).toEqual({ ok: true, value: 24 });
    expect(parseCountCell("")).toEqual({ ok: true, value: null });
    for (const bad of ["-3", "1,5", "1.000", "on", "+2"]) {
      expect(parseCountCell(bad).ok, bad).toBe(false);
    }
    expect(parseCountCell("100001").ok).toBe(false);
  });
});

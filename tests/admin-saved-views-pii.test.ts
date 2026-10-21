import { describe, expect, it } from "vitest";

import { ORDER_FILTER_FIELDS } from "@/lib/admin/order-filters";
import {
  cleanViewName,
  defaultViewHref,
  NO_SAVED_VIEWS,
  parseSavedViews,
  saveView,
  SAVED_VIEWS_MAX,
  serializeSavedViews,
  viewQuery,
  viewRulesFor,
  viewsMenu,
} from "@/lib/admin/saved-views";

/**
 * A stored view must not carry a person (admin UI v2, UI-11): every way the
 * independent review of PR #190 found to smuggle an e-mail, a phone or a
 * name into one, and to break the name and count limits. Rules under test:
 * lib/admin/saved-views.ts. Invisible and look-alike characters are
 * written as escapes.
 */

const ORDERS = { searchNames: ["q"], pageParam: "sayfa" } as const;
/** What the view keeps of a raw query string (as the browser address reads it). */
const kept = (raw: string) => viewQuery(new URLSearchParams(raw), ORDERS);
/** The same with the menu's own rules: the list's names only. */
const MENU = viewRulesFor(ORDER_FILTER_FIELDS, "sayfa");
const keptByMenu = (raw: string) => viewQuery(new URLSearchParams(raw), MENU);

describe("PII that never reaches a stored view", () => {
  it("Turkish phone spellings (spaces, dashes, dots, brackets, +90, NBSP, full-width)", () => {
    for (const phone of [
      "05321234567",
      "0532 123 45 67",
      "0532-123-45-67",
      "0532.123.45.67",
      "(0532) 123 45 67",
      "+90 532 123 45 67",
      "+90(532)123-45-67",
      "0090 532 123 45 67",
      "532 123 4567",
      "0 5 3 2 1 2 3 4 5 6 7",
      "0532\u00a0123\u00a045\u00a067",
      "0532\u2009123\u202f45\u202f67",
      "\uff10\uff15\uff13\uff12\uff11\uff12\uff13\uff14\uff15\uff16\uff17",
      "0532\u2013123\u201445\u221267",
    ]) {
      expect(kept(`durum=acik&kanal=${encodeURIComponent(phone)}`), phone).toBe(
        "durum=acik",
      );
    }
  });

  it("an e-mail in a value, percent-encoded, or in a param name", () => {
    expect(kept("durum=acik&kanal=a%40b.co")).toBe("durum=acik");
    expect(kept("durum=acik&kanal=a@b.co")).toBe("durum=acik");
    expect(kept("durum=acik&kanal=a%EF%BC%A0b.co")).toBe("durum=acik"); // full-width @
    expect(kept("durum=acik&ali%40x.com=1")).toBe("durum=acik");
    expect(kept("durum=acik&ali@x.com=1")).toBe("durum=acik");
    expect(kept("durum=acik&p05321234567=1")).toBe("durum=acik");
    expect(kept("durum=acik&a%2Eb=1")).toBe("durum=acik"); // odd name
  });

  it("a date range, the search, the page and the one-time notice", () => {
    expect(
      kept("durum=acik&bas=2026-10-01&bit=2026-10-19&q=ayse&sayfa=3&denied=1"),
    ).toBe("durum=acik");
  });

  it("a customer page path (the URL carries the e-mail) as a value", () => {
    expect(
      kept(
        `durum=acik&geri=${encodeURIComponent("/admin/musteriler/ali@x.com")}`,
      ),
    ).toBe("durum=acik");
  });

  it("a stored entry that tries the same is cleaned on the way back", () => {
    const raw = JSON.stringify({
      views: [
        { name: "A", query: "durum=acik&kanal=0532+123+45+67" },
        { name: "B", query: "durum=paid&x=a%40b.co" },
      ],
      default: "durum=paid&x=a%40b.co",
    });
    const state = parseSavedViews(raw, ORDERS);
    expect(state.views).toEqual([
      { name: "A", query: "durum=acik" },
      { name: "B", query: "durum=paid" },
    ]);
    expect(state.defaultQuery).toBe("durum=paid");
  });
});

describe("what piiLike alone let through, closed by the value rule", () => {
  // The review found these kept: piiLike reads `@` and seven digits once a
  // phone's usual separators go, not a slash, an underscore, a comma or a
  // second percent-encoding. A value now holds only what a list's controls
  // write (letters, digits, `_`, `-`) and no run of seven digits.
  it("a phone with slash, underscore or comma separators", () => {
    expect(kept("kanal=0532/123/45/67")).toBe("");
    expect(kept("kanal=0532_123_45_67")).toBe("");
    expect(kept("kanal=0532,123,45,67")).toBe("");
    expect(kept("kanal=0532-123_45-67&durum=acik")).toBe("durum=acik");
  });

  it("a doubly percent-encoded e-mail (and so a customer page path)", () => {
    expect(kept("kanal=a%2540b.co")).toBe("");
    const path = encodeURIComponent("/admin/musteriler/ali%40x.com");
    expect(kept(`geri=${path}`)).toBe("");
  });

  it("a name or an address as a value", () => {
    expect(kept("durum=acik&musteri=Ayse+Yilmaz")).toBe("durum=acik");
    expect(kept("durum=acik&geri=https%3A%2F%2Fexample.com")).toBe(
      "durum=acik",
    );
  });

  it("what the list's own controls write is kept as it was", () => {
    expect(
      kept(
        "durum=pending_payment&kanal=manuel&dikkat=1&sirala=musteri&yon=desc",
      ),
    ).toBe(
      "dikkat=1&durum=pending_payment&kanal=manuel&sirala=musteri&yon=desc",
    );
    expect(kept("no=123456")).toBe("no=123456");
  });
});

describe("the menu keeps only the list's own names", () => {
  it("its filters, its tab and its sort, nothing else", () => {
    expect(
      keptByMenu(
        "durum=acik&kanal=app&tur=cafe&teslimat=table&odeme=odendi&dikkat=1&sirala=tarih&yon=asc",
      ),
    ).toBe(
      "dikkat=1&durum=acik&kanal=app&odeme=odendi&sirala=tarih&teslimat=table&tur=cafe&yon=asc",
    );
  });

  it("an unknown name goes, whatever its value: a letters-only name too", () => {
    expect(keptByMenu("durum=acik&musteri=AyseYilmaz")).toBe("durum=acik");
    expect(keptByMenu("durum=acik&x=1&f2=web&no=123456")).toBe("durum=acik");
    expect(keptByMenu("musteri=AyseYilmaz")).toBe("");
  });

  it("a stored view is read back through the same names", () => {
    const raw = JSON.stringify({
      views: [{ name: "A", query: "durum=acik&musteri=AyseYilmaz" }],
      default: "durum=acik&musteri=AyseYilmaz",
    });
    expect(parseSavedViews(raw, MENU)).toEqual({
      views: [{ name: "A", query: "durum=acik" }],
      defaultQuery: "durum=acik",
    });
  });
});

describe("the name rule", () => {
  it("30 code points, not UTF-16 units: an emoji counts as one", () => {
    const thumb = "\u{1F44D}";
    expect(cleanViewName(thumb.repeat(30))).toEqual({
      ok: true,
      name: thumb.repeat(30),
    });
    expect(cleanViewName(thumb.repeat(31)).ok).toBe(false);
    // The input's maxLength={30} counts UTF-16 units: 15 such emoji at most.
    expect(thumb.repeat(15).length).toBe(30);
  });

  it("whitespace-only and invisible-only names are refused", () => {
    for (const raw of [
      "",
      "   ",
      "\t\n",
      "\u3000",
      "\u200b\u200d\u2060",
      "\u202e",
      "\ufeff",
    ]) {
      expect(cleanViewName(raw).ok, JSON.stringify(raw)).toBe(false);
    }
  });

  it("combining marks: composed by NFKC, a long run is too long", () => {
    const name = "Sipariş\u0301";
    expect(cleanViewName(name)).toEqual({
      ok: true,
      name: name.normalize("NFKC"),
    });
    expect(cleanViewName(`a${"\u0301".repeat(40)}`).ok).toBe(false);
  });

  it("a ZWJ emoji sequence loses its joiners (U+200D is Cf)", () => {
    const family = "\u{1F468}\u200d\u{1F469}\u200d\u{1F467}";
    expect(cleanViewName(family)).toEqual({
      ok: true,
      name: "\u{1F468}\u{1F469}\u{1F467}",
    });
  });

  it("names that render blank but are not whitespace pass (U+2800, U+3164)", () => {
    expect(cleanViewName("\u2800").ok).toBe(true);
    expect(cleanViewName("\u3164").ok).toBe(true);
  });

  it("an e-mail or phone in the name is refused, spelled any way piiLike reads", () => {
    for (const raw of [
      "ali@x.com",
      "Ayşe 0532 123 45 67",
      "+90 (532) 123-45-67",
      "ali\uff20x.com",
    ]) {
      expect(cleanViewName(raw).ok, raw).toBe(false);
    }
  });
});

describe("eight, and one name and one query per view", () => {
  const TABS = [
    "acik",
    "pending_payment",
    "paid",
    "preparing",
    "shipped",
    "completed",
    "cancelled",
    "refunded",
  ];
  const full = () => {
    let s = NO_SAVED_VIEWS;
    TABS.forEach((t, i) => {
      const r = saveView(s, `V${i}`, `durum=${t}`);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    });
    return s;
  };

  it("a ninth is refused, whatever the name's case or spelling", () => {
    const s = full();
    expect(s.views).toHaveLength(SAVED_VIEWS_MAX);
    expect(saveView(s, "V9", "durum=acik&kanal=app").ok).toBe(false);
    // The same name in another case overwrites instead (no ninth).
    const over = saveView(s, "v0", "durum=acik&kanal=app");
    expect(over.ok && over.state.views.length).toBe(8);
    // Turkish İ/i/ı fold: "İADE" is "iade".
    const a = saveView(NO_SAVED_VIEWS, "iade", "durum=refunded");
    const b = a.ok ? saveView(a.state, "İADE", "durum=cancelled") : a;
    expect(b.ok && b.state.views).toEqual([
      { name: "İADE", query: "durum=cancelled" },
    ]);
  });

  it("storage with twenty entries, duplicates and junk reads back as at most eight distinct views", () => {
    const SORTS = ["no", "tarih", "tutar", "musteri"];
    const CHANNELS = ["web", "app", "manuel"];
    const views = [
      ...Array.from({ length: 20 }, (_, i) => ({
        name: `N${i}`,
        query: `durum=acik&sirala=${SORTS[i % 4]}&yon=${i % 2 ? "asc" : "desc"}&kanal=${CHANNELS[i % 3]}`,
      })),
      { name: "n0", query: "durum=paid" },
      { name: 42, query: "durum=paid" },
      "junk",
    ];
    const state = parseSavedViews(JSON.stringify({ views }), ORDERS);
    expect(state.views.length).toBeLessThanOrEqual(8);
    expect(new Set(state.views.map((v) => v.query)).size).toBe(
      state.views.length,
    );
    expect(new Set(state.views.map((v) => v.name.toLowerCase())).size).toBe(
      state.views.length,
    );
    // Round trip is stable.
    expect(parseSavedViews(serializeSavedViews(state), ORDERS)).toEqual(state);
  });
});

describe("a stored view never leaves the list's own path", () => {
  it("hostile stored queries and defaults give hrefs under /admin/siparisler only", () => {
    const raw = JSON.stringify({
      views: [
        { name: "a", query: "//evil.example/x?durum=paid" },
        { name: "b", query: "https://evil.example/?durum=paid" },
        { name: "c", query: "durum=paid#//evil.example" },
        { name: "d", query: "durum=acik&next=//evil.example" },
        { name: "e", query: "durum=shipped&javascript:alert(1)=1" },
      ],
      default: "durum=acik&next=//evil.example",
    });
    const state = parseSavedViews(raw, ORDERS);
    const menu = viewsMenu(state, "/admin/siparisler", "");
    for (const entry of menu.entries) {
      expect(entry.href.startsWith("/admin/siparisler?"), entry.href).toBe(
        true,
      );
      expect(entry.href.indexOf("?")).toBe("/admin/siparisler".length);
      expect(entry.href.slice(1).includes("//")).toBe(false);
      expect(entry.href.includes("#")).toBe(false);
    }
    const target = defaultViewHref(state, "/admin/siparisler", {}, false);
    expect(target).not.toBeNull();
    expect(target!.startsWith("/admin/siparisler?")).toBe(true);
    // The address-like value does not survive at all now (the value rule).
    expect(target).toBe("/admin/siparisler?durum=acik");
  });
});

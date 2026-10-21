import { describe, expect, it } from "vitest";

import {
  filterOptions,
  matchesOption,
  optionRuns,
  type ComboboxOption,
} from "@/lib/admin/option-filter";

/**
 * What the panel's searchable pickers do with what is typed (admin UI v2,
 * UI-16): the fold is the palette's, so a phone keyboard without Turkish
 * letters finds the Turkish names.
 */

describe("matchesOption", () => {
  it("finds a letter with a mark by the plain one", () => {
    expect(matchesOption("Şire · 250 g", "sire")).toBe(true);
    expect(matchesOption("Fındık Ezmesi", "findik")).toBe(true);
    expect(matchesOption("Çay", "cay")).toBe(true);
    expect(matchesOption("Gömlek", "gomlek")).toBe(true);
  });

  it("meets every spelling of the I family, either side", () => {
    expect(matchesOption("İçecek", "icecek")).toBe(true);
    expect(matchesOption("IRMAK", "ırmak")).toBe(true);
    expect(matchesOption("Irmak", "IRMAK")).toBe(true);
    expect(matchesOption("ısı", "ISI")).toBe(true);
    // A decomposed capital İ (I and a combining dot) is an i too.
    expect(matchesOption("İngiliz", "ingiliz")).toBe(true);
  });

  it("needs every word, in any order, anywhere in the text", () => {
    expect(matchesOption("Şire · 250 g · stok 4", "250 sire")).toBe(true);
    expect(matchesOption("Şire · 250 g · stok 4", "sire 500")).toBe(false);
    expect(matchesOption("Şire · 250 g", "ire")).toBe(true);
  });

  it("matches everything for an empty query and nothing for a stranger", () => {
    expect(matchesOption("Şire", "")).toBe(true);
    expect(matchesOption("Şire", "   ")).toBe(true);
    expect(matchesOption("Şire", "kahve")).toBe(false);
  });
});

describe("filterOptions", () => {
  const options: ComboboxOption[] = [
    { value: "a", label: "Şire · 250 g" },
    { value: "b", label: "Fındık Ezmesi", disabled: true },
    { value: "c", label: "Filtre Kahve" },
  ];

  it("keeps the matching options in their own order", () => {
    expect(filterOptions(options, "fi").map((o) => o.value)).toEqual([
      "b",
      "c",
    ]);
    expect(filterOptions(options, "sire").map((o) => o.value)).toEqual(["a"]);
    expect(filterOptions(options, "").length).toBe(3);
    expect(filterOptions(options, "zzz")).toEqual([]);
  });
});

describe("optionRuns", () => {
  it("joins neighbours of a group and keeps ungrouped options apart", () => {
    const runs = optionRuns([
      { value: "1", label: "1" },
      { value: "2", label: "2", group: "G" },
      { value: "3", label: "3", group: "G" },
      { value: "4", label: "4" },
      { value: "5", label: "5", group: "G" },
    ]);
    expect(runs.map((r) => [r.group, r.options.map((o) => o.value)])).toEqual([
      [null, ["1"]],
      ["G", ["2", "3"]],
      [null, ["4"]],
      ["G", ["5"]],
    ]);
  });
});

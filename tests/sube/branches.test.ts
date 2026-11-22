import { describe, expect, it } from "vitest";

import {
  branchLabel,
  branchOf,
  callerBranches,
  chooseBranch,
  HOME_BRANCH,
  isBranchId,
  KARAOKE_BRANCH,
  siteBranches,
  splitBranch,
} from "@/lib/panel/branches";

// src/lib/panel/branches.ts: hangi imzalı çağıran hangi şube adına okur ve
// yazar (docs/LAFPOS.md "Şube").

const NONE: Record<string, string | undefined> = {};

describe("şube kimliği", () => {
  it("lafmaliyet'in kuralı: harfle başlar, küçük harf / rakam / tire, 2-24", () => {
    expect(isBranchId("tuzla")).toBe(true);
    expect(isBranchId("marina")).toBe(true);
    expect(isBranchId("laffogato-marina")).toBe(true);
    expect(isBranchId("t")).toBe(false);
    expect(isBranchId("Tuzla")).toBe(false);
    expect(isBranchId("1tuzla")).toBe(false);
    expect(isBranchId("tuzla marina")).toBe(false);
    expect(isBranchId("a".repeat(25))).toBe(false);
    expect(isBranchId(42)).toBe(false);
  });

  it("şubesiz satır Tuzla'nın (dalgadan önce yazılan her şey)", () => {
    expect(branchOf({})).toBe("tuzla");
    expect(branchOf(null)).toBe("tuzla");
    expect(branchOf({ branch: "" })).toBe("tuzla");
    expect(branchOf({ branch: "marina" })).toBe("marina");
    expect(HOME_BRANCH).toBe("tuzla");
    expect(KARAOKE_BRANCH).toBe("tuzla");
  });

  it("adlar", () => {
    expect(branchLabel("tuzla")).toBe("Tuzla");
    expect(branchLabel("marina")).toBe("Marina");
    expect(branchLabel("kadikoy")).toBe("Kadikoy");
  });
});

describe("siteBranches", () => {
  it("varsayılan Tuzla ve Marina", () => {
    expect(siteBranches(NONE)).toEqual(["tuzla", "marina"]);
  });

  it("SITE_BRANCHES yeni şube ekler; Tuzla her zaman listede", () => {
    expect(siteBranches({ SITE_BRANCHES: "marina, kadikoy" })).toEqual([
      "tuzla",
      "marina",
      "kadikoy",
    ]);
    expect(siteBranches({ SITE_BRANCHES: "Bozuk Ad,,!" })).toEqual([
      "tuzla",
      "marina",
    ]);
  });
});

describe("callerBranches ve chooseBranch", () => {
  it("panel her şube adına konuşabilir, söylemezse Tuzla", () => {
    expect(callerBranches(NONE, "panel")).toEqual(["tuzla", "marina"]);
    expect(chooseBranch(NONE, "panel", undefined)).toEqual({
      ok: true,
      branch: "tuzla",
    });
    expect(chooseBranch(NONE, "panel", "marina")).toEqual({
      ok: true,
      branch: "marina",
    });
  });

  it("LafPOS'un anahtarı yalnız kendi şubesi: varsayılan Marina", () => {
    expect(callerBranches(NONE, "lafpos")).toEqual(["marina"]);
    expect(chooseBranch(NONE, "lafpos", null)).toEqual({
      ok: true,
      branch: "marina",
    });
    expect(chooseBranch(NONE, "lafpos", "")).toEqual({
      ok: true,
      branch: "marina",
    });
    // Marina'nın kasası Tuzla'nın siparişlerini isteyemez.
    expect(chooseBranch(NONE, "lafpos", "tuzla")).toEqual({
      ok: false,
      status: 403,
      error: "forbidden",
      field: "branch",
    });
  });

  it("LAFPOS_BRANCHES ikinci kasayı açar; ilk ad varsayılandır", () => {
    const env = { LAFPOS_BRANCHES: "tuzla,marina" };
    expect(callerBranches(env, "lafpos")).toEqual(["tuzla", "marina"]);
    expect(chooseBranch(env, "lafpos", undefined)).toEqual({
      ok: true,
      branch: "tuzla",
    });
    expect(chooseBranch(env, "lafpos", "marina")).toEqual({
      ok: true,
      branch: "marina",
    });
  });

  it("sitenin bilmediği LAFPOS_BRANCHES kasayı hiçbir şubeye açmaz", () => {
    const env = { LAFPOS_BRANCHES: "kadikoy" };
    expect(callerBranches(env, "lafpos")).toEqual([]);
    expect(chooseBranch(env, "lafpos", undefined)).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("bozuk ya da bilinmeyen şube 400 invalid", () => {
    for (const raw of ["Marina", "x", "kadikoy", 7, { a: 1 }]) {
      expect(chooseBranch(NONE, "panel", raw)).toEqual({
        ok: false,
        status: 400,
        error: "invalid",
        field: "branch",
      });
    }
  });
});

describe("splitBranch", () => {
  it("branch alanını gövdeden ayırır, gerisi eski katı şemaya gider", () => {
    expect(splitBranch({ id: "a", branch: "marina", actor: "S" })).toEqual({
      branch: "marina",
      rest: { id: "a", actor: "S" },
    });
    expect(splitBranch({ id: "a" })).toEqual({
      branch: undefined,
      rest: { id: "a" },
    });
    expect(splitBranch([1])).toEqual({ branch: undefined, rest: [1] });
    expect(splitBranch("x")).toEqual({ branch: undefined, rest: "x" });
  });
});

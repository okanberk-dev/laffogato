import { beforeEach, describe, expect, it, vi } from "vitest";

import { signedHeaders, verifySignature } from "@/lib/panel/karaoke-sync-core";
import {
  lafposPreviousSyncSecret,
  lafposSyncSecret,
  SIGNED_KEY_HEADER,
  signedBy,
  signedCaller,
  signedCallerKeys,
  signedKeyHeader,
  type SignedCallerKeys,
} from "@/lib/panel/signed-callers";

// LafPOS'un önceki anahtarı (`LAFPOS_SYNC_SECRET_ONCEKI`, 27 Kas 2026):
// anahtar değişirken kasa eski değerle de, yeni değerle de kabul edilir
// (docs/LAFPOS.md "Anahtarı değiştirmek"). Kural src/lib/panel/signed-callers.ts.

// Kaç anahtarın denendiğini saymak için doğrulama sarılır; davranışı aynen.
vi.mock("@/lib/panel/karaoke-sync-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/panel/karaoke-sync-core")>();
  return { ...actual, verifySignature: vi.fn(actual.verifySignature) };
});

const PANEL_KEY = "panel-key-for-tests-0123456789-abcdefghij";
const NEW_KEY = "lafpos-new-key-for-tests-0123456789-abcdefghij";
const OLD_KEY = "lafpos-old-key-for-tests-0123456789-abcdefghij";
const OTHER_KEY = "someone-elses-key-for-tests-0123456789-abcdef";
const BASE = "https://laffogato.net";

const BOTH = ["panel", "lafpos"] as const;
const LAFPOS_ONLY = ["lafpos"] as const;

function request(
  key: string,
  path = "/api/pos/orders/version",
  nowMs?: number,
): { headers: Headers } {
  const url = new URL(path, BASE);
  return { headers: new Headers(signedHeaders(key, "GET", url, "", nowMs)) };
}

function callerOf(
  keys: SignedCallerKeys,
  req: { headers: Headers },
  path = "/api/pos/orders/version",
) {
  return signedCaller(keys, req, "GET", new URL(path, BASE), "");
}

const ROTATING = {
  KARAOKE_SYNC_SECRET: PANEL_KEY,
  LAFPOS_SYNC_SECRET: NEW_KEY,
  LAFPOS_SYNC_SECRET_ONCEKI: OLD_KEY,
};

beforeEach(() => {
  vi.mocked(verifySignature).mockClear();
});

describe("lafposPreviousSyncSecret", () => {
  it("bugünkünün kurallarıyla: kırpılır, 32 karakterden kısası yok sayılır", () => {
    expect(
      lafposPreviousSyncSecret({ LAFPOS_SYNC_SECRET_ONCEKI: `  ${OLD_KEY}\n` }),
    ).toBe(OLD_KEY);
    expect(lafposPreviousSyncSecret({})).toBeNull();
    expect(
      lafposPreviousSyncSecret({ LAFPOS_SYNC_SECRET_ONCEKI: "a".repeat(31) }),
    ).toBeNull();
    expect(
      lafposPreviousSyncSecret({ LAFPOS_SYNC_SECRET_ONCEKI: "a".repeat(32) }),
    ).toBe("a".repeat(32));
    // Bugünkünün okunuşu değişmedi.
    expect(lafposSyncSecret(ROTATING)).toBe(NEW_KEY);
  });
});

describe("signedCallerKeys: önceki değer", () => {
  it("önceki değer yokken bugünkü gibi: LafPOS'un tek anahtarı", () => {
    expect(
      signedCallerKeys(
        { KARAOKE_SYNC_SECRET: PANEL_KEY, LAFPOS_SYNC_SECRET: NEW_KEY },
        BOTH,
      ),
    ).toEqual({ panel: [PANEL_KEY], lafpos: [NEW_KEY] });
  });

  it("anahtar değişirken iki değer: önce bugünkü, sonra önceki", () => {
    expect(signedCallerKeys(ROTATING, BOTH)).toEqual({
      panel: [PANEL_KEY],
      lafpos: [NEW_KEY, OLD_KEY],
    });
    expect(signedCallerKeys(ROTATING, LAFPOS_ONLY)).toEqual({
      lafpos: [NEW_KEY, OLD_KEY],
    });
    // Panelin uçlarına (yalnız panel) önceki değer bir şey katmaz.
    expect(signedCallerKeys(ROTATING, ["panel"])).toEqual({
      panel: [PANEL_KEY],
    });
  });

  it("kısa, bugünküyle aynı ya da panelinkiyle aynı önceki değer sayılmaz", () => {
    for (const previous of ["a".repeat(31), ` ${NEW_KEY} `, PANEL_KEY]) {
      expect(
        signedCallerKeys(
          { ...ROTATING, LAFPOS_SYNC_SECRET_ONCEKI: previous },
          BOTH,
        ),
      ).toEqual({ panel: [PANEL_KEY], lafpos: [NEW_KEY] });
    }
  });

  it("önceki değer tek başına LafPOS'u açmaz: bugünkü silinince LafPOS kapalı", () => {
    const deleted = {
      KARAOKE_SYNC_SECRET: PANEL_KEY,
      LAFPOS_SYNC_SECRET_ONCEKI: OLD_KEY,
    };
    expect(signedCallerKeys(deleted, LAFPOS_ONLY)).toBeNull();
    expect(signedCallerKeys(deleted, BOTH)).toEqual({ panel: [PANEL_KEY] });
    // Kısa bugünkü de silinmiş sayılır.
    expect(
      signedCallerKeys(
        { ...deleted, LAFPOS_SYNC_SECRET: "a".repeat(31) },
        LAFPOS_ONLY,
      ),
    ).toBeNull();
  });

  it("bugünkü panelinkiyle aynıysa önceki değer de sayılmaz: karışıklık görünür kalır", () => {
    expect(
      signedCallerKeys(
        { ...ROTATING, LAFPOS_SYNC_SECRET: PANEL_KEY },
        LAFPOS_ONLY,
      ),
    ).toBeNull();
  });
});

describe("signedCaller: önceki değer", () => {
  const keys = signedCallerKeys(ROTATING, BOTH)!;

  it("iki LafPOS değeriyle imzalı istek de LafPOS'undur; panelinki panelin", () => {
    expect(callerOf(keys, request(OLD_KEY))).toBe("lafpos");
    expect(callerOf(keys, request(NEW_KEY))).toBe("lafpos");
    expect(callerOf(keys, request(PANEL_KEY))).toBe("panel");
    expect(callerOf(keys, request(OTHER_KEY))).toBeNull();
    expect(callerOf(keys, { headers: new Headers() })).toBeNull();
  });

  it("önceki değer silinince eski değerle imzalı istek reddedilir", () => {
    const after = signedCallerKeys(
      { KARAOKE_SYNC_SECRET: PANEL_KEY, LAFPOS_SYNC_SECRET: NEW_KEY },
      BOTH,
    )!;
    expect(callerOf(after, request(OLD_KEY))).toBeNull();
    expect(callerOf(after, request(NEW_KEY))).toBe("lafpos");
  });

  it("önceki değerle de bayat, başka yola atılmış imza geçmez", () => {
    const stale = request(OLD_KEY, undefined, Date.now() - 10 * 60_000);
    expect(callerOf(keys, stale)).toBeNull();
    const retargeted = request(OLD_KEY, "/api/pos/orders/version");
    expect(callerOf(keys, retargeted, "/api/panel/orders")).toBeNull();
  });

  it("her anahtar denenir: hangisinin tuttuğu yanıtın süresinden okunmaz", () => {
    for (const key of [PANEL_KEY, NEW_KEY, OLD_KEY, OTHER_KEY]) {
      vi.mocked(verifySignature).mockClear();
      callerOf(keys, request(key));
      expect(verifySignature).toHaveBeenCalledTimes(3);
    }
    // Önceki değer yokken eskisi gibi iki deneme.
    const plain = signedCallerKeys(
      { KARAOKE_SYNC_SECRET: PANEL_KEY, LAFPOS_SYNC_SECRET: NEW_KEY },
      BOTH,
    )!;
    vi.mocked(verifySignature).mockClear();
    callerOf(plain, request(OLD_KEY));
    expect(verifySignature).toHaveBeenCalledTimes(2);
  });
});

// Hangi değer tuttu (27 Kas 2026, uyum incelemesi 3. sorun): her 2xx aynı
// görünüyordu, ladmin kendi değerinin sitede yalnız önceki değer olarak
// kabul edildiğini göremiyordu. Panel adımı atlanmışken önceki değer
// silinirse kasa kesilirdi.
describe("signedBy: hangi değer tuttu (x-laf-anahtar)", () => {
  const keys = signedCallerKeys(ROTATING, BOTH)!;

  function byOf(k: SignedCallerKeys, key: string) {
    const path = "/api/pos/orders/version";
    return signedBy(k, request(key, path), "GET", new URL(path, BASE), "");
  }

  it("bugünkü değer simdiki, önceki değer onceki, panelinki simdiki", () => {
    expect(byOf(keys, NEW_KEY)).toEqual({ caller: "lafpos", key: "simdiki" });
    expect(byOf(keys, OLD_KEY)).toEqual({ caller: "lafpos", key: "onceki" });
    expect(byOf(keys, PANEL_KEY)).toEqual({ caller: "panel", key: "simdiki" });
    expect(byOf(keys, OTHER_KEY)).toBeNull();
    expect(
      signedBy(
        keys,
        { headers: new Headers() },
        "GET",
        new URL("/api/pos/orders/version", BASE),
        "",
      ),
    ).toBeNull();
  });

  it("ladmin eski değeri dağıtmayı sürdürürse sınaması onceki görür; çevrilince simdiki", () => {
    // Site: yeni + önceki. ladmin'in değeri hâlâ eski: kabul, ama `onceki`.
    expect(byOf(keys, OLD_KEY)?.key).toBe("onceki");
    // ladmin yeni değere çevrildi: `simdiki`; önceki artık silinebilir.
    expect(byOf(keys, NEW_KEY)?.key).toBe("simdiki");
    // Önceki silinince eski değer hiç geçmez.
    const after = signedCallerKeys(
      { KARAOKE_SYNC_SECRET: PANEL_KEY, LAFPOS_SYNC_SECRET: NEW_KEY },
      BOTH,
    )!;
    expect(byOf(after, OLD_KEY)).toBeNull();
    expect(byOf(after, NEW_KEY)).toEqual({ caller: "lafpos", key: "simdiki" });
  });

  it("signedCaller aynı kararı verir; yalnız değeri söylemez", () => {
    for (const key of [PANEL_KEY, NEW_KEY, OLD_KEY, OTHER_KEY]) {
      expect(callerOf(keys, request(key))).toBe(
        byOf(keys, key)?.caller ?? null,
      );
    }
  });

  it("hangisi tutarsa tutsun her anahtar denenir", () => {
    for (const key of [PANEL_KEY, NEW_KEY, OLD_KEY, OTHER_KEY]) {
      vi.mocked(verifySignature).mockClear();
      byOf(keys, key);
      expect(verifySignature).toHaveBeenCalledTimes(3);
    }
  });

  it("başlık yalnız değerin adını taşır, değeri değil", () => {
    expect(SIGNED_KEY_HEADER).toBe("x-laf-anahtar");
    expect(signedKeyHeader({ caller: "lafpos", key: "onceki" })).toEqual({
      "x-laf-anahtar": "onceki",
    });
    expect(signedKeyHeader(byOf(keys, NEW_KEY)!)).toEqual({
      "x-laf-anahtar": "simdiki",
    });
    const values = Object.values(signedKeyHeader(byOf(keys, OLD_KEY)!));
    for (const secret of [PANEL_KEY, NEW_KEY, OLD_KEY]) {
      expect(values.join("")).not.toContain(secret);
    }
  });
});

import { describe, expect, it, vi } from "vitest";

/**
 * `/api/health` - iki sessiz arızanın sesi.
 *
 * İkisi de yaşandı. (1) `vercel.json`ın cron sayısı yüzünden 16-22 Eyl 2026
 * arasında üretime hiçbir şey çıkmadı ve dışarıdan bakan hiçbir şey bunu
 * söyleyemedi: site eski derlemeyi sunmaya devam etti. (2) Şema kendini
 * uyguluyor ama `ensureSchemaFresh` hatalarını BİLEREK yutuyor, yani kendi
 * sebebiyle düşen bir migration geriye yalnız bir `console.warn` bırakıyor.
 *
 * Burada kilitlenen üç şey: ucun migration'ı TETİKLEDİĞİ (yalnız rapor
 * etmediği), geride kalmış bir şemanın **503** verdiği - yoksa bir izleyici
 * yeşil görür - ve gövdenin kısır kaldığı: sürüm, migration adı, hata metni
 * dışarıya sızmamalı.
 */
const dbHealth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ dbHealth }));

const { GET } = await import("@/app/api/health/route");

describe("GET /api/health", () => {
  it("200 ve ok:true - veritabanı ayakta, şema güncel", async () => {
    dbHealth.mockResolvedValue({ db: "up", schema: "fresh" });
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      db: "up",
      schema: "fresh",
    });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("503 - şema geride kalmışsa yeşil yanmaz", async () => {
    dbHealth.mockResolvedValue({ db: "up", schema: "stale" });
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ ok: false });
  });

  it("503 - veritabanına ulaşılamıyorsa da", async () => {
    dbHealth.mockResolvedValue({ db: "down", schema: "unknown" });
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it("gövde kısır: sürüm, ad, sayı ya da hata metni yok", async () => {
    dbHealth.mockResolvedValue({ db: "up", schema: "fresh" });
    const body = (await (await GET()).json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["db", "ok", "schema"]);
  });
});

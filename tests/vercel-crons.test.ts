import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `vercel.json`'ın cron listesi, barındırma planının izin verdiğinin içinde
 * kalmak ZORUNDA - yoksa Vercel cron'u değil, **deploy'u** reddediyor.
 *
 * Bu tam olarak yaşandı. 16 Eyl 2026'da üçüncü cron ve saatlik bir program
 * eklendi; o günden 22 Eyl'e kadar üretime hiçbir şey çıkmadı. `main`'e
 * merge edilen her şey - e-posta otomasyonu, alerjen yayını, sözleşmenin
 * §18/§19'u, panel sinyalleri - depoda durdu ve kimse fark etmedi, çünkü
 * site ayakta kalmaya devam etti: eski derlemeyi sunuyordu.
 *
 * Hobby planının sınırı **2 cron** ve **yalnız günlük** program. Bir
 * kampanyanın birkaç saat geç çıkması, hiçbir şeyin yayımlanamamasından
 * kıyaslanamayacak kadar iyidir; bu yüzden üç iş iki rotaya indi
 * (`/api/cron/daily` üçünü sırayla koşar).
 *
 * Plan yükseltilirse: bu testteki iki sabiti gevşetin ve `vercel.json`'daki
 * eski üç satırlık listeyi geri koyun. Üç rota da silinmedi, yerinde duruyor.
 */
const MAX_CRONS = 2;

/** Günde bir kereden sık çalışan her program. Hobby bunları reddeder. */
function runsMoreThanDaily(schedule: string): boolean {
  const [minute, hour] = schedule.trim().split(/\s+/);
  // "0 * * * *" (saatlik) ya da "*/15 * * * *" gibi her şey: saat alanı
  // sabit bir sayı değilse gün içinde birden çok kez çalışır.
  return hour === "*" || hour.includes("*") || minute.includes("*");
}

describe("vercel.json - cron listesi planın içinde kalıyor", () => {
  const config = JSON.parse(
    readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
  ) as { crons?: { path: string; schedule: string }[] };
  const crons = config.crons ?? [];

  it(`en fazla ${MAX_CRONS} cron tanımlı`, () => {
    expect(crons.length).toBeLessThanOrEqual(MAX_CRONS);
  });

  it("hiçbiri günde birden fazla çalışmıyor", () => {
    const tooOften = crons
      .filter((c) => runsMoreThanDaily(c.schedule))
      .map((c) => `${c.path} (${c.schedule})`);
    expect(tooOften).toEqual([]);
  });

  it("her cron gerçekten var olan bir rotaya işaret ediyor", () => {
    // Var olmayan bir yola kurulmuş cron sessizce 404 döner ve iş hiç koşmaz.
    for (const cron of crons) {
      const route = join(process.cwd(), "src/app", cron.path, "route.ts");
      expect(() => readFileSync(route, "utf8")).not.toThrow();
    }
  });
});

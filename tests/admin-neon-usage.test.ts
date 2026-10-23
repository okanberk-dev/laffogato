import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DatabaseSchemaStatus,
  NeonUsageStatus,
} from "@/app/admin/ayarlar/database-status";
import { NeonUsageLine } from "@/components/admin/dashboard/neon-status";
import {
  forgetNeonUsage,
  loadNeonUsage,
  neonConfig,
  neonLimit,
} from "@/lib/admin/neon-usage";
import {
  neonAdvice,
  neonAlarm,
  neonLimitFrom,
  neonSentence,
  neonUsageView,
  parseNeonProject,
  readNeonUsageFor,
  type NeonUsageRead,
} from "@/lib/admin/neon-usage-core";

/**
 * Ayarlar → Sistem durumu's Neon row and the owner's dashboard alarm (23
 * Eki 2026). Neon's Free plan stops the database for the rest of the month
 * when its 100 CU-hours run out (docs/DATABASE.md; September 2026), and no
 * screen said how close that was. The figures below are the measurement
 * docs/DATABASE.md records: 70,2 CU-hours by 19 Eki 15:05 UTC, a 0,25 CU
 * endpoint, a projected ~117 for the month.
 */

const KEY = "napi_test_key_never_logged";
const PROJECT = "misty-cell-35394291";
const OCT = {
  consumption_period_start: "2026-10-01T00:00:00Z",
  consumption_period_end: "2026-11-01T00:00:00Z",
};
/** A project answer: `cu` CU-hours on a 0,25 CU endpoint. */
const answer = (cu: number, period: Record<string, string> = OCT) => ({
  project: {
    id: PROJECT,
    compute_time_seconds: Math.round(cu * 3600),
    active_time_seconds: Math.round(cu * 4 * 3600),
    ...period,
  },
});
const usage = (cu: number, now: Date): NeonUsageRead => {
  const parsed = parseNeonProject(answer(cu), now);
  if (!parsed) throw new Error("fixture");
  return { kind: "usage", usage: parsed };
};
const MEASURED = new Date("2026-10-19T15:05:00Z");

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/\s+/g, " ");

describe("the plan's monthly hours", () => {
  it("is the Free plan's 100 unless NEON_CU_HOURS_LIMIT says otherwise", () => {
    expect(neonLimitFrom(undefined)).toBe(100);
    expect(neonLimitFrom("")).toBe(100);
    expect(neonLimitFrom("120")).toBe(120);
    expect(neonLimitFrom(" 191,9 ")).toBe(191.9);
    // A plan without a cap: nothing to measure against.
    expect(neonLimitFrom("0")).toBeNull();
    for (const bad of ["abc", "-5", "Infinity"]) {
      expect(neonLimitFrom(bad), bad).toBe(100);
    }
    expect(neonLimit({ NEON_CU_HOURS_LIMIT: "0" })).toBeNull();
    expect(neonLimit({})).toBe(100);
  });
});

describe("Neon's answer", () => {
  it("reads the period's compute and awake hours", () => {
    expect(parseNeonProject(answer(70.2), MEASURED)).toEqual({
      cuHours: 70.2,
      activeHours: 280.8,
      periodStart: "2026-10-01T00:00:00.000Z",
      periodEnd: "2026-11-01T00:00:00.000Z",
    });
  });

  it("takes the calendar month in UTC when the period is not given or makes no sense", () => {
    const now = new Date("2026-12-15T09:00:00Z");
    expect(parseNeonProject(answer(5, {}), now)).toMatchObject({
      periodStart: "2026-12-01T00:00:00.000Z",
      periodEnd: "2027-01-01T00:00:00.000Z",
    });
    const backwards = answer(5, {
      consumption_period_start: "2026-12-01T00:00:00Z",
      consumption_period_end: "0001-01-01T00:00:00Z",
    });
    expect(parseNeonProject(backwards, now)?.periodEnd).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });

  it("is nothing at all when it is not the documented shape", () => {
    for (const body of [
      null,
      "x",
      {},
      { project: null },
      { project: {} },
      { project: { compute_time_seconds: "3600" } },
      { project: { compute_time_seconds: -1 } },
      { project: { compute_time_seconds: Number.NaN } },
    ]) {
      expect(parseNeonProject(body, MEASURED), JSON.stringify(body)).toBeNull();
    }
  });
});

describe("what the row says", () => {
  it("the measured October: orange, and the day this pace runs out", () => {
    const view = neonUsageView(usage(70.2, MEASURED), 100, MEASURED);
    expect(view.state).toBe("near");
    expect(view.tone).toBe("warning");
    expect(view.projected).toBeCloseTo(116.8, 1);
    // 100 / 70,2 of the 447 hours behind it: 27 Ekim, Istanbul time.
    expect(view.runsOutAt?.slice(0, 10)).toBe("2026-10-27");
    expect(neonSentence(view)).toBe(
      "bu dönem 70,2 / 100 CU-saat (%70); bu hızla 27 Ekim günü dolar. Compute günde ortalama 15,1 saat uyanık.",
    );
    expect(neonAdvice(view)).toBe(
      "Dolarsa Neon veritabanını 1 Kasım'a kadar askıya alır; site sipariş alamaz, panel açılmaz. Kalıcı çözüm Neon'un ücretli planı (docs/DATABASE.md). Geliştiriciye ilet.",
    );
    expect(neonAlarm(view)).toBe(true);
  });

  it("green while the pace stays inside the month, with the month's total", () => {
    const now = new Date("2026-10-16T00:00:00Z");
    const view = neonUsageView(usage(30, now), 100, now);
    expect(view).toMatchObject({
      state: "ok",
      tone: "success",
      runsOutAt: null,
    });
    expect(neonSentence(view)).toBe(
      "bu dönem 30,0 / 100 CU-saat (%30); bu hızla dönem sonunda ~62,0. Compute günde ortalama 8,0 saat uyanık.",
    );
    expect(neonAdvice(view)).toBe("");
    expect(neonAlarm(view)).toBe(false);
  });

  it("no pace in the period's first day: too few hours to say", () => {
    const now = new Date("2026-10-01T10:00:00Z");
    const view = neonUsageView(usage(2, now), 100, now);
    expect(view).toMatchObject({
      state: "ok",
      projected: null,
      runsOutAt: null,
      awakePerDay: null,
    });
    expect(neonSentence(view)).toBe("bu dönem 2,0 / 100 CU-saat (%2).");
  });

  it("orange from 80 % even when the month ends first", () => {
    const now = new Date("2026-10-30T00:00:00Z");
    const view = neonUsageView(usage(85, now), 100, now);
    expect(view).toMatchObject({
      state: "near",
      tone: "warning",
      runsOutAt: null,
    });
    expect(neonSentence(view)).toContain(
      "(%85); bu hızla dönem sonunda ~90,9.",
    );
  });

  it("red once the hours are spent, until the new period begins", () => {
    const now = new Date("2026-09-29T22:30:00Z");
    const read = {
      kind: "usage",
      usage: parseNeonProject(
        answer(100.4, {
          consumption_period_start: "2026-09-01T00:00:00Z",
          consumption_period_end: "2026-10-01T00:00:00Z",
        }),
        now,
      )!,
    } as const;
    const view = neonUsageView(read, 100, now);
    expect(view).toMatchObject({ state: "full", tone: "danger" });
    expect(neonSentence(view)).toMatch(
      /^bu dönem 100,4 \/ 100 CU-saat \(%100\)\./,
    );
    // Ekim takes -e, Kasım -a: the dative follows the month's last vowel.
    expect(neonAdvice(view)).toMatch(
      /^Saatler doldu: Neon veritabanını 1 Ekim'e kadar askıya alabilir; /,
    );
    expect(neonAlarm(view)).toBe(true);
  });

  it("a plan without a cap is green whatever the hours", () => {
    const view = neonUsageView(usage(150, MEASURED), null, MEASURED);
    expect(view).toMatchObject({ state: "ok", tone: "success", limit: null });
    expect(neonSentence(view)).toMatch(
      /^bu dönem 150,0 CU-saat; bu hızla dönem sonunda ~249,6\./,
    );
    expect(neonAlarm(view)).toBe(false);
  });

  it("grey when off or unreadable, and never an alarm", () => {
    for (const kind of ["off", "unreadable"] as const) {
      const view = neonUsageView({ kind }, 100, MEASURED);
      expect(view).toMatchObject({
        state: kind,
        tone: "neutral",
        cuHours: null,
      });
      expect(neonSentence(view)).toBe("");
      expect(neonAlarm(view)).toBe(false);
    }
    expect(neonAlarm(null)).toBe(false);
  });
});

describe("the read", () => {
  const ENV = { ...process.env };
  const ok = (body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  let errors: { mock: { calls: unknown[][] }; mockRestore: () => void };

  beforeEach(() => {
    forgetNeonUsage();
    process.env.NEON_API_KEY = KEY;
    process.env.NEON_PROJECT_ID = PROJECT;
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...ENV };
    errors.mockRestore();
  });

  it("is off, and asks nobody, without both the key and the project", async () => {
    const fetchImpl = vi.fn();
    for (const env of [
      { NEON_API_KEY: KEY },
      { NEON_PROJECT_ID: PROJECT },
      // Not an id: never put into a path.
      { NEON_API_KEY: KEY, NEON_PROJECT_ID: "../orgs/x" },
    ]) {
      expect(neonConfig(env)).toBeNull();
    }
    delete process.env.NEON_API_KEY;
    await expect(loadNeonUsage(MEASURED, fetchImpl)).resolves.toEqual({
      kind: "off",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("asks Neon's API for the project with the key, and keeps a good answer ten minutes", async () => {
    const fetchImpl = vi.fn(() => ok(answer(70.2)));
    const first = await loadNeonUsage(MEASURED, fetchImpl as typeof fetch);
    expect(first).toMatchObject({ kind: "usage", usage: { cuHours: 70.2 } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`https://console.neon.tech/api/v2/projects/${PROJECT}`);
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${KEY}` });
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const later = new Date(MEASURED.getTime() + 9 * 60_000);
    expect(await loadNeonUsage(later, fetchImpl as typeof fetch)).toBe(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const after = new Date(MEASURED.getTime() + 11 * 60_000);
    await loadNeonUsage(after, fetchImpl as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("a refused key, an odd body or no answer is unreadable, logged without the key", async () => {
    const refused = vi.fn(() =>
      Promise.resolve(new Response('{"message":"bad key"}', { status: 401 })),
    );
    await expect(
      loadNeonUsage(MEASURED, refused as unknown as typeof fetch),
    ).resolves.toEqual({ kind: "unreadable" });
    const odd = vi.fn(() => ok({ project: { id: PROJECT } }));
    await expect(
      loadNeonUsage(MEASURED, odd as unknown as typeof fetch),
    ).resolves.toEqual({ kind: "unreadable" });
    const silent = vi.fn(() =>
      Promise.reject(new DOMException("timed out", "TimeoutError")),
    );
    await expect(
      loadNeonUsage(MEASURED, silent as unknown as typeof fetch),
    ).resolves.toEqual({ kind: "unreadable" });
    const logged = errors.mock.calls.map((c) => c.join(" "));
    expect(logged).toEqual([
      "[admin] Neon usage unreadable: HTTP 401",
      "[admin] Neon usage unreadable: unexpected body",
      "[admin] Neon usage unreadable: TimeoutError",
    ]);
    expect(logged.join(" ")).not.toContain(KEY);
    // A failure is not kept: the next view asks again.
    await loadNeonUsage(MEASURED, refused as unknown as typeof fetch);
    expect(refused).toHaveBeenCalledTimes(2);
  });

  it("is made for the owner only, as the keep-alive's", async () => {
    const read = vi.fn(() => Promise.resolve({ kind: "off" } as const));
    for (const role of ["manager", "staff", "cashier"] as const) {
      expect(readNeonUsageFor(role, read)).toBeNull();
    }
    expect(read).not.toHaveBeenCalled();
    await expect(readNeonUsageFor("owner", read)).resolves.toEqual({
      kind: "off",
    });
  });
});

describe("Sistem durumu and Genel bakış", () => {
  const row = (read: NeonUsageRead, now = MEASURED) =>
    renderToStaticMarkup(
      createElement(NeonUsageStatus, {
        view: neonUsageView(read, 100, now),
      }),
    );

  it("off: grey, and how to turn it on", () => {
    const html = row({ kind: "off" });
    expect(html).toContain(
      'data-testid="neon-usage-status" data-state="off" data-tone="neutral"',
    );
    expect(text(html)).toContain(
      "Neon işlem süresi: bağlı değil. Vercel'de NEON_API_KEY",
    );
    expect(text(html)).toContain("NEON_PROJECT_ID");
  });

  it("unreadable: grey, and who to tell", () => {
    expect(text(row({ kind: "unreadable" }))).toContain(
      "Neon'un yanıtı okunamadı",
    );
  });

  it("near: the sentence and what running out costs", () => {
    const html = row(usage(70.2, MEASURED));
    expect(html).toContain('data-state="near" data-tone="warning"');
    expect(text(html)).toContain(
      "Neon işlem süresi: bu dönem 70,2 / 100 CU-saat (%70); bu hızla 27 Ekim günü dolar.",
    );
    expect(text(html)).toContain("1 Kasım'a kadar askıya alır");
  });

  it("the database row: green when the schema caught up, orange with the way to the cause when not", () => {
    const fresh = renderToStaticMarkup(
      createElement(DatabaseSchemaStatus, {
        health: { db: "up", schema: "fresh" },
      }),
    );
    expect(fresh).toContain(
      'data-testid="database-status" data-state="fresh" data-tone="success"',
    );
    expect(text(fresh)).toContain("Veritabanı: bağlı, şema bu sürümle güncel.");
    const stale = renderToStaticMarkup(
      createElement(DatabaseSchemaStatus, {
        health: { db: "up", schema: "stale" },
      }),
    );
    expect(stale).toContain('data-state="stale" data-tone="warning"');
    expect(text(stale)).toContain("bekleyen bir migration uygulanamadı");
    expect(text(stale)).toContain("/api/health 503 döner");
  });

  it("the dashboard's band says the same, in the row's tone", () => {
    const view = neonUsageView(usage(70.2, MEASURED), 100, MEASURED);
    const html = renderToStaticMarkup(createElement(NeonUsageLine, { view }));
    expect(html).toContain('data-testid="neon-usage-status" data-state="near"');
    expect(html).toContain("border-l-[var(--admin-warning)]");
    expect(text(html)).toContain(
      `Neon işlem süresi: ${neonSentence(view)} ${neonAdvice(view)}`,
    );
  });

  it("is wired on both pages behind the owner's gate, the dashboard for an alarm only", () => {
    const settings = readFileSync("src/app/admin/ayarlar/page.tsx", "utf8");
    expect(settings).toContain("readNeonUsageFor(session.role, loadNeonUsage)");
    expect(settings).toContain("neonAlarm(compute)");
    expect(settings).toContain("!schemaFresh");
    expect(settings).toContain("<DatabaseSchemaStatus health={database} />");
    expect(settings).toContain("<NeonUsageStatus view={compute} />");
    const dashboard = readFileSync("src/app/admin/page.tsx", "utf8");
    expect(dashboard).toContain("readNeonUsageFor(role, loadNeonUsage)");
    expect(dashboard).toMatch(
      /compute && neonAlarm\(compute\) \? \(?\s*<NeonUsageLine view=\{compute\} \/>/,
    );
  });

  it("the key stays on the server: no client file reads it", () => {
    const core = readFileSync("src/lib/admin/neon-usage-core.ts", "utf8");
    expect(core).not.toContain("process.env");
    const read = readFileSync("src/lib/admin/neon-usage.ts", "utf8");
    expect(read.startsWith('import "server-only";')).toBe(true);
    expect(read).not.toContain("NEXT_PUBLIC");
  });
});

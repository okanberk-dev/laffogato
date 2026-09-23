import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiError } from "@/lib/mobile/respond";
import {
  FAL_DAILY_LIMIT,
  FAL_REPORT_DAILY_LIMIT,
  FAL_REPORT_REASON_LABELS,
  FAL_REPORT_REASONS,
  FAL_REPORT_TEXT_MAX,
  falReportModel,
  falReportReason,
  falReportText,
} from "@/lib/mobile/fal-core";

/**
 * "Bu yorumu bildir" (Google Play's AI-generated content policy): a member
 * flags an AI reading of fA'L. The report keeps the words, a reason from a
 * closed list and the model - never the photo - and it must work whether or
 * not the AI is switched on, because a reading on screen stays reportable.
 */

const WORDS =
  "Americano · Köpükte bir kuş kanat açmış. · Sen yeni başlangıçlara cesaretle yürüyensin. · Bu hafta güzel bir sohbet seni bulacak.";

describe("fal-core: what a report may carry", () => {
  it("keeps a reason from the closed list, anything else as other", () => {
    for (const reason of FAL_REPORT_REASONS) expect(falReportReason(reason)).toBe(reason);
    expect(falReportReason(" OFFENSIVE ")).toBe("offensive");
    expect(falReportReason("Adım Ayşe, sağlığım kötü")).toBe("other");
    expect(falReportReason(undefined)).toBe("other");
    expect(falReportReason(42)).toBe("other");
  });

  it("labels every reason in Turkish for the panel", () => {
    expect(Object.keys(FAL_REPORT_REASON_LABELS).sort()).toEqual([...FAL_REPORT_REASONS].sort());
    for (const label of Object.values(FAL_REPORT_REASON_LABELS)) {
      expect(label).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it("records a model name only when it looks like one", () => {
    expect(falReportModel("gpt-5.4-mini")).toBe("gpt-5.4-mini");
    expect(falReportModel("  gpt-5.4-mini ")).toBe("gpt-5.4-mini");
    expect(falReportModel("<script>")).toBe("");
    expect(falReportModel("a".repeat(65))).toBe("");
    expect(falReportModel(undefined)).toBe("");
  });

  it("takes the words on one line, and refuses empty or overlong text", () => {
    expect(falReportText(`  ${WORDS}\n\n`)).toBe(WORDS);
    expect(falReportText("   ")).toBeNull();
    expect(falReportText("a".repeat(FAL_REPORT_TEXT_MAX + 1))).toBeNull();
    expect(falReportText(7)).toBeNull();
  });

  it("allows twice the day's readings in reports", () => {
    expect(FAL_REPORT_DAILY_LIMIT).toBe(FAL_DAILY_LIMIT * 2);
  });
});

// ─── The endpoint ─────────────────────────────────────────────────────────

const requireMobileCustomer = vi.fn();
const lib = {
  falReportsToday: vi.fn(),
  recordFalReport: vi.fn(),
};
vi.mock("@/lib/mobile/auth", () => ({ requireMobileCustomer }));
vi.mock("@/lib/mobile/fal", () => lib);

const { POST } = await import("@/app/api/mobile/v1/fal/report/route");

function req(body: unknown) {
  return POST(
    new Request("https://laffogato.net/api/mobile/v1/fal/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /fal/report", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    requireMobileCustomer.mockResolvedValue({ ok: true, customer: { email: "Eda@Ornek.com", emailVerified: true } });
    lib.falReportsToday.mockReset().mockResolvedValue([]);
    lib.recordFalReport.mockReset().mockResolvedValue(undefined);
  });

  it("refuses a caller without a bearer and stores nothing", async () => {
    requireMobileCustomer.mockResolvedValue({ ok: false, response: apiError(401, "unauthorized", "Giriş yapman gerekiyor.") });
    expect((await req({ text: WORDS })).status).toBe(401);
    expect(lib.recordFalReport).not.toHaveBeenCalled();
  });

  it("stores the words, the reason and the model, and answers 201 ok", async () => {
    const res = await req({ text: WORDS, reason: "promise", model: "gpt-5.4-mini" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(lib.recordFalReport).toHaveBeenCalledWith("Eda@Ornek.com", {
      reason: "promise",
      text: WORDS,
      model: "gpt-5.4-mini",
    });
  });

  it("works while the AI is switched off - a reading on screen stays reportable", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("FAL_AI_ENABLED", "");
    expect((await req({ text: WORDS })).status).toBe(201);
  });

  it("files an unknown reason as other and a missing model as empty", async () => {
    await req({ text: WORDS, reason: "newer-build-reason" });
    expect(lib.recordFalReport).toHaveBeenCalledWith("Eda@Ornek.com", { reason: "other", text: WORDS, model: "" });
  });

  it("never takes a photo, whatever the body carries", async () => {
    await req({ text: WORDS, image: "/9j/4AAQSkZJRg==" });
    const stored = lib.recordFalReport.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(["model", "reason", "text"]);
  });

  it("is 400 for a body that is not JSON, has no words or too many", async () => {
    expect((await req("not json")).status).toBe(400);
    expect((await (await req({})).json()).error).toBe("invalid_request");
    expect((await (await req({ text: "   " })).json()).error).toBe("invalid_request");
    expect((await req({ text: "a".repeat(FAL_REPORT_TEXT_MAX + 1) })).status).toBe(400);
    expect(lib.recordFalReport).not.toHaveBeenCalled();
  });

  it(`stops at ${FAL_REPORT_DAILY_LIMIT} reports a day with 429 fal_report_limit`, async () => {
    lib.falReportsToday.mockResolvedValue(Array.from({ length: FAL_REPORT_DAILY_LIMIT }, (_, i) => `yorum ${i}`));
    const res = await req({ text: WORDS });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("fal_report_limit");
    expect(lib.recordFalReport).not.toHaveBeenCalled();
  });

  it("stores the same words once a day and still answers ok", async () => {
    lib.falReportsToday.mockResolvedValue([WORDS]);
    const res = await req({ text: WORDS });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(lib.recordFalReport).not.toHaveBeenCalled();
  });
});

describe("what the house publishes about it", () => {
  const legal = readFileSync("src/lib/legal/content.ts", "utf8");

  it("no longer says the generated reading is never kept", () => {
    // It is kept when the member reports it; the old sentence would be false.
    expect(legal).not.toContain("fotoğraf ve üretilen yorum saklanmaz");
    expect(legal).not.toContain("Fotoğraf ve üretilen yorum şirketimizce saklanmaz");
    expect(legal).not.toContain("Fotoğraf ve üretilen yorum saklanmaz");
  });

  it("names the report, what it keeps, that the photo is not in it, and for how long", () => {
    expect(legal).toContain("'Bu yorumu bildir'");
    expect(legal).toContain("Bildirdiğiniz bir yorumun kaydı incelenmek üzere doksan gün saklanır ve ardından silinir.");
    expect(legal).toContain("Fotoğraf bildirime girmez");
  });

  it("documents the endpoint in the contract", () => {
    const doc = readFileSync("docs/API-MOBILE.md", "utf8");
    const fal = doc.slice(doc.indexOf("## 20. fA'L"));
    expect(fal).toContain("POST /fal/report");
    expect(fal).toContain("fal_report_limit");
  });
});

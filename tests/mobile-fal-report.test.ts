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
 *
 * Since 27 Oct 2026 the AI reading is retired (App Review 4.3(b), lafmobil
 * karar 330) and no app build sends a report; the endpoint keeps the answer
 * §20 documents, and the old rows run out after ninety days.
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
  withdrawFalReport: vi.fn(),
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

describe("POST /fal/report, retired on 27 Oct 2026", () => {
  beforeEach(() => {
    requireMobileCustomer.mockResolvedValue({ ok: true, customer: { email: "Eda@Ornek.com", emailVerified: true } });
    lib.falReportsToday.mockReset().mockResolvedValue([]);
    lib.recordFalReport.mockReset().mockResolvedValue(41);
    lib.withdrawFalReport.mockReset().mockResolvedValue(undefined);
  });

  it("refuses a caller without a bearer and stores nothing", async () => {
    requireMobileCustomer.mockResolvedValue({ ok: false, response: apiError(401, "unauthorized", "Giriş yapman gerekiyor.") });
    expect((await req({ text: WORDS })).status).toBe(401);
    expect(lib.recordFalReport).not.toHaveBeenCalled();
  });

  it("answers 503 fal_unavailable to a member and reads or writes nothing, whatever the body", async () => {
    // Veri Saklama: no new report is taken once the feature left the app.
    for (const body of [{ text: WORDS, reason: "promise", model: "gpt-5.4-mini" }, { text: "" }, "{not json", { photo: "AAAA" }]) {
      const res = await req(body);
      expect(res.status).toBe(503);
      expect((await res.json()).error).toBe("fal_unavailable");
    }
    expect(lib.falReportsToday).not.toHaveBeenCalled();
    expect(lib.recordFalReport).not.toHaveBeenCalled();
    expect(lib.withdrawFalReport).not.toHaveBeenCalled();
  });
});

describe("what the house publishes about it", () => {
  const legal = readFileSync("src/lib/legal/content.ts", "utf8");

  it("never says the generated reading is never kept", () => {
    // It was kept when the member reported it; the old sentence was false.
    // Since 27 Oct 2026 the legal texts drop fA'L altogether (lafmobil
    // docs/site-handoff/APP-TO-SITE-2026-10-27.md); what they must not do
    // is bring this sentence back.
    expect(legal).not.toContain("fotoğraf ve üretilen yorum saklanmaz");
    expect(legal).not.toContain("Fotoğraf ve üretilen yorum şirketimizce saklanmaz");
    expect(legal).not.toContain("Fotoğraf ve üretilen yorum saklanmaz");
  });

  it("documents the endpoint in the contract", () => {
    const doc = readFileSync("docs/API-MOBILE.md", "utf8");
    const fal = doc.slice(doc.indexOf("## 20. fA'L"));
    expect(fal).toContain("POST /fal/report");
    expect(fal).toContain("fal_report_limit");
  });
});

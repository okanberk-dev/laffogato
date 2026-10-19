import { describe, expect, it, vi } from "vitest";

/**
 * The campaign list's dry audience counts (admin audit PEO-23): one per
 * distinct (audience, preference), asked at once. The list used to await
 * them one after another before it painted anything.
 */

const h = vi.hoisted(() => ({
  inFlight: 0,
  peak: 0,
  calls: [] as string[],
  release: [] as Array<() => void>,
}));

vi.mock("@/lib/email/campaigns", () => ({
  prefForTemplate: (template: string) =>
    template === "bulten-kampanya" ? "newsletter" : "marketing",
  countCampaignAudience: vi.fn(async (audience: string, pref: string) => {
    h.calls.push(`${audience}:${pref}`);
    h.inFlight += 1;
    h.peak = Math.max(h.peak, h.inFlight);
    await new Promise<void>((resolve) => h.release.push(resolve));
    h.inFlight -= 1;
    if (audience === "newsletter") throw new Error("db down");
    return audience === "marketing" ? 120 : 40;
  }),
  queueCampaignEmail: vi.fn(),
  runCampaignEmail: vi.fn(),
}));

const { campaignAudienceCounts, campaignAudienceKey } =
  await import("@/lib/admin/campaign-mail");

describe("campaignAudienceCounts", () => {
  it("asks each distinct audience once, all at the same time", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const pending = campaignAudienceCounts([
      { audience: "marketing", template: "kampanya-duyuru" },
      { audience: "marketing", template: "kampanya-indirim" },
      { audience: "both", template: "bulten-kampanya" },
      { audience: "newsletter", template: "bulten-kampanya" },
    ]);
    // Let every count start before any of them answers.
    await new Promise((r) => setTimeout(r, 0));
    expect(h.calls).toEqual([
      "marketing:marketing",
      "both:newsletter",
      "newsletter:newsletter",
    ]);
    expect(h.peak).toBe(3);
    for (const release of h.release) release();
    const counts = await pending;
    expect(
      counts.get(campaignAudienceKey("marketing", "kampanya-indirim")),
    ).toBe(120);
    expect(counts.get(campaignAudienceKey("both", "bulten-kampanya"))).toBe(40);
    // A count that could not be had is null, not zero, and not a crash.
    expect(
      counts.get(campaignAudienceKey("newsletter", "bulten-kampanya")),
    ).toBeNull();
  });
});

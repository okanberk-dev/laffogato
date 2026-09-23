import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FAKE_TABLES,
  fakeCampaignDb,
  resetFakeDb,
  seedRows,
} from "./_stubs/campaign-emails-db";

/**
 * Reading the campaign send log back.
 *
 * The rows have been written since the feature shipped and nothing ever read
 * them, so the panel could say "Başarısız 37" and not name one of the 37.
 * The ordering is the whole design: failures first, without a CASE expression
 * the query builder cannot express.
 */

vi.mock("@/lib/db", () => fakeCampaignDb());

const { listCampaignSends, tallyCampaignSends } = await import(
  "@/lib/admin/campaign-sends"
);

function send(email: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    campaignId: "cmp-1",
    email,
    recipientKind: "customer",
    name: "",
    unsubUrl: "",
    batchNo: 0,
    status,
    providerId: "",
    error: "",
    claimedAt: "",
    createdAt: "2026-09-16T08:00:00.000Z",
    sentAt: "",
    ...extra,
  };
}

beforeEach(() => {
  resetFakeDb();
  seedRows(FAKE_TABLES.campaignEmailSends, [
    send("zeynep@ornek.com", "sent", { sentAt: "2026-09-16T08:01:00.000Z" }),
    send("ali@ornek.com", "failed", { error: "bounced" }),
    send("burak@ornek.com", "queued"),
    send("can@ornek.com", "failed", { error: "429" }),
    send("deniz@ornek.com", "skipped"),
    { ...send("eda@ornek.com", "sent"), campaignId: "cmp-2" },
  ]);
});

describe("listCampaignSends", () => {
  it("puts the failures first - alphabetical status is not a coincidence worth hiding", async () => {
    const rows = await listCampaignSends("cmp-1");
    expect(rows.map((r) => r.status).slice(0, 2)).toEqual(["failed", "failed"]);
    // ...and e-mail breaks the tie, so the list is stable between reloads.
    expect(rows.slice(0, 2).map((r) => r.email)).toEqual([
      "ali@ornek.com",
      "can@ornek.com",
    ]);
  });

  it("stays inside one campaign", async () => {
    const rows = await listCampaignSends("cmp-1");
    expect(rows).toHaveLength(5);
    expect(rows.some((r) => r.email === "eda@ornek.com")).toBe(false);
  });

  it("carries the reason a row failed, which is the whole question", async () => {
    const [first] = await listCampaignSends("cmp-1", { status: "failed" });
    expect(first.error).toBe("bounced");
  });

  it("filters by status", async () => {
    const rows = await listCampaignSends("cmp-1", { status: "sent" });
    expect(rows.map((r) => r.email)).toEqual(["zeynep@ornek.com"]);
  });

  it("caps what it reads", async () => {
    const rows = await listCampaignSends("cmp-1", { limit: 2 });
    expect(rows).toHaveLength(2);
  });

  it("answers an empty campaign id without asking the database", async () => {
    await expect(listCampaignSends("")).resolves.toEqual([]);
  });
});

describe("tallyCampaignSends", () => {
  it("counts by status for the line above the table", async () => {
    const tally = tallyCampaignSends(await listCampaignSends("cmp-1"));
    expect(tally).toEqual({
      queued: 1,
      sending: 0,
      sent: 1,
      failed: 2,
      skipped: 1,
    });
  });
});

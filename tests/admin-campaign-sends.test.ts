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
 *
 * Then it read only the first 200 rows and counted THOSE (admin audit
 * PEO-15): a 412-recipient campaign said "Tümü · 200" beside "Alıcı 412",
 * and nobody past row 200 could be found. The counts now come from SQL over
 * the whole campaign, the rows a page at a time, and a search finds anyone.
 */

vi.mock("@/lib/db", () => fakeCampaignDb());

const { countCampaignSends, listCampaignSendsPage, CAMPAIGN_SENDS_PAGE_SIZE } =
  await import("@/lib/admin/campaign-sends");
const { campaignSendTabs, parseCampaignSendTab } =
  await import("@/lib/admin/campaign-sends-core");

function send(
  email: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
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
    send("ali@ornek.com", "failed", { error: "bounced", name: "Ali Işık" }),
    send("burak@ornek.com", "queued"),
    send("can@ornek.com", "failed", { error: "429" }),
    send("deniz@ornek.com", "skipped", { name: "İsmail Deniz" }),
    { ...send("eda@ornek.com", "sent"), campaignId: "cmp-2" },
  ]);
});

describe("listCampaignSendsPage", () => {
  it("puts the failures first - alphabetical status is not a coincidence worth hiding", async () => {
    const rows = await listCampaignSendsPage("cmp-1");
    expect(rows.map((r) => r.status).slice(0, 2)).toEqual(["failed", "failed"]);
    // ...and e-mail breaks the tie, so the list is stable between reloads.
    expect(rows.slice(0, 2).map((r) => r.email)).toEqual([
      "ali@ornek.com",
      "can@ornek.com",
    ]);
  });

  it("stays inside one campaign", async () => {
    const rows = await listCampaignSendsPage("cmp-1");
    expect(rows).toHaveLength(5);
    expect(rows.some((r) => r.email === "eda@ornek.com")).toBe(false);
  });

  it("carries the reason a row failed, which is the whole question", async () => {
    const [first] = await listCampaignSendsPage("cmp-1", { status: "failed" });
    expect(first.error).toBe("bounced");
  });

  it("filters by status", async () => {
    const rows = await listCampaignSendsPage("cmp-1", { status: "sent" });
    expect(rows.map((r) => r.email)).toEqual(["zeynep@ornek.com"]);
  });

  it("finds a recipient by address or by name, the Turkish way", async () => {
    const emails = async (search: string) =>
      (await listCampaignSendsPage("cmp-1", { search })).map((r) => r.email);
    expect(await emails("burak")).toEqual(["burak@ornek.com"]);
    // "ismail" finds "İsmail"; capitals fold the same way.
    expect(await emails("ismail")).toEqual(["deniz@ornek.com"]);
    expect(await emails("ALİ IŞIK")).toEqual(["ali@ornek.com"]);
    // LIKE's wildcards are letters here: "_" is not "any one character".
    expect(await emails("_")).toEqual([]);
  });

  it("reads a page at a time, past the old 200-row wall", async () => {
    seedRows(
      FAKE_TABLES.campaignEmailSends,
      Array.from({ length: 412 }, (_, i) =>
        send(`uye${String(i).padStart(3, "0")}@ornek.com`, "sent"),
      ),
    );
    const page1 = await listCampaignSendsPage("cmp-1");
    expect(page1).toHaveLength(CAMPAIGN_SENDS_PAGE_SIZE);
    expect(page1[0].email).toBe("uye000@ornek.com");
    const page9 = await listCampaignSendsPage("cmp-1", { page: 9 });
    // 412 = 8 full pages of 50 and 12 on the ninth; row 412 is reachable.
    expect(page9).toHaveLength(12);
    expect(page9.at(-1)?.email).toBe("uye411@ornek.com");
  });

  it("answers an empty campaign id without asking the database", async () => {
    await expect(listCampaignSendsPage("")).resolves.toEqual([]);
  });
});

describe("countCampaignSends", () => {
  it("counts every status over the whole campaign", async () => {
    expect(await countCampaignSends("cmp-1")).toEqual({
      total: 5,
      queued: 1,
      sending: 0,
      sent: 1,
      failed: 2,
      skipped: 1,
    });
  });

  it("counts all 412, not the rows a page shows (the old 'Tümü · 200')", async () => {
    seedRows(FAKE_TABLES.campaignEmailSends, [
      ...Array.from({ length: 398 }, (_, i) => send(`s${i}@ornek.com`, "sent")),
      ...Array.from({ length: 14 }, (_, i) =>
        send(`f${i}@ornek.com`, "failed"),
      ),
    ]);
    const tally = await countCampaignSends("cmp-1");
    expect(tally.total).toBe(412);
    expect(tally.sent).toBe(398);
    expect(tally.failed).toBe(14);
  });

  it("applies the search, so the tabs count what the box found", async () => {
    const tally = await countCampaignSends("cmp-1", { search: "ornek" });
    expect(tally.total).toBe(5);
    expect((await countCampaignSends("cmp-1", { search: "can" })).total).toBe(
      1,
    );
  });
});

describe("the tabs", () => {
  it("show Tümü and the statuses that have rows, failures first", async () => {
    const tabs = campaignSendTabs(await countCampaignSends("cmp-1"), null);
    expect(tabs.map((t) => [t.label, t.count])).toEqual([
      ["Tümü", 5],
      ["Başarısız", 2],
      ["Atlandı", 1],
      ["Kuyrukta", 1],
      ["Gönderildi", 1],
    ]);
  });

  it("keep the open tab even when the search empties it", () => {
    const empty = {
      total: 0,
      queued: 0,
      sending: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    };
    expect(campaignSendTabs(empty, "failed").map((t) => t.value)).toEqual([
      null,
      "failed",
    ]);
  });

  it("read only a known status from the URL", () => {
    expect(parseCampaignSendTab({ durum: "failed" })).toBe("failed");
    expect(parseCampaignSendTab({ durum: "draft" })).toBeNull();
    expect(parseCampaignSendTab({})).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONSENT_WITHDRAWN,
  FAKE_TABLES,
  POST_UNCONFIRMED,
  failNextRpc,
  fakeCampaignDb,
  resetFakeDb,
  rowsOf,
  seedRows,
  type FakeRow,
} from "./_stubs/campaign-emails-db";

/**
 * Campaign e-mail, end to end over an in-memory database: who gets queued,
 * what a re-queue does, how a run is batched and settled, and the one-click
 * way out that has to switch BOTH consent stores off.
 *
 * `renderEmail` is real — a message that leaves with a `[FIELD]` in it is
 * the failure worth catching. Delivery is stubbed at `deliverBatch`, which
 * is exactly the seam the runner posts through.
 */

vi.mock("@/lib/db", () => fakeCampaignDb());

const deliverBatch = vi.fn();
const sendCampaignMail = vi.fn();

vi.mock("@/lib/email/send", () => ({
  CAMPAIGN_TEMPLATES: [
    "kampanya-duyuru",
    "kampanya-bonus-damga",
    "kampanya-happy-hour",
    "kampanya-ikram",
    "kampanya-etkinlik",
    "kampanya-yeni-urun",
    "kampanya-indirim",
    "bulten-kampanya",
  ],
  deliverBatch,
  sendCampaignMail,
  unsubscribeUrlFor: (token: string) =>
    `https://laffogato.net/api/bulten/cikis?token=${encodeURIComponent(token)}`,
}));

const {
  AUDIENCE_TEMPLATE_MISMATCH,
  audiencesForTemplate,
  campaignFieldsSchema,
  campaignFromPost,
  countCampaignAudience,
  createCampaignEmail,
  deleteCampaignEmail,
  ensureCustomerUnsubToken,
  getCampaignEmail,
  previewCampaignEmail,
  queueCampaignEmail,
  resumePendingCampaigns,
  runCampaignEmail,
  scheduledAtInputValue,
  sendCampaignTest,
  updateCampaignEmail,
} = await import("@/lib/email/campaigns");
const { unsubscribeCustomerByToken } =
  await import("@/lib/customer/unsubscribe");
const { unsubscribeByToken } = await import("@/lib/newsletter/store");

type Message = {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
};

const SITE_URL = "https://laffogato.net";
const UNSUB_BASE = `${SITE_URL}/api/bulten/cikis?token=`;

/**
 * kampanya-duyuru — the template the post hook uses. These six sit outside
 * its optional blocks, so every one is required; the rest may be absent.
 */
const FIELDS = {
  KAMPANYA_EYEBROW: "KAMPANYA",
  KAMPANYA_BASLIK: "Eylül seçkisi",
  KAMPANYA_ALT: "Bu ay köşkte",
  KAMPANYA_METIN: "Bu ay köşkte üç yeni tat var.",
  KAMPANYA_BUTON: "Menüye göz at",
  KAMPANYA_URL: "https://laffogato.net/menu",
};

/** bulten-kampanya needs every one of these; nothing optional in that template. */
const BULTEN_FIELDS = {
  KAMPANYA_BASLIK: "Eylül seçkisi",
  KAMPANYA_METIN: "Bu ay köşkte üç yeni tat var.",
  KAMPANYA_BUTON: "Menüye göz at",
  KAMPANYA_URL: "https://laffogato.net/menu",
  KUPON_KODU: "EYLUL10",
  SON_KULLANIM: "30 Eylül 2026",
  URUN_1_AD: "Affogato Classico",
  URUN_1_NOT: "Sirena espresso, fior di latte gelato.",
  URUN_1_FIYAT: "250,00 ₺",
  URUN_2_AD: "Matcha Latte",
  URUN_2_NOT: "Tören derecesi matcha.",
  URUN_2_FIYAT: "220,00 ₺",
  URUN_3_AD: "Tiramisù",
  URUN_3_NOT: "Ev yapımı, günlük.",
  URUN_3_FIYAT: "240,00 ₺",
};

function member(email: string, over: FakeRow = {}): FakeRow {
  return {
    id: `c-${email}`,
    email,
    name: "Üye",
    isActive: true,
    emailVerified: true,
    notificationPrefs: {
      orderUpdates: true,
      marketing: true,
      newsletter: false,
    },
    marketingConsentAt: "2026-09-01T00:00:00.000Z",
    unsubToken: "",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "",
    ...over,
  };
}

function subscriber(email: string, over: FakeRow = {}): FakeRow {
  return {
    id: `n-${email}`,
    email,
    name: "Abone",
    source: "footer",
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    unsubscribedAt: "",
    consentAt: "2026-09-01T00:00:00.000Z",
    consentIp: "1.1.1.1",
    consentText: "…",
    unsubToken: `tok-${email}`,
    ...over,
  };
}

function manyMembers(n: number): FakeRow[] {
  return Array.from({ length: n }, (_, i) =>
    member(`uye${String(i + 1).padStart(3, "0")}@ornek.com`, {
      name: `Üye ${i + 1}`,
    }),
  );
}

async function draft(over: Record<string, unknown> = {}) {
  return createCampaignEmail({
    template: "kampanya-duyuru",
    audience: "marketing",
    fields: FIELDS,
    createdBy: "sahip@laffogato.net",
    ...over,
  });
}

function sends(): FakeRow[] {
  return rowsOf(FAKE_TABLES.campaignEmailSends);
}

function calls(): Array<[Message[], string]> {
  return deliverBatch.mock.calls as Array<[Message[], string]>;
}

/** Rewrites every row of a table in place — the clock, a flag, a status. */
function patchRows(table: string, patch: (row: FakeRow) => FakeRow): void {
  seedRows(table, rowsOf(table).map(patch));
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function memberToken(email: string): string {
  return String(
    rowsOf(FAKE_TABLES.customers).find((c) => c.email === email)?.unsubToken ??
      "",
  );
}

beforeEach(() => {
  resetFakeDb();
  deliverBatch.mockReset();
  deliverBatch.mockImplementation(async (messages: Message[], key: string) => ({
    ok: true,
    ids: messages.map((_, i) => `${key}-${i}`),
  }));
  sendCampaignMail.mockReset();
  sendCampaignMail.mockResolvedValue({ ok: true });
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("CAMPAIGN_EMAIL_DRY_RUN", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("campaignFieldsSchema", () => {
  it("strips unknown keys, trims, and drops empty values", () => {
    const out = campaignFieldsSchema.parse({
      KAMPANYA_BASLIK: "  Başlık  ",
      KAMPANYA_METIN: "",
      AD: "sızma",
      PASSWORD: "x",
    });
    expect(out).toEqual({
      KAMPANYA_BASLIK: "Başlık",
      KAMPANYA_URL: `${SITE_URL}/kampanyalar`,
    });
  });

  it("requires a title and caps lengths", () => {
    expect(campaignFieldsSchema.safeParse({}).success).toBe(false);
    expect(
      campaignFieldsSchema.safeParse({
        KAMPANYA_BASLIK: "x".repeat(81),
      }).success,
    ).toBe(false);
  });

  it("accepts only https links and keeps a given button URL", () => {
    for (const bad of ["http://laffogato.net", "javascript:alert(1)", "menu"]) {
      expect(
        campaignFieldsSchema.safeParse({
          KAMPANYA_BASLIK: "x",
          KAMPANYA_URL: bad,
        }).success,
      ).toBe(false);
      expect(
        campaignFieldsSchema.safeParse({
          KAMPANYA_BASLIK: "x",
          KAMPANYA_GORSEL_URL: bad,
        }).success,
      ).toBe(false);
    }
    const out = campaignFieldsSchema.parse({
      KAMPANYA_BASLIK: "x",
      KAMPANYA_URL: "https://laffogato.net/menu",
      KAMPANYA_GORSEL_URL: "https://laffogato.net/email/hero.jpg",
    });
    expect(out.KAMPANYA_URL).toBe("https://laffogato.net/menu");
    expect(out.KAMPANYA_GORSEL_URL).toBe(
      "https://laffogato.net/email/hero.jpg",
    );
  });
});

describe("audience", () => {
  it("mails only active, verified members with the flag on and a consent stamp", async () => {
    seedRows(FAKE_TABLES.customers, [
      member("a@ornek.com"),
      member("b@ornek.com", { marketingConsentAt: "" }),
      member("c@ornek.com", { emailVerified: false }),
      member("d@ornek.com", { isActive: false }),
      member("e@ornek.com", {
        notificationPrefs: {
          orderUpdates: true,
          marketing: false,
          newsletter: true,
        },
      }),
      member("guest@laffogato.local"),
      member("deleted-c-9@anon.local"),
      member("F@Ornek.com"),
    ]);
    expect(await countCampaignAudience("marketing")).toBe(2);

    const c = await draft();
    const { total } = await queueCampaignEmail(c.id);
    expect(total).toBe(2);
    expect(
      sends()
        .map((r) => r.email)
        .sort(),
    ).toEqual(["a@ornek.com", "f@ornek.com"]);
    expect(sends().every((r) => r.recipientKind === "customer")).toBe(true);
  });

  it("reads the newsletter preference for bulten-kampanya, with the bulletin's own consent record behind it", async () => {
    const newsletterOn = {
      orderUpdates: true,
      marketing: false,
      newsletter: true,
    };
    seedRows(FAKE_TABLES.customers, [
      // Marketing consent alone does not open the bulletin.
      member("a@ornek.com"),
      // The flag plus a consented subscriber row: in.
      member("e@ornek.com", {
        notificationPrefs: newsletterOn,
        marketingConsentAt: "",
      }),
      // The flag alone — a legacy app subscriber with nothing provable: out
      // until they toggle again and the row gets written.
      member("g@ornek.com", {
        notificationPrefs: newsletterOn,
        marketingConsentAt: "",
      }),
      // A row that has since been switched off is no consent either.
      member("h@ornek.com", {
        notificationPrefs: newsletterOn,
        marketingConsentAt: "",
      }),
    ]);
    seedRows(FAKE_TABLES.newsletterSubscribers, [
      subscriber("E@ornek.com"),
      subscriber("h@ornek.com", { isActive: false }),
    ]);
    // bulten-kampanya → pref 'newsletter'
    expect(await countCampaignAudience("marketing", "newsletter")).toBe(1);
    const c = await draft({
      template: "bulten-kampanya",
      fields: BULTEN_FIELDS,
    });
    await queueCampaignEmail(c.id);
    expect(sends().map((r) => r.email)).toEqual(["e@ornek.com"]);
    // The member row still wins for 'both': the account's own link.
    expect(sends()[0].recipientKind).toBe("customer");
  });

  it("takes subscribers only with consent and a token", async () => {
    seedRows(FAKE_TABLES.newsletterSubscribers, [
      subscriber("n1@ornek.com"),
      subscriber("n2@ornek.com", { consentAt: "" }),
      subscriber("n3@ornek.com", { unsubToken: "" }),
      subscriber("n4@ornek.com", { isActive: false }),
    ]);
    expect(await countCampaignAudience("newsletter", "newsletter")).toBe(1);
    const c = await draft({
      template: "bulten-kampanya",
      audience: "newsletter",
      fields: BULTEN_FIELDS,
    });
    await queueCampaignEmail(c.id);
    expect(sends()).toHaveLength(1);
    expect(sends()[0]).toMatchObject({
      email: "n1@ornek.com",
      recipientKind: "subscriber",
      name: "Abone",
      unsubUrl: `${UNSUB_BASE}tok-n1@ornek.com`,
    });
  });

  it("dedupes 'both' on the address and lets the member row win", async () => {
    // The bulletin is the one template that may go to both stores; a member
    // reaches it with the newsletter flag and the subscriber row behind it.
    seedRows(FAKE_TABLES.customers, [
      member("a@ornek.com", {
        name: "Ayşe",
        notificationPrefs: {
          orderUpdates: true,
          marketing: false,
          newsletter: true,
        },
      }),
    ]);
    seedRows(FAKE_TABLES.newsletterSubscribers, [
      subscriber("A@ornek.com", { name: "Ayşe (abone)" }),
      subscriber("n1@ornek.com"),
    ]);
    expect(await countCampaignAudience("both", "newsletter")).toBe(2);
    const c = await draft({
      template: "bulten-kampanya",
      audience: "both",
      fields: BULTEN_FIELDS,
    });
    await queueCampaignEmail(c.id);
    const rows = sends().sort((x, y) =>
      String(x.email).localeCompare(String(y.email)),
    );
    expect(rows.map((r) => [r.email, r.recipientKind, r.name])).toEqual([
      ["a@ornek.com", "customer", "Ayşe"],
      ["n1@ornek.com", "subscriber", "Abone"],
    ]);
  });

  it("mints the member's unsubscribe token at queue time and puts it in the link", async () => {
    seedRows(FAKE_TABLES.customers, [member("a@ornek.com")]);
    const c = await draft();
    await queueCampaignEmail(c.id);
    const token = String(rowsOf(FAKE_TABLES.customers)[0].unsubToken);
    expect(token.length).toBeGreaterThanOrEqual(48);
    expect(sends()[0].unsubUrl).toBe(`${UNSUB_BASE}${token}`);
    // A second campaign reuses the same token: one link per member, for life.
    const d = await draft();
    await queueCampaignEmail(d.id);
    expect(rowsOf(FAKE_TABLES.customers)[0].unsubToken).toBe(token);
  });
});

describe("queue", () => {
  it("is idempotent: a second Gönder adds nobody twice", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(3));
    const c = await draft();
    const first = await queueCampaignEmail(c.id);
    const second = await queueCampaignEmail(c.id);
    expect(first.total).toBe(3);
    expect(second.total).toBe(3);
    expect(sends()).toHaveLength(3);
    const fresh = await getCampaignEmail(c.id);
    expect(fresh?.status).toBe("queued");
    expect(fresh?.queuedAt).not.toBe("");
  });

  it("refuses to queue a campaign the template cannot render, and queues nothing", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(2));
    const { KAMPANYA_METIN: _dropped, ...incomplete } = FIELDS;
    const c = await draft({ fields: incomplete });
    await expect(queueCampaignEmail(c.id)).rejects.toThrow(/doldurulmamış/);
    expect(sends()).toHaveLength(0);
    expect((await getCampaignEmail(c.id))?.status).toBe("draft");
  });

  it("locks the draft once queued", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(1));
    const c = await draft();
    expect(
      await updateCampaignEmail(c.id, {
        fields: { ...FIELDS, KAMPANYA_BASLIK: "Yeni başlık" },
      }),
    ).toMatchObject({ subject: "Yeni başlık" });
    await queueCampaignEmail(c.id);
    expect(await updateCampaignEmail(c.id, { fields: FIELDS })).toBeNull();
    expect(await deleteCampaignEmail(c.id)).toBe(false);
  });

  it("adds a newcomer on re-queue in a batch of its own", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(150));
    const c = await draft();
    await queueCampaignEmail(c.id);
    // The first batch is out and the campaign is still mid-send when one
    // more member opts in and the operator presses Gönder again.
    await runCampaignEmail(c.id, { deadlineMs: 0, batchDelayMs: 0 });
    // Appended, not re-seeded: the 150 keep the tokens their queued links
    // carry (a re-minted token would rightly leave those rows skipped).
    seedRows(FAKE_TABLES.customers, [
      ...rowsOf(FAKE_TABLES.customers),
      member("yeni@ornek.com"),
    ]);
    const { total } = await queueCampaignEmail(c.id);
    expect(total).toBe(151);
    // Batches 0 and 1 exist; the newcomer must not slip into either — batch
    // 0's key has already been used for batch 0's addresses.
    const late = sends().find((r) => r.email === "yeni@ornek.com");
    expect(late).toMatchObject({ status: "queued", batchNo: 2 });
    expect(sends().filter((r) => r.status === "sent")).toHaveLength(100);

    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(new Set(calls().map(([, key]) => key)).size).toBe(3);
    expect((await getCampaignEmail(c.id))?.sentCount).toBe(151);
  });

  it("refuses to re-queue a campaign that has already gone out", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(1));
    const c = await draft();
    await queueCampaignEmail(c.id);
    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    await expect(queueCampaignEmail(c.id)).rejects.toThrow(/Gönderildi/);
  });

  it("puts a skipped row back only for a recipient the rule still names, with their current link", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    seedRows(FAKE_TABLES.customers, [
      member("a@ornek.com"),
      member("b@ornek.com"),
      member("c@ornek.com"),
    ]);
    const c = await draft();
    await queueCampaignEmail(c.id);
    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(sends().every((r) => r.status === "skipped")).toBe(true);
    const oldTokenA = memberToken("a@ornek.com");

    // Meanwhile: a unsubscribes through the link and later opts in again on
    // the site (new consent, no token yet); b switches marketing off.
    expect(await unsubscribeCustomerByToken(oldTokenA)).toBe("a@ornek.com");
    patchRows(FAKE_TABLES.customers, (row) =>
      row.email === "a@ornek.com"
        ? {
            ...row,
            notificationPrefs: {
              orderUpdates: true,
              marketing: true,
              newsletter: false,
            },
            marketingConsentAt: "2026-09-10T00:00:00.000Z",
          }
        : row.email === "b@ornek.com"
          ? {
              ...row,
              notificationPrefs: {
                orderUpdates: true,
                marketing: false,
                newsletter: false,
              },
            }
          : row,
    );

    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const { total } = await queueCampaignEmail(c.id);
    expect(total).toBe(3);
    const byEmail = Object.fromEntries(sends().map((r) => [r.email, r]));
    // a: back in the queue, with the token minted for the new consent — not
    // the spent one that was in the row.
    const newTokenA = memberToken("a@ornek.com");
    expect(newTokenA).not.toBe("");
    expect(newTokenA).not.toBe(oldTokenA);
    expect(byEmail["a@ornek.com"]).toMatchObject({
      status: "queued",
      unsubUrl: `${UNSUB_BASE}${newTokenA}`,
    });
    // b: stays skipped, and the row says why now.
    expect(byEmail["b@ornek.com"]).toMatchObject({
      status: "skipped",
      error: CONSENT_WITHDRAWN,
    });
    expect(byEmail["c@ornek.com"].status).toBe("queued");
    // Back under a fresh batch number, never their old one: the rule is the
    // same whether the old batch was posted or not, and here it was not.
    expect(byEmail["a@ornek.com"].batchNo).toBe(1);
    expect(byEmail["c@ornek.com"].batchNo).toBe(1);

    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(calls()).toHaveLength(1);
    expect(calls()[0][1]).toBe(`cmp-${c.id}-b1`);
    expect(calls()[0][0].map((m) => m.to)).toEqual([
      "a@ornek.com",
      "c@ornek.com",
    ]);
    expect(calls()[0][0][0].html).toContain(`${UNSUB_BASE}${newTokenA}`);
  });
});

describe("scheduling — the special days", () => {
  /**
   * The operator could compose a campaign but not say when it should go, so
   * Anneler Günü, yılbaşı and 14 Şubat all meant standing at the panel that
   * morning. One column and the hourly cron close that; no special-days
   * table, because the campaign machine was never the missing part.
   */

  it("reads a zoneless datetime-local as ISTANBUL wall time, not the server's", async () => {
    // The panel's input carries no zone and the function runs on UTC. Read
    // naively, an operator's 09:00 would have gone out at 12:00 in Tuzla.
    const c = await draft({ scheduledAt: "2027-02-14T09:00" });
    expect(c.scheduledAt).toBe("2027-02-14T06:00:00.000Z");
    // …and back out again as the same string the operator typed.
    expect(scheduledAtInputValue(c.scheduledAt)).toBe("2027-02-14T09:00");
  });

  it("keeps an unreadable schedule out rather than guessing an hour", async () => {
    const c = await draft({ scheduledAt: "yarın sabah" });
    expect(c.scheduledAt).toBe("");
  });

  it("queues a draft whose moment has passed, and sends it in the same pass", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(2));
    const c = await draft({ scheduledAt: "2026-09-16T09:00" });
    expect((await getCampaignEmail(c.id))?.status).toBe("draft");

    const resumed = await resumePendingCampaigns({
      deadlineMs: 60_000,
      now: new Date("2026-09-16T06:30:00.000Z"),
    });

    expect(resumed).toEqual([{ id: c.id, sent: 2, failed: 0, remaining: 0 }]);
    const fresh = await getCampaignEmail(c.id);
    expect(fresh?.status).toBe("sent");
    expect(fresh?.total).toBe(2);
    // The record of what was asked for survives the send.
    expect(fresh?.scheduledAt).toBe("2026-09-16T06:00:00.000Z");
  });

  it("leaves a draft alone until its moment, and never touches an unscheduled one", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(2));
    const later = await draft({ scheduledAt: "2026-09-16T09:00" });
    const manual = await draft();

    await resumePendingCampaigns({
      deadlineMs: 60_000,
      now: new Date("2026-09-16T05:59:00.000Z"),
    });

    expect((await getCampaignEmail(later.id))?.status).toBe("draft");
    expect((await getCampaignEmail(manual.id))?.status).toBe("draft");
    expect(calls()).toHaveLength(0);
  });

  it("clears the schedule of a draft that cannot be queued, so the next hour does not retry it forever", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(1));
    const { KAMPANYA_METIN: _dropped, ...incomplete } = FIELDS;
    const broken = await draft({
      fields: incomplete,
      scheduledAt: "2026-09-16T09:00",
    });
    const healthy = await draft({ scheduledAt: "2026-09-16T09:00" });

    const resumed = await resumePendingCampaigns({
      deadlineMs: 60_000,
      now: new Date("2026-09-16T06:30:00.000Z"),
    });

    // The broken one is put back in the operator's hands, naming the field…
    const failed = await getCampaignEmail(broken.id);
    expect(failed?.status).toBe("draft");
    expect(failed?.scheduledAt).toBe("");
    expect(failed?.lastError).toMatch(/doldurulmamış/);
    // …and it did not take the other campaign down with it.
    expect(resumed.map((r) => r.id)).toEqual([healthy.id]);
    expect((await getCampaignEmail(healthy.id))?.status).toBe("sent");
  });

  it("a scheduled draft edited back to blank goes back to being sent by hand", async () => {
    const c = await draft({ scheduledAt: "2026-09-16T09:00" });
    const cleared = await updateCampaignEmail(c.id, { scheduledAt: "" });
    expect(cleared?.scheduledAt).toBe("");
    await resumePendingCampaigns({
      deadlineMs: 60_000,
      now: new Date("2026-09-20T06:30:00.000Z"),
    });
    expect((await getCampaignEmail(c.id))?.status).toBe("draft");
  });
});

describe("template and audience", () => {
  it("sends the seven kampanya-* layouts to members only, and the bulletin to anyone", () => {
    expect(audiencesForTemplate("kampanya-duyuru")).toEqual(["marketing"]);
    expect(audiencesForTemplate("kampanya-indirim")).toEqual(["marketing"]);
    expect([...audiencesForTemplate("bulten-kampanya")].sort()).toEqual([
      "both",
      "marketing",
      "newsletter",
    ]);
  });

  it("refuses a kampanya-* draft aimed at bulletin subscribers, on create and on edit", async () => {
    await expect(draft({ audience: "newsletter" })).rejects.toThrow(
      AUDIENCE_TEMPLATE_MISMATCH,
    );
    await expect(draft({ audience: "both" })).rejects.toThrow(
      AUDIENCE_TEMPLATE_MISMATCH,
    );
    expect(rowsOf(FAKE_TABLES.campaignEmails)).toHaveLength(0);

    const c = await draft();
    await expect(
      updateCampaignEmail(c.id, { audience: "newsletter" }),
    ).rejects.toThrow(AUDIENCE_TEMPLATE_MISMATCH);
    // Switching a bulletin draft onto a kampanya layout is the same mistake.
    const b = await draft({
      template: "bulten-kampanya",
      audience: "both",
      fields: BULTEN_FIELDS,
    });
    await expect(
      updateCampaignEmail(b.id, { template: "kampanya-duyuru" }),
    ).rejects.toThrow(AUDIENCE_TEMPLATE_MISMATCH);
    expect((await getCampaignEmail(b.id))?.audience).toBe("both");
  });
});

describe("consent between queue and send", () => {
  it("a member who follows the link after Gönder is skipped, not mailed, and the row says why", async () => {
    seedRows(FAKE_TABLES.customers, [
      member("a@ornek.com"),
      member("b@ornek.com"),
    ]);
    const c = await draft();
    await queueCampaignEmail(c.id);
    // Between the queue and the batch: a spends their one-click token.
    expect(await unsubscribeCustomerByToken(memberToken("a@ornek.com"))).toBe(
      "a@ornek.com",
    );

    const result = await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(calls()).toHaveLength(1);
    expect(calls()[0][0].map((m) => m.to)).toEqual(["b@ornek.com"]);
    const a = sends().find((r) => r.email === "a@ornek.com");
    expect(a).toMatchObject({ status: "skipped", error: CONSENT_WITHDRAWN });
    expect(result).toEqual({ sent: 1, failed: 0, remaining: 0 });
    expect(await getCampaignEmail(c.id)).toMatchObject({
      status: "sent",
      sentCount: 1,
      failedCount: 1,
    });
  });

  it("a member who switches marketing off in the app after Gönder is skipped", async () => {
    seedRows(FAKE_TABLES.customers, [
      member("a@ornek.com"),
      member("b@ornek.com"),
    ]);
    const c = await draft();
    await queueCampaignEmail(c.id);
    patchRows(FAKE_TABLES.customers, (row) =>
      row.email === "a@ornek.com"
        ? {
            ...row,
            notificationPrefs: {
              orderUpdates: true,
              marketing: false,
              newsletter: false,
            },
            marketingConsentAt: "",
          }
        : row,
    );

    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(calls()[0][0].map((m) => m.to)).toEqual(["b@ornek.com"]);
    expect(sends().find((r) => r.email === "a@ornek.com")?.status).toBe(
      "skipped",
    );
  });

  it("a subscriber who unsubscribes after Gönder is skipped", async () => {
    seedRows(FAKE_TABLES.newsletterSubscribers, [
      subscriber("n1@ornek.com"),
      subscriber("n2@ornek.com"),
    ]);
    const c = await draft({
      template: "bulten-kampanya",
      audience: "newsletter",
      fields: BULTEN_FIELDS,
    });
    await queueCampaignEmail(c.id);
    expect(await unsubscribeByToken("tok-n1@ornek.com")).toBe("n1@ornek.com");

    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(calls()[0][0].map((m) => m.to)).toEqual(["n2@ornek.com"]);
    expect(sends().find((r) => r.email === "n1@ornek.com")).toMatchObject({
      status: "skipped",
      error: CONSENT_WITHDRAWN,
    });
  });

  it("a stale link is a dead link: a re-minted token means the row is skipped", async () => {
    seedRows(FAKE_TABLES.customers, [member("a@ornek.com")]);
    const c = await draft();
    await queueCampaignEmail(c.id);
    // The account keeps its consent but its token changed underneath the
    // queued row — the row's link would answer "Bağlantı geçersiz".
    patchRows(FAKE_TABLES.customers, (row) => ({
      ...row,
      unsubToken: "fresh-token",
    }));
    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(calls()).toHaveLength(0);
    expect(sends()[0]).toMatchObject({
      status: "skipped",
      error: CONSENT_WITHDRAWN,
    });
    // Nobody was mailed and nothing was attempted: that is a failed campaign.
    expect((await getCampaignEmail(c.id))?.status).toBe("failed");
  });

  it("everyone withdrawing leaves a failed campaign, not a sent one", async () => {
    seedRows(FAKE_TABLES.customers, [member("a@ornek.com")]);
    const c = await draft();
    await queueCampaignEmail(c.id);
    expect(await unsubscribeCustomerByToken(memberToken("a@ornek.com"))).toBe(
      "a@ornek.com",
    );
    const result = await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(result).toEqual({ sent: 0, failed: 0, remaining: 0 });
    expect(await getCampaignEmail(c.id)).toMatchObject({
      status: "failed",
      sentCount: 0,
      failedCount: 1,
    });
  });
});

describe("a batch posted but never settled", () => {
  async function postThenLoseTheMark() {
    seedRows(FAKE_TABLES.customers, manyMembers(2));
    const c = await draft();
    await queueCampaignEmail(c.id);
    // The provider accepts the batch; the mark that would record it fails.
    failNextRpc("campaign_email_mark");
    await expect(runCampaignEmail(c.id, { batchDelayMs: 0 })).rejects.toThrow();
    expect(calls()).toHaveLength(1);
    expect(
      sends().every((r) => r.status === "sending" && r.postedAt !== ""),
    ).toBe(true);
    expect((await getCampaignEmail(c.id))?.status).toBe("failed");
    return c;
  }

  it("records the hand-off before the POST", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(1));
    const c = await draft();
    await queueCampaignEmail(c.id);
    deliverBatch.mockImplementationOnce(async (messages: Message[], key) => {
      // Seen from inside the provider call: the row already says posted.
      expect(sends()[0].postedAt).not.toBe("");
      return { ok: true, ids: messages.map((_, i) => `${key}-${i}`) };
    });
    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(sends()[0].status).toBe("sent");
  });

  it("is re-posted under the same key when 'Yeniden gönder' comes inside the provider's window", async () => {
    const c = await postThenLoseTheMark();
    // An hour later the rows count as abandoned; the key is 21 h old —
    // inside the 22 h the runner allows itself of the provider's 24.
    const posted = hoursAgo(21);
    patchRows(FAKE_TABLES.campaignEmailSends, (r) => ({
      ...r,
      claimedAt: hoursAgo(1),
      postedAt: posted,
    }));

    await queueCampaignEmail(c.id);
    const result = await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(calls()).toHaveLength(2);
    expect(calls()[1][1]).toBe(calls()[0][1]);
    expect(result).toEqual({ sent: 2, failed: 0, remaining: 0 });
    expect(sends().every((r) => r.status === "sent")).toBe(true);
    // The first hand-off time stands.
    expect(sends()[0].postedAt).toBe(posted);
  });

  it("is never re-posted once the window has closed: failed, for a person to look at", async () => {
    const c = await postThenLoseTheMark();
    // 23 h 50 min: still inside the provider's 24 hours at claim time, but
    // the POST comes after the render, the pause and up to three back-offs,
    // on a clock that is not the provider's — outside the 22 h the runner
    // trusts, so it is settled, not re-posted.
    patchRows(FAKE_TABLES.campaignEmailSends, (r) => ({
      ...r,
      claimedAt: hoursAgo(23.8),
      postedAt: hoursAgo(23.8),
    }));

    await queueCampaignEmail(c.id);
    const result = await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(calls()).toHaveLength(1);
    expect(result).toEqual({ sent: 0, failed: 0, remaining: 0 });
    expect(
      sends().every(
        (r) => r.status === "failed" && r.error === POST_UNCONFIRMED,
      ),
    ).toBe(true);
    expect(await getCampaignEmail(c.id)).toMatchObject({
      status: "failed",
      failedCount: 2,
    });
    // Failed is final: another Gönder does not resurrect the rows.
    await queueCampaignEmail(c.id);
    expect(sends().every((r) => r.status === "failed")).toBe(true);
  });

  it("does not consent-skip a posted row: it is reclaimed or settled, never mailed afresh", async () => {
    const c = await postThenLoseTheMark();
    const [first] = sends();
    patchRows(FAKE_TABLES.campaignEmailSends, (r) => ({
      ...r,
      claimedAt: hoursAgo(1),
    }));
    // One recipient withdraws after the batch was already handed over.
    patchRows(FAKE_TABLES.customers, (row) =>
      row.email === first.email
        ? {
            ...row,
            notificationPrefs: {
              orderUpdates: true,
              marketing: false,
              newsletter: false,
            },
          }
        : row,
    );
    await queueCampaignEmail(c.id);
    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    // Same key, same two addresses — the provider dedupes the retry; a
    // changed set under the same key would not be the same request.
    expect(calls()).toHaveLength(2);
    expect(calls()[1][0].map((m) => m.to)).toEqual(
      calls()[0][0].map((m) => m.to),
    );
  });
});

describe("a consent-skipped row that comes back", () => {
  // The claim skips a single row for consent, so a 'skipped' row may belong
  // to a batch that WAS posted for the others. Put back under that number it
  // would go up under a used key with a different address set — refused by
  // the provider inside its window, delivered as new outside it. So a row
  // that comes back gets a fresh batch number, after everything in use.
  function reconsent(email: string): void {
    patchRows(FAKE_TABLES.customers, (row) =>
      row.email === email
        ? {
            ...row,
            notificationPrefs: {
              orderUpdates: true,
              marketing: true,
              newsletter: false,
            },
            marketingConsentAt: "2026-09-08T15:00:00.000Z",
          }
        : row,
    );
  }

  /** Batch numbers of rows that were handed to the provider. */
  function postedBatches(): Set<number> {
    return new Set(
      sends()
        .filter((r) => r.postedAt !== "")
        .map((r) => Number(r.batchNo)),
    );
  }

  it("after a lost mark: the posted key goes up again with its own set, the returner under a key of its own", async () => {
    seedRows(FAKE_TABLES.customers, [
      member("a@ornek.com"),
      member("b@ornek.com"),
      member("c@ornek.com"),
    ]);
    const c = await draft();
    await queueCampaignEmail(c.id);
    // a follows the link after Gönder; b and c go out under b0; the mark is
    // lost on the way back.
    expect(await unsubscribeCustomerByToken(memberToken("a@ornek.com"))).toBe(
      "a@ornek.com",
    );
    failNextRpc("campaign_email_mark");
    await expect(runCampaignEmail(c.id, { batchDelayMs: 0 })).rejects.toThrow();
    expect(calls()).toHaveLength(1);
    expect(calls()[0][0].map((m) => m.to)).toEqual([
      "b@ornek.com",
      "c@ornek.com",
    ]);
    expect(sends().find((r) => r.email === "a@ornek.com")).toMatchObject({
      status: "skipped",
      batchNo: 0,
      postedAt: "",
    });

    // a opts in again on the site; an hour later, "Yeniden gönder".
    reconsent("a@ornek.com");
    patchRows(FAKE_TABLES.campaignEmailSends, (r) => ({
      ...r,
      claimedAt: hoursAgo(1),
    }));
    await queueCampaignEmail(c.id);
    const back = sends().find((r) => r.email === "a@ornek.com");
    expect(back).toMatchObject({ status: "queued", batchNo: 1 });
    expect(postedBatches().has(Number(back?.batchNo))).toBe(false);

    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(calls()).toHaveLength(3);
    // b0 again: the same key with the same two addresses — a retry the
    // provider dedupes, not a new request.
    expect(calls()[1][1]).toBe(calls()[0][1]);
    expect(calls()[1][0].map((m) => m.to)).toEqual(
      calls()[0][0].map((m) => m.to),
    );
    // a alone, under a key never used before.
    expect(calls()[2][1]).toBe(`cmp-${c.id}-b1`);
    expect(calls()[2][0].map((m) => m.to)).toEqual(["a@ornek.com"]);
    expect(sends().every((r) => r.status === "sent")).toBe(true);
    expect(await getCampaignEmail(c.id)).toMatchObject({
      status: "sent",
      sentCount: 3,
      failedCount: 0,
    });
  });

  it("after a deadline stop: comes back after the batches still waiting, never into the one that went out", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(150));
    const c = await draft();
    await queueCampaignEmail(c.id);
    expect(
      await unsubscribeCustomerByToken(memberToken("uye001@ornek.com")),
    ).toBe("uye001@ornek.com");
    // One batch, then out of time: 99 went out under b0, b1 waits for the
    // cron, uye001 is skipped.
    expect(
      await runCampaignEmail(c.id, { deadlineMs: 0, batchDelayMs: 0 }),
    ).toMatchObject({ sent: 99, remaining: 50 });
    expect(sends().find((r) => r.email === "uye001@ornek.com")).toMatchObject({
      status: "skipped",
      batchNo: 0,
    });

    // uye001 opts in again; "Gönder" is pressed once more while 'sending'.
    reconsent("uye001@ornek.com");
    await queueCampaignEmail(c.id);
    const back = sends().find((r) => r.email === "uye001@ornek.com");
    expect(back).toMatchObject({ status: "queued", batchNo: 2 });
    expect(postedBatches().has(Number(back?.batchNo))).toBe(false);

    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(calls().map(([m, key]) => [key, m.length])).toEqual([
      [`cmp-${c.id}-b0`, 99],
      [`cmp-${c.id}-b1`, 50],
      [`cmp-${c.id}-b2`, 1],
    ]);
    expect(calls()[2][0][0].to).toBe("uye001@ornek.com");
    expect(sends().every((r) => r.status === "sent")).toBe(true);
    expect(await getCampaignEmail(c.id)).toMatchObject({
      status: "sent",
      sentCount: 150,
      failedCount: 0,
    });
  });

  it("more than a hundred coming back are chunked into batches of their own", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(230));
    const c = await draft();
    await queueCampaignEmail(c.id);
    // Every member's token is rotated under the queued rows: each stored
    // link is dead, so the first claim skips all 230 at once and nothing is
    // posted — a failed campaign with three batch numbers in use.
    patchRows(FAKE_TABLES.customers, (row) => ({
      ...row,
      unsubToken: `yeni-${row.email}`,
    }));
    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(sends().every((r) => r.status === "skipped")).toBe(true);
    expect(calls()).toHaveLength(0);
    expect((await getCampaignEmail(c.id))?.status).toBe("failed");

    await queueCampaignEmail(c.id);
    // Batches 0–2 were in use; the 230 come back as 3, 4 and 5, with the
    // links they carry now.
    const rows = sends();
    const batches = rows.map((r) => Number(r.batchNo));
    expect(Math.min(...batches)).toBe(3);
    expect([3, 4, 5].map((b) => batches.filter((n) => n === b).length)).toEqual(
      [100, 100, 30],
    );
    expect(
      rows.every((r) => r.unsubUrl === `${UNSUB_BASE}yeni-${r.email}`),
    ).toBe(true);
    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(calls().map(([, key]) => key)).toEqual([
      `cmp-${c.id}-b3`,
      `cmp-${c.id}-b4`,
      `cmp-${c.id}-b5`,
    ]);
    expect((await getCampaignEmail(c.id))?.sentCount).toBe(230);
  });
});

describe("runCampaignEmail", () => {
  it("posts at most 100 per batch under a stable idempotency key and settles every row", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(250));
    const c = await draft();
    await queueCampaignEmail(c.id);

    const result = await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(result).toEqual({ sent: 250, failed: 0, remaining: 0 });
    expect(calls()).toHaveLength(3);
    expect(calls().map(([m]) => m.length)).toEqual([100, 100, 50]);
    expect(calls().map(([, key]) => key)).toEqual([
      `cmp-${c.id}-b0`,
      `cmp-${c.id}-b1`,
      `cmp-${c.id}-b2`,
    ]);

    const rows = sends();
    expect(rows.every((r) => r.status === "sent" && r.sentAt !== "")).toBe(
      true,
    );
    // Provider ids land on the right rows: batch order is e-mail order.
    const batch0 = rows
      .filter((r) => r.batchNo === 0)
      .sort((x, y) => String(x.email).localeCompare(String(y.email)));
    batch0.forEach((r, i) => {
      expect(r.providerId).toBe(`cmp-${c.id}-b0-${i}`);
    });

    const fresh = await getCampaignEmail(c.id);
    expect(fresh).toMatchObject({
      status: "sent",
      total: 250,
      sentCount: 250,
      failedCount: 0,
    });
    expect(fresh?.sentAt).not.toBe("");
  });

  it("renders each message for its recipient, with that recipient's own way out", async () => {
    seedRows(FAKE_TABLES.customers, [member("eda@ornek.com", { name: "Eda" })]);
    const c = await draft();
    await queueCampaignEmail(c.id);
    await runCampaignEmail(c.id, { batchDelayMs: 0 });

    const [messages] = calls()[0];
    const token = String(rowsOf(FAKE_TABLES.customers)[0].unsubToken);
    expect(messages[0]).toMatchObject({
      to: "eda@ornek.com",
      subject: "Eylül seçkisi",
      unsubscribeUrl: `${UNSUB_BASE}${token}`,
    });
    expect(messages[0].html).toContain("Eda");
    expect(messages[0].html).toContain(`${UNSUB_BASE}${token}`);
    expect(messages[0].text).toContain(`${UNSUB_BASE}${token}`);
    expect(messages[0].html).not.toMatch(/\[[A-Z0-9_]+\]/);
  });

  it("waits out a 429 and retries the SAME key", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(2));
    const c = await draft();
    await queueCampaignEmail(c.id);
    deliverBatch
      .mockResolvedValueOnce({ ok: false, error: "rate limited", status: 429 })
      .mockImplementationOnce(async (messages: Message[], key: string) => ({
        ok: true,
        ids: messages.map((_, i) => `${key}-${i}`),
      }));

    const result = await runCampaignEmail(c.id, {
      batchDelayMs: 0,
      retryDelayMs: 0,
    });
    expect(result).toEqual({ sent: 2, failed: 0, remaining: 0 });
    expect(calls()).toHaveLength(2);
    expect(calls()[0][1]).toBe(calls()[1][1]);
    expect(sends().every((r) => r.status === "sent")).toBe(true);
  });

  it("gives up a batch after three 429 retries and records why", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(2));
    const c = await draft();
    await queueCampaignEmail(c.id);
    deliverBatch.mockResolvedValue({
      ok: false,
      error: "rate limited",
      status: 429,
    });

    const result = await runCampaignEmail(c.id, {
      batchDelayMs: 0,
      retryDelayMs: 0,
    });
    expect(calls()).toHaveLength(4);
    expect(result).toEqual({ sent: 0, failed: 2, remaining: 0 });
    expect(
      sends().every((r) => r.status === "failed" && r.error === "rate limited"),
    ).toBe(true);
    // Nothing left the building: that is a failed campaign, not a sent one.
    expect((await getCampaignEmail(c.id))?.status).toBe("failed");
  });

  it("stops at the deadline with the status still 'sending', and the cron finishes it", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(250));
    const c = await draft();
    await queueCampaignEmail(c.id);

    const first = await runCampaignEmail(c.id, {
      deadlineMs: 0,
      batchDelayMs: 0,
    });
    expect(first).toEqual({ sent: 100, failed: 0, remaining: 150 });
    expect((await getCampaignEmail(c.id))?.status).toBe("sending");
    expect(calls()).toHaveLength(1);

    const resumed = await resumePendingCampaigns({ deadlineMs: 60_000 });
    expect(resumed).toEqual([{ id: c.id, sent: 150, failed: 0, remaining: 0 }]);
    expect((await getCampaignEmail(c.id))?.status).toBe("sent");
    // No batch was posted twice.
    expect(new Set(calls().map(([, key]) => key)).size).toBe(3);
  });

  it("does nothing for a campaign that is not queued", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(1));
    const c = await draft();
    expect(await runCampaignEmail(c.id)).toEqual({
      sent: 0,
      failed: 0,
      remaining: 0,
    });
    expect(calls()).toHaveLength(0);
  });

  it("leaves a campaign 'sending' when another runner still holds a batch", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(150));
    const c = await draft();
    await queueCampaignEmail(c.id);
    // Batch 0 is in flight under the panel's after(); this is the cron.
    patchRows(FAKE_TABLES.campaignEmailSends, (r) =>
      r.batchNo === 0
        ? { ...r, status: "sending", claimedAt: new Date().toISOString() }
        : r,
    );

    const result = await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(calls()).toHaveLength(1);
    expect(calls()[0][1]).toBe(`cmp-${c.id}-b1`);
    expect(result).toEqual({ sent: 50, failed: 0, remaining: 100 });
    // Not ours to close: the other runner settles batch 0 and the status.
    const fresh = await getCampaignEmail(c.id);
    expect(fresh?.status).toBe("sending");
    expect(fresh?.sentAt).toBe("");
    expect(sends().filter((r) => r.status === "sending")).toHaveLength(100);
  });

  it("settles only the rows of its own claim: what another runner holds stays that runner's", async () => {
    seedRows(FAKE_TABLES.customers, manyMembers(100));
    const c = await draft();
    await queueCampaignEmail(c.id);
    // In Postgres the claim locks the campaign row, so a batch is never
    // split between two runners: the second waits and takes the next batch.
    // The stub cannot take that lock; what is pinned here is the belt under
    // it — a posted mark and a settle reach only the rows carrying this
    // runner's own claimedAt. Forty rows of batch 0, held elsewhere, fresh.
    const elsewhere = new Date(Date.now() - 60_000).toISOString();
    const heldByAnother = (r: FakeRow) =>
      Number(String(r.email).slice(3, 6)) <= 40;
    patchRows(FAKE_TABLES.campaignEmailSends, (r) =>
      heldByAnother(r) ? { ...r, status: "sending", claimedAt: elsewhere } : r,
    );

    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    const held = sends().filter((r) => r.claimedAt === elsewhere);
    expect(held).toHaveLength(40);
    expect(
      held.every(
        (r) =>
          r.status === "sending" && r.providerId === "" && r.postedAt === "",
      ),
    ).toBe(true);
    const mine = sends()
      .filter((r) => r.claimedAt !== elsewhere)
      .sort((x, y) => String(x.email).localeCompare(String(y.email)));
    expect(mine).toHaveLength(60);
    expect(mine.every((r) => r.status === "sent" && r.postedAt !== "")).toBe(
      true,
    );
    // Provider ids land on the rows that were posted, in their own order.
    mine.forEach((r, i) => {
      expect(r.providerId).toBe(`cmp-${c.id}-b0-${i}`);
    });
    // Not ours to close.
    expect((await getCampaignEmail(c.id))?.status).toBe("sending");
  });

  it("closes an empty audience as 'sent' with nobody in it", async () => {
    const c = await draft();
    const { total } = await queueCampaignEmail(c.id);
    expect(total).toBe(0);
    expect(await runCampaignEmail(c.id, { batchDelayMs: 0 })).toEqual({
      sent: 0,
      failed: 0,
      remaining: 0,
    });
    expect(await getCampaignEmail(c.id)).toMatchObject({
      status: "sent",
      total: 0,
      sentCount: 0,
      failedCount: 0,
    });
  });

  it("without RESEND_API_KEY skips the batch, fails the campaign, and a re-queue puts the rows back", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    seedRows(FAKE_TABLES.customers, manyMembers(2));
    const c = await draft();
    await queueCampaignEmail(c.id);

    const result = await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(result).toMatchObject({ sent: 0, failed: 2 });
    expect(calls()).toHaveLength(0);
    expect(sends().every((r) => r.status === "skipped")).toBe(true);
    expect(sends()[0].error).toBe("RESEND_API_KEY tanımlı değil.");
    expect(await getCampaignEmail(c.id)).toMatchObject({
      status: "failed",
      lastError: "RESEND_API_KEY tanımlı değil.",
      failedCount: 2,
    });

    // The key arrives; the same rows go out, nobody is queued twice.
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    await queueCampaignEmail(c.id);
    expect(sends().every((r) => r.status === "queued")).toBe(true);
    expect(sends()).toHaveLength(2);
    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(sends().every((r) => r.status === "sent")).toBe(true);
    expect((await getCampaignEmail(c.id))?.status).toBe("sent");
  });

  it("refuses a real send from a preview deployment", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    seedRows(FAKE_TABLES.customers, manyMembers(1));
    const c = await draft();
    await queueCampaignEmail(c.id);
    await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(calls()).toHaveLength(0);
    expect(sends()[0].status).toBe("skipped");
    const fresh = await getCampaignEmail(c.id);
    expect(fresh?.status).toBe("failed");
    expect(fresh?.lastError).toContain("VERCEL_ENV=preview");
  });

  it("dry-runs without a single HTTP call", async () => {
    vi.stubEnv("CAMPAIGN_EMAIL_DRY_RUN", "1");
    seedRows(FAKE_TABLES.customers, manyMembers(150));
    const c = await draft();
    await queueCampaignEmail(c.id);
    const result = await runCampaignEmail(c.id, { batchDelayMs: 0 });
    expect(calls()).toHaveLength(0);
    expect(result).toEqual({ sent: 0, failed: 150, remaining: 0 });
    expect(sends().every((r) => r.status === "skipped")).toBe(true);
    const fresh = await getCampaignEmail(c.id);
    expect(fresh?.status).toBe("sent");
    expect(fresh?.lastError).toContain("CAMPAIGN_EMAIL_DRY_RUN");
  });
});

describe("preview and test send", () => {
  it("previews with a dummy way out — on the same route the members' links use — and the sample name", async () => {
    const c = await draft();
    const r = previewCampaignEmail(c, { name: "Eda" });
    expect(r.subject).toBe("Eylül seçkisi");
    expect(r.unsubscribeUrl).toBe(`${UNSUB_BASE}onizleme`);
    expect(r.html).toContain("token=onizleme");
    expect(r.html).toContain("Eda");
  });

  it("sends one real test outside the send log, as 'Test', with the members' unsubscribe path in the headers", async () => {
    const c = await draft();
    const res = await sendCampaignTest(c, " sahip@laffogato.net ");
    expect(res).toEqual({ ok: true });
    expect(sendCampaignMail).toHaveBeenCalledWith(
      "kampanya-duyuru",
      "sahip@laffogato.net",
      expect.objectContaining({ AD: "Test", KAMPANYA_BASLIK: "Eylül seçkisi" }),
      `${UNSUB_BASE}onizleme`,
    );
    expect(sends()).toHaveLength(0);
    expect(await sendCampaignTest(c, "not-an-address")).toMatchObject({
      ok: false,
    });
  });
});

describe("campaignFromPost", () => {
  const post = {
    id: "apost-9",
    kind: "event" as const,
    title: "Karaoke gecesi",
    body: "Cuma 21:00'den sonra üst kat açık.",
    image: "https://laffogato.net/photos/karaoke.jpg",
    linkUrl: "",
    linkLabel: "",
    sortOrder: 0,
    isActive: true,
    startsAt: "",
    endsAt: "",
    createdAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
  };

  it("maps a post onto kampanya-duyuru for the marketing audience", () => {
    const input = campaignFromPost(post);
    expect(input).toMatchObject({
      template: "kampanya-duyuru",
      audience: "marketing",
      sourcePostId: "apost-9",
    });
    expect(input.fields).toEqual({
      KAMPANYA_EYEBROW: "ETKİNLİK",
      KAMPANYA_BASLIK: "Karaoke gecesi",
      KAMPANYA_ALT: "Etkinlik",
      KAMPANYA_METIN: "Cuma 21:00'den sonra üst kat açık.",
      KAMPANYA_GORSEL_URL: "https://laffogato.net/photos/karaoke.jpg",
      KAMPANYA_GORSEL_ALT: "Karaoke gecesi",
      KAMPANYA_BUTON: "AYRINTILAR",
      KAMPANYA_URL: `${SITE_URL}/kampanyalar`,
    });
    // What the post hook stores must pass the same schema the form uses.
    expect(campaignFieldsSchema.safeParse(input.fields).success).toBe(true);
  });

  it("keeps the post's own link and label, and drops an image mail cannot show", () => {
    const input = campaignFromPost({
      ...post,
      kind: "campaign",
      image: "data:image/png;base64,AAAA",
      linkUrl: "https://instagram.com/laffogatto",
      linkLabel: "Instagram'da gör",
    });
    expect(input.fields.KAMPANYA_EYEBROW).toBe("KAMPANYA");
    expect(input.fields.KAMPANYA_ALT).toBe("Bu ay köşkte");
    expect(input.fields.KAMPANYA_URL).toBe("https://instagram.com/laffogatto");
    expect(input.fields.KAMPANYA_BUTON).toBe("Instagram'da gör");
    expect(input.fields).not.toHaveProperty("KAMPANYA_GORSEL_URL");
    expect(input.fields).not.toHaveProperty("KAMPANYA_GORSEL_ALT");
    expect(
      campaignFromPost({ ...post, kind: "collab" }).fields.KAMPANYA_EYEBROW,
    ).toBe("İŞ BİRLİĞİ");
  });
});

describe("unsubscribe", () => {
  it("a member token switches the account off and the bulletin row with it", async () => {
    seedRows(FAKE_TABLES.customers, [
      member("a@ornek.com", {
        unsubToken: "member-token",
        notificationPrefs: {
          orderUpdates: true,
          marketing: true,
          newsletter: true,
        },
      }),
    ]);
    seedRows(FAKE_TABLES.newsletterSubscribers, [subscriber("a@ornek.com")]);

    expect(await unsubscribeCustomerByToken("member-token")).toBe(
      "a@ornek.com",
    );
    expect(rowsOf(FAKE_TABLES.customers)[0]).toMatchObject({
      notificationPrefs: {
        orderUpdates: true,
        marketing: false,
        newsletter: false,
      },
      marketingConsentAt: "",
      unsubToken: "",
    });
    expect(rowsOf(FAKE_TABLES.newsletterSubscribers)[0].isActive).toBe(false);
    // Spent: the link is inert afterwards.
    expect(await unsubscribeCustomerByToken("member-token")).toBeNull();
  });

  it("a subscriber token switches the bulletin row off and the account with it", async () => {
    seedRows(FAKE_TABLES.customers, [
      member("a@ornek.com", { unsubToken: "member-token" }),
    ]);
    seedRows(FAKE_TABLES.newsletterSubscribers, [subscriber("a@ornek.com")]);

    expect(await unsubscribeByToken("tok-a@ornek.com")).toBe("a@ornek.com");
    expect(rowsOf(FAKE_TABLES.newsletterSubscribers)[0]).toMatchObject({
      isActive: false,
      unsubToken: "",
    });
    expect(rowsOf(FAKE_TABLES.customers)[0]).toMatchObject({
      notificationPrefs: {
        orderUpdates: true,
        marketing: false,
        newsletter: false,
      },
      marketingConsentAt: "",
    });
    expect(await unsubscribeByToken("tok-a@ornek.com")).toBeNull();
  });

  it("mints a member token once and keeps it", async () => {
    seedRows(FAKE_TABLES.customers, [member("a@ornek.com")]);
    const token = await ensureCustomerUnsubToken("A@ornek.com");
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    expect(await ensureCustomerUnsubToken("a@ornek.com")).toBe(token);
    await expect(ensureCustomerUnsubToken("yok@ornek.com")).rejects.toThrow();
  });
});

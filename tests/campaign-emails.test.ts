import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FAKE_TABLES,
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
}));

const {
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

  it("reads the newsletter preference for bulten-kampanya, no stamp needed", async () => {
    seedRows(FAKE_TABLES.customers, [
      member("a@ornek.com"),
      member("e@ornek.com", {
        notificationPrefs: {
          orderUpdates: true,
          marketing: false,
          newsletter: true,
        },
        marketingConsentAt: "",
      }),
    ]);
    // bulten-kampanya → pref 'newsletter'
    expect(await countCampaignAudience("marketing", "newsletter")).toBe(1);
    const c = await draft({
      template: "bulten-kampanya",
      fields: BULTEN_FIELDS,
    });
    await queueCampaignEmail(c.id);
    expect(sends().map((r) => r.email)).toEqual(["e@ornek.com"]);
  });

  it("takes subscribers only with consent and a token", async () => {
    seedRows(FAKE_TABLES.newsletterSubscribers, [
      subscriber("n1@ornek.com"),
      subscriber("n2@ornek.com", { consentAt: "" }),
      subscriber("n3@ornek.com", { unsubToken: "" }),
      subscriber("n4@ornek.com", { isActive: false }),
    ]);
    expect(await countCampaignAudience("newsletter")).toBe(1);
    const c = await draft({ audience: "newsletter" });
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
    seedRows(FAKE_TABLES.customers, [member("a@ornek.com", { name: "Ayşe" })]);
    seedRows(FAKE_TABLES.newsletterSubscribers, [
      subscriber("A@ornek.com", { name: "Ayşe (abone)" }),
      subscriber("n1@ornek.com"),
    ]);
    expect(await countCampaignAudience("both")).toBe(2);
    const c = await draft({ audience: "both" });
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
    seedRows(FAKE_TABLES.customers, [
      ...manyMembers(150),
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
  it("previews with a dummy way out and the sample name", async () => {
    const c = await draft();
    const r = previewCampaignEmail(c, { name: "Eda" });
    expect(r.subject).toBe("Eylül seçkisi");
    expect(r.unsubscribeUrl).toBe(`${SITE_URL}/bulten/cikis?token=onizleme`);
    expect(r.html).toContain("token=onizleme");
    expect(r.html).toContain("Eda");
  });

  it("sends one real test outside the send log, as 'Test'", async () => {
    const c = await draft();
    const res = await sendCampaignTest(c, " sahip@laffogato.net ");
    expect(res).toEqual({ ok: true });
    expect(sendCampaignMail).toHaveBeenCalledWith(
      "kampanya-duyuru",
      "sahip@laffogato.net",
      expect.objectContaining({ AD: "Test", KAMPANYA_BASLIK: "Eylül seçkisi" }),
      `${SITE_URL}/bulten/cikis?token=onizleme`,
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

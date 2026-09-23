import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAppPost } from "@/lib/admin/store";
import type { CampaignEmail } from "@/lib/email/campaigns";

/**
 * The campaign e-mail panel and the post hook, over mocked storage.
 *
 * What is real: the zod field schema and `campaignFromPost` (agent B's), the
 * client-safe field map the form renders from, and the templates themselves
 * - because the one thing worth catching here is the form asking for a
 * field the template does not have, or forgetting one it needs. What is
 * mocked: every read and write, the provider, the role gate, the audit
 * log, and `after()` - which here runs its task on the next microtask so a
 * test can wait for the runner instead of the platform.
 */

const logAudit = vi.fn();
const redirect = vi.fn();
const revalidatePath = vi.fn();

const scheduled: Promise<unknown>[] = [];
const after = vi.fn((task: () => unknown) => {
  scheduled.push(Promise.resolve().then(task));
});
/** Waits for everything the actions handed to `after()`. */
async function flushAfter(): Promise<void> {
  await Promise.all(scheduled.splice(0));
}

const createAppPost = vi.fn();
const updateAppPost = vi.fn();
const setAppPostEmailCampaign = vi.fn();

const createCampaignEmail = vi.fn();
const updateCampaignEmail = vi.fn();
const deleteCampaignEmail = vi.fn();
const getCampaignEmail = vi.fn();
const sendCampaignTest = vi.fn();
const queueCampaignEmail = vi.fn();
const runCampaignEmail = vi.fn();
const countCampaignAudience = vi.fn();
const listAdminUsers = vi.fn();

const ADMIN = "yonetici@laffogato.net";
/** Another panel account - the only other place a test may go. */
const COLLEAGUE = "ali@ornek.com";

/** Whether both store listings exist - `hasAppLinks()` for this file. */
let appLinks = false;
vi.mock("@/lib/mobile/app-store", () => ({
  hasAppLinks: () => appLinks,
  get APP_STORE_URL() {
    return appLinks ? "https://apps.apple.com/app/id1" : "";
  },
  get PLAY_STORE_URL() {
    return appLinks ? "https://play.google.com/store/apps/details?id=x" : "";
  },
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/server", () => ({ after }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: ADMIN, role: "owner" })),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit }));
vi.mock("@/lib/admin/users", () => ({ listAdminUsers }));
vi.mock("@/lib/admin/store", () => ({
  createAppPost,
  deleteAppPost: vi.fn(),
  updateAppPost,
  setAppPostEmailCampaign,
}));
vi.mock("@/lib/email/campaigns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/campaigns")>();
  return {
    ...actual,
    createCampaignEmail,
    updateCampaignEmail,
    deleteCampaignEmail,
    getCampaignEmail,
    listCampaignEmails: vi.fn(async () => []),
    sendCampaignTest,
    queueCampaignEmail,
    runCampaignEmail,
    countCampaignAudience,
  };
});

const {
  createCampaignMailAction,
  deleteCampaignMailAction,
  sendCampaignMailAction,
  sendCampaignMailTestAction,
  updateCampaignMailAction,
} = await import("@/app/admin/bulten/kampanya/actions");
const { createPostAction, updatePostAction } =
  await import("@/app/admin/mobil/gonderiler/actions");
const {
  CAMPAIGN_MAIL_APP_LINKS_MISSING,
  CAMPAIGN_MAIL_AUDIENCE_LABELS,
  CAMPAIGN_MAIL_AUDIENCE_MISMATCH,
  CAMPAIGN_MAIL_FIELD_KEYS,
  CAMPAIGN_MAIL_GROUPS,
  CAMPAIGN_MAIL_TEMPLATES,
  campaignMailAudienceFor,
  campaignMailAudiencesFor,
  campaignMailFieldsFor,
  campaignMailHasFields,
  campaignMailTemplateAvailable,
} = await import("@/lib/admin/campaign-mail-schema");
const {
  AUDIENCE_TEMPLATE_MISMATCH,
  CAMPAIGN_AUDIENCE_LABELS,
  audiencesForTemplate,
  campaignFieldsSchema,
} = await import("@/lib/email/campaigns");
const { defaultEmailMembers } = await import("@/lib/admin/post-mail-default");
const { CAMPAIGN_TEMPLATES } = await import("@/lib/email/send");
const { EMAIL_TEMPLATES } = await import("@/lib/email/templates.generated");

const LIST = "/admin/bulten/kampanya";
const POSTS = "/admin/mobil/gonderiler";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** kampanya-duyuru's six required fields; the optional blocks stay closed. */
const FIELDS: Record<string, string> = {
  KAMPANYA_EYEBROW: "KAMPANYA",
  KAMPANYA_BASLIK: "Eylül seçkisi",
  KAMPANYA_ALT: "Bu ay köşkte",
  KAMPANYA_METIN: "Bu ay köşkte üç yeni tat var.",
  KAMPANYA_BUTON: "MENÜYE GÖZ AT",
  KAMPANYA_URL: "https://laffogato.net/menu",
};

function draft(over: Partial<CampaignEmail> = {}): CampaignEmail {
  return {
    id: "cmail-1",
    template: "kampanya-duyuru",
    status: "draft",
    audience: "marketing",
    subject: FIELDS.KAMPANYA_BASLIK,
    fields: { ...FIELDS },
    sourcePostId: "",
    createdBy: ADMIN,
    createdAt: "2026-09-08T10:00:00.000Z",
    scheduledAt: "",
    queuedAt: "",
    sentAt: "",
    total: 0,
    sentCount: 0,
    failedCount: 0,
    lastError: "",
    ...over,
  };
}

function post(over: Partial<AdminAppPost> = {}): AdminAppPost {
  return {
    id: "apost-1",
    kind: "campaign",
    title: "Sabah ritüeli",
    body: "Hafta içi 09:00-11:00 arası ikinci kahve yarı fiyatına.",
    image: "",
    linkUrl: "",
    linkLabel: "",
    sortOrder: 0,
    isActive: true,
    startsAt: "",
    endsAt: "",
    createdAt: "2026-09-08T10:00:00.000Z",
    updatedAt: "2026-09-08T10:00:00.000Z",
    ...over,
  };
}

/** The post form as the panel submits it, live and asking for the mail. */
function postForm(over: Record<string, string> = {}): FormData {
  return form({
    kind: "campaign",
    title: "Sabah ritüeli",
    body: "Hafta içi 09:00-11:00 arası ikinci kahve yarı fiyatına.",
    isActive: "on",
    emailMembers: "on",
    ...over,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  scheduled.length = 0;
  appLinks = false;
  createCampaignEmail.mockImplementation(async (input) =>
    draft({ id: "cmail-new", ...input, subject: input.fields.KAMPANYA_BASLIK }),
  );
  queueCampaignEmail.mockResolvedValue({ total: 3 });
  runCampaignEmail.mockResolvedValue({ sent: 3, failed: 0, remaining: 0 });
  setAppPostEmailCampaign.mockResolvedValue(true);
  deleteCampaignEmail.mockResolvedValue(true);
  listAdminUsers.mockResolvedValue([
    { email: COLLEAGUE, role: "manager", isActive: true },
    { email: "eski@ornek.com", role: "staff", isActive: false },
  ]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendCampaignMailAction", () => {
  it("queues the audience, runs the batches after the response and audits the send", async () => {
    getCampaignEmail.mockResolvedValue(draft());
    queueCampaignEmail.mockResolvedValue({ total: 42 });

    const state = await sendCampaignMailAction("cmail-1", {}, new FormData());

    expect(queueCampaignEmail).toHaveBeenCalledWith("cmail-1");
    // The send is handed to `after()` - the response does not wait for it.
    expect(after).toHaveBeenCalledTimes(1);
    await flushAfter();
    expect(runCampaignEmail).toHaveBeenCalledWith("cmail-1", {
      deadlineMs: 240_000,
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "send",
        entity: "campaign_email",
        entityId: "cmail-1",
        payload: expect.objectContaining({
          total: 42,
          template: "kampanya-duyuru",
          audience: "marketing",
        }),
      }),
    );
    expect(state.error).toBeUndefined();
    expect(state.message).toContain("42");
    expect(revalidatePath).toHaveBeenCalledWith(LIST);
  });

  it("refuses a campaign with a hole in it, naming the field, and sends nothing", async () => {
    getCampaignEmail.mockResolvedValue(draft());
    queueCampaignEmail.mockRejectedValue(
      new Error("kampanya-duyuru: doldurulmamış alan - [KAMPANYA_METIN]"),
    );

    const state = await sendCampaignMailAction("cmail-1", {}, new FormData());

    expect(state.error).toContain("[KAMPANYA_METIN]");
    expect(after).not.toHaveBeenCalled();
    expect(runCampaignEmail).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("does nothing for a campaign that is not there", async () => {
    getCampaignEmail.mockResolvedValue(null);
    const state = await sendCampaignMailAction("cmail-x", {}, new FormData());
    expect(state.error).toContain("bulunamadı");
    expect(queueCampaignEmail).not.toHaveBeenCalled();
  });

  it("keeps a runner crash in the background out of the response", async () => {
    getCampaignEmail.mockResolvedValue(draft());
    runCampaignEmail.mockRejectedValue(new Error("boom"));
    const state = await sendCampaignMailAction("cmail-1", {}, new FormData());
    expect(state.message).toBeTruthy();
    await expect(flushAfter()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("says what an empty audience actually becomes: 'Gönderildi' with nobody in it", async () => {
    getCampaignEmail.mockResolvedValue(draft());
    queueCampaignEmail.mockResolvedValue({ total: 0 });
    const state = await sendCampaignMailAction("cmail-1", {}, new FormData());
    expect(state.error).toBeUndefined();
    expect(state.message).toContain("Kitle boş");
    expect(state.message).toContain("0 alıcıyla");
    expect(state.message).toContain("Gönderildi");
    expect(state.message).not.toContain("kapatıldı");
  });
});

describe("sendCampaignMailTestAction", () => {
  it("validates the address before anything is sent", async () => {
    getCampaignEmail.mockResolvedValue(draft());
    const state = await sendCampaignMailTestAction(
      "cmail-1",
      {},
      form({ to: "not-an-address" }),
    );
    expect(state.error).toContain("geçerli bir e-posta");
    expect(sendCampaignTest).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("falls back to the signed-in admin's address and audits where the mail went", async () => {
    getCampaignEmail.mockResolvedValue(draft());
    sendCampaignTest.mockResolvedValue({ ok: true });

    const state = await sendCampaignMailTestAction(
      "cmail-1",
      {},
      form({ to: "   " }),
    );

    expect(sendCampaignTest).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cmail-1" }),
      ADMIN,
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "send_test",
        entity: "campaign_email",
        entityId: "cmail-1",
        payload: expect.objectContaining({ to: ADMIN }),
      }),
    );
    expect(state.message).toContain(ADMIN);
  });

  it("lowercases a typed panel address and shows the provider's verdict as it is", async () => {
    getCampaignEmail.mockResolvedValue(draft());
    sendCampaignTest.mockResolvedValue({
      ok: false,
      error: "Domain not verified",
    });

    const state = await sendCampaignMailTestAction(
      "cmail-1",
      {},
      form({ to: "Ali@Ornek.com" }),
    );

    expect(sendCampaignTest).toHaveBeenCalledWith(
      expect.anything(),
      "ali@ornek.com",
    );
    expect(state.error).toContain("Domain not verified");
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("refuses any address that is not a panel user's - a real commercial message may not go to a stranger", async () => {
    getCampaignEmail.mockResolvedValue(draft());
    for (const to of ["musteri@ornek.com", "eski@ornek.com"]) {
      const state = await sendCampaignMailTestAction(
        "cmail-1",
        {},
        form({ to }),
      );
      expect(state.error, to).toBe(
        "Test yalnız panel kullanıcılarına gönderilir.",
      );
    }
    expect(sendCampaignTest).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
    // The operator's own address needs no lookup at all.
    listAdminUsers.mockRejectedValue(new Error("db down"));
    sendCampaignTest.mockResolvedValue({ ok: true });
    const own = await sendCampaignMailTestAction(
      "cmail-1",
      {},
      form({ to: ADMIN.toUpperCase() }),
    );
    expect(own.message).toContain(ADMIN);
    expect(sendCampaignTest).toHaveBeenCalledWith(expect.anything(), ADMIN);
  });
});

describe("createCampaignMailAction", () => {
  it("stores the fields as the schema parses them and lands on the draft's page", async () => {
    createCampaignEmail.mockResolvedValue(draft({ id: "cmail-7" }));

    // A real `redirect()` throws and ends the action; the mock lets it
    // return, so what happened is read off the mocks, not the state.
    await createCampaignMailAction(
      {},
      form({
        template: "kampanya-duyuru",
        audience: "marketing",
        ...FIELDS,
        KAMPANYA_EYEBROW: "  KAMPANYA  ",
        KAMPANYA_URL: "",
        KAMPANYA_VURGU: "",
      }),
    );

    expect(createCampaignEmail).toHaveBeenCalledWith({
      template: "kampanya-duyuru",
      audience: "marketing",
      scheduledAt: "",
      createdBy: ADMIN,
      fields: {
        ...FIELDS,
        KAMPANYA_EYEBROW: "KAMPANYA",
        // Blank button URL → the campaigns page; blank optional → absent.
        KAMPANYA_URL: "https://laffogato.net/kampanyalar",
      },
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        entity: "campaign_email",
        entityId: "cmail-7",
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith(LIST);
    expect(redirect).toHaveBeenCalledWith(`${LIST}/cmail-7`);
  });

  it("rejects a blank title with the schema's own words", async () => {
    const state = await createCampaignMailAction(
      {},
      form({
        template: "kampanya-duyuru",
        audience: "marketing",
        ...FIELDS,
        KAMPANYA_BASLIK: "   ",
      }),
    );
    expect(state.error).toBe("Başlık gerekli.");
    expect(createCampaignEmail).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends a kampanya-* layout to members only; the bulletin may go to anyone", async () => {
    for (const audience of ["newsletter", "both"]) {
      const state = await createCampaignMailAction(
        {},
        form({ template: "kampanya-duyuru", audience, ...FIELDS }),
      );
      expect(state.error, audience).toBe(CAMPAIGN_MAIL_AUDIENCE_MISMATCH);
    }
    expect(createCampaignEmail).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();

    createCampaignEmail.mockResolvedValue(
      draft({ id: "cmail-b", template: "bulten-kampanya", audience: "both" }),
    );
    await createCampaignMailAction(
      {},
      form({ template: "bulten-kampanya", audience: "both", ...FIELDS }),
    );
    expect(createCampaignEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "bulten-kampanya",
        audience: "both",
      }),
    );
    expect(redirect).toHaveBeenCalledWith(`${LIST}/cmail-b`);
  });

  it("rejects a template that is not a campaign, and a link that is not https", async () => {
    expect(
      (
        await createCampaignMailAction(
          {},
          form({ template: "hos-geldin", audience: "marketing", ...FIELDS }),
        )
      ).error,
    ).toContain("Şablon");
    expect(
      (
        await createCampaignMailAction(
          {},
          form({
            template: "kampanya-duyuru",
            audience: "marketing",
            ...FIELDS,
            KAMPANYA_URL: "http://laffogato.net/menu",
          }),
        )
      ).error,
    ).toContain("https");
    expect(createCampaignEmail).not.toHaveBeenCalled();
  });
});

describe("updateCampaignMailAction", () => {
  it("says so when the draft was queued (or deleted) meanwhile", async () => {
    updateCampaignEmail.mockResolvedValue(null);
    const state = await updateCampaignMailAction(
      "cmail-1",
      {},
      form({ template: "kampanya-duyuru", audience: "marketing", ...FIELDS }),
    );
    expect(state.error).toContain("kuyruğa");
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("refuses to point a kampanya-* draft at the subscribers", async () => {
    const state = await updateCampaignMailAction(
      "cmail-1",
      {},
      form({ template: "kampanya-ikram", audience: "newsletter", ...FIELDS }),
    );
    expect(state.error).toBe(CAMPAIGN_MAIL_AUDIENCE_MISMATCH);
    expect(updateCampaignEmail).not.toHaveBeenCalled();
  });

  it("audits a real update and stays on the page", async () => {
    updateCampaignEmail.mockResolvedValue(
      draft({ template: "bulten-kampanya", audience: "newsletter" }),
    );
    const state = await updateCampaignMailAction(
      "cmail-1",
      {},
      form({ template: "bulten-kampanya", audience: "newsletter", ...FIELDS }),
    );
    expect(updateCampaignEmail).toHaveBeenCalledWith(
      "cmail-1",
      expect.objectContaining({ audience: "newsletter" }),
    );
    expect(state.message).toBeTruthy();
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        entity: "campaign_email",
        entityId: "cmail-1",
      }),
    );
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("deleteCampaignMailAction", () => {
  it("audits only a delete that removed a draft", async () => {
    deleteCampaignEmail.mockResolvedValue(true);
    await deleteCampaignMailAction(form({ id: "cmail-1" }));
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete", entityId: "cmail-1" }),
    );

    logAudit.mockClear();
    deleteCampaignEmail.mockResolvedValue(false);
    await deleteCampaignMailAction(form({ id: "cmail-sent" }));
    expect(logAudit).not.toHaveBeenCalled();
  });
});

describe("the post hook", () => {
  it("a live campaign post with the box ticked mails the members exactly once", async () => {
    createAppPost.mockResolvedValue(post());
    createCampaignEmail.mockResolvedValue(
      draft({ id: "cmail-p1", sourcePostId: "apost-1" }),
    );
    queueCampaignEmail.mockResolvedValue({ total: 12 });

    await createPostAction(postForm());

    expect(createCampaignEmail).toHaveBeenCalledTimes(1);
    expect(createCampaignEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "kampanya-duyuru",
        audience: "marketing",
        sourcePostId: "apost-1",
        createdBy: ADMIN,
        fields: expect.objectContaining({
          KAMPANYA_EYEBROW: "KAMPANYA",
          KAMPANYA_BASLIK: "Sabah ritüeli",
        }),
      }),
    );
    // The mark goes on the post BEFORE the audience is queued.
    expect(setAppPostEmailCampaign).toHaveBeenCalledWith("apost-1", "cmail-p1");
    expect(setAppPostEmailCampaign.mock.invocationCallOrder[0]).toBeLessThan(
      queueCampaignEmail.mock.invocationCallOrder[0],
    );
    expect(queueCampaignEmail).toHaveBeenCalledWith("cmail-p1");
    await flushAfter();
    expect(runCampaignEmail).toHaveBeenCalledWith("cmail-p1", {
      deadlineMs: 240_000,
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "app_post", entityId: "apost-1" }),
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "send",
        entity: "campaign_email",
        entityId: "cmail-p1",
        payload: expect.objectContaining({
          sourcePostId: "apost-1",
          total: 12,
        }),
      }),
    );
    expect(redirect).toHaveBeenCalledWith(`${POSTS}?eposta=kuyrukta&adet=12`);
  });

  it("a later save of a mailed post does not mail again, whatever the box says", async () => {
    updateAppPost.mockResolvedValue(post({ emailCampaignId: "cmail-p1" }));

    await updatePostAction("apost-1", postForm({ title: "Sabah ritüeli v2" }));

    expect(updateAppPost).toHaveBeenCalled();
    expect(createCampaignEmail).not.toHaveBeenCalled();
    expect(setAppPostEmailCampaign).not.toHaveBeenCalled();
    expect(queueCampaignEmail).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalledWith(
      expect.objectContaining({ entity: "campaign_email" }),
    );
    expect(redirect).toHaveBeenCalledWith(POSTS);
  });

  it("sends nothing for a post that is not live: box off, inactive, or scheduled", async () => {
    createAppPost.mockResolvedValue(post());
    await createPostAction(postForm({ emailMembers: "" }));

    createAppPost.mockResolvedValue(post({ isActive: false }));
    await createPostAction(postForm({ isActive: "" }));

    // Scheduled: the hook does not fire now, and - with no mark - it will not
    // fire by itself when the window opens either; the form says so.
    createAppPost.mockResolvedValue(
      post({ startsAt: "2099-01-01T00:00:00.000Z" }),
    );
    await createPostAction(postForm({ startsAt: "2099-01-01T00:00" }));

    expect(createCampaignEmail).not.toHaveBeenCalled();
    expect(setAppPostEmailCampaign).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledTimes(3);
    expect(redirect).toHaveBeenLastCalledWith(POSTS);
  });

  it("an unmarked post edited into publication mails once, from the stored row", async () => {
    updateAppPost.mockResolvedValue(post());
    createCampaignEmail.mockResolvedValue(
      draft({ id: "cmail-p2", sourcePostId: "apost-1" }),
    );

    await updatePostAction("apost-1", postForm());

    expect(createCampaignEmail).toHaveBeenCalledTimes(1);
    expect(setAppPostEmailCampaign).toHaveBeenCalledWith("apost-1", "cmail-p2");
    expect(queueCampaignEmail).toHaveBeenCalledWith("cmail-p2");
    expect(redirect).toHaveBeenCalledWith(`${POSTS}?eposta=kuyrukta&adet=3`);
  });

  it("yields to a save that marked the post first", async () => {
    createAppPost.mockResolvedValue(post());
    createCampaignEmail.mockResolvedValue(draft({ id: "cmail-dup" }));
    setAppPostEmailCampaign.mockResolvedValue(false);

    await createPostAction(postForm());

    expect(deleteCampaignEmail).toHaveBeenCalledWith("cmail-dup");
    expect(queueCampaignEmail).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(POSTS);
  });

  it("keeps the saved post and points at the draft when the queue refuses", async () => {
    createAppPost.mockResolvedValue(post({ body: "" }));
    createCampaignEmail.mockResolvedValue(draft({ id: "cmail-p3" }));
    queueCampaignEmail.mockRejectedValue(
      new Error("kampanya-duyuru: doldurulmamış alan - [KAMPANYA_METIN]"),
    );

    await createPostAction(postForm({ body: "" }));

    expect(setAppPostEmailCampaign).toHaveBeenCalledWith("apost-1", "cmail-p3");
    expect(after).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "send" }),
    );
    expect(console.error).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      `${POSTS}?eposta=hata&kampanya=cmail-p3`,
    );
  });
});

describe("the post form's e-mail box", () => {
  it("starts ticked only when a campaign post is being created", () => {
    expect(
      defaultEmailMembers({
        mode: "create",
        kind: "campaign",
        alreadyMailed: false,
      }),
    ).toBe(true);
    for (const kind of ["collab", "event"] as const) {
      expect(
        defaultEmailMembers({ mode: "create", kind, alreadyMailed: false }),
        kind,
      ).toBe(false);
    }
  });

  it("never starts ticked on an edit - a typo fix must not mail the member base an old campaign", () => {
    for (const kind of ["campaign", "collab", "event"] as const) {
      expect(
        defaultEmailMembers({ mode: "edit", kind, alreadyMailed: false }),
        kind,
      ).toBe(false);
    }
  });

  it("never starts ticked once the post has had its mail", () => {
    expect(
      defaultEmailMembers({
        mode: "create",
        kind: "campaign",
        alreadyMailed: true,
      }),
    ).toBe(false);
  });
});

describe("campaign-mail-schema mirrors the e-mail modules", () => {
  /** Filled by `renderEmail` or the server, never by the form. */
  const AUTO = new Set([
    "AD",
    "APP_STORE_URL",
    "PLAY_STORE_URL",
    "ABONELIK_CIKIS_URL",
    // The sender's registered title and MERSİS number (commonVars).
    "UNVAN",
    "MERSIS",
    // The loyalty card size, from the settings (`campaignServerVars`).
    "DAMGA_HEDEFI",
  ]);

  it("gates the audience per template exactly as the store does", () => {
    expect(CAMPAIGN_MAIL_AUDIENCE_MISMATCH).toBe(AUDIENCE_TEMPLATE_MISMATCH);
    for (const t of CAMPAIGN_MAIL_TEMPLATES) {
      expect([...campaignMailAudiencesFor(t)], t).toEqual([
        ...audiencesForTemplate(t),
      ]);
    }
    expect(campaignMailAudiencesFor("kampanya-duyuru")).toEqual(["marketing"]);
    expect(campaignMailAudiencesFor("bulten-kampanya")).toHaveLength(3);
  });

  it("opens a stored draft on an audience its template allows, never on one the server refuses", () => {
    expect(campaignMailAudienceFor("bulten-kampanya", "newsletter")).toBe(
      "newsletter",
    );
    expect(campaignMailAudienceFor("bulten-kampanya", "both")).toBe("both");
    expect(campaignMailAudienceFor("kampanya-duyuru", "marketing")).toBe(
      "marketing",
    );
    // A draft saved before the gate: a kampanya-* template aimed at the
    // subscribers. Shown as stored, the form would render a locked select
    // whose hidden value parseDraft refuses on every save.
    expect(campaignMailAudienceFor("kampanya-duyuru", "newsletter")).toBe(
      "marketing",
    );
    expect(campaignMailAudienceFor("kampanya-indirim", "both")).toBe(
      "marketing",
    );
    expect(campaignMailAudienceFor("kampanya-duyuru", undefined)).toBe(
      "marketing",
    );
    expect(campaignMailAudienceFor("bulten-kampanya", undefined)).toBe(
      "marketing",
    );
  });

  /** A template's `[ALAN]`s, split by whether an optional block holds them. */
  function templateFields(html: string): {
    required: Set<string>;
    all: Set<string>;
  } {
    const all = new Set(
      [...html.matchAll(/\[([A-Z_0-9]+)\]/g)].map((m) => m[1]),
    );
    const optional = new Set<string>();
    for (const m of html.matchAll(
      /<!--IF:([A-Z_]+)-->([\s\S]*?)<!--\/IF:\1-->/g,
    )) {
      if (m[1] === "AD" || m[1] === "APP_LINKS") continue;
      for (const f of m[2].matchAll(/\[([A-Z_0-9]+)\]/g)) optional.add(f[1]);
    }
    const required = new Set(
      [...all].filter((f) => !optional.has(f) && !AUTO.has(f)),
    );
    return { required, all };
  }

  it("offers exactly the campaign templates, and B's audience labels", () => {
    expect([...CAMPAIGN_MAIL_TEMPLATES].sort()).toEqual(
      [...CAMPAIGN_TEMPLATES].sort(),
    );
    expect(CAMPAIGN_MAIL_AUDIENCE_LABELS).toEqual(CAMPAIGN_AUDIENCE_LABELS);
  });

  it.each(CAMPAIGN_MAIL_TEMPLATES)(
    "%s: the form's required fields are the template's, and it asks for nothing the template lacks",
    (template) => {
      const { required, all } = templateFields(EMAIL_TEMPLATES[template].html);
      const fields = campaignMailFieldsFor(template);
      const keys = fields.map((f) => f.key);
      // No field twice, and every one of them is in the template.
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) expect(all.has(key), key).toBe(true);
      // The form marks required exactly what the template renders outside
      // an optional block - except the button URL, which the schema fills
      // with the campaigns page when it is left blank. A fixed-copy template
      // has no button of the operator's and no fields at all.
      const markedRequired = new Set(
        fields.filter((f) => f.required).map((f) => f.key),
      );
      expect(required.has("KAMPANYA_URL")).toBe(
        campaignMailHasFields(template),
      );
      expect(markedRequired.has("KAMPANYA_URL")).toBe(false);
      required.delete("KAMPANYA_URL");
      expect([...markedRequired].sort()).toEqual([...required].sort());
      // And every field the template has that a person must type is offered.
      for (const key of all) {
        if (!AUTO.has(key)) expect(keys, key).toContain(key);
      }
    },
  );

  it("caps every text field where the zod schema does", () => {
    for (const template of CAMPAIGN_MAIL_TEMPLATES) {
      for (const f of campaignMailFieldsFor(template)) {
        if (f.kind === "url") continue;
        const at = campaignFieldsSchema.safeParse({
          KAMPANYA_BASLIK: "x",
          [f.key]: "a".repeat(f.max),
        });
        const over = campaignFieldsSchema.safeParse({
          KAMPANYA_BASLIK: "x",
          [f.key]: "a".repeat(f.max + 1),
        });
        expect(at.success, `${f.key} @ ${f.max}`).toBe(true);
        expect(over.success, `${f.key} @ ${f.max + 1}`).toBe(false);
      }
    }
  });

  it("only reads keys the schema keeps", () => {
    for (const key of CAMPAIGN_MAIL_FIELD_KEYS) {
      const value = key.endsWith("_URL") ? "https://laffogato.net/x" : "v";
      const parsed = campaignFieldsSchema.safeParse({
        KAMPANYA_BASLIK: "x",
        [key]: value,
      });
      expect(parsed.success, key).toBe(true);
      if (parsed.success) expect(parsed.data[key], key).toBe(value);
    }
  });
});

describe("the app announcement in the panel", () => {
  it("is offered as a fixed-copy template with no fields to fill", () => {
    expect(CAMPAIGN_MAIL_TEMPLATES).toContain("mobil-uygulama");
    expect(CAMPAIGN_TEMPLATES).toContain("mobil-uygulama");
    expect(CAMPAIGN_MAIL_GROUPS["mobil-uygulama"]).toEqual([]);
    expect(campaignMailHasFields("mobil-uygulama")).toBe(false);
    // It says "your stamp card is in the app": members only.
    expect(campaignMailAudiencesFor("mobil-uygulama")).toEqual(["marketing"]);
    expect([...audiencesForTemplate("mobil-uygulama")]).toEqual(["marketing"]);
  });

  it("is greyed out until both store links exist, and only it", () => {
    expect(campaignMailTemplateAvailable("mobil-uygulama", false)).toBe(false);
    expect(campaignMailTemplateAvailable("mobil-uygulama", true)).toBe(true);
    for (const t of CAMPAIGN_MAIL_TEMPLATES) {
      if (t === "mobil-uygulama") continue;
      expect(campaignMailTemplateAvailable(t, false), t).toBe(true);
    }
  });

  it("refuses a draft of it without the store links, whatever the form says", async () => {
    const state = await createCampaignMailAction(
      {},
      form({ template: "mobil-uygulama", audience: "marketing" }),
    );
    expect(state.error).toBe(CAMPAIGN_MAIL_APP_LINKS_MISSING);
    expect(createCampaignEmail).not.toHaveBeenCalled();
  });

  it("saves a draft of it with no fields once the links exist", async () => {
    appLinks = true;
    await createCampaignMailAction(
      {},
      // A stray title from another template's form is not kept.
      form({
        template: "mobil-uygulama",
        audience: "marketing",
        KAMPANYA_BASLIK: "eski başlık",
      }),
    );
    expect(createCampaignEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "mobil-uygulama",
        audience: "marketing",
        fields: {},
      }),
    );
    expect(redirect).toHaveBeenCalledWith(`${LIST}/cmail-new`);
  });
});

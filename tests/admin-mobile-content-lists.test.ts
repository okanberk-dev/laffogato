import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The app content screens as the server renders them, with their data
 * mocked (admin audit CON-04, CON-05, CON-08, CON-09, CON-19, CON-23,
 * CON-24, CON-25, CON-26, CON-29):
 *
 * - slides, announcements and posts are kit tables with a publish-state
 *   badge (Yayında / Planlandı / Süresi doldu / Kapalı / Tarih geçersiz)
 *   and their window in Istanbul time; a bound that is not a time renders
 *   as text with a badge instead of taking the list down;
 * - a post's mail column comes from its campaign, not from the mark;
 * - the forms post through ActionForm, have "Vazgeç", keep the checkboxes
 *   out of a label, and the edit pages have a way back and a delete.
 */

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
  }) => createElement("a", { href, ...rest }, children),
  // The app content lists' StatusTabs mark a clicked tab while it loads.
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(),
}));

const session = vi.hoisted(() => ({
  value: { email: "patron@laffogato.net", role: "owner" } as {
    email: string;
    role: string;
  },
}));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => session.value),
}));

const STAMP = "2026-10-10T10:00:00.000Z";
// Fixed clock: 18 Eki 2026 12:00 Istanbul.
const NOW = Date.parse("2026-10-18T09:00:00.000Z");

const row = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  title: `Başlık ${id}`,
  body: "x",
  sortOrder: 1,
  isActive: true,
  startsAt: "",
  endsAt: "",
  createdAt: STAMP,
  updatedAt: STAMP,
  ...patch,
});

const ROWS = [
  row("live", { endsAt: "2026-10-30T21:00:00.000Z" }),
  row("planned", { startsAt: "2026-10-20T06:00:00.000Z" }),
  row("past", { endsAt: "2026-10-01T06:00:00.000Z" }),
  row("off", { isActive: false }),
  row("typo", { endsAt: "30.10.2026" }),
];

const campaigns = vi.hoisted(() => ({
  byId: {} as Record<string, unknown>,
}));

vi.mock("@/lib/admin/store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/store")>();
  return {
    ...real,
    listAppSlides: vi.fn(async () =>
      ROWS.map((r) => ({
        ...r,
        eyebrow: "",
        ctaLabel: "",
        ctaRoute: "",
        tone: "premium",
        image: "",
      })),
    ),
    listAppAnnouncements: vi.fn(async () =>
      ROWS.map((r) => ({ ...r, kind: "info" })),
    ),
    listAppPosts: vi.fn(async () => [
      {
        ...ROWS[0],
        kind: "campaign",
        image: "",
        linkUrl: "",
        linkLabel: "",
        emailCampaignId: "cmail-failed",
      },
      {
        ...ROWS[1],
        id: "p2",
        kind: "event",
        image: "",
        linkUrl: "",
        linkLabel: "",
        emailCampaignId: "cmail-empty",
      },
      {
        ...ROWS[3],
        id: "p3",
        kind: "collab",
        image: "",
        linkUrl: "",
        linkLabel: "",
        emailCampaignId: "",
      },
    ]),
    getAppSlide: vi.fn(async (id: string) => ({
      ...row(id),
      eyebrow: "",
      ctaLabel: "",
      ctaRoute: "",
      tone: "paper",
      image: "",
    })),
    getAppAnnouncement: vi.fn(async (id: string) => ({
      ...row(id),
      kind: "info",
    })),
    getAppPost: vi.fn(async (id: string) => ({
      ...row(id),
      kind: "campaign",
      image: "",
      linkUrl: "",
      linkLabel: "",
      emailCampaignId: "",
    })),
  };
});
vi.mock("@/lib/email/campaigns", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/email/campaigns")>();
  return {
    ...real,
    getCampaignEmail: vi.fn(async (id: string) => campaigns.byId[id] ?? null),
  };
});
const fal = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock("@/lib/mobile/fal", () => ({
  listFalReports: vi.fn(async (limit: number) => fal.rows.slice(0, limit)),
}));
const stub = () => vi.fn(async () => ({ ok: true as const, message: "" }));
vi.mock("@/app/admin/mobil/slaytlar/actions", () => ({
  createSlideAction: stub(),
  updateSlideAction: stub(),
  deleteSlideAction: stub(),
}));
vi.mock("@/app/admin/mobil/duyurular/actions", () => ({
  createAnnouncementAction: stub(),
  updateAnnouncementAction: stub(),
  deleteAnnouncementAction: stub(),
}));
vi.mock("@/app/admin/mobil/gonderiler/actions", () => ({
  createPostAction: stub(),
  updatePostAction: stub(),
  deletePostAction: stub(),
}));

const schema = await import("@/lib/admin/app-content-schema");
const { PublishCell } = await import("@/app/admin/mobil/app-content-list");
const { AppPostForm } = await import("@/app/admin/mobil/gonderiler/post-form");
const { AppSlideForm } = await import("@/app/admin/mobil/slaytlar/slide-form");
const { AppAnnouncementForm } =
  await import("@/app/admin/mobil/duyurular/announcement-form");

type AsyncPage = (props: never) => Promise<ReturnType<typeof createElement>>;
async function renderPage(path: string, props: Record<string, unknown> = {}) {
  const mod = (await import(path)) as { default: AsyncPage };
  return renderToStaticMarkup(await mod.default(props as never));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  session.value = { email: "patron@laffogato.net", role: "owner" };
  campaigns.byId = {
    "cmail-failed": { id: "cmail-failed", status: "failed", total: 0 },
    "cmail-empty": { id: "cmail-empty", status: "sent", total: 0 },
  };
});

describe("appPublishStatus", () => {
  it("reads a row the way the app does: active and inside its window", () => {
    const st = (r: Record<string, unknown>) =>
      schema.appPublishStatus(
        r as { isActive: boolean; startsAt: string; endsAt: string },
        NOW,
      );
    expect(ROWS.map(st)).toEqual([
      "live",
      "scheduled",
      "expired",
      "off",
      "invalid",
    ]);
    // A bare wall-clock value is Istanbul time, as the store reads it.
    expect(st(row("x", { startsAt: "2026-10-18T11:59" }))).toBe("live");
    expect(st(row("x", { startsAt: "2026-10-18T12:01" }))).toBe("scheduled");
  });
});

describe("PublishCell", () => {
  it("prints the window in Istanbul time, not the stored UTC text", () => {
    const html = renderToStaticMarkup(
      createElement(PublishCell, { row: ROWS[1], now: NOW }),
    );
    expect(html).toContain("Planlandı");
    expect(html).toContain("09:00");
    expect(html).not.toContain("T06:00:00.000Z");
  });

  it("shows a bound that is not a time as it is, with a badge, instead of throwing", () => {
    const render = (r: Record<string, unknown>) =>
      renderToStaticMarkup(
        createElement(PublishCell, {
          row: r as { isActive: boolean; startsAt: string; endsAt: string },
          now: NOW,
        }),
      );
    const active = render(ROWS[4]);
    expect(active).toContain("Tarih geçersiz");
    expect(active).toContain("30.10.2026");
    const off = render({ ...ROWS[4], isActive: false });
    expect(off).toContain("Kapalı");
    expect(off).toContain("geçersiz tarih");
  });
});

describe("list pages", () => {
  it.each([
    ["@/app/admin/mobil/slaytlar/page"],
    ["@/app/admin/mobil/duyurular/page"],
  ])(
    "%s: a state badge per row, tabs with counts, named deletes",
    async (path) => {
      const html = await renderPage(path);
      for (const label of [
        "Yayında",
        "Planlandı",
        "Süresi doldu",
        "Kapalı",
        "Tarih geçersiz",
      ]) {
        expect(html, label).toContain(label);
      }
      expect(html).not.toMatch(/YAYINDA DEĞİL|\d{2}:\d{2}:\d{2}\.\d{3}Z/);
      expect(html).toContain('aria-label="Yayın durumu"');
      expect(html).toContain('aria-label="Sil: Başlık live"');
      expect(html).not.toMatch(/text-neutral-\d|hemen kalkar/);
    },
  );

  it("filters by ?durum=", async () => {
    const html = await renderPage("@/app/admin/mobil/slaytlar/page", {
      searchParams: Promise.resolve({ durum: "scheduled" }),
    });
    expect(html).toContain("Başlık planned");
    expect(html).not.toContain("Başlık live");
  });

  it("slides: the tone by its Turkish name, not the raw key (CON-25)", async () => {
    const html = await renderPage("@/app/admin/mobil/slaytlar/page");
    expect(html).toContain("Bordo (premium)");
    expect(html).not.toMatch(/>premium</);
  });

  it("posts: the mail column says what the campaign did (CON-09)", async () => {
    const html = await renderPage("@/app/admin/mobil/gonderiler/page", {
      searchParams: Promise.resolve({ eposta: "kuyrukta", adet: "12" }),
    });
    expect(html).toContain("Gönderilemedi");
    expect(html).toContain("Gönderildi · 0 alıcı");
    expect(html).not.toContain("e-posta gönderildi");
    expect(html).toContain('href="/admin/bulten/kampanya/cmail-failed"');
    // The old banner read the address; a reload no longer brings it back.
    expect(html).not.toContain("kuyruğa alındı");
  });

  it("posts: no campaign link for a role that cannot open it", async () => {
    session.value = { email: "x@laffogato.net", role: "staff" };
    const html = await renderPage("@/app/admin/mobil/gonderiler/page");
    expect(html).toContain("Gönderilemedi");
    expect(html).not.toContain("/admin/bulten/kampanya/");
  });
});

describe("forms", () => {
  it.each([
    ["slide", AppSlideForm, "/admin/mobil/slaytlar"],
    ["announcement", AppAnnouncementForm, "/admin/mobil/duyurular"],
  ] as const)("%s: posts by hand and has Vazgeç", (_name, Form, back) => {
    const html = renderToStaticMarkup(
      createElement(Form, { action: stub(), submitLabel: "Kaydet" }),
    );
    expect(html).not.toMatch(/<form[^>]*\saction=/);
    expect(html).toContain(`href="${back}"`);
    expect(html).toContain("Vazgeç");
  });

  it("post: both checkboxes in fieldsets, not in a label (CON-05)", () => {
    const html = renderToStaticMarkup(
      createElement(AppPostForm, {
        action: stub(),
        mode: "create",
        submitLabel: "Oluştur",
      }),
    );
    expect(html).not.toMatch(/<form[^>]*\saction=/);
    expect(html).toMatch(/<legend[^>]*>Üyelere e-posta<\/legend>/);
    expect(html).toMatch(/<legend[^>]*>Yayında<\/legend>/);
    expect(html).not.toMatch(/<label[^>]*>(?:(?!<\/label>)[\s\S])*<label/);
    const box = html.match(/<input[^>]*name="emailMembers"[^>]*>/)?.[0];
    expect(box).toContain("checked");
    expect(box).not.toContain("disabled");
  });

  it("post: without the newsletter role the mail box is off and says why (D27)", () => {
    const html = renderToStaticMarkup(
      createElement(AppPostForm, {
        action: stub(),
        mode: "create",
        submitLabel: "Oluştur",
        canEmail: false,
      }),
    );
    const box = html.match(/<input[^>]*name="emailMembers"[^>]*>/)?.[0];
    expect(box).toContain("disabled");
    expect(box).not.toMatch(/checked=""/);
    expect(html).toContain("Bülten yetkisi");
  });
});

describe("new and edit pages (CON-24)", () => {
  it.each([
    ["@/app/admin/mobil/slaytlar/[id]/page", "/admin/mobil/slaytlar"],
    ["@/app/admin/mobil/duyurular/[id]/page", "/admin/mobil/duyurular"],
    ["@/app/admin/mobil/gonderiler/[id]/page", "/admin/mobil/gonderiler"],
  ])("%s: a way back and a delete in the header", async (path, back) => {
    const html = await renderPage(path, {
      params: Promise.resolve({ id: "e1" }),
    });
    expect(html).toContain(`href="${back}"`);
    expect(html).toContain('aria-label="Sil: Başlık e1"');
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it.each([
    ["@/app/admin/mobil/slaytlar/yeni/page", "/admin/mobil/slaytlar"],
    ["@/app/admin/mobil/duyurular/yeni/page", "/admin/mobil/duyurular"],
    ["@/app/admin/mobil/gonderiler/yeni/page", "/admin/mobil/gonderiler"],
  ])("%s: a way back", async (path, back) => {
    const html = await renderPage(path);
    expect(html.match(new RegExp(`href="${back}"`, "g"))?.length).toBe(2);
  });
});

describe("fA'L bildirimleri (CON-24)", () => {
  const report = (i: number) => ({
    id: i,
    day: "2026-10-18",
    reason: "wrong",
    text: `yorum ${i}`,
    model: "m",
    createdAt: STAMP,
  });

  it("counts the reports", async () => {
    fal.rows = [report(1), report(2)];
    const html = await renderPage("@/app/admin/mobil/fal-bildirimleri/page");
    expect(html).toContain("2 bildirim.");
  });

  it("says when older reports are not shown", async () => {
    fal.rows = Array.from({ length: 205 }, (_, i) => report(i));
    const html = await renderPage("@/app/admin/mobil/fal-bildirimleri/page");
    expect(html).toContain("En yeni 200 bildirim gösteriliyor");
    expect(html.match(/yorum \d+/g)).toHaveLength(200);
  });
});

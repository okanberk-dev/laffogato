import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConsentOverride } from "@/lib/legal/consent-version";
import { findLegalDoc } from "@/lib/legal/documents";
import { CHECKOUT_CONSENT_DOCS, LEGAL_UPDATED } from "@/lib/legal/meta";

/**
 * The legal editor's three actions (/admin/hukuk), with the store in memory:
 *
 * - "Varsayılana döndür" answers an ActionResult and archives the text it
 *   removes; it used to return nothing and delete it for good (CON-02).
 * - A save refuses an effective date that would let orders record the old
 *   version for a new checkout text (CON-M01), dates a text going live with
 *   no date by the day of the save, and refuses over-long fields per field.
 * - "Geri yükle" puts an archived text back, as a draft when its old date
 *   no longer fits and nothing live is replaced.
 * - Every one of them asks for the owner-only `legal` section.
 */

const OWNER = "patron@laffogato.net";
const MSS = CHECKOUT_CONSENT_DOCS[1];
const KVKK = "kvkk-aydinlatma-metni";
// Far past any coded revision, so the cases hold when LEGAL_UPDATED moves.
const LATER = "10 Mart 2030";
const LATEST = "11 Mart 2030";

type Override = ConsentOverride & {
  slug: string;
  title: string;
  summary: string;
};
type Archived = Override & {
  id: string;
  archivedAt: string;
  archivedBy: string;
  reason: string;
};

const db = vi.hoisted(() => ({
  overrides: new Map<string, unknown>(),
  archive: [] as unknown[],
}));

const requireRole = vi.hoisted(() =>
  vi.fn(async (_section: string) => ({
    email: "patron@laffogato.net",
    role: "owner",
    expiresAt: 0,
  })),
);
vi.mock("@/lib/admin/auth", () => ({ requireRole }));
const safeAudit = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/admin/audit", () => ({ safeAudit, logAudit: safeAudit }));
const setAdminFlash = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));

const upsertLegalDoc = vi.hoisted(() =>
  vi.fn(
    async (
      slug: string,
      input: Record<string, unknown>,
      opts: { by?: string } = {},
    ) => {
      const prev = db.overrides.get(slug) as Override | undefined;
      let archivedId: string | null = null;
      if (prev) {
        archivedId = String(db.archive.length + 1);
        db.archive.push({
          ...prev,
          id: archivedId,
          archivedAt: "2030-03-12T09:00:00.000Z",
          archivedBy: opts.by ?? "",
          reason: "replaced",
        });
      }
      const row = { slug, ...input, updatedAt: "2030-03-12T09:00:00.000Z" };
      db.overrides.set(slug, row);
      return { override: row, archivedId };
    },
  ),
);
const resetLegalDoc = vi.hoisted(() =>
  vi.fn(async (slug: string, opts: { by?: string } = {}) => {
    const prev = db.overrides.get(slug) as Override | undefined;
    if (!prev) return null;
    db.overrides.delete(slug);
    const id = String(db.archive.length + 1);
    db.archive.push({
      ...prev,
      id,
      archivedAt: "2030-03-12T09:00:00.000Z",
      archivedBy: opts.by ?? "",
      reason: "reset",
    });
    return id;
  }),
);
vi.mock("@/lib/legal/store", () => ({
  upsertLegalDoc,
  resetLegalDoc,
  getLegalDocOverride: vi.fn(
    async (slug: string) => db.overrides.get(slug) ?? null,
  ),
  listLegalDocOverrides: vi.fn(async () =>
    Object.fromEntries(db.overrides.entries()),
  ),
  getLegalOverrideArchive: vi.fn(
    async (id: string) =>
      (db.archive as Archived[]).find((r) => r.id === id) ?? null,
  ),
  listConsentArchive: vi.fn(async (slugs: readonly string[]) =>
    (db.archive as Archived[]).filter((r) => slugs.includes(r.slug)),
  ),
}));

const actions = await import("@/app/admin/hukuk/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function live(slug: string, patch: Partial<Override> = {}): Override {
  return {
    slug,
    title: "Mesafeli Satış Sözleşmesi",
    summary: "",
    effectiveDate: LATER,
    bodyMarkdown: "## 1. Taraflar\n\nYayındaki metin.",
    isPublished: true,
    updatedAt: "2030-03-10T09:00:00.000Z",
    ...patch,
  };
}

const BODY = "## 1. Taraflar\n\nYeni ve yeterince uzun bir metin.";

beforeEach(() => {
  db.overrides.clear();
  db.archive.length = 0;
  vi.clearAllMocks();
});

describe("resetLegalDocAction (Varsayılana döndür)", () => {
  it("archives the override, removes it and says where it went", async () => {
    db.overrides.set(KVKK, live(KVKK));
    const r = await actions.resetLegalDocAction(null, form({ slug: KVKK }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.message).toMatch(/arşivde/);
    expect(resetLegalDoc).toHaveBeenCalledWith(KVKK, { by: OWNER });
    expect(db.overrides.has(KVKK)).toBe(false);
    expect(db.archive).toHaveLength(1);
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "delete",
        entityId: KVKK,
        payload: { reset: true, archivedId: "1" },
      }),
    );
  });

  it("answers a refusal when there is nothing to reset, or no such document", async () => {
    expect(
      (await actions.resetLegalDocAction(null, form({ slug: KVKK }))).ok,
    ).toBe(false);
    expect(
      (await actions.resetLegalDocAction(null, form({ slug: "yok" }))).ok,
    ).toBe(false);
    expect(resetLegalDoc).toHaveBeenCalledTimes(1);
    expect(safeAudit).not.toHaveBeenCalled();
  });
});

describe("updateLegalDocAction", () => {
  const save = (slug: string, fields: Record<string, string>) =>
    actions.updateLegalDocAction(slug, null, form(fields));

  it("refuses an over-long summary under its field and writes nothing", async () => {
    const r = await save(KVKK, { title: "KVKK", summary: "x".repeat(601) });
    expect(r).toEqual({
      ok: false,
      error: "Formdaki uyarıları gider.",
      fieldErrors: { summary: "Özet en fazla 600 karakter olabilir." },
    });
    expect(upsertLegalDoc).not.toHaveBeenCalled();
  });

  it("refuses a free-text date ('26.05.2026')", async () => {
    const r = await save(KVKK, { title: "KVKK", effectiveDate: "26.05.2026" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors?.effectiveDate).toBe("Tarihi 26 Mayıs 2026 gibi yaz.");
  });

  it("refuses a rewritten checkout text published under the old date (CON-M01)", async () => {
    db.overrides.set(MSS, live(MSS));
    const r = await save(MSS, {
      title: "Mesafeli Satış Sözleşmesi",
      effectiveDate: LATER,
      bodyMarkdown: BODY,
      isPublished: "on",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors?.effectiveDate).toMatch(
      /^Metin değişti: yürürlük tarihini güncelle\./,
    );
    expect(upsertLegalDoc).not.toHaveBeenCalled();
  });

  it("refuses the coded revision's date for a new checkout text", async () => {
    const r = await save(MSS, {
      title: "Mesafeli Satış Sözleşmesi",
      effectiveDate: LEGAL_UPDATED,
      bodyMarkdown: BODY,
      isPublished: "on",
    });
    expect(r.ok).toBe(false);
  });

  it("dates a text going live with no date by the day of the save, then goes back with a toast", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-03-12T21:30:00.000Z")); // 13 Mart in Istanbul
    try {
      await expect(
        save(MSS, {
          title: "Mesafeli Satış Sözleşmesi",
          effectiveDate: "",
          bodyMarkdown: BODY,
          isPublished: "on",
        }),
      ).rejects.toThrow("NEXT_REDIRECT /admin/hukuk");
    } finally {
      vi.useRealTimers();
    }
    expect(upsertLegalDoc).toHaveBeenCalledWith(
      MSS,
      expect.objectContaining({
        effectiveDate: "13 Mart 2030",
        isPublished: true,
      }),
      { by: OWNER },
    );
    expect(setAdminFlash).toHaveBeenCalledWith(
      "Mesafeli Satış Sözleşmesi kaydedildi ve yayında.",
    );
  });

  it("keeps a draft's blank date blank", async () => {
    await expect(
      save(KVKK, { title: "KVKK", effectiveDate: "", bodyMarkdown: "x" }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(upsertLegalDoc).toHaveBeenCalledWith(
      KVKK,
      expect.objectContaining({ effectiveDate: "", isPublished: false }),
      { by: OWNER },
    );
  });
});

describe("restoreLegalDocAction (Geri yükle)", () => {
  function archived(patch: Partial<Archived>): Archived {
    const row: Archived = {
      ...live(KVKK),
      id: String(db.archive.length + 1),
      archivedAt: "2030-03-11T09:00:00.000Z",
      archivedBy: OWNER,
      reason: "reset",
      ...patch,
    };
    db.archive.push(row);
    return row;
  }

  it("puts an archived text back as it was", async () => {
    const row = archived({});
    const r = await actions.restoreLegalDocAction(null, form({ id: row.id }));
    expect(r).toEqual({
      ok: true,
      message: `${findLegalDoc(KVKK)!.title} geri yüklendi ve yayında.`,
      tone: "success",
    });
    expect(upsertLegalDoc).toHaveBeenCalledWith(
      KVKK,
      {
        title: row.title,
        summary: row.summary,
        effectiveDate: row.effectiveDate,
        bodyMarkdown: row.bodyMarkdown,
        isPublished: true,
      },
      { by: OWNER },
    );
  });

  it("brings a checkout text whose date no longer fits back as a draft", async () => {
    // Its date is the coded revision's: live, orders would record the
    // coded version for it.
    const row = archived({ slug: MSS, effectiveDate: LEGAL_UPDATED });
    const r = await actions.restoreLegalDocAction(null, form({ id: row.id }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tone).toBe("warning");
    expect(r.message).toMatch(/taslak olarak geri yüklendi/);
    expect(upsertLegalDoc).toHaveBeenCalledWith(
      MSS,
      expect.objectContaining({ isPublished: false }),
      { by: OWNER },
    );
  });

  it("refuses it when that would take a live text down", async () => {
    db.overrides.set(MSS, live(MSS, { effectiveDate: LATEST }));
    const row = archived({
      slug: MSS,
      effectiveDate: LATER,
      bodyMarkdown: "## 1. Taraflar\n\nEski metin.",
    });
    const r = await actions.restoreLegalDocAction(null, form({ id: row.id }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/^Geri yüklenmedi\./);
    expect(upsertLegalDoc).not.toHaveBeenCalled();
  });

  it("brings an Ön Bilgilendirme text back as a draft once Mesafeli Satış changed beside it", async () => {
    // Orders recorded LATEST for (this text, coded Mesafeli Satış). With a
    // Mesafeli Satış text live now, LATEST would stand for a second pair.
    const ONB = CHECKOUT_CONSENT_DOCS[0];
    const row = archived({
      slug: ONB,
      effectiveDate: LATEST,
      bodyMarkdown: "## 1. Taraflar\n\nÖn bilgilendirme metni.",
      updatedAt: "2030-03-08T09:00:00.000Z",
      archivedAt: "2030-03-09T09:00:00.000Z",
    });
    db.overrides.set(MSS, live(MSS, { updatedAt: "2030-03-10T09:00:00.000Z" }));
    const r = await actions.restoreLegalDocAction(null, form({ id: row.id }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tone).toBe("warning");
    expect(r.message).toMatch(/tek sürümü paylaşır/);
    expect(upsertLegalDoc).toHaveBeenCalledWith(
      ONB,
      expect.objectContaining({ isPublished: false }),
      { by: OWNER },
    );
  });

  it("refuses an unknown archive id", async () => {
    const r = await actions.restoreLegalDocAction(null, form({ id: "99" }));
    expect(r.ok).toBe(false);
  });
});

describe("owner only", () => {
  it("asks every action for the legal section", async () => {
    db.overrides.set(KVKK, live(KVKK));
    await actions.resetLegalDocAction(null, form({ slug: KVKK }));
    await actions.restoreLegalDocAction(null, form({ id: "1" }));
    await actions
      .updateLegalDocAction(KVKK, null, form({ title: "x" }))
      .catch(() => {});
    expect(requireRole.mock.calls.map((c) => c[0])).toEqual([
      "legal",
      "legal",
      "legal",
    ]);
  });
});

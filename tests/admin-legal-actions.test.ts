import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConsentOverride } from "@/lib/legal/consent-version";
import { findLegalDoc } from "@/lib/legal/documents";
import { CHECKOUT_CONSENT_DOCS, LEGAL_UPDATED } from "@/lib/legal/meta";
import {
  codedVersionDoc,
  legalVersionOf,
  shownVersionDoc,
} from "@/lib/legal/version-core";

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
vi.mock("@/lib/legal/store", async () => ({
  // The real row shaping: the panel stores the text a save will show from it.
  legalDocRow: (
    await vi.importActual<typeof import("@/lib/legal/store")>(
      "@/lib/legal/store",
    )
  ).legalDocRow,
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

// legal_doc_versions, in memory: what the panel stores before a change.
const recordLegalVersions = vi.hoisted(() =>
  vi.fn(async (_versions: { hash: string; slug: string; text: string }[]) => {}),
);
vi.mock("@/lib/legal/versions", () => ({ recordLegalVersions }));

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
    // The hashes of the text shown before (the override) and after (the
    // coded text), both stored first (decision D-VERSIONS-TABLE).
    const coded = findLegalDoc(KVKK)!;
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "delete",
        entityId: KVKK,
        payload: {
          reset: true,
          archivedId: "1",
          textHashBefore: legalVersionOf(shownVersionDoc(coded, live(KVKK)))
            .hash,
          textHashAfter: legalVersionOf(codedVersionDoc(coded)).hash,
        },
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

/**
 * Every text /hukuk shows is kept by hash (decision D-VERSIONS-TABLE): the
 * panel stores the text shown before a change and the one shown after it,
 * BEFORE the change is written, and the audit row names both hashes rather
 * than only `{ published }`. A copy that cannot be stored refuses the change:
 * no text goes live, and none goes away, without it.
 */
describe("the shown texts are stored before the change", () => {
  const order: string[] = [];
  beforeEach(() => {
    order.length = 0;
    recordLegalVersions.mockImplementation(async () => {
      order.push("record");
    });
    upsertLegalDoc.mockImplementationOnce(async (slug, input) => {
      order.push("save");
      const row = { slug, ...input, updatedAt: "2030-03-12T09:00:00.000Z" };
      db.overrides.set(slug, row);
      return { override: row as never, archivedId: null };
    });
  });

  it("a save stores the text shown now and the one it publishes, then audits both hashes", async () => {
    await expect(
      actions.updateLegalDocAction(
        KVKK,
        null,
        form({
          title: "  KVKK Aydınlatma Metni  ",
          effectiveDate: LATER,
          bodyMarkdown: BODY,
          isPublished: "on",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT /admin/hukuk");
    expect(order).toEqual(["record", "save"]);
    const coded = findLegalDoc(KVKK)!;
    const before = legalVersionOf(codedVersionDoc(coded));
    // What the page will print: the title as the save trims it.
    const after = legalVersionOf(
      shownVersionDoc(coded, {
        title: "KVKK Aydınlatma Metni",
        summary: "",
        effectiveDate: LATER,
        bodyMarkdown: BODY,
        isPublished: true,
        updatedAt: "",
      }),
    );
    const stored = recordLegalVersions.mock.calls[0][0];
    expect(stored.map((v) => v.hash)).toEqual([before.hash, after.hash]);
    expect(stored[1].text).toContain('"source":"override"');
    expect(stored[1].text).toContain('"title":"KVKK Aydınlatma Metni"');
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        entityId: KVKK,
        payload: expect.objectContaining({
          published: true,
          textHashBefore: before.hash,
          textHashAfter: after.hash,
        }),
      }),
    );
  });

  it("a draft leaves the coded text shown: before and after are the same text", async () => {
    await expect(
      actions.updateLegalDocAction(
        KVKK,
        null,
        form({ title: "KVKK", effectiveDate: "", bodyMarkdown: "x" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    const coded = legalVersionOf(codedVersionDoc(findLegalDoc(KVKK)!)).hash;
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          textHashBefore: coded,
          textHashAfter: coded,
        }),
      }),
    );
  });

  it("refuses a save whose texts cannot be stored, and writes nothing", async () => {
    recordLegalVersions.mockRejectedValueOnce(new Error("db down"));
    const r = await actions.updateLegalDocAction(
      KVKK,
      null,
      form({
        title: "KVKK",
        effectiveDate: LATER,
        bodyMarkdown: BODY,
        isPublished: "on",
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/sürüm arşive yazılamadı/);
    expect(upsertLegalDoc).not.toHaveBeenCalled();
    expect(safeAudit).not.toHaveBeenCalled();
  });

  it("refuses a reset whose texts cannot be stored, and removes nothing", async () => {
    db.overrides.set(KVKK, live(KVKK));
    recordLegalVersions.mockRejectedValueOnce(new Error("db down"));
    const r = await actions.resetLegalDocAction(null, form({ slug: KVKK }));
    expect(r.ok).toBe(false);
    expect(resetLegalDoc).not.toHaveBeenCalled();
    expect(db.overrides.has(KVKK)).toBe(true);
  });

  it("refuses a restore whose texts cannot be stored, and restores nothing", async () => {
    db.archive.push({
      ...live(KVKK),
      id: "1",
      archivedAt: "2030-03-11T09:00:00.000Z",
      archivedBy: OWNER,
      reason: "reset",
    });
    recordLegalVersions.mockRejectedValueOnce(new Error("db down"));
    const r = await actions.restoreLegalDocAction(null, form({ id: "1" }));
    expect(r.ok).toBe(false);
    expect(upsertLegalDoc).not.toHaveBeenCalled();
  });

  it("a restore audits the hash of the text it brings back", async () => {
    const row = {
      ...live(KVKK, { bodyMarkdown: "## Geri gelen\n\nMetin." }),
      id: "1",
      archivedAt: "2030-03-11T09:00:00.000Z",
      archivedBy: OWNER,
      reason: "reset",
    };
    db.archive.push(row);
    const r = await actions.restoreLegalDocAction(null, form({ id: "1" }));
    expect(r.ok).toBe(true);
    expect(order).toEqual(["record", "save"]);
    const back = legalVersionOf(shownVersionDoc(findLegalDoc(KVKK)!, row));
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          restoredFrom: "1",
          textHashAfter: back.hash,
        }),
      }),
    );
  });
});

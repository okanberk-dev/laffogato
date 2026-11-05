import { beforeEach, describe, expect, it, vi } from "vitest";

import { findLegalDoc } from "@/lib/legal/documents";
import { karaokeLegalDocFor } from "@/lib/legal/karaoke-doc";
import { CHECKOUT_CONSENT_DOCS, KARAOKE_CONSENT_DOCS } from "@/lib/legal/meta";
import {
  codedVersionDoc,
  legalVersionHash,
  legalVersionOf,
  overrideVersionDoc,
} from "@/lib/legal/version-core";

/**
 * `legalConsent.textHashes` (decision D-VERSIONS-TABLE): what a consent
 * records next to its version label is the hash of each text exactly as
 * /hukuk/<slug> shows it now - a live panel text, else the coded one - read
 * through the same live reader as the label. Each text is stored once per
 * hash on the way, in one INSERT ... ON CONFLICT DO NOTHING; a store that
 * fails costs the consent nothing.
 */

type Row = Record<string, unknown>;

const h = vi.hoisted(() => ({
  legalDocs: [] as Row[],
  versions: new Map<string, Row>(),
  failWrites: false,
  writes: [] as { rows: Row[]; onConflict?: string; ignore?: boolean }[],
  selects: 0,
  /** Each read of a legal_docs row, by slug, in order. */
  reads: [] as string[],
  /** When set, what the nth read of a slug sees (a publish in between). */
  seen: null as null | ((slug: string, nth: number) => Row | null),
}));

vi.mock("@/lib/db", () => ({
  TABLES: { legalDocs: "legal_docs", legalDocVersions: "legal_doc_versions" },
  getDb: () => ({
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      let inList: string[] | null = null;
      const api = {
        select: () => api,
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return api;
        },
        in: (_column: string, values: string[]) => {
          inList = values;
          return api;
        },
        maybeSingle: async () => {
          const slug = String(filters.slug);
          h.reads.push(slug);
          const nth = h.reads.filter((x) => x === slug).length;
          return {
            data: h.seen
              ? h.seen(slug, nth)
              : (h.legalDocs.find((r) =>
                  Object.entries(filters).every(([k, v]) => r[k] === v),
                ) ?? null),
            error: null,
            status: 200,
          };
        },
        upsert: async (
          rows: Row[],
          opts: { onConflict?: string; ignoreDuplicates?: boolean },
        ) => {
          h.writes.push({
            rows,
            onConflict: opts.onConflict,
            ignore: opts.ignoreDuplicates,
          });
          if (h.failWrites) {
            return {
              data: null,
              error: { message: "relation does not exist", code: "42P01" },
              status: 400,
            };
          }
          for (const r of rows) {
            if (!h.versions.has(String(r.hash)))
              h.versions.set(String(r.hash), r);
          }
          return { data: null, error: null, status: 201 };
        },
        then: (resolve: (r: unknown) => void) => {
          h.selects += 1;
          const rows =
            table === "legal_doc_versions"
              ? (inList ?? [])
                  .filter((hash) => h.versions.has(hash))
                  .map((hash) => ({ hash }))
              : [];
          resolve({ data: rows, error: null, status: 200 });
        },
      };
      return api;
    },
  }),
}));

const store = await import("@/lib/legal/store");
const versions = await import("@/lib/legal/versions");

const [OBF, MSS] = CHECKOUT_CONSENT_DOCS;
const coded = (slug: string) =>
  legalVersionOf(codedVersionDoc(findLegalDoc(slug)!));

function published(slug: string, patch: Row = {}): Row {
  return {
    slug,
    title: "Mesafeli Satış Sözleşmesi (panel)",
    summary: "",
    effectiveDate: "12 Kasım 2026",
    bodyMarkdown: "## 1. Taraflar\n\nPanel metni.",
    isPublished: true,
    updatedAt: "2026-11-12T09:00:00.000Z",
    ...patch,
  };
}

beforeEach(() => {
  h.legalDocs = [];
  h.versions.clear();
  h.failWrites = false;
  h.writes = [];
  h.selects = 0;
  h.reads = [];
  h.seen = null;
  versions.forgetKnownLegalVersions();
  vi.restoreAllMocks();
});

describe("checkoutConsentShown", () => {
  it("records the coded texts' hashes and stores each text under its own hash", async () => {
    const hashes = (await store.checkoutConsentShown()).textHashes;
    expect(hashes).toEqual({ [OBF]: coded(OBF).hash, [MSS]: coded(MSS).hash });
    // One statement, ON CONFLICT (hash) DO NOTHING.
    expect(h.writes).toHaveLength(1);
    expect(h.writes[0].onConflict).toBe("hash");
    expect(h.writes[0].ignore).toBe(true);
    for (const row of h.writes[0].rows) {
      expect(legalVersionHash(String(row.body))).toBe(row.hash);
      expect(Object.keys(row).sort()).toEqual(["body", "hash", "slug"]);
    }
  });

  it("records the panel text when one is live, the coded one under a draft", async () => {
    h.legalDocs = [published(MSS), published(OBF, { isPublished: false })];
    const hashes = (await store.checkoutConsentShown()).textHashes;
    const live = legalVersionOf(
      overrideVersionDoc(findLegalDoc(MSS)!, published(MSS) as never),
    );
    expect(hashes[MSS]).toBe(live.hash);
    expect(hashes[OBF]).toBe(coded(OBF).hash);
    // The label the same record carries comes from the same row.
    expect((await store.checkoutConsentShown()).version).toBe("12 Kasım 2026");
  });

  /**
   * Review R4 (21 Eki 2026): the label came from one read of the overrides
   * and the hashes from another, so a publish between the two recorded one
   * text's label next to another text's hash. One read now gives both.
   */
  it("reads each checkout override once for the label and the hashes together", async () => {
    await store.checkoutConsentShown();
    expect([...h.reads].sort()).toEqual([...CHECKOUT_CONSENT_DOCS].sort());
  });

  it("never pairs one text's label with another text's hash across a publish", async () => {
    const A = published(MSS, {
      effectiveDate: "11 Kasım 2026",
      bodyMarkdown: "## Metin A",
    });
    const B = published(MSS, {
      effectiveDate: "12 Kasım 2026",
      bodyMarkdown: "## Metin B",
      updatedAt: "2026-11-12T09:00:00.000Z",
    });
    // The first read of the contract sees A; any later read sees B.
    h.seen = (slug, nth) => (slug === MSS ? (nth === 1 ? A : B) : null);
    const shown = await store.checkoutConsentShown();
    const hashOf = (o: Row) =>
      legalVersionOf(overrideVersionDoc(findLegalDoc(MSS)!, o as never)).hash;
    expect(shown.version).toBe("11 Kasım 2026");
    expect(shown.textHashes[MSS]).toBe(hashOf(A));
  });

  it("sends a text the table already has only once", async () => {
    await store.checkoutConsentShown();
    versions.forgetKnownLegalVersions();
    await store.checkoutConsentShown();
    // The second consent found both stored: no second insert.
    expect(h.writes).toHaveLength(1);
    // And a warm instance does not even ask.
    const asked = h.selects;
    await store.checkoutConsentShown();
    expect(h.selects).toBe(asked);
    expect(h.writes).toHaveLength(1);
  });

  it("still records the hashes when the texts cannot be stored, and logs no text", async () => {
    h.failWrites = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const hashes = (await store.checkoutConsentShown()).textHashes;
    expect(hashes).toEqual({ [OBF]: coded(OBF).hash, [MSS]: coded(MSS).hash });
    const logged = error.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("consent texts not stored");
    expect(logged).not.toContain("Ön Bilgilendirme");
  });
});

describe("karaokeConsentShown", () => {
  const KARAOKE = KARAOKE_CONSENT_DOCS[0];

  it("hashes the terms dated by the booking's own settings read", async () => {
    const settings = {
      karaokeFreeCancelHours: 2,
      karaokeLateRefundPercent: 0,
      karaokeCancelPolicyAt: "",
      mobileApp: { minSupportedAppVersion: "0.0.0" },
    };
    const hashes = (await store.karaokeConsentShown(settings)).textHashes;
    expect(hashes).toEqual({
      [KARAOKE]: legalVersionOf(codedVersionDoc(karaokeLegalDocFor(settings)))
        .hash,
    });
    expect(h.writes[0].rows.map((r) => r.slug)).toEqual([KARAOKE]);
  });
});

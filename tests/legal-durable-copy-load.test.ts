import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";
import { findLegalDoc, type LegalDoc } from "@/lib/legal/documents";
import { CHECKOUT_CONSENT_DOCS, KARAOKE_CONSENT_DOCS } from "@/lib/legal/meta";
import {
  codedVersionDoc,
  legalVersionOf,
  overrideVersionDoc,
  type LegalVersion,
} from "@/lib/legal/version-core";
import type { KaraokeReservation } from "@/lib/mobile/karaoke-core";

/**
 * The copy is made from the version the consent recorded
 * (`legalConsent.textHashes`), read from `legal_doc_versions` - never from
 * today's text. Today's text is used only when it hashes to the very hash
 * recorded (then it IS that text), and it is stored on the way so the
 * mail's version link opens. Anything else is no copy at all, and the
 * mail's own bound (`durableCopyForMail`) keeps a slow or failing read from
 * holding the mail.
 */

const h = vi.hoisted(() => ({
  stored: new Map<string, unknown>(),
  loadLegalVersions: vi.fn(),
  recordLegalVersions: vi.fn(),
  getPublishedLegalOverrideLive: vi.fn(),
}));

vi.mock("@/lib/legal/versions", () => ({
  loadLegalVersions: h.loadLegalVersions,
  recordLegalVersions: h.recordLegalVersions,
}));
vi.mock("@/lib/legal/store", () => ({
  getPublishedLegalOverrideLive: h.getPublishedLegalOverrideLive,
}));
// The karaoke terms "as of now" read the settings: the default policy.
vi.mock("@/lib/admin/store", () => ({
  getPublicSettings: async () => ({
    karaokeFreeCancelHours: 2,
    karaokeLateRefundPercent: 0,
    karaokeCancelPolicyAt: "",
    mobileApp: { minSupportedAppVersion: "0.0.0" },
  }),
}));

const load = await import("@/lib/legal/durable-copy-load");

const [OBF, MSS] = CHECKOUT_CONSENT_DOCS;
const KARAOKE = KARAOKE_CONSENT_DOCS[0];

const today = (slug: string) =>
  legalVersionOf(codedVersionDoc(findLegalDoc(slug)!));

/** The ÖBF as it was on an earlier day: another title, another hash. */
function older(slug: string): LegalVersion {
  const doc = findLegalDoc(slug)!;
  const then: LegalDoc = {
    ...doc,
    title: `${doc.title} (eski sürüm)`,
    updatedAt: "18 Ekim 2026",
  };
  return legalVersionOf(codedVersionDoc(then));
}

function order(textHashes?: Record<string, string>): AdminOrder {
  return {
    id: "ord-1",
    orderNo: 10042,
    customerName: "Eda Yılmaz",
    customerEmail: "eda@example.com",
    customerPhone: "",
    shippingAddress: "Bağdat Cad. 1, Kadıköy",
    internalNote: "",
    status: "paid",
    items: [
      { productName: "Sirena", qty: 2, unitPriceMinor: 32_000, status: "pending" },
    ],
    subtotalMinor: 64_000,
    discountMinor: 0,
    promoCode: "",
    shippingMinor: 0,
    totalMinor: 64_000,
    refunds: [],
    createdAt: "2026-10-21T10:00:00.000Z",
    legalConsent: {
      acceptedAt: "2026-10-21T10:00:00.000Z",
      documents: [...CHECKOUT_CONSENT_DOCS],
      version: "20 Ekim 2026",
      ...(textHashes ? { textHashes } : {}),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.stored.clear();
  h.loadLegalVersions.mockImplementation(async (hashes: string[]) => {
    const out = new Map<string, unknown>();
    for (const hash of hashes) {
      if (h.stored.has(hash)) out.set(hash, h.stored.get(hash));
    }
    return out;
  });
  h.recordLegalVersions.mockResolvedValue(undefined);
  h.getPublishedLegalOverrideLive.mockResolvedValue(null);
});

describe("orderDurableCopy", () => {
  it("is built from the stored version the consent names, not today's text", async () => {
    const obf = older(OBF);
    const mss = today(MSS);
    h.stored.set(obf.hash, obf);
    h.stored.set(mss.hash, mss);
    const copy = await load.orderDurableCopy(
      order({ [OBF]: obf.hash, [MSS]: mss.hash }),
    );
    expect(copy).not.toBeNull();
    expect(copy!.filename).toBe("siparis-10042-on-bilgilendirme-ve-sozlesme.html");
    expect(copy!.html).toContain(`${findLegalDoc(OBF)!.title} (eski sürüm)`);
    expect(copy!.html).toContain("Bu metin 18 Ekim 2026 tarihli sürümdür.");
    expect(copy!.html).toContain(obf.hash);
    expect(copy!.links).toEqual([
      {
        slug: OBF,
        title: obf.doc.title,
        url: `https://laffogato.net/hukuk/${OBF}?surum=${obf.hash.slice(0, 16)}`,
      },
      {
        slug: MSS,
        title: mss.doc.title,
        url: `https://laffogato.net/hukuk/${MSS}?surum=${mss.hash.slice(0, 16)}`,
      },
    ]);
    // Nothing healed: both were stored.
    expect(h.recordLegalVersions).not.toHaveBeenCalled();
  });

  it("asks nothing for an order whose consent recorded no hashes", async () => {
    expect(await load.orderDurableCopy(order())).toBeNull();
    expect(
      await load.orderDurableCopy(order({ [OBF]: today(OBF).hash })),
    ).toBeNull();
    expect(h.loadLegalVersions).not.toHaveBeenCalled();
  });

  it("uses today's text only when it hashes to the recorded hash, and stores it", async () => {
    const obf = today(OBF);
    const mss = today(MSS);
    // Neither was stored by the consent (its write failed).
    const copy = await load.orderDurableCopy(
      order({ [OBF]: obf.hash, [MSS]: mss.hash }),
    );
    expect(copy).not.toBeNull();
    expect(h.recordLegalVersions).toHaveBeenCalledTimes(1);
    expect(
      (h.recordLegalVersions.mock.calls[0][0] as LegalVersion[]).map((v) => v.hash),
    ).toEqual([obf.hash, mss.hash]);
  });

  it("uses the live panel text when that is the text recorded", async () => {
    const doc = findLegalDoc(MSS)!;
    const o = {
      slug: MSS,
      title: "Mesafeli Satış Sözleşmesi (panel)",
      summary: "",
      effectiveDate: "2 Kasım 2026",
      bodyMarkdown: "## 1. Taraflar\n\nPanel metni.",
      isPublished: true,
      updatedAt: "2026-11-02T09:00:00.000Z",
    };
    const live = legalVersionOf(overrideVersionDoc(doc, o));
    h.getPublishedLegalOverrideLive.mockResolvedValue(o);
    h.stored.set(today(OBF).hash, today(OBF));
    const copy = await load.orderDurableCopy(
      order({ [OBF]: today(OBF).hash, [MSS]: live.hash }),
    );
    expect(copy!.html).toContain("Panel metni.");
    expect(h.recordLegalVersions).toHaveBeenCalledWith([live]);
  });

  it("is no copy when a recorded text is neither stored nor shown today", async () => {
    const gone = older(OBF);
    h.stored.set(today(MSS).hash, today(MSS));
    expect(
      await load.orderDurableCopy(
        order({ [OBF]: gone.hash, [MSS]: today(MSS).hash }),
      ),
    ).toBeNull();
    expect(h.recordLegalVersions).not.toHaveBeenCalled();
  });

  it("is no copy when a stored row belongs to another document", async () => {
    const mss = today(MSS);
    h.stored.set(mss.hash, mss);
    // The ÖBF slot names the MSS's hash.
    expect(
      await load.orderDurableCopy(order({ [OBF]: mss.hash, [MSS]: mss.hash })),
    ).toBeNull();
  });
});

describe("karaokeDurableCopy", () => {
  function reservation(textHashes?: Record<string, string>): KaraokeReservation {
    return {
      id: "krk-00042",
      customerEmail: "eda@example.com",
      customerName: "Eda Yılmaz",
      date: "2026-10-30",
      startHour: 20,
      hours: 2,
      guests: 4,
      status: "confirmed",
      priceMinor: 90_000,
      discountMinor: 0,
      totalMinor: 90_000,
      note: "",
      createdAt: "2026-10-21T10:00:00.000Z",
      updatedAt: "2026-10-21T10:00:00.000Z",
      paymentStatus: "paid",
      paidMinor: 90_000,
      freeCancelHours: 2,
      lateRefundPercent: 0,
      cancelDeadline: "2026-10-30T15:00:00.000Z",
      legalConsent: {
        acceptedAt: "2026-10-21T10:00:00.000Z",
        documents: [KARAOKE],
        version: "20 Ekim 2026",
        ...(textHashes ? { textHashes } : {}),
      },
    };
  }

  it("is built from the stored terms with the booking's own facts", async () => {
    const v = today(KARAOKE);
    h.stored.set(v.hash, v);
    const copy = await load.karaokeDurableCopy(reservation({ [KARAOKE]: v.hash }));
    expect(copy!.filename).toBe("karaoke-sozlesme-KRK-00042.html");
    expect(copy!.html).toContain("<td>30 Ekim 2026, 18:00</td>");
    expect(copy!.html).toContain("<td>iade yapılmaz</td>");
    expect(copy!.links[0].url).toBe(
      `https://laffogato.net/hukuk/${KARAOKE}?surum=${v.hash.slice(0, 16)}`,
    );
  });

  it("is no copy for a booking with no recorded hash", async () => {
    expect(await load.karaokeDurableCopy(reservation())).toBeNull();
    expect(h.loadLegalVersions).not.toHaveBeenCalled();
  });
});

describe("durableCopyForMail", () => {
  it("gives up in time, and the warning names the record, never an address", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const started = Date.now();
    const copy = await load.durableCopyForMail(
      "order=ord-1",
      () => new Promise(() => {}),
      20,
    );
    expect(copy).toBeNull();
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(warn).toHaveBeenCalledWith(
      "[durable-copy] order=ord-1: no attachment (timed out)",
    );
    warn.mockRestore();
  });

  it("turns a failure into no copy, never a throw", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    h.recordLegalVersions.mockRejectedValue(new Error("relation does not exist"));
    const copy = await load.durableCopyForMail("order=ord-1", () =>
      load.orderDurableCopy(
        order({ [OBF]: today(OBF).hash, [MSS]: today(MSS).hash }),
      ),
    );
    expect(copy).toBeNull();
    for (const call of warn.mock.calls) {
      expect(String(call[0])).not.toMatch(/@/);
    }
    warn.mockRestore();
  });
});

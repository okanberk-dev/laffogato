import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONSENT_COOKIE, CONSENT_VERSION } from "@/lib/consent/cookie";
import {
  META_PIXEL_DEFAULT_ID,
  karaokeConversion,
  karaokeParams,
  metaPixelHostAllowed,
  metaPixelHosts,
  metaPixelId,
  orderConversion,
  pixelDocumentAllowed,
  pixelPageKey,
  sanitizePixelParams,
  shopParams,
} from "@/lib/consent/meta-pixel";
import { CONSENT_UPDATED_EVENT, pushConsentUpdate } from "@/lib/consent/script";

/**
 * The Meta Pixel (25 Ekim 2026, docs/META-PIXEL.md): marketing consent first,
 * the live site only, never the card page or the admin panel, no person in an
 * event. The browser side runs here against a scripted `window` and
 * `document`; the network side is the Chrome check in the PR description.
 */

describe("which pixel, and where", () => {
  it("falls back to the köşk's pixel, and an empty value switches it off", () => {
    expect(metaPixelId(undefined)).toBe("1433246991545596");
    expect(META_PIXEL_DEFAULT_ID).toBe("1433246991545596");
    expect(metaPixelId(" 1433246991545596 ")).toBe("1433246991545596");
    expect(metaPixelId("")).toBe("");
    expect(metaPixelId("   ")).toBe("");
    expect(metaPixelId("not-an-id")).toBe("");
    expect(metaPixelId("123")).toBe("");
  });

  it("is off while the legal texts do not describe it", () => {
    expect(metaPixelId(undefined, false)).toBe("");
    expect(metaPixelId("1433246991545596", false)).toBe("");
  });

  it("runs on the live site and nowhere else", () => {
    expect(metaPixelHosts(undefined)).toEqual([
      "laffogato.net",
      "www.laffogato.net",
    ]);
    for (const host of [
      "laffogato.net",
      "www.laffogato.net",
      "LAFFOGATO.net",
    ]) {
      expect(metaPixelHostAllowed(host, metaPixelHosts(undefined)), host).toBe(
        true,
      );
    }
    for (const host of [
      "localhost",
      "127.0.0.1",
      "laffogato-git-feat-meta-pixel.vercel.app",
      "evil-laffogato.net",
      "laffogato.net.evil.com",
      "ladmin.laffogato.net",
    ]) {
      expect(metaPixelHostAllowed(host, metaPixelHosts(undefined)), host).toBe(
        false,
      );
    }
  });

  it("takes a staging host only from the environment, for Test Events", () => {
    const hosts = metaPixelHosts(" staging.laffogato.net , localhost ");
    expect(hosts).toEqual(["staging.laffogato.net", "localhost"]);
    expect(metaPixelHostAllowed("staging.laffogato.net", hosts)).toBe(true);
    expect(metaPixelHostAllowed("laffogato.net", hosts)).toBe(false);
    expect(metaPixelHosts("  ,  ")).toEqual([
      "laffogato.net",
      "www.laffogato.net",
    ]);
  });

  it("keeps out the card page and the panel, and only them", () => {
    expect(pixelDocumentAllowed("/odeme")).toBe(false);
    expect(pixelDocumentAllowed("/admin")).toBe(false);
    expect(pixelDocumentAllowed("/admin/siparisler")).toBe(false);
    expect(pixelDocumentAllowed("/%61dmin/musteriler")).toBe(false);
    // The result pages under /odeme are ordinary site pages.
    expect(pixelDocumentAllowed("/odeme/basarili")).toBe(true);
    expect(pixelDocumentAllowed("/odeme/donus")).toBe(true);
    expect(pixelDocumentAllowed("/")).toBe(true);
    expect(pixelDocumentAllowed("/karaoke")).toBe(true);
    expect(pixelDocumentAllowed("/rezervasyon")).toBe(true);
    expect(pixelDocumentAllowed("/administrator")).toBe(true);
  });

  it("counts a route change, not a step inside the karaoke wizard", () => {
    expect(pixelPageKey("/karaoke", "")).toBe("/karaoke");
    expect(pixelPageKey("/karaoke", "adim=2")).toBe("/karaoke");
    expect(pixelPageKey("/karaoke", "tarih=2026-10-30&adim=3&saat=20")).toBe(
      "/karaoke?saat=20&tarih=2026-10-30",
    );
    expect(pixelPageKey("/karaoke", "tarih=2026-10-31")).not.toBe(
      pixelPageKey("/karaoke", "tarih=2026-10-30"),
    );
    expect(pixelPageKey("/magaza", "")).not.toBe(pixelPageKey("/menu", ""));
  });
});

describe("what an event may carry", () => {
  it("keeps ids, a name, a price - and drops everything else", () => {
    const params = sanitizePixelParams({
      content_ids: ["karaoke-odasi"],
      content_name: "Karaoke odası",
      content_type: "product",
      currency: "TRY",
      value: 1500,
      num_items: 2,
      // Not allowed keys, as a caller that casts could pass them.
      ...({
        email: "ada@example.com",
        phone: "+90 536 429 09 19",
        name: "Ada Lovelace",
        em: "ada@example.com",
      } as object),
    });
    expect(params).toEqual({
      content_ids: ["karaoke-odasi"],
      content_name: "Karaoke odası",
      content_type: "product",
      currency: "TRY",
      value: 1500,
      num_items: 2,
    });
  });

  it("drops text that reads as an e-mail or a phone number", () => {
    const params = sanitizePixelParams({
      content_name: "ada@example.com",
      content_ids: ["prd-0001", "0536 429 09 19", "ada@example.com"],
      contents: [
        { id: "prd-0001", quantity: 2, item_price: 129.9 },
        { id: "+90 536 429 09 19", quantity: 1 },
      ],
    });
    expect(params).toEqual({
      content_ids: ["prd-0001"],
      contents: [{ id: "prd-0001", quantity: 2, item_price: 129.9 }],
    });
  });

  it("drops a number that is not a number", () => {
    expect(
      sanitizePixelParams({
        value: Number.NaN,
        num_items: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({});
    expect(sanitizePixelParams(undefined)).toEqual({});
  });

  it("builds the karaoke events from one source", () => {
    expect(karaokeParams(150000, 2)).toEqual({
      content_ids: ["karaoke-odasi"],
      content_name: "Karaoke odası",
      content_type: "product",
      currency: "TRY",
      value: 1500,
      num_items: 2,
    });
    expect(karaokeParams(129990, 1).value).toBe(1299.9);
  });

  it("reports a paid booking as Purchase and Schedule under its code", () => {
    const spec = karaokeConversion({
      id: "krk-00042",
      hours: 2,
      totalMinor: 150000,
      paidMinor: 135000,
    });
    expect(spec.eventId).toBe("purchase_krk-00042");
    expect(spec.events).toEqual(["Purchase", "Schedule"]);
    // What the bank took, not the list total.
    expect(spec.params.value).toBe(1350);
    expect(spec.params.num_items).toBe(2);
    // Without the recorded payment the booking's total stands.
    expect(
      karaokeConversion({ id: "krk-1", hours: 1, totalMinor: 90000 }).params
        .value,
    ).toBe(900);
  });

  it("does not report a Purchase of nothing", () => {
    expect(
      karaokeConversion({
        id: "krk-2",
        hours: 1,
        totalMinor: 0,
        paidMinor: 0,
      }).events,
    ).toEqual(["Schedule"]);
    expect(
      orderConversion({ orderNo: 10001, totalMinor: 0, items: [] }).events,
    ).toEqual([]);
  });

  it("reports a shop order by product ids, total in lira, under its number", () => {
    const spec = orderConversion({
      orderNo: 10234,
      totalMinor: 78900,
      items: [
        {
          productId: "prd-0001",
          productName: "Espresso 250g",
          qty: 2,
          unitPriceMinor: 32000,
        },
        // A line without a catalogue product has no id to report.
        { productName: "Elle girilen satır", qty: 1, unitPriceMinor: 5000 },
      ],
    });
    expect(spec.eventId).toBe("purchase_10234");
    expect(spec.events).toEqual(["Purchase"]);
    expect(spec.params).toMatchObject({
      content_ids: ["prd-0001"],
      content_type: "product",
      currency: "TRY",
      value: 789,
      num_items: 2,
      contents: [{ id: "prd-0001", quantity: 2, item_price: 320 }],
    });
    // The names stay out of a basket's parameters.
    expect(spec.params.content_name).toBeUndefined();
  });

  it("builds a basket's value from its lines", () => {
    const params = shopParams([
      { id: "prd-1", name: "Çekirdek", quantity: 2, price: 129.9 },
      { id: "prd-2", quantity: 1, price: 50 },
    ]);
    expect(params.value).toBe(309.8);
    expect(params.num_items).toBe(3);
    expect(params.content_ids).toEqual(["prd-1", "prd-2"]);
    expect(params.content_name).toBeUndefined();
    expect(
      shopParams([{ id: "prd-1", name: "Çekirdek", quantity: 1, price: 10 }])
        .content_name,
    ).toBe("Çekirdek");
  });
});

// ─── The browser side, against a scripted window ──────────────────────────

interface Browser {
  win: Record<string, unknown> & {
    fbq?: ((...args: unknown[]) => void) & { queue: unknown[][] };
    location: {
      hostname: string;
      pathname: string;
      assign: ReturnType<typeof vi.fn>;
    };
  };
  scripts: Array<{ src: string }>;
  cookieWrites: string[];
  jar: Map<string, string>;
  storage: Map<string, string>;
}

function consentCookie(marketing: boolean, version = CONSENT_VERSION): string {
  return encodeURIComponent(
    JSON.stringify({
      version,
      decidedAt: "2026-10-25T10:00:00.000Z",
      preferences: false,
      analytics: false,
      marketing,
    }),
  );
}

/** A window and a document just rich enough for the pixel module. */
function browser(
  opts: {
    host?: string;
    path?: string;
    marketing?: boolean | null;
    version?: number;
    cookies?: Record<string, string>;
    storageBlocked?: boolean;
  } = {},
): Browser {
  const jar = new Map<string, string>(Object.entries(opts.cookies ?? {}));
  if (opts.marketing !== null && opts.marketing !== undefined) {
    jar.set(CONSENT_COOKIE, consentCookie(opts.marketing, opts.version));
  }
  const scripts: Array<{ src: string }> = [];
  const cookieWrites: string[] = [];
  const storage = new Map<string, string>();
  const doc = {
    get cookie() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(raw: string) {
      cookieWrites.push(raw);
      const [pair, ...attrs] = raw.split(";").map((p) => p.trim());
      const [name, ...value] = pair.split("=");
      if (attrs.some((a) => /^max-age=0$/i.test(a))) jar.delete(name);
      else jar.set(name, value.join("="));
    },
    createElement: () => ({ src: "", async: false }),
    getElementsByTagName: () => [
      {
        parentNode: { insertBefore: (el: { src: string }) => scripts.push(el) },
      },
    ],
    head: { appendChild: (el: { src: string }) => scripts.push(el) },
  };
  const win = {
    location: {
      hostname: opts.host ?? "laffogato.net",
      pathname: opts.path ?? "/",
      assign: vi.fn(),
    },
    localStorage: opts.storageBlocked
      ? {
          getItem: () => {
            throw new Error("blocked");
          },
          setItem: () => {
            throw new Error("blocked");
          },
        }
      : {
          getItem: (k: string) => storage.get(k) ?? null,
          setItem: (k: string, v: string) => void storage.set(k, v),
        },
    setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
  } as unknown as Browser["win"];
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  return { win, scripts, cookieWrites, jar, storage };
}

/** The pixel module with a clean state, as one document's load has it. */
async function pixel() {
  vi.resetModules();
  return await import("@/lib/consent/meta-pixel");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  delete process.env.NEXT_PUBLIC_META_PIXEL_HOSTS;
});

describe("nothing leaves the browser before a yes", () => {
  it("does not load the script or call fbq without a recorded choice", async () => {
    const b = browser({ marketing: null });
    const { trackPixel, grantMetaPixel } = await pixel();
    expect(trackPixel("PageView")).toBe(false);
    expect(trackPixel("ViewContent", karaokeParams(150000, 1))).toBe(false);
    expect(grantMetaPixel()).toBe(false);
    expect(b.scripts).toHaveLength(0);
    expect(b.win.fbq).toBeUndefined();
  });

  it("does not load it for a visitor who refused marketing", async () => {
    const b = browser({ marketing: false });
    const { trackPixel } = await pixel();
    expect(trackPixel("PageView")).toBe(false);
    expect(b.scripts).toHaveLength(0);
    expect(b.win.fbq).toBeUndefined();
  });

  it("does not read a yes recorded under another version of the panel", async () => {
    const b = browser({ marketing: true, version: CONSENT_VERSION - 1 });
    const { trackPixel } = await pixel();
    expect(trackPixel("PageView")).toBe(false);
    expect(b.scripts).toHaveLength(0);
  });

  it("stays shut on a preview, on localhost, on the card page and in the panel", async () => {
    for (const [host, path] of [
      ["laffogato-git-x.vercel.app", "/"],
      ["localhost", "/"],
      ["laffogato.net", "/odeme"],
      ["laffogato.net", "/admin/siparisler"],
    ] as const) {
      const b = browser({ marketing: true, host, path });
      const { trackPixel } = await pixel();
      expect(trackPixel("PageView"), `${host}${path}`).toBe(false);
      expect(b.scripts, `${host}${path}`).toHaveLength(0);
      expect(b.win.fbq, `${host}${path}`).toBeUndefined();
    }
  });

  it("stays shut when the pixel is switched off by an empty id", async () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "";
    const b = browser({ marketing: true });
    const { trackPixel } = await pixel();
    expect(trackPixel("PageView")).toBe(false);
    expect(b.scripts).toHaveLength(0);
  });

  it("judges the card page by where the document was loaded, not where it is now", async () => {
    const b = browser({ marketing: true, path: "/odeme" });
    const { trackPixel } = await pixel();
    expect(trackPixel("PageView")).toBe(false);
    // A client-side move to a result page does not make the document one that
    // may run the pixel: the card page's policy goes with it.
    b.win.location.pathname = "/odeme/basarili";
    expect(trackPixel("PageView")).toBe(false);
    expect(b.scripts).toHaveLength(0);
  });
});

describe("after a yes", () => {
  it("loads fbevents.js, sets autoConfig off before init, and sends no PageView of its own", async () => {
    const b = browser({ marketing: true });
    const { trackPixel } = await pixel();
    expect(trackPixel("ViewContent", karaokeParams(150000, 1), "view_1")).toBe(
      true,
    );
    expect(b.scripts.map((s) => s.src)).toEqual([
      "https://connect.facebook.net/en_US/fbevents.js",
    ]);
    const queue = b.win.fbq!.queue;
    expect(queue.map((q) => q.slice(0, 2))).toEqual([
      ["set", "autoConfig"],
      ["init", META_PIXEL_DEFAULT_ID],
      ["track", "ViewContent"],
    ]);
    expect(queue[0]).toEqual([
      "set",
      "autoConfig",
      false,
      META_PIXEL_DEFAULT_ID,
    ]);
    expect(queue.some((q) => q[1] === "PageView")).toBe(false);
    expect(queue[2][2]).toMatchObject({ value: 1500, currency: "TRY" });
    expect(queue[2][3]).toEqual({ eventID: "view_1" });
  });

  it("loads once and initialises once, however many events follow", async () => {
    const b = browser({ marketing: true });
    const { trackPixel } = await pixel();
    trackPixel("PageView");
    trackPixel("AddToCart", karaokeParams(150000, 1));
    trackPixel("Contact");
    expect(b.scripts).toHaveLength(1);
    expect(b.win.fbq!.queue.filter((q) => q[0] === "init")).toHaveLength(1);
    expect(b.win.fbq!.queue.filter((q) => q[0] === "track")).toHaveLength(3);
  });

  it("works on the result pages under /odeme", async () => {
    browser({ marketing: true, path: "/odeme/basarili" });
    const { trackPixel } = await pixel();
    expect(trackPixel("Purchase", karaokeParams(150000, 1), "purchase_x")).toBe(
      true,
    );
  });

  it("sends no personal data even when a caller tries", async () => {
    const b = browser({ marketing: true });
    const { trackPixel } = await pixel();
    trackPixel("Purchase", {
      ...karaokeParams(150000, 1),
      ...({ em: "ada@example.com", ph: "5364290919", fn: "Ada" } as object),
    });
    const sent = b.win.fbq!.queue.find((q) => q[0] === "track")![2] as object;
    expect(Object.keys(sent).sort()).toEqual([
      "content_ids",
      "content_name",
      "content_type",
      "currency",
      "num_items",
      "value",
    ]);
  });
});

describe("a yes given after the page opened (25 Ekim 2026, live check)", () => {
  // Most visitors from an ad land on /karaoke and answer the banner after the
  // page has opened. The page's ViewContent is held in memory for that yes.
  it("holds the page's ViewContent and sends it after the PageView once the visitor says yes", async () => {
    const b = browser({ marketing: null, path: "/karaoke" });
    const { trackPixelForPage, trackPixel, sendHeldPageEvents } = await pixel();
    expect(trackPixelForPage("ViewContent", karaokeParams(100000, 1))).toBe(
      false,
    );
    // Nothing leaves the browser while it is held.
    expect(b.scripts).toHaveLength(0);
    expect(b.win.fbq).toBeUndefined();

    b.jar.set(CONSENT_COOKIE, consentCookie(true));
    expect(trackPixel("PageView")).toBe(true);
    expect(sendHeldPageEvents()).toBe(1);
    const tracked = b.win.fbq!.queue.filter((q) => q[0] === "track");
    expect(tracked.map((q) => q[1])).toEqual(["PageView", "ViewContent"]);
    expect(tracked[1][2]).toMatchObject({ value: 1000, num_items: 1 });
    // Sent once: a second yes (the panel saved again) sends nothing more.
    expect(sendHeldPageEvents()).toBe(0);
  });

  it("holds it for a visitor who refused, in case they say yes on this page", async () => {
    const b = browser({ marketing: false, path: "/magaza/urun/x" });
    const { trackPixelForPage, sendHeldPageEvents } = await pixel();
    expect(trackPixelForPage("ViewContent", shopParams([]))).toBe(false);
    b.jar.set(CONSENT_COOKIE, consentCookie(true));
    expect(sendHeldPageEvents()).toBe(1);
  });

  it("drops what was held for a page the visitor has left", async () => {
    const b = browser({ marketing: null, path: "/karaoke" });
    const { trackPixelForPage, sendHeldPageEvents } = await pixel();
    trackPixelForPage("ViewContent", karaokeParams(100000, 1));
    b.win.location.pathname = "/magaza";
    b.jar.set(CONSENT_COOKIE, consentCookie(true));
    expect(sendHeldPageEvents()).toBe(0);
    expect(b.win.fbq).toBeUndefined();
  });

  it("holds nothing where the pixel cannot run", async () => {
    const b = browser({ marketing: null, host: "localhost", path: "/karaoke" });
    const { trackPixelForPage, sendHeldPageEvents } = await pixel();
    expect(trackPixelForPage("ViewContent", karaokeParams(100000, 1))).toBe(
      false,
    );
    b.jar.set(CONSENT_COOKIE, consentCookie(true));
    expect(sendHeldPageEvents()).toBe(0);
    expect(b.scripts).toHaveLength(0);
  });

  it("sends at once, and holds nothing, for a visitor who already said yes", async () => {
    const b = browser({ marketing: true, path: "/karaoke" });
    const { trackPixelForPage, sendHeldPageEvents } = await pixel();
    expect(trackPixelForPage("ViewContent", karaokeParams(100000, 1))).toBe(
      true,
    );
    expect(sendHeldPageEvents()).toBe(0);
    expect(b.win.fbq!.queue.filter((q) => q[1] === "ViewContent")).toHaveLength(
      1,
    );
  });
});

describe("withdrawing the yes", () => {
  it("revokes consent, deletes _fbp and _fbc on every parent domain, and stops sending", async () => {
    const b = browser({
      marketing: true,
      host: "www.laffogato.net",
      cookies: { _fbp: "fb.1.123.456", _fbc: "fb.1.123.abc", sepet: "x" },
    });
    const { trackPixel, revokeMetaPixel } = await pixel();
    expect(trackPixel("PageView")).toBe(true);

    // The visitor withdraws: the banner records marketing=false and tells us.
    b.jar.set(CONSENT_COOKIE, consentCookie(false));
    revokeMetaPixel();

    expect(
      b.win.fbq!.queue.some((q) => q[0] === "consent" && q[1] === "revoke"),
    ).toBe(true);
    expect(b.jar.has("_fbp")).toBe(false);
    expect(b.jar.has("_fbc")).toBe(false);
    // Other cookies are left alone.
    expect(b.jar.get("sepet")).toBe("x");
    // Set on the registrable domain by Meta, so it is removed there too.
    expect(
      b.cookieWrites.some((w) => /^_fbp=;.*domain=laffogato\.net$/.test(w)),
    ).toBe(true);
    expect(
      b.cookieWrites.some((w) =>
        /^_fbc=;.*domain=www\.laffogato\.net$/.test(w),
      ),
    ).toBe(true);

    const before = b.win.fbq!.queue.length;
    expect(trackPixel("Contact")).toBe(false);
    expect(b.win.fbq!.queue).toHaveLength(before);
  });

  it("deletes the cookies even when the pixel was never loaded", async () => {
    const b = browser({
      marketing: false,
      cookies: { _fbp: "fb.1.1.1" },
    });
    const { revokeMetaPixel } = await pixel();
    revokeMetaPixel();
    expect(b.jar.has("_fbp")).toBe(false);
    expect(b.win.fbq).toBeUndefined();
    expect(b.scripts).toHaveLength(0);
  });

  it("grants again when the visitor comes back to a yes", async () => {
    const b = browser({ marketing: true });
    const { trackPixel, revokeMetaPixel } = await pixel();
    trackPixel("PageView");
    b.jar.set(CONSENT_COOKIE, consentCookie(false));
    revokeMetaPixel();
    b.jar.set(CONSENT_COOKIE, consentCookie(true));
    expect(trackPixel("PageView")).toBe(true);
    const verbs = b.win
      .fbq!.queue.filter((q) => q[0] === "consent")
      .map((q) => q[1]);
    expect(verbs).toEqual(["revoke", "grant"]);
    expect(b.scripts).toHaveLength(1);
  });
});

describe("a conversion is counted once", () => {
  it("fires on the first visit and not again after a refresh", async () => {
    const b = browser({ marketing: true });
    const { fireOnce, trackPixel } = await pixel();
    const send = () =>
      trackPixel("Purchase", karaokeParams(150000, 1), "purchase_krk-1");
    expect(fireOnce("laffogato_meta_purchase_krk-1", send)).toBe(true);
    expect(fireOnce("laffogato_meta_purchase_krk-1", send)).toBe(false);
    expect(b.storage.has("laffogato_meta_purchase_krk-1")).toBe(true);
    // A refresh: a new document, the same localStorage.
    const reloaded = await pixel();
    expect(reloaded.fireOnce("laffogato_meta_purchase_krk-1", send)).toBe(
      false,
    );
    expect(b.win.fbq!.queue.filter((q) => q[1] === "Purchase")).toHaveLength(1);
  });

  it("does not mark a conversion the pixel did not take", async () => {
    const b = browser({ marketing: false });
    const { fireOnce, trackPixel } = await pixel();
    expect(
      fireOnce("laffogato_meta_purchase_krk-9", () => trackPixel("Purchase")),
    ).toBe(false);
    expect(b.storage.has("laffogato_meta_purchase_krk-9")).toBe(false);
  });

  it("still counts once for the page when storage is blocked", async () => {
    browser({ marketing: true, storageBlocked: true });
    const { fireOnce, trackPixel } = await pixel();
    const send = () => trackPixel("Purchase");
    expect(fireOnce("k", send)).toBe(true);
    expect(fireOnce("k", send)).toBe(false);
  });
});

describe("leaving for the card page", () => {
  beforeEach(() => vi.useFakeTimers());

  it("gives a sent event a moment to leave before the page does", async () => {
    const b = browser({ marketing: true });
    const { navigateAfterPixel } = await pixel();
    navigateAfterPixel("https://pos.example/odeme", true);
    expect(b.win.location.assign).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(b.win.location.assign).toHaveBeenCalledWith(
      "https://pos.example/odeme",
    );
  });

  it("goes at once when nothing was sent", async () => {
    const b = browser({ marketing: false });
    const { navigateAfterPixel } = await pixel();
    navigateAfterPixel("https://pos.example/odeme", false);
    expect(b.win.location.assign).toHaveBeenCalledWith(
      "https://pos.example/odeme",
    );
  });
});

describe("the consent decision reaches the pixel", () => {
  it("is broadcast on window even when the page has no gtag", () => {
    const events: CustomEvent[] = [];
    vi.stubGlobal("window", {
      dispatchEvent: (e: CustomEvent) => {
        events.push(e);
        return true;
      },
    });
    const choice = {
      version: CONSENT_VERSION,
      preferences: false,
      analytics: false,
      marketing: true,
    };
    pushConsentUpdate(choice);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(CONSENT_UPDATED_EVENT);
    expect(events[0].type).toBe("laffogato:consent-updated");
    expect(events[0].detail).toEqual(choice);
  });

  it("is broadcast after Consent Mode is updated when GTM is there", () => {
    const order: string[] = [];
    vi.stubGlobal("window", {
      gtag: (...args: unknown[]) => order.push(`gtag:${args[0]}:${args[1]}`),
      dataLayer: [],
      dispatchEvent: (e: CustomEvent) => {
        order.push(`event:${e.type}`);
        return true;
      },
    });
    pushConsentUpdate({
      version: CONSENT_VERSION,
      preferences: true,
      analytics: false,
      marketing: false,
    });
    expect(order).toEqual([
      "gtag:consent:update",
      "gtag:set:ads_data_redaction",
      "event:laffogato:consent-updated",
    ]);
  });
});

describe("the wiring", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const tracker = readFileSync(
    "src/components/laffogato/meta-pixel.tsx",
    "utf8",
  );

  it("the layout mounts the tracker only when there is a pixel id", () => {
    expect(layout).toContain(
      "const META_PIXEL_ID = metaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);",
    );
    expect(layout).toContain("{META_PIXEL_ID ? <MetaPixel /> : null}");
  });

  it("the tracker sends a PageView per route inside Suspense, and listens to the consent event", () => {
    expect(tracker).toContain("<Suspense fallback={null}>");
    expect(tracker).toContain("usePathname()");
    expect(tracker).toContain("useSearchParams()");
    expect(tracker).toContain('trackPixel("PageView")');
    expect(tracker).toContain("CONSENT_UPDATED_EVENT");
    expect(tracker).toContain("revokeMetaPixel()");
    expect(tracker).toContain('a[href^="tel:"]');
    expect(tracker).toContain('trackPixel("Contact")');
    // The page's view event held for a late yes goes out after the PageView.
    expect(tracker.indexOf("sendHeldPageEvents();")).toBeGreaterThan(
      tracker.indexOf('trackPixel("PageView")) {'),
    );
    for (const file of [
      "src/components/laffogato/karaoke-booking.tsx",
      "src/components/laffogato/product-detail.tsx",
    ]) {
      expect(readFileSync(file, "utf8"), file).toMatch(
        /trackPixelForPage\(\s*"ViewContent"/,
      );
    }
  });

  it("the loader never injects a script outside trackPixel's checks", () => {
    const src = readFileSync("src/lib/consent/meta-pixel.ts", "utf8");
    expect(src.match(/installStub\(/g)).toHaveLength(2); // definition + one call
    expect(src).toContain('fbq("set", "autoConfig", false, PIXEL_ID);');
    // autoConfig is set before init, and the loader sends no PageView itself:
    // the route tracker sends exactly one per route.
    expect(src.indexOf('fbq("init", PIXEL_ID);')).toBeGreaterThan(
      src.indexOf('fbq("set", "autoConfig", false, PIXEL_ID);'),
    );
    expect(src).not.toMatch(/fbq\(\s*"track",\s*"PageView"/);
  });
});

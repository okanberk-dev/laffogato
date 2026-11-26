import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import { neonUsageView } from "@/lib/admin/neon-usage-core";
import {
  compressImage,
  dataImageBytes,
  imageObjectKey,
  imageStoreConfigFrom,
  isStoredImageUrl,
  normalizePublicBaseUrl,
  putImageObject,
  signImageRequest,
  type ImageStoreConfig,
} from "@/lib/images/store-core.mjs";
import { refusesNewDataImages } from "@/lib/images/store";

const ENV = {
  IMAGES_S3_ENDPOINT: "https://acc123.r2.cloudflarestorage.com",
  IMAGES_S3_BUCKET: "laffogato-foto",
  IMAGES_S3_ACCESS_KEY_ID: "AKIDEXAMPLE",
  IMAGES_S3_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  IMAGES_PUBLIC_BASE_URL: "https://pub-abc.r2.dev/",
};

function config(): ImageStoreConfig {
  const c = imageStoreConfigFrom(ENV);
  if (!c) throw new Error("config");
  return c;
}

describe("configuration", () => {
  it("needs all five variables", () => {
    expect(config().publicBaseUrl).toBe("https://pub-abc.r2.dev");
    expect(config().region).toBe("auto");
    for (const name of Object.keys(ENV)) {
      expect(imageStoreConfigFrom({ ...ENV, [name]: "" })).toBeNull();
    }
  });

  it("refuses a non-https endpoint or base URL", () => {
    expect(
      imageStoreConfigFrom({ ...ENV, IMAGES_S3_ENDPOINT: "http://x.example" }),
    ).toBeNull();
    expect(normalizePublicBaseUrl("http://pub.r2.dev")).toBeNull();
    expect(normalizePublicBaseUrl("https://img.example.com/a/?q=1")).toBeNull();
  });
});

describe("keys and URLs", () => {
  it("names an object by the first 16 hex of its SHA-256", () => {
    expect(imageObjectKey(Buffer.from("hello"), "webp")).toBe(
      "img/2cf24dba5fb0a30e.webp",
    );
  });

  it("knows its own URLs only", () => {
    const base = "https://pub-abc.r2.dev";
    expect(isStoredImageUrl(`${base}/img/2cf24dba5fb0a30e.webp`, base)).toBe(
      true,
    );
    expect(isStoredImageUrl(`${base}/img/../x.webp`, base)).toBe(false);
    expect(
      isStoredImageUrl("https://evil.example/img/2cf24dba5fb0a30e.webp", base),
    ).toBe(false);
    expect(isStoredImageUrl(`${base}/img/2cf24dba5fb0a30e.webp`, null)).toBe(
      false,
    );
  });

  it("decodes only the formats the panel stored", () => {
    expect(dataImageBytes("data:image/png;base64,aGVsbG8=")?.toString()).toBe(
      "hello",
    );
    expect(dataImageBytes("data:image/svg+xml;base64,PHN2Zy8+")).toBeNull();
    expect(dataImageBytes("https://x/y.png")).toBeNull();
  });
});

describe("compressImage", () => {
  it("applies EXIF orientation, fits in 1600 px, WebP without metadata", async () => {
    const raw = Buffer.alloc(2000 * 1500 * 3, 120);
    const jpg = await sharp(raw, {
      raw: { width: 2000, height: 1500, channels: 3 },
    })
      .jpeg({ quality: 95 })
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const out = await compressImage(sharp, jpg);
    expect(out.contentType).toBe("image/webp");
    expect([out.width, out.height]).toEqual([1200, 1600]);
    const meta = await sharp(out.body).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it("never enlarges, and keeps a cutout's transparency", async () => {
    const png = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
    const out = await compressImage(sharp, png);
    expect([out.width, out.height]).toEqual([300, 200]);
    expect((await sharp(out.body).metadata()).hasAlpha).toBe(true);
  });

  it("refuses bytes that are not an image", async () => {
    await expect(compressImage(sharp, Buffer.from("nope"))).rejects.toThrow();
  });
});

describe("signing", () => {
  it("matches botocore's S3SigV4Auth for the same PUT", () => {
    // Reference: botocore 1.44 S3SigV4Auth, region "auto", same inputs.
    const signed = signImageRequest(config(), {
      method: "PUT",
      key: "img/0123456789abcdef.webp",
      body: Buffer.from("hello world"),
      headers: {
        "content-type": "image/webp",
        "cache-control": "public, max-age=31536000, immutable",
      },
      now: new Date("2026-11-26T12:00:00Z"),
    });
    expect(signed.url).toBe(
      "https://acc123.r2.cloudflarestorage.com/laffogato-foto/img/0123456789abcdef.webp",
    );
    expect(signed.headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20261126/auto/s3/aws4_request, SignedHeaders=cache-control;content-type;host;x-amz-content-sha256;x-amz-date, Signature=f6a17f77a42e6d7573f037ecd179fe3725cc7ce72fb743ab82fba7626e8ca962",
    );
  });
});

describe("putImageObject", () => {
  const image = {
    body: Buffer.from("x"),
    contentType: "image/webp",
    ext: "webp",
  };

  it("uploads once: an existing key is not sent again", async () => {
    const calls: string[] = [];
    const fake = (async (_url: string, init: RequestInit) => {
      calls.push(init.method ?? "GET");
      return new Response(null, { status: init.method === "HEAD" ? 200 : 500 });
    }) as typeof fetch;
    const out = await putImageObject(config(), image, fake);
    expect(out.uploaded).toBe(false);
    expect(calls).toEqual(["HEAD"]);
    expect(out.url).toMatch(
      /^https:\/\/pub-abc\.r2\.dev\/img\/[0-9a-f]{16}\.webp$/,
    );
  });

  it("PUTs a missing key with the immutable cache header", async () => {
    const seen: Record<string, string>[] = [];
    const fake = (async (_url: string, init: RequestInit) => {
      seen.push(init.headers as Record<string, string>);
      return new Response(null, { status: init.method === "HEAD" ? 404 : 200 });
    }) as typeof fetch;
    const out = await putImageObject(config(), image, fake);
    expect(out.uploaded).toBe(true);
    expect(seen[1]["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(seen[1]["content-type"]).toBe("image/webp");
  });

  it("a refused key is an error, not 'missing'", async () => {
    const fake = (async () =>
      new Response(null, { status: 403 })) as typeof fetch;
    await expect(putImageObject(config(), image, fake)).rejects.toThrow("403");
  });
});

describe("refusesNewDataImages", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("lets data URLs through while there is no store", () => {
    for (const k of Object.keys(ENV)) delete process.env[k];
    expect(refusesNewDataImages(["data:image/png;base64,AAAA"], [])).toBe(
      false,
    );
  });

  it("refuses a new one, keeps one the row already holds", () => {
    Object.assign(process.env, ENV);
    const old = "data:image/jpeg;base64,OLD";
    expect(refusesNewDataImages(["data:image/png;base64,NEW"], [old])).toBe(
      true,
    );
    expect(
      refusesNewDataImages(
        [old, "https://pub-abc.r2.dev/img/2cf24dba5fb0a30e.webp"],
        [old],
      ),
    ).toBe(false);
    expect(refusesNewDataImages([""], [])).toBe(false);
  });
});

describe("Neon usage card without NEON_* variables", () => {
  it("is grey (off, neutral)", () => {
    const view = neonUsageView({ kind: "off" }, null, new Date());
    expect(view.state).toBe("off");
    expect(view.tone).toBe("neutral");
  });
});

describe("/gorsel/** for a moved photo", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("redirects to the store's URL; a foreign link stays 404", async () => {
    Object.assign(process.env, ENV);
    const { imageResponse } = await import("@/lib/admin/image-response");
    const own = "https://pub-abc.r2.dev/img/2cf24dba5fb0a30e.webp";
    const res = imageResponse(
      new Request("https://laffogato.net/gorsel/menu/mnu-0001"),
      own,
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(own);
    const other = imageResponse(
      new Request("https://laffogato.net/gorsel/menu/mnu-0001"),
      "https://evil.example/x.webp",
    );
    expect(other.status).toBe(404);
  });
});

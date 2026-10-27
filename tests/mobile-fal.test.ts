import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiError } from "@/lib/mobile/respond";
import {
  FAL_CONSENT_VERSION,
  FAL_IMAGE_MAX_BYTES,
  FAL_INSTRUCTIONS,
  decodeCupImage,
  falAiEnabled,
  falContextLine,
  falModel,
  falRequestBody,
  parseFalReply,
  responseText,
  visitsWord,
} from "@/lib/mobile/fal-core";

// The standard contract's record as if it had been filed: the strongest
// case for the switch. Since 27 Oct 2026 the reading stays off even then
// (tests/mobile-fal-retired.test.ts); with the shipped, empty record nothing
// was ever sent (tests/mobile-fal-safeguard.test.ts).
vi.mock("@/lib/mobile/fal-safeguard", () => ({
  FAL_TRANSFER_SAFEGUARD: { signedOn: "2026-10-01", notifiedOn: "2026-10-02", receipt: "TEST-RECEIPT" },
}));

/**
 * Karar 177 - fA'L read by AI, retired on 27 Oct 2026 (App Review 4.3(b),
 * lafmobil karar 330). The switch is off whatever the environment says, and
 * POST /fal answers 503 to every signed-in caller. The pure rules the
 * retired code kept (no identity in what the model was told, no promise in
 * what it answered) stay tested while the code stays.
 */

const READING = {
  cupSeen: true,
  drink: "Americano",
  symbol: "Köpükte bir kuş kanat açmış.",
  trait: "Sen yeni başlangıçlara cesaretle yürüyensin.",
  forecast: "Bu hafta güzel bir sohbet seni bulacak.",
};

/** A tiny but real JPEG header, base64. */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString("base64");

describe("fal-core: always off", () => {
  it("is off with the switch, either key and a filed contract record", () => {
    for (const env of [
      {},
      { FAL_AI_ENABLED: "true", FAL_AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "test-key" },
      { FAL_AI_ENABLED: "true", FAL_AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" },
      { FAL_AI_ENABLED: "TRUE", ANTHROPIC_API_KEY: "test-key", OPENAI_API_KEY: "sk-test" },
    ]) {
      vi.unstubAllEnvs();
      for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
      expect(falAiEnabled(), JSON.stringify(env)).toBe(false);
    }
    vi.unstubAllEnvs();
  });

  it("reads with the configured model, Claude Opus by default", () => {
    expect(falModel({ ANTHROPIC_API_KEY: "test-key" })).toBe("claude-opus-5-5");
    expect(falModel({ ANTHROPIC_API_KEY: "test-key", ANTHROPIC_FAL_MODEL: "claude-sonnet-5-5" })).toBe("claude-sonnet-5-5");
    // The OpenAI path keeps its own default and switch.
    expect(falModel({})).toBe("gpt-5.4-mini");
    expect(falModel({ OPENAI_FAL_MODEL: "gpt-5.6-luna" })).toBe("gpt-5.6-luna");
  });
});

describe("fal-core: what the model is told", () => {
  it("describes the member by tier, frequency and usual - never by name", () => {
    const line = falContextLine({ tier: "PEARL", visits: "regular", usual: "Americano" });
    expect(line).toContain("PEARL");
    expect(line).toContain("düzenli");
    expect(line).toContain("Americano");
    expect(line).not.toMatch(/@|\+90|cst-/i);
  });

  it("turns paid orders into a kind word", () => {
    expect(visitsWord(0)).toBe("new");
    expect(visitsWord(4)).toBe("regular");
    expect(visitsWord(24)).toBe("loyal");
  });

  it("forbids promises, people and sensitive forecasts in the standing instructions", () => {
    for (const rule of ["kişileri", "Sağlık", "İndirim", "ücretsiz", "puan", "eğlence"]) {
      expect(FAL_INSTRUCTIONS).toContain(rule);
    }
  });

  it("asks strictly for the schema, at low detail, and keeps nothing", () => {
    const body = falRequestBody("gpt-5.4-mini", { tier: "L'AF", visits: "new", usual: "" }, JPEG);
    expect(body.store).toBe(false);
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true });
    const image = body.input[0]!.content[1] as { type: string; image_url: string; detail: string };
    expect(image).toMatchObject({ type: "input_image", detail: "low" });
    expect(image.image_url.startsWith("data:image/jpeg;base64,")).toBe(true);
  });
});

describe("fal-core: what may be shown", () => {
  it("passes a kind reading, tidying its dashes and spaces", () => {
    expect(parseFalReply(READING)).toEqual(READING);
    expect(parseFalReply({ ...READING, trait: "Sen  cesursun \u2014 ve naziksin." })?.trait).toBe("Sen cesursun - ve naziksin.");
  });

  it("refuses a reading that promises something the house must honour", () => {
    for (const promise of ["Yarın ücretsiz bir kahve seni bekliyor.", "Sana bir indirim geliyor.", "İki puan daha!", "Bir HEDİYE var."]) {
      expect(parseFalReply({ ...READING, forecast: promise }), promise).toBeNull();
    }
    // A polka-dot foam is a fair thing to see.
    expect(parseFalReply({ ...READING, symbol: "Köpükte puantiyeli bir desen var." })).not.toBeNull();
  });

  it("refuses the wrong shape, an empty part, or an essay", () => {
    expect(parseFalReply(null)).toBeNull();
    expect(parseFalReply({ ...READING, cupSeen: "yes" })).toBeNull();
    expect(parseFalReply({ ...READING, symbol: "" })).toBeNull();
    expect(parseFalReply({ ...READING, forecast: "a".repeat(400) })).toBeNull();
  });

  it("finds the text in a Responses API reply", () => {
    const body = { output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: "{}" }] }] };
    expect(responseText(body)).toBe("{}");
    expect(responseText({ output: [] })).toBeNull();
  });

  it("takes a JPEG of a sane size and nothing else", () => {
    expect(decodeCupImage(JPEG)).not.toBeNull();
    expect(decodeCupImage(`data:image/jpeg;base64,${JPEG}`)).not.toBeNull();
    expect(decodeCupImage(Buffer.from("PNG....").toString("base64"))).toBeNull();
    expect(decodeCupImage("not base64 at all!")).toBeNull();
    const huge = Buffer.alloc(FAL_IMAGE_MAX_BYTES + 1, 0);
    huge[0] = 0xff;
    huge[1] = 0xd8;
    expect(decodeCupImage(huge.toString("base64"))).toBeNull();
  });
});

// ─── The endpoints ───────────────────────────────────────────────────────

const requireMobileCustomer = vi.fn();
const lib = {
  hasFalConsent: vi.fn(),
  grantFalConsent: vi.fn(),
  revokeFalConsent: vi.fn(),
  falReadingsToday: vi.fn(),
  reserveFalReading: vi.fn(),
  releaseFalReading: vi.fn(),
  completeFalReading: vi.fn(),
  buildFalContext: vi.fn(),
  readCupWithAI: vi.fn(),
};
vi.mock("@/lib/mobile/auth", () => ({ requireMobileCustomer }));
vi.mock("@/lib/mobile/fal", () => lib);

const { POST, maxDuration } = await import("@/app/api/mobile/v1/fal/route");
const consent = await import("@/app/api/mobile/v1/fal/consent/route");

function req(body: unknown, method = "POST") {
  return new Request("https://laffogato.net/api/mobile/v1/fal", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("POST /fal", () => {
  beforeEach(() => {
    // Everything the environment could ever do, and a member who has it all:
    // verified, consented, a free quota. None of it opens the route now.
    vi.stubEnv("FAL_AI_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("FAL_AI_ENABLED", "true");
    requireMobileCustomer.mockResolvedValue({ ok: true, customer: { email: "eda@ornek.com", emailVerified: true } });
    for (const fn of Object.values(lib)) fn.mockReset();
    lib.hasFalConsent.mockResolvedValue(true);
    lib.falReadingsToday.mockResolvedValue(0);
    lib.reserveFalReading.mockResolvedValue({ ok: true, id: 7, used: 0 });
    lib.buildFalContext.mockResolvedValue({ tier: "L'AF", visits: "new", usual: "" });
    lib.readCupWithAI.mockResolvedValue({ ok: true, reading: READING, model: "claude-opus-5-5" });
  });

  it("refuses a caller without a bearer first (401, as §20 orders it)", async () => {
    requireMobileCustomer.mockResolvedValue({ ok: false, response: apiError(401, "unauthorized", "Giriş yapman gerekiyor.") });
    expect((await POST(req({ image: JPEG }))).status).toBe(401);
    expect(lib.readCupWithAI).not.toHaveBeenCalled();
  });

  it("is 503 fal_unavailable for a verified, consenting member with a readable photo", async () => {
    const res = await POST(req({ image: JPEG }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("fal_unavailable");
    expect(body.message).not.toMatch(/[\u2013\u2014]/);
    // Nothing behind the answer: no consent, quota, seat, context or model.
    for (const [name, fn] of Object.entries(lib)) expect(fn, name).not.toHaveBeenCalled();
  });

  it("is the same 503 whatever the body or the member is: the body is never read", async () => {
    requireMobileCustomer.mockResolvedValue({ ok: true, customer: { email: "throwaway@ornek.com", emailVerified: false } });
    for (const body of [{ image: JPEG }, { image: "GIF89a" }, {}, "not json"]) {
      const res = await POST(req(body));
      expect(res.status, JSON.stringify(body)).toBe(503);
      expect((await res.json()).error).toBe("fal_unavailable");
    }
    for (const [name, fn] of Object.entries(lib)) expect(fn, name).not.toHaveBeenCalled();
  });

  it("keeps the 30 s the contract still names for this route", () => {
    // docs/API-MOBILE.md §0 lists POST /fal as its one 30 s exception.
    expect(maxDuration).toBe(30);
  });
});

describe("/fal/consent", () => {
  beforeEach(() => {
    // Switched on and keyed: GET says off all the same (27 Oct 2026).
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("FAL_AI_ENABLED", "true");
    requireMobileCustomer.mockResolvedValue({ ok: true, customer: { email: "eda@ornek.com", emailVerified: true } });
    for (const fn of Object.values(lib)) fn.mockReset();
    lib.hasFalConsent.mockResolvedValue(false);
  });

  it("says whether the reading is on, the text's version and the member's answer", async () => {
    const res = await consent.GET(req(undefined, "GET"));
    expect(await res.json()).toEqual({ enabled: false, version: FAL_CONSENT_VERSION, granted: false, doc: "acik-riza-metni" });
  });

  it("records no consent since R12 was retired (27 Oct 2026): every version is refused 409", async () => {
    // Veri Saklama: no new consent is taken; §20's own 409 says so.
    for (const version of ["2020-01-01", FAL_CONSENT_VERSION]) {
      const res = await consent.POST(req({ version }));
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe("consent_outdated");
    }
    expect(lib.grantFalConsent).not.toHaveBeenCalled();
  });

  it("refuses the 23 Eyl version, whose text named OpenAI: the new recipient is read first", async () => {
    expect(FAL_CONSENT_VERSION).toBe("2026-10-19-anthropic");
    const old = await consent.POST(req({ version: "2026-09-23" }));
    expect(old.status).toBe(409);
    expect((await old.json()).error).toBe("consent_outdated");
    // The same day's text naming another recipient is another version too.
    expect((await consent.POST(req({ version: "2026-10-19-openai" }))).status).toBe(409);
    // So is the 17 Eki text, which named Anthropic without its retention term.
    expect((await consent.POST(req({ version: "2026-10-17-anthropic" }))).status).toBe(409);
    expect(lib.grantFalConsent).not.toHaveBeenCalled();
  });

  it("withdraws it", async () => {
    const res = await consent.DELETE(req(undefined, "DELETE"));
    expect(await res.json()).toEqual({ granted: false });
    expect(lib.revokeFalConsent).toHaveBeenCalledWith("eda@ornek.com");
  });
});

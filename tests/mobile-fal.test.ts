import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiError } from "@/lib/mobile/respond";
import {
  FAL_CONSENT_VERSION,
  FAL_DAILY_LIMIT,
  FAL_IMAGE_MAX_BYTES,
  FAL_INSTRUCTIONS,
  FAL_TIMEOUT_MS,
  decodeCupImage,
  falAiEnabled,
  falContextLine,
  falModel,
  falRequestBody,
  parseFalReply,
  responseText,
  visitsWord,
} from "@/lib/mobile/fal-core";

// The standard contract's record as the enabling PR will fill it: these
// tests are about a reading that is switched on. With the shipped, empty
// record nothing is sent at all (tests/mobile-fal-safeguard.test.ts).
vi.mock("@/lib/mobile/fal-safeguard", () => ({
  FAL_TRANSFER_SAFEGUARD: { signedOn: "2026-10-01", notifiedOn: "2026-10-02", receipt: "TEST-RECEIPT" },
}));

/**
 * Karar 177 - fA'L read by AI. The rules that make it lawful are tested
 * here rather than trusted: off without the key AND the switch, no identity
 * in what the model is told, no promise in what it answers, and the order of
 * the endpoint's refusals.
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

describe("fal-core: on and off", () => {
  it("is off without the key, off with the key alone, on with both", () => {
    expect(falAiEnabled({})).toBe(false);
    expect(falAiEnabled({ ANTHROPIC_API_KEY: "test-key" })).toBe(false);
    expect(falAiEnabled({ FAL_AI_ENABLED: "true" })).toBe(false);
    expect(falAiEnabled({ ANTHROPIC_API_KEY: "test-key", FAL_AI_ENABLED: "true" })).toBe(true);
    expect(falAiEnabled({ ANTHROPIC_API_KEY: "  ", FAL_AI_ENABLED: "true" })).toBe(false);
  });

  it("stays off on OpenAI while the published texts name Anthropic as the recipient", () => {
    // 17 Eki 2026: the R12, aydınlatma and gizlilik texts name Anthropic,
    // PBC. Sending the photo to OpenAI would be a transfer the member was not
    // told about, so its key and the switch are not enough any more.
    expect(falAiEnabled({ OPENAI_API_KEY: "sk-test", FAL_AI_ENABLED: "true" })).toBe(false);
    expect(falAiEnabled({ OPENAI_API_KEY: "sk-test", FAL_AI_PROVIDER: "openai", FAL_AI_ENABLED: "true" })).toBe(false);
    expect(
      falAiEnabled({ ANTHROPIC_API_KEY: "test-key", OPENAI_API_KEY: "sk-test", FAL_AI_PROVIDER: "openai", FAL_AI_ENABLED: "true" }),
    ).toBe(false);
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
    // Every switch set here, so a key in the shell running the tests decides nothing.
    vi.stubEnv("FAL_AI_PROVIDER", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("FAL_AI_ENABLED", "true");
    requireMobileCustomer.mockResolvedValue({ ok: true, customer: { email: "eda@ornek.com", emailVerified: true } });
    for (const fn of Object.values(lib)) fn.mockReset();
    lib.hasFalConsent.mockResolvedValue(true);
    lib.falReadingsToday.mockResolvedValue(0);
    lib.reserveFalReading.mockResolvedValue({ ok: true, id: 7, used: 0 });
    // Promises, as the real ones are: the route chains .catch() on the release.
    lib.releaseFalReading.mockResolvedValue(undefined);
    lib.completeFalReading.mockResolvedValue(undefined);
    lib.buildFalContext.mockResolvedValue({ tier: "L'AF", visits: "new", usual: "" });
    lib.readCupWithAI.mockResolvedValue({ ok: true, reading: READING, model: "claude-opus-5-5" });
  });

  it("refuses a caller without a bearer", async () => {
    requireMobileCustomer.mockResolvedValue({ ok: false, response: apiError(401, "unauthorized", "Giriş yapman gerekiyor.") });
    expect((await POST(req({ image: JPEG }))).status).toBe(401);
    expect(lib.readCupWithAI).not.toHaveBeenCalled();
  });

  it("is 503 fal_unavailable while the key or the switch is missing", async () => {
    vi.stubEnv("FAL_AI_ENABLED", "");
    const res = await POST(req({ image: JPEG }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("fal_unavailable");
    expect(lib.readCupWithAI).not.toHaveBeenCalled();
  });

  it("is 503 fal_unavailable, before any consent or photo, for a provider the texts do not name", async () => {
    vi.stubEnv("FAL_AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const res = await POST(req({ image: JPEG }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("fal_unavailable");
    expect(lib.hasFalConsent).not.toHaveBeenCalled();
    expect(lib.reserveFalReading).not.toHaveBeenCalled();
    expect(lib.readCupWithAI).not.toHaveBeenCalled();
  });

  it("is 403 email_unverified for an unconfirmed sign-up, before any seat or model call", async () => {
    // A row exists for every Supabase sign-up, confirmed or not; without the
    // gate each throwaway address bought FAL_DAILY_LIMIT paid model calls.
    requireMobileCustomer.mockResolvedValue({ ok: true, customer: { email: "throwaway@ornek.com", emailVerified: false } });
    const res = await POST(req({ image: JPEG }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("email_unverified");
    expect(lib.reserveFalReading).not.toHaveBeenCalled();
    expect(lib.readCupWithAI).not.toHaveBeenCalled();
  });

  it("wants the member's consent before the photo goes anywhere", async () => {
    lib.hasFalConsent.mockResolvedValue(false);
    const res = await POST(req({ image: JPEG }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("consent_required");
    expect(lib.readCupWithAI).not.toHaveBeenCalled();
  });

  it(`stops at ${FAL_DAILY_LIMIT} readings a day`, async () => {
    lib.falReadingsToday.mockResolvedValue(FAL_DAILY_LIMIT);
    const res = await POST(req({ image: JPEG }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("fal_limit");
  });

  it("refuses what is not a JPEG", async () => {
    const res = await POST(req({ image: Buffer.from("GIF89a-----").toString("base64") }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_image");
  });

  it("reads the cup, records only the usage, and says how many are left", async () => {
    const res = await POST(req({ image: JPEG }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ reading: READING, ai: true, consentVersion: FAL_CONSENT_VERSION, remainingToday: FAL_DAILY_LIMIT - 1 });
    // Additive: which model wrote it, so "Bu yorumu bildir" can name it.
    expect(body.model).toBe("claude-opus-5-5");
    expect(lib.reserveFalReading).toHaveBeenCalledWith("eda@ornek.com", FAL_DAILY_LIMIT);
    expect(lib.completeFalReading).toHaveBeenCalledWith(7, true, "claude-opus-5-5");
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("is 502 fal_failed when the model fails or answers unfit, and records nothing", async () => {
    lib.readCupWithAI.mockResolvedValue({ ok: false, reason: "unfit" });
    const res = await POST(req({ image: JPEG }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("fal_failed");
    expect(lib.completeFalReading).not.toHaveBeenCalled();
    // The seat goes back: a failed reading does not spend the member's turn.
    expect(lib.releaseFalReading).toHaveBeenCalledWith(7);
  });

  it("is 429 fal_limit when a racing request took the last seat, and never asks the model", async () => {
    lib.falReadingsToday.mockResolvedValue(FAL_DAILY_LIMIT - 1);
    lib.reserveFalReading.mockResolvedValue({ ok: false });
    const res = await POST(req({ image: JPEG }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("fal_limit");
    expect(lib.readCupWithAI).not.toHaveBeenCalled();
  });

  it("gives the seat back when the model call throws", async () => {
    lib.readCupWithAI.mockRejectedValue(new Error("socket hang up"));
    const res = await POST(req({ image: JPEG }));
    expect(res.status).toBe(500);
    expect(lib.releaseFalReading).toHaveBeenCalledWith(7);
  });

  it("does not take a seat for a photo it cannot read", async () => {
    await POST(req({ image: Buffer.from("GIF89a-----").toString("base64") }));
    expect(lib.reserveFalReading).not.toHaveBeenCalled();
  });

  it("counts the remaining readings from the seat it took", async () => {
    lib.reserveFalReading.mockResolvedValue({ ok: true, id: 9, used: FAL_DAILY_LIMIT - 2 });
    const body = await (await POST(req({ image: JPEG }))).json();
    expect(body.remainingToday).toBe(1);
  });

  it("waits for the model no longer than the route may run, with room for the steps before it", () => {
    // maxDuration is 30 s and the app waits 30 s (docs/API-MOBILE.md §0);
    // sign-in, consent, quota, the seat and the member's context come first.
    expect(maxDuration).toBe(30);
    expect(FAL_TIMEOUT_MS + 5_000).toBeLessThanOrEqual(maxDuration * 1000);
  });
});

describe("/fal/consent", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("FAL_AI_ENABLED", "");
    requireMobileCustomer.mockResolvedValue({ ok: true, customer: { email: "eda@ornek.com", emailVerified: true } });
    for (const fn of Object.values(lib)) fn.mockReset();
    lib.hasFalConsent.mockResolvedValue(false);
  });

  it("says whether the reading is on, the text's version and the member's answer", async () => {
    const res = await consent.GET(req(undefined, "GET"));
    expect(await res.json()).toEqual({ enabled: false, version: FAL_CONSENT_VERSION, granted: false, doc: "acik-riza-metni" });
  });

  it("records a consent only to the text in force", async () => {
    const old = await consent.POST(req({ version: "2020-01-01" }));
    expect(old.status).toBe(409);
    expect(lib.grantFalConsent).not.toHaveBeenCalled();
    const ok = await consent.POST(req({ version: FAL_CONSENT_VERSION }));
    expect(ok.status).toBe(200);
    expect(lib.grantFalConsent).toHaveBeenCalledWith("eda@ornek.com");
  });

  it("refuses the 23 Eyl version, whose text named OpenAI: the new recipient is read first", async () => {
    expect(FAL_CONSENT_VERSION).toBe("2026-10-17-anthropic");
    const old = await consent.POST(req({ version: "2026-09-23" }));
    expect(old.status).toBe(409);
    expect((await old.json()).error).toBe("consent_outdated");
    // The same day's text naming another recipient is another version too.
    expect((await consent.POST(req({ version: "2026-10-17-openai" }))).status).toBe(409);
    expect(lib.grantFalConsent).not.toHaveBeenCalled();
  });

  it("withdraws it", async () => {
    const res = await consent.DELETE(req(undefined, "DELETE"));
    expect(await res.json()).toEqual({ granted: false });
    expect(lib.revokeFalConsent).toHaveBeenCalledWith("eda@ornek.com");
  });
});

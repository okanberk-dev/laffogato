import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANTHROPIC_MESSAGES_URL,
  ANTHROPIC_VERSION,
  FAL_ANTHROPIC_MAX_TOKENS,
  FAL_CONSENT_VERSION,
  FAL_DISCLOSED_PROVIDER,
  FAL_INSTRUCTIONS,
  FAL_PROVIDER_INFO,
  FAL_SCHEMA,
  FAL_TIMEOUT_MS,
  anthropicReplyText,
  anthropicRequestBody,
  falAiEnabled,
  falContextLine,
  falModel,
  falProvider,
  falRequestBody,
  parseFalReply,
  responseText,
  type FalContext,
  type FalProvider,
} from "@/lib/mobile/fal-core";
import type * as FalCore from "@/lib/mobile/fal-core";

/**
 * Karar 177, 17 Eki 2026: fA'L's AI reading runs on Anthropic's Claude API,
 * and the OpenAI path stays. Which provider reads is the environment's
 * choice; whether it may read at all is also the published texts' (the
 * recipient they name). The network is a mocked fetch throughout: no real
 * key, no real call.
 */

// fal.ts reads the database for consents and seats; nothing here needs it.
vi.mock("@/lib/db", () => ({
  getDb: () => {
    throw new Error("no database in this test");
  },
  TABLES: { falReadings: "fal_readings", featureConsents: "feature_consents", falReports: "fal_reports" },
}));

// The standard contract's record as the enabling PR will fill it: these
// tests are about a reading that is switched on. With the shipped, empty
// record nothing is sent at all (tests/mobile-fal-safeguard.test.ts).
vi.mock("@/lib/mobile/fal-safeguard", () => ({
  FAL_TRANSFER_SAFEGUARD: { signedOn: "2026-10-01", notifiedOn: "2026-10-02", receipt: "TEST-RECEIPT" },
}));

const { readCupWithAI } = await import("@/lib/mobile/fal");

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const ANTHROPIC_KEY = "test-anthropic-key-not-real";
const OPENAI_KEY = "test-openai-key-not-real";
/** A JPEG's first bytes and a distinctive tail, so a leak of it is easy to spot. */
const PHOTO = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("cup-photo-bytes-0123456789")]).toString("base64");
const CONTEXT: FalContext = { tier: "PEARL", visits: "regular", usual: "Pistachio Latte" };
const READING = {
  cupSeen: true,
  drink: "Latte",
  symbol: "Köpükte bir yelkenli var.",
  trait: "Sen rüzgârı arkana almayı bilensin.",
  forecast: "Bu hafta güzel bir haber seni bulacak.",
};

/** The environment of a provider that is switched on, with its key. */
function envFor(provider: FalProvider, extra: Record<string, string> = {}) {
  return {
    FAL_AI_ENABLED: "true",
    FAL_AI_PROVIDER: provider,
    [FAL_PROVIDER_INFO[provider].keyEnv]: provider === "anthropic" ? ANTHROPIC_KEY : OPENAI_KEY,
    ...extra,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A Messages API reply: thinking first (empty under the default display), then the JSON. */
function claudeReply(reading: unknown = READING, stop = "end_turn") {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text: JSON.stringify(reading) },
    ],
    stop_reason: stop,
    stop_details: null,
    usage: { input_tokens: 900, output_tokens: 120 },
  };
}

function openaiReply(reading: unknown = READING) {
  return { output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(reading) }] }] };
}

type Call = { url: string; init: RequestInit & { headers: Record<string, string> } };

function mockFetch(answer: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init as Call["init"] });
    return answer();
  });
  return { fetcher: fetcher as unknown as typeof fetch, calls };
}

function sentBody(call: Call) {
  return JSON.parse(String(call.init.body)) as Record<string, unknown>;
}

// ─── Which provider, and whether it may read ─────────────────────────────

describe("falProvider: the environment's choice", () => {
  it("is the one FAL_AI_PROVIDER names, in any case and spacing", () => {
    expect(falProvider({ FAL_AI_PROVIDER: "anthropic" })).toBe("anthropic");
    expect(falProvider({ FAL_AI_PROVIDER: " OpenAI " })).toBe("openai");
    // Named, it wins over whichever key happens to be there.
    expect(falProvider({ FAL_AI_PROVIDER: "openai", ANTHROPIC_API_KEY: ANTHROPIC_KEY })).toBe("openai");
    expect(falProvider({ FAL_AI_PROVIDER: "anthropic", OPENAI_API_KEY: OPENAI_KEY })).toBe("anthropic");
  });

  it("unset, is Anthropic when its key is there and OpenAI otherwise", () => {
    expect(falProvider({})).toBe("openai");
    expect(falProvider({ OPENAI_API_KEY: OPENAI_KEY })).toBe("openai");
    expect(falProvider({ ANTHROPIC_API_KEY: ANTHROPIC_KEY })).toBe("anthropic");
    expect(falProvider({ ANTHROPIC_API_KEY: ANTHROPIC_KEY, OPENAI_API_KEY: OPENAI_KEY })).toBe("anthropic");
    // Blank is unset (an empty Vercel value), and so is a blank key.
    expect(falProvider({ FAL_AI_PROVIDER: "  ", ANTHROPIC_API_KEY: ANTHROPIC_KEY })).toBe("anthropic");
    expect(falProvider({ ANTHROPIC_API_KEY: "   " })).toBe("openai");
  });

  it("is nobody for a value that names neither: a typo never picks a recipient", () => {
    for (const typo of ["gemini", "antropic", "open-ai", "claude"]) {
      expect(falProvider({ FAL_AI_PROVIDER: typo, ANTHROPIC_API_KEY: ANTHROPIC_KEY, OPENAI_API_KEY: OPENAI_KEY }), typo).toBeNull();
    }
  });
});

describe("falAiEnabled: the switch, the chosen provider's key, and a recipient the texts name", () => {
  const disclosed = FAL_DISCLOSED_PROVIDER;
  const other: FalProvider = disclosed === "anthropic" ? "openai" : "anthropic";

  it("is on with the switch and the disclosed provider's key", () => {
    expect(falAiEnabled(envFor(disclosed))).toBe(true);
    expect(falAiEnabled({ ...envFor(disclosed), FAL_AI_ENABLED: " TRUE " })).toBe(true);
  });

  it("is off without the switch, whatever keys there are", () => {
    for (const value of [undefined, "", "false", "1", "yes", "on"]) {
      expect(falAiEnabled({ ...envFor(disclosed), FAL_AI_ENABLED: value }), String(value)).toBe(false);
    }
  });

  it("is off when the chosen provider's own key is missing or blank", () => {
    // The other provider's key does not stand in for it.
    const otherKey = FAL_PROVIDER_INFO[other].keyEnv;
    expect(
      falAiEnabled({ FAL_AI_ENABLED: "true", FAL_AI_PROVIDER: disclosed, [otherKey]: "some-key" }),
    ).toBe(false);
    expect(falAiEnabled({ ...envFor(disclosed), [FAL_PROVIDER_INFO[disclosed].keyEnv]: "   " })).toBe(false);
  });

  it("is off for a provider the published texts do not name, even with its key and the switch", () => {
    expect(falAiEnabled(envFor(other))).toBe(false);
  });

  it("is off for a provider name it does not know", () => {
    expect(falAiEnabled({ ...envFor(disclosed), FAL_AI_PROVIDER: "gemini" })).toBe(false);
  });
});

describe("falModel: each provider's own switch, else its default", () => {
  it("reads Claude Opus by default and the model the operator names", () => {
    expect(falModel({}, "anthropic")).toBe("claude-opus-5-5");
    expect(falModel({ ANTHROPIC_FAL_MODEL: " claude-haiku-5-5 " }, "anthropic")).toBe("claude-haiku-5-5");
    expect(falModel({ ANTHROPIC_FAL_MODEL: "claude-sonnet-5-5" }, "anthropic")).toBe("claude-sonnet-5-5");
    // The other provider's switch is not read.
    expect(falModel({ OPENAI_FAL_MODEL: "gpt-5.6-luna" }, "anthropic")).toBe("claude-opus-5-5");
  });

  it("keeps OpenAI's default and switch", () => {
    expect(falModel({}, "openai")).toBe("gpt-5.4-mini");
    expect(falModel({ OPENAI_FAL_MODEL: "gpt-5.6-luna" }, "openai")).toBe("gpt-5.6-luna");
    expect(falModel({ ANTHROPIC_FAL_MODEL: "claude-haiku-5-5" }, "openai")).toBe("gpt-5.4-mini");
  });

  it("follows the chosen provider when none is passed", () => {
    expect(falModel({ ANTHROPIC_API_KEY: ANTHROPIC_KEY })).toBe("claude-opus-5-5");
    expect(falModel({ FAL_AI_PROVIDER: "openai" })).toBe("gpt-5.4-mini");
  });
});

// ─── What each provider is sent ──────────────────────────────────────────

describe("the Anthropic request", () => {
  it("goes to the Messages API with the key in x-api-key, the version and JSON, and nothing else", async () => {
    const { fetcher, calls } = mockFetch(() => json(claudeReply()));
    await readCupWithAI(PHOTO, CONTEXT, envFor("anthropic"), fetcher);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(ANTHROPIC_MESSAGES_URL);
    expect(calls[0]!.url).toBe("https://api.anthropic.com/v1/messages");
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.init.headers).toEqual({
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    });
    expect(ANTHROPIC_VERSION).toBe("2023-06-01");
    expect(calls[0]!.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends the same photo as a base64 JPEG block, the same persona and the member note", async () => {
    const { fetcher, calls } = mockFetch(() => json(claudeReply()));
    await readCupWithAI(PHOTO, CONTEXT, envFor("anthropic"), fetcher);
    const body = sentBody(calls[0]!);
    expect(body.system).toBe(FAL_INSTRUCTIONS);
    const messages = body.messages as { role: string; content: Record<string, unknown>[] }[];
    expect(messages).toHaveLength(1);
    expect(messages[0]!.role).toBe("user");
    expect(messages[0]!.content).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: PHOTO } },
      { type: "text", text: falContextLine(CONTEXT) },
    ]);
    // The very bytes the OpenAI path sends, without the data-URL wrapper.
    const openai = falRequestBody("gpt-5.4-mini", CONTEXT, PHOTO);
    const openaiImage = openai.input[0]!.content[1] as { image_url: string };
    expect(openaiImage.image_url).toBe(`data:image/jpeg;base64,${PHOTO}`);
  });

  it("holds the answer to the reply schema with structured outputs, not a forced tool call", async () => {
    const { fetcher, calls } = mockFetch(() => json(claudeReply()));
    await readCupWithAI(PHOTO, CONTEXT, envFor("anthropic"), fetcher);
    const body = sentBody(calls[0]!);
    expect(body.output_config).toEqual({
      effort: "low",
      format: { type: "json_schema", schema: JSON.parse(JSON.stringify(FAL_SCHEMA)) },
    });
    expect(FAL_SCHEMA.required).toEqual(["cupSeen", "drink", "symbol", "trait", "forecast"]);
    expect(FAL_SCHEMA.additionalProperties).toBe(false);
    // claude-opus-5-5 and claude-sonnet-5-5 answer a forced tool choice, a
    // disabled thinking block or a sampling knob with a 400.
    for (const field of ["tools", "tool_choice", "thinking", "temperature", "top_p", "top_k", "store"]) {
      expect(body, field).not.toHaveProperty(field);
    }
  });

  it("caps the reply and reads with Opus unless the operator names another model", async () => {
    const { fetcher, calls } = mockFetch(() => json(claudeReply()));
    const first = await readCupWithAI(PHOTO, CONTEXT, envFor("anthropic"), fetcher);
    expect(sentBody(calls[0]!)).toMatchObject({ model: "claude-opus-5-5", max_tokens: FAL_ANTHROPIC_MAX_TOKENS });
    expect(first).toMatchObject({ ok: true, model: "claude-opus-5-5" });

    const second = await readCupWithAI(PHOTO, CONTEXT, envFor("anthropic", { ANTHROPIC_FAL_MODEL: "claude-haiku-5-5" }), fetcher);
    expect(sentBody(calls[1]!).model).toBe("claude-haiku-5-5");
    expect(second).toMatchObject({ ok: true, model: "claude-haiku-5-5" });
    expect(FAL_ANTHROPIC_MAX_TOKENS).toBeGreaterThanOrEqual(1024);
    expect(FAL_ANTHROPIC_MAX_TOKENS).toBeLessThanOrEqual(4096);
  });

  it("carries no identity: the body is the photo, the rules and the identity-free note", () => {
    const body = JSON.stringify(anthropicRequestBody("claude-opus-5-5", CONTEXT, PHOTO));
    expect(body).not.toMatch(/@|\+90|cst-/);
  });
});

describe("the OpenAI path, kept for a text that names OpenAI", () => {
  it("asks OpenAI nothing while the texts name Anthropic, whatever the environment says", async () => {
    // The route turns this away first (falAiEnabled); the function that sends
    // the photo does too, so no other caller can send it to OpenAI either.
    expect(FAL_DISCLOSED_PROVIDER).toBe("anthropic");
    const { fetcher, calls } = mockFetch(() => json(openaiReply()));
    for (const env of [
      envFor("openai"),
      envFor("openai", { ANTHROPIC_API_KEY: ANTHROPIC_KEY }),
      { FAL_AI_ENABLED: "true", OPENAI_API_KEY: OPENAI_KEY },
    ]) {
      expect(await readCupWithAI(PHOTO, CONTEXT, env, fetcher)).toEqual({ ok: false, reason: "failed" });
    }
    expect(calls).toHaveLength(0);
  });

  it("goes to the Responses API with a bearer key and store: false once the texts name OpenAI", async () => {
    // As if the texts, the R12 version and FAL_DISCLOSED_PROVIDER had moved back to OpenAI.
    vi.resetModules();
    vi.doMock("@/lib/mobile/fal-core", async (importOriginal) => ({
      ...(await importOriginal<typeof FalCore>()),
      FAL_DISCLOSED_PROVIDER: "openai",
    }));
    try {
      const fal = await import("@/lib/mobile/fal");
      const { fetcher, calls } = mockFetch(() => json(openaiReply()));
      const outcome = await fal.readCupWithAI(PHOTO, CONTEXT, envFor("openai"), fetcher);
      expect(calls[0]!.url).toBe("https://api.openai.com/v1/responses");
      expect(calls[0]!.init.headers).toEqual({ Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" });
      expect(sentBody(calls[0]!)).toEqual(JSON.parse(JSON.stringify(falRequestBody("gpt-5.4-mini", CONTEXT, PHOTO))));
      expect(sentBody(calls[0]!).store).toBe(false);
      expect(outcome).toEqual({ ok: true, reading: READING, model: "gpt-5.4-mini" });

      // Its failures are logged the same way: a word, never the key.
      const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const failing = mockFetch(() => Promise.reject(new Error(OPENAI_KEY)));
      expect(await fal.readCupWithAI(PHOTO, CONTEXT, envFor("openai"), failing.fetcher)).toEqual({ ok: false, reason: "failed" });
      expect(errors).toHaveBeenCalledWith("[fal] openai request failed", "Error");
      expect(JSON.stringify(errors.mock.calls)).not.toContain(OPENAI_KEY);

      // And then Anthropic is the one the texts do not name.
      const anthropic = mockFetch(() => json(claudeReply()));
      expect(await fal.readCupWithAI(PHOTO, CONTEXT, envFor("anthropic"), anthropic.fetcher)).toEqual({ ok: false, reason: "failed" });
      expect(anthropic.calls).toHaveLength(0);
    } finally {
      vi.doUnmock("@/lib/mobile/fal-core");
      vi.resetModules();
    }
  });

  it("gives both providers the same standing instructions", () => {
    expect(falRequestBody("m", CONTEXT, PHOTO).instructions).toBe(FAL_INSTRUCTIONS);
    expect(anthropicRequestBody("m", CONTEXT, PHOTO).system).toBe(FAL_INSTRUCTIONS);
  });
});

describe("the standing instructions keep the house rules", () => {
  it("say Turkish, 'sen', entertainment only, and no health, legal or money forecasts", () => {
    for (const rule of ["Türkçe", "'sen'", "eğlence", "Sağlık", "hukuki", "para", "yatırım", "uzun tire kullanma"]) {
      expect(FAL_INSTRUCTIONS, rule).toContain(rule);
    }
    expect(FAL_INSTRUCTIONS).not.toMatch(/[–—]/);
  });
});

// ─── What comes back ─────────────────────────────────────────────────────

describe("anthropicReplyText", () => {
  it("reads the text block after the thinking, only for a reply that ended on its own", () => {
    expect(anthropicReplyText(claudeReply())).toEqual({ ok: true, text: JSON.stringify(READING) });
  });

  it("gives the stop reason for a refusal or a cut-off reply, never their content", () => {
    expect(anthropicReplyText({ ...claudeReply(), stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber" } })).toEqual({
      ok: false,
      stop: "refusal",
    });
    expect(anthropicReplyText(claudeReply(READING, "max_tokens"))).toEqual({ ok: false, stop: "max_tokens" });
    expect(anthropicReplyText({ stop_reason: "Bearer secret!", content: [] })).toEqual({ ok: false, stop: "unknown" });
  });

  it("finds nothing in an empty, odd or text-less reply", () => {
    expect(anthropicReplyText(null)).toEqual({ ok: false, stop: "unknown" });
    expect(anthropicReplyText("nope")).toEqual({ ok: false, stop: "unknown" });
    expect(anthropicReplyText({ stop_reason: "end_turn", content: [] })).toEqual({ ok: false, stop: "empty" });
    expect(anthropicReplyText({ stop_reason: "end_turn", content: [{ type: "text", text: "  " }] })).toEqual({ ok: false, stop: "empty" });
    expect(anthropicReplyText({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }] })).toEqual({ ok: false, stop: "empty" });
  });
});

describe("readCupWithAI: a reading, or a reason and the device reads", () => {
  it("returns the reading and the model that wrote it", async () => {
    const { fetcher } = mockFetch(() => json(claudeReply()));
    expect(await readCupWithAI(PHOTO, CONTEXT, envFor("anthropic"), fetcher)).toEqual({
      ok: true,
      reading: READING,
      model: "claude-opus-5-5",
    });
  });

  it("validates the answer the same way for both providers", async () => {
    for (const bad of [
      { ...READING, forecast: "Yarın sana ücretsiz bir kahve var." },
      { ...READING, cupSeen: "yes" },
      { ...READING, symbol: "" },
      { ...READING, trait: "a".repeat(400) },
    ]) {
      const anthropic = mockFetch(() => json(claudeReply(bad)));
      expect(await readCupWithAI(PHOTO, CONTEXT, envFor("anthropic"), anthropic.fetcher)).toEqual({ ok: false, reason: "unfit" });
      // OpenAI's reply text goes through the same parseFalReply.
      expect(parseFalReply(JSON.parse(responseText(openaiReply(bad)) ?? "null"))).toBeNull();
    }
  });

  it("falls back on a refusal, a cut-off answer, an empty one or text that is not JSON", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const replies = [
      { ...claudeReply(), content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: null } },
      claudeReply(READING, "max_tokens"),
      { ...claudeReply(), content: [{ type: "thinking", thinking: "" }] },
      { ...claudeReply(), content: [{ type: "text", text: "Bugün falına bakamıyorum." }] },
    ];
    for (const reply of replies) {
      const { fetcher } = mockFetch(() => json(reply));
      expect(await readCupWithAI(PHOTO, CONTEXT, envFor("anthropic"), fetcher)).toEqual({ ok: false, reason: "unfit" });
    }
  });

  it("fails without throwing on an error status, an overload or a dropped connection", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const status of [400, 401, 429, 500, 529]) {
      const { fetcher } = mockFetch(() => json({ type: "error", error: { type: "overloaded_error", message: "x" } }, status));
      expect(await readCupWithAI(PHOTO, CONTEXT, envFor("anthropic"), fetcher), String(status)).toEqual({ ok: false, reason: "failed" });
    }
    const { fetcher } = mockFetch(() => Promise.reject(new TypeError("fetch failed")));
    expect(await readCupWithAI(PHOTO, CONTEXT, envFor("anthropic"), fetcher)).toEqual({ ok: false, reason: "failed" });
  });

  it("asks nobody when FAL_AI_PROVIDER names no provider", async () => {
    const { fetcher, calls } = mockFetch(() => json(claudeReply()));
    expect(await readCupWithAI(PHOTO, CONTEXT, { ...envFor("anthropic"), FAL_AI_PROVIDER: "gemini" }, fetcher)).toEqual({
      ok: false,
      reason: "failed",
    });
    expect(calls).toHaveLength(0);
  });
});

describe("readCupWithAI: the timeout", () => {
  // Only the timer readCupWithAI sets; the rest of the runtime keeps real time.
  const fakeTimeout = () => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  it(`gives up after ${FAL_TIMEOUT_MS / 1000} s, aborting the request`, async () => {
    fakeTimeout();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let signal: AbortSignal | undefined;
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("This operation was aborted", "AbortError")));
      });
    }) as unknown as typeof fetch;
    const pending = readCupWithAI(PHOTO, CONTEXT, envFor("anthropic"), fetcher);
    await vi.advanceTimersByTimeAsync(FAL_TIMEOUT_MS - 1);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal?.aborted).toBe(true);
    expect(await pending).toEqual({ ok: false, reason: "failed" });
  });

  it("clears its timer when the answer comes in time", async () => {
    fakeTimeout();
    const answer = { ok: true, status: 200, json: async () => claudeReply() } as unknown as Response;
    const fetcher = vi.fn(async () => answer) as unknown as typeof fetch;
    expect(await readCupWithAI(PHOTO, CONTEXT, envFor("anthropic"), fetcher)).toMatchObject({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("readCupWithAI: what it logs", () => {
  const logged: string[] = [];

  beforeEach(() => {
    logged.length = 0;
    for (const level of ["error", "warn", "log", "info", "debug"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logged.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a) ?? String(a))).join(" "));
      });
    }
  });

  it("never the key, the photo, the prompt or the member: only a status, a stop reason or an error's name", async () => {
    const leaky = new Error(`boom ${ANTHROPIC_KEY} ${PHOTO}`);
    const answers: (() => Response | Promise<Response>)[] = [
      () => json({ error: { message: `invalid x-api-key ${ANTHROPIC_KEY}` } }, 401),
      () => json({ error: { message: "overloaded" } }, 529),
      () => Promise.reject(leaky),
      () => json({ ...claudeReply(), stop_reason: "refusal", stop_details: { category: "cyber", explanation: `${CONTEXT.usual}` } }),
      () => json(claudeReply(READING, "max_tokens")),
      () => json(claudeReply({ ...READING, forecast: "Sana bir indirim var." })),
      () => json(claudeReply()),
    ];
    for (const answer of answers) {
      const { fetcher } = mockFetch(answer);
      await readCupWithAI(PHOTO, CONTEXT, envFor("anthropic"), fetcher);
    }

    expect(logged.length).toBeGreaterThan(0);
    const all = logged.join("\n");
    for (const secret of [
      ANTHROPIC_KEY,
      OPENAI_KEY,
      PHOTO,
      PHOTO.slice(0, 16),
      CONTEXT.usual,
      CONTEXT.tier,
      falContextLine(CONTEXT),
      FAL_INSTRUCTIONS.slice(0, 40),
      READING.forecast,
      "boom",
    ]) {
      expect(all, secret).not.toContain(secret);
    }
    // What it does say, per line: the provider and one short word or number.
    for (const line of logged) {
      expect(line).toMatch(/^\[fal\] (anthropic|openai) (status|request failed|no reading) [A-Za-z0-9_]{1,40}$/);
    }
  });
});

// ─── What the operator and the app read about it ────────────────────────

describe("the documents that describe it", () => {
  it(".env.example names every switch, the default model and why OpenAI stays off", () => {
    const env = readFileSync(".env.example", "utf8");
    for (const name of ["FAL_AI_ENABLED", "FAL_AI_PROVIDER", "ANTHROPIC_API_KEY", "ANTHROPIC_FAL_MODEL", "OPENAI_API_KEY", "OPENAI_FAL_MODEL"]) {
      expect(env, name).toMatch(new RegExp(`^# ${name}=`, "m"));
    }
    expect(env).toContain("claude-opus-5-5");
    expect(env).toContain("FAL_DISCLOSED_PROVIDER");
  });

  it("the switch waits for the standard contract and an app that names the right recipient", () => {
    // KVKK m.9 (2024): the photo goes with every reading, so the transfer is
    // not incidental and consent alone does not carry it. And the app shows
    // its own four consent lines while posting back the server's version.
    const env = readFileSync(".env.example", "utf8");
    for (const gate of ["standart sözleşmesi", "arızi değil", "minSupportedAppVersion", "gerçek yorum"]) {
      expect(env, gate).toContain(gate);
    }
    const doc = readFileSync("docs/API-MOBILE.md", "utf8");
    const fal = doc.slice(doc.indexOf("## 20. fA'L"), doc.indexOf("## 21."));
    for (const gate of ["beş iş günü", "arızi", "minSupportedAppVersion"]) {
      expect(fal, gate).toContain(gate);
    }
    expect(fal).not.toContain("hiçbir\n  yerde saklanmaz");
    const note = readFileSync("docs/LEGAL-REDLINES-2026-09.md", "utf8");
    const y1 = note.slice(note.indexOf("## 15. Y1"), note.indexOf("## Ek A"));
    for (const fact of ["m.9/4-c", "m.9/6-a", "Yönetmelik m.16/1", "beş iş günü", "minSupportedAppVersion", "avukat"]) {
      expect(y1, fact).toContain(fact);
    }
    expect(y1).not.toContain("Hukuki sebep: açık rıza (KVKK m.5/1 ve m.9");
  });

  it("the contract (§20) describes both providers, the recipient gate and the version that names it", () => {
    const doc = readFileSync("docs/API-MOBILE.md", "utf8");
    const fal = doc.slice(doc.indexOf("## 20. fA'L"), doc.indexOf("## 21."));
    for (const fact of [
      "FAL_AI_PROVIDER",
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_FAL_MODEL",
      "claude-opus-5-5",
      "https://api.anthropic.com/v1/messages",
      "anthropic-version: 2023-06-01",
      "OPENAI_FAL_MODEL",
      "store: false",
      "FAL_DISCLOSED_PROVIDER",
      FAL_CONSENT_VERSION,
      "consent_outdated",
    ]) {
      expect(fal, fact).toContain(fact);
    }
    expect(fal).not.toMatch(/[–—]/);
    // The bootstrap flag keeps its meaning and says where the switches are.
    expect(doc).toMatch(/"fal": \{ "ai": false \},.*FAL_AI_ENABLED=true VE seçilen sağlayıcının anahtarı/);
  });
});

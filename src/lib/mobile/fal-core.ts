/**
 * fA'L read by AI (karar 177, 23 Eyl 2026) - the pure half.
 *
 * RETIRED, 27 Oct 2026. App Review refused the iOS app under Guideline
 * 4.3(b) (fortune telling) and fA'L left the app (lafmobil karar 330: Kahve
 * Modu took its place, the photo never leaves the device, no AI). The AI
 * reading is off in code, whatever the environment says (`falAiEnabled`),
 * and never comes back. The endpoints stay because v1 only grows
 * (docs/API-MOBILE.md §20): POST /fal answers 503 `fal_unavailable`, the
 * bootstrap says `fal.ai` false, the R12 consents were closed by
 * db/migrations/20261027120000_retire_fal_ai_consents.sql and the old rows
 * run out under their retention rules (src/lib/retention.ts). Everything
 * below is the record of what the feature was; nothing reads with it.
 *
 * The operator: "let them photograph their americano or latte and read it
 * by the situation; they are members, so you know a little about them; say
 * 'AI ile yorumlanıyor'; I will give the OpenAI key later." On 17 Eki 2026
 * the operator moved the reading to Anthropic's Claude API; the OpenAI path
 * stays in the code, chosen by the environment.
 *
 * What this module decides, without touching the network or the database:
 * whether the feature is on at all, which provider and model read, what the
 * model is told, what it may answer, and whether an answer is fit to show.
 * The rules that make it lawful live here too, so they are tested rather
 * than trusted:
 *
 *   - The provider is `FAL_AI_PROVIDER` (anthropic | openai); unset, it is
 *     Anthropic when `ANTHROPIC_API_KEY` is set and OpenAI otherwise.
 *   - The feature is OFF unless `FAL_AI_ENABLED=true` AND the chosen
 *     provider's key is set. The key alone does not switch it on: the
 *     explicit-consent text (Açık Rıza Metni R12) and the transfer abroad
 *     want a standard contract first.
 *   - It stays OFF, whatever the environment says, until the standard
 *     contract with the recipient is signed and filed with the Kurum and
 *     that is recorded in `fal-safeguard.ts` (`falTransferSafeguardInForce`).
 *     R12 promises exactly that: no photo before the contract is notified.
 *   - It is also OFF when the chosen provider is not the recipient the
 *     published texts name (`FAL_DISCLOSED_PROVIDER`): a photo sent to a
 *     company the member was never told about is a transfer abroad without
 *     consent, whatever the environment says.
 *   - Only a consent recorded at `FAL_CONSENT_VERSION` counts. The version
 *     names the text's day and its recipient, so a new text and a new
 *     recipient both ask again.
 *   - The member is described by their tier, a visit-frequency word and, if
 *     they saved one, their usual drink - never a name, an e-mail, a phone
 *     number or an id.
 *   - A reading that promises anything the house would have to honour (a
 *     discount, a free drink, a gift, points, a coupon) is not shown
 *     (Tüketici Kanunu md. 61); nor one that is too long or empty.
 */

import { FAL_TRANSFER_SAFEGUARD, type FalTransferSafeguard } from "./fal-safeguard";
import { istanbulParts } from "./loyalty-core";

export { FAL_TRANSFER_SAFEGUARD, type FalTransferSafeguard } from "./fal-safeguard";

export const FAL_FEATURE = "fal-ai";

/** Readings a member may ask the AI for in one Istanbul day. */
export const FAL_DAILY_LIMIT = 5;

/** The downscaled JPEG the app sends, decoded - a 768 px image is ~150 KB. */
export const FAL_IMAGE_MAX_BYTES = 900_000;

/**
 * How long the model may take before the app reads the cup itself. POST /fal
 * runs for at most 30 s (`maxDuration`, and the app waits 30 s too); the
 * sign-in and database steps before the call need the rest.
 */
export const FAL_TIMEOUT_MS = 20_000;

/** Each part of a reading, at most - a story line, not a paragraph. */
export const FAL_PART_MAX = 160;

type Env = Record<string, string | undefined>;

export const FAL_PROVIDERS = ["anthropic", "openai"] as const;
export type FalProvider = (typeof FAL_PROVIDERS)[number];

/** Where each provider's key and model come from, its default reader, and who it is in law. */
export const FAL_PROVIDER_INFO: Record<
  FalProvider,
  { keyEnv: string; modelEnv: string; defaultModel: string; legalName: string }
> = {
  // Claude's current models are claude-opus-5-5, claude-sonnet-5-5 and
  // claude-haiku-5-5 (platform.claude.com, 17 Eki 2026); Opus by default.
  anthropic: {
    keyEnv: "ANTHROPIC_API_KEY",
    modelEnv: "ANTHROPIC_FAL_MODEL",
    defaultModel: "claude-opus-5-5",
    legalName: "Anthropic, PBC",
  },
  // A small vision model (developers.openai.com, 23 Eyl 2026).
  openai: {
    keyEnv: "OPENAI_API_KEY",
    modelEnv: "OPENAI_FAL_MODEL",
    defaultModel: "gpt-5.4-mini",
    legalName: "OpenAI, L.L.C.",
  },
};

/**
 * The provider the published texts name as the photo's recipient (Açık Rıza
 * Metni R12, KVKK Aydınlatma Metni, Gizlilik Politikası: "Anthropic, PBC",
 * 17 Eki 2026) and the only one the photo may go to. Changing it is a change
 * of those texts and of the consent version, never an environment switch;
 * tests/legal-fal-recipient.test.ts holds the texts to it.
 */
export const FAL_DISCLOSED_PROVIDER: FalProvider = "anthropic";

/**
 * The day the R12 text last changed. 17 Eki 2026: its recipient became
 * Anthropic. 19 Eki 2026: it states Anthropic's retention and no-training
 * terms and that no photo is sent before the standard contract is signed
 * and notified, so members who said yes to the 17 Eki text are asked again.
 */
export const FAL_CONSENT_TEXT_DAY = "2026-10-19";

/**
 * The R12 consent's version for a recipient: the text's day and the
 * provider it names ("2026-10-19-anthropic"). The consent row keeps it, so
 * the proof says whom the member agreed to send the photo to.
 */
export function falConsentVersionFor(provider: FalProvider): string {
  return `${FAL_CONSENT_TEXT_DAY}-${provider}`;
}

/**
 * The version a consent must carry to count (`hasFalConsent`); the app asks
 * again for any other. A new text moves it, and so does a new recipient: a
 * yes given for one provider is never read as a yes for another. The 23 Eyl
 * 2026 consents ("2026-09-23", the text that named OpenAI) no longer count.
 */
export const FAL_CONSENT_VERSION = falConsentVersionFor(FAL_DISCLOSED_PROVIDER);

/**
 * Which provider reads: the one `FAL_AI_PROVIDER` names; unset, Anthropic
 * when its key is there and OpenAI otherwise. A value that names neither is
 * a typo, and a typo reads with nobody (null: the feature stays off) rather
 * than with whichever key happens to be set.
 */
export function falProvider(env: Env): FalProvider | null {
  const chosen = env.FAL_AI_PROVIDER?.trim().toLowerCase() ?? "";
  if (!chosen) return env.ANTHROPIC_API_KEY?.trim() ? "anthropic" : "openai";
  return (FAL_PROVIDERS as readonly string[]).includes(chosen) ? (chosen as FalProvider) : null;
}

/** The provider's API key, trimmed, or "" when it is not set. */
export function falApiKey(env: Env, provider: FalProvider): string {
  return env[FAL_PROVIDER_INFO[provider].keyEnv]?.trim() ?? "";
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day written YYYY-MM-DD ("2026-02-30" is not one). */
function isCalendarDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  const at = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === value;
}

/**
 * Whether the standard contract that carries the photo abroad is in force
 * today: both days are real days, the contract was signed on or before it
 * was filed, the filing day is today or earlier on the Istanbul calendar
 * (kural 22: the server's UTC clock reads yesterday until 03:00), and the
 * filing has a receipt. Anything less - the empty record included - is no.
 */
export function falTransferSafeguardInForce(
  now: Date = new Date(),
  safeguard: FalTransferSafeguard = FAL_TRANSFER_SAFEGUARD,
): boolean {
  const { signedOn, notifiedOn, receipt } = safeguard;
  if (!isCalendarDay(signedOn) || !isCalendarDay(notifiedOn)) return false;
  if (signedOn > notifiedOn) return false;
  if (receipt.trim() === "") return false;
  const today = istanbulParts(now.toISOString())?.dayKey;
  return today !== undefined && notifiedOn <= today;
}

/**
 * Always off. App Review refused the iOS app on 27 Oct 2026 under Guideline
 * 4.3(b) and fA'L, with its AI reading, left the app (lafmobil karar 330).
 * So the reading is off in code, not by an environment value someone could
 * set again: `FAL_AI_ENABLED`, the providers' keys and the standard
 * contract's record (`fal-safeguard.ts`) are no longer read here. It used
 * to need all of them: the switch, the chosen provider's key, that provider
 * being the recipient the texts named, and the contract signed and notified.
 *
 * The bootstrap (`app.fal.ai`), GET /fal/consent (`enabled`) and
 * `readCupWithAI`, the only function that ever sent the photo, ask this.
 * POST /fal no longer has anything to ask it for: it answers 503
 * `fal_unavailable` to every signed-in caller.
 */
export function falAiEnabled(): boolean {
  return false;
}

/** The model that reads: the provider's model switch, else its default. */
export function falModel(env: Env, provider: FalProvider = falProvider(env) ?? FAL_DISCLOSED_PROVIDER): string {
  const info = FAL_PROVIDER_INFO[provider];
  return env[info.modelEnv]?.trim() || info.defaultModel;
}

/** What the model is told about the member - no identity. */
export type FalContext = {
  /** The tier's shown name: L'AF, PEARL or RUBY. */
  tier: string;
  /** How often they come, as a word. */
  visits: "new" | "regular" | "loyal";
  /** Their saved usual, by its menu name, or "" if none. */
  usual: string;
};

/** Paid orders in the last 365 days, as a word the model can use kindly. */
export function visitsWord(ordersLast365: number): FalContext["visits"] {
  if (ordersLast365 >= 24) return "loyal";
  if (ordersLast365 >= 4) return "regular";
  return "new";
}

const VISITS_TR: Record<FalContext["visits"], string> = {
  new: "köşke yeni gelmeye başlamış",
  regular: "köşke düzenli gelen",
  loyal: "köşkün sadık dostu",
};

/**
 * The standing instructions: voice, rules, and what never to say. Both
 * providers get the same words (OpenAI as `instructions`, Anthropic as
 * `system`).
 */
export const FAL_INSTRUCTIONS = [
  "Sen L'Affogato'nun (İstanbul Tuzla'da, iki yüz yıllık bir Rum köşkünde İtalyan kahve ve gelato barı) fincan falcısısın. Adın fA'L: L'Af tersten.",
  "Sana üyenin içeceğinin fotoğrafı ve üye hakkında kısa bir not verilir. Türkçe, sıcak, esprili ve nazik bir fal yaz; üyeye 'sen' diye seslen ve kişi hakkında güzel şeyler söyle.",
  "Önce fotoğrafta bir içecek görüp görmediğini söyle (cupSeen). Gördüysen içeceği kısaca adlandır (drink; örneğin Americano, Latte, Affogato, matcha); emin değilsen genel bir ad kullan. Görmediysen drink boş olsun ve fal yine nazik olsun.",
  "symbol: fincanda ya da köpükte gördüğün bir şekli anlat. trait: bu şekilden kişinin iyi bir yanını çıkar. forecast: yakın gelecek için küçük, tatlı bir öngörü.",
  "Her alan en fazla bir iki kısa cümle olsun. Emoji ve uzun tire kullanma.",
  "Kesin kurallar: Fotoğraftaki kişileri, yüzleri veya belgeleri tanımlama ve yorumlama. Sağlık, hastalık, hamilelik, ilişki, para, yatırım, dava ya da başka hukuki konular, sınav veya iş sonucu hakkında öngöride bulunma. İndirim, bedava ya da ücretsiz ürün, hediye, kupon, puan, damga veya herhangi bir ayrıcalık vaat etme. Kötü haber, korkutma ve olumsuz kehanet yok. Siyaset ve din yok.",
  "Bu bir eğlencedir; gerçeği yansıttığını ima etme.",
].join("\n");

/** The per-request note about the member, in Turkish, identity-free. */
export function falContextLine(context: FalContext): string {
  const parts = [`Üyenin seviyesi: ${context.tier}.`, `Üye ${VISITS_TR[context.visits]} biri.`];
  if (context.usual) parts.push(`Her zamanki içeceği: ${context.usual}.`);
  parts.push("Fotoğraftaki içeceğe bak ve falını yaz.");
  return parts.join(" ");
}

/**
 * The reply's JSON Schema, for structured outputs: OpenAI's strict
 * `json_schema` text format and Anthropic's `output_config.format`.
 */
export const FAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["cupSeen", "drink", "symbol", "trait", "forecast"],
  properties: {
    cupSeen: { type: "boolean" },
    drink: { type: "string" },
    symbol: { type: "string" },
    trait: { type: "string" },
    forecast: { type: "string" },
  },
} as const;

export type FalAiReading = {
  cupSeen: boolean;
  drink: string;
  symbol: string;
  trait: string;
  forecast: string;
};

/**
 * Word stems that would make a reading a promise (TKHK md. 61) or step
 * outside the game. Matched at the start of a word in lowercased Turkish -
 * `\b` is ASCII-only in JavaScript and never fires before "ü" or "ı" - and
 * "puan" spares "puantiye", a polka-dot foam being a fair thing to see.
 */
const FORBIDDEN_STEMS = [
  "indirim",
  "bedava",
  "ücretsiz",
  "hediye",
  "kupon",
  "puan(?!tiye)",
  "damga",
  "kampanya",
  "hastal",
  "hamile",
  "yatırım",
];
const FORBIDDEN = FORBIDDEN_STEMS.map((stem) => new RegExp(`(?<!\\p{L})${stem}`, "u"));

function clean(text: unknown): string {
  if (typeof text !== "string") return "";
  // One dash in this house (kural 10): the long and the middle dash become a hyphen.
  return text.replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim();
}

/**
 * The model's reply, fit to show - or null, and the app reads the cup
 * itself. Rejected: not the schema, an empty or overlong part, or any word
 * that promises something.
 */
export function parseFalReply(raw: unknown): FalAiReading | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.cupSeen !== "boolean") return null;
  const reading: FalAiReading = {
    cupSeen: r.cupSeen,
    drink: clean(r.drink),
    symbol: clean(r.symbol),
    trait: clean(r.trait),
    forecast: clean(r.forecast),
  };
  for (const part of [reading.symbol, reading.trait, reading.forecast]) {
    if (!part || part.length > FAL_PART_MAX) return null;
  }
  if (reading.drink.length > 40) return null;
  const all = `${reading.drink} ${reading.symbol} ${reading.trait} ${reading.forecast}`.toLocaleLowerCase("tr-TR");
  if (FORBIDDEN.some((re) => re.test(all))) return null;
  return reading;
}

/**
 * The Responses API reply's text: the first `output_text` of the first
 * message. The REST reply has no `output_text` convenience field.
 */
export function responseText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const output = (body as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (!item || typeof item !== "object" || (item as { type?: unknown }).type !== "message") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c && typeof c === "object" && (c as { type?: unknown }).type === "output_text") {
        const text = (c as { text?: unknown }).text;
        if (typeof text === "string") return text;
      }
    }
  }
  return null;
}

/** The base64 image, decoded, if it is a JPEG of an acceptable size. */
export function decodeCupImage(base64: string): Buffer | null {
  const body = base64.replace(/^data:image\/jpeg;base64,/, "").trim();
  if (!body || !/^[A-Za-z0-9+/=\s]+$/.test(body)) return null;
  const bytes = Buffer.from(body, "base64");
  if (bytes.length < 4 || bytes.length > FAL_IMAGE_MAX_BYTES) return null;
  // JPEG's start-of-image marker.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  return bytes;
}

/** The request body OpenAI's Responses API takes. `store: false` - nothing kept. */
export function falRequestBody(model: string, context: FalContext, jpegBase64: string) {
  return {
    model,
    instructions: FAL_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: falContextLine(context) },
          { type: "input_image", image_url: `data:image/jpeg;base64,${jpegBase64}`, detail: "low" },
        ],
      },
    ],
    text: { format: { type: "json_schema", name: "fal", strict: true, schema: FAL_SCHEMA } },
    max_output_tokens: 600,
    store: false,
  };
}

// ─── Anthropic's Messages API (17 Eki 2026) ──────────────────────────────

export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";

/**
 * The reply is four short fields, a few hundred tokens. Claude's current
 * models think before they answer (on claude-opus-5-5 it cannot be switched
 * off, only kept short with `effort: "low"`) and the thinking counts toward
 * this cap, so it leaves room for that and still bounds what one reading
 * can cost.
 */
export const FAL_ANTHROPIC_MAX_TOKENS = 2048;

/**
 * The request body the Messages API takes: the same persona and rules as
 * `system`, the same downscaled, metadata-free JPEG as a base64 image block
 * (before the text, where Claude reads images best) and the same note about
 * the member. The answer is held to `FAL_SCHEMA` by structured outputs
 * (`output_config.format`): Claude's current Opus and Sonnet refuse a forced
 * tool call (`tool_choice` "tool" is a 400 there), and a forced call was only
 * ever a way to get this JSON back. The Messages API keeps no conversation
 * state, so there is no `store` switch to send.
 */
export function anthropicRequestBody(model: string, context: FalContext, jpegBase64: string) {
  return {
    model,
    max_tokens: FAL_ANTHROPIC_MAX_TOKENS,
    system: FAL_INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpegBase64 } },
          { type: "text", text: falContextLine(context) },
        ],
      },
    ],
    output_config: { effort: "low", format: { type: "json_schema", schema: FAL_SCHEMA } },
  };
}

/** A Messages API reply: its JSON text, or why there is none. */
export type AnthropicReply = { ok: true; text: string } | { ok: false; stop: string };

/**
 * The reply's text, read only when the model finished on its own
 * (`end_turn`). `refusal` is the model's safety decline and `max_tokens` a
 * cut-off answer: neither is shown, and the app reads the cup itself. The
 * text is the first `text` block, found by type - thinking blocks come
 * first. `stop` is a short lowercase word or "unknown", so it can be logged.
 */
export function anthropicReplyText(body: unknown): AnthropicReply {
  if (!body || typeof body !== "object") return { ok: false, stop: "unknown" };
  const reply = body as { stop_reason?: unknown; content?: unknown };
  const stop = typeof reply.stop_reason === "string" ? reply.stop_reason : "";
  if (stop !== "end_turn") return { ok: false, stop: /^[a-z_]{1,32}$/.test(stop) ? stop : "unknown" };
  if (Array.isArray(reply.content)) {
    for (const block of reply.content) {
      if (!block || typeof block !== "object" || (block as { type?: unknown }).type !== "text") continue;
      const text = (block as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) return { ok: true, text };
    }
  }
  return { ok: false, stop: "empty" };
}

// ─── "Bu yorumu bildir" (docs/API-MOBILE.md §20, additive) ─────────────────

/**
 * Why a member reports an AI reading. A closed list on purpose: a free-text
 * reason is a box the member can type their name, their health or anything
 * else into, and the report is kept for ninety days. A reason this server
 * does not know - a newer build's - is kept as `other` rather than refused,
 * so the report itself is never lost.
 */
export const FAL_REPORT_REASONS = ["offensive", "promise", "sensitive", "other"] as const;
export type FalReportReason = (typeof FAL_REPORT_REASONS)[number];

/** Each reason as the panel shows it (and as the app may offer it). */
export const FAL_REPORT_REASON_LABELS: Record<FalReportReason, string> = {
  offensive: "Kırıcı ya da uygunsuz",
  promise: "Bir şey vaat ediyor",
  sensitive: "Sağlık, para ya da ilişki hakkında",
  other: "Başka bir sebep",
};

/** Reports one member may send in one Istanbul day: twice the readings. */
export const FAL_REPORT_DAILY_LIMIT = FAL_DAILY_LIMIT * 2;

/**
 * The reading's words as the member saw them, at most. A reading is a drink
 * name of up to 40 characters and three parts of up to `FAL_PART_MAX`; this
 * leaves room for the separators the app puts between them.
 */
export const FAL_REPORT_TEXT_MAX = 800;

/** Model names are short identifiers; anything else is not recorded. */
const MODEL_NAME = /^[A-Za-z0-9._:-]{1,64}$/;

export function falReportReason(raw: unknown): FalReportReason {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return (FAL_REPORT_REASONS as readonly string[]).includes(value) ? (value as FalReportReason) : "other";
}

/** The model the app says wrote the reading (from `POST /fal`), or "" when unknown. */
export function falReportModel(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  return MODEL_NAME.test(value) ? value : "";
}

/** The reported words, one line, spaces collapsed - or null when empty or too long. */
export function falReportText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || text.length > FAL_REPORT_TEXT_MAX) return null;
  return text;
}

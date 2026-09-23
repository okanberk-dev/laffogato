/**
 * fA'L read by AI (karar 177, 23 Eyl 2026) - the pure half.
 *
 * The operator: "let them photograph their americano or latte and read it
 * by the situation; they are members, so you know a little about them; say
 * 'AI ile yorumlanıyor'; I will give the OpenAI key later."
 *
 * What this module decides, without touching the network or the database:
 * whether the feature is on at all, which model reads, what the model is
 * told, what it may answer, and whether an answer is fit to show. The rules
 * that make it lawful live here too, so they are tested rather than trusted:
 *
 *   - The feature is OFF unless BOTH `OPENAI_API_KEY` and
 *     `FAL_AI_ENABLED=true` are set. The key alone does not switch it on:
 *     the explicit-consent text (Açık Rıza Metni R12) and the transfer
 *     abroad want a lawyer's reading and a standard contract first.
 *   - Only a consent recorded at `FAL_CONSENT_VERSION` counts; a new version
 *     asks again.
 *   - The member is described by their tier, a visit-frequency word and, if
 *     they saved one, their usual drink - never a name, an e-mail, a phone
 *     number or an id.
 *   - A reading that promises anything the house would have to honour (a
 *     discount, a free drink, a gift, points, a coupon) is not shown
 *     (Tüketici Kanunu md. 61); nor one that is too long or empty.
 */

export const FAL_FEATURE = "fal-ai";

/** The R12 text's version; bump it when the consent text changes. */
export const FAL_CONSENT_VERSION = "2026-09-23";

/** Readings a member may ask the AI for in one Istanbul day. */
export const FAL_DAILY_LIMIT = 5;

/** The downscaled JPEG the app sends, decoded - a 768 px image is ~150 KB. */
export const FAL_IMAGE_MAX_BYTES = 900_000;

/** How long the model may take before the app reads the cup itself. */
export const FAL_TIMEOUT_MS = 20_000;

/** Each part of a reading, at most - a story line, not a paragraph. */
export const FAL_PART_MAX = 160;

/** The default reader: a small vision model (developers.openai.com, 23 Eyl 2026). */
export const FAL_DEFAULT_MODEL = "gpt-5.4-mini";

type Env = Record<string, string | undefined>;

/** On only with the key AND the explicit switch. */
export function falAiEnabled(env: Env): boolean {
  return Boolean(env.OPENAI_API_KEY?.trim()) && env.FAL_AI_ENABLED?.trim().toLowerCase() === "true";
}

export function falModel(env: Env): string {
  return env.OPENAI_FAL_MODEL?.trim() || FAL_DEFAULT_MODEL;
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

/** The standing instructions: voice, rules, and what never to say. */
export const FAL_INSTRUCTIONS = [
  "Sen L'Affogato'nun (İstanbul Tuzla'da, iki yüz yıllık bir Rum köşkünde İtalyan kahve ve gelato barı) fincan falcısısın. Adın fA'L: L'Af tersten.",
  "Sana üyenin içeceğinin fotoğrafı ve üye hakkında kısa bir not verilir. Türkçe, sıcak, esprili ve nazik bir fal yaz; kişi hakkında güzel şeyler söyle.",
  "Önce fotoğrafta bir içecek görüp görmediğini söyle (cupSeen). Gördüysen içeceği kısaca adlandır (drink; örneğin Americano, Latte, Affogato, matcha); emin değilsen genel bir ad kullan. Görmediysen drink boş olsun ve fal yine nazik olsun.",
  "symbol: fincanda ya da köpükte gördüğün bir şekli anlat. trait: bu şekilden kişinin iyi bir yanını çıkar. forecast: yakın gelecek için küçük, tatlı bir öngörü.",
  "Her alan en fazla bir iki kısa cümle olsun. Emoji ve uzun tire kullanma.",
  "Kesin kurallar: Fotoğraftaki kişileri, yüzleri veya belgeleri tanımlama ve yorumlama. Sağlık, hastalık, hamilelik, ilişki, para, yatırım, sınav veya iş sonucu hakkında öngöride bulunma. İndirim, bedava ya da ücretsiz ürün, hediye, kupon, puan, damga veya herhangi bir ayrıcalık vaat etme. Kötü haber, korkutma ve olumsuz kehanet yok. Siyaset ve din yok.",
  "Bu bir eğlencedir; gerçeği yansıttığını ima etme.",
].join("\n");

/** The per-request note about the member, in Turkish, identity-free. */
export function falContextLine(context: FalContext): string {
  const parts = [`Üyenin seviyesi: ${context.tier}.`, `Üye ${VISITS_TR[context.visits]} biri.`];
  if (context.usual) parts.push(`Her zamanki içeceği: ${context.usual}.`);
  parts.push("Fotoğraftaki içeceğe bak ve falını yaz.");
  return parts.join(" ");
}

/** The reply's JSON Schema, for Structured Outputs (strict). */
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

/** The request body the Responses API takes. `store: false` - nothing kept. */
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

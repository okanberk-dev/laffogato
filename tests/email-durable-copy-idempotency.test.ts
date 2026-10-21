import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { AdminOrder } from "@/lib/admin/store";
import { createDb, type Executor } from "@/lib/db/client";
import { findLegalDoc } from "@/lib/legal/documents";
import { CHECKOUT_CONSENT_DOCS, KARAOKE_CONSENT_DOCS } from "@/lib/legal/meta";
import { codedVersionDoc, legalVersionOf } from "@/lib/legal/version-core";
import type { KaraokeReservation } from "@/lib/mobile/karaoke-core";

/**
 * The confirmations that carry the confirmed contract (ASK-DURABLE), end to
 * end, against Resend's documented idempotency rules (adopted from the
 * review of PR #193, 21 Eki 2026; findings M1, M2, M3).
 *
 * Runs the real chain notifyOrderPaid -> once/claim/settle -> paidMailCopy
 * -> durableCopyWithin -> orderDurableCopy (versions read from the
 * "database") -> sendOrderPaidEmail -> sendWithCopy -> deliver. Faked: the
 * database (an in-memory executor that keeps the order_notice_emails row
 * the way Postgres would), the clock (every bound is a timer, so the time
 * a call holds its request is measured, not waited), and Resend, which
 * follows its documented rules (resend.com/docs/dashboard/emails/
 * idempotency-keys, /api-reference/errors):
 *   - a key seen within 24 h with the SAME body: the first response, no
 *     new mail;
 *   - the same key while the first request is still processing:
 *     409 concurrent_idempotent_requests;
 *   - the same key with a DIFFERENT body: 409 invalid_idempotent_request.
 *
 * M1: a 409 was read as "nothing sent" and a second mail went out under
 *     `<key>-ek-yok`. A 409 is never a refusal now; an
 *     invalid_idempotent_request means the message is out.
 * M2: the awaited paid mail could hold the payment return 12 s and more
 *     (the copy's race outside the 9.5 s of sends), the karaoke
 *     confirmation 10.5 s against its 4 s. Both now run inside one
 *     deadline (src/lib/email/budget.ts).
 * M3: the karaoke copy printed a free-cancel moment the booking never had.
 */

const [OBF, MSS] = CHECKOUT_CONSENT_DOCS;
const KARAOKE = KARAOKE_CONSENT_DOCS[0];
const obf = legalVersionOf(codedVersionDoc(findLegalDoc(OBF)!));
const mss = legalVersionOf(codedVersionDoc(findLegalDoc(MSS)!));
const krk = legalVersionOf(codedVersionDoc(findLegalDoc(KARAOKE)!));

// ── database ────────────────────────────────────────────────────────────
/** ms the legal_doc_versions read takes; Infinity = never answers. */
let versionsReadMs = 0;
const notices = new Map<string, Record<string, unknown>>();

function where(text: string, params: unknown[]) {
  const clause = text.split(" WHERE ")[1] ?? "";
  const conds: { col: string; op: string; value: unknown }[] = [];
  for (const m of clause.matchAll(/"(\w+)" (=|<) \$(\d+)/g)) {
    conds.push({ col: m[1], op: m[2], value: params[Number(m[3]) - 1] });
  }
  return conds;
}

function setPart(text: string, params: unknown[]) {
  const clause = text.split(" SET ")[1]?.split(" WHERE ")[0] ?? "";
  const out: Record<string, unknown> = {};
  for (const m of clause.matchAll(/"(\w+)" = \$(\d+)/g)) {
    out[m[1]] = params[Number(m[2]) - 1];
  }
  return out;
}

const exec: Executor = async ({ text, params }) => {
  if (/FROM "legal_doc_versions"/.test(text)) {
    if (versionsReadMs === Infinity) await new Promise(() => {});
    if (versionsReadMs > 0) {
      await new Promise((r) => setTimeout(r, versionsReadMs));
    }
    const wanted = new Set(params.flat() as string[]);
    const rows = [obf, mss, krk]
      .filter((v) => wanted.has(v.hash))
      .map((v) => ({
        hash: v.hash,
        slug: v.slug,
        body: v.text,
        createdAt: "2026-10-21T00:00:00.000Z",
      }));
    return { rows, rowCount: rows.length };
  }
  if (/"order_notice_emails"/.test(text)) {
    if (text.startsWith("INSERT")) {
      const key = `${params[0]}|${params[1]}`;
      if (notices.has(key)) {
        throw Object.assign(new Error("duplicate key value"), {
          code: "23505",
        });
      }
      notices.set(key, { status: params[2], createdAt: params[4] });
      return { rows: [], rowCount: 1 };
    }
    if (text.startsWith("UPDATE")) {
      const conds = where(text, params as unknown[]);
      const key = `${conds.find((c) => c.col === "orderId")?.value}|${conds.find((c) => c.col === "kind")?.value}`;
      const row = notices.get(key);
      const match =
        row &&
        conds.every((c) =>
          c.col === "orderId" || c.col === "kind"
            ? true
            : c.op === "="
              ? row[c.col] === c.value
              : String(row[c.col]) < String(c.value),
        );
      if (!match) return { rows: [], rowCount: 0 };
      Object.assign(row, setPart(text, params as unknown[]));
      return { rows: [{ orderId: key.split("|")[0] }], rowCount: 1 };
    }
  }
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});
vi.mock("@/lib/admin/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/mobile/loyalty", () => ({
  onOrderPaid: vi.fn(async () => {}),
  onOrderReversed: vi.fn(async () => {}),
}));

const { notifyOrderPaid } = await import("@/lib/email/order-notices");
const { notifyReservationStatus, KARAOKE_FREE_PASSED_AT_BOOKING } =
  await import("@/lib/mobile/karaoke");
const { MAIL_BUDGET } = await import("@/lib/email/budget");

// ── Resend, by its documented idempotency rules ─────────────────────────
/**
 * What happens to ONE request, in order of arrival (default "normal"):
 *  - normal:              Resend answers by its rules at once
 *  - accept-then-timeout: Resend takes it (it will be delivered) but our 4 s
 *                         abort fires first; we see a TimeoutError
 *  - accept-and-hang:     the same, waiting for our real AbortSignal (4 s)
 *  - hang:                never reaches Resend; our real abort ends it (4 s)
 *  - lost:                never reaches Resend; we see a TimeoutError at once
 */
type Mode =
  "normal" | "accept-then-timeout" | "accept-and-hang" | "hang" | "lost";
let script: Mode[] = [];
let requests: { key: string | null; file: boolean; at: number }[] = [];
let inbox: {
  key: string | null;
  file: boolean;
  html: string;
  attachment: string;
}[] = [];
let processing: (() => void)[] = [];
const records = new Map<string, { body: string; done: boolean }>();
let t0 = 0;

function timeoutError() {
  return new DOMException(
    "The operation was aborted due to timeout",
    "TimeoutError",
  );
}
function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}
/** Resend finishes what it was still sending. */
function finishProcessing() {
  for (const f of processing.splice(0)) f();
}

beforeEach(() => {
  versionsReadMs = 0;
  notices.clear();
  records.clear();
  script = [];
  requests = [];
  inbox = [];
  processing = [];
  t0 = Date.now();
  process.env.RESEND_API_KEY = "re_test_key";
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      const key = headers["Idempotency-Key"] ?? null;
      const body = String(init.body);
      const parsed = JSON.parse(body) as {
        html: string;
        attachments?: { content: string }[];
      };
      const file =
        Array.isArray(parsed.attachments) && parsed.attachments.length > 0;
      requests.push({ key, file, at: Date.now() - t0 });
      const mode = script.shift() ?? "normal";
      const signal = init.signal as AbortSignal;
      const untilAbort = () =>
        new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      if (mode === "lost") throw timeoutError();
      if (mode === "hang") return untilAbort();
      if (key) {
        const rec = records.get(key);
        if (rec && rec.body !== body) {
          return json(409, {
            name: "invalid_idempotent_request",
            message:
              "This idempotency key has been used with this HTTP method and endpoint within the last 24 hours, but the request body was modified and doesn't match the original request.",
          });
        }
        if (rec && !rec.done) {
          return json(409, {
            name: "concurrent_idempotent_requests",
            message:
              "There is another request in progress with the same idempotency key.",
          });
        }
        if (rec) return json(200, { id: "re_first" }); // answered from its record
      }
      const rec = { body, done: false };
      if (key) records.set(key, rec);
      const deliver = () => {
        inbox.push({
          key,
          file,
          html: parsed.html,
          attachment: file
            ? Buffer.from(parsed.attachments![0].content, "base64").toString(
                "utf8",
              )
            : "",
        });
        rec.done = true;
      };
      if (mode === "accept-then-timeout") {
        processing.push(deliver);
        throw timeoutError();
      }
      if (mode === "accept-and-hang") {
        processing.push(deliver);
        return untilAbort();
      }
      deliver();
      return json(200, { id: "re_new" });
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.RESEND_API_KEY;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function order(withHashes = true): AdminOrder {
  return {
    id: "ord-0001",
    orderNo: 10001,
    customerName: "Ayşe Yılmaz",
    customerEmail: "ayse@example.com",
    shippingAddress: "Bağdat Cad. 1, Kadıköy",
    status: "paid",
    paidAt: "2026-10-21T10:01:00.000Z",
    items: [
      {
        productName: "Sirena Espresso Harmanı",
        qty: 2,
        unitPriceMinor: 50000,
        status: "pending",
      },
    ],
    refunds: [],
    subtotalMinor: 100000,
    discountMinor: 0,
    shippingMinor: 0,
    totalMinor: 100000,
    promoCode: "",
    channel: "web",
    kind: "shop",
    fulfillment: "shipping",
    createdAt: "2026-10-21T10:00:00.000Z",
    legalConsent: {
      acceptedAt: "2026-10-21T10:00:00.000Z",
      documents: [...CHECKOUT_CONSENT_DOCS],
      version: "21 Ekim 2026",
      ...(withHashes
        ? { textHashes: { [OBF]: obf.hash, [MSS]: mss.hash } }
        : {}),
    },
  } as unknown as AdminOrder;
}

const KEY = "order-ord-0001-paid";

// The modules the mail paths import on demand, loaded before the clock is
// faked: a cold load takes real time while the fake clock runs ahead.
beforeAll(async () => {
  await Promise.all([
    import("@/lib/legal/durable-copy-load"),
    import("@/lib/legal/consent-texts"),
    import("@/lib/admin/store"),
    import("@/lib/mobile/app-config"),
    import("@/lib/mobile/loyalty"),
    import("@/lib/mobile/karaoke-payment"),
  ]);
});

/**
 * Runs `p` on the fake clock until it settles: its value, and how long it
 * held its caller (ms of fake time, to the 50 ms step).
 */
async function timed<T>(p: Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  let done = false;
  let value!: T;
  void p.then((v) => {
    done = true;
    value = v;
  });
  while (!done) {
    await vi.advanceTimersByTimeAsync(50);
    if (Date.now() - start > 60_000) throw new Error("never settled");
  }
  return { value, ms: Date.now() - start };
}

describe("M1: a 409 from Resend is not a refusal", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  it("the first attempt with the copy times out while Resend still sends it: the retry's 409 concurrent sends nothing more", async () => {
    script = ["accept-then-timeout"]; // then: Resend's own rules
    const { value: outcome } = await timed(notifyOrderPaid(order()));
    finishProcessing(); // the slow first request completes at Resend
    expect(requests.map((r) => r.key)).toEqual([KEY, KEY]);
    expect(requests.map((r) => r.key)).not.toContain(`${KEY}-ek-yok`);
    expect(outcome).toBe("failed");
    expect(inbox).toHaveLength(1);
    expect(inbox[0].file).toBe(true);
  });

  it("a replay that builds the copy the first trigger could not: 409 invalid means the mail is out, nothing more goes", async () => {
    // Trigger 1: the versions read is slower than the copy's share of the
    // budget, so the mail goes without the file; Resend takes attempt 0 but
    // we never hear back, attempt 1 is lost on the way: `failed`.
    versionsReadMs = 3_000;
    script = ["accept-then-timeout", "lost"];
    const first = await timed(notifyOrderPaid(order()));
    finishProcessing();
    expect(first.value).toBe("failed");
    expect(notices.get("ord-0001|paid")?.status).toBe("failed");
    expect(inbox).toHaveLength(1); // the customer HAS the mail
    expect(inbox[0].file).toBe(false);
    // Trigger 2: the replayed bank return re-claims the failed row; the
    // copy builds now, so the body differs under the same key.
    versionsReadMs = 0;
    const second = await timed(notifyOrderPaid(order()));
    expect(requests.map((r) => r.key)).not.toContain(`${KEY}-ek-yok`);
    expect(second.value).toBe("sent");
    expect(notices.get("ord-0001|paid")?.status).toBe("sent");
    expect(inbox).toHaveLength(1);
  });

  it("control: the same replay with no copy either time is answered from the key's record", async () => {
    script = ["accept-then-timeout", "lost"];
    expect((await timed(notifyOrderPaid(order(false)))).value).toBe("failed");
    finishProcessing();
    expect((await timed(notifyOrderPaid(order(false)))).value).toBe("sent");
    expect(inbox).toHaveLength(1);
    expect(requests.map((r) => r.key)).toEqual([KEY, KEY, KEY]);
  });
});

describe("M2: how long the awaited confirmations hold their request", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  it("the paid mail: the copy's read never answers, Resend never answers", async () => {
    versionsReadMs = Infinity;
    script = ["hang", "hang"];
    const { ms } = await timed(notifyOrderPaid(order()));
    // The 9.5 s the mail always had, the copy's 1.5 s inside it.
    expect(ms).toBeLessThanOrEqual(MAIL_BUDGET.paid + 50);
    expect(requests.map((r) => r.file)).toEqual([false, false]);
  });

  it("the paid mail: a slow copy read inside its share, then Resend never answers", async () => {
    versionsReadMs = 1_400;
    script = ["hang", "hang"];
    const { ms } = await timed(notifyOrderPaid(order()));
    expect(ms).toBeLessThanOrEqual(MAIL_BUDGET.paid + 50);
    expect(requests.map((r) => r.file)).toEqual([true, true]);
  });

  it("the paid mail: slow copy, attempt 0 aborted while Resend sends it, 409 concurrent: one mail, no second key", async () => {
    versionsReadMs = 1_400;
    script = ["accept-and-hang", "normal", "hang", "hang"];
    const { ms } = await timed(notifyOrderPaid(order()));
    finishProcessing();
    expect(ms).toBeLessThanOrEqual(MAIL_BUDGET.paid + 50);
    expect(requests.map((r) => r.key)).toEqual([KEY, KEY]);
    expect(inbox).toHaveLength(1);
  });

  it("the paid mail: Resend refuses the file outright, the plain mail still fits the budget", async () => {
    versionsReadMs = 1_400;
    vi.mocked(fetch).mockImplementationOnce(async () =>
      json(422, { name: "validation_error", message: "Invalid attachment" }),
    );
    script = ["hang", "hang"];
    const { ms } = await timed(notifyOrderPaid(order()));
    expect(ms).toBeLessThanOrEqual(MAIL_BUDGET.paid + 50);
  });

  it("the karaoke confirmation: the copy's read never answers, Resend never answers", async () => {
    versionsReadMs = Infinity;
    script = ["hang", "hang"];
    const { ms } = await timed(notifyReservationStatus(karaokeBooking()));
    // One 4 s attempt as before, plus the copy's 1.5 s.
    expect(ms).toBeLessThanOrEqual(MAIL_BUDGET.karaoke + 50);
  });
});

function karaokeBooking(): KaraokeReservation {
  // Booked at 19:00 (Istanbul) for 20:00 the same evening under the 2-hour
  // rule: the last free moment (18:00) had passed when it was made.
  return {
    id: "krk-00042",
    customerEmail: "eda@example.com",
    customerName: "Eda",
    date: "2026-10-30",
    startHour: 20,
    hours: 1,
    guests: 4,
    status: "confirmed",
    priceMinor: 90000,
    discountMinor: 0,
    totalMinor: 90000,
    note: "",
    createdAt: "2026-10-30T16:00:00.000Z",
    updatedAt: "2026-10-30T16:01:00.000Z",
    paymentStatus: "paid",
    paidAt: "2026-10-30T16:01:00.000Z",
    paidMinor: 90000,
    channel: "web",
    freeCancelHours: 2,
    lateRefundPercent: 0,
    cancelDeadline: "2026-10-30T15:00:00.000Z",
    legalConsent: {
      acceptedAt: "2026-10-30T16:00:00.000Z",
      documents: [KARAOKE],
      version: "19 Ekim 2026",
      textHashes: { [KARAOKE]: krk.hash },
    },
  } as unknown as KaraokeReservation;
}

describe("M3: the karaoke copy's 'Son ücretsiz iptal' for a booking made after it", () => {
  it("says what the same confirmation mail says: the window had passed", async () => {
    expect(await notifyReservationStatus(karaokeBooking())).toBe(true);
    expect(inbox).toHaveLength(1);
    const mail = inbox[0];
    expect(mail.file).toBe(true);
    const flat = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const mailSays = /Son ücretsiz iptal: (.*?)\./
      .exec(flat(mail.html))?.[1]
      ?.trim();
    const fileSays = /Son ücretsiz iptal (.*?) Geç iptalde iade/
      .exec(flat(mail.attachment))?.[1]
      ?.trim();
    expect(mailSays).toBe(KARAOKE_FREE_PASSED_AT_BOOKING);
    expect(fileSays).toBe(
      "30 Ekim 2026, 18:00 (rezervasyon yapıldığında geçmişti; her iptal geç iptal sayılır)",
    );
  });
});

import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RESEND_WEBHOOK_TOLERANCE_S,
  signResendPayload,
  suppressionFrom,
  verifyResendSignature,
  webhookKey,
} from "@/lib/email/resend-webhook";

/**
 * Resend bounce and complaint suppression (docs/AUDIT.md, open since 8 Sep:
 * "bounce/şikâyet bastırma listesi"). The route verifies Svix's signature
 * over the raw body, records permanent bounces and spam complaints, and is
 * inert (503) until RESEND_WEBHOOK_SECRET is set.
 */

// A made-up signing secret in Resend's format: "whsec_" + base64.
const SECRET = `whsec_${Buffer.from("laffogato-test-signing-key-0001").toString("base64")}`;
const NOW_MS = Date.parse("2026-09-23T12:00:00.000Z");
const NOW_S = String(Math.floor(NOW_MS / 1000));

const bounced = {
  type: "email.bounced",
  created_at: "2026-09-23T11:59:58.000Z",
  data: {
    email_id: "56761188-7520-42d8-8898-ff6fc54ce618",
    to: ["Uye@Example.com"],
    subject: "Kampanya",
    bounce: {
      message: "mailbox does not exist",
      subType: "General",
      type: "Permanent",
    },
  },
};

describe("verifyResendSignature", () => {
  const raw = JSON.stringify(bounced);
  const good = {
    id: "msg_2abc",
    timestamp: NOW_S,
    signature: signResendPayload(SECRET, "msg_2abc", NOW_S, raw),
  };

  it("accepts the signature Resend computes over id.timestamp.body", () => {
    expect(verifyResendSignature(SECRET, good, raw, NOW_MS)).toEqual({
      ok: true,
    });
  });

  it("accepts any v1 entry while a secret is being rotated", () => {
    const rotated = { ...good, signature: `v1,AAAA ${good.signature}` };
    expect(verifyResendSignature(SECRET, rotated, raw, NOW_MS).ok).toBe(true);
  });

  it("refuses a body that is not the one signed, byte for byte", () => {
    const reserialised = JSON.stringify(bounced, null, 2);
    expect(verifyResendSignature(SECRET, good, reserialised, NOW_MS)).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  it("refuses another secret's signature", () => {
    const other = `whsec_${Buffer.from("someone-else").toString("base64")}`;
    expect(verifyResendSignature(other, good, raw, NOW_MS).ok).toBe(false);
  });

  it("refuses a replay outside the five-minute window", () => {
    const later = NOW_MS + (RESEND_WEBHOOK_TOLERANCE_S + 1) * 1000;
    expect(verifyResendSignature(SECRET, good, raw, later)).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  it("refuses missing headers", () => {
    expect(
      verifyResendSignature(SECRET, { ...good, signature: "" }, raw, NOW_MS),
    ).toEqual({ ok: false, reason: "missing_headers" });
  });

  it("reads the key from the base64 part of whsec_", () => {
    expect(webhookKey(SECRET)?.toString()).toBe(
      "laffogato-test-signing-key-0001",
    );
    expect(webhookKey("whsec_not base64!")).toBeNull();
  });
});

describe("suppressionFrom", () => {
  it("records a permanent bounce, lower-cased", () => {
    expect(suppressionFrom(bounced)).toEqual({
      reason: "bounced",
      emails: ["uye@example.com"],
      emailId: "56761188-7520-42d8-8898-ff6fc54ce618",
      detail: "Permanent / General",
    });
  });

  it("does not suppress a bounce that says it is transient", () => {
    const transient = {
      ...bounced,
      data: { ...bounced.data, bounce: { type: "Transient" } },
    };
    expect(suppressionFrom(transient)).toBeNull();
  });

  it("records a spam complaint", () => {
    expect(
      suppressionFrom({
        type: "email.complained",
        data: { email_id: "e1", to: ["a@b.co"] },
      }),
    ).toMatchObject({ reason: "complained", emails: ["a@b.co"] });
  });

  it("ignores every other event", () => {
    for (const type of ["email.delivered", "email.opened", "email.sent"]) {
      expect(suppressionFrom({ ...bounced, type }), type).toBeNull();
    }
  });
});

const recordSuppression = vi.fn(async () => 1);
vi.mock("@/lib/email/suppressions", () => ({ recordSuppression }));

const { POST } = await import("@/app/api/webhooks/resend/route");

function delivery(body: string, over: Record<string, string> = {}) {
  const id = "msg_2route";
  const timestamp = String(Math.floor(Date.now() / 1000));
  return new Request("https://laffogato.net/api/webhooks/resend", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signResendPayload(SECRET, id, timestamp, body),
      ...over,
    },
    body,
  });
}

describe("POST /api/webhooks/resend", () => {
  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    recordSuppression.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    vi.restoreAllMocks();
  });

  it("is inert until the secret is set: 503, nothing written", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const res = await POST(delivery(JSON.stringify(bounced)));
    expect(res.status).toBe(503);
    expect(recordSuppression).not.toHaveBeenCalled();
  });

  it("refuses a forged delivery with 401", async () => {
    const res = await POST(
      delivery(JSON.stringify(bounced), { "svix-signature": "v1,Zm9yZ2Vk" }),
    );
    expect(res.status).toBe(401);
    expect(recordSuppression).not.toHaveBeenCalled();
  });

  it("records a permanent bounce under the delivery's svix-id", async () => {
    const res = await POST(delivery(JSON.stringify(bounced)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      suppressed: 1,
      reason: "bounced",
    });
    expect(recordSuppression).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "bounced", emails: ["uye@example.com"] }),
      "msg_2route",
    );
  });

  it("answers 200 and writes nothing for an event that suppresses nothing", async () => {
    const res = await POST(
      delivery(JSON.stringify({ ...bounced, type: "email.delivered" })),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: "email.delivered" });
    expect(recordSuppression).not.toHaveBeenCalled();
  });

  it("answers 500 so Resend retries when the write fails", async () => {
    recordSuppression.mockRejectedValueOnce(new Error("connection reset"));
    const res = await POST(delivery(JSON.stringify(bounced)));
    expect(res.status).toBe(500);
  });

  it("never echoes or logs an address", async () => {
    recordSuppression.mockRejectedValueOnce(new Error("connection reset"));
    const res = await POST(delivery(JSON.stringify(bounced)));
    expect(JSON.stringify(await res.json())).not.toContain("@");
    const logged = JSON.stringify(
      (console.error as unknown as { mock: { calls: unknown[] } }).mock.calls,
    );
    expect(logged).not.toContain("example.com");
  });
});

describe("the suppression reaches the audience, in SQL", () => {
  const migration = readFileSync(
    "db/migrations/20260923230300_email_suppressions.sql",
    "utf8",
  );
  const statements = migration
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  it("never records itself in _migrations", () => {
    expect(statements).not.toContain("insert into public._migrations");
  });

  it("filters the campaign audience and the birthday greeting's mail flag", () => {
    expect(statements).toContain(
      "create or replace function public.campaign_email_audience(",
    );
    expect(statements).toContain(
      "create or replace function public.birthday_greeting_audience(",
    );
    expect(
      statements.match(/from public\.email_suppressions x/g) ?? [],
    ).toHaveLength(2);
  });

  it("is documented for the operator in .env.example", () => {
    expect(readFileSync(".env.example", "utf8")).toContain(
      "# RESEND_WEBHOOK_SECRET=",
    );
  });
});

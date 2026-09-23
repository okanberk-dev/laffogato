import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Who transactional mail says it is from, and what happens when it fails.
 *
 * Resend refuses any address whose domain is not verified on the account, and
 * that verification lives in DNS - outside this repository, changed by someone
 * adding a TXT record on a Tuesday. So the address is a settings field, and
 * these tests pin the precedence that makes the field worth having: the panel
 * beats the environment, and a database that is down never costs a member
 * their password-reset mail.
 */

const getPublicSettings = vi.fn();
vi.mock("@/lib/admin/store", () => ({ getPublicSettings }));

const ENV = { ...process.env };

async function load() {
  vi.resetModules();
  return import("@/lib/email/send");
}

beforeEach(() => {
  getPublicSettings.mockReset();
  getPublicSettings.mockResolvedValue({
    email: "info@laffogato.net",
    emailFromName: "",
    emailFromAddress: "",
    emailReplyTo: "",
  });
  delete process.env.EMAIL_FROM;
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  process.env = { ...ENV };
  vi.unstubAllGlobals();
});

describe("formatFrom", () => {
  it("leaves a plain display name as a bare atom", async () => {
    const { formatFrom } = await load();
    expect(formatFrom("L'Affogato", "siparis@laffogato.net")).toBe(
      "L'Affogato <siparis@laffogato.net>",
    );
  });

  it("quotes a name carrying a comma, which would otherwise read as a second recipient", async () => {
    const { formatFrom } = await load();
    expect(formatFrom("L'Affogato, Tuzla", "siparis@laffogato.net")).toBe(
      '"L\'Affogato, Tuzla" <siparis@laffogato.net>',
    );
  });

  it("quotes a Turkish name rather than emitting a bare non-ASCII atom", async () => {
    const { formatFrom } = await load();
    expect(formatFrom("L'Affogato Köşk", "a@b.com")).toBe(
      '"L\'Affogato Köşk" <a@b.com>',
    );
  });

  it("folds CR and LF away so the name cannot inject a header", async () => {
    const { formatFrom } = await load();
    const out = formatFrom("Evil\r\nBcc: victim@example.com", "a@b.com");
    expect(out).not.toMatch(/[\r\n]/);
    expect(out).toContain("<a@b.com>");
  });

  it("drops the angle brackets entirely when there is no name to show", async () => {
    const { formatFrom } = await load();
    expect(formatFrom("  ", "a@b.com")).toBe("a@b.com");
  });
});

describe("emailIdentity", () => {
  it("uses the panel's address, so a domain move needs no deploy", async () => {
    getPublicSettings.mockResolvedValue({
      email: "info@laffogato.net",
      emailFromName: "L'Affogato",
      emailFromAddress: "siparis@laffogato.net",
      emailReplyTo: "merhaba@laffogato.net",
    });
    process.env.EMAIL_FROM = "Eski <eski@baska.com>";
    const { emailIdentity } = await load();
    const id = await emailIdentity();
    expect(id.from).toBe("L'Affogato <siparis@laffogato.net>");
    expect(id.replyTo).toBe("merhaba@laffogato.net");
  });

  it("falls back to EMAIL_FROM when the panel field is empty", async () => {
    process.env.EMAIL_FROM = "L'Affogato <no-reply@laffogato.net>";
    const { emailIdentity } = await load();
    expect((await emailIdentity()).from).toBe(
      "L'Affogato <no-reply@laffogato.net>",
    );
  });

  it("falls back to the verified default when nothing is set anywhere", async () => {
    const { emailIdentity, DEFAULT_FROM_ADDRESS } = await load();
    expect((await emailIdentity()).from).toContain(DEFAULT_FROM_ADDRESS);
  });

  it("answers the cafe's own address when no reply-to is configured", async () => {
    const { emailIdentity } = await load();
    expect((await emailIdentity()).replyTo).toBe("info@laffogato.net");
  });

  it("still produces a sender when the settings read throws", async () => {
    // A member asking for a password reset while the database is unreachable
    // must not lose the mail over a cosmetic lookup.
    getPublicSettings.mockRejectedValue(new Error("db down"));
    const { emailIdentity, DEFAULT_FROM_ADDRESS } = await load();
    const id = await emailIdentity();
    expect(id.from).toContain(DEFAULT_FROM_ADDRESS);
    expect(id.replyTo).toBe("");
  });

  it("reports the provider as absent until RESEND_API_KEY is set", async () => {
    const { emailIdentity } = await load();
    expect((await emailIdentity()).hasProvider).toBe(false);
    process.env.RESEND_API_KEY = "re_test";
    const again = await load();
    expect((await again.emailIdentity()).hasProvider).toBe(true);
  });
});

describe("sendTestEmail", () => {
  it("says so plainly rather than pretending, when no key is configured", async () => {
    const { sendTestEmail } = await load();
    const result = await sendTestEmail("okan@example.com");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("RESEND_API_KEY");
  });

  it("sends from the configured identity, with a reply-to and no unsubscribe header", async () => {
    getPublicSettings.mockResolvedValue({
      email: "info@laffogato.net",
      emailFromName: "L'Affogato",
      emailFromAddress: "siparis@laffogato.net",
      emailReplyTo: "",
    });
    process.env.RESEND_API_KEY = "re_test";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { sendTestEmail } = await load();
    expect((await sendTestEmail("okan@example.com")).ok).toBe(true);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.from).toBe("L'Affogato <siparis@laffogato.net>");
    expect(body.reply_to).toBe("info@laffogato.net");
    // Transactional mail is not commercial; offering to unsubscribe from a
    // password reset is a lie the recipient can act on.
    expect(body.headers).toBeUndefined();
  });

  it("hands back what Resend actually said, which is the only place it exists", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: "The laffogato.net domain is not verified.",
          }),
          { status: 403 },
        ),
      ),
    );
    const { sendTestEmail } = await load();
    const result = await sendTestEmail("okan@example.com");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(
      "The laffogato.net domain is not verified.",
    );
  });

  it("reports a network failure instead of throwing into the action", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const { sendTestEmail } = await load();
    const result = await sendTestEmail("okan@example.com");
    expect(result.ok).toBe(false);
  });
});

describe("order notices", () => {
  function stubResend() {
    process.env.RESEND_API_KEY = "re_test";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("posts the tracking mail with the provider idempotency key and no way out", async () => {
    const fetchMock = stubResend();
    const { sendOrderShippedEmail } = await load();
    const result = await sendOrderShippedEmail(
      {
        to: "eda@example.com",
        customerName: "Eda",
        orderNo: 1042,
        trackingNumber: "YK123456789TR",
        carrier: "Yurtiçi Kargo",
        // Not https: never printed into an href.
        trackingUrl: "http://kargo.example/t/1",
      },
      "order-ord-1-shipped:abc",
    );
    expect(result.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Idempotency-Key"]).toBe("order-ord-1-shipped:abc");
    const body = JSON.parse(init.body as string);
    expect(body.subject).toBe("L'Affogato - Siparişiniz kargoya verildi (#1042)");
    expect(body.html).toContain("YK123456789TR");
    expect(body.html).not.toContain("kargo.example");
    expect(body.text).toContain("/uye/hesap/siparislerim/1042");
    // Transactional: no List-Unsubscribe pair.
    expect(body.headers).toBeUndefined();
  });

  it("hands the provider's refusal back, so the notice can release its claim", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "rate limited" }), {
          status: 429,
        }),
      ),
    );
    const { sendOrderRefundedEmail } = await load();
    const result = await sendOrderRefundedEmail({
      to: "eda@example.com",
      customerName: "",
      orderNo: 7,
      refundMinor: 10_000,
      refundedTotalMinor: 10_000,
      totalMinor: 45_000,
      viaCard: true,
    });
    expect(result).toEqual({ ok: false, error: "rate limited" });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Whether mail can actually leave.
 *
 * A configured key and an unverified sending DOMAIN are indistinguishable from
 * inside the process - both look like "Resend is wired up" - and only the
 * second is what stops every message today. The dashboard banner is the one
 * place that difference is visible, so what it decides is pinned here.
 */

const emailIdentity = vi.fn();
vi.mock("@/lib/email/send", () => ({ emailIdentity }));

const ENV = { ...process.env };

async function load() {
  vi.resetModules();
  return import("@/lib/email/health");
}

function domainsResponse(entries: { name: string; status: string }[]) {
  return new Response(JSON.stringify({ data: entries }), { status: 200 });
}

beforeEach(() => {
  emailIdentity.mockReset();
  emailIdentity.mockResolvedValue({
    from: "L'Affogato <siparis@laffogato.net>",
    replyTo: "",
    hasProvider: true,
  });
  process.env.RESEND_API_KEY = "re_test";
});

afterEach(() => {
  process.env = { ...ENV };
  vi.unstubAllGlobals();
});

describe("emailHealth", () => {
  it("is happy only when Resend says the sender's domain is verified", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        domainsResponse([{ name: "laffogato.net", status: "verified" }]),
      ),
    );
    const { emailHealth } = await load();
    const health = await emailHealth();
    expect(health.ok).toBe(true);
    expect(health.domain).toBe("laffogato.net");
    expect(health.message).toBe("");
  });

  it("raises the alarm on a domain whose DNS never verified", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        domainsResponse([{ name: "laffogato.net", status: "failed" }]),
      ),
    );
    const { emailHealth } = await load();
    const health = await emailHealth();
    expect(health.ok).toBe(false);
    expect(health.status).toBe("failed");
    expect(health.message).toContain("DKIM");
  });

  it("treats a domain still waiting on DNS as unable to send, not as fine", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        domainsResponse([{ name: "laffogato.net", status: "pending" }]),
      ),
    );
    const { emailHealth } = await load();
    expect((await emailHealth()).ok).toBe(false);
  });

  it("says so when the sender's domain was never added to the account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        domainsResponse([{ name: "baska.com", status: "verified" }]),
      ),
    );
    const { emailHealth } = await load();
    const health = await emailHealth();
    expect(health.status).toBe("absent");
    expect(health.ok).toBe(false);
  });

  it("does not cry wolf when Resend itself is unreachable", async () => {
    // A render that cannot reach Resend proves nothing about the domain, and a
    // red banner over a network blip would train the operator to ignore it.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const { emailHealth } = await load();
    const health = await emailHealth();
    expect(health.status).toBe("unknown");
    expect(health.ok).toBe(true);
  });

  it("reports the missing key without asking Resend anything", async () => {
    delete process.env.RESEND_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { emailHealth } = await load();
    const health = await emailHealth();
    expect(health.hasProvider).toBe(false);
    expect(health.ok).toBe(false);
    expect(health.message).toContain("RESEND_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks once and reuses the answer, so an admin page render costs no round trip", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      domainsResponse([{ name: "laffogato.net", status: "verified" }]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { emailHealth } = await load();
    await emailHealth();
    await emailHealth();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks again once the sender has been changed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      domainsResponse([{ name: "laffogato.net", status: "verified" }]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { emailHealth, forgetEmailHealth } = await load();
    await emailHealth();
    forgetEmailHealth();
    await emailHealth();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reads the domain out of a `Name <address>` sender", async () => {
    emailIdentity.mockResolvedValue({
      from: "L'Affogato Köşk <Siparis@LAFFOGATO.net>",
      replyTo: "",
      hasProvider: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        domainsResponse([{ name: "laffogato.net", status: "verified" }]),
      ),
    );
    const { emailHealth } = await load();
    expect((await emailHealth()).domain).toBe("laffogato.net");
  });
});

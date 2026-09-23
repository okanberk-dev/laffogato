import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The footer form used to put whatever address was typed straight on the
 * list; the unsubscribe page spent its token on arrival, so mail scanners
 * unsubscribed people; the panel could switch a withdrawn subscriber back on
 * with their old consent. 6563 puts the burden of proving consent on us.
 */
const subscribeNewsletter = vi.fn();
const sendNewsletterConfirmEmail = vi.fn(async () => true);
const reserveLoginAttempt = vi.fn(async () => ({
  blocked: false,
  remaining: 2,
  retryAfterSeconds: 0,
}));

vi.mock("@/lib/newsletter/store", () => ({
  subscribeNewsletter,
  confirmNewsletterByToken: vi.fn(),
  unsubscribeByToken: vi.fn(),
}));
vi.mock("@/lib/customer/unsubscribe", () => ({
  unsubscribeCustomerByToken: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({ sendNewsletterConfirmEmail }));
vi.mock("@/lib/admin/rate-limit", () => ({
  clientIp: async () => "10.0.0.9",
  reserveLoginAttempt,
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { subscribeNewsletterAction } = await import("@/app/newsletter/actions");

function form(email: string, consent = true): FormData {
  const fd = new FormData();
  fd.set("email", email);
  if (consent) fd.set("consent", "on");
  return fd;
}

beforeEach(() => {
  subscribeNewsletter.mockReset();
  sendNewsletterConfirmEmail.mockClear();
});

describe("footer signup", () => {
  it("mails a confirmation link instead of subscribing", async () => {
    subscribeNewsletter.mockResolvedValue({
      ok: true,
      already: false,
      pending: true,
      confirmToken: "tok123",
    });
    const res = await subscribeNewsletterAction({}, form("ayse@example.com"));
    expect(res.ok).toBe(true);
    expect(subscribeNewsletter.mock.calls[0][4]).toBeUndefined(); // not confirmed
    expect(sendNewsletterConfirmEmail).toHaveBeenCalledWith(
      "ayse@example.com",
      expect.stringContaining("/bulten/onay?token=tok123"),
    );
  });

  it("answers an already-subscribed address the same way, without mailing", async () => {
    subscribeNewsletter.mockResolvedValue({ ok: true, already: true });
    const pending = await subscribeNewsletterAction({}, form("a@b.co"));
    subscribeNewsletter.mockResolvedValue({
      ok: true,
      already: false,
      pending: true,
      confirmToken: "t",
    });
    const fresh = await subscribeNewsletterAction({}, form("c@d.co"));
    expect(pending.message).toBe(fresh.message);
    expect(sendNewsletterConfirmEmail).toHaveBeenCalledTimes(1);
  });

  it("is rate limited per address", async () => {
    reserveLoginAttempt.mockResolvedValueOnce({
      blocked: true,
      remaining: 0,
      retryAfterSeconds: 900,
    });
    const res = await subscribeNewsletterAction({}, form("a@b.co"));
    expect(res.error).toMatch(/çok fazla istek/i);
    expect(subscribeNewsletter).not.toHaveBeenCalled();
  });
});

describe("pages that a link opens only show a button", () => {
  it("the unsubscribe page does not spend the token on arrival", () => {
    const page = readFileSync("src/app/bulten/cikis/page.tsx", "utf8");
    expect(page).not.toContain("unsubscribeByToken(");
    expect(page).toContain("action={unsubscribeNewsletterAction}");
  });

  it("the confirmation page does not subscribe on arrival", () => {
    const page = readFileSync("src/app/bulten/onay/page.tsx", "utf8");
    expect(page).not.toContain("confirmNewsletterByToken(");
    expect(page).toContain("action={confirmNewsletterAction}");
  });
});

describe("the panel", () => {
  it("can take a subscriber off the list but not put one back", () => {
    const actions = readFileSync("src/app/admin/bulten/actions.ts", "utf8");
    expect(actions).toContain("deactivateNewsletterSubscriber(id)");
    expect(actions).not.toMatch(
      /isActive:\s*true|setNewsletterSubscriberActive/,
    );
    const store = readFileSync("src/lib/newsletter/store.ts", "utf8");
    expect(store).not.toContain(
      "export async function setNewsletterSubscriberActive",
    );
  });
});

describe("account flows", () => {
  it("subscribe on the spot only for a proven address", () => {
    const uye = readFileSync("src/app/uye/actions.ts", "utf8");
    expect(uye).toContain("{ confirmed: false }");
    expect(uye).toContain("{ confirmed: current.emailVerified }");
    expect(readFileSync("src/lib/mobile/me.ts", "utf8")).toContain(
      "{ confirmed: customer.emailVerified }",
    );
    // …and a pending request becomes a subscription when the address is.
    expect(readFileSync("src/lib/customer/store.ts", "utf8")).toContain(
      "await activatePendingNewsletter(customer.email);",
    );
    expect(
      readFileSync("src/lib/customer/supabase-bridge.ts", "utf8"),
    ).toContain("await activatePendingNewsletter(email);");
  });
});

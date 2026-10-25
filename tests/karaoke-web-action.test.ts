import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONSENT_COOKIE, CONSENT_VERSION } from "@/lib/consent/cookie";

/**
 * The web `/karaoke` form (operator, 16 Eki 2026): paid online, open to
 * guests without an account, and never without the three separate boxes.
 * `bookKaraoke` (the shared library both surfaces call) is scripted here; its
 * own rules are tests/db-integration-karaoke-prepay.test.ts.
 */

const h = vi.hoisted(() => ({
  bookKaraoke: vi.fn(),
  customer: null as null | Record<string, unknown>,
  prepay: true,
  cookies: [] as Array<Record<string, unknown>>,
  /** The request's cookies, by name: what `cookies().get` reads. */
  jar: {} as Record<string, string>,
  redirected: null as string | null,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "Mozilla/5.0 test" }),
  cookies: async () => ({
    set: (c: Record<string, unknown>) => h.cookies.push(c),
    get: (name: string) =>
      name in h.jar ? { name, value: h.jar[name] } : undefined,
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    h.redirected = to;
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/lib/admin/rate-limit", () => ({ clientIp: async () => "10.1.2.3" }));
vi.mock("@/lib/admin/store", () => ({
  getSettings: async () => ({ karaokePrepay: h.prepay }),
}));
vi.mock("@/lib/customer/auth", () => ({
  getActiveCustomer: async () => h.customer,
}));
vi.mock("@/lib/db/health", () => ({ isDbUnreachable: () => false }));
vi.mock("@/lib/legal/store", () => ({
  karaokeConsentVersion: async () => "16 Ekim 2026",
}));
vi.mock("@/lib/mobile/karaoke-payment", () => ({ bookKaraoke: h.bookKaraoke }));

process.env.KARAOKE_LINK_SECRET = "s".repeat(40);

const { bookKaraokeAction } = await import("@/app/karaoke/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const SLOT = {
  date: "2026-10-30",
  startHour: "20",
  hours: "2",
  guests: "6",
  note: "",
};
const TICKS = {
  consentPreInfo: "on",
  consentContract: "on",
  consentKvkk: "on",
};
const MEMBER = {
  ...SLOT,
  ...TICKS,
  contactName: "Eda Mancuso",
  // A member's address is the account's: whatever the form says is ignored.
  contactEmail: "baskasi@example.com",
  contactPhone: "0532 123 45 67",
};
const GUEST = {
  ...SLOT,
  ...TICKS,
  guestFirstName: "Ada",
  guestLastName: "Lovelace",
  contactEmail: "Ada@Example.com",
  contactPhone: "+90 555 111 22 33",
};

function held(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    reservation: {
      id: "krk-00042",
      date: "2026-10-30",
      startHour: 20,
      hours: 2,
      guests: 6,
      paymentStatus: "pending",
      customerEmail: "eda@ornek.com",
      contactEmail: "eda@ornek.com",
      guest: false,
      totalMinor: 150000,
      ...overrides,
    },
    payment: {
      provider: "paynkolay",
      redirectUrl: "https://laffogato.net/odeme/paynkolay?d=abc&s=def",
      expiresAt: "2026-10-16T12:00:00.000Z",
    },
  };
}

async function submit(fields: Record<string, string>) {
  try {
    return await bookKaraokeAction({}, form(fields));
  } catch (err) {
    if (err instanceof Error && err.message === "NEXT_REDIRECT") return null;
    throw err;
  }
}

beforeEach(() => {
  h.bookKaraoke.mockReset();
  h.customer = {
    id: "cus-1",
    email: "eda@ornek.com",
    name: "Eda Mancuso",
    phone: "",
    emailVerified: true,
  };
  h.prepay = true;
  h.cookies.length = 0;
  h.jar = {};
  h.redirected = null;
});

describe("a member's paid booking", () => {
  it("sends the browser straight to the card page", async () => {
    h.bookKaraoke.mockResolvedValue(held());
    expect(await submit(MEMBER)).toBeNull();
    expect(h.redirected).toBe(
      "https://laffogato.net/odeme/paynkolay?d=abc&s=def",
    );
  });

  it("records the three boxes, the document revision, IP and browser", async () => {
    h.bookKaraoke.mockResolvedValue(held());
    await submit(MEMBER);
    const [customer, , opts] = h.bookKaraoke.mock.calls[0]!;
    expect(customer).toBe(h.customer);
    expect(opts).toMatchObject({
      channel: "web",
      prepay: true,
      buyerIp: "10.1.2.3",
      contact: {
        name: "Eda Mancuso",
        email: "eda@ornek.com",
        phone: "+905321234567",
      },
      legalConsent: {
        documents: ["karaoke-odasi-rezervasyon"],
        version: "16 Ekim 2026",
        confirmations: [
          "on-bilgilendirme",
          "hizmet-sozlesmesi",
          "kvkk-aydinlatma",
        ],
        surface: "web",
        ip: "10.1.2.3",
        userAgent: "Mozilla/5.0 test",
      },
    });
  });

  for (const box of ["consentPreInfo", "consentContract"] as const) {
    it(`refuses without ${box}, before anything is written`, async () => {
      const { [box]: _gone, ...rest } = MEMBER;
      void _gone;
      const state = await submit(rest);
      expect(state?.error).toMatch(/Ön Bilgilendirme|Sözleşme/);
      expect(h.bookKaraoke).not.toHaveBeenCalled();
    });
  }

  it("refuses without the privacy-notice acknowledgement", async () => {
    const { consentKvkk: _k, ...rest } = MEMBER;
    void _k;
    const state = await submit(rest);
    expect(state?.error).toMatch(/Aydınlatma/);
    expect(h.bookKaraoke).not.toHaveBeenCalled();
  });

  it("refuses an unverified member", async () => {
    h.customer = { ...h.customer, emailVerified: false };
    const state = await submit(MEMBER);
    expect(state?.error).toMatch(/doğrula/);
    expect(h.bookKaraoke).not.toHaveBeenCalled();
  });

  it("a zero total is settled already: straight to the booking in the account", async () => {
    h.bookKaraoke.mockResolvedValue({
      ...held({ paymentStatus: "paid" }),
      payment: null,
    });
    await submit(MEMBER);
    expect(h.redirected).toBe("/uye/hesap/karaoke/krk-00042?odeme=basarili");
  });

  it("echoes the cancellation rule the form printed to the library", async () => {
    h.bookKaraoke.mockResolvedValue(held());
    await submit({
      ...MEMBER,
      expectedFreeCancelHours: "2",
      expectedLateRefundPercent: "0",
    });
    const [, input] = h.bookKaraoke.mock.calls[0]!;
    expect(input).toMatchObject({
      expectedCancelPolicy: { freeCancelHours: 2, lateRefundPercent: 0 },
    });
  });

  it("a page from before the echo sends none, and nothing is compared", async () => {
    h.bookKaraoke.mockResolvedValue(held());
    await submit(MEMBER);
    const [, input] = h.bookKaraoke.mock.calls[0]!;
    expect(input).not.toHaveProperty("expectedCancelPolicy");
  });

  it("the form echoes the rule it prints", async () => {
    // While the box prints the default policy's two sentences, the hidden
    // pair must be the default's numbers; a page printing another rule
    // echoes that one (a mismatch would refuse every booking, or bind a
    // customer to a rule they did not read).
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      "src/components/laffogato/karaoke-booking.tsx",
      "utf8",
    );
    if (src.includes("{KARAOKE_REFUND_RULE}")) {
      expect(src).toMatch(
        /name="expectedFreeCancelHours"\s+value=\{DEFAULT_KARAOKE_CANCEL_POLICY\.freeCancelHours\}/,
      );
      expect(src).toMatch(
        /name="expectedLateRefundPercent"\s+value=\{DEFAULT_KARAOKE_CANCEL_POLICY\.lateRefundPercent\}/,
      );
    } else {
      expect(src).not.toContain(
        "DEFAULT_KARAOKE_CANCEL_POLICY.freeCancelHours",
      );
    }
  });

  it("passes the refusal through as the form's error", async () => {
    h.bookKaraoke.mockResolvedValue({
      ok: false,
      status: 409,
      error: "slot_taken",
      message: "Seçtiğin saatler dolu. Başka bir saat dene.",
    });
    expect((await submit(MEMBER))?.error).toBe(
      "Seçtiğin saatler dolu. Başka bir saat dene.",
    );
    expect(h.redirected).toBeNull();
  });
});

/** The banner's cookie, as the browser sends it. */
function consentCookie(marketing: boolean, version = CONSENT_VERSION): string {
  return encodeURIComponent(
    JSON.stringify({
      version,
      decidedAt: "2026-10-25T10:00:00.000Z",
      preferences: false,
      analytics: false,
      marketing,
    }),
  );
}

describe("the Meta Pixel's InitiateCheckout (25 Ekim 2026)", () => {
  it("hands the card page's address back, instead of redirecting, to a visitor who consented", async () => {
    h.jar[CONSENT_COOKIE] = consentCookie(true);
    h.bookKaraoke.mockResolvedValue(held());
    const state = await submit(MEMBER);
    expect(h.redirected).toBeNull();
    expect(state).toEqual({
      checkout: {
        id: "krk-00042",
        valueMinor: 150000,
        hours: 2,
        continueTo: "https://laffogato.net/odeme/paynkolay?d=abc&s=def",
      },
    });
  });

  it("still remembers a guest's booking for the bank's return", async () => {
    h.customer = null;
    h.jar[CONSENT_COOKIE] = consentCookie(true);
    h.bookKaraoke.mockResolvedValue(held({ guest: true }));
    const state = await submit(GUEST);
    expect(state?.checkout?.id).toBe("krk-00042");
    expect(h.cookies).toHaveLength(1);
    expect(h.cookies[0]).toMatchObject({ name: "laffogato_karaoke_link" });
  });

  it("redirects exactly as before without a recorded choice", async () => {
    h.bookKaraoke.mockResolvedValue(held());
    expect(await submit(MEMBER)).toBeNull();
    expect(h.redirected).toBe(
      "https://laffogato.net/odeme/paynkolay?d=abc&s=def",
    );
  });

  it("redirects for a visitor who refused marketing", async () => {
    h.jar[CONSENT_COOKIE] = consentCookie(false);
    h.bookKaraoke.mockResolvedValue(held());
    expect(await submit(MEMBER)).toBeNull();
    expect(h.redirected).toBe(
      "https://laffogato.net/odeme/paynkolay?d=abc&s=def",
    );
  });

  it("redirects when the yes was recorded under another version of the panel", async () => {
    h.jar[CONSENT_COOKIE] = consentCookie(true, CONSENT_VERSION - 1);
    h.bookKaraoke.mockResolvedValue(held());
    expect(await submit(MEMBER)).toBeNull();
    expect(h.redirected).toBe(
      "https://laffogato.net/odeme/paynkolay?d=abc&s=def",
    );
  });

  it("a zero total has no checkout to report: straight to the booking", async () => {
    h.jar[CONSENT_COOKIE] = consentCookie(true);
    h.bookKaraoke.mockResolvedValue({
      ...held({ paymentStatus: "paid" }),
      payment: null,
    });
    expect(await submit(MEMBER)).toBeNull();
    expect(h.redirected).toBe("/uye/hesap/karaoke/krk-00042?odeme=basarili");
  });

  it("a refusal is the form's error either way", async () => {
    h.jar[CONSENT_COOKIE] = consentCookie(true);
    h.bookKaraoke.mockResolvedValue({
      ok: false,
      status: 409,
      error: "slot_taken",
      message: "Seçtiğin saatler dolu. Başka bir saat dene.",
    });
    expect(await submit(MEMBER)).toEqual({
      error: "Seçtiğin saatler dolu. Başka bir saat dene.",
    });
  });
});

describe("a guest booking (no account)", () => {
  beforeEach(() => {
    h.customer = null;
  });

  it("books with the typed contact and no account, then goes to the card page", async () => {
    h.bookKaraoke.mockResolvedValue(
      held({
        guest: true,
        customerEmail: "ada@example.com",
        contactEmail: "ada@example.com",
      }),
    );
    await submit(GUEST);
    const [customer, , opts] = h.bookKaraoke.mock.calls[0]!;
    expect(customer).toBeNull();
    expect(opts.contact).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+905551112233",
    });
    expect(h.redirected).toContain("/odeme/paynkolay");
  });

  it("leaves the booking's own link in an httpOnly cookie scoped to its page", async () => {
    h.bookKaraoke.mockResolvedValue(
      held({
        guest: true,
        customerEmail: "ada@example.com",
        contactEmail: "ada@example.com",
      }),
    );
    await submit(GUEST);
    expect(h.cookies).toHaveLength(1);
    expect(h.cookies[0]).toMatchObject({
      name: "laffogato_karaoke_link",
      httpOnly: true,
      sameSite: "lax",
      path: "/rezervasyon",
    });
    expect(String(h.cookies[0]!.value)).toMatch(/^krk-00042\.\d+\.[\w-]{43}$/);
  });

  it("asks for a first and a last name", async () => {
    const state = await submit({ ...GUEST, guestLastName: "" });
    expect(state?.error).toMatch(/soyad/i);
    expect(h.bookKaraoke).not.toHaveBeenCalled();
  });

  it("validates the phone and the address on the server", async () => {
    expect((await submit({ ...GUEST, contactPhone: "123" }))?.error).toMatch(
      /cep telefonu/,
    );
    expect((await submit({ ...GUEST, contactEmail: "ada" }))?.error).toMatch(
      /e-posta/,
    );
    expect(h.bookKaraoke).not.toHaveBeenCalled();
  });

  it("is closed while prepayment is switched off", async () => {
    h.prepay = false;
    const state = await submit(GUEST);
    expect(state?.error).toMatch(/Üye olmadan/);
    expect(h.bookKaraoke).not.toHaveBeenCalled();
  });
});

describe("prepayment switched off", () => {
  it("takes the old request for a member, paid at the venue, with no consent record", async () => {
    h.prepay = false;
    h.bookKaraoke.mockResolvedValue({
      ...held({ paymentStatus: "none" }),
      payment: null,
    });
    const state = await submit({
      ...SLOT,
      contactName: "Eda Mancuso",
      contactPhone: "05321234567",
      consentKvkk: "on",
    });
    expect(state?.booked).toMatchObject({ date: "2026-10-30", startHour: 20 });
    expect(h.bookKaraoke.mock.calls[0]![2]).toMatchObject({
      prepay: false,
      legalConsent: undefined,
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The mail footers say what Ayarlar says (admin audit SYS-04): the hours,
 * the phone and the address are `[FIELD]`s filled from the settings on every
 * send path, with the bundled values when the settings cannot be read. They
 * were literals in 23 templates and the text signature.
 */

const getPublicSettings = vi.fn();
vi.mock("@/lib/admin/store", () => ({ getPublicSettings }));

import { renderEmail } from "@/lib/email/render";
import { EMAIL_TEMPLATES } from "@/lib/email/templates.generated";
import { EMAIL_TEXT } from "@/lib/email/text";
import { DEFAULT_VENUE_VARS, loadVenueVars } from "@/lib/email/venue";

const ENV = { ...process.env };

const WINTER = Object.fromEntries(
  ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [
    d,
    { open: "10:00", close: "00:00", closed: false },
  ]),
);

const PANEL = {
  phone: "+90 216 111 22 33",
  email: "info@laffogato.net",
  address: "Yeni Sok. No: 5 (Postanenin karşısı), 34940 Tuzla / İstanbul",
  weeklyHours: WINTER,
  emailFromName: "",
  emailFromAddress: "",
  emailReplyTo: "",
};

beforeEach(() => {
  getPublicSettings.mockReset();
  getPublicSettings.mockResolvedValue(PANEL);
});

afterEach(() => {
  process.env = { ...ENV };
  vi.unstubAllGlobals();
});

describe("no template carries the venue's facts as literals", () => {
  const LITERALS = [
    "09:00 - 02:00",
    "+90 536 429 09 19",
    "+905364290919",
    "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1",
  ];

  it.each(Object.keys(EMAIL_TEMPLATES))("%s", (name) => {
    const html = EMAIL_TEMPLATES[name as keyof typeof EMAIL_TEMPLATES].html;
    const text = EMAIL_TEXT[name as keyof typeof EMAIL_TEXT];
    for (const literal of LITERALS) {
      expect(html, literal).not.toContain(literal);
      expect(text, literal).not.toContain(literal);
    }
  });

  it("every customer template has the footer fields", () => {
    for (const [name, t] of Object.entries(EMAIL_TEMPLATES)) {
      if (name === "operasyon-bildirim") continue;
      expect(t.html, name).toContain("[KOSK_SAAT]");
      expect(t.html, name).toContain('href="tel:[TELEFON_TEL]"');
      expect(t.html, name).toContain("[KOSK_ADRES]");
    }
  });
});

describe("no mail offers to hold a table", () => {
  // Since 17 Oct 2026 only the karaoke room is booked; the birthday mail
  // still said "Kalabalık geliyorsanız ... masanızı ayıralım".
  it.each(Object.keys(EMAIL_TEMPLATES))("%s", (name) => {
    const html = EMAIL_TEMPLATES[name as keyof typeof EMAIL_TEMPLATES].html;
    const text = EMAIL_TEXT[name as keyof typeof EMAIL_TEXT];
    for (const part of [html, text]) {
      expect(part).not.toMatch(/masa(n[ıi]z[ıi])? ay[ıi]r|masa rezervasyon/i);
    }
  });
});

describe("venue vars", () => {
  it("default to the bundled values, so a render without settings is whole", () => {
    expect(DEFAULT_VENUE_VARS).toEqual({
      KOSK_SAAT: "Her gün 09:00 - 02:00",
      TELEFON: "+90 536 429 09 19",
      TELEFON_TEL: "+905364290919",
      KOSK_ADRES:
        "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1, 34940 Tuzla / İstanbul",
    });
    const r = renderEmail("hos-geldin", {
      vars: { AD: "Ada" },
      text: EMAIL_TEXT["hos-geldin"],
    });
    expect(r.html).toContain("Her gün 09:00 - 02:00");
    expect(r.html).toContain('href="tel:+905364290919"');
    expect(r.text).toContain("Her gün 09:00 - 02:00 · +90 536 429 09 19");
  });

  it("come from Ayarlar when the settings can be read", async () => {
    await expect(loadVenueVars()).resolves.toEqual({
      KOSK_SAAT: "Her gün 10:00 - 00:00",
      TELEFON: "+90 216 111 22 33",
      TELEFON_TEL: "+902161112233",
      KOSK_ADRES: "Yeni Sok. No: 5, 34940 Tuzla / İstanbul",
    });
  });

  it("keep the bundled footer when the settings read fails", async () => {
    getPublicSettings.mockRejectedValue(new Error("db down"));
    await expect(loadVenueVars()).resolves.toEqual(DEFAULT_VENUE_VARS);
  });

  it("fall back per field for a blank phone", async () => {
    getPublicSettings.mockResolvedValue({ ...PANEL, phone: "" });
    const v = await loadVenueVars();
    expect(v.TELEFON).toBe("+90 536 429 09 19");
    expect(v.TELEFON_TEL).toBe("+905364290919");
  });
});

describe("a sent mail", () => {
  it("carries the panel's hours, phone and address in both halves", async () => {
    process.env.RESEND_API_KEY = "re_test_dummy";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '{"id":"x"}',
      json: async () => ({ id: "x" }),
      headers: new Headers(),
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.resetModules();
    const { sendWelcomeEmail } = await import("@/lib/email/send");

    await expect(sendWelcomeEmail("ada@example.com", "Ada")).resolves.toBe(
      true,
    );
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const body = JSON.parse(String(calls[0][1].body)) as {
      html: string;
      text: string;
    };
    for (const part of [body.html, body.text]) {
      expect(part).toContain("Her gün 10:00 - 00:00");
      expect(part).toContain("+90 216 111 22 33");
      expect(part).toContain("Yeni Sok. No: 5, 34940 Tuzla / İstanbul");
      expect(part).not.toContain("09:00 - 02:00");
      expect(part).not.toContain("536 429 09 19");
    }
    expect(body.html).toContain('href="tel:+902161112233"');
  });
});

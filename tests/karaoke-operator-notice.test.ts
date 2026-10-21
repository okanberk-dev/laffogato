import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Where a new karaoke request is mailed, and that the web books with the same
 * notice as the app.
 *
 * The room is confirmed by hand. Until 26 Eyl 2026 the notice went only to the
 * public contact address and only for bookings made in the app: a request
 * taken on the web `/karaoke` form reached nobody until someone opened the
 * panel. The operator asked for requests to land in one inbox of their
 * choosing (Ayarlar → Karaoke → Talep bildirimi e-postası).
 */

const getSettings = vi.fn();
const getPublicSettings = vi.fn();
vi.mock("@/lib/admin/store", () => ({ getSettings, getPublicSettings }));

const ENV = { ...process.env };

async function load() {
  vi.resetModules();
  return import("@/lib/email/send");
}

const NOTICE = {
  id: "krk-00042",
  source: "web" as const,
  customerName: "Eda Mancuso",
  customerEmail: "eda@ornek.com",
  date: "20 Eylül 2026",
  time: "20:00 - 22:00",
  guests: 6,
  totalMinor: 2_000_00,
  note: "",
};

beforeEach(() => {
  getSettings.mockReset();
  getPublicSettings.mockReset();
  getPublicSettings.mockResolvedValue({
    email: "info@laffogato.net",
    emailFromName: "",
    emailFromAddress: "",
    emailReplyTo: "",
  });
  process.env.RESEND_API_KEY = "re_test";
});

afterEach(() => {
  process.env = { ...ENV };
  vi.unstubAllGlobals();
});

describe("karaokeNoticeRecipient", () => {
  it("prefers the karaoke address from the panel", async () => {
    const { karaokeNoticeRecipient } = await load();
    expect(
      karaokeNoticeRecipient({
        karaokeNotifyEmail: " karaoke@nextgenlab.com.tr ",
        email: "info@laffogato.net",
      }),
    ).toBe("karaoke@nextgenlab.com.tr");
  });

  it("falls back to the contact address when the field is empty", async () => {
    const { karaokeNoticeRecipient } = await load();
    expect(
      karaokeNoticeRecipient({
        karaokeNotifyEmail: "",
        email: "info@laffogato.net",
      }),
    ).toBe("info@laffogato.net");
  });
});

describe("sendKaraokeOperatorEmail", () => {
  it("mails the karaoke address, says where the booking came from, and replies to the member", async () => {
    getSettings.mockResolvedValue({
      karaokeNotifyEmail: "karaoke@nextgenlab.com.tr",
      email: "info@laffogato.net",
    });
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { sendKaraokeOperatorEmail } = await load();
    await expect(sendKaraokeOperatorEmail(NOTICE)).resolves.toEqual({
      ok: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(String(init.body));
    expect(body.to).toBe("karaoke@nextgenlab.com.tr");
    expect(body.reply_to).toBe("eda@ornek.com");
    expect(body.text).toContain("Web sitesinden geldi");
    // The designed template, not a <pre> log: same shell as customer mail.
    expect(body.html).toContain('data-mail="operasyon-bildirim"');
    expect(body.html).toContain("KARAOKE · YENİ TALEP");
    expect(body.html).not.toContain("<pre");
    expect(body.text).toContain("krk-00042");
    expect(body.subject).toContain("6 kişi");
    // A retried request for the same row must not mail twice.
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe(
      "karaoke-krk-00042-requested",
    );
  });

  it("names the app when the phone took the booking", async () => {
    getSettings.mockResolvedValue({
      karaokeNotifyEmail: "karaoke@nextgenlab.com.tr",
      email: "info@laffogato.net",
    });
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { sendKaraokeOperatorEmail } = await load();
    await sendKaraokeOperatorEmail({ ...NOTICE, source: "app" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(init.body)).text).toContain(
      "Uygulamadan geldi",
    );
  });

  it("answers with a reason, and sends nothing, when no address is set", async () => {
    getSettings.mockResolvedValue({ karaokeNotifyEmail: "", email: "" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { sendKaraokeOperatorEmail } = await load();
    const result = await sendKaraokeOperatorEmail(NOTICE);
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DbUnreachableError } from "@/lib/db/health";
import { apiError } from "@/lib/mobile/respond";

/**
 * `POST /me/counter-token` — the endpoint the Kart screen calls every two
 * minutes. It hands out a value that turns into stamps, so the bearer gate,
 * the verified-address gate and the "never cache this" header are the whole
 * contract (docs/API-MOBILE.md §17).
 */

const requireMobileCustomer = vi.fn();
const issueCounterToken = vi.fn();

vi.mock("@/lib/mobile/auth", () => ({ requireMobileCustomer }));
vi.mock("@/lib/mobile/counter", () => ({ issueCounterToken }));

const { POST } = await import("@/app/api/mobile/v1/me/counter-token/route");

const REQUEST = new Request(
  "https://laffogato.net/api/mobile/v1/me/counter-token",
  {
    method: "POST",
  },
);

function signedIn(emailVerified: boolean) {
  requireMobileCustomer.mockResolvedValue({
    ok: true,
    customer: { email: "eda@ornek.com", emailVerified },
  });
}

beforeEach(() => {
  requireMobileCustomer.mockReset();
  issueCounterToken.mockReset();
  issueCounterToken.mockResolvedValue({
    ok: true,
    issue: {
      code: "K7P42M9X",
      token: "jeton-degeri",
      expiresAt: "2026-09-05T12:02:00.000Z",
      ttlSeconds: 120,
    },
  });
});

describe("POST /me/counter-token", () => {
  it("refuses a caller without a bearer", async () => {
    requireMobileCustomer.mockResolvedValue({
      ok: false,
      response: apiError(401, "unauthorized", "Giriş yapman gerekiyor."),
    });
    const res = await POST(REQUEST);
    expect(res.status).toBe(401);
    expect(issueCounterToken).not.toHaveBeenCalled();
  });

  it("refuses an unverified address, like POST /orders does", async () => {
    signedIn(false);
    const res = await POST(REQUEST);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("email_unverified");
    expect(body.message.length).toBeGreaterThan(0);
    expect(issueCounterToken).not.toHaveBeenCalled();
  });

  it("answers 201 with the code, the token and a drawn QR", async () => {
    signedIn(true);
    const res = await POST(REQUEST);
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, string>;
    expect(body).toMatchObject({
      code: "K7P42M9X",
      token: "jeton-degeri",
      ttlSeconds: 120,
    });
    // The app takes no QR dependency of its own; the SVG arrives finished.
    expect(body.qrSvg.startsWith("<svg")).toBe(true);
  });

  it("publishes the grid size so the app can draw whole modules", async () => {
    signedIn(true);
    const res = await POST(REQUEST);
    const body = (await res.json()) as Record<string, unknown>;
    // Additive fields (docs/API-MOBILE.md §17): an older build ignores both
    // and keeps drawing the SVG at whatever size it picked.
    expect(typeof body.qrModules).toBe("number");
    expect(body.qrQuietZone).toBe(4);
    // `qrModules` counts the code only; the drawn square is it plus the
    // quiet zone on both sides, which is what the SVG's viewBox says.
    const total = (body.qrModules as number) + 2 * (body.qrQuietZone as number);
    expect(body.qrSvg).toContain(`viewBox="0 0 ${total} ${total}"`);
  });

  it("never lets a shared cache keep the token", async () => {
    signedIn(true);
    const res = await POST(REQUEST);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("turns the per-minute cap into a 429 the app can wait out", async () => {
    signedIn(true);
    issueCounterToken.mockResolvedValue({
      ok: false,
      error: "rate_limited",
      retryAfterSeconds: 37,
    });
    const res = await POST(REQUEST);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("37");
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("rate_limited");
  });

  it("reports an unreachable database as a retryable 503, not a bug", async () => {
    signedIn(true);
    issueCounterToken.mockRejectedValue(
      new DbUnreachableError("counter.issue", "ECONNREFUSED"),
    );
    const res = await POST(REQUEST);
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unavailable");
  });
});

import { NextResponse } from "next/server";

import {
  checkLoginLimit,
  clientIpFrom,
  recordLoginFailure,
} from "@/lib/admin/rate-limit";
import { unsubscribeCustomerByToken } from "@/lib/customer/unsubscribe";
import { unsubscribeByToken } from "@/lib/newsletter/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The address every commercial message carries in its `List-Unsubscribe`
 * header and its footer link: `/api/bulten/cikis?token=…`.
 *
 * Two callers, two verbs:
 *
 *   POST — RFC 8058 one-click. The mail client (Gmail, Apple Mail, Outlook)
 *          posts `List-Unsubscribe=One-Click` here when the person presses
 *          its own "abonelikten çık" button. No page, no confirmation: the
 *          token is spent and a 200 says so. The header previously pointed
 *          at a page that only answered GET, so that button did nothing.
 *   GET  — a person following the footer link. Sent on to the page, which
 *          spends the token itself and explains what happened.
 *
 * A token belongs to either the subscriber list or a member row; both are
 * tried, and whichever matches switches the other store off as well.
 *
 * The route sits outside the proxy and is advertised in every outbound
 * header, and each POST spends up to three queries on the shared max:1
 * pool. So POST goes through the same Postgres-backed limiter every
 * credential check uses — and, like a login, it throttles FAILURES, not
 * successes: only a token nobody has (unknown, or already spent) counts
 * against the caller's IP; 20 of those in five minutes buy a minute of 429.
 * A valid token never counts. That distinction matters here more than at a
 * login: the one-click POST is not made by the person's device but by their
 * mail provider's servers, from a small shared pool of addresses, and right
 * after a campaign the opt-outs from one provider cluster — counting every
 * hit would refuse the twentieth person's legally mandated opt-out (6563
 * m.8) while their address stayed in the audience. A flood of made-up
 * tokens still costs at most ~20 lookups per IP per window. GET does no
 * database work of its own — a redirect — and is left alone.
 */

const PLAIN = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
} as const;

function tokenOf(request: Request): string {
  return (new URL(request.url).searchParams.get("token") ?? "").trim();
}

async function spend(token: string): Promise<string | null> {
  if (!token) return null;
  return (
    (await unsubscribeByToken(token)) ??
    (await unsubscribeCustomerByToken(token))
  );
}

export async function POST(request: Request) {
  try {
    const ip = clientIpFrom(request.headers);
    // A blocked caller touches neither consent store. The bucket is filled
    // below, and only by a token that matched nothing.
    const limit = await checkLoginLimit("unsubscribe", ip, "one-click");
    if (limit.blocked) {
      return new NextResponse("Çok fazla istek; biraz sonra tekrar dene.", {
        status: 429,
        headers: { ...PLAIN, "Retry-After": String(limit.retryAfterSeconds) },
      });
    }
    const email = await spend(tokenOf(request));
    if (!email) {
      // Unknown or spent: the only kind of hit a flood can produce, and the
      // only kind that counts. A real opt-out never fills the bucket.
      await recordLoginFailure("unsubscribe", ip, "one-click");
    }
    // 200 either way: the client shows nothing of ours, and a spent token
    // means the address is already off the list — which is what was asked.
    return new NextResponse(
      email
        ? "Abonelikten çıkıldı."
        : "Bağlantı geçersiz ya da daha önce kullanılmış.",
      { status: 200, headers: PLAIN },
    );
  } catch (err) {
    console.error("[api/bulten/cikis POST]", err);
    return new NextResponse("Şu an işlenemedi.", {
      status: 500,
      headers: PLAIN,
    });
  }
}

export async function GET(request: Request) {
  const url = new URL("/bulten/cikis", request.url);
  const token = tokenOf(request);
  if (token) url.searchParams.set("token", token);
  return NextResponse.redirect(url, {
    status: 303,
    headers: { "Cache-Control": "no-store" },
  });
}

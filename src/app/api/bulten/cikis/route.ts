import { NextResponse } from "next/server";

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
    const email = await spend(tokenOf(request));
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

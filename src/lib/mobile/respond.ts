import { NextResponse } from "next/server";

/**
 * Wire helpers for `/api/mobile/v1/**` (docs/API-MOBILE.md §0).
 *
 * Every error body has the same two fields: a stable machine code the app
 * branches on and a Turkish message it may show as-is. Route handlers stay
 * thin — parse, authorise, call, map — and these keep the shape from drifting
 * between them.
 */
export interface ApiErrorBody {
  error: string;
  message: string;
}

export function apiError(
  status: number,
  code: string,
  message: string,
  headers?: Record<string, string>,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: code, message }, { status, headers });
}

/**
 * What an authenticated answer must never be stored in: a member's orders,
 * addresses and coupons are theirs alone, and a shared cache (a CDN, a
 * corporate proxy) that kept one would hand it to the next caller.
 * docs/API-MOBILE.md §0 requires it on every endpoint behind a bearer.
 */
export const PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, no-store",
} as const;

export function apiJson<T>(
  body: T,
  init?: {
    status?: number;
    headers?: Record<string, string>;
    /** Adds `Cache-Control: private, no-store` — use on every bearer route. */
    private?: boolean;
  },
): NextResponse<T> {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: init?.private
      ? { ...PRIVATE_CACHE_HEADERS, ...init?.headers }
      : init?.headers,
  });
}

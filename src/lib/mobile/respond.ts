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

export function apiJson<T>(
  body: T,
  init?: { status?: number; headers?: Record<string, string> },
): NextResponse<T> {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

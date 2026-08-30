import type { NextResponse } from "next/server";
import type { ZodError, ZodType } from "zod";

import { isDbUnreachable } from "@/lib/db/health";

import { apiError, type ApiErrorBody } from "./respond";

/**
 * Shared plumbing for the `/api/mobile/v1/**` handlers so each route stays
 * "parse → authorise → call → map" (docs/API-MOBILE.md §0).
 */

const MSG = {
  badJson: "İstek gövdesi okunamadı.",
  dbDown:
    "Servisimize şu an ulaşamıyoruz. Kısa süre içinde tekrar dener misin?",
  internal: "Beklenmeyen bir hata oluştu. Lütfen tekrar dene.",
} as const;

/** First human-readable issue of a Zod failure, for the 400 body. */
export function zodMessage(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Geçersiz istek.";
  const path = issue.path.map(String).filter(Boolean).join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

export type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse<ApiErrorBody> };

/**
 * Reads and validates a JSON body. A body that is not JSON, or does not match
 * the schema, becomes a 400 with a Turkish message the app can show.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<ParsedBody<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: apiError(400, "invalid_json", MSG.badJson),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: apiError(400, "invalid_request", zodMessage(parsed.error)),
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Maps an unexpected throw to the wire: an unreachable database is a 503 the
 * app retries; anything else is a bug, logged with the route label and
 * reported as a 500 without leaking the message.
 */
export function routeFailure(
  label: string,
  err: unknown,
): NextResponse<ApiErrorBody> {
  if (isDbUnreachable(err)) {
    console.error(`[${label}] database unreachable`, err);
    return apiError(503, "unavailable", MSG.dbDown);
  }
  console.error(`[${label}]`, err);
  return apiError(500, "internal", MSG.internal);
}

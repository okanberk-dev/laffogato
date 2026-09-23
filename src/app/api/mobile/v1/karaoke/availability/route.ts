import type { NextRequest } from "next/server";

import { isDbUnreachable } from "@/lib/db/health";
import { getAvailability, isCalendarDate } from "@/lib/mobile/karaoke";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { istanbulClock } from "@/lib/mobile/venue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * GET /api/mobile/v1/karaoke/availability?date=YYYY-MM-DD - §7.
 *
 * Public: which hours are free is shown before the member decides to sign
 * in. Defaults to today (Istanbul) when no date is given.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("date");
  const date = raw ?? istanbulClock(new Date()).date;
  if (!isCalendarDate(date)) {
    return apiError(
      400,
      "invalid_request",
      "Tarih YYYY-AA-GG biçiminde olmalı.",
    );
  }

  try {
    return apiJson(await getAvailability(date));
  } catch (err) {
    if (isDbUnreachable(err)) {
      return apiError(
        503,
        "unavailable",
        "Rezervasyon takvimine şu an ulaşılamıyor. Kısa süre içinde tekrar dene.",
      );
    }
    console.error("[api/mobile/v1/karaoke/availability]", err);
    return apiError(500, "internal", "Beklenmeyen bir hata oluştu.");
  }
}

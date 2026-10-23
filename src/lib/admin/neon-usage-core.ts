// Client-safe (no server-only): the Neon row of Ayarlar → Sistem durumu
// and the owner's dashboard alarm (23 Eki 2026). What the Neon project API
// says about this billing period's compute, against the plan's monthly
// hours. The read itself is ./neon-usage.ts.

import type { AdminRole } from "./roles";
import { keepaliveVisibleTo } from "./supabase-keepalive-core";
import type { AdminTone } from "./tone";

/**
 * The Free plan's compute per project per month (docs/DATABASE.md). When it
 * runs out Neon suspends the compute until the next period, and the site
 * goes with it: September 2026 ended that way (29 Eyl 22:21 UTC to 1 Eki).
 */
export const NEON_FREE_CU_HOURS = 100;

/** From this share of the month's hours the row, and the dashboard, warn. */
export const NEON_WARN_SHARE = 0.8;

/** A projection needs a day of the period behind it; before that, none. */
const PROJECT_AFTER_MS = 24 * 3_600_000;

export interface NeonUsage {
  /** Compute-unit hours this period (`compute_time_seconds` / 3600). */
  cuHours: number;
  /** Hours a compute was awake (`active_time_seconds` / 3600). */
  activeHours: number;
  /** ISO: the period's start, where every counter restarts. */
  periodStart: string;
  /** ISO: the period's end, the next one's start. */
  periodEnd: string;
}

/**
 * `off`: no key or project in this deployment, which is not a fault. A
 * failed read is `unreadable`, never zero hours.
 */
export type NeonUsageRead =
  | { kind: "off" }
  | { kind: "unreadable" }
  | { kind: "usage"; usage: NeonUsage };

/** Who sees the row and the alarm: whoever sees Sistem durumu. */
export function readNeonUsageFor<T>(
  role: AdminRole,
  read: () => Promise<T>,
): Promise<T> | null {
  return keepaliveVisibleTo(role) ? read() : null;
}

/**
 * The plan's monthly hours from `NEON_CU_HOURS_LIMIT`: unset or unreadable
 * is the Free plan's 100; "0" is a plan without a cap (Launch bills the
 * hours instead of stopping), so nothing is measured against one.
 */
export function neonLimitFrom(raw: string | undefined): number | null {
  const text = raw?.trim() ?? "";
  if (text === "0") return null;
  const n = Number(text.replace(",", "."));
  return text && Number.isFinite(n) && n > 0 ? n : NEON_FREE_CU_HOURS;
}

const iso = (value: unknown): number | null => {
  if (typeof value !== "string" || !value) return null;
  const at = Date.parse(value);
  return Number.isFinite(at) ? at : null;
};

const seconds = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;

/**
 * The project's answer (`GET /projects/{id}`), or null when it is not the
 * shape Neon documents. A period the answer does not give is the calendar
 * month in UTC, Neon's billing month.
 */
export function parseNeonProject(json: unknown, now: Date): NeonUsage | null {
  const project =
    json && typeof json === "object"
      ? (json as { project?: unknown }).project
      : null;
  if (!project || typeof project !== "object") return null;
  const p = project as Record<string, unknown>;
  const compute = seconds(p.compute_time_seconds);
  if (compute === null) return null;
  const active = seconds(p.active_time_seconds) ?? 0;
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const start = iso(p.consumption_period_start) ?? monthStart;
  const given = iso(p.consumption_period_end);
  const startDate = new Date(start);
  const end =
    given !== null && given > start
      ? given
      : Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1);
  return {
    cuHours: compute / 3600,
    activeHours: active / 3600,
    periodStart: new Date(start).toISOString(),
    periodEnd: new Date(end).toISOString(),
  };
}

export type NeonUsageState = "off" | "unreadable" | "ok" | "near" | "full";

export interface NeonUsageView {
  state: NeonUsageState;
  tone: AdminTone;
  cuHours: number | null;
  limit: number | null;
  /** At this pace, the period's total; null in its first day. */
  projected: number | null;
  /** ISO: when the hours run out at this pace, if before the period ends. */
  runsOutAt: string | null;
  /** ISO: the period's end, what a suspension lasts until. */
  periodEnd: string | null;
  /** Mean hours a day a compute was awake this period. */
  awakePerDay: number | null;
}

const EMPTY = {
  cuHours: null,
  projected: null,
  runsOutAt: null,
  periodEnd: null,
  awakePerDay: null,
};

/**
 * The row's facts and tone. Grey when off; orange when a key is set but
 * Neon does not answer, since the alarm is then blind (review of #235);
 * red once the hours are spent; orange from 80 % or when this pace spends
 * them before the period ends; green otherwise, and always green without
 * a cap. An answer for a period already over says nothing about this one
 * and reads as unreadable.
 */
export function neonUsageView(
  read: NeonUsageRead,
  limit: number | null,
  now: Date,
): NeonUsageView {
  if (read.kind === "off") {
    return { ...EMPTY, state: "off", tone: "neutral", limit };
  }
  const end = read.kind === "usage" ? Date.parse(read.usage.periodEnd) : 0;
  if (read.kind === "unreadable" || now.getTime() >= end) {
    return { ...EMPTY, state: "unreadable", tone: "warning", limit };
  }
  const { cuHours, activeHours } = read.usage;
  const start = Date.parse(read.usage.periodStart);
  const elapsed = now.getTime() - start;
  const paced = elapsed >= PROJECT_AFTER_MS;
  const projected = paced ? (cuHours * (end - start)) / elapsed : null;
  let runsOutAt: string | null = null;
  if (paced && limit !== null && cuHours > 0 && cuHours < limit) {
    const at = start + (elapsed * limit) / cuHours;
    if (at < end) runsOutAt = new Date(at).toISOString();
  }
  const view = {
    cuHours,
    limit,
    projected,
    runsOutAt,
    periodEnd: read.usage.periodEnd,
    awakePerDay: paced ? (activeHours * 86_400_000) / elapsed : null,
  };
  if (limit !== null && cuHours >= limit) {
    return { ...view, state: "full", tone: "danger" };
  }
  if (
    limit !== null &&
    (cuHours >= limit * NEON_WARN_SHARE || runsOutAt !== null)
  ) {
    return { ...view, state: "near", tone: "warning" };
  }
  return { ...view, state: "ok", tone: "success" };
}

/** Whether the owner's dashboard says it too: only when it needs someone. */
export function neonAlarm(view: NeonUsageView | null): boolean {
  return view?.tone === "warning" || view?.tone === "danger";
}

const HOURS = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const DAY = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "numeric",
  month: "long",
});

/** The plan's hours as the plan names them: "100", "191,9". */
const LIMIT = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

const hours = (n: number) => HOURS.format(n);
/** "1 Kasım", on the köşk's calendar (rule 22). */
export const neonDay = (at: string) => DAY.format(new Date(at));

/** Neon did not answer though a key is set: the usage is not watched. */
export const NEON_UNREADABLE_SENTENCE =
  "Neon'un yanıtı okunamadı, kullanım şu an izlenmiyor; anahtar ya da proje kimliği yanlış olabilir. Geliştiriciye ilet.";

/** What the period says, after "Neon işlem süresi:". Off is the row's own. */
export function neonSentence(view: NeonUsageView): string {
  if (view.state === "unreadable") return NEON_UNREADABLE_SENTENCE;
  if (view.cuHours === null) return "";
  const used =
    view.limit === null
      ? `bu dönem ${hours(view.cuHours)} CU-saat`
      : // Down, never up: 79,6 hours is not "%80" in green (review of #235).
        `bu dönem ${hours(view.cuHours)} / ${LIMIT.format(view.limit)} CU-saat (%${Math.floor((view.cuHours / view.limit) * 100)})`;
  const pace =
    view.state === "full"
      ? ""
      : view.runsOutAt
        ? `; bu hızla ${neonDay(view.runsOutAt)} günü dolar`
        : view.projected !== null
          ? `; bu hızla dönem sonunda ~${hours(view.projected)}`
          : "";
  const awake =
    view.awakePerDay !== null
      ? ` Compute günde ortalama ${hours(view.awakePerDay)} saat uyanık.`
      : "";
  return `${used}${pace}.${awake}`;
}

/** "1 Kasım'a kadar", "1 Ekim'e kadar": the dative follows the month's last vowel. */
function untilDay(at: string): string {
  const day = neonDay(at);
  const vowels = day.toLocaleLowerCase("tr-TR").match(/[aeıioöuü]/g) ?? [];
  const back = "aıou".includes(vowels.at(-1) ?? "e");
  return `${day}'${back ? "a" : "e"} kadar`;
}

/** What a warning adds: what running out costs, and who fixes it. */
export function neonAdvice(view: NeonUsageView): string {
  if (view.state !== "near" && view.state !== "full") return "";
  const until = view.periodEnd
    ? untilDay(view.periodEnd)
    : "dönem sonuna kadar";
  const lead =
    view.state === "full"
      ? `Saatler doldu: Neon veritabanını ${until} askıya alabilir`
      : `Dolarsa Neon veritabanını ${until} askıya alır`;
  return `${lead}; site sipariş alamaz, panel açılmaz. Kalıcı çözüm Neon'un ücretli planı (docs/DATABASE.md). Geliştiriciye ilet.`;
}

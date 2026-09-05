import { z } from "zod";

/**
 * Mobile app configuration — the business knobs the operator turns at
 * /admin/mobil/ayarlar and the app reads from `GET /api/mobile/v1/bootstrap`
 * (docs/API-MOBILE.md §10). Stored as one jsonb document on the `settings`
 * row (`settings."mobileApp"`).
 *
 * Deliberately NO "server-only" and NO database import: the admin client
 * form, the bootstrap mapper and the unit tests all import this module.
 * Server code reads the normalised document through `getSettings().mobileApp`;
 * there is no separate getter.
 *
 * Every leaf is normalised on its own (`.catch` per field). A row written by
 * an older deploy, a hand-edited jsonb, or a single corrupt value therefore
 * never drags the rest of a section back to defaults — only the broken leaf
 * falls back. The app applies the same defence on its side of the wire.
 */

export interface MobileAppReminder {
  id: string;
  hour: number;
  minute: number;
  title: string;
  body: string;
}

export interface MobileAppConfig {
  /** semver "x.y.z"; the app compares its own version, smaller → forced-update screen. */
  minSupportedAppVersion: string;
  maintenance: {
    enabled: boolean;
    title: string;
    message: string;
  };
  ordering: {
    /** false → the app disables "Sepete ekle" for the cafe; the server answers 409 ordering_closed. */
    cafeEnabled: boolean;
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    /** Courier ETA window shown before an order is placed, in minutes. */
    courierEtaMinutes: [number, number];
    closedMessage: string;
  };
  loyalty: {
    stampTarget: number;
    rewardTitle: string;
    /** Value of the free-drink coupon, in kuruş. */
    rewardValueMinor: number;
    rewardTtlDays: number;
  };
  karaoke: {
    firstHour: number;
    closeHour: number;
    maxHours: number;
    bookingWindowDays: number;
    oroDiscountPct: number;
  };
  reminders: {
    /** false → the app hides the reminder switch and cancels scheduled ones. */
    enabled: boolean;
    items: MobileAppReminder[];
  };
  campaignCards: {
    loyalty: boolean;
    invite: boolean;
    subscription: boolean;
  };
  venue: {
    shortName: string;
    landmark: string;
    mapsQuery: string;
  };
}

/** The `app` object published on bootstrap — everything the app needs, nothing server-only. */
export interface BootstrapApp {
  minSupportedAppVersion: string;
  maintenance: MobileAppConfig["maintenance"];
  ordering: MobileAppConfig["ordering"];
  loyalty: { stampTarget: number; rewardTitle: string };
  reminders: MobileAppConfig["reminders"];
  campaignCards: MobileAppConfig["campaignCards"];
}

// ─── Limits (shared by normalisation and the admin form's validation) ─────

export const APP_CONFIG_LIMITS = {
  maintenanceTitleMax: 60,
  maintenanceMessageMax: 280,
  courierEtaMin: 5,
  courierEtaMax: 180,
  closedMessageMax: 200,
  stampTargetMin: 3,
  stampTargetMax: 20,
  rewardTitleMax: 60,
  rewardValueMinorMax: 100_000,
  rewardTtlDaysMin: 7,
  rewardTtlDaysMax: 365,
  karaokeMaxHoursMax: 12,
  bookingWindowDaysMax: 365,
  reminderItemsMax: 4,
  reminderIdPattern: /^[a-z0-9-]{1,24}$/,
  reminderTitleMax: 60,
  reminderBodyMax: 140,
  venueShortNameMax: 60,
  venueLandmarkMax: 80,
  venueMapsQueryMax: 200,
} as const;

// ─── Defaults ─────────────────────────────────────────────────────────────

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const v of Object.values(value as object)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

/**
 * Frozen so no consumer can mutate the shared defaults by accident; every
 * function below hands out fresh copies (`.catch(() => …)`, spreads).
 */
export const DEFAULT_MOBILE_APP_CONFIG: MobileAppConfig = deepFreeze({
  minSupportedAppVersion: "1.0.0",
  maintenance: {
    enabled: false,
    title: "Kısa bir mola",
    message: "Uygulama bakımda. Birazdan yine buradayız.",
  },
  ordering: {
    cafeEnabled: true,
    deliveryEnabled: true,
    pickupEnabled: true,
    courierEtaMinutes: [25, 35],
    closedMessage: "Uygulamadan sipariş şu an kapalı. Köşkte görüşürüz.",
  },
  loyalty: {
    stampTarget: 6,
    rewardTitle: "Ücretsiz içecek",
    rewardValueMinor: 28000,
    rewardTtlDays: 90,
  },
  karaoke: {
    firstHour: 12,
    closeHour: 24,
    maxHours: 4,
    bookingWindowDays: 60,
    oroDiscountPct: 15,
  },
  reminders: {
    enabled: true,
    items: [
      {
        id: "morning",
        hour: 10,
        minute: 0,
        title: "Günaydın",
        body: "Espresso, matcha, bir dilim tatlı — menü hazır.",
      },
      {
        id: "afternoon",
        hour: 15,
        minute: 30,
        title: "İkindi molası",
        body: "Tuzla’daki köşkte bugünün menüsüne göz at.",
      },
    ],
  },
  campaignCards: {
    loyalty: true,
    invite: true,
    subscription: true,
  },
  venue: {
    shortName: "Tuzla · İstanbul",
    landmark: "Menemenci Cumhur’un yanı",
    mapsQuery: "L'Affogato, Atatürk Cad. No: 28, 34940 Tuzla, İstanbul",
  },
});

// ─── Reminder copy rule ───────────────────────────────────────────────────

/**
 * A reminder is a nudge, not an advert. The app's own test forbids price,
 * discount and urgency language in reminder copy; the panel enforces the
 * same rule so an operator cannot publish what the app would refuse to show.
 * Symbols are matched anywhere; words are matched as whole tokens ("son"
 * must not flag "sezon"), except the discount stem which also catches
 * "indirimli" / "kaçırmayın".
 */
const REMINDER_FORBIDDEN_SYMBOLS = ["₺", "%"] as const;
const REMINDER_FORBIDDEN_WORDS = ["son", "hemen"] as const;
const REMINDER_FORBIDDEN_STEMS = ["indirim", "kaçırma"] as const;

export function reminderCopyIssue(text: string): string | null {
  for (const s of REMINDER_FORBIDDEN_SYMBOLS) {
    if (text.includes(s)) {
      return `Hatırlatma metninde "${s}" olamaz — fiyat ve indirim dili yasak.`;
    }
  }
  const tokens = text
    .toLocaleLowerCase("tr-TR")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  for (const token of tokens) {
    for (const w of REMINDER_FORBIDDEN_WORDS) {
      if (token === w) {
        return `Hatırlatma metninde "${w}" olamaz — aciliyet dili yasak.`;
      }
    }
    for (const stem of REMINDER_FORBIDDEN_STEMS) {
      if (token.startsWith(stem)) {
        return `Hatırlatma metninde "${stem}" olamaz — indirim ve aciliyet dili yasak.`;
      }
    }
  }
  return null;
}

// ─── Normalisation ────────────────────────────────────────────────────────

const D = DEFAULT_MOBILE_APP_CONFIG;
const L = APP_CONFIG_LIMITS;

const text = (max: number, fallback: string) =>
  z.string().trim().min(1).max(max).catch(fallback);
const bool = (fallback: boolean) => z.boolean().catch(fallback);
const int = (min: number, max: number, fallback: number) =>
  z.number().int().min(min).max(max).catch(fallback);

const semver = z
  .string()
  .trim()
  .regex(/^\d+\.\d+\.\d+$/)
  .catch(D.minSupportedAppVersion);

const etaBound = z.number().int().min(L.courierEtaMin).max(L.courierEtaMax);
const courierEta = z
  .tuple([etaBound, etaBound])
  .refine(([lo, hi]) => lo <= hi)
  .catch((): [number, number] => [...D.ordering.courierEtaMinutes]);

const reminderItem = z.object({
  id: z.string().regex(L.reminderIdPattern),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  title: z.string().trim().min(1).max(L.reminderTitleMax),
  body: z.string().trim().min(1).max(L.reminderBodyMax),
});

/**
 * Items are validated one by one: a broken item is dropped, the valid ones
 * survive, duplicate ids keep the first. Only a non-array falls back to the
 * default list.
 */
const reminderItems = z
  .array(z.unknown())
  .transform((raw): MobileAppReminder[] => {
    const seen = new Set<string>();
    const out: MobileAppReminder[] = [];
    for (const candidate of raw) {
      const parsed = reminderItem.safeParse(candidate);
      if (!parsed.success) continue;
      const item = parsed.data;
      if (seen.has(item.id)) continue;
      if (reminderCopyIssue(item.title) || reminderCopyIssue(item.body)) {
        continue;
      }
      seen.add(item.id);
      out.push(item);
      if (out.length >= L.reminderItemsMax) break;
    }
    return out;
  })
  .catch(() => D.reminders.items.map((it) => ({ ...it })));

const section = <T extends z.ZodRawShape>(shape: T) => z.object(shape);

const configSchema = z.object({
  minSupportedAppVersion: semver,
  maintenance: section({
    enabled: bool(D.maintenance.enabled),
    title: text(L.maintenanceTitleMax, D.maintenance.title),
    message: text(L.maintenanceMessageMax, D.maintenance.message),
  }).catch(() => ({ ...D.maintenance })),
  ordering: section({
    cafeEnabled: bool(D.ordering.cafeEnabled),
    deliveryEnabled: bool(D.ordering.deliveryEnabled),
    pickupEnabled: bool(D.ordering.pickupEnabled),
    courierEtaMinutes: courierEta,
    closedMessage: text(L.closedMessageMax, D.ordering.closedMessage),
  }).catch(() => ({
    ...D.ordering,
    courierEtaMinutes: [...D.ordering.courierEtaMinutes] as [number, number],
  })),
  loyalty: section({
    stampTarget: int(L.stampTargetMin, L.stampTargetMax, D.loyalty.stampTarget),
    rewardTitle: text(L.rewardTitleMax, D.loyalty.rewardTitle),
    rewardValueMinor: int(0, L.rewardValueMinorMax, D.loyalty.rewardValueMinor),
    rewardTtlDays: int(
      L.rewardTtlDaysMin,
      L.rewardTtlDaysMax,
      D.loyalty.rewardTtlDays,
    ),
  }).catch(() => ({ ...D.loyalty })),
  karaoke: section({
    firstHour: int(0, 23, D.karaoke.firstHour),
    closeHour: int(1, 24, D.karaoke.closeHour),
    maxHours: int(1, L.karaokeMaxHoursMax, D.karaoke.maxHours),
    bookingWindowDays: int(
      1,
      L.bookingWindowDaysMax,
      D.karaoke.bookingWindowDays,
    ),
    oroDiscountPct: int(0, 100, D.karaoke.oroDiscountPct),
  })
    // closeHour must be after firstHour; only the close falls back (24 is
    // always after a firstHour of at most 23), the first hour is kept.
    .transform((k) =>
      k.closeHour > k.firstHour ? k : { ...k, closeHour: D.karaoke.closeHour },
    )
    .catch(() => ({ ...D.karaoke })),
  reminders: section({
    enabled: bool(D.reminders.enabled),
    items: reminderItems,
  }).catch(() => ({
    enabled: D.reminders.enabled,
    items: D.reminders.items.map((it) => ({ ...it })),
  })),
  campaignCards: section({
    loyalty: bool(D.campaignCards.loyalty),
    invite: bool(D.campaignCards.invite),
    subscription: bool(D.campaignCards.subscription),
  }).catch(() => ({ ...D.campaignCards })),
  venue: section({
    shortName: text(L.venueShortNameMax, D.venue.shortName),
    landmark: text(L.venueLandmarkMax, D.venue.landmark),
    mapsQuery: text(L.venueMapsQueryMax, D.venue.mapsQuery),
  }).catch(() => ({ ...D.venue })),
});

/**
 * Any value (a jsonb document, `null`, a string, `undefined`) → a complete,
 * fresh `MobileAppConfig`. Never throws.
 */
export function normalizeMobileAppConfig(raw: unknown): MobileAppConfig {
  const input =
    raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return configSchema.parse(input);
}

/**
 * Section-level merge: a form that saves "Sipariş" replaces the whole
 * `ordering` section and touches nothing else, so two admins editing two
 * sections never overwrite each other's work. The result is normalised so a
 * patch can never persist an out-of-range value.
 */
export function mergeMobileAppConfig(
  current: MobileAppConfig,
  patch: Partial<MobileAppConfig>,
): MobileAppConfig {
  const next: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) next[key] = value;
  }
  return normalizeMobileAppConfig(next);
}

/** The part of the config the app is allowed to see (bootstrap `app`). */
export function toBootstrapApp(cfg: MobileAppConfig): BootstrapApp {
  return {
    minSupportedAppVersion: cfg.minSupportedAppVersion,
    maintenance: { ...cfg.maintenance },
    ordering: {
      ...cfg.ordering,
      courierEtaMinutes: [...cfg.ordering.courierEtaMinutes],
    },
    // Coupon value and TTL are the till's business; the app only names the reward.
    loyalty: {
      stampTarget: cfg.loyalty.stampTarget,
      rewardTitle: cfg.loyalty.rewardTitle,
    },
    reminders: {
      enabled: cfg.reminders.enabled,
      items: cfg.reminders.items.map((it) => ({ ...it })),
    },
    campaignCards: { ...cfg.campaignCards },
  };
}

// ─── Semver ───────────────────────────────────────────────────────────────

function semverParts(v: string): number[] {
  return v
    .trim()
    .split(".")
    .slice(0, 3)
    .map((p) => {
      const n = parseInt(p, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    });
}

/** Numeric "x.y.z" comparison; a missing part counts as 0 ("1.2" === "1.2.0"). */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = semverParts(a);
  const pb = semverParts(b);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

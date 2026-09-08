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

/** Which days the happy hour runs — the app prints its own label for each. */
export type HappyHourDays = "weekday" | "weekend" | "everyday";

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
  /**
   * The happy hour, and whether it is announced at all.
   *
   * It is off by default and stays off until the operator turns it on,
   * because nothing in the pricing path applies the discount: the till gives
   * it by hand. Announcing it while `enabled` is false is what the app used
   * to do, and a member who bought a drink in the window paid full price.
   * The switch is the operator's promise that the counter will honour it.
   */
  happyHour: {
    enabled: boolean;
    /** Which days it runs. */
    days: HappyHourDays;
    /** "HH:MM", Istanbul. */
    from: string;
    to: string;
    /** Discount percent the till applies. */
    pct: number;
  };
  venue: {
    shortName: string;
    landmark: string;
    mapsQuery: string;
  };
  /**
   * Where the app lives in the two stores, and the identifiers that let a
   * laffogato.net link open it instead of the browser.
   *
   * Here rather than in the app's own `.env` because of the rule the whole
   * mobile config exists for: an operator must be able to change these
   * WITHOUT shipping a release. Two of them cannot be changed any other way
   * once the app is out —
   *
   * - the store URLs are read by the forced-update screen, which is shown
   *   precisely to builds that are too old to be updated with a new build;
   * - the App Links fingerprint has to be published by the *website* at
   *   `/.well-known/assetlinks.json`, so only the panel can add the upload
   *   key Google Play signs with after the first release.
   */
  store: {
    /** Public listing URLs; empty until the listing exists. */
    appStoreUrl: string;
    playStoreUrl: string;
    /** iOS: the Apple Developer Team ID that signs the app, e.g. "ABCDE12345". */
    appleTeamId: string;
    /** iOS + Android bundle/application id. */
    bundleId: string;
    /**
     * Android: SHA-256 fingerprints of every certificate that signs a build
     * users install — the upload key AND Play App Signing's own key. Both,
     * or links open in the browser for half the installs.
     */
    androidSha256: string[];
  };
}

/** The `app` object published on bootstrap — everything the app needs, nothing server-only. */
export interface BootstrapApp {
  minSupportedAppVersion: string;
  /**
   * Only the listing URLs. The signing identifiers are the website's own
   * business (it publishes the two `.well-known` documents) and telling the
   * app its own fingerprint would be handing out a fact it cannot use.
   */
  store: { appStoreUrl: string; playStoreUrl: string };
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
  happyHourPctMin: 5,
  happyHourPctMax: 50,
  happyHourDays: ["weekday", "weekend", "everyday"] as const,
  /** "HH:MM", 24-hour. */
  clockPattern: /^([01][0-9]|2[0-3]):[0-5][0-9]$/,
  venueShortNameMax: 60,
  venueLandmarkMax: 80,
  venueMapsQueryMax: 200,
  storeUrlMax: 300,
  appleTeamIdPattern: /^[A-Z0-9]{10}$/,
  bundleIdPattern: /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i,
  /** Colon-separated hex pairs, as `keytool` and the Play console print them. */
  androidSha256Pattern: /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/,
  androidSha256Max: 8,
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
  happyHour: {
    // The window the café has always run; off until someone says the till
    // will honour it.
    enabled: false,
    days: "weekday",
    from: "14:00",
    to: "17:00",
    pct: 25,
  },
  venue: {
    shortName: "Tuzla · İstanbul",
    landmark: "Menemenci Cumhur’un yanı",
    mapsQuery: "L'Affogato, Atatürk Cad. No: 28, 34940 Tuzla, İstanbul",
  },
  store: {
    // Empty until the listings exist. The gate hides its store button rather
    // than offering one that opens nothing, and the two .well-known routes
    // answer 404 rather than publishing an association nobody can honour.
    appStoreUrl: "",
    playStoreUrl: "",
    appleTeamId: "",
    bundleId: "com.laffogato.app",
    androidSha256: [],
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

/**
 * A store listing URL, or "".
 *
 * `https` only, and only the two real hosts: this value ends up in a
 * `Linking.openURL` on a screen the member cannot get past, so an operator
 * typo must degrade to "no button" rather than to "opens something else".
 * Empty is a legitimate answer and the default — there is no listing yet.
 */
const STORE_HOSTS = ["apps.apple.com", "play.google.com"] as const;

const storeUrl = z
  .string()
  .trim()
  .max(L.storeUrlMax)
  .refine((v) => {
    if (v === "") return true;
    try {
      const u = new URL(v);
      return (
        u.protocol === "https:" &&
        (STORE_HOSTS as readonly string[]).includes(u.hostname)
      );
    } catch {
      return false;
    }
  })
  .catch("");

/**
 * Android signing fingerprints, normalised and de-duplicated.
 *
 * Validated one by one like the reminder list: a mistyped fingerprint is
 * dropped and the rest still publish, because a missing entry costs deep
 * links for one signing key while a rejected array costs them for all.
 */
const androidFingerprints = z
  .array(z.unknown())
  .transform((raw): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of raw) {
      if (typeof item !== "string") continue;
      const value = item.trim().toUpperCase();
      if (!L.androidSha256Pattern.test(value)) continue;
      if (seen.has(value)) continue;
      seen.add(value);
      out.push(value);
      if (out.length >= L.androidSha256Max) break;
    }
    return out;
  })
  .catch(() => []);

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

/** "HH:MM" or the default; anything else (13:70, "akşam") falls back. */
const clock = (fallback: string) =>
  z.string().trim().regex(L.clockPattern).catch(fallback);

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
  happyHour: section({
    enabled: bool(D.happyHour.enabled),
    days: z.enum(L.happyHourDays).catch(D.happyHour.days),
    from: clock(D.happyHour.from),
    to: clock(D.happyHour.to),
    pct: z
      .number()
      .int()
      .min(L.happyHourPctMin)
      .max(L.happyHourPctMax)
      .catch(D.happyHour.pct),
  }).catch(() => ({ ...D.happyHour })),
  venue: section({
    shortName: text(L.venueShortNameMax, D.venue.shortName),
    landmark: text(L.venueLandmarkMax, D.venue.landmark),
    mapsQuery: text(L.venueMapsQueryMax, D.venue.mapsQuery),
  }).catch(() => ({ ...D.venue })),
  store: section({
    appStoreUrl: storeUrl,
    playStoreUrl: storeUrl,
    appleTeamId: z
      .string()
      .trim()
      .toUpperCase()
      .regex(L.appleTeamIdPattern)
      .catch(D.store.appleTeamId),
    bundleId: z
      .string()
      .trim()
      .regex(L.bundleIdPattern)
      .catch(D.store.bundleId),
    androidSha256: androidFingerprints,
  }).catch(() => ({ ...D.store, androidSha256: [] })),
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
    store: {
      appStoreUrl: cfg.store.appStoreUrl,
      playStoreUrl: cfg.store.playStoreUrl,
    },
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

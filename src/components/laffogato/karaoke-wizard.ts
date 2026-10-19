import { hourFromLabel } from "@/lib/mobile/karaoke-format";

/**
 * The karaoke booking as a step wizard (operator, 18 Eki 2026: "karaoke
 * sayfasını mobile ve masaüstüne uygun yap ... oraya da bir wizard hazırla"):
 * the pure half. One flow on a phone and a desk: Tarih ve saat, Süre ve
 * kişi, Bilgilerin, Özet ve onay, Ödeme.
 *
 * Nothing here decides a booking. Each step's check only keeps a visitor
 * from walking past a gap the server would refuse anyway (the action and
 * `createReservation` check everything again). The steps are drawn after
 * hydration only: the server-rendered page is the single form it always
 * was, every field in it, so the page books without JavaScript too.
 *
 * Dependency-free, so the client component and the tests share it.
 */

export type KaraokeStepId = "when" | "size" | "details" | "review" | "pay";

export const KARAOKE_STEP_LABELS: Readonly<Record<KaraokeStepId, string>> =
  Object.freeze({
    when: "Tarih ve saat",
    size: "Süre ve kişi",
    details: "Bilgilerin",
    review: "Özet ve onay",
    pay: "Ödeme",
  });

/**
 * The steps of this visitor's booking. A paid booking ends on Ödeme, where
 * the price and the pay button stand together (MSY m.6/2-a); a request paid
 * at the venue ends on its summary with the send button. Who cannot book
 * here (a visitor who must sign in, an unverified address) stops on
 * Bilgilerin, which says what to do.
 */
export function karaokeSteps(o: {
  prepay: boolean;
  canBook: boolean;
}): KaraokeStepId[] {
  if (!o.canBook) return ["when", "size", "details"];
  return o.prepay
    ? ["when", "size", "details", "review", "pay"]
    : ["when", "size", "details", "review"];
}

/** What the form holds that a refresh should not lose. */
export interface KaraokeDraft {
  startHour: number | null;
  hours: number;
  guests: number;
  note: string;
  guestFirstName: string;
  guestLastName: string;
  contactPhone: string;
  contactEmail: string;
}

/** The boxes before a booking; each its own, never pre-ticked, never stored. */
export interface KaraokeTicks {
  preInfo: boolean;
  contract: boolean;
  kvkk: boolean;
}

export const NO_TICKS: Readonly<KaraokeTicks> = Object.freeze({
  preInfo: false,
  contract: false,
  kvkk: false,
});

/** The page's facts each step is checked against. */
export interface KaraokeStepRules {
  slots: readonly { startHour: number; available: boolean }[];
  /** The calendar could not be read at all. */
  unavailable: boolean;
  capacity: number;
  maxHours: number;
  /**
   * Who types contact details: a guest all four, a member whose account has
   * no phone only the phone, a member with one nothing.
   */
  contact: "guest" | "phone" | "none";
  prepay: boolean;
  /** A paid booking prints and echoes the server's rule; it was readable. */
  termsReady: boolean;
}

/** A block is bookable only if every hour in it is free. */
export function karaokeBlockIsFree(
  slots: KaraokeStepRules["slots"],
  start: number,
  len: number,
): boolean {
  return Array.from({ length: len }, (_, i) => start + i).every((h) =>
    slots.some((s) => s.startHour === h && s.available),
  );
}

// The shape the browser's own type="email" check accepts, near enough: a
// local part, an @, a dotted domain. The server validates it again.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Why a step cannot be left forward yet, in the visitor's words, or null.
 * The browser's own checks on the step's fields (required, type="email")
 * run as well, in the component.
 */
export function karaokeStepIssue(
  step: KaraokeStepId,
  draft: KaraokeDraft,
  ticks: KaraokeTicks,
  rules: KaraokeStepRules,
): string | null {
  switch (step) {
    case "when": {
      if (rules.unavailable) {
        return "Takvime şu an ulaşamıyoruz. Biraz sonra tekrar dene.";
      }
      const free =
        draft.startHour !== null &&
        rules.slots.some((s) => s.startHour === draft.startHour && s.available);
      return free ? null : "Bir başlangıç saati seç.";
    }
    case "size": {
      if (draft.hours < 1 || draft.hours > rules.maxHours) {
        return `Süre 1 ile ${rules.maxHours} saat arasında olmalı.`;
      }
      if (draft.guests < 1 || draft.guests > rules.capacity) {
        return `Oda en fazla ${rules.capacity} kişilik.`;
      }
      if (
        draft.startHour === null ||
        !karaokeBlockIsFree(rules.slots, draft.startHour, draft.hours)
      ) {
        return draft.startHour === null
          ? "Önce bir başlangıç saati seç."
          : `${hourFromLabel(draft.startHour)} itibaren ${draft.hours} saat boş değil. Süreyi kısalt ya da başka saat seç.`;
      }
      return null;
    }
    case "details": {
      if (rules.contact === "guest") {
        if (!draft.guestFirstName.trim() || !draft.guestLastName.trim()) {
          return "Adını ve soyadını yaz.";
        }
        if (!draft.contactPhone.trim()) return "Cep telefonunu yaz.";
        if (!EMAIL.test(draft.contactEmail.trim())) {
          return "Geçerli bir e-posta adresi yaz.";
        }
      }
      if (rules.contact === "phone" && !draft.contactPhone.trim()) {
        return "Cep telefonunu yaz.";
      }
      return null;
    }
    case "review": {
      if (rules.prepay && !rules.termsReady) {
        return "İptal kuralını şu an okuyamadık. Sayfayı yenileyip tekrar dene.";
      }
      const ticked = rules.prepay
        ? ticks.preInfo && ticks.contract && ticks.kvkk
        : ticks.kvkk;
      return ticked ? null : "Devam etmek için onay kutularını işaretle.";
    }
    case "pay":
      return null;
  }
}

/**
 * The furthest step the visitor may stand on: the first one with a gap
 * (they may be on it, not past it), else the last.
 */
export function karaokeReachableStep(
  steps: readonly KaraokeStepId[],
  draft: KaraokeDraft,
  ticks: KaraokeTicks,
  rules: KaraokeStepRules,
): number {
  for (let i = 0; i < steps.length - 1; i += 1) {
    if (karaokeStepIssue(steps[i], draft, ticks, rules) !== null) return i;
  }
  return Math.max(0, steps.length - 1);
}

// ─── The state ───────────────────────────────────────────────────────────

export interface KaraokeBookingState {
  steps: readonly KaraokeStepId[];
  /** Index into `steps`. */
  step: number;
  /** The furthest step shown so far: the indicator jumps back to any of them. */
  reached: number;
  draft: KaraokeDraft;
  ticks: KaraokeTicks;
  /** Why the last "Devam" did not move, shown under the step. */
  error: string | null;
  /** Hydrated: the steps are drawn one at a time (before it, one long form). */
  enhanced: boolean;
  /** Counts the moves, so the address bar and the focus follow each one. */
  seq: number;
  /**
   * How the last move reaches the address bar: a new entry (forward and the
   * indicator, so the browser's back is one step back), the same entry, or
   * not at all.
   */
  nav: "push" | "replace" | "none";
  /** The last move was the visitor's: the focus goes to the new step. */
  focus: boolean;
}

export type KaraokeBookingAction =
  | { type: "edit"; patch: Partial<KaraokeDraft> }
  | { type: "tick"; key: keyof KaraokeTicks; ticked: boolean }
  /** After hydration: the saved values back, and the step the URL names. */
  | {
      type: "restore";
      draft: Partial<KaraokeDraft>;
      step: number;
      rules: KaraokeStepRules;
    }
  | { type: "next"; rules: KaraokeStepRules }
  | { type: "back" }
  /** The indicator, the browser's back and forward, a field to fix. */
  | {
      type: "go";
      step: number;
      rules: KaraokeStepRules;
      nav: "push" | "replace";
      any?: boolean;
    };

export function karaokeBookingInit(o: {
  steps: readonly KaraokeStepId[];
  draft: KaraokeDraft;
}): KaraokeBookingState {
  return {
    steps: o.steps,
    step: 0,
    reached: 0,
    draft: o.draft,
    ticks: { ...NO_TICKS },
    error: null,
    enhanced: false,
    seq: 0,
    nav: "none",
    focus: false,
  };
}

function clampStep(
  s: KaraokeBookingState,
  want: number,
  rules: KaraokeStepRules,
  limit: number,
): number {
  const reachable = karaokeReachableStep(s.steps, s.draft, s.ticks, rules);
  const top = Math.min(reachable, limit, s.steps.length - 1);
  return Math.max(0, Math.min(Math.trunc(want), top));
}

export function karaokeBookingReducer(
  s: KaraokeBookingState,
  a: KaraokeBookingAction,
): KaraokeBookingState {
  switch (a.type) {
    case "edit":
      return { ...s, draft: { ...s.draft, ...a.patch }, error: null };
    case "tick":
      return { ...s, ticks: { ...s.ticks, [a.key]: a.ticked }, error: null };
    case "restore": {
      const restored = { ...s, draft: { ...s.draft, ...a.draft } };
      // A refreshed or shared `?adim=4` lands no further than the first gap.
      const step = clampStep(restored, a.step, a.rules, Infinity);
      return {
        ...restored,
        step,
        reached: step,
        error: null,
        enhanced: true,
        seq: s.seq + 1,
        nav: "replace",
        focus: false,
      };
    }
    case "next": {
      const id = s.steps[s.step];
      const issue = karaokeStepIssue(id, s.draft, s.ticks, a.rules);
      if (issue) return { ...s, error: issue };
      if (s.step >= s.steps.length - 1) return { ...s, error: null };
      const step = s.step + 1;
      return {
        ...s,
        step,
        reached: Math.max(s.reached, step),
        error: null,
        seq: s.seq + 1,
        nav: "push",
        focus: true,
      };
    }
    case "back":
      return {
        ...s,
        step: Math.max(0, s.step - 1),
        error: null,
        seq: s.seq + 1,
        nav: "replace",
        focus: true,
      };
    case "go": {
      // Forward only as far as the visitor has been (the indicator), or to
      // any valid step (the browser's forward, `any`); never past a gap.
      const step = clampStep(s, a.step, a.rules, a.any ? Infinity : s.reached);
      return {
        ...s,
        step,
        reached: Math.max(s.reached, step),
        error: null,
        seq: s.seq + 1,
        nav: a.nav,
        focus: true,
      };
    }
  }
}

// ─── The URL: ?adim= (the browser's back button goes one step back) ───────

export const KARAOKE_STEP_PARAM = "adim";

/** `?adim=3` → 2 (0-based); missing or unreadable → 0. */
export function karaokeStepFromSearch(search: string): number {
  const raw = new URLSearchParams(search).get(KARAOKE_STEP_PARAM) ?? "";
  if (!/^[1-9]$/.test(raw)) return 0;
  return Number(raw) - 1;
}

/**
 * The query with the step set (`adim` is 1-based; the first step drops it)
 * and every other parameter kept. Only the step number goes in the address:
 * nothing typed into the form ever does.
 */
export function karaokeSearchWithStep(search: string, step: number): string {
  const q = new URLSearchParams(search);
  if (step > 0) q.set(KARAOKE_STEP_PARAM, String(step + 1));
  else q.delete(KARAOKE_STEP_PARAM);
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ─── The draft in sessionStorage (this tab only; cleared on submit) ───────

export const KARAOKE_DRAFT_KEY = "laffogato_karaoke_draft_v1";

const LIMITS = {
  note: 200,
  guestFirstName: 60,
  guestLastName: 60,
  contactPhone: 40,
  contactEmail: 200,
} as const;

/**
 * What a refresh keeps: the values already in the form, never the boxes,
 * and the hour the address asked for (`?saat=`) when they were typed.
 */
export function karaokeDraftToJson(
  date: string,
  d: KaraokeDraft,
  asked: number | null = null,
): string {
  return JSON.stringify({ v: 1, date, asked, ...d });
}

/**
 * The saved values that still fit this page, or nothing. The hour comes back
 * only on the same day, only while it is free, and only when the address
 * asks for no other one: a home page chip (`?saat=`) is a new choice, a
 * refresh of the same address is not. The numbers come back only inside
 * today's limits; text only as text, cut to the field's own length.
 */
export function karaokeDraftFromJson(
  raw: string | null,
  at: {
    date: string;
    slots: KaraokeStepRules["slots"];
    capacity: number;
    maxHours: number;
    /** The free hour this address asks for (`?saat=`), or null. */
    asked?: number | null;
  },
): Partial<KaraokeDraft> {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!data || typeof data !== "object") return {};
  const o = data as Record<string, unknown>;
  if (o.v !== 1) return {};
  const out: Partial<KaraokeDraft> = {};
  const int = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
  const asked = at.asked ?? null;
  if (
    o.date === at.date &&
    typeof o.startHour === "number" &&
    at.slots.some((s) => s.startHour === o.startHour && s.available) &&
    (asked === null || (o.asked ?? null) === asked)
  ) {
    out.startHour = o.startHour;
  }
  if (int(o.hours, 1, at.maxHours)) out.hours = o.hours as number;
  if (int(o.guests, 1, at.capacity)) out.guests = o.guests as number;
  for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    const v = o[key];
    if (typeof v === "string") out[key] = v.slice(0, LIMITS[key]);
  }
  return out;
}

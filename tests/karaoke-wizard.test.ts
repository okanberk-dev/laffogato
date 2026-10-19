import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The karaoke booking as a step wizard, and the KDV note under its totals
 * (operator, 18 Eki 2026: "karaoke sayfasını mobile ve masaüstüne uygun yap
 * ... kdv miktarı otomatik yazsın ... oraya da bir wizard hazırla"): the
 * pure step logic, the note's arithmetic, the server's cancellation rule on
 * both karaoke screens, and the single form the page still is without
 * JavaScript. The look at phone and desk widths is checked in a browser.
 */

vi.mock("@/app/karaoke/actions", () => ({ bookKaraokeAction: vi.fn() }));

const { kdvIncludedNote } = await import("@/components/laffogato/kdv-note");
const terms = await import("@/components/laffogato/karaoke-terms");
const wiz = await import("@/components/laffogato/karaoke-wizard");
const { KaraokeBooking } =
  await import("@/components/laffogato/karaoke-booking");
const { KaraokeReservationView, karaokeCancelOutcome } =
  await import("@/components/uye/karaoke-reservation-view");
const { karaokeCancellationRules } = await import("@/lib/mobile/karaoke-time");

const read = (p: string) => readFileSync(p, "utf8");
/** A sentence as React writes it into markup ("%50'si" -> "%50&#x27;si"). */
const esc = (t: string) => t.replace(/'/g, "&#x27;");
/** Markup as read: the tags gone (the KDV note's halves are spans). */
const text = (html: string) => html.replace(/<[^>]+>/g, "");

const DEFAULT = karaokeCancellationRules({
  freeCancelHours: 2,
  lateRefundPercent: 0,
}).rules;
const HALF = karaokeCancellationRules({
  freeCancelHours: 24,
  lateRefundPercent: 50,
}).rules;

describe("the KDV note under a KDV-included total", () => {
  it("names the rate and the KDV inside the amount", () => {
    // 350,00₺ with 20 % included: 350 × 20 / 120 = 58,33₺.
    expect(kdvIncludedNote(35_000, 20)).toBe("%20 KDV dahil (KDV 58,33₺)");
    expect(kdvIncludedNote(35_000, 10)).toBe("%10 KDV dahil (KDV 31,82₺)");
    expect(kdvIncludedNote(35_000, 1)).toBe("%1 KDV dahil (KDV 3,47₺)");
    expect(kdvIncludedNote(100_000, 20)).toBe("%20 KDV dahil (KDV 166,67₺)");
  });

  it("says no KDV at 0 %, and only the words without a rate", () => {
    expect(kdvIncludedNote(35_000, 0)).toBe("%0 KDV");
    expect(kdvIncludedNote(35_000, null)).toBe("KDV dahil");
    expect(kdvIncludedNote(35_000, undefined)).toBe("KDV dahil");
    expect(kdvIncludedNote(35_000, 12.5)).toBe("KDV dahil");
    // Nothing to pay, nothing to name.
    expect(kdvIncludedNote(0, 20)).toBe("%20 KDV dahil");
  });

  it("is a client-safe module with no rate of its own", () => {
    const src = read("src/components/laffogato/kdv-note.ts");
    expect(src).not.toMatch(/server-only|@\/lib\/(db|admin)/);
    // Comments aside (the worked example), no number stands in for a rate.
    const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(code).not.toMatch(/\b(1|10|20)\b/);
  });
});

const SLOTS = [
  { startHour: 20, available: true },
  { startHour: 21, available: true },
  { startHour: 22, available: false },
];
const RULES: import("@/components/laffogato/karaoke-wizard").KaraokeStepRules =
  {
    slots: SLOTS,
    unavailable: false,
    capacity: 8,
    maxHours: 4,
    contact: "guest",
    prepay: true,
    termsReady: true,
  };
const DRAFT = {
  startHour: 20,
  hours: 1,
  guests: 4,
  note: "",
  guestFirstName: "Eda",
  guestLastName: "Yılmaz",
  contactPhone: "0532 123 45 67",
  contactEmail: "eda@example.com",
};
const ALL = { preInfo: true, contract: true, kvkk: true };

describe("the steps", () => {
  it("ends a paid booking on Ödeme, a request on its summary", () => {
    expect(wiz.karaokeSteps({ prepay: true, canBook: true })).toEqual([
      "when",
      "size",
      "details",
      "review",
      "pay",
    ]);
    expect(wiz.karaokeSteps({ prepay: false, canBook: true })).toEqual([
      "when",
      "size",
      "details",
      "review",
    ]);
    // Who must sign in first stops on Bilgilerin, which says so.
    expect(wiz.karaokeSteps({ prepay: false, canBook: false })).toEqual([
      "when",
      "size",
      "details",
    ]);
    expect(
      wiz
        .karaokeSteps({ prepay: true, canBook: true })
        .map((id) => wiz.KARAOKE_STEP_LABELS[id]),
    ).toEqual([
      "Tarih ve saat",
      "Süre ve kişi",
      "Bilgilerin",
      "Özet ve onay",
      "Ödeme",
    ]);
  });

  it("checks each step before it may be left", () => {
    const issue = (
      id: Parameters<typeof wiz.karaokeStepIssue>[0],
      d = {},
      t = ALL,
      r = {},
    ) => wiz.karaokeStepIssue(id, { ...DRAFT, ...d }, t, { ...RULES, ...r });
    expect(issue("when")).toBeNull();
    expect(issue("when", { startHour: null })).toBe("Bir başlangıç saati seç.");
    expect(issue("when", { startHour: 22 })).toBe("Bir başlangıç saati seç.");
    expect(issue("when", {}, ALL, { unavailable: true })).toMatch(
      /Takvime şu an ulaşamıyoruz/,
    );
    // 21:00 is free, 22:00 is not: two hours from 21 do not fit.
    expect(issue("size", { startHour: 21, hours: 2 })).toBe(
      "21:00’den itibaren 2 saat boş değil. Süreyi kısalt ya da başka saat seç.",
    );
    expect(issue("size", { guests: 9 })).toBe("Oda en fazla 8 kişilik.");
    expect(issue("size", { hours: 5 })).toBe(
      "Süre 1 ile 4 saat arasında olmalı.",
    );
    expect(issue("details")).toBeNull();
    expect(issue("details", { guestLastName: " " })).toBe(
      "Adını ve soyadını yaz.",
    );
    expect(issue("details", { contactEmail: "eda@" })).toBe(
      "Geçerli bir e-posta adresi yaz.",
    );
    expect(
      issue("details", { contactPhone: "" }, ALL, { contact: "phone" }),
    ).toBe("Cep telefonunu yaz.");
    expect(
      issue("details", { guestFirstName: "" }, ALL, { contact: "none" }),
    ).toBeNull();
    expect(issue("review")).toBeNull();
    expect(issue("review", {}, { ...ALL, contract: false })).toBe(
      "Devam etmek için onay kutularını işaretle.",
    );
    // A request paid at the venue asks for the privacy box only.
    expect(
      issue("review", {}, { ...wiz.NO_TICKS, kvkk: true }, { prepay: false }),
    ).toBeNull();
    // A paid booking without a readable rule is never sent.
    expect(issue("review", {}, ALL, { termsReady: false })).toMatch(
      /İptal kuralını şu an okuyamadık/,
    );
  });
});

describe("the step reducer", () => {
  const steps = wiz.karaokeSteps({ prepay: true, canBook: true });
  const start = () => wiz.karaokeBookingInit({ steps, draft: { ...DRAFT } });
  const run = (
    s: ReturnType<typeof start>,
    ...actions: Parameters<typeof wiz.karaokeBookingReducer>[1][]
  ) => actions.reduce(wiz.karaokeBookingReducer, s);

  it("starts as the single form, unticked, on the first step", () => {
    const s = start();
    expect(s.enhanced).toBe(false);
    expect(s.step).toBe(0);
    expect(s.ticks).toEqual({ preInfo: false, contract: false, kvkk: false });
  });

  it("moves on only past a step that is complete, and pushes the move", () => {
    const blank = wiz.karaokeBookingInit({
      steps,
      draft: { ...DRAFT, startHour: null },
    });
    const refused = run(blank, { type: "next", rules: RULES });
    expect(refused.step).toBe(0);
    expect(refused.error).toBe("Bir başlangıç saati seç.");
    expect(refused.seq).toBe(blank.seq);

    const picked = run(
      refused,
      { type: "edit", patch: { startHour: 20 } },
      { type: "next", rules: RULES },
    );
    expect(picked.error).toBeNull();
    expect(picked.step).toBe(1);
    expect(picked.reached).toBe(1);
    expect(picked.nav).toBe("push");
    expect(picked.focus).toBe(true);
  });

  it("stops at the boxes, and reaches Ödeme once they are ticked", () => {
    let s = run(
      start(),
      { type: "next", rules: RULES },
      { type: "next", rules: RULES },
      { type: "next", rules: RULES },
    );
    expect(steps[s.step]).toBe("review");
    s = run(s, { type: "next", rules: RULES });
    expect(steps[s.step]).toBe("review");
    expect(s.error).toMatch(/onay kutularını/);
    s = run(
      s,
      { type: "tick", key: "preInfo", ticked: true },
      { type: "tick", key: "contract", ticked: true },
      { type: "tick", key: "kvkk", ticked: true },
    );
    expect(s.error).toBeNull();
    s = run(s, { type: "next", rules: RULES });
    expect(steps[s.step]).toBe("pay");
    // The last step has nowhere further to go.
    expect(run(s, { type: "next", rules: RULES }).step).toBe(s.step);
  });

  it("goes back one step, and jumps back to any step shown so far", () => {
    const s = run(
      start(),
      { type: "next", rules: RULES },
      { type: "next", rules: RULES },
    );
    expect(run(s, { type: "back" }).step).toBe(1);
    expect(run(s, { type: "back" }).nav).toBe("replace");
    const jumped = run(s, { type: "go", step: 0, rules: RULES, nav: "push" });
    expect(jumped.step).toBe(0);
    expect(jumped.reached).toBe(2);
    // The indicator goes forward only as far as the visitor has been...
    expect(
      run(jumped, { type: "go", step: 4, rules: RULES, nav: "push" }).step,
    ).toBe(2);
    // ...the browser's forward to any valid step, never past a gap (the
    // boxes are unticked).
    expect(
      run(jumped, {
        type: "go",
        step: 4,
        rules: RULES,
        nav: "replace",
        any: true,
      }).step,
    ).toBe(3);
  });

  it("restores the saved values and the URL's step, no further than the first gap", () => {
    const back = run(start(), {
      type: "restore",
      draft: { hours: 2, note: "Doğum günü" },
      step: 4,
      rules: RULES,
    });
    expect(back.enhanced).toBe(true);
    expect(back.draft.hours).toBe(2);
    expect(back.draft.note).toBe("Doğum günü");
    // Ödeme asked for, but the boxes start unticked: Özet ve onay.
    expect(steps[back.step]).toBe("review");
    expect(back.nav).toBe("replace");
    expect(back.focus).toBe(false);
    const empty = run(
      wiz.karaokeBookingInit({ steps, draft: { ...DRAFT, startHour: null } }),
      { type: "restore", draft: {}, step: 3, rules: RULES },
    );
    expect(empty.step).toBe(0);
  });

  it("a typed value clears the last refusal", () => {
    const s = run(
      wiz.karaokeBookingInit({ steps, draft: { ...DRAFT, startHour: null } }),
      { type: "next", rules: RULES },
      { type: "edit", patch: { startHour: 21 } },
    );
    expect(s.error).toBeNull();
  });
});

describe("the step in the address bar", () => {
  it("reads ?adim= as a 1-based step, anything else as the first", () => {
    expect(wiz.karaokeStepFromSearch("?tarih=2026-10-30&adim=3")).toBe(2);
    expect(wiz.karaokeStepFromSearch("?adim=1")).toBe(0);
    for (const bad of ["", "?adim=0", "?adim=x", "?adim=12", "?adim=-1"]) {
      expect(wiz.karaokeStepFromSearch(bad), bad).toBe(0);
    }
  });

  it("writes only the step, keeping the day and the hour", () => {
    expect(wiz.karaokeSearchWithStep("?tarih=2026-10-30&saat=21", 2)).toBe(
      "?tarih=2026-10-30&saat=21&adim=3",
    );
    expect(wiz.karaokeSearchWithStep("?tarih=2026-10-30&adim=3", 0)).toBe(
      "?tarih=2026-10-30",
    );
    expect(wiz.karaokeSearchWithStep("", 0)).toBe("");
  });

  it("Geri is the browser's back only when the entry under it is the step before", () => {
    // Devam from 1 to 2: the entry under step 2 shows step 1.
    expect(wiz.karaokeBackIsHistory({ step: 1, depth: 1, prev: 0 })).toBe(true);
    // Özet ve onay, then "Değiştir" on Süre ve kişi: the entry under it is
    // Özet ve onay, and the browser's back would go forward to it.
    expect(wiz.karaokeBackIsHistory({ step: 1, depth: 4, prev: 3 })).toBe(
      false,
    );
    // A refreshed page pushed nothing; the first step has no Geri.
    expect(wiz.karaokeBackIsHistory({ step: 2, depth: 0, prev: 1 })).toBe(
      false,
    );
    expect(wiz.karaokeBackIsHistory({ step: 0, depth: 2, prev: null })).toBe(
      false,
    );
    const src = read("src/components/laffogato/karaoke-booking.tsx");
    const onBack = src.slice(
      src.indexOf("function onBack("),
      src.indexOf("function goTo("),
    );
    expect(onBack).toMatch(
      /karaokeBackIsHistory\(\{[\s\S]*?prev: readPrev\(\)/,
    );
    expect(src).toContain("{ karaokeDepth: depth + 1, karaokePrev: prev }");
  });

  it("never carries a typed value", () => {
    const src = read("src/components/laffogato/karaoke-booking.tsx");
    const pushes = [
      ...src.matchAll(/history\.(push|replace)State\(([^)]*)\)/g),
    ];
    expect(pushes.length).toBeGreaterThan(0);
    for (const m of pushes) {
      expect(m[2]).not.toMatch(/draft|guest|contact|note|email|phone/i);
    }
  });
});

describe("what a refresh keeps", () => {
  const at = { date: "2026-10-30", slots: SLOTS, capacity: 8, maxHours: 4 };

  it("brings the values back on the same day, and never a ticked box", () => {
    const json = wiz.karaokeDraftToJson("2026-10-30", { ...DRAFT, hours: 2 });
    expect(json).not.toMatch(/preInfo|contract|kvkk|consent/);
    expect(wiz.karaokeDraftFromJson(json, at)).toEqual({ ...DRAFT, hours: 2 });
  });

  it("drops an hour from another day or one taken since, and numbers out of range", () => {
    const other = wiz.karaokeDraftToJson("2026-10-29", DRAFT);
    expect(wiz.karaokeDraftFromJson(other, at)).not.toHaveProperty("startHour");
    const taken = wiz.karaokeDraftToJson("2026-10-30", {
      ...DRAFT,
      startHour: 22,
    });
    expect(wiz.karaokeDraftFromJson(taken, at)).not.toHaveProperty("startHour");
    const big = wiz.karaokeDraftToJson("2026-10-30", {
      ...DRAFT,
      hours: 9,
      guests: 40,
    });
    const back = wiz.karaokeDraftFromJson(big, at);
    expect(back).not.toHaveProperty("hours");
    expect(back).not.toHaveProperty("guests");
  });

  it("lets an hour the address asks for beat one kept from earlier, not a refresh of it", () => {
    // 21:00 picked earlier in this tab, then a home page chip asks for 20:00.
    const earlier = wiz.karaokeDraftToJson("2026-10-30", {
      ...DRAFT,
      startHour: 21,
    });
    const chip = wiz.karaokeDraftFromJson(earlier, { ...at, asked: 20 });
    expect(chip).not.toHaveProperty("startHour");
    // Everything else typed still comes back.
    expect(chip.guestFirstName).toBe("Eda");
    // On ?saat=20 the visitor moved to 21:00 and refreshed: 21:00 stays.
    const moved = wiz.karaokeDraftToJson(
      "2026-10-30",
      { ...DRAFT, startHour: 21 },
      20,
    );
    expect(
      wiz.karaokeDraftFromJson(moved, { ...at, asked: 20 }).startHour,
    ).toBe(21);
    // No hour in the address: the kept one, as before.
    expect(wiz.karaokeDraftFromJson(earlier, at).startHour).toBe(21);
    const src = read("src/components/laffogato/karaoke-booking.tsx");
    expect(src).toContain("karaokeDraftToJson(date, s.draft, asked)");
    expect(src).toMatch(/karaokeDraftFromJson\(saved, \{[^}]*\basked,?\s*\}/);
  });

  it("reads nothing from a broken or foreign value, and cuts text to its field", () => {
    expect(wiz.karaokeDraftFromJson(null, at)).toEqual({});
    expect(wiz.karaokeDraftFromJson("{", at)).toEqual({});
    expect(wiz.karaokeDraftFromJson('{"v":2,"hours":2}', at)).toEqual({});
    expect(wiz.karaokeDraftFromJson('"text"', at)).toEqual({});
    const long = wiz.karaokeDraftFromJson(
      JSON.stringify({ v: 1, note: "x".repeat(500), guestFirstName: 7 }),
      at,
    );
    expect(long.note).toHaveLength(200);
    expect(long).not.toHaveProperty("guestFirstName");
  });

  it("lives in this tab only, and is cleared when the booking is sent", () => {
    const src = read("src/components/laffogato/karaoke-booking.tsx");
    expect(src).toContain("sessionStorage.setItem(");
    expect(src).toContain("sessionStorage.removeItem(KARAOKE_DRAFT_KEY)");
    expect(src).not.toContain("localStorage");
  });
});

describe("a refused booking", () => {
  const src = read("src/components/laffogato/karaoke-booking.tsx");
  const onSubmit = src.slice(
    src.indexOf("function onSubmit("),
    src.indexOf("if (state.booked) {"),
  );

  it("is posted by hand, so React's form reset never unticks the boxes", () => {
    // React empties a <form action={fn}> once the action answers: the boxes
    // went unticked behind a ticked state, and the next press on Ödeme was
    // sent back to Özet ve onay without a word (seen in a browser).
    expect(onSubmit).toMatch(
      /e\.preventDefault\(\);\s*if \(posting\.current\) return;\s*posting\.current = true;/,
    );
    expect(onSubmit).toContain("startTransition(() => formAction(formData))");
    // A page without JavaScript still posts to the server action itself.
    expect(src).toContain("action={formAction}");
  });

  it("keeps the typed values for a refresh: the draft is written again after a refusal", () => {
    // Cleared when the booking is sent, written back when the answer is a
    // refusal (`state` is a new object with each answer), never after one
    // that was taken.
    expect(src).toMatch(
      /if \(!s\.enhanced \|\| state\.booked\) return;[\s\S]{0,400}?\}, \[s\.enhanced, s\.draft, date, asked, state\]\);/,
    );
  });
});

describe("the cancellation terms, from the server", () => {
  const src = {
    freeCancelHours: 2,
    lateRefundPercent: 0,
    cancellationRules: DEFAULT,
  };

  it("names the last free moment on the köşk's clock", () => {
    const t = terms.karaokeBookingTerms(src, {
      date: "2026-10-30",
      startHour: 20,
      totalMinor: 100_000,
    });
    expect(t?.rules).toEqual(DEFAULT);
    expect(t?.policy).toEqual({ freeCancelHours: 2, lateRefundPercent: 0 });
    expect(t?.freeUntil).toBe("30 Ekim 2026, 18:00");
    expect(t?.lateShareMinor).toBeNull();
  });

  it("a long window names its own day, and a late share its amount", () => {
    const t = terms.karaokeBookingTerms(
      { freeCancelHours: 24, lateRefundPercent: 50, cancellationRules: HALF },
      { date: "2026-10-30", startHour: 20, totalMinor: 99_999 },
    );
    expect(t?.freeUntil).toBe("29 Ekim 2026, 20:00");
    expect(t?.lateShareMinor).toBe(50_000);
    expect(
      terms.karaokeBookingTerms(
        { ...src, freeCancelHours: 0 },
        { date: "2026-10-30", startHour: 20, totalMinor: 1 },
      )?.freeUntil,
    ).toBeNull();
  });

  it("prints nothing it cannot read", () => {
    const pick = { date: "2026-10-30", startHour: 20, totalMinor: 1 };
    expect(terms.karaokeBookingTerms(null, pick)).toBeNull();
    expect(
      terms.karaokeBookingTerms({ ...src, cancellationRules: [] }, pick),
    ).toBeNull();
    expect(
      terms.karaokeBookingTerms({ ...src, lateRefundPercent: 101 }, pick),
    ).toBeNull();
  });

  it("names no free moment that has already gone by", () => {
    // Tonight at 20:00 under the 2-hour rule, the page drawn at 19:30 Tuzla:
    // the booking's own snapshot is late from the start.
    const pick = { date: "2026-10-30", startHour: 20, totalMinor: 100_000 };
    const passed = terms.karaokeBookingTerms(src, {
      ...pick,
      now: new Date("2026-10-30T16:30:00.000Z"),
    });
    expect(passed?.freeUntil).toBeNull();
    expect(passed?.freePassed).toBe(true);
    // Exactly at the deadline the moment is still in time
    // (`now <= deadline`); a millisecond later it has gone.
    const atDeadline = terms.karaokeBookingTerms(src, {
      ...pick,
      now: new Date("2026-10-30T15:00:00.000Z"),
    });
    expect(atDeadline?.freePassed).toBe(false);
    expect(atDeadline?.freeUntil).toBe("30 Ekim 2026, 18:00");
    expect(
      terms.karaokeBookingTerms(src, {
        ...pick,
        now: new Date("2026-10-30T15:00:00.001Z"),
      })?.freePassed,
    ).toBe(true);
    const ahead = terms.karaokeBookingTerms(src, {
      ...pick,
      now: new Date("2026-10-30T14:59:00.000Z"),
    });
    expect(ahead?.freeUntil).toBe("30 Ekim 2026, 18:00");
    expect(ahead?.freePassed).toBe(false);
    // No clock given: the moment is named, as before.
    expect(terms.karaokeBookingTerms(src, pick)?.freePassed).toBe(false);
    // No window at all: nothing passed, nothing named.
    expect(
      terms.karaokeBookingTerms(
        { ...src, freeCancelHours: 0 },
        { ...pick, now: new Date("2026-10-30T16:30:00.000Z") },
      ),
    ).toMatchObject({ freeUntil: null, freePassed: false });
  });

  it("reads the Istanbul day after midnight UTC", () => {
    expect(
      terms.karaokeInstantLabel(new Date("2026-10-29T21:30:00.000Z")),
    ).toBe("30 Ekim 2026, 00:30");
  });
});

const AVAILABILITY = {
  date: "2026-10-30",
  slots: SLOTS,
  hourlyMinor: 100_000,
  capacity: 8,
  oroDiscountPct: 15,
  firstHour: 12,
  closeHour: 24,
  maxHours: 4,
  bookingWindowDays: 14,
  paymentRequired: true,
  freeCancelHours: 2,
  lateRefundPercent: 0,
  consentDocs: ["karaoke-odasi-rezervasyon"],
  privacyDoc: "kvkk-aydinlatma-metni",
  cancellationRules: [...DEFAULT],
  taxRatePct: 20,
};
const PROPS = {
  days: ["2026-10-30", "2026-10-31"],
  date: "2026-10-30",
  availability: AVAILABILITY,
  unavailable: false,
  capacity: 8,
  hourlyMinor: 100_000,
  closeHour: 24,
  tier: null,
  tierLabel: null,
  isAuthenticated: false,
  emailVerified: false,
  phone: "+90 536 429 09 19",
  address: "Postane Mah. Atatürk Cad. No: 28, Tuzla",
  sellerName: "NEXTGEN YAZILIM LİMİTED ŞİRKETİ",
  taxNo: "6312110904",
  prepay: true,
};
const booking = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(KaraokeBooking, { ...PROPS, ...over }));

describe("the booking page as the server renders it", () => {
  it("is the single form: every step in order, none hidden, no wizard chrome", () => {
    const html = booking();
    const at = ["when", "size", "details", "review", "pay"].map((id) =>
      html.indexOf(`data-step="${id}"`),
    );
    for (let i = 1; i < at.length; i += 1) {
      expect(at[i]).toBeGreaterThan(at[i - 1]);
    }
    expect(at[0]).toBeGreaterThan(-1);
    expect(html).not.toMatch(/<section[^>]*hidden/);
    expect(html).not.toContain("kw-progress");
    expect(html).not.toContain("kw-nav");
    expect(html).not.toMatch(/name="consent\w+"[^>]*checked=""/);
  });

  it("prints the server's default rule once, its deadline, and echoes it", () => {
    const html = booking();
    expect(html.split(DEFAULT[0])).toHaveLength(2);
    expect(html.split(DEFAULT[1])).toHaveLength(2);
    expect(html).toContain("Ücretsiz iptal için son an: 30 Ekim 2026, 18:00.");
    expect(html).toMatch(/name="expectedFreeCancelHours" value="2"/);
    expect(html).toMatch(/name="expectedLateRefundPercent" value="0"/);
  });

  it("prints another policy the server sends, never the fixed one", () => {
    const html = booking({
      availability: {
        ...AVAILABILITY,
        freeCancelHours: 24,
        lateRefundPercent: 50,
        cancellationRules: [...HALF],
      },
    });
    expect(html).toContain(esc(HALF[0]));
    expect(html).toContain(esc(HALF[1]));
    expect(html).not.toContain(DEFAULT[0]);
    expect(html).not.toContain("2 saat");
    expect(html).toContain("son an: 29 Ekim 2026, 20:00.");
    // Half of 1.000₺ back on a late cancel, before the start.
    expect(html).toContain("edersen 500₺ kartına iade edilir");
    expect(html).toMatch(/name="expectedFreeCancelHours" value="24"/);
    expect(html).toMatch(/name="expectedLateRefundPercent" value="50"/);
  });

  it("tonight inside the window, says the free cancel is gone instead of naming a past moment", () => {
    // 19:30 Tuzla, 20:00 picked, two free hours: 18:00 is behind the clock.
    const html = booking({ now: "2026-10-30T16:30:00.000Z" });
    expect(html).not.toContain("Ücretsiz iptal için son an");
    expect(html).toContain(
      "Seçtiğin saat için ücretsiz iptal süresi geçti; yapacağın her iptal geç iptal sayılır.",
    );
    // Earlier in the day the moment is still ahead and named.
    expect(booking({ now: "2026-10-30T09:00:00.000Z" })).toContain(
      "Ücretsiz iptal için son an: 30 Ekim 2026, 18:00.",
    );
    expect(read("src/app/karaoke/page.tsx")).toContain(
      "now={now.toISOString()}",
    );
  });

  it("without a free window, the late share follows no moment", () => {
    const NONE = karaokeCancellationRules({
      freeCancelHours: 0,
      lateRefundPercent: 50,
    }).rules;
    const html = booking({
      availability: {
        ...AVAILABILITY,
        freeCancelHours: 0,
        lateRefundPercent: 50,
        cancellationRules: [...NONE],
      },
    });
    expect(html).toContain(esc(NONE[0]));
    expect(html).not.toContain("Ücretsiz iptal için son an");
    expect(html).not.toContain("Sonrasında");
    expect(html).toContain(
      "Rezervasyon saatinden önce iptal edersen 500₺ kartına iade edilir.",
    );
    // With a window it follows the named moment.
    expect(
      booking({
        availability: {
          ...AVAILABILITY,
          freeCancelHours: 24,
          lateRefundPercent: 50,
          cancellationRules: [...HALF],
        },
      }),
    ).toContain(
      "Sonrasında, rezervasyon saatinden önce iptal edersen 500₺ kartına iade edilir.",
    );
  });

  it("without a readable rule, echoes nothing and says so", () => {
    const html = booking({
      availability: { ...AVAILABILITY, cancellationRules: [] },
    });
    expect(html).not.toContain("expectedFreeCancelHours");
    expect(html).toContain("İptal kuralını şu an okuyamadık");
  });

  it("puts the KDV inside the total next to it, quiet, from the server's rate", () => {
    const html = booking();
    // 1.000₺ at 20 % included: in the pre-payment box, on Ödeme and in the
    // summary card (the phone bar joins them after hydration).
    const note = "%20 KDV dahil (KDV 166,67₺)";
    expect(text(html).split(note)).toHaveLength(4);
    expect(html).toContain(
      '<span class="kw-kdv"><span class="kdv-part">%20 KDV dahil</span> <span class="kdv-part">(KDV 166,67₺)</span></span>',
    );
    expect(html).toMatch(
      /class="karaoke-kdv"><span><span class="kdv-part">%20 KDV dahil/,
    );
    const rate10 = booking({
      availability: { ...AVAILABILITY, taxRatePct: 10 },
    });
    expect(text(rate10)).toContain("%10 KDV dahil (KDV 90,91₺)");
    expect(rate10).not.toContain("%20");
  });

  it("shows what is bought, its price and no withdrawal right beside the pay button", () => {
    // MSY m.6/2-a: (a), (d) and (h) together, right before the obligation.
    const html = booking();
    const pay = html.slice(html.indexOf('data-step="pay"'));
    const button = pay.indexOf("Rezervasyonu onayla ve 1.000₺ öde");
    expect(button).toBeGreaterThan(-1);
    const box = pay.slice(0, button);
    expect(box).toContain("Karaoke odası · 30 Ekim 2026, 20:00 - 21:00");
    expect(box).toContain("Ödenecek toplam");
    expect(text(box)).toContain("%20 KDV dahil (KDV 166,67₺)");
    expect(box).toContain("cayma hakkı yoktur (MSY m.15/1-g)");
    expect(pay).toContain("ödeme yükümlülüğü altına girersin");
    // The boxes come before the pay step, inside Özet ve onay.
    expect(html.indexOf('name="consentKvkk"')).toBeLessThan(
      html.indexOf('data-step="pay"'),
    );
  });

  it("names the seller with title and tax number, and leaves out what is unknown", () => {
    expect(text(booking())).toContain(
      "Satıcı: NEXTGEN YAZILIM LİMİTED ŞİRKETİ (L&#x27;Affogato), VKN 6312110904, Postane Mah. Atatürk Cad. No: 28, Tuzla, +90 536 429 09 19.",
    );
    expect(text(booking({ sellerName: "", taxNo: "" }))).toContain(
      "Satıcı: L&#x27;Affogato, Postane Mah. Atatürk Cad. No: 28, Tuzla, +90 536 429 09 19.",
    );
    const page = read("src/app/karaoke/page.tsx");
    expect(page).toContain("sellerName={LEGAL_ENTITY.legalName}");
    expect(page).toContain("taxNo={LEGAL_ENTITY.taxNo}");
    expect(read("src/components/laffogato/karaoke-booking.tsx")).not.toMatch(
      /legal\/entity/,
    );
  });

  it("asks a visitor who must sign in on Bilgilerin, with no booking steps after it", () => {
    const html = booking({ prepay: false });
    const details = html.slice(html.indexOf('data-step="details"'));
    expect(details).toContain("Giriş yap ve rezerve et");
    expect(html).not.toContain('data-step="review"');
    expect(html).not.toContain('type="submit"');
  });
});

describe("the booking's own page reads its snapshot", () => {
  const BASE = {
    id: "krk-00042",
    date: "2026-10-30",
    startHour: 20,
    hours: 2,
    guests: 4,
    status: "confirmed" as "requested" | "confirmed" | "cancelled",
    paymentStatus: "paid",
    priceMinor: 200_000,
    discountMinor: 0,
    totalMinor: 200_000,
    paidMinor: 200_000,
    createdAt: "2026-10-16T10:00:00.000Z",
    customerName: "Eda",
    taxRatePct: 20 as number | null,
  };
  type R = Parameters<typeof KaraokeReservationView>[0]["r"];
  const view = (over: Partial<R> = {}, now: Date, confirming = false) =>
    renderToStaticMarkup(
      createElement(KaraokeReservationView, {
        r: { ...BASE, ...over },
        now,
        hidden: { id: "krk-00042" },
        cancelAction: async () => {},
        payAction: async () => {},
        cancelHref: "/x?iptal=1",
        backHref: "/x",
        confirming,
      }),
    );
  const early = new Date("2026-10-28T10:00:00.000Z");
  const dayBefore = new Date("2026-10-30T10:00:00.000Z"); // 13:00 Tuzla
  const late = new Date("2026-10-30T15:30:00.000Z"); // 18:30 Tuzla
  const HALF_SNAPSHOT = {
    freeCancelHours: 24,
    lateRefundPercent: 50,
    cancelDeadline: "2026-10-29T17:00:00.000Z",
    cancellationRules: [...HALF],
  };

  it("a booking from before the snapshot prints the default rule and the KDV inside its total", () => {
    const html = view({}, early);
    expect(html).toContain(DEFAULT[0]);
    expect(html).toContain(DEFAULT[1]);
    expect(text(html)).toContain("%20 KDV dahil (KDV 333,33₺)");
    expect(html).toContain("Ücretsiz iptal için son an: 30 Ekim 2026, 18:00.");
    expect(view({ taxRatePct: null }, early)).not.toMatch(/%\d+ KDV/);
  });

  it("prints the sentences the booking was shown, not today's", () => {
    const stored = ["Kendi kuralının ilk cümlesi.", "Kendi ikinci cümlesi."];
    const html = view({ ...HALF_SNAPSHOT, cancellationRules: stored }, early);
    expect(html).toContain(stored[0]);
    expect(html).toContain(stored[1]);
    expect(html).not.toContain(DEFAULT[0]);
    // The deadline the snapshot stored, on its own day.
    expect(html).toContain("son an: 29 Ekim 2026, 20:00.");
  });

  it("inside the window, a late share is offered for its amount, refunded by hand", () => {
    const html = view(HALF_SNAPSHOT, dayBefore, true);
    expect(html).toContain(esc(HALF[1]));
    expect(html).toContain(
      "rezervasyonundaki geç iptal kuralına göre 1.000₺ kartına iade edilir",
    );
    expect(html).toContain("Evet, iptal et");
    expect(html).not.toContain("Ücretsiz iptal için son an");
  });

  it("with no late share, says so, offers no confirm, and names the way out", () => {
    const html = view({}, late, true);
    expect(html).toContain(DEFAULT[1]);
    expect(html).not.toContain("Evet, iptal et");
    expect(html).toContain(
      "Gelemeyeceksen rezervasyon kodunu bir başkasına verebilirsin; odayı o kullanır.",
    );
  });

  it("a cancelled booking shows the share it gets back", () => {
    const html = view(
      {
        ...HALF_SNAPSHOT,
        status: "cancelled",
        paymentStatus: "refunding",
        refundMinor: 100_000,
      },
      dayBefore,
    );
    expect(html).toContain("Geç iptal iadesi");
    expect(html).toContain("1.000₺");
    expect(html).toContain("Ekibimiz kartına iade edince");
  });

  it("works out the cancel the way the server does", () => {
    const r = { ...BASE, ...HALF_SNAPSHOT };
    expect(karaokeCancelOutcome(r, early)).toEqual({
      kind: "full",
      amountMinor: 200_000,
    });
    expect(karaokeCancelOutcome(r, dayBefore)).toEqual({
      kind: "share",
      amountMinor: 100_000,
    });
    // Never confirmed by the köşk: back in full, late or not.
    expect(
      karaokeCancelOutcome({ ...r, status: "requested" }, dayBefore),
    ).toEqual({ kind: "full", amountMinor: 200_000 });
    // 100 %: the whole payment, through the POS.
    expect(
      karaokeCancelOutcome({ ...r, lateRefundPercent: 100 }, dayBefore),
    ).toEqual({ kind: "full", amountMinor: 200_000 });
    expect(
      karaokeCancelOutcome({ ...r, paymentStatus: "none" }, dayBefore),
    ).toEqual({ kind: "nothing" });
    expect(karaokeCancelOutcome(BASE, late)).toEqual({ kind: "refused" });
    // The last moment itself (18:00 Tuzla) is still a full refund, and the
    // page names it; a millisecond later the default rule refuses.
    const deadline = new Date("2026-10-30T15:00:00.000Z");
    expect(karaokeCancelOutcome(BASE, deadline)).toEqual({
      kind: "full",
      amountMinor: 200_000,
    });
    expect(view({}, deadline)).toContain(
      "Ücretsiz iptal için son an: 30 Ekim 2026, 18:00.",
    );
    expect(
      karaokeCancelOutcome(BASE, new Date(deadline.getTime() + 1)),
    ).toEqual({ kind: "refused" });
    // From the start on, nothing is refunded whatever the share.
    expect(
      karaokeCancelOutcome(r, new Date("2026-10-30T17:00:00.000Z")),
    ).toEqual({ kind: "refused" });
  });

  it("the pages show a late-cancel refusal in the booking's own words", () => {
    for (const file of [
      "src/app/rezervasyon/page.tsx",
      "src/app/uye/hesap/karaoke/[id]/page.tsx",
    ]) {
      const src = read(file);
      expect(src, file).toContain("karaokeNoticeFor(q.hata, r)");
      expect(src, file).not.toContain("KARAOKE_RESULT_NOTICES[");
    }
  });
});

describe("the files this change adds", () => {
  it("carry no long dash", () => {
    for (const file of [
      "src/components/laffogato/karaoke-wizard.ts",
      "src/components/laffogato/karaoke-terms.ts",
      "src/components/laffogato/kdv-note.ts",
      "src/components/laffogato/karaoke-booking.tsx",
      "src/components/uye/karaoke-reservation-view.tsx",
      "tests/karaoke-wizard.test.ts",
    ]) {
      expect(read(file), file).not.toMatch(/[\u2013\u2014]/);
    }
  });
});

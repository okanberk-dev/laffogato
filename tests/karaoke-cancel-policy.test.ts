import { describe, expect, it } from "vitest";

/**
 * The karaoke cancellation policy set from the panel (P2a; operator, 17 Eki
 * 2026: "para tutarı iade edilir kısmını da panelden ayarla"), its pure
 * half: the sentences, the Turkish suffix, the snapshot read back, the
 * deadline, what a member's own cancel gets, the panel's limits, the app
 * lock, the karaoke document and its version. Since 28 Eki 2026 (operator:
 * "karaoke için 2 saat içinde iptal etmezse iade olamaz") the free window
 * is counted from the BOOKING and never reaches past the start; a row from
 * before the 18 Eki snapshot keeps the rule it was shown (the start minus
 * the window, the legacy pair). The money paths are
 * tests/karaoke-late-cancel.test.ts; the panel's action is
 * tests/admin-karaoke-cancel-policy.test.ts.
 */

const time = await import("@/lib/mobile/karaoke-time");
const { toReservationJson } = await import("@/lib/mobile/karaoke-core");
const { karaokePolicyVersion } = await import("@/lib/legal/consent-version");
const { KARAOKE_ROOM_DOC } = await import("@/lib/legal/content-karaoke");
const { KARAOKE_LEGAL_UPDATED } = await import("@/lib/legal/meta");
const { cancelResultCode, karaokeNoticeFor, KARAOKE_RESULT_NOTICES } =
  await import("@/lib/mobile/karaoke-notices");

// The default pair of 28 Eki 2026, as karaoke-time.ts writes it.
const REFUND =
  "Rezervasyonu yaptığın andan itibaren 2 saat içinde, rezervasyon saati gelmeden iptal edersen ödediğin tutarın tamamı kartına iade edilir.";
const NO_REFUND =
  "Bu 2 saat geçtikten sonra yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.";
// The pair every booking made before the snapshot was shown
// (LEGACY_KARAOKE_RULES): the window counted back from the start.
const LEGACY_REFUND =
  "Rezervasyon saatine 2 saatten fazla varken iptal edersen ödediğin tutarın tamamı kartına iade edilir.";
const LEGACY_NO_REFUND =
  "Rezervasyon saatine 2 saatten az kala yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.";
// The refusal under a late share above 0: a cancel is accepted until the
// start, so only the no-show is refused.
const NO_SHOW_TOO_LATE =
  "Rezervasyon saati geldi; artık buradan iptal edemezsin. Rezervasyona gelinmediğinde ücret iadesi yapılmaz.";

const HOUR = 3600_000;
const MINUTE = 60_000;
// 30 Ekim 2026, 20:00 in Tuzla.
const booking = { date: "2026-10-30", startHour: 20, hours: 2 };
const START = Date.parse("2026-10-30T17:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

describe("the sentences of a policy", () => {
  it("are the operator's 28 Eki wording, byte for byte, under the default", () => {
    const text = time.karaokeCancellationRules(
      time.DEFAULT_KARAOKE_CANCEL_POLICY,
    );
    expect(text.refundRule).toBe(REFUND);
    expect(text.lateRule).toBe(NO_REFUND);
    expect(text.rules).toEqual([REFUND, NO_REFUND]);
    // The constants stay the default case of the helper.
    expect(time.KARAOKE_REFUND_RULE).toBe(text.refundRule);
    expect(time.KARAOKE_NO_REFUND_RULE).toBe(text.lateRule);
    expect(time.KARAOKE_TOO_LATE_MESSAGE).toBe(text.tooLateMessage);
    expect(text.tooLateMessage).toBe(
      `Artık buradan iptal edemezsin. ${NO_REFUND}`,
    );
    // Counted from the booking, not back from the start (the 16 Eki pair).
    expect(text.refundRule).not.toContain("saatten fazla varken");
    expect(text.lateRule).not.toContain("saatten az kala");
  });

  it("the legacy pair is the 16 Eki wording, kept verbatim for rows from before the snapshot", () => {
    expect(time.LEGACY_KARAOKE_RULES).toEqual([
      LEGACY_REFUND,
      LEGACY_NO_REFUND,
    ]);
    expect(time.LEGACY_KARAOKE_RULES).not.toEqual([REFUND, NO_REFUND]);
  });

  it("(24, 50): the share with its possessive suffix", () => {
    const text = time.karaokeCancellationRules({
      freeCancelHours: 24,
      lateRefundPercent: 50,
    });
    expect(text.rules).toEqual([
      "Rezervasyonu yaptığın andan itibaren 24 saat içinde, rezervasyon saati gelmeden iptal edersen ödediğin tutarın tamamı kartına iade edilir.",
      "Bu 24 saat geçtikten sonra, rezervasyon saati gelmeden yapılan iptalde ödediğin tutarın %50'si en geç 14 gün içinde kartına iade edilir; rezervasyona gelinmediğinde ücret iadesi yapılmaz. Geç iptal ettiğin saat başka bir misafire satılırsa o saat için sende kalan tutar da kartına iade edilir.",
    ]);
    // A late cancel is accepted until the start: the refusal is the no-show.
    expect(text.tooLateMessage).toBe(NO_SHOW_TOO_LATE);
  });

  it("(3, 100): a late cancel refunds everything too, a no-show nothing", () => {
    const text = time.karaokeCancellationRules({
      freeCancelHours: 3,
      lateRefundPercent: 100,
    });
    expect(text.rules).toEqual([
      "Rezervasyonu yaptığın andan itibaren 3 saat içinde, rezervasyon saati gelmeden iptal edersen ödediğin tutarın tamamı kartına iade edilir.",
      "Bu 3 saat geçtikten sonra, rezervasyon saati gelmeden yapılan iptalde de ödediğin tutarın tamamı kartına iade edilir; rezervasyona gelinmediğinde ücret iadesi yapılmaz.",
    ]);
    expect(text.tooLateMessage).toBe(NO_SHOW_TOO_LATE);
  });

  it("(1, 0): the floor of the window reads as one hour", () => {
    const text = time.karaokeCancellationRules({
      freeCancelHours: 1,
      lateRefundPercent: 0,
    });
    expect(text.rules).toEqual([
      "Rezervasyonu yaptığın andan itibaren 1 saat içinde, rezervasyon saati gelmeden iptal edersen ödediğin tutarın tamamı kartına iade edilir.",
      "Bu 1 saat geçtikten sonra yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.",
    ]);
    // With no late share the refusal repeats the rule.
    expect(text.tooLateMessage).toBe(
      `Artık buradan iptal edemezsin. ${text.lateRule}`,
    );
  });

  it("never carries a long dash", () => {
    for (const h of [1, 2, 24, 72]) {
      for (const p of [0, 1, 25, 50, 99, 100]) {
        const t = time.karaokeCancellationRules({
          freeCancelHours: h,
          lateRefundPercent: p,
        });
        for (const s of [t.refundRule, t.lateRule, t.tooLateMessage]) {
          expect(s).not.toMatch(/[–—]/);
        }
      }
    }
    for (const s of time.LEGACY_KARAOKE_RULES) expect(s).not.toMatch(/[–—]/);
  });
});

describe("percentPossessive: the suffix follows the last number word", () => {
  it.each([
    [1, "%1'i"],
    [2, "%2'si"],
    [3, "%3'ü"],
    [4, "%4'ü"],
    [5, "%5'i"],
    [6, "%6'sı"],
    [7, "%7'si"],
    [8, "%8'i"],
    [9, "%9'u"],
    [10, "%10'u"],
    [20, "%20'si"],
    [25, "%25'i"],
    [30, "%30'u"],
    [40, "%40'ı"],
    [50, "%50'si"],
    [60, "%60'ı"],
    [70, "%70'i"],
    [75, "%75'i"],
    [80, "%80'i"],
    [90, "%90'ı"],
    [99, "%99'u"],
    [100, "%100'ü"],
  ])("%i -> %s", (p, expected) => {
    expect(time.percentPossessive(p)).toBe(expected);
  });
});

describe("the snapshot read back", () => {
  it("a row from before the snapshot (NULL) is 2 hours / 0 % and the legacy pair", () => {
    expect(time.karaokeCancelPolicyOf({})).toEqual({
      freeCancelHours: 2,
      lateRefundPercent: 0,
    });
    expect(
      time.karaokeCancelPolicyOf({
        freeCancelHours: null,
        lateRefundPercent: null,
      }),
    ).toEqual({ freeCancelHours: 2, lateRefundPercent: 0 });
    // Such a row was booked under the sentence counted back from the start
    // and keeps it: never today's default pair (TKHK m.4/2).
    expect(time.karaokeRulesOf({})).toEqual([LEGACY_REFUND, LEGACY_NO_REFUND]);
    expect(time.karaokeRulesOf({})).toEqual([...time.LEGACY_KARAOKE_RULES]);
    expect(time.karaokeRulesOf({})).not.toEqual([
      time.KARAOKE_REFUND_RULE,
      time.KARAOKE_NO_REFUND_RULE,
    ]);
  });

  it("a stored policy is the booking's, whatever the panel says now", () => {
    expect(
      time.karaokeCancelPolicyOf({
        freeCancelHours: 24,
        lateRefundPercent: 50,
      }),
    ).toEqual({ freeCancelHours: 24, lateRefundPercent: 50 });
    expect(
      time.karaokeCancelPolicyOf({
        freeCancelHours: 1,
        lateRefundPercent: 100,
      }),
    ).toEqual({ freeCancelHours: 1, lateRefundPercent: 100 });
    // Out of range reads as the default for that number, never as itself.
    expect(
      time.karaokeCancelPolicyOf({
        freeCancelHours: 900,
        lateRefundPercent: -5,
      }),
    ).toEqual({ freeCancelHours: 2, lateRefundPercent: 0 });
    // A 0 from the days 0 meant "free until the start" (ASK-OTH-3-CFG) is
    // out of range since 28 Eki 2026 and reads as 2 as well; such a row's
    // own deadline and sentences are stored and still win.
    expect(time.KARAOKE_FREE_CANCEL_HOURS_MIN).toBe(1);
    expect(
      time.karaokeCancelPolicyOf({
        freeCancelHours: 0,
        lateRefundPercent: 0,
      }),
    ).toEqual({ freeCancelHours: 2, lateRefundPercent: 0 });
  });

  it("the stored sentences are printed, not recomputed", () => {
    const shown: [string, string] = ["Birinci cümle.", "İkinci cümle."];
    expect(
      time.karaokeRulesOf({
        freeCancelHours: 24,
        lateRefundPercent: 50,
        cancellationRules: shown,
      }),
    ).toEqual(shown);
    // A pair that is not two non-empty sentences is no snapshot: the row
    // reads as one from before it, in its own policy's legacy words.
    expect(
      time.karaokeRulesOf({
        freeCancelHours: 24,
        lateRefundPercent: 50,
        cancellationRules: ["", "İkinci cümle."],
      }),
    ).toEqual(
      time.legacyKaraokeCancellationRules({
        freeCancelHours: 24,
        lateRefundPercent: 50,
      }),
    );
    expect(
      time.karaokeRulesOf({ cancellationRules: ["", "İkinci cümle."] }),
    ).toEqual([LEGACY_REFUND, LEGACY_NO_REFUND]);
  });
});

describe("the deadline and a member's own cancel (28 Eki 2026: the window counts from the booking)", () => {
  it("a legacy row: two hours before the start, the moment itself included", () => {
    expect(time.karaokeCancelDeadline(booking).getTime()).toBe(
      START - 2 * HOUR,
    );
    expect(time.withinFreeCancel(booking, new Date(START - 2 * HOUR - 1))).toBe(
      true,
    );
    // `cancellableUntil` is the last moment of a full refund (ASK-Y3-4),
    // and the pages name it to the minute: 18:00 lasts until 18:00:59.999.
    expect(time.withinFreeCancel(booking, new Date(START - 2 * HOUR))).toBe(
      true,
    );
    expect(
      time.withinFreeCancel(booking, new Date(START - 2 * HOUR + 59_999)),
    ).toBe(true);
    expect(
      time.withinFreeCancel(booking, new Date(START - 2 * HOUR + 60_000)),
    ).toBe(false);
  });

  it("a legacy row keeps the rule it was shown: the start minus its hours, the legacy pair", () => {
    // No deadline and no sentences (made before the 18 Eki snapshot): never
    // the booking-based window, whatever its making says (TKHK m.4/2).
    const legacy = { ...booking, createdAt: "2026-10-20T09:00:00.000Z" };
    expect(time.karaokeCancelDeadline(legacy).getTime()).toBe(START - 2 * HOUR);
    expect(time.karaokeRulesOf({ ...legacy, cancellationRules: null })).toEqual(
      [LEGACY_REFUND, LEGACY_NO_REFUND],
    );
    // Its own hours, still back from the start; a stored 0 reads as 2.
    expect(
      time.karaokeCancelDeadline({ ...legacy, freeCancelHours: 5 }).getTime(),
    ).toBe(START - 5 * HOUR);
    expect(
      time.karaokeCancelDeadline({ ...legacy, freeCancelHours: 0 }).getTime(),
    ).toBe(START - 2 * HOUR);
  });

  it("a new booking's deadline: the booking instant plus the window", () => {
    const policy = { freeCancelHours: 24, lateRefundPercent: 50 };
    const bookedAt = new Date(START - 72 * HOUR);
    expect(time.karaokeDeadlineFor(policy, booking, bookedAt).getTime()).toBe(
      START - 48 * HOUR,
    );
    // Not the start minus the window any more (the rule until 28 Eki 2026).
    expect(
      time.karaokeDeadlineFor(policy, booking, bookedAt).getTime(),
    ).not.toBe(START - 24 * HOUR);
    expect(
      time
        .karaokeDeadlineFor(
          time.DEFAULT_KARAOKE_CANCEL_POLICY,
          booking,
          bookedAt,
        )
        .getTime(),
    ).toBe(START - 70 * HOUR);
  });

  it("caps at the start: booked 90 minutes before the start with 2 hours", () => {
    const policy = time.DEFAULT_KARAOKE_CANCEL_POLICY;
    expect(
      time
        .karaokeDeadlineFor(policy, booking, new Date(START - 90 * MINUTE))
        .getTime(),
    ).toBe(START);
    // Booked exactly the window before the start: the start too.
    expect(
      time
        .karaokeDeadlineFor(policy, booking, new Date(START - 2 * HOUR))
        .getTime(),
    ).toBe(START);
    // A minute more than the window before: a minute before the start.
    expect(
      time
        .karaokeDeadlineFor(
          policy,
          booking,
          new Date(START - 2 * HOUR - MINUTE),
        )
        .getTime(),
    ).toBe(START - MINUTE);
  });

  it("an unreadable booking instant places no window: the start", () => {
    const policy = time.DEFAULT_KARAOKE_CANCEL_POLICY;
    expect(
      time.karaokeDeadlineFor(policy, booking, new Date(Number.NaN)).getTime(),
    ).toBe(START);
    expect(
      time
        .karaokeDeadlineFor(policy, booking, new Date("not an instant"))
        .getTime(),
    ).toBe(START);
  });

  it("the start is never in the window, even where the deadline is the start", () => {
    // Booked inside the window before its start: the snapshot's deadline is
    // the start, and from the start on a cancel is refused, as before.
    const r = {
      ...booking,
      freeCancelHours: 2,
      lateRefundPercent: 50,
      createdAt: iso(START - 90 * MINUTE),
      cancelDeadline: iso(START),
    };
    expect(time.karaokeCancelDeadline(r).getTime()).toBe(START);
    expect(time.withinFreeCancel(r, new Date(START - 1))).toBe(true);
    expect(time.withinFreeCancel(r, new Date(START))).toBe(false);
    expect(time.karaokeSelfCancelTerms(r, new Date(START - 1))).toEqual({
      kind: "full",
    });
    expect(time.karaokeSelfCancelTerms(r, new Date(START))).toEqual({
      kind: "refused",
    });
  });

  it("a stored deadline counts the same way, through the minute it names", () => {
    const r = {
      ...booking,
      freeCancelHours: 2,
      cancelDeadline: "2026-10-30T15:00:00.000Z",
    };
    const deadline = Date.parse(r.cancelDeadline);
    expect(time.withinFreeCancel(r, new Date(deadline))).toBe(true);
    expect(time.withinFreeCancel(r, new Date(deadline + 59_999))).toBe(true);
    expect(time.withinFreeCancel(r, new Date(deadline + 60_000))).toBe(false);
  });

  it("the stored deadline wins over the hours and the booking instant", () => {
    const r = {
      ...booking,
      freeCancelHours: 2,
      createdAt: "2026-10-20T09:00:00.000Z",
      cancelDeadline: "2026-10-29T17:00:00.000Z",
    };
    expect(time.karaokeCancelDeadline(r).toISOString()).toBe(
      "2026-10-29T17:00:00.000Z",
    );
  });

  describe("karaokeMovedDeadline: the panel moves the booking to another slot", () => {
    const later = { date: "2026-10-31", startHour: 20 };
    const LATER_START = START + 24 * HOUR;

    it("moved later gives the rest of the window back: the making plus the hours", () => {
      // Booked an hour before its start: the window had ended at the start.
      const close = {
        ...booking,
        freeCancelHours: 2,
        lateRefundPercent: 0,
        createdAt: iso(START - HOUR),
        cancelDeadline: iso(START),
      };
      expect(time.karaokeMovedDeadline(close, later).getTime()).toBe(
        START - HOUR + 2 * HOUR,
      );
      // A window that had not been cut keeps its end.
      const early = {
        ...close,
        createdAt: iso(START - 10 * HOUR),
        cancelDeadline: iso(START - 8 * HOUR),
      };
      expect(time.karaokeMovedDeadline(early, later).getTime()).toBe(
        START - 8 * HOUR,
      );
      // Its own policy's hours, not the panel's current ones.
      expect(
        time
          .karaokeMovedDeadline({ ...early, freeCancelHours: 24 }, later)
          .getTime(),
      ).toBe(START - 10 * HOUR + 24 * HOUR);
    });

    it("moved earlier caps at the new start", () => {
      const early = {
        ...booking,
        freeCancelHours: 2,
        lateRefundPercent: 0,
        createdAt: iso(START - 10 * HOUR),
        cancelDeadline: iso(START - 8 * HOUR),
      };
      // 11:00 the same day: nine hours before the old start.
      expect(
        time
          .karaokeMovedDeadline(early, { date: "2026-10-30", startHour: 11 })
          .getTime(),
      ).toBe(START - 9 * HOUR);
      // Moved a day later: never past that start either.
      expect(
        time
          .karaokeMovedDeadline(
            { ...early, freeCancelHours: 72 },
            { date: "2026-10-31", startHour: 20 },
          )
          .getTime(),
      ).toBe(LATER_START);
    });

    it("an unreadable making keeps the stored deadline, capped at the new start", () => {
      const r = {
        ...booking,
        freeCancelHours: 2,
        lateRefundPercent: 0,
        createdAt: "garbage",
        cancelDeadline: iso(START - 8 * HOUR),
      };
      expect(time.karaokeMovedDeadline(r, later).getTime()).toBe(
        START - 8 * HOUR,
      );
      expect(
        time
          .karaokeMovedDeadline(r, { date: "2026-10-30", startHour: 11 })
          .getTime(),
      ).toBe(START - 9 * HOUR);
      expect(
        time
          .karaokeMovedDeadline({ ...r, createdAt: undefined }, later)
          .getTime(),
      ).toBe(START - 8 * HOUR);
    });
  });

  it("refused after the window at 0 %, a late share at 1..100 until the start", () => {
    const at = (h: number) => new Date(START - h * HOUR);
    const legacy = { ...booking };
    expect(time.karaokeSelfCancelTerms(legacy, at(3))).toEqual({
      kind: "full",
    });
    expect(time.karaokeSelfCancelTerms(legacy, at(1))).toEqual({
      kind: "refused",
    });

    // Booked three days ahead under 24 h / 50 %: the window ends a day
    // after the booking, two days before the start.
    const made = START - 72 * HOUR;
    const half = {
      ...booking,
      freeCancelHours: 24,
      lateRefundPercent: 50,
      createdAt: iso(made),
      cancelDeadline: iso(made + 24 * HOUR),
    };
    expect(time.karaokeSelfCancelTerms(half, at(49))).toEqual({ kind: "full" });
    // Under the rule until 28 Eki 2026 (the start minus 24 hours) a cancel
    // 25 hours before the start was still free; now it is late.
    expect(time.karaokeSelfCancelTerms(half, at(25))).toEqual({
      kind: "late",
      percent: 50,
    });
    expect(time.karaokeSelfCancelTerms(half, at(10))).toEqual({
      kind: "late",
      percent: 50,
    });
    // The start has come: not turning up refunds nothing.
    expect(time.karaokeSelfCancelTerms(half, at(0))).toEqual({
      kind: "refused",
    });

    const all = {
      ...booking,
      freeCancelHours: 3,
      lateRefundPercent: 100,
      createdAt: iso(made),
      cancelDeadline: iso(made + 3 * HOUR),
    };
    expect(time.karaokeSelfCancelTerms(all, at(1))).toEqual({
      kind: "late",
      percent: 100,
    });

    // Under the default, booked five hours before: late from two hours
    // after the booking, with nothing back - the operator's case.
    const five = {
      ...booking,
      freeCancelHours: 2,
      lateRefundPercent: 0,
      createdAt: iso(START - 5 * HOUR),
      cancelDeadline: iso(START - 3 * HOUR),
    };
    expect(time.karaokeSelfCancelTerms(five, at(4))).toEqual({ kind: "full" });
    expect(time.karaokeSelfCancelTerms(five, at(2.5))).toEqual({
      kind: "refused",
    });
  });

  it("the share is round(paid × P / 100), in kuruş", () => {
    expect(time.karaokeLateRefundMinor(200_000, 50)).toBe(100_000);
    expect(time.karaokeLateRefundMinor(199_999, 50)).toBe(100_000);
    expect(time.karaokeLateRefundMinor(100_001, 25)).toBe(25_000);
    expect(time.karaokeLateRefundMinor(0, 50)).toBe(0);
    expect(time.karaokeLateRefundMinor(200_000, 0)).toBe(0);
  });

  it("what goes back: the share when one is set, else the whole payment", () => {
    expect(
      time.refundAmountOf({ paidMinor: 200_000, totalMinor: 200_000 }),
    ).toBe(200_000);
    expect(
      time.refundAmountOf({
        paidMinor: 200_000,
        totalMinor: 200_000,
        refundMinor: 100_000,
      }),
    ).toBe(100_000);
    expect(
      time.isPartialRefund({ paidMinor: 200_000, refundMinor: 100_000 }),
    ).toBe(true);
    expect(
      time.isPartialRefund({ paidMinor: 200_000, refundMinor: null }),
    ).toBe(false);
  });
});

describe("the panel's limits: the two ranges, no fairness coupling (28 Eki 2026)", () => {
  const refuse = (h: number, p: number) =>
    time.karaokeCancelPolicyRefusal({
      freeCancelHours: h,
      lateRefundPercent: p,
    });

  it("accepts 1 to 72 hours with any share", () => {
    expect(refuse(2, 0)).toBeNull();
    expect(refuse(1, 0)).toBeNull();
    expect(refuse(1, 100)).toBeNull();
    expect(refuse(72, 0)).toBeNull();
    expect(refuse(72, 100)).toBeNull();
    expect(refuse(24, 0)).toBeNull();
    expect(refuse(24, 100)).toBeNull();
  });

  it("the 24 h / 50 % coupling is gone on purpose: a longer window counted from the booking favours the member", () => {
    // These were refused while the window was counted back from the start
    // (Haksız Şartlar Yön. m.5/1, EK (ç), (d); TBK m.182/3); see the
    // function's comment and docs/LEGAL-REDLINES-2026-09.md §37.
    expect(refuse(48, 0)).toBeNull();
    expect(refuse(30, 10)).toBeNull();
    expect(refuse(25, 0)).toBeNull();
    expect(refuse(30, 40)).toBeNull();
    expect(refuse(25, 49)).toBeNull();
  });

  it("a share of 1..99 % is open now the resale refund is built (D-KAR-1-99)", () => {
    // The panel offered only 0 or 100 until an hour cancelled late and sold
    // again refunded what was kept for it (karaoke-make-good-core.ts).
    expect(refuse(2, 1)).toBeNull();
    expect(refuse(24, 50)).toBeNull();
    expect(refuse(30, 50)).toBeNull();
    expect(refuse(1, 10)).toBeNull();
    expect(refuse(72, 99)).toBeNull();
    expect(time).not.toHaveProperty("KARAOKE_PARTIAL_LATE_REFUND_OPEN");
    expect(time).not.toHaveProperty("KARAOKE_PARTIAL_LATE_REFUND_CLOSED");
  });

  it("0 hours is out of range: every window is at least an hour", () => {
    // "0 = free until the start" (ASK-OTH-3-CFG) is gone with the window
    // counted from the booking.
    expect(refuse(0, 0)).toEqual({
      field: "karaokeFreeCancelHours",
      message: "Ücretsiz iptal süresi 1 ile 72 saat arasında tam sayı olmalı.",
    });
    expect(refuse(0, 100)).toMatchObject({ field: "karaokeFreeCancelHours" });
    expect(refuse(0, 10)).toMatchObject({ field: "karaokeFreeCancelHours" });
  });

  it("refuses what is out of range", () => {
    expect(refuse(73, 100)).toMatchObject({ field: "karaokeFreeCancelHours" });
    expect(refuse(73, 0)).toMatchObject({ field: "karaokeFreeCancelHours" });
    expect(refuse(-1, 0)).toMatchObject({ field: "karaokeFreeCancelHours" });
    expect(refuse(2.5, 0)).toMatchObject({ field: "karaokeFreeCancelHours" });
    expect(refuse(2, 101)).toEqual({
      field: "karaokeLateRefundPercent",
      message: "Geç iptalde iade oranı 0 ile 100 arasında tam sayı olmalı.",
    });
    expect(refuse(2, -1)).toMatchObject({ field: "karaokeLateRefundPercent" });
    expect(refuse(2, 0.5)).toMatchObject({ field: "karaokeLateRefundPercent" });
    // The hours are judged first.
    expect(refuse(0, 101)).toMatchObject({ field: "karaokeFreeCancelHours" });
  });
});

describe("the app lock: no other rule while app builds print their own", () => {
  it("is shut while no app version reads the booking's rule", () => {
    expect(time.KARAOKE_POLICY_APP_VERSION).toBeNull();
    expect(time.karaokePolicyLockReason("9.9.9")).toMatch(/2 saat ve %0/);
  });

  it("opens only once the minimum app version reaches that build", () => {
    expect(time.karaokePolicyLockReason("1.0.0", "1.1.0")).toMatch(/1\.1\.0/);
    expect(time.karaokePolicyLockReason("1.1.0", "1.1.0")).toBeNull();
    expect(time.karaokePolicyLockReason("1.10.0", "1.9.0")).toBeNull();
    expect(time.karaokePolicyLockReason("1.9.9", "1.10.0")).not.toBeNull();
  });

  it("a new booking gets the default while shut, the panel's when open", () => {
    const settings = {
      karaokeFreeCancelHours: 24,
      karaokeLateRefundPercent: 50,
      mobileApp: { minSupportedAppVersion: "1.1.0" },
    };
    expect(time.effectiveKaraokeCancelPolicy(settings)).toEqual({
      freeCancelHours: 2,
      lateRefundPercent: 0,
    });
    // A stored share of 1..99 % takes effect once the app lock opens: the
    // resale refund is built.
    expect(time.effectiveKaraokeCancelPolicy(settings, "1.1.0")).toEqual({
      freeCancelHours: 24,
      lateRefundPercent: 50,
    });
    expect(
      time.effectiveKaraokeCancelPolicy(
        { ...settings, karaokeLateRefundPercent: 100 },
        "1.1.0",
      ),
    ).toEqual({ freeCancelHours: 24, lateRefundPercent: 100 });
    // A long window with nothing back takes effect too: no coupling since
    // 28 Eki 2026.
    expect(
      time.effectiveKaraokeCancelPolicy(
        {
          ...settings,
          karaokeFreeCancelHours: 48,
          karaokeLateRefundPercent: 0,
        },
        "1.1.0",
      ),
    ).toEqual({ freeCancelHours: 48, lateRefundPercent: 0 });
    // The minimum lowered after a save: shut again.
    expect(
      time.effectiveKaraokeCancelPolicy(
        { ...settings, mobileApp: { minSupportedAppVersion: "1.0.0" } },
        "1.1.0",
      ),
    ).toEqual({ freeCancelHours: 2, lateRefundPercent: 0 });
    // A stored 0 (out of range since 28 Eki 2026) never takes effect: it
    // reads as the default.
    expect(
      time.effectiveKaraokeCancelPolicy(
        {
          ...settings,
          karaokeFreeCancelHours: 0,
          karaokeLateRefundPercent: 50,
        },
        "1.1.0",
      ),
    ).toEqual({ freeCancelHours: 2, lateRefundPercent: 50 });
  });
});

describe("the wire shape (§7.1, additive)", () => {
  const row = {
    id: "krk-00042",
    customerEmail: "eda@example.com",
    customerName: "Eda",
    ...booking,
    guests: 4,
    status: "cancelled" as const,
    priceMinor: 200_000,
    discountMinor: 0,
    totalMinor: 200_000,
    note: "",
    createdAt: "2026-10-20T09:00:00.000Z",
    updatedAt: "2026-10-30T07:00:00.000Z",
    paymentStatus: "refunding" as const,
    paidMinor: 200_000,
  };

  it("a booking says its own rule, deadline and owed share", () => {
    const rules = time.karaokeCancellationRules({
      freeCancelHours: 24,
      lateRefundPercent: 50,
    }).rules;
    const json = toReservationJson({
      ...row,
      freeCancelHours: 24,
      lateRefundPercent: 50,
      cancelDeadline: "2026-10-21T09:00:00.000Z",
      cancellationRules: [...rules],
      refundMinor: 100_000,
    });
    expect(json).toMatchObject({
      cancellableUntil: "2026-10-21T09:00:00.000Z",
      freeCancelHours: 24,
      lateRefundPercent: 50,
      cancellationRules: rules,
      refundMinor: 100_000,
    });
  });

  it("a booking under the default: its stored deadline (two hours after booking) and the default pair", () => {
    const json = toReservationJson({
      ...row,
      freeCancelHours: 2,
      lateRefundPercent: 0,
      cancelDeadline: "2026-10-20T11:00:00.000Z",
      cancellationRules: [REFUND, NO_REFUND],
      refundMinor: null,
    });
    expect(json).toMatchObject({
      cancellableUntil: "2026-10-20T11:00:00.000Z",
      freeCancelHours: 2,
      lateRefundPercent: 0,
      cancellationRules: [REFUND, NO_REFUND],
      refundMinor: null,
    });
  });

  it("an older row reads 2 / 0, the legacy pair and no share", () => {
    expect(toReservationJson(row)).toMatchObject({
      // The start minus two hours: the rule such a row was shown.
      cancellableUntil: "2026-10-30T15:00:00.000Z",
      freeCancelHours: 2,
      lateRefundPercent: 0,
      cancellationRules: [LEGACY_REFUND, LEGACY_NO_REFUND],
      refundMinor: null,
    });
    expect(toReservationJson(row).cancellationRules).not.toEqual([
      REFUND,
      NO_REFUND,
    ]);
  });

  it("is written down in the contract the app reads (API-MOBILE §7.1)", async () => {
    const { readFileSync } = await import("node:fs");
    const doc = readFileSync("docs/API-MOBILE.md", "utf8");
    const section = doc.slice(
      doc.indexOf("**İptal ve iade kuralı panelden (18 Eki 2026"),
      doc.indexOf("## 8. Bildirimler"),
    );
    for (const field of [
      "`lateRefundPercent`",
      "`freeCancelHours`",
      "`cancellationRules`",
      "`refundMinor`",
      "`KARAOKE_POLICY_APP_VERSION`",
    ]) {
      expect(section, field).toContain(field);
    }
    // The köşk's own cancel is the whole payment; a guest's request it only
    // passes on follows the booking's rule (kept, or the late share).
    expect(section).not.toContain("köşkün iptali her zaman tam iadedir");
    expect(section).toContain("misafirin telefonla ya da e-postayla");
  });
});

describe("the karaoke document: one text for every policy (ASK-OTH-3-CFG)", () => {
  const section = (doc: typeof KARAOKE_ROOM_DOC, n: string) =>
    doc.sections.find((s) => s.heading.startsWith(`${n}. `))!;

  it("names no hours or percent: §7 and §10 point at the booking's summary", () => {
    expect(KARAOKE_ROOM_DOC.updatedAt).toBe(KARAOKE_LEGAL_UPDATED);
    const rules = JSON.stringify(
      ["7", "9", "10"].map((n) => section(KARAOKE_ROOM_DOC, n)),
    );
    // A text written from the panel's numbers froze them in any published
    // edit, against a booking's own snapshot.
    expect(rules).not.toMatch(/\d+ saatten (fazla|az)/);
    expect(rules).not.toMatch(/\d+ saat içinde/);
    expect(rules).not.toMatch(/%\d/);
    expect(section(KARAOKE_ROOM_DOC, "7").bullets?.[0]).toBe(
      "Rezervasyon özetinde gösterilen son ücretsiz iptal anına kadar (bu an dâhil) iptal ederseniz ödediğiniz tutarın tamamı kartınıza iade edilir. İptali hesabınızdaki Karaoke rezervasyonlarım bölümünden, e-postanızdaki kişiye özel bağlantıdan ya da mobil uygulamadan kendiniz yapabilir ya da bizi arayarak veya {{EMAIL}} adresine yazarak yaptırabilirsiniz.",
    );
    expect(section(KARAOKE_ROOM_DOC, "10").paragraphs?.[0]).toContain(
      "Hesabınızın kapatılmasını bizden talep ederseniz bu süreler talebinizin kaydedildiği ana göre hesaplanır.",
    );
    expect(JSON.stringify(KARAOKE_ROOM_DOC)).not.toMatch(/[–—]/);
  });

  it("says when a cancel by phone or e-mail counts (ASK-Y3-4)", () => {
    const text = JSON.stringify(section(KARAOKE_ROOM_DOC, "7"));
    expect(text).toContain(
      "Bizi arayarak yaptırdığınız iptalde görüşmenin yapıldığı an, e-postayla bildirdiğiniz iptalde e-postanızın gönderildiği an iptal anı sayılır.",
    );
    expect(text).toContain(
      "telefonumuzda görünen arama saatiniz iptal anı sayılır",
    );
    expect(text).toContain(
      "Telefonla verdiğiniz iptal isteğini aynı gün e-postayla teyit ederiz.",
    );
  });

  it("keeps the whole loss behind its four conditions, with no label (ASK-OTH-3)", () => {
    const seven = JSON.stringify(section(KARAOKE_ROOM_DOC, "7"));
    expect(seven).toContain(
      "rezervasyon kodunuzu bir başkasına verebilirsiniz",
    );
    expect(seven).toContain(
      "gelmediğiniz ya da iptal edemediğiniz bir saati başka bir misafire verirsek ödediğiniz tutarın tamamını iade ederiz",
    );
    expect(JSON.stringify(KARAOKE_ROOM_DOC)).not.toMatch(
      /götürü|cezai şart değildir/,
    );
    expect(section(KARAOKE_ROOM_DOC, "8").paragraphs).toEqual([
      "Rezervasyonunuzu yalnızca haklı bir sebeple (oda veya ekipman arızası, köşkün geçici olarak kapanması, mücbir sebep veya benzeri haklı bir sebep) iptal ederiz. Bu durumda size durumu öğrenir öğrenmez ve en geç 3 gün içinde e-postayla bildiririz; durumu rezervasyon saatinden önce öğrenmişsek bildirimi rezervasyon saatinden önce yapar, rezervasyonunuza 24 saatten az kalmışsa ve telefon numaranız kayıtlıysa ayrıca sizi ararız. Ödediğiniz tutarın tamamını bildirimden itibaren en geç 14 gün içinde ödemeyi yaptığınız karta iade ederiz; iade, iptalle birlikte PayNkolay üzerinden hemen başlatılır. Bu süreler Mesafeli Sözleşmeler Yönetmeliği m.16/4'teki en uzun sürelerdir ve iptalin her nedeninde uygulanır. Kanundan doğan tazminat haklarınız saklıdır.",
      // OP-KARAOKE-GOODWILL (19 Eki 2026): the late köşk cancel made good.
      // "ücretsiz iptal süresinin bittiği andan sonra" follows the window,
      // which since 28 Eki 2026 ends two hours after the booking (the
      // make-good then opens on nearly every business cancel; LEGAL-
      // REDLINES §37 asks the lawyer).
      "İptali, sizin için ücretsiz iptal süresinin bittiği andan sonra yapmak zorunda kalırsak, nedeni doğal afet, resmî makam kararı veya bölgesel elektrik ya da su kesintisi gibi elimizde olmayan bir sebep (mücbir sebep) değilse ve rezervasyonunuzda geç iptalde iade edilmeyen bir tutar varsa, iadeye ek olarak bu tutar kadar bir telafi veririz: dilerseniz aynı uzunlukta ücretsiz bir karaoke saati, dilerseniz bu tutarın kendi adınıza kayıtlı banka hesabınıza ödenmesi. Ücretsiz saati iptal tarihinden itibaren 6 ay içinde {{PHONE}} numarasını arayarak veya {{EMAIL}} adresine yazarak boş bir saat için ayırtabilirsiniz; ödemeyi seçerseniz banka hesap bilginizi {{EMAIL}} adresine yazmanızdan itibaren en geç 14 gün içinde yaparız.",
    ]);
  });

  it("its version moves to the day a non-default policy was saved", () => {
    const at = "2026-10-18T09:30:00.000Z";
    expect(
      karaokePolicyVersion(
        "17 Ekim 2026",
        time.DEFAULT_KARAOKE_CANCEL_POLICY,
        at,
      ),
    ).toBe("17 Ekim 2026");
    expect(
      karaokePolicyVersion(
        "17 Ekim 2026",
        { freeCancelHours: 24, lateRefundPercent: 50 },
        at,
      ),
    ).toBe("18 Ekim 2026");
    // A live override dated later stays the version.
    expect(
      karaokePolicyVersion(
        "20 Ekim 2026",
        { freeCancelHours: 24, lateRefundPercent: 50 },
        at,
      ),
    ).toBe("20 Ekim 2026");
    // Never saved (no date): the base.
    expect(
      karaokePolicyVersion(
        "17 Ekim 2026",
        { freeCancelHours: 24, lateRefundPercent: 50 },
        "",
      ),
    ).toBe("17 Ekim 2026");
  });
});

describe("the pages' notices", () => {
  it("a late cancel whose share is owed has its own code", () => {
    expect(cancelResultCode({ refunded: true })).toBe("iptal-iade");
    expect(
      cancelResultCode({ refunded: false, refundOwedMinor: 100_000 }),
    ).toBe("iptal-kismi-iade");
    expect(cancelResultCode({ refunded: false })).toBe("iptal");
    expect(KARAOKE_RESULT_NOTICES["iptal-kismi-iade"]?.text).toContain(
      "kartına iade edilir",
    );
  });

  it("karaokeTooLateMessageOf: the refusal in the booking's own words", () => {
    // A stored pair: its own late sentence.
    const shown: [string, string] = ["Birinci cümle.", "İkinci cümle."];
    expect(
      time.karaokeTooLateMessageOf({
        freeCancelHours: 2,
        lateRefundPercent: 0,
        cancellationRules: shown,
      }),
    ).toBe("Artık buradan iptal edemezsin. İkinci cümle.");
    const five = time.karaokeCancellationRules({
      freeCancelHours: 5,
      lateRefundPercent: 0,
    });
    expect(
      time.karaokeTooLateMessageOf({
        freeCancelHours: 5,
        lateRefundPercent: 0,
        cancellationRules: [...five.rules],
      }),
    ).toBe(`Artık buradan iptal edemezsin. ${five.lateRule}`);
    // A row under the default with its pair: the constant.
    expect(
      time.karaokeTooLateMessageOf({
        freeCancelHours: 2,
        lateRefundPercent: 0,
        cancellationRules: [REFUND, NO_REFUND],
      }),
    ).toBe(time.KARAOKE_TOO_LATE_MESSAGE);
    // A legacy row: the legacy late sentence, never today's default.
    expect(time.karaokeTooLateMessageOf({})).toBe(
      `Artık buradan iptal edemezsin. ${LEGACY_NO_REFUND}`,
    );
    expect(
      time.karaokeTooLateMessageOf({
        freeCancelHours: null,
        lateRefundPercent: null,
        cancellationRules: null,
      }),
    ).toBe(`Artık buradan iptal edemezsin. ${LEGACY_NO_REFUND}`);
    expect(time.karaokeTooLateMessageOf({})).not.toBe(
      time.KARAOKE_TOO_LATE_MESSAGE,
    );
    // A late share above 0: a cancel is accepted until the start, so the
    // refusal is the no-show, whatever the stored pair says.
    expect(
      time.karaokeTooLateMessageOf({
        freeCancelHours: 24,
        lateRefundPercent: 50,
        cancellationRules: shown,
      }),
    ).toBe(NO_SHOW_TOO_LATE);
    expect(
      time.karaokeTooLateMessageOf({
        freeCancelHours: 3,
        lateRefundPercent: 100,
      }),
    ).toBe(NO_SHOW_TOO_LATE);
  });

  it("a late-cancel refusal speaks the booking's own rule", () => {
    // No row to read: the fixed sentence, the default rule's.
    expect(karaokeNoticeFor("gec-iptal", null)).toEqual(
      KARAOKE_RESULT_NOTICES["gec-iptal"],
    );
    expect(KARAOKE_RESULT_NOTICES["gec-iptal"]?.text).toBe(
      time.KARAOKE_TOO_LATE_MESSAGE,
    );
    // A row with its stored pair: its own late sentence.
    const five = time.karaokeCancellationRules({
      freeCancelHours: 5,
      lateRefundPercent: 0,
    });
    const notice = karaokeNoticeFor("gec-iptal", {
      freeCancelHours: 5,
      lateRefundPercent: 0,
      cancellationRules: [...five.rules],
    });
    expect(notice?.tone).toBe("error");
    expect(notice?.text).toBe(
      `Artık buradan iptal edemezsin. ${five.lateRule}`,
    );
    expect(notice?.text).toContain("Bu 5 saat geçtikten sonra");
    // A row from before the snapshot: the legacy sentence.
    expect(karaokeNoticeFor("gec-iptal", {})?.text).toBe(
      `Artık buradan iptal edemezsin. ${LEGACY_NO_REFUND}`,
    );
    // A late share above 0: the no-show sentence.
    expect(
      karaokeNoticeFor("gec-iptal", {
        freeCancelHours: 24,
        lateRefundPercent: 50,
      })?.text,
    ).toBe(NO_SHOW_TOO_LATE);
    expect(karaokeNoticeFor("iptal", null)).toEqual(
      KARAOKE_RESULT_NOTICES.iptal,
    );
    expect(karaokeNoticeFor("iptal", {})).toEqual(KARAOKE_RESULT_NOTICES.iptal);
  });

  it("a venue-paid booking may be cancelled until when: always a window now", () => {
    expect(
      time.karaokeVenueCancelUntil(time.DEFAULT_KARAOKE_CANCEL_POLICY),
    ).toBe("rezervasyonu yaptıktan sonraki 2 saat içinde");
    expect(
      time.karaokeVenueCancelUntil({
        freeCancelHours: 1,
        lateRefundPercent: 0,
      }),
    ).toBe("rezervasyonu yaptıktan sonraki 1 saat içinde");
    expect(
      time.karaokeVenueCancelUntil({
        freeCancelHours: 72,
        lateRefundPercent: 0,
      }),
    ).toBe("rezervasyonu yaptıktan sonraki 72 saat içinde");
    // A late share above 0: no money moves, so the page cancels it until
    // the start.
    expect(
      time.karaokeVenueCancelUntil({
        freeCancelHours: 24,
        lateRefundPercent: 50,
      }),
    ).toBe("rezervasyon saatinden önce");
    expect(
      time.karaokeVenueCancelUntil({
        freeCancelHours: 3,
        lateRefundPercent: 100,
      }),
    ).toBe("rezervasyon saatinden önce");
    // No policy in range ever says to call: every window is at least an
    // hour (the null stays for the mail's sake).
    for (const h of [1, 2, 24, 72]) {
      for (const p of [0, 1, 50, 100]) {
        expect(
          time.karaokeVenueCancelUntil({
            freeCancelHours: h,
            lateRefundPercent: p,
          }),
        ).not.toBeNull();
      }
    }
  });
});

describe("a booking made under the rule counted back from the start (before 28 Eki 2026)", () => {
  const made = "2026-10-20T09:00:00.000Z";
  const legacyStored = {
    ...booking,
    createdAt: made,
    freeCancelHours: 2,
    lateRefundPercent: 0,
    cancelDeadline: new Date(START - 2 * HOUR).toISOString(),
  };
  const ownStored = {
    ...booking,
    createdAt: made,
    freeCancelHours: 2,
    lateRefundPercent: 0,
    cancelDeadline: new Date(Date.parse(made) + 2 * HOUR).toISOString(),
  };

  it("is told apart by its deadline: none stored, or the start minus its hours", () => {
    expect(time.karaokeCountsBackFromStart({ ...booking })).toBe(true);
    expect(time.karaokeCountsBackFromStart(legacyStored)).toBe(true);
    expect(time.karaokeCountsBackFromStart(ownStored)).toBe(false);
    // Booked closer to the start than its window: the start itself.
    expect(
      time.karaokeCountsBackFromStart({
        ...ownStored,
        cancelDeadline: new Date(START).toISOString(),
      }),
    ).toBe(false);
  });

  it("moved by the panel, keeps counting back from its new start", () => {
    const slot = { date: "2026-11-02", startHour: 21 };
    const newStart = time.karaokeStartInstant(slot.date, slot.startHour);
    expect(time.karaokeMovedDeadline(legacyStored, slot).getTime()).toBe(
      newStart.getTime() - 2 * HOUR,
    );
    // The same move of a booking under the 28 Eki rule: its making plus two.
    expect(time.karaokeMovedDeadline(ownStored, slot).toISOString()).toBe(
      ownStored.cancelDeadline,
    );
  });

  it("prints the sentences of its own policy in that rule's words", () => {
    expect(
      time.legacyKaraokeCancellationRules({
        freeCancelHours: 5,
        lateRefundPercent: 0,
      }),
    ).toEqual([
      "Rezervasyon saatine 5 saatten fazla varken iptal edersen ödediğin tutarın tamamı kartına iade edilir.",
      "Rezervasyon saatine 5 saatten az kala yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.",
    ]);
    expect(
      time.legacyKaraokeCancellationRules({
        freeCancelHours: 3,
        lateRefundPercent: 100,
      })[1],
    ).toBe(
      "Rezervasyon saatine 3 saatten az kala yapılan iptallerde de ödediğin tutarın tamamı kartına iade edilir; rezervasyona gelinmediğinde ücret iadesi yapılmaz.",
    );
    expect(
      time.legacyKaraokeCancellationRules({
        freeCancelHours: 24,
        lateRefundPercent: 50,
      })[1],
    ).toContain(
      "Rezervasyon saatine 24 saatten az kala yapılan iptallerde ödediğin tutarın %50'si en geç 14 gün içinde",
    );
    // A row with no stored pair reads its own policy, not a fixed 2 hours.
    expect(
      time.karaokeRulesOf({ freeCancelHours: 5, lateRefundPercent: 0 })[1],
    ).toContain("5 saatten az kala");
    expect(
      time.karaokeTooLateMessageOf({
        freeCancelHours: 5,
        lateRefundPercent: 0,
      }),
    ).toBe(
      "Artık buradan iptal edemezsin. Rezervasyon saatine 5 saatten az kala yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.",
    );
    for (const pair of [
      time.legacyKaraokeCancellationRules({
        freeCancelHours: 24,
        lateRefundPercent: 50,
      }),
      time.LEGACY_KARAOKE_RULES,
    ]) {
      for (const line of pair) expect(line).not.toMatch(/[–—]/);
    }
  });

  it("a venue-paid booking is told until when in the words it was booked with", () => {
    expect(time.karaokeVenueCancelUntilOf({ ...booking })).toBe(
      "rezervasyon saatine 2 saatten fazla varken",
    );
    expect(time.karaokeVenueCancelUntilOf(legacyStored)).toBe(
      "rezervasyon saatine 2 saatten fazla varken",
    );
    expect(time.karaokeVenueCancelUntilOf(ownStored)).toBe(
      "rezervasyonu yaptıktan sonraki 2 saat içinde",
    );
    expect(
      time.karaokeVenueCancelUntilOf({
        ...legacyStored,
        lateRefundPercent: 50,
      }),
    ).toBe("rezervasyon saatinden önce");
  });
});

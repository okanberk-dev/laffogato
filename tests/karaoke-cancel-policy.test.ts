import { describe, expect, it } from "vitest";

/**
 * The karaoke cancellation policy set from the panel (P2a; operator, 17 Eki
 * 2026: "para tutarı iade edilir kısmını da panelden ayarla"), its pure
 * half: the sentences, the Turkish suffix, the snapshot read back, the
 * deadline, what a member's own cancel gets, the panel's limits, the app
 * lock, the karaoke document and its version. The money paths are
 * tests/karaoke-late-cancel.test.ts; the panel's action is
 * tests/admin-karaoke-cancel-policy.test.ts.
 */

const time = await import("@/lib/mobile/karaoke-time");
const { toReservationJson } = await import("@/lib/mobile/karaoke-core");
const { karaokePolicyVersion } = await import("@/lib/legal/consent-version");
const { KARAOKE_ROOM_DOC, karaokeRoomDocFor } =
  await import("@/lib/legal/content-karaoke");
const { KARAOKE_LEGAL_UPDATED } = await import("@/lib/legal/meta");
const { cancelResultCode, karaokeNoticeFor, KARAOKE_RESULT_NOTICES } =
  await import("@/lib/mobile/karaoke-notices");

const REFUND =
  "Rezervasyon saatine 2 saatten fazla varken iptal edersen ödediğin tutarın tamamı kartına iade edilir.";
const NO_REFUND =
  "Rezervasyon saatine 2 saatten az kala yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.";

const HOUR = 3600_000;
// 30 Ekim 2026, 20:00 in Tuzla.
const booking = { date: "2026-10-30", startHour: 20, hours: 2 };
const START = Date.parse("2026-10-30T17:00:00.000Z");

describe("the sentences of a policy", () => {
  it("are the operator's 16 Eki wording, byte for byte, under the default", () => {
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
  });

  it("(0, 0): says plainly that every cancel after booking is late", () => {
    expect(
      time.karaokeCancellationRules({
        freeCancelHours: 0,
        lateRefundPercent: 0,
      }).rules,
    ).toEqual([
      "Bu rezervasyonda ücretsiz iptal süresi yok; rezervasyonu yaptıktan sonra yapacağın her iptal geç iptal sayılır.",
      "Geç iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.",
    ]);
  });

  it("(24, 50): the share with its possessive suffix", () => {
    const text = time.karaokeCancellationRules({
      freeCancelHours: 24,
      lateRefundPercent: 50,
    });
    expect(text.rules).toEqual([
      "Rezervasyon saatine 24 saatten fazla varken iptal edersen ödediğin tutarın tamamı kartına iade edilir.",
      "Rezervasyon saatine 24 saatten az kala yapılan iptallerde ödediğin tutarın %50'si kartına iade edilir; rezervasyona gelinmediğinde ücret iadesi yapılmaz.",
    ]);
    // A late cancel is accepted until the start: the refusal is the no-show.
    expect(text.tooLateMessage).toBe(
      "Rezervasyon saati geldi; artık buradan iptal edemezsin. Rezervasyona gelinmediğinde ücret iadesi yapılmaz.",
    );
  });

  it("(3, 100): a late cancel refunds everything too, a no-show nothing", () => {
    expect(
      time.karaokeCancellationRules({
        freeCancelHours: 3,
        lateRefundPercent: 100,
      }).rules,
    ).toEqual([
      "Rezervasyon saatine 3 saatten fazla varken iptal edersen ödediğin tutarın tamamı kartına iade edilir.",
      "Rezervasyon saatine 3 saatten az kala yapılan iptallerde de ödediğin tutarın tamamı kartına iade edilir; rezervasyona gelinmediğinde ücret iadesi yapılmaz.",
    ]);
  });

  it("never carries a long dash", () => {
    for (const h of [0, 2, 24, 72]) {
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
  it("a row from before the snapshot (NULL) is 2 hours / 0 %", () => {
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
    expect(time.karaokeRulesOf({})).toEqual([REFUND, NO_REFUND]);
  });

  it("a stored policy is the booking's, whatever the panel says now", () => {
    expect(
      time.karaokeCancelPolicyOf({
        freeCancelHours: 24,
        lateRefundPercent: 50,
      }),
    ).toEqual({ freeCancelHours: 24, lateRefundPercent: 50 });
    // Out of range reads as the default for that number, never as itself.
    expect(
      time.karaokeCancelPolicyOf({
        freeCancelHours: 900,
        lateRefundPercent: -5,
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
  });
});

describe("the deadline and a member's own cancel", () => {
  it("a legacy row: two hours before the start, the moment itself included", () => {
    expect(time.karaokeCancelDeadline(booking).getTime()).toBe(
      START - 2 * HOUR,
    );
    expect(time.withinFreeCancel(booking, new Date(START - 2 * HOUR - 1))).toBe(
      true,
    );
    // `cancellableUntil` is the last moment of a full refund (ASK-Y3-4).
    expect(time.withinFreeCancel(booking, new Date(START - 2 * HOUR))).toBe(
      true,
    );
    expect(time.withinFreeCancel(booking, new Date(START - 2 * HOUR + 1))).toBe(
      false,
    );
  });

  it("the start is never in the window, even where the deadline is the start", () => {
    // No window and no booking instant (a fixture): the deadline is the
    // start, and from the start on a cancel is refused, as before.
    const r = { ...booking, freeCancelHours: 0, lateRefundPercent: 50 };
    expect(time.karaokeCancelDeadline(r).getTime()).toBe(START);
    expect(time.withinFreeCancel(r, new Date(START - 1))).toBe(true);
    expect(time.withinFreeCancel(r, new Date(START))).toBe(false);
    expect(time.karaokeSelfCancelTerms(r, new Date(START))).toEqual({
      kind: "refused",
    });
  });

  it("the stored deadline wins over the hours", () => {
    const r = {
      ...booking,
      freeCancelHours: 2,
      cancelDeadline: "2026-10-29T17:00:00.000Z",
    };
    expect(time.karaokeCancelDeadline(r).toISOString()).toBe(
      "2026-10-29T17:00:00.000Z",
    );
  });

  it("a new booking's deadline: start minus the window, or the booking instant at 0", () => {
    const booked = new Date("2026-10-20T09:00:00.000Z");
    expect(
      time
        .karaokeDeadlineFor(
          { freeCancelHours: 24, lateRefundPercent: 50 },
          booking,
          booked,
        )
        .getTime(),
    ).toBe(START - 24 * HOUR);
    expect(
      time
        .karaokeDeadlineFor(
          { freeCancelHours: 0, lateRefundPercent: 0 },
          booking,
          booked,
        )
        .toISOString(),
    ).toBe(booked.toISOString());
  });

  it("refused inside the window at 0 %, a late share at 1..100 until the start", () => {
    const at = (h: number) => new Date(START - h * HOUR);
    const legacy = { ...booking };
    expect(time.karaokeSelfCancelTerms(legacy, at(3))).toEqual({
      kind: "full",
    });
    expect(time.karaokeSelfCancelTerms(legacy, at(1))).toEqual({
      kind: "refused",
    });

    const half = { ...booking, freeCancelHours: 24, lateRefundPercent: 50 };
    expect(time.karaokeSelfCancelTerms(half, at(25))).toEqual({ kind: "full" });
    expect(time.karaokeSelfCancelTerms(half, at(10))).toEqual({
      kind: "late",
      percent: 50,
    });
    // The start has come: not turning up refunds nothing.
    expect(time.karaokeSelfCancelTerms(half, at(0))).toEqual({
      kind: "refused",
    });

    const all = { ...booking, freeCancelHours: 3, lateRefundPercent: 100 };
    expect(time.karaokeSelfCancelTerms(all, at(1))).toEqual({
      kind: "late",
      percent: 100,
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

describe("the panel's limits (Haksız Şartlar Yön. m.5/1, EK (ç), (d); TBK m.182/3)", () => {
  const refuse = (h: number, p: number) =>
    time.karaokeCancelPolicyRefusal({
      freeCancelHours: h,
      lateRefundPercent: p,
    });

  it("accepts the default, no window with half back, and a long window with half back", () => {
    expect(refuse(2, 0)).toBeNull();
    expect(refuse(0, 50)).toBeNull();
    expect(refuse(0, 100)).toBeNull();
    expect(refuse(24, 0)).toBeNull();
    expect(refuse(30, 50)).toBeNull();
    expect(refuse(72, 100)).toBeNull();
  });

  it("no window is the longest window: at 0 hours at least half goes back", () => {
    // 0 hours stores the booking instant as the deadline, so every cancel
    // after booking is late, up to the booking window (60 days by default)
    // before the start: (0, 0) would keep the whole payment for all of it.
    for (const p of [0, 10, 49]) {
      expect(refuse(0, p)).toMatchObject({
        field: "karaokeLateRefundPercent",
        message: expect.stringMatching(/en az %50/),
      });
    }
  });

  it("at 0 % the window is at most 24 hours", () => {
    expect(refuse(25, 0)).toMatchObject({ field: "karaokeFreeCancelHours" });
  });

  it("above 24 hours at least half goes back", () => {
    expect(refuse(30, 40)).toMatchObject({ field: "karaokeLateRefundPercent" });
  });

  it("refuses what is out of range", () => {
    expect(refuse(73, 100)).toMatchObject({ field: "karaokeFreeCancelHours" });
    expect(refuse(2, 101)).toMatchObject({ field: "karaokeLateRefundPercent" });
    expect(refuse(2.5, 0)).toMatchObject({ field: "karaokeFreeCancelHours" });
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
    expect(time.effectiveKaraokeCancelPolicy(settings, "1.1.0")).toEqual({
      freeCancelHours: 24,
      lateRefundPercent: 50,
    });
    // The minimum lowered after a save: shut again.
    expect(
      time.effectiveKaraokeCancelPolicy(
        { ...settings, mobileApp: { minSupportedAppVersion: "1.0.0" } },
        "1.1.0",
      ),
    ).toEqual({ freeCancelHours: 2, lateRefundPercent: 0 });
    // A stored pair the panel would refuse never takes effect.
    expect(
      time.effectiveKaraokeCancelPolicy(
        {
          ...settings,
          karaokeFreeCancelHours: 48,
          karaokeLateRefundPercent: 0,
        },
        "1.1.0",
      ),
    ).toEqual({ freeCancelHours: 2, lateRefundPercent: 0 });
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
      cancelDeadline: "2026-10-29T17:00:00.000Z",
      cancellationRules: [...rules],
      refundMinor: 100_000,
    });
    expect(json).toMatchObject({
      cancellableUntil: "2026-10-29T17:00:00.000Z",
      freeCancelHours: 24,
      lateRefundPercent: 50,
      cancellationRules: rules,
      refundMinor: 100_000,
    });
  });

  it("an older row reads 2 / 0, the default pair and no share", () => {
    expect(toReservationJson(row)).toMatchObject({
      cancellableUntil: "2026-10-30T15:00:00.000Z",
      freeCancelHours: 2,
      lateRefundPercent: 0,
      cancellationRules: [REFUND, NO_REFUND],
      refundMinor: null,
    });
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
  });
});

describe("the karaoke document under a policy (karar D11)", () => {
  const section = (doc: typeof KARAOKE_ROOM_DOC, n: string) =>
    doc.sections.find((s) => s.heading.startsWith(`${n}. `))!;

  it("is today's text, word for word, under the default", () => {
    expect(KARAOKE_ROOM_DOC.updatedAt).toBe(KARAOKE_LEGAL_UPDATED);
    expect(section(KARAOKE_ROOM_DOC, "7").bullets).toEqual([
      "Rezervasyon saatine 2 saatten fazla varken iptal ederseniz ödediğiniz tutarın tamamı kartınıza iade edilir. İptali hesabınızdaki Karaoke rezervasyonlarım bölümünden, e-postanızdaki kişiye özel bağlantıdan ya da mobil uygulamadan kendiniz yapabilir ya da bizi arayarak yaptırabilirsiniz.",
      "Rezervasyon saatine 2 saatten az kala yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.",
      "Saatler Türkiye saatiyle (İstanbul) hesaplanır.",
      "İptal ve sorularınız için: {{PHONE}} veya {{EMAIL}}.",
    ]);
    expect(section(KARAOKE_ROOM_DOC, "9").paragraphs).toEqual([
      "Her iade PayNkolay üzerinden, ödemenin yapıldığı karta ve ödenen tutarın tamamı olarak yapılır; kısmi iade yapılmaz. İadenin hesabınıza yansıma süresi bankanıza bağlıdır.",
      "İade için sizden herhangi bir masraf istenmez.",
    ]);
    expect(section(KARAOKE_ROOM_DOC, "10").paragraphs).toEqual([
      "Hesabınızı kapatırsanız gelecek tarihli karaoke rezervasyonlarınız iptal edilir; rezervasyon saatine 2 saatten fazla olan ödenmiş rezervasyonların tutarının tamamı ödemenin yapıldığı karta iade edilir. İade o anda tamamlanamazsa İşletme iadeyi en geç 14 gün içinde ayrıca yapar. Rezervasyon saatine 2 saatten az kalan ödenmiş rezervasyonlar için 7. maddedeki kural geçerlidir: ücret iadesi yapılmaz ve rezervasyon olduğu gibi kalır. Üye olmadan, yalnız aynı e-posta adresiyle yapılmış rezervasyonlar hesabın kapatılmasından etkilenmez.",
    ]);
  });

  it("writes the panel's hours and share, and never contradicts them", () => {
    const doc = karaokeRoomDocFor(
      { freeCancelHours: 24, lateRefundPercent: 50 },
      "18 Ekim 2026",
    );
    expect(doc.updatedAt).toBe("18 Ekim 2026");
    const text = JSON.stringify(["7", "9", "10"].map((n) => section(doc, n)));
    expect(text).toContain("24 saatten fazla");
    expect(text).toContain("%50'si kartınıza iade edilir");
    expect(text).toContain("Geç iptaldeki iade 7. maddedeki oranda");
    expect(text).not.toContain("2 saat");
    expect(text).not.toContain("kısmi iade yapılmaz");
    expect(JSON.stringify(doc)).not.toMatch(/[–—]/);
    // Everything outside the three rule sections is untouched.
    for (const n of ["1", "2", "3", "4", "5", "6", "8", "11", "12", "13"]) {
      expect(section(doc, n)).toEqual(section(KARAOKE_ROOM_DOC, n));
    }
  });

  it("(0, 0) says there is no free window", () => {
    const doc = karaokeRoomDocFor({ freeCancelHours: 0, lateRefundPercent: 0 });
    expect(section(doc, "7").bullets?.[0]).toContain(
      "ücretsiz iptal süresi yoktur",
    );
    expect(JSON.stringify(section(doc, "10"))).not.toContain("0 saat");
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

  it("a late-cancel refusal speaks the booking's own rule", () => {
    expect(karaokeNoticeFor("gec-iptal", {})?.text).toBe(
      time.KARAOKE_TOO_LATE_MESSAGE,
    );
    expect(
      karaokeNoticeFor("gec-iptal", {
        freeCancelHours: 5,
        lateRefundPercent: 0,
      })?.text,
    ).toContain("5 saatten az kala");
    expect(karaokeNoticeFor("iptal", null)).toEqual(
      KARAOKE_RESULT_NOTICES.iptal,
    );
  });

  it("a venue-paid booking may be cancelled until when", () => {
    expect(
      time.karaokeVenueCancelUntil(time.DEFAULT_KARAOKE_CANCEL_POLICY),
    ).toBe("rezervasyon saatine 2 saatten fazla varken");
    expect(
      time.karaokeVenueCancelUntil({
        freeCancelHours: 0,
        lateRefundPercent: 50,
      }),
    ).toBe("rezervasyon saatinden önce");
    expect(
      time.karaokeVenueCancelUntil({
        freeCancelHours: 0,
        lateRefundPercent: 0,
      }),
    ).toBeNull();
  });
});

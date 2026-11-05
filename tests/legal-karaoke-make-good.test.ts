import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the guest reads about the köşk's late cancel made good and the hour
 * sold again (21 Eki 2026, LEGAL-REDLINES §26): the karaoke terms §8 and §9,
 * the privacy texts that name the make-good's bank details, and the three
 * mails (the business cancel with its make-good, the free hour's
 * confirmation, the resale refund) with the amounts they actually carry.
 */

const h = vi.hoisted(() => ({
  sent: [] as Array<{ subject: string; html: string; text: string }>,
}));

vi.mock("@/lib/admin/store", () => ({
  getSettings: async () => ({
    email: "kosk@example.com",
    karaokeNotifyEmail: "",
    emailFrom: "",
    emailReplyTo: "",
  }),
}));

const { findLegalDoc } = await import("@/lib/legal/documents");
const { KARAOKE_ROOM_DOC } = await import("@/lib/legal/content-karaoke");
const { KARAOKE_LEGAL_UPDATED, LEGAL_UPDATED } =
  await import("@/lib/legal/meta");
const send = await import("@/lib/email/send");
const time = await import("@/lib/mobile/karaoke-time");

type Doc = NonNullable<ReturnType<typeof findLegalDoc>>;

function doc(slug: string): Doc {
  const d = findLegalDoc(slug);
  if (!d) throw new Error(`${slug} yok`);
  return d;
}

const section = (d: { sections: Doc["sections"] }, n: string) =>
  d.sections.find((s) => s.heading.startsWith(`${n}. `))!;

const BASE = {
  to: "eda@example.com",
  name: "Eda",
  date: "30 Ekim 2026",
  time: "20:00 - 22:00",
  guests: 4,
  code: "krk-00042",
  manageUrl: "https://laffogato.net/rezervasyon?t=krk-00042.1.sig",
  payment: { kind: "online" as const, paidMinor: 200_000 },
  cancellation: {
    rules: [time.KARAOKE_REFUND_RULE, time.KARAOKE_NO_REFUND_RULE] as const,
    venueUntil: time.karaokeVenueCancelUntil(
      time.DEFAULT_KARAOKE_CANCEL_POLICY,
    ),
  },
};

/** The text half with its line breaks folded, and the HTML with tags gone. */
function both(m: { html: string; text: string }): string[] {
  const html = m.html
    .replace(/<[^>]+>/g, "")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");
  return [html, m.text.replace(/\s+/g, " ")];
}

beforeEach(() => {
  h.sent.length = 0;
  process.env.RESEND_API_KEY = "re_test";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      h.sent.push({ subject: body.subject, html: body.html, text: body.text });
      return new Response(JSON.stringify({ id: "1" }), { status: 200 });
    }),
  );
});

describe("the karaoke terms (OP-KARAOKE-GOODWILL, ASK-OTH-3-CFG)", () => {
  it("§8 makes good a late köşk cancel, as decided, with the köşk's phone and address", () => {
    const eight = section(doc(KARAOKE_ROOM_DOC.slug), "8").paragraphs ?? [];
    expect(eight).toHaveLength(2);
    expect(eight[1]).toMatch(
      /^İptali, sizin için ücretsiz iptal süresinin bittiği andan sonra yapmak zorunda kalırsak, nedeni doğal afet, resmî makam kararı veya bölgesel elektrik ya da su kesintisi gibi elimizde olmayan bir sebep \(mücbir sebep\) değilse ve rezervasyonunuzda geç iptalde iade edilmeyen bir tutar varsa, iadeye ek olarak bu tutar kadar bir telafi veririz: dilerseniz aynı uzunlukta ücretsiz bir karaoke saati, dilerseniz bu tutarın kendi adınıza kayıtlı banka hesabınıza ödenmesi\. Ücretsiz saati iptal tarihinden itibaren 6 ay içinde \S.+ numarasını arayarak veya \S+@\S+ adresine yazarak boş bir saat için ayırtabilirsiniz; ödemeyi seçerseniz banka hesap bilginizi \S+@\S+ adresine yazmanızdan itibaren en geç 14 gün içinde yaparız\. Ayırttığınız ücretsiz saati, rezervasyon saatine 2 saatten fazla varken \(saat, rezervasyon saatine 4 saatten az kala ayrıldıysa ayrıldığı andan itibaren 2 saat içinde ve rezervasyon saati gelmeden\) rezervasyon sayfanızdan, bizi arayarak veya \S+@\S+ adresine yazarak bırakabilirsiniz; bu durumda telafiniz yeniden açılır\. Bu süreden sonra bırakılan ya da gelinmeyen ücretsiz saatte telafi kullanılmış sayılır\.$/,
    );
    expect(eight[1]).not.toContain("{{");
  });

  it("§9 refunds a share within 14 days and no longer says there is none", () => {
    const nine = section(KARAOKE_ROOM_DOC, "9").paragraphs ?? [];
    expect(nine[0]).toBe(
      "Her iade PayNkolay üzerinden ödemenin yapıldığı karta yapılır. Tutarın tamamının iadesi iptalle birlikte başlatılır; ödediğiniz tutarın bir kısmı iade ediliyorsa bu tutar en geç 14 gün içinde kartınıza iade edilir. İadenin hesabınıza yansıma süresi bankanıza bağlıdır.",
    );
    expect(JSON.stringify(KARAOKE_ROOM_DOC)).not.toContain(
      "kısmi iade yapılmaz",
    );
    // §7 already promises the resale refund the code now makes.
    expect(JSON.stringify(section(KARAOKE_ROOM_DOC, "7"))).toContain(
      "iptal ettiğiniz saat başka bir misafire satılırsa o saat için sizde kalan tutar da iade edilir",
    );
  });

  it("is dated by the karaoke version a booking's consent records", () => {
    expect(KARAOKE_ROOM_DOC.updatedAt).toBe(KARAOKE_LEGAL_UPDATED);
  });
});

describe("the privacy texts name the make-good's bank details (KVKK m.10)", () => {
  it("the retention table, the privacy notice and the privacy policy", () => {
    // The retention row of the bank details a refund is paid to (§8).
    const keys = (
      section(doc("veri-saklama-ve-imha-politikasi"), "8").table ?? []
    ).map((r) => r.key);
    expect(
      keys.some(
        (k) =>
          k.startsWith("İade için bildirilen banka hesap bilgisi") &&
          k.endsWith("; karaoke telafisi için bildirilen banka hesap bilgisi"),
      ),
    ).toBe(true);
    const notice = JSON.stringify(doc("kvkk-aydinlatma-metni"));
    expect(notice).toContain(
      "rezervasyonunuzu geç iptal etmek zorunda kalırsak verdiğimiz telafi",
    );
    expect(notice).toContain(
      "Telafinin banka hesabınıza ödenmesini seçerseniz e-postayla bildirdiğiniz kendi adınıza kayıtlı banka hesap bilgisi yalnızca bu ödeme için kullanılır; rezervasyon kaydına yazılmaz",
    );
    expect(JSON.stringify(doc("gizlilik-politikasi"))).toContain(
      "telafinin banka hesabınıza ödenmesini seçerseniz bildirdiğiniz banka hesap bilgisi yalnızca bu ödeme için kullanılır ve rezervasyon kaydına yazılmaz",
    );
  });
});

describe("the mails print the actual amounts", () => {
  it("a late köşk cancel: the reason, the whole refund and the make-good", async () => {
    await send.sendKaraokeCancellationEmail({
      ...BASE,
      refundedMinor: 200_000,
      refundIsShare: false,
      cancelCause: "ariza",
      makeGood: { minor: 200_000, until: "30 Nisan 2027" },
    });
    for (const part of both(h.sent[0]!)) {
      expect(part).toContain(
        "Ödediğin ₺2.000,00 tutarın tamamını kartına iade ettik",
      );
      expect(part).toContain(
        "Ayrıca sana ₺2.000,00 tutarında bir telafi veriyoruz: istersen aynı uzunlukta ücretsiz bir karaoke saati (30 Nisan 2027 tarihine kadar bizi arayarak ya da bu e-postayı yanıtlayarak boş bir saat için ayırtabilirsin), istersen bu tutarın kendi adına kayıtlı banka hesabına ödenmesi (bu e-postayı yanıtlayıp IBAN'ını yaz, 14 gün içinde öderiz).",
      );
      expect(part).not.toMatch(/\[KARAOKE_/);
    }
  });

  it("no make-good: no make-good sentence", async () => {
    await send.sendKaraokeCancellationEmail({
      ...BASE,
      refundedMinor: 200_000,
      refundIsShare: false,
      cancelCause: "mucbir",
    });
    for (const part of both(h.sent[0]!)) {
      expect(part).not.toContain("telafi");
    }
  });

  it("the free hour's confirmation: nothing to pay, never 'at the köşk'", async () => {
    await send.sendKaraokeConfirmationEmail({
      ...BASE,
      payment: { kind: "venue" },
      makeGoodHourFor: "krk-00042",
    });
    for (const part of both(h.sent[0]!)) {
      expect(part).toContain(
        "Bu saat, KRK-00042 rezervasyonun için verdiğimiz telafidir. Bu saat için senden ödeme alınmaz.",
      );
      expect(part).toContain("telafin o zaman geri gelir");
      expect(part).not.toContain("Ödemeyi köşkte yaparsın");
      expect(part).not.toMatch(/\[KARAOKE_/);
    }
    const flags = send.karaokeConfirmationFlags({
      payment: { kind: "venue" },
      cancellation: { rules: BASE.cancellation.rules, venueUntil: null },
      makeGoodHourFor: "krk-00042",
    });
    expect(Object.entries(flags).filter(([, on]) => on)).toEqual([
      ["KARAOKE_TELAFI_SAATI_ARA", true],
    ]);
  });

  it("the resale refund after the share: only what this refund sent", async () => {
    await send.sendKaraokeCancellationEmail({
      ...BASE,
      refundedMinor: 50_000,
      refundIsShare: true,
      refundIsResaleTopUp: true,
    });
    for (const part of both(h.sent[0]!)) {
      expect(part).toContain(
        "Geç iptal ettiğin saat başka bir misafire satıldığı için sende kalan tutardan ₺500,00 daha kartına iade edildi",
      );
      expect(part).not.toContain("geç iptal kuralına göre");
    }
    const flags = send.karaokeCancellationFlags({
      refundedMinor: 50_000,
      refundIsShare: true,
      refundIsResaleTopUp: true,
      payment: { kind: "online", paidMinor: 200_000 },
    });
    const money = [
      "KARAOKE_IADE",
      "KARAOKE_TAM_IADE",
      "KARAOKE_KISMI_IADE_EDILDI",
      "KARAOKE_SATIS_IADE",
      "KARAOKE_KISMI_IADE",
      "KARAOKE_ODEMESIZ",
    ].filter((k) => flags[k]);
    expect(money).toEqual(["KARAOKE_SATIS_IADE"]);
  });
});

describe("a late request at 0 % released the hours (karaoke terms §7, 29 Eki 2026)", () => {
  const MONEY = [
    "KARAOKE_IADE",
    "KARAOKE_TAM_IADE",
    "KARAOKE_KISMI_IADE_EDILDI",
    "KARAOKE_KISMI_SATIS_IADE_EDILDI",
    "KARAOKE_SATIS_IADE",
    "KARAOKE_SATIS_IADE_EDILDI",
    "KARAOKE_KISMI_IADE",
    "KARAOKE_SATISA_ACILDI",
    "KARAOKE_ODEMESIZ",
  ];

  it("the cancel itself: at their request, nothing refunded, the hours on sale and what a resold one gives back", async () => {
    await send.sendKaraokeCancellationEmail({
      ...BASE,
      cancelCause: "misafir",
      releasedForResale: true,
    });
    for (const part of both(h.sent[0]!)) {
      expect(part).toContain("İsteğin üzerine karaoke rezervasyonunu iptal ettik.");
      expect(part).toContain(
        "Ücretsiz iptal süren geçtiği için rezervasyonundaki kurala göre ücret iadesi yapılmadı. Saatlerini yeniden satışa açtık: saatlerinden biri başka bir misafire satılırsa o saat için ödediğin tutarı en geç 14 gün içinde kartına iade eder, sana ayrıca haber veririz.",
      );
      expect(part).not.toContain("kartına iade edildi");
      expect(part).not.toContain("senden ödeme alınmadı");
      expect(part).not.toMatch(/\[KARAOKE_/);
    }
    const flags = send.karaokeCancellationFlags({
      cancelCause: "misafir",
      releasedForResale: true,
      payment: { kind: "online", paidMinor: 200_000 },
    });
    expect(MONEY.filter((k) => flags[k])).toEqual(["KARAOKE_SATISA_ACILDI"]);
  });

  it("its first resold hour refunded: what was paid for that hour, never a late share", async () => {
    await send.sendKaraokeCancellationEmail({
      ...BASE,
      refundedMinor: 100_000,
      refundIsShare: true,
      refundIsResaleOnly: true,
    });
    for (const part of both(h.sent[0]!)) {
      expect(part).toContain(
        "Geç iptal ettiğin saat başka bir misafire satıldığı için o saat için ödediğin ₺1.000,00 kartına iade edildi",
      );
      expect(part).not.toContain("geç iptal kuralına göre");
      expect(part).not.toContain("daha kartına");
    }
    const flags = send.karaokeCancellationFlags({
      refundedMinor: 100_000,
      refundIsShare: true,
      refundIsResaleOnly: true,
      payment: { kind: "online", paidMinor: 200_000 },
    });
    expect(MONEY.filter((k) => flags[k])).toEqual([
      "KARAOKE_SATIS_IADE_EDILDI",
    ]);
  });

  it("a later resold hour of the same booking reads as the top-up it is", () => {
    const flags = send.karaokeCancellationFlags({
      refundedMinor: 100_000,
      refundIsShare: true,
      refundIsResaleTopUp: true,
      refundIsResaleOnly: true,
      payment: { kind: "online", paidMinor: 200_000 },
    });
    expect(MONEY.filter((k) => flags[k])).toEqual(["KARAOKE_SATIS_IADE"]);
  });
});

describe("the texts that list the cases and the purposes name the make-good (review R1, R2)", () => {
  it("Ödeme Koşulları §14: the make-good's transfer is the third bank-transfer case", () => {
    expect(section(doc("odeme-kosullari"), "14").paragraphs?.[1]).toBe(
      "Banka hesabına transfer yalnızca üç hâlde, sizin adınıza kayıtlı banka hesabına ödeme yapmak için Satıcı tarafından kullanılır: 22. maddede açıklanan istisnai hâlde iade tutarının ödenmesi, iadeyi başka bir kargo firmasıyla gönderdiğinizde belgelediğiniz gönderim bedelinin ödenmesi ve karaoke odası rezervasyonunuzu ücretsiz iptal süresinin bitmesinden sonra iptal etmek zorunda kalırsak, Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nin 8. maddesindeki telafinin, ödemeyi seçmeniz hâlinde, ödenmesi. Karta yapılan iade karttan tahsil edilen tutarı aşamadığından gönderim bedeli karta iade edilmez; belgenin Satıcı'ya ulaşmasından itibaren 14 (on dört) gün içinde, ürün bedelinin iadesinden ayrı olarak ödenir. Karaoke telafisi, banka hesap bilginizi e-postayla bildirmenizden itibaren en geç 14 (on dört) gün içinde ödenir. Bu hâllerde bildirdiğiniz hesap sahibinin adı ve IBAN bilgisi yalnızca bu ödemenin yapılması amacıyla işlenir; üçüncü kişilere ait hesaplara ödeme yapılmaz.",
    );
    // 21 Ekim 2026 when the make-good came in; from 22 Ekim 2026 the set's
    // day (the push wording moved LEGAL_UPDATED, LEGAL-REDLINES §30); 28-29
    // Ekim 2026 its own (§21 counts the karaoke window from the booking,
    // LEGAL-REDLINES §37); since 5 Kasım 2026 the set's day again (saved
    // cards moved LEGAL_UPDATED past it, §38).
    expect(doc("odeme-kosullari").updatedAt).toBe(LEGAL_UPDATED);
  });

  it("KVKK Aydınlatma §7 and §8 and Gizlilik §5 name the make-good as a purpose", () => {
    const clause =
      "rezervasyonunuzu ücretsiz iptal süresinin bitmesinden sonra iptal etmek zorunda kalırsak telafi olarak ücretsiz bir saatin ayrılması ya da telafi tutarının";
    const purpose = (
      section(doc("kvkk-aydinlatma-metni"), "7").bullets ?? []
    ).find((b) => b.startsWith("Karaoke odası rezervasyonu:"));
    expect(purpose).toContain(
      "rezervasyonun iptali ve iadenin yapılması, rezervasyonunuzu ücretsiz iptal süresinin bitmesinden sonra iptal etmek zorunda kalırsak telafi olarak ücretsiz bir saatin ayrılması ya da telafi tutarının bildireceğiniz, kendi adınıza kayıtlı banka hesabına ödenmesi,",
    );
    const basis = (section(doc("kvkk-aydinlatma-metni"), "8").table ?? []).find(
      (r) => r.key.startsWith("Karaoke odası rezervasyonunun alınması"),
    );
    expect(basis?.key).toContain(clause);
    const policy = (section(doc("gizlilik-politikasi"), "5").table ?? []).find(
      (r) => r.key.startsWith("Karaoke odası rezervasyonunun alınması"),
    );
    expect(policy?.key).toContain(clause);
    expect(policy?.key).toMatch(/sizinle iletişim kurulması$/);
  });
});

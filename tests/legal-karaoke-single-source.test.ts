import { describe, expect, it } from "vitest";

import { findLegalDoc, LEGAL_DOCS } from "@/lib/legal/documents";

/**
 * The karaoke and café terms, one source each (LEGAL-REDLINES §17, 19 Ekim
 * 2026).
 *
 * - ASK-Y3-2: the karaoke room's price, payment, cancellation, refund,
 *   no-show and business-cancel rules live in the karaoke terms only. The
 *   café terms, İade ve Cayma §21 and the retention policy point at them;
 *   two documents that both say "only here" fall apart the day one changes
 *   (TBK m.21/1, m.23; TKHK m.5/4).
 * - ASK-Y3-3: an event's cancellation has one rule, in İade ve Cayma §21;
 *   the café terms §6 point at it (it used to say 7 days / 72 hours there
 *   and 48 / 24 hours here).
 * - OP-KARAOKE-PREPAY: no text describes the request mode any more.
 * - ASK-Y3-6: the access notice holds a table for 15 minutes and keeps no
 *   health data.
 */

type Doc = NonNullable<ReturnType<typeof findLegalDoc>>;

function doc(slug: string): Doc {
  const d = findLegalDoc(slug);
  if (!d) throw new Error(`${slug} yok`);
  return d;
}

/** Every sentence-bearing string of a document, with where it stands. */
function texts(d: Doc): Array<[string, string]> {
  return d.sections.flatMap((s) =>
    [
      s.heading,
      ...(s.paragraphs ?? []),
      ...(s.bullets ?? []),
      ...(s.ordered ?? []),
      ...(s.table ?? []).map((r) => `${r.key}: ${r.value}`),
    ].map((t): [string, string] => [`${d.slug} · ${s.heading}`, t]),
  );
}

const section = (d: Doc, n: string) =>
  d.sections.find((s) => s.heading.startsWith(`${n}. `))!;

const KARAOKE_TERMS =
  "Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi";

describe("the karaoke rules live in the karaoke terms only (ASK-Y3-2)", () => {
  const pointing = [
    "kafe-hizmet-kosullari",
    "iade-ve-cayma",
    "veri-saklama-ve-imha-politikasi",
  ];

  it("the documents that point at them no longer state the rule", () => {
    for (const slug of pointing) {
      const all = JSON.stringify(doc(slug));
      expect(all, slug).not.toMatch(/(?<!\d)2 saatten (fazla|az)/);
      // The rule counted from the booking (28 Ekim 2026) is not repeated
      // here either.
      expect(all, slug).not.toMatch(/andan itibaren \d+ saat/);
      expect(all, slug).not.toContain("kısmi iade yapılmaz");
      expect(all, slug).toContain(KARAOKE_TERMS);
    }
  });

  it("the café terms §5 has no rule paragraph and no table", () => {
    const five = section(doc("kafe-hizmet-kosullari"), "5");
    expect(five.table).toBeUndefined();
    const text = JSON.stringify(five);
    expect(text).not.toContain("iptal ve iade kuralı şudur");
    expect(text).not.toContain("işletme karşılayamazsa");
    expect(text).toContain("bu madde yalnızca rezervasyon kanallarını açıklar");
    expect(text).toContain(
      "yalnızca, rezervasyon sırasında onayladığınız Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nde (/hukuk/karaoke-odasi-rezervasyon) düzenlenir.",
    );
    // The app sends no phone with a member's booking (karaoke-core.ts).
    expect(text).toContain(
      "Rezervasyon sırasında ad-soyad ve elektronik posta adresi, internet sitesinden yapılan rezervasyonlarda ayrıca cep telefonu istenir.",
    );
  });

  it("the café terms no longer bind by a visit, and §1 names one source", () => {
    const one = JSON.stringify(section(doc("kafe-hizmet-kosullari"), "1"));
    expect(one).not.toContain("okunduğu ve kabul edildiği anlamına gelir");
    // {{SITE_URL}} is filled on the way out.
    expect(one).toMatch(
      /Bu Koşulları işletme girişinde ve https?:\/\/\S+\/hukuk\/kafe-hizmet-kosullari adresinde inceleyebilirsiniz\./,
    );
    expect(one).not.toContain("5. maddesindeki karaoke hükümlerinde");
  });

  it("no document calls the kept payment a lump-sum condition (ASK-OTH-3)", () => {
    for (const d of LEGAL_DOCS) {
      for (const [where, text] of texts(d)) {
        expect(text, where).not.toMatch(/götürü bir koşul|cezai şart değildir/);
      }
    }
  });
});

describe("one event-cancellation rule, in İade ve Cayma §21 (ASK-Y3-3)", () => {
  it("§21 counts from the start, keeps only documented costs, and lets the guest choose", () => {
    const bullets = section(doc("iade-ve-cayma"), "21").bullets ?? [];
    expect(bullets).toEqual(
      expect.arrayContaining([
        "Etkinliğin başlangıç saatinden en az 48 saat önce iletilen iptal taleplerinde ödenen bedelin tamamı iade edilir.",
        "Etkinliğin başlangıç saatine 48 saatten az, en az 24 saat kala (tam 24 saat dâhil) iletilen iptallerde, tercihinize göre ödenen bedelin tamamı iade edilir veya katılım hakkınız kontenjan bulunan başka bir tarihe aktarılır.",
        "Etkinliğin Satıcı tarafından iptal edilmesi veya tarihinin değiştirilmesi hâlinde, tercihinize göre katılım hakkınız yeni tarihe aktarılır, eşdeğer bir etkinliğe katılımınız sağlanır ya da ödediğiniz bedelin tamamı en geç 14 gün içinde iade edilir; bu tercih size aittir.",
      ]),
    );
    const late = bullets.find((b) => b.includes("24 saatten az kala"));
    expect(late).toContain(
      "böyle bir gider yoksa veya belgelenemiyorsa bedelin tamamı iade edilir",
    );
    expect(late).not.toContain("bedel iadesi yapılamaz");
  });

  it("the café terms §6 point at §21 and repeat no number of its own", () => {
    const six = section(doc("kafe-hizmet-kosullari"), "6");
    const text = JSON.stringify(six);
    expect(text).not.toMatch(/7 gün|72 saat|yirmi dört \(24\) saat/);
    expect(text).not.toContain("Süresinde yapılmayan iptallerde");
    expect(text).toContain(
      "İptal, İade ve Cayma Hakkı metninin 21. maddesindedir",
    );
    expect(six.table).toEqual([
      {
        key: "Etkinlik iptali ve katılımcı devri",
        value:
          "Süreler ve iade esasları İptal, İade ve Cayma Hakkı metninin 21. maddesindedir; katılım onayında lehinize farklı bir koşul yazıyorsa o uygulanır.",
      },
      {
        key: "İşletme kaynaklı iptal",
        value: "Yeni tarih, eşdeğer etkinlik veya tam iade (Misafirin seçimi)",
      },
      {
        key: "Cayma hakkı",
        value:
          "Belirli tarihte ifa edilen hizmet olduğundan istisna kapsamındadır",
      },
    ]);
  });

  it("§21 hands the karaoke room to its own terms", () => {
    const paragraphs = section(doc("iade-ve-cayma"), "21").paragraphs ?? [];
    expect(paragraphs.join(" ")).toContain(
      "Karaoke odası rezervasyonunun iptal, iade ve gelmeme kuralları yalnızca Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nde düzenlenir",
    );
  });
});

describe("no text describes the request mode (OP-KARAOKE-PREPAY)", () => {
  it("is gone from every document", () => {
    for (const d of LEGAL_DOCS) {
      for (const [where, text] of texts(d)) {
        expect(text, where).not.toMatch(
          /talep olarak iletilir|yalnızca bir taleptir|bedel işletmede ödenir/,
        );
      }
    }
  });

  it("an old app build is told to update", () => {
    expect(JSON.stringify(doc("kafe-hizmet-kosullari"))).toContain(
      "Mobil uygulamanın ödeme alamayan eski bir sürümünden rezervasyon yapılamaz; bu durumda uygulamanızı güncellemeniz istenir.",
    );
    expect(JSON.stringify(doc("kullanim-sartlari"))).toContain(
      "Mobil Uygulamanın ödeme alamayan eski bir sürümünden rezervasyon yapılamaz; bu durumda uygulamanın güncellenmesi istenir.",
    );
  });
});

describe("the access notice (ASK-Y3-6)", () => {
  it("holds a table for 15 minutes, notes no reason and keeps the note a day", () => {
    const twenty = JSON.stringify(section(doc("kafe-hizmet-kosullari"), "20"));
    expect(twenty).toContain("Bu bildirim bir masa rezervasyonu değildir");
    expect(twenty).toContain("15 dakika boyunca sizin için boş tutar");
    expect(twenty).toContain(
      "notta bildiriminizin nedenini ve sağlık durumunuza ilişkin hiçbir ayrıntıyı yazmayız ve bu notu ziyaretinizin ertesi günü imha ederiz",
    );
    expect(twenty).not.toContain("tahsis edilebilir");
    // §5's "no table bookings" does not reach it.
    expect(
      JSON.stringify(section(doc("kafe-hizmet-kosullari"), "5")),
    ).toContain(
      "Bu kural, 20. maddede düzenlenen erişim ihtiyacına yönelik ön bildirimi kapsamaz.",
    );
  });
});

/**
 * The two documents that still quote the default rule in their own words
 * (tests/karaoke-cancel-policy-doc.test.ts, "opening the app lock"): Ödeme
 * Koşulları §21 and Hesap Silme §6 and §8. Since 28 Ekim 2026 the window is
 * counted from the booking; a booking made under the earlier rule keeps the
 * last free moment its summary shows, which is the only place the old
 * timing ("rezervasyon saatinden 2 saat önce") may stand, in its
 * parentheses.
 */
describe("the default rule quoted in Ödeme Koşulları §21 and Hesap Silme §6, §8 (28 Ekim 2026)", () => {
  const LEGACY_CLAUSE = "(rezervasyon saatinden 2 saat önce)";
  const WINDOW =
    "ücretsiz iptal süresi (rezervasyonun yapıldığı andan itibaren 2 saat; rezervasyon saati gelmeden)";

  /** The one karaoke passage of a section. */
  function karaokePassage(slug: string, n: string): string {
    const s = section(doc(slug), n);
    const found = [...(s.paragraphs ?? []), ...(s.bullets ?? [])].filter(
      (t) => /karaoke/i.test(t) && t.includes("iptal"),
    );
    expect(found, `${slug} §${n}`).toHaveLength(1);
    return found[0]!;
  }

  const passages = () =>
    [
      ["odeme-kosullari §21", karaokePassage("odeme-kosullari", "21")],
      ["hesap-silme §6", karaokePassage("hesap-silme", "6")],
      ["hesap-silme §8", karaokePassage("hesap-silme", "8")],
    ] as const;

  it("Ödeme Koşulları §21 states the karaoke rule word for word", () => {
    expect(karaokePassage("odeme-kosullari", "21")).toBe(
      "Karaoke odası rezervasyonunda cayma hakkı yoktur (Mesafeli Sözleşmeler Yönetmeliği m.15/1-g). Rezervasyonu yaptığınız andan itibaren 2 saat içinde, rezervasyon saati gelmeden iptal ederseniz ödediğiniz tutarın tamamı kartınıza iade edilir. Bu süre geçtikten sonra yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz. Daha önceki kurala göre yapılmış rezervasyonlarda rezervasyon özetinde gösterilen son ücretsiz iptal anı (rezervasyon saatinden 2 saat önce) geçerlidir. Karaoke iadeleri ödenen tutarın tamamı olarak, PayNkolay üzerinden ödemenin yapıldığı karta yapılır; kısmi iade yapılmaz ve 22. madde bu iadelere uygulanmaz. Rezervasyonu işletme karşılayamazsa ödenen tutarın tamamı iade edilir.",
    );
  });

  it("Hesap Silme §6 and §8 count the window from the booking and name the earlier rule's last moment", () => {
    const six = karaokePassage("hesap-silme", "6");
    const eight = karaokePassage("hesap-silme", "8");
    for (const [where, text] of [
      ["§6", six],
      ["§8", eight],
    ] as const) {
      expect(text, where).toContain(WINDOW);
      expect(text, where).toContain(
        "önceki kurala göre yapılmış rezervasyonlarda rezervasyon özetinde gösterilen son ücretsiz iptal anı (rezervasyon saatinden 2 saat önce) geçerlidir.",
      );
    }
    // §6 carries it after a semicolon, §8 as its own sentence.
    expect(six).toContain(
      "; daha önceki kurala göre yapılmış rezervasyonlarda",
    );
    expect(eight).toContain(
      ". Daha önceki kurala göre yapılmış rezervasyonlarda",
    );
  });

  it("none of the three counts back from the start outside the earlier rule's parentheses", () => {
    for (const [where, text] of passages()) {
      expect(text.split(LEGACY_CLAUSE), where).toHaveLength(2);
      const rest = text.replace(LEGACY_CLAUSE, "");
      expect(rest, where).not.toContain("saatine 2 saatten fazla");
      expect(rest, where).not.toMatch(/(?<!\d)2 saatten (fazla|az)/);
      expect(rest, where).not.toContain("saatinden 2 saat önce");
    }
  });
});

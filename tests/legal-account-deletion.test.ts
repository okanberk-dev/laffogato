import { describe, expect, it } from "vitest";

import { findLegalDoc, LEGAL_DOCS } from "@/lib/legal/documents";

/**
 * The legal texts follow the deletion flow (18 Eki 2026): on the Site an
 * account is deleted by the team on the member's request, within thirty
 * days (KVKK m.13/2, Tebliğ m.6/5); the app's "Hesabımı sil" stays
 * immediate (Apple 5.1.1(v)). No text may still promise that the Site
 * deletes an account the moment the member asks.
 */

const all = (slug: string) => {
  const d = findLegalDoc(slug)!;
  return [
    d.summary,
    ...d.sections.flatMap((s) => [
      s.heading,
      ...(s.paragraphs ?? []),
      ...(s.bullets ?? []),
      ...(s.ordered ?? []),
      ...(s.table ?? []).flatMap((r) => [r.key, r.value]),
    ]),
  ].join("\n");
};

describe("hesap-silme", () => {
  const text = all("hesap-silme");

  it("describes the Site's request and the app's in-app button", () => {
    expect(text).toContain("/uye/hesap/sil");
    expect(text).toContain("Hesabımın silinmesini istiyorum");
    expect(text).toContain('"Hesabımı sil"');
    expect(text).toMatch(/ekibimizce silinir/);
    expect(text).toMatch(/en geç otuz gün içinde ücretsiz olarak/);
  });

  it("says how a request is taken back", () => {
    expect(text).toContain("Talebi geri al");
  });

  it("says no commercial mail goes out while the Site's request is open", () => {
    // migration 20261018090100: the request is read as the refusal.
    expect(text).toMatch(
      /talep açık kaldığı sürece size [^.]*ticari elektronik ileti gönderilmez/,
    );
  });

  it("says what is kept, and on which basis", () => {
    expect(text).toContain("213 sayılı Vergi Usul Kanunu");
    expect(text).toContain("6102 sayılı Türk Ticaret Kanunu");
    const refs = findLegalDoc("hesap-silme")!.references!.join("\n");
    expect(refs).toContain("m.5/2-ç hukuki yükümlülük");
    expect(refs).toContain("m.13 veri sorumlusuna başvuru");
  });

  it("answers a deferred deletion within the thirty days too", () => {
    // KVKK m.13/2: the answer is due in thirty days even when an order in
    // flight holds the deletion back (Silme Yönetmeliği m.12/1).
    const deferral = findLegalDoc("hesap-silme")!
      .sections.find((s) => s.heading.startsWith("4."))!
      .paragraphs!.find((p) => p.startsWith("Devam eden bir sipariş"))!;
    expect(deferral).toMatch(
      /Bu durumda da talebiniz otuz gün içinde yanıtlanır; silmenin hangi süreç nedeniyle ertelendiği ve ne zaman uygulanacağı size bildirilir\.$/,
    );
  });

  it("an unpaid checkout is cancelled at closure, once the POS is asked (27 Ekim 2026)", () => {
    // App Review 5.1.1(v): the reviewer stops on the payment page and then
    // deletes the account. DELETE /me cancels the member's unpaid checkouts
    // before it counts what is in flight (src/lib/mobile/me.ts), each one
    // asked about at the POS first (rule 29), so the texts that say a running
    // order holds the closure say this one does not (LEGAL-REDLINES §36).
    // Not always at once, though: a sale still on the bank's 3-D Secure step,
    // or a POS that cannot be asked, leaves the order pending and the closure
    // waiting, at most 24 hours (POS_LOOKUP_GIVE_UP_MS, src/lib/admin/store.ts;
    // LEGAL-REDLINES §36.10).
    const deferral = findLegalDoc("hesap-silme")!
      .sections.find((s) => s.heading.startsWith("4."))!
      .paragraphs!.find((p) => p.startsWith("Devam eden bir sipariş"))!;
    expect(deferral).toContain(
      "Ödeme adımında ödemesi tamamlanmamış bir sipariş devam eden sipariş sayılmaz: silme sırasında iptal edilir; iptalden önce ödemenin durumu ödeme kuruluşundan sorulur ve ödemesinin alındığı anlaşılan sipariş iptal edilmez. Ödeme o sırada bankada sürüyorsa ya da ödeme kuruluşuna ulaşılamıyorsa silme, siparişin durumu netleşene kadar, en çok 24 saat bekler.",
    );
    const agreement = findLegalDoc("uyelik-sozlesmesi")!.sections.find((s) =>
      s.heading.startsWith("14."),
    )!;
    expect((agreement.paragraphs ?? []).join("\n")).toContain(
      "Ödeme adımında ödemesi tamamlanmamış bir sipariş devam eden sipariş sayılmaz; hesap kapatılırken iptal edilir. Şirket iptalden önce ödemenin durumunu ödeme kuruluşuna sorar ve ödemesinin alındığı anlaşılan siparişi iptal etmez. Ödeme o sırada bankada sürüyorsa ya da ödeme kuruluşuna ulaşılamıyorsa kapatma işlemi, siparişin durumu netleşene kadar, en çok 24 saat bekler.",
    );
    const app = findLegalDoc("mobil-uygulama-kosullari")!.sections.find((s) =>
      s.heading.startsWith("17."),
    )!;
    expect((app.paragraphs ?? []).join("\n")).toContain(
      "Ödeme adımında ödemesi tamamlanmamış bir sipariş devam eden sipariş sayılmaz; silme sırasında iptal edilir. İptalden önce ödemenin durumu ödeme kuruluşundan sorulur ve ödemesinin alındığı anlaşılan sipariş iptal edilmez. Ödeme o sırada bankada sürüyorsa ya da ödeme kuruluşuna ulaşılamıyorsa silme, siparişin durumu netleşene kadar, en çok 24 saat bekler.",
    );
  });

  it("no text says an unpaid order never delays the closure (27 Ekim 2026)", () => {
    // The first wording said it "ertelemez", and the code never promised
    // that: an order the POS could not be asked about has always held the
    // closure, for up to a day (rule 29, POS_LOOKUP_GIVE_UP_MS), and one
    // whose sale is on the bank's 3-D Secure step holds it too. Every
    // passage that takes an unpaid checkout out of the running orders
    // carries the wait in the same breath (LEGAL-REDLINES §36.10).
    const exempts = /ödemesi tamamlanmamış[^.]*devam eden sipariş sayılmaz/;
    const waits =
      /[Öö]deme o sırada bankada sürüyorsa ya da ödeme kuruluşuna ulaşılamıyorsa (silme|kapatma işlemi), siparişin durumu netleşene kadar, en çok 24 saat bekler/;
    const exempting: string[] = [];
    for (const d of LEGAL_DOCS) {
      for (const s of d.sections) {
        for (const block of [
          ...(s.paragraphs ?? []),
          ...(s.bullets ?? []),
          ...(s.ordered ?? []),
          ...(s.table ?? []).flatMap((r) => [r.key, r.value]),
        ]) {
          expect(block, d.slug).not.toMatch(/(kapatmayı|silmeyi) ertelemez/);
          if (!exempts.test(block)) continue;
          exempting.push(d.slug);
          expect(block, d.slug).toMatch(waits);
        }
      }
    }
    expect(exempting.sort()).toEqual([
      "hesap-silme",
      "kullanim-sartlari",
      "mobil-uygulama-kosullari",
      "uyelik-sozlesmesi",
    ]);
  });

  it("gives the Kurul's complaint periods as KVKK m.14 sets them", () => {
    const appeal = findLegalDoc("hesap-silme")!.sections.find((s) =>
      s.heading.startsWith("11."),
    )!.paragraphs![1];
    expect(appeal).toBe(
      "Başvurunuzun reddedilmesi, verilen cevabın yetersiz bulunması veya otuz gün içinde cevap verilmemesi hâllerinde, cevabı öğrendiğiniz tarihten itibaren otuz gün ve her hâlde başvuru tarihinden itibaren altmış gün içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz.",
    );
  });

  it("no longer describes saved cards: none are kept (rule 28)", () => {
    expect(text).not.toContain("Kayıtlı kartlarınız");
    expect(text).not.toContain("kart saklama");
  });

  it("says a Site request fixes the karaoke window at the request", () => {
    // ASK-Y3-4 (d): our delay does not shorten the member's window; a
    // booking made after the request counts from the closure.
    expect(text).toContain(
      "Site'deki hesap silme sayfasından verdiğiniz talepte bu süre talebinizin kaydedildiği ana, talepten sonra yaptığınız bir rezervasyonda ise hesabınızın silindiği ana göre hesaplanır",
    );
    expect(text).toContain("oda kullanılmadıysa iade yine yapılır");
  });

  it("no longer says the Site deletes on the member's click", () => {
    expect(text).not.toContain("şifrenizi doğruladığınızda anında");
    expect(text).not.toContain("Hesabım > Hesabı sil sayfası");
  });
});

describe("the other texts that sent members to /uye/hesap/sil", () => {
  it("no text offers the Site page as an immediate way to close the account", () => {
    for (const d of LEGAL_DOCS) {
      const text = all(d.slug);
      expect(text, d.slug).not.toMatch(
        /hesap silme seçeneğinden veya \S*\/uye\/hesap\/sil sayfasından başlat/,
      );
      expect(text, d.slug).not.toMatch(
        /uygulamadaki veya sitedeki hesap silme seçeneğiyle/,
      );
    }
  });

  it("both texts keep the same equal-ease promise and name the one step", () => {
    // Üyelik Sözleşmesi §14 makes the promise and prevails (hesap-silme §1).
    // Dropping it from one text read as a change against the member, which
    // §22 would have had announced fifteen days ahead (and TBK m.24 voids
    // anyway); kept in both, with the step the member takes spelled out.
    const promise = "üyeliğin kurulmasındaki kolaylıkla eşdeğer kolaylıkta";
    const agreement = findLegalDoc("uyelik-sozlesmesi")!.sections.find((s) =>
      s.heading.startsWith("14."),
    )!.paragraphs![0];
    const procedure = findLegalDoc("hesap-silme")!.sections.find((s) =>
      s.heading.startsWith("1."),
    )!.paragraphs!;
    expect(agreement).toContain(promise);
    expect(agreement).toMatch(/tek adım/);
    expect(procedure.join("\n")).toContain(promise);
    expect(procedure.join("\n")).toMatch(/tek adımda/);
  });

  it("Kullanım Şartları §7 names each channel and its time", () => {
    const terms = all("kullanim-sartlari");
    expect(terms).toContain(
      "Kullanıcı, üyeliğini dilediği zaman ve gerekçe göstermeksizin sonlandırabilir: Mobil Uygulama'daki hesap silme seçeneği, devam eden bir sipariş yoksa hesabı hemen kapatır (ödeme adımında ödemesi tamamlanmamış siparişler devam eden sipariş sayılmaz ve bu sırada iptal edilir; ödeme o sırada bankada sürüyorsa ya da ödeme kuruluşuna ulaşılamıyorsa silme, siparişin durumu netleşene kadar, en çok 24 saat bekler); Site'deki hesap silme sayfasından (https://",
    );
    expect(terms).toMatch(
      /\/uye\/hesap\/sil\) veya \S+@\S+ adresine iletilen talep en geç otuz gün içinde sonuçlandırılır\./,
    );
    expect(terms).not.toContain("hesap ayarları üzerinden ya da");
  });

  it("Mobil Uygulama Koşulları §17 sends web requests to the request page", () => {
    const app = findLegalDoc("mobil-uygulama-kosullari")!.sections.find((s) =>
      s.heading.startsWith("17."),
    )!.paragraphs![1];
    expect(app).toMatch(
      /; ayrıca Site'deki hesap silme sayfasından \(\S+\/uye\/hesap\/sil\) veya \S+ adresine gönderilecek bir talep ile de hesabın silinmesi istenebilir; bu talepler en geç otuz gün içinde sonuçlandırılır\.$/,
    );
    expect(app).not.toContain("ile de hesap kapatılabilir");
  });

  it("the membership agreement says the Site's request is answered within thirty days", () => {
    expect(all("uyelik-sozlesmesi")).toMatch(
      /Site'den veya e-postayla iletilen talep Şirket tarafından en geç otuz gün içinde sonuçlandırılır/,
    );
  });
});

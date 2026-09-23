import Link from "next/link";

import { unsubscribeNewsletterAction } from "@/app/newsletter/actions";

export const metadata = {
  title: "Bülten aboneliğinden çık · L'Affogato",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string; sonuc?: string; adres?: string }>;
}

/**
 * Unsubscribe — one press, no login, no typing the address back in (6563:
 * withdrawal must be free and at least as easy as consent was to give).
 *
 * Arriving from a message's link shows the button; pressing it spends the
 * token (unsubscribeNewsletterAction) and comes back here with `?sonuc=`. The
 * page used to spend the token on arrival, and mail security scanners open
 * every link — people were unsubscribed by a robot and then told their own
 * click was "geçersiz".
 */
export default async function BultenCikisPage({ searchParams }: PageProps) {
  const { token, sonuc, adres } = await searchParams;

  const state: "ask" | "done" | "failed" | "invalid" =
    sonuc === "tamam"
      ? "done"
      : sonuc === "hata"
        ? "failed"
        : sonuc === "gecersiz" || !token
          ? "invalid"
          : "ask";

  const heading = {
    ask: "Bültenden çıkmak istiyor musun?",
    done: "Çıkış tamamlandı.",
    failed: "Şu an işlenemedi.",
    invalid: "Bağlantı geçersiz.",
  }[state];

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" className="eyebrow auth-back">
          ← Anasayfa
        </Link>
        {/* The OUTCOME, not the topic: it is the one line a screen reader
            announces on arrival and the one line most people read. */}
        <h1 className="h1 auth-title">{heading}</h1>

        {state === "ask" ? (
          <>
            <p className="auth-lede">
              Aşağıdaki düğmeye bastığında bu adrese artık pazarlama e-postası
              göndermeyeceğiz. Sipariş ve kargo bildirimleri bundan etkilenmez.
            </p>
            <form action={unsubscribeNewsletterAction}>
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="btn btn-primary btn-lg">
                Abonelikten çık
              </button>
            </form>
          </>
        ) : state === "done" ? (
          <p className="auth-lede">
            {adres ? <strong>{adres}</strong> : "Bu"} adresine artık pazarlama
            e-postası göndermeyeceğiz. Sipariş ve kargo bildirimleri bundan
            etkilenmez — onlar aboneliğe değil, siparişine bağlıdır.
          </p>
        ) : state === "failed" ? (
          <p className="auth-lede">
            Birazdan tekrar dener misin? Sorun sürerse{" "}
            <a href="mailto:info@nextgenlab.com.tr">info@nextgenlab.com.tr</a>{" "}
            adresine yaz, listeden elle çıkaralım.
          </p>
        ) : (
          <p className="auth-lede">
            Bu bağlantı ya daha önce kullanılmış ya da eksik. Zaten çıkmış
            olabilirsin. Emin değilsen{" "}
            <a href="mailto:info@nextgenlab.com.tr">info@nextgenlab.com.tr</a>{" "}
            adresine yaz.
          </p>
        )}

        {state !== "ask" ? (
          <Link href="/" className="btn btn-primary btn-lg">
            Anasayfaya dön
          </Link>
        ) : null}
      </div>
    </main>
  );
}

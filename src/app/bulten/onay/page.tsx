import Link from "next/link";

import { confirmNewsletterAction } from "@/app/newsletter/actions";

export const metadata = {
  title: "Bülten aboneliğini onayla · L'Affogato",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string; sonuc?: string }>;
}

/**
 * Double opt-in (6563): the link in the confirmation mail lands here and the
 * subscription starts only when the owner presses the button — a POST, so a
 * mail scanner opening the link does not count as consent.
 */
export default async function BultenOnayPage({ searchParams }: PageProps) {
  const { token, sonuc } = await searchParams;

  const state: "ask" | "done" | "failed" | "invalid" =
    sonuc === "tamam"
      ? "done"
      : sonuc === "hata"
        ? "failed"
        : sonuc === "gecersiz" || !token
          ? "invalid"
          : "ask";

  const heading = {
    ask: "Aboneliğini onayla",
    done: "Aboneliğin başladı.",
    failed: "Şu an işlenemedi.",
    invalid: "Bağlantı geçersiz.",
  }[state];

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" className="eyebrow auth-back">
          ← Anasayfa
        </Link>
        <h1 className="h1 auth-title">{heading}</h1>

        {state === "ask" ? (
          <>
            <p className="auth-lede">
              L&apos;Affogato&apos;dan kampanya, yeni ürün ve etkinlik
              duyurularını e-posta ile almak için düğmeye bas. Onayını istediğin
              zaman, her e-postadaki bağlantıdan geri çekebilirsin.
            </p>
            <form action={confirmNewsletterAction}>
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="btn btn-primary btn-lg">
                Aboneliğimi onayla
              </button>
            </form>
          </>
        ) : state === "done" ? (
          <p className="auth-lede">
            Teşekkürler! Ayda bir mektubumuzu bekle. Her e-postanın altında tek
            tıkla çıkış bağlantısı var. 🤍
          </p>
        ) : state === "failed" ? (
          <p className="auth-lede">Birazdan tekrar dener misin?</p>
        ) : (
          <p className="auth-lede">
            Bu bağlantı ya daha önce kullanılmış, ya süresi (7 gün) dolmuş ya da
            eksik. Aboneliğini alt bilgideki formdan yeniden isteyebilirsin.
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

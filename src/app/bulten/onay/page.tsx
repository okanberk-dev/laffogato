import { cookies } from "next/headers";

import { confirmNewsletterAction } from "@/app/newsletter/actions";
import { LafMark } from "@/components/laffogato/brand-mark";
import Link from "@/components/link";
import { NEWSLETTER_LINK_COOKIES } from "@/lib/newsletter/link-token";

export const metadata = {
  // `absolute`: the root template would append the brand a second time.
  title: { absolute: "Bülten aboneliğini onayla · L'Affogato" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string; sonuc?: string }>;
}

/**
 * Double opt-in (6563): the link in the confirmation mail lands here and the
 * subscription starts only when the owner presses the button - a POST, so a
 * mail scanner opening the link does not count as consent.
 */
export default async function BultenOnayPage({ searchParams }: PageProps) {
  const { token: linkToken, sonuc } = await searchParams;
  // The proxy moves the link's token into this page's cookie and reloads
  // without it, so the address the site's tags see has none
  // (lib/newsletter/link-token.ts).
  const token =
    linkToken ||
    (await cookies()).get(NEWSLETTER_LINK_COOKIES["/bulten/onay"])?.value ||
    "";

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
    done: "Aboneliğin başladı",
    failed: "Şu an işlenemedi",
    invalid: "Bağlantı geçersiz",
  }[state];

  return (
    <main className="auth-page auth-page--full">
      <div className="auth-card">
        <div className="auth-head">
          <Link href="/" className="auth-back">
            ← Anasayfa
          </Link>
          <LafMark tone="duo" />
        </div>
        <h1 className="auth-title">{heading}</h1>

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

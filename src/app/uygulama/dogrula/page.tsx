import { cookies } from "next/headers";

import { LafMark } from "@/components/laffogato/brand-mark";
import Link from "@/components/link";
import { decodeEmailLink, EMAIL_LINK_COOKIE } from "@/lib/customer/email-link";

import { confirmEmailLinkAction } from "./actions";

export const metadata = {
  title: { absolute: "E-posta doğrulama · L'Affogato" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ sonuc?: string }>;
}

/**
 * Where the sign-up mail's confirmation link lands when the app does not
 * open it: a desktop, a phone without the app, or any phone until the
 * association claims `/uygulama/*` (minimum app version 1.1.1,
 * src/lib/mobile/app-links.ts). The proxy has already moved the link's
 * token into this page's cookie (lib/customer/email-link.ts); the member
 * presses the button, which confirms the address and signs nobody in.
 */
export default async function UygulamaDogrulaPage({ searchParams }: PageProps) {
  const { sonuc } = await searchParams;
  const link = decodeEmailLink((await cookies()).get(EMAIL_LINK_COOKIE)?.value);

  const state: "ask" | "done" | "failed" | "invalid" =
    sonuc === "tamam"
      ? "done"
      : sonuc === "hata"
        ? "failed"
        : sonuc === "gecersiz" || !link
          ? "invalid"
          : "ask";

  const heading = {
    ask: "E-postanı doğrula",
    done: "E-postan doğrulandı",
    failed: "Şu an doğrulanamadı",
    invalid: "Bağlantı geçersiz",
  }[state];

  return (
    <main className="auth-page auth-page--full">
      <div className="auth-card auth-card--center">
        <div className="auth-head">
          <Link href="/" className="auth-back">
            ← Anasayfa
          </Link>
          <LafMark tone="duo" />
        </div>
        <h1 className="auth-title">{heading}</h1>

        {state === "ask" && link ? (
          <>
            <p className="auth-lede">
              L&apos;Affogato hesabını açmak için e-posta adresini doğrula.
              Düğmeye bastığında hesabın etkinleşir; sonra uygulamada ya da
              sitede e-postan ve parolanla giriş yapabilirsin.
            </p>
            <form action={confirmEmailLinkAction}>
              <input type="hidden" name="token_hash" value={link.tokenHash} />
              <input type="hidden" name="type" value={link.type} />
              <button type="submit" className="btn btn-primary btn-lg">
                E-postamı doğrula
              </button>
            </form>
          </>
        ) : state === "done" ? (
          <>
            <p className="auth-lede">
              Hesabın artık aktif. L&apos;Affogato uygulamasına dönüp e-postan
              ve parolanla giriş yapabilir ya da sitede devam edebilirsin.
            </p>
            <div className="auth-actions">
              <Link href="/uye/giris" className="btn btn-primary">
                Sitede giriş yap
              </Link>
            </div>
          </>
        ) : state === "failed" ? (
          <p className="auth-lede">
            Bağlantıyı şu an doğrulayamadık. Birazdan e-postadaki düğmeye
            yeniden dokunur musun?
          </p>
        ) : (
          <>
            <p className="auth-lede">
              Bu bağlantı ya daha önce kullanılmış, ya süresi dolmuş ya da
              eksik. Uygulamanın giriş ekranından ya da sitede yeni bir
              doğrulama e-postası isteyebilirsin. E-postadaki kodu uygulamadaki
              doğrulama ekranına yazarak da doğrulayabilirsin.
            </p>
            <div className="auth-actions">
              <Link href="/uye/giris" className="btn btn-primary">
                Giriş ekranına git
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

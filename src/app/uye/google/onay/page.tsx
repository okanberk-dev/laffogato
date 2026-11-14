import { redirect } from "next/navigation";

import { LafMark } from "@/components/laffogato/brand-mark";
import Link from "@/components/link";
import { getActiveCustomer } from "@/lib/customer/auth";
import { sameSitePath } from "@/lib/http/same-site-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { GoogleConsentForm } from "./consent-form";

export const metadata = {
  title: "Üyeliğini tamamla · L'Affogato",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

/**
 * The one stop a new member makes after "Google ile devam et"
 * (docs/AUTH-BRIDGE.md §7): the agreement's tick, before a member row
 * exists. Reached only from `/uye/google/donus`; with no Google session in
 * the cookies (a typed address, a session that expired, a "Vazgeç" in
 * another tab) it sends the visitor to the sign-in page.
 *
 * Reading the Supabase user here is safe under `/uye`: the proxy has already
 * refreshed the session for this request (`isSessionRefreshPath`), so the
 * read rotates nothing it cannot write. The action reads it again itself.
 */
export default async function GoogleConsentPage({ searchParams }: PageProps) {
  const { next: rawNext } = await searchParams;
  const next = sameSitePath(rawNext) ?? undefined;
  if (await getActiveCustomer()) redirect(next ?? "/uye/hesap");

  let email = "";
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email?.trim() ?? "";
  } catch (err) {
    console.error(
      `[uye/google] consent page could not read the session: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!email) redirect("/uye/giris");

  return (
    <div className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-head">
          <Link href="/" className="auth-back">
            ← Anasayfa
          </Link>
          <LafMark tone="duo" />
        </div>
        <p className="eyebrow">Google ile üyelik</p>
        <h1 id="auth-title" className="auth-title">
          Üyeliğini tamamla
        </h1>
        <p className="auth-lede">
          <strong>{email}</strong> Google hesabıyla ilk kez geldin. Üyeliğini
          açmak için kullanım şartlarını onayla; siparişlerin, adreslerin ve
          damgaların uygulamada da bu hesapta durur.
        </p>
        <GoogleConsentForm next={next} />
      </section>
    </div>
  );
}

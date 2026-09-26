import Link from "next/link";

import { LafMark } from "@/components/laffogato/brand-mark";
import { VerifyNotice } from "@/components/customer/verify-notice";
import { getPublicSettings } from "@/lib/admin/store";
import { getActiveCustomer } from "@/lib/customer/auth";

import { CheckoutWizard } from "./checkout-wizard";

function GatePanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="checkout-gate">
      <LafMark tone="duo" />
      {children}
    </div>
  );
}

// `absolute`: the root layout's "%s · L'Affogato" template applies to a
// page in the same folder as its layout, and this string already carries the
// brand ("Ödeme · L'Affogato · L'Affogato" in the tab before).
export const metadata = { title: { absolute: "Ödeme · L'Affogato" } };
export const dynamic = "force-dynamic";

/** Redirect reasons the checkout can bounce back with. */
const CHECKOUT_NOTICES: Record<string, string> = {
  consent:
    "Siparişi tamamlamak için Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi onayı zorunludur. Lütfen iki onay kutusunu da işaretleyin.",
  payment:
    "Ödeme tamamlanamadı. Kartınızdan tahsilat yapılmadı - dilerseniz tekrar deneyebilirsiniz.",
};

export default async function OdemePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Settings first: if the shop is closed - including because the database is
  // unreachable, which forces it closed - nothing else needs loading, and the
  // wizard must not render against fallback tax and shipping values.
  const settings = await getPublicSettings();
  const customer = settings.isShopOpen ? await getActiveCustomer() : null;
  const { error } = await searchParams;
  const notice = error ? CHECKOUT_NOTICES[error] : undefined;
  const config = {
    shippingFlatMinor: settings.shippingFlatMinor,
    shippingFreeThresholdMinor: settings.shippingFreeThresholdMinor,
    taxRatePct: settings.taxRatePct,
  };
  return (
    <main className="checkout-page">
      <div className="checkout-page-wrap">
        <header className="checkout-page-head">
          <Link href="/magaza" className="auth-back">
            ← Alışverişe dön
          </Link>
          <div className="checkout-brand">
            <LafMark tone="duo" label="L'Affogato" />
            <span className="checkout-secure">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4.5 7V5.2a3.5 3.5 0 0 1 7 0V7" />
                <rect x="3" y="7" width="10" height="7" rx="2" />
              </svg>
              Güvenli ödeme
            </span>
          </div>
        </header>
        {notice && (
          <p role="alert" className="auth-alert checkout-notice">
            {notice}
          </p>
        )}
        {!settings.isShopOpen ? (
          <GatePanel>
            <h1 className="checkout-gate-title">Şu an sipariş alamıyoruz</h1>
            <p className="checkout-gate-lede">
              Mağaza geçici olarak siparişe kapalı. Sepetin korunuyor - birazdan
              tekrar denersen kaldığın yerden devam edebilirsin.
            </p>
            <Link href="/magaza" className="btn btn-primary">
              Mağazaya dön
            </Link>
          </GatePanel>
        ) : !customer ? (
          <GatePanel>
            <h1 className="checkout-gate-title">Sipariş için giriş yap</h1>
            <p className="checkout-gate-lede">
              Güvenliğin için siparişler yalnızca doğrulanmış hesaplarla
              verilebilir. Giriş yap ya da hızlıca bir hesap oluştur - e-postanı
              onayladıktan sonra ödemeye devam edebilirsin.
            </p>
            <div className="checkout-gate-actions">
              <Link href="/uye/giris?next=/odeme" className="btn btn-primary">
                Giriş yap
              </Link>
              <Link href="/uye/kayit?next=/odeme" className="btn btn-ghost">
                Hesap oluştur
              </Link>
            </div>
          </GatePanel>
        ) : !customer.emailVerified ? (
          <GatePanel>
            {/* Every branch of this page needs its own h1: the wizard carries
                one, but a visitor stopped at a gate used to get a checkout
                page with no heading at all. */}
            <h1 className="checkout-gate-title">
              Ödemeden önce e-postanı doğrula
            </h1>
            <VerifyNotice email={customer.email} />
          </GatePanel>
        ) : (
          <CheckoutWizard customer={customer} config={config} />
        )}
      </div>
    </main>
  );
}

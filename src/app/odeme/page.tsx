import Link from "next/link";

import { VerifyNotice } from "@/components/customer/verify-notice";
import { getPublicSettings } from "@/lib/admin/store";
import { getActiveCustomer } from "@/lib/customer/auth";

import { CheckoutWizard } from "./checkout-wizard";

function GatePanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        background: "#fff",
        border: "1px solid rgba(20,16,11,0.08)",
        borderRadius: 18,
        padding: "32px 28px",
      }}
    >
      {children}
    </div>
  );
}

export const metadata = { title: "Ödeme · L'Affogato" };
export const dynamic = "force-dynamic";

/** Redirect reasons the checkout can bounce back with. */
const CHECKOUT_NOTICES: Record<string, string> = {
  consent:
    "Siparişi tamamlamak için Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi onayı zorunludur. Lütfen onay kutusunu işaretleyin.",
  payment:
    "Ödeme tamamlanamadı. Kartınızdan tahsilat yapılmadı — dilerseniz tekrar deneyebilirsiniz.",
};

export default async function OdemePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Settings first: if the shop is closed — including because the database is
  // unreachable, which forces it closed — nothing else needs loading, and the
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
          <Link
            href="/#shop"
            className="eyebrow"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            ← Alışverişe dön
          </Link>
          <div className="checkout-brand">
            <span
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "normal",
                fontSize: 22,
                letterSpacing: "-0.015em",
              }}
            >
              L&apos;Affogato
            </span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
              }}
            >
              Sicuro · 256-bit SSL
            </span>
          </div>
        </header>
        {notice && (
          <p
            role="alert"
            style={{
              maxWidth: 640,
              margin: "0 auto 24px",
              padding: "14px 18px",
              border: "1px solid rgba(180,60,40,0.28)",
              background: "rgba(180,60,40,0.06)",
              borderRadius: 14,
              color: "#8c2f1e",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {notice}
          </p>
        )}
        {!settings.isShopOpen ? (
          <GatePanel>
            <h2
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "normal",
                fontSize: 26,
                marginBottom: 10,
              }}
            >
              Şu an sipariş alamıyoruz
            </h2>
            <p
              style={{
                color: "rgba(20,16,11,0.7)",
                lineHeight: 1.6,
                fontSize: 15,
                marginBottom: 22,
              }}
            >
              Mağaza geçici olarak siparişe kapalı. Sepetin korunuyor — birazdan
              tekrar denersen kaldığın yerden devam edebilirsin.
            </p>
            <Link href="/#shop" className="btn btn-primary btn-sm">
              Mağazaya dön
            </Link>
          </GatePanel>
        ) : !customer ? (
          <GatePanel>
            <h2
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "normal",
                fontSize: 26,
                marginBottom: 10,
              }}
            >
              Sipariş için giriş yap
            </h2>
            <p
              style={{
                color: "rgba(20,16,11,0.7)",
                lineHeight: 1.6,
                fontSize: 15,
                marginBottom: 22,
              }}
            >
              Güvenliğin için siparişler yalnızca doğrulanmış hesaplarla
              verilebilir. Giriş yap ya da hızlıca bir hesap oluştur — e-postanı
              onayladıktan sonra ödemeye devam edebilirsin.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link
                href="/uye/giris?next=/odeme"
                className="btn btn-primary btn-sm"
              >
                Giriş yap
              </Link>
              <Link
                href="/uye/kayit?next=/odeme"
                className="btn btn-ghost btn-sm"
              >
                Hesap oluştur
              </Link>
            </div>
          </GatePanel>
        ) : !customer.emailVerified ? (
          <GatePanel>
            <VerifyNotice email={customer.email} />
          </GatePanel>
        ) : (
          <CheckoutWizard customer={customer} config={config} />
        )}
      </div>
    </main>
  );
}

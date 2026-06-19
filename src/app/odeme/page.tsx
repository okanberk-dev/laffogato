import Link from "next/link";

import { VerifyNotice } from "@/components/customer/verify-notice";
import { getSettings } from "@/lib/admin/store";
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

export default async function OdemePage() {
  const [customer, settings] = await Promise.all([
    getActiveCustomer(),
    getSettings(),
  ]);
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
                fontStyle: "italic",
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
        {!customer ? (
          <GatePanel>
            <h2
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
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

import Link from "next/link";

import { getSettings } from "@/lib/admin/store";
import { getActiveCustomer } from "@/lib/customer/auth";

import { CheckoutWizard } from "./checkout-wizard";

export const metadata = { title: "Ödeme · L'Affogato" };
export const dynamic = "force-dynamic";

export default async function OdemePage() {
  const [customer, settings] = await Promise.all([getActiveCustomer(), getSettings()]);
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
            <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 22, letterSpacing: "-0.015em" }}>
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
        <CheckoutWizard customer={customer} config={config} />
      </div>
    </main>
  );
}

import { LafMark } from "@/components/laffogato/brand-mark";
import { VerifyNotice } from "@/components/customer/verify-notice";
import { getPublicSettings, listProductsForImport } from "@/lib/admin/store";
import {
  checkoutReturnCopy,
  readCheckoutReturn,
} from "@/lib/checkout/return-codes";
import { getActiveCustomer } from "@/lib/customer/auth";
import { findLegalDoc } from "@/lib/legal/documents";
import { LEGAL_ADDRESS_LINE, LEGAL_ENTITY } from "@/lib/legal/entity";
import { CHECKOUT_CONSENT_DOCS } from "@/lib/legal/meta";
import { getPublishedLegalOverride } from "@/lib/legal/store";
import { checkoutPaymentSetup } from "@/lib/payment/saved-cards";
import {
  productTaxRate,
  shippingTaxRate,
  type TaxRates,
} from "@/lib/utils/kdv";

import { Checkout } from "../checkout";
import { checkoutDocument, type CheckoutDocument } from "../checkout-documents";
import { NO_CHECKOUT_KDV_RATES, type CheckoutKdvRates } from "../checkout-kdv";

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
// Dynamic on purpose, and it must stay so: the document's CSP nonce is
// minted per request (src/proxy.ts) and Next.js stamps it while rendering.
export const dynamic = "force-dynamic";

/**
 * The two documents the payment step opens in its panel (ASK-OTH-2, 18 Eki
 * 2026), read the way /hukuk/[slug] reads them: a published panel override
 * when there is one, else the coded text. An override that cannot be read
 * degrades to the coded text there too (`getPublishedLegalOverride`).
 */
async function checkoutDocuments(): Promise<CheckoutDocument[]> {
  const docs = await Promise.all(
    CHECKOUT_CONSENT_DOCS.map(async (slug) => {
      const doc = findLegalDoc(slug);
      if (!doc) return null;
      return checkoutDocument(slug, doc, await getPublishedLegalOverride(slug));
    }),
  );
  return docs.filter((d): d is CheckoutDocument => d !== null);
}

/**
 * The rate each product's order line will carry (`productTaxRate`, the rule
 * `shopLineItems` stamps with) and the shipping fee's own rate (the one
 * `insertOrderRow` stamps), for the KDV note under the total. Display only: if the
 * catalogue cannot be read the note is left out, the order is unaffected.
 * Read without the photos (`listProductsForImport`: a stored upload is a data
 * URL of up to 2 MB, and this page loads on every visit).
 */
async function checkoutKdvRates(taxRates: TaxRates): Promise<CheckoutKdvRates> {
  try {
    const products: Record<string, number> = {};
    for (const p of await listProductsForImport()) {
      products[p.id] = productTaxRate(p, taxRates);
    }
    return {
      products,
      shippingRatePct: shippingTaxRate(taxRates),
    };
  } catch {
    return NO_CHECKOUT_KDV_RATES;
  }
}

/**
 * The checkout (docs/PAYNKOLAY.md §15.5): delivery, the card and the order
 * summary on one page, in two steps. Every link out of here is a plain <a>
 * - leaving must be a full page load (see checkout-chrome.tsx).
 */
export default async function OdemePage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    odeme?: string | string[];
    alan?: string | string[];
    dk?: string | string[];
  }>;
}) {
  // Settings first: if the shop is closed - including because the database is
  // unreachable, which forces it closed - nothing else needs loading, and the
  // checkout must not render against fallback tax and shipping values.
  const settings = await getPublicSettings();
  const customer = settings.isShopOpen ? await getActiveCustomer() : null;
  // Only fixed codes are read (return-codes.ts): a hand-made link cannot put
  // its own words on this page.
  const returned = readCheckoutReturn(await searchParams);

  // A return notice ("Ödeme tamamlanmadı") is said ABOVE the gate panels
  // too: a customer whose session ended on the bank's page, or who comes
  // back while the shop is closed, still learns what happened to the payment.
  // The checkout itself shows it in its own step 2 instead (checkout.tsx).
  const gateNotice = returned ? checkoutReturnCopy(returned) : null;

  let body: React.ReactNode;
  if (!settings.isShopOpen) {
    body = (
      <GatePanel>
        <h1 className="checkout-gate-title">Şu an sipariş alamıyoruz</h1>
        <p className="checkout-gate-lede">
          Sepetin korunuyor; birazdan yeniden dene.
        </p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load on purpose: the checkout document keeps its own policy (checkout-chrome.tsx) */}
        <a href="/magaza" className="btn btn-primary">
          Mağazaya dön
        </a>
      </GatePanel>
    );
  } else if (!customer) {
    body = (
      <GatePanel>
        <h1 className="checkout-gate-title">Sipariş için giriş yap</h1>
        <p className="checkout-gate-lede">
          Siparişler doğrulanmış bir hesapla verilir.
        </p>
        <div className="checkout-gate-actions">
          <a href="/uye/giris?next=/odeme" className="btn btn-primary">
            Giriş yap
          </a>
          <a href="/uye/kayit?next=/odeme" className="btn btn-ghost">
            Hesap oluştur
          </a>
        </div>
      </GatePanel>
    );
  } else if (!customer.emailVerified) {
    body = (
      <GatePanel>
        {/* Every branch of this page needs its own h1: the checkout carries
            one, and a visitor stopped at a gate gets one here. */}
        <h1 className="checkout-gate-title">Ödemeden önce e-postanı doğrula</h1>
        <VerifyNotice email={customer.email} />
      </GatePanel>
    );
  } else {
    const [payment, documents, kdv] = await Promise.all([
      checkoutPaymentSetup(customer.email),
      checkoutDocuments(),
      checkoutKdvRates(settings.taxRates),
    ]);
    body = (
      <Checkout
        // Only what the page shows: never the whole account row.
        customer={{
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          addresses: customer.addresses,
        }}
        config={{
          shippingFlatMinor: settings.shippingFlatMinor,
          shippingFreeThresholdMinor: settings.shippingFreeThresholdMinor,
        }}
        payment={payment}
        seller={{
          name: LEGAL_ENTITY.legalName,
          address: LEGAL_ADDRESS_LINE,
          phone: LEGAL_ENTITY.phone,
          email: LEGAL_ENTITY.email,
          mersis: LEGAL_ENTITY.mersisNo,
        }}
        documents={documents}
        kdv={kdv}
        returned={returned}
      />
    );
  }

  const showGateNotice =
    !!gateNotice &&
    (!settings.isShopOpen || !customer || !customer.emailVerified);
  return (
    <div className="checkout-page">
      <div className="checkout-page-wrap">
        {showGateNotice && gateNotice ? (
          <p role="alert" className="auth-alert checkout-notice">
            <strong>{gateNotice.title}.</strong> {gateNotice.reason}
            {gateNotice.notCharged ? " Kartından para çekilmedi." : ""}
          </p>
        ) : null}
        {body}
      </div>
    </div>
  );
}

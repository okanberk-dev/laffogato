import { priceLabel } from "@/lib/utils/format";

/**
 * What the payment step says about THIS order before a card field (operator
 * decision ASK-OTH-2, 18 Eki 2026; Mesafeli Sözleşmeler Yönetmeliği m.6/2-a,
 * 6563 m.4/1-a, ETHS Yönetmeliği m.8/1-b): the lines, shipping, any discount
 * and the KDV-included total, the withdrawal terms in a few sentences, and
 * the same facts at the head of the Ön Bilgilendirme Formu and the Mesafeli
 * Satış Sözleşmesi when the customer opens them here.
 *
 * Every amount is the one the checkout shows, which is the server's quote
 * once it has answered (`quoted` in checkout.tsx); nothing is computed here.
 *
 * No "use client": pure markup, imported by the checkout (a client
 * component) and rendered directly by the tests, like checkout-consent.tsx.
 */

/** One order line as the payment step shows it. */
export interface OrderBriefLine {
  key: string;
  /** "Ürün" or "Ürün · Varyant". */
  label: string;
  qty: number;
  /** KDV-included, unit price × qty. */
  lineMinor: number;
}

export interface OrderBriefTotals {
  shippingMinor: number;
  discountMinor: number;
  totalMinor: number;
  /** The code the discount came from, shown beside it. */
  promoCode?: string;
}

/** "Ücretsiz" for no fee: the word the rest of the checkout uses. */
export function shippingLabel(shippingMinor: number): string {
  return shippingMinor > 0 ? priceLabel(shippingMinor) : "Ücretsiz";
}

function lineText(line: OrderBriefLine): string {
  return `${line.label} × ${line.qty}`;
}

/**
 * "Siparişin": open on every screen size, right above the card. The side
 * summary may stay folded on a phone; this block is what keeps the lines on
 * screen before the payment obligation.
 */
export function OrderBrief({
  lines,
  totals,
  kdvParts,
}: {
  lines: readonly OrderBriefLine[];
  totals: OrderBriefTotals;
  /** "%10 · 12,73₺, %20 · 8,33₺" (checkout-kdv.ts), or null to leave it out. */
  kdvParts: string | null;
}) {
  return (
    <section className="co-brief" aria-labelledby="co-brief-title">
      <h3 className="co-brief-title" id="co-brief-title">
        Siparişin
      </h3>
      <ul className="co-brief-lines">
        {lines.map((line) => (
          <li key={line.key}>
            <span className="co-brief-name">{lineText(line)}</span>
            <span className="tabular">{priceLabel(line.lineMinor)}</span>
          </li>
        ))}
      </ul>
      <dl className="co-brief-totals">
        <div>
          <dt>Kargo</dt>
          <dd className="tabular">{shippingLabel(totals.shippingMinor)}</dd>
        </div>
        {totals.discountMinor > 0 ? (
          <div>
            <dt>İndirim{totals.promoCode ? ` · ${totals.promoCode}` : ""}</dt>
            <dd className="tabular">−{priceLabel(totals.discountMinor)}</dd>
          </div>
        ) : null}
        <div className="co-brief-total">
          <dt>Toplam (KDV dahil)</dt>
          <dd className="tabular">{priceLabel(totals.totalMinor)}</dd>
        </div>
        {kdvParts ? (
          <div className="co-brief-kdv">
            <dt>KDV dahil:</dt>
            <dd className="tabular">{kdvParts}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

/**
 * The withdrawal terms, word for word as decided (ASK-OTH-2 (1) b; MSY
 * m.5/1-g, m.6/2-a, m.12/5, m.13/1, m.15/1), then the full document. The
 * seller's address is the entity's (`LEGAL_ENTITY.email`).
 */
export const WITHDRAWAL_SENTENCES = {
  lead: "Kargo siparişlerinde ürünü teslim aldığın günden itibaren 14 gün içinde gerekçe göstermeden cayabilirsin; teslimattan önce de cayabilirsin.",
  notifyWithout:
    "Bildirimini e-postayla yapman yeterli, adres bağlantıdaki belgede.",
  rest: "Ürünü bildiriminden sonraki 14 gün içinde geri gönder: sana e-postayla göndereceğimiz iade koduyla gönderirsen ücret ödemezsin, başka bir kargoyla gönderirsen ödediğin ücreti geri öderiz. Çabuk bozulabilen gıdalarda (gelato gibi soğuk zincir gerektiren ürünler), ambalajı açılmış olup iadesi sağlık ve hijyen açısından uygun olmayan ürünlerde (açılmış kahve paketi, yenilebilir kup kutusu, krema, şurup) ve isteğine göre öğütülen ya da kişiye özel hazırlanan ürünlerde cayma hakkı yoktur. Ürün ayıplı, bozuk, eksik veya yanlış gelirse yasal hakların her hâlükârda saklıdır.",
} as const;

export function WithdrawalNote({ sellerEmail }: { sellerEmail: string }) {
  const email = sellerEmail.trim();
  return (
    <section className="co-withdrawal" aria-labelledby="co-withdrawal-title">
      <h3 className="co-brief-title" id="co-withdrawal-title">
        Cayma hakkın
      </h3>
      <p>
        {WITHDRAWAL_SENTENCES.lead}{" "}
        {email ? (
          <>
            Bildirimini <a href={`mailto:${email}`}>{email}</a> adresine yazman
            yeterli.
          </>
        ) : (
          WITHDRAWAL_SENTENCES.notifyWithout
        )}{" "}
        {WITHDRAWAL_SENTENCES.rest}
      </p>
      <ul className="co-docs-links">
        <li>
          <a href="/hukuk/iade-ve-cayma" target="_blank" rel="noopener">
            İptal, iade ve cayma
          </a>
        </li>
      </ul>
    </section>
  );
}

/** How the order is paid, as the filled documents name it. */
export const CARD_PAYMENT_METHOD = "Kart, tek çekim (PayNkolay, 3D Secure)";
export const NOTHING_TO_PAY_METHOD =
  "Ödeme alınmaz: tutarın tamamı indirimle karşılanır";

/** The order the documents are opened for, filled from the checkout. */
export interface OrderFacts {
  buyer: string;
  email: string;
  phone: string;
  address: string;
  lines: readonly OrderBriefLine[];
  shippingMinor: number;
  discountMinor: number;
  totalMinor: number;
  promoCode?: string;
  kdvParts: string | null;
  paymentMethod: string;
  /** The Istanbul day the documents are read on, "18 Ekim 2026". */
  date: string;
}

/** The venue's calendar day (CLAUDE.md rule 22), "18 Ekim 2026". */
export function istanbulDateLabel(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(at);
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{value.trim() || "Belirtilmedi"}</td>
    </tr>
  );
}

/**
 * "Bu siparişin bilgileri": the head of a document opened from the payment
 * step, so the form reads filled with this order (ASK-OTH-2 (1) c).
 */
export function OrderFactsTable({ facts }: { facts: OrderFacts }) {
  const numbered = facts.lines.length > 1;
  return (
    <section className="co-facts" aria-labelledby="co-facts-title">
      <h3 className="co-facts-title" id="co-facts-title">
        Bu siparişin bilgileri
      </h3>
      <div className="legal-table-wrap">
        <table className="legal-table co-facts-table">
          <tbody>
            <FactRow label="Alıcı" value={facts.buyer} />
            <FactRow label="E-posta" value={facts.email} />
            <FactRow label="Telefon" value={facts.phone} />
            <FactRow label="Teslimat adresi" value={facts.address} />
            {facts.lines.map((line, i) => (
              <FactRow
                key={line.key}
                label={numbered ? `Ürün ${i + 1}` : "Ürün"}
                value={`${lineText(line)}: ${priceLabel(line.lineMinor)} (KDV dahil)`}
              />
            ))}
            <FactRow label="Kargo" value={shippingLabel(facts.shippingMinor)} />
            <FactRow
              label="İndirim"
              value={
                facts.discountMinor > 0
                  ? `−${priceLabel(facts.discountMinor)}${facts.promoCode ? ` (${facts.promoCode})` : ""}`
                  : "Yok"
              }
            />
            <FactRow
              label="Toplam (KDV dahil)"
              value={priceLabel(facts.totalMinor)}
            />
            {facts.kdvParts ? (
              <FactRow label="Toplamdaki KDV" value={facts.kdvParts} />
            ) : null}
            <FactRow label="Ödeme yöntemi" value={facts.paymentMethod} />
            <FactRow label="Tarih" value={facts.date} />
          </tbody>
        </table>
      </div>
    </section>
  );
}

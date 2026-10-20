import {
  ORDER_FULFILLMENT_LABELS,
  orderFulfillment,
  orderTable,
} from "@/lib/admin/order-channel";
import { escapeHtml } from "@/lib/email/fill";
import { isKaraokeRef } from "@/lib/mobile/karaoke-ref";
import {
  formatReservationDate,
  formatReservationTime,
} from "@/lib/mobile/karaoke-format";
import {
  istanbulTimeLabel,
  karaokeCancelDeadline,
  karaokeCancelPolicyOf,
  karaokeLateRefundMinor,
} from "@/lib/mobile/karaoke-time";
import { priceLabel } from "@/lib/utils/format";

import { istanbulDayLabel } from "./consent-version";
import type { LegalSection } from "./documents";
import { LEGAL_ADDRESS_LINE, LEGAL_ENTITY } from "./entity";
import type { LegalVersionDoc } from "./version-core";

/**
 * The confirmed contract as a file: the order's (or the booking's) own facts
 * at the head, then the full text of each confirmed document in the version
 * the consent recorded (decision ASK-DURABLE, 21 Ekim 2026). The
 * confirmation mail attaches it and the member downloads it
 * (`durable-copy-load.ts` reads the stored versions; this only writes).
 *
 * One self-contained HTML page: CSS inline in the head, 16 px body text,
 * laid out for print, nothing fetched (no image, font, stylesheet or script;
 * its own Content-Security-Policy refuses all of it if a browser opens it),
 * no link that loads anything. Every value is escaped, the customer's name,
 * address and the product names included, and so is the legal text itself.
 *
 * Every amount is the stored order's (integer kuruş, KDV dahil), printed
 * with `priceLabel`; nothing is recomputed from today's prices. The karaoke
 * deadline and late refund are the booking's own snapshot. The output is a
 * pure function of its inputs: the same order gives the same bytes, whenever
 * it is made.
 *
 * Pure: no I/O, no "server-only".
 */

/** The order fields the copy prints (`AdminOrder`). */
export interface DurableCopyOrder {
  orderNo: number;
  customerName: string;
  shippingAddress: string;
  items: readonly {
    productName: string;
    detail?: string;
    qty: number;
    unitPriceMinor: number;
  }[];
  subtotalMinor: number;
  discountMinor: number;
  promoCode?: string;
  shippingMinor: number;
  totalMinor: number;
  fulfillment?: string;
  tableCode?: string;
  tableName?: string;
}

/** The booking fields the copy prints (`KaraokeReservation`). */
export interface DurableCopyBooking {
  id: string;
  customerName: string;
  date: string;
  startHour: number;
  hours: number;
  guests: number;
  totalMinor: number;
  paidMinor?: number;
  freeCancelHours?: number | null;
  lateRefundPercent?: number | null;
  cancelDeadline?: string | null;
}

/** The consent fields the copy prints (`legalConsent`). */
export interface DurableCopyConsent {
  acceptedAt: string;
  version: string;
}

/** One confirmed document: its stored text, its hash, its version page. */
export interface DurableCopyDocument {
  doc: LegalVersionDoc;
  hash: string;
  /** Absolute URL of `/hukuk/<slug>?surum=<prefix>`. */
  url: string;
}

const e = escapeHtml;

/** "21 Ekim 2026, 14:05", on the köşk's clock (CLAUDE.md rule 22). */
export function istanbulInstantLabel(iso: string): string {
  const day = istanbulDayLabel(iso);
  const time = istanbulTimeLabel(iso);
  return day && time ? `${day}, ${time}` : "";
}

const STYLE = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;padding:24px 16px 40px;background:#ffffff;color:#211c18;font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;-webkit-text-size-adjust:100%}
main{max-width:760px;margin:0 auto}
h1{font-size:26px;line-height:1.25;margin:0 0 6px}
h2{font-size:20px;line-height:1.3;margin:28px 0 8px}
h3{font-size:18px;line-height:1.3;margin:20px 0 6px}
p{margin:0 0 12px}
ul,ol{margin:0 0 12px;padding-left:24px}
li{margin:0 0 6px}
table{width:100%;border-collapse:collapse;margin:12px 0 20px}
th,td{border:1px solid #e3dbcf;padding:8px 10px;text-align:left;vertical-align:top;font-size:16px}
th{width:36%;font-weight:600;background:#faf6ee}
.lead{color:#564d46;margin-bottom:16px}
.facts-title{font-size:20px;margin:24px 0 4px}
.multiline{white-space:pre-line}
.doc{margin-top:40px;padding-top:24px;border-top:2px solid #1d6d56}
.doc-meta{color:#564d46}
.refs{color:#564d46}
.code{font-family:ui-monospace,Menlo,Consolas,monospace;overflow-wrap:anywhere}
@media print{
  body{padding:0;font-size:12pt}
  th,td{font-size:12pt}
  th{background:none}
  .doc{break-before:page;border-top:none;margin-top:0}
  tr,li,h2,h3{break-inside:avoid}
  h2,h3{break-after:avoid}
}`;

/**
 * Nothing may be fetched or run if the file is opened in a browser: inline
 * style only. (A meta policy cannot carry `sandbox`; the download routes add
 * it as a header.)
 */
const CSP =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";

function page(title: string, body: string): string {
  return [
    "<!DOCTYPE html>",
    '<html lang="tr">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="robots" content="noindex">',
    `<title>${e(title)}</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    "<main>",
    body,
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

type Row = readonly [label: string, value: string, multiline?: boolean];

function factsTable(title: string, rows: readonly Row[]): string {
  const trs = rows
    .filter(([, value]) => value.trim() !== "")
    .map(
      ([label, value, multiline]) =>
        `<tr><th scope="row">${e(label)}</th><td${multiline ? ' class="multiline"' : ""}>${e(value)}</td></tr>`,
    )
    .join("\n");
  return `<h2 class="facts-title">${e(title)}</h2>\n<table>\n<tbody>\n${trs}\n</tbody>\n</table>`;
}

function sellerRows(): Row[] {
  return [
    ["Satıcı", LEGAL_ENTITY.legalName],
    ["Vergi dairesi / VKN", `${LEGAL_ENTITY.taxOffice} / ${LEGAL_ENTITY.taxNo}`],
    ["Adres", LEGAL_ADDRESS_LINE],
  ];
}

// ── The legal text ──────────────────────────────────────────────────────

function sectionHtml(s: LegalSection): string {
  const out = [`<h2>${e(s.heading)}</h2>`];
  for (const p of s.paragraphs ?? []) out.push(`<p>${e(p)}</p>`);
  if (s.bullets?.length) {
    out.push(`<ul>${s.bullets.map((b) => `<li>${e(b)}</li>`).join("")}</ul>`);
  }
  if (s.ordered?.length) {
    out.push(`<ol>${s.ordered.map((o) => `<li>${e(o)}</li>`).join("")}</ol>`);
  }
  if (s.table?.length) {
    out.push(
      `<table><tbody>${s.table
        .map(
          (r) => `<tr><th scope="row">${e(r.key)}</th><td>${e(r.value)}</td></tr>`,
        )
        .join("")}</tbody></table>`,
    );
  }
  return `<section>${out.join("\n")}</section>`;
}

/** `**bold**` only, like the site's renderer (src/lib/legal/markdown.tsx). */
function inline(text: string): string {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part !== "")
    .map((part) =>
      part.startsWith("**") && part.endsWith("**")
        ? `<strong>${e(part.slice(2, -2))}</strong>`
        : e(part),
    )
    .join("");
}

/**
 * A panel override's Markdown, block for block as /hukuk/<slug> renders it
 * (`LegalMarkdown`): headings, lists, paragraphs, bold. Nothing raw.
 */
function markdownHtml(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim());
      if (block.startsWith("### ")) return `<h3>${inline(block.slice(4))}</h3>`;
      if (block.startsWith("## ")) return `<h2>${inline(block.slice(3))}</h2>`;
      if (lines.every((l) => l.startsWith("- "))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`;
      }
      if (lines.every((l) => /^\d+\.\s/.test(l))) {
        return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\.\s/, ""))}</li>`).join("")}</ol>`;
      }
      return `<p>${lines.map(inline).join("<br>")}</p>`;
    })
    .join("\n");
}

/** One document: its title, its date, the full text, then where it lives. */
function documentHtml(d: DurableCopyDocument): string {
  const { doc } = d;
  const parts = [
    `<article class="doc">`,
    `<h1>${e(doc.title)}</h1>`,
    `<p class="doc-meta">Bu metin ${e(doc.updatedAt)} tarihli sürümdür.</p>`,
    `<p class="lead">${e(doc.summary)}</p>`,
  ];
  if (doc.source === "coded") {
    if (doc.references.length > 0) {
      parts.push(
        `<p class="refs">Yasal dayanaklar:</p>`,
        `<ul class="refs">${doc.references.map((r) => `<li>${e(r)}</li>`).join("")}</ul>`,
      );
    }
    parts.push(...doc.sections.map(sectionHtml));
  } else {
    parts.push(markdownHtml(doc.bodyMarkdown));
  }
  parts.push(
    `<p class="doc-meta">Sürüm kimliği (SHA-256): <span class="code">${e(d.hash)}</span></p>`,
    `<p class="doc-meta">Aynı sürüm: <span class="code">${e(d.url)}</span></p>`,
    `</article>`,
  );
  return parts.join("\n");
}

// ── The order ───────────────────────────────────────────────────────────

/** "Latte (Yulaf sütü) × 2: 280₺ (KDV dahil)", from the stored line. */
function lineRows(items: DurableCopyOrder["items"]): Row[] {
  const numbered = items.length > 1;
  return items.map((it, i) => {
    const name = it.detail ? `${it.productName} (${it.detail})` : it.productName;
    // Integer kuruş, the order's own unit price: never today's price.
    const line = Math.round(it.unitPriceMinor) * Math.round(it.qty);
    return [
      numbered ? `Ürün ${i + 1}` : "Ürün",
      `${name} × ${it.qty}: ${priceLabel(line)} (KDV dahil)`,
    ] as const;
  });
}

function deliveryRows(order: DurableCopyOrder): Row[] {
  const how = orderFulfillment(order);
  const rows: Row[] = [["Teslimat", ORDER_FULFILLMENT_LABELS[how]]];
  if (how === "shipping" || how === "delivery") {
    rows.push(["Teslimat adresi", order.shippingAddress, true]);
  } else if (how === "table") {
    const table = orderTable(order);
    if (table) rows.push(["Masa", table.name || table.code]);
  }
  return rows;
}

export function orderDurableCopyHtml(input: {
  order: DurableCopyOrder;
  consent: DurableCopyConsent;
  docs: readonly DurableCopyDocument[];
}): string {
  const { order, consent, docs } = input;
  const titles = docs.map((d) => d.doc.title).join(" ve ");
  const shipping = orderFulfillment(order);
  const rows: Row[] = [
    ...sellerRows(),
    ["Sipariş numarası", `#${order.orderNo}`],
    ["Onay anı", `${istanbulInstantLabel(consent.acceptedAt)} (Türkiye saati)`],
    ["Belge sürümü", consent.version],
    ["Alıcı", order.customerName],
    ...lineRows(order.items),
    ["Ara toplam (KDV dahil)", priceLabel(order.subtotalMinor)],
    ...(shipping === "shipping" || shipping === "delivery"
      ? ([
          [
            "Kargo",
            order.shippingMinor > 0 ? priceLabel(order.shippingMinor) : "Ücretsiz",
          ],
        ] as Row[])
      : []),
    ...(order.discountMinor > 0
      ? ([
          [
            "İndirim",
            `-${priceLabel(order.discountMinor)}${order.promoCode ? ` (${order.promoCode})` : ""}`,
          ],
        ] as Row[])
      : []),
    ["Toplam (KDV dahil)", priceLabel(order.totalMinor)],
    ...deliveryRows(order),
  ];
  const body = [
    `<header>`,
    `<h1>${e(titles)}</h1>`,
    `<p class="lead">Sipariş #${e(String(order.orderNo))} için onaylanan metin, siparişin bilgileriyle.</p>`,
    factsTable("Bu siparişin bilgileri", rows),
    `</header>`,
    ...docs.map(documentHtml),
  ].join("\n");
  return page(`Sipariş #${order.orderNo} · ${titles}`, body);
}

// ── The karaoke booking ─────────────────────────────────────────────────

/** "30 Ekim 2026, 18:00": the booking's own last free moment. */
function deadlineLabel(r: DurableCopyBooking): string {
  const at = karaokeCancelDeadline(r);
  return Number.isFinite(at.getTime())
    ? istanbulInstantLabel(at.toISOString())
    : "";
}

/** What a late cancel refunds under the booking's own snapshot. */
export function lateRefundLabel(r: DurableCopyBooking): string {
  const { lateRefundPercent } = karaokeCancelPolicyOf(r);
  if (lateRefundPercent <= 0) return "iade yapılmaz";
  const paid = r.paidMinor && r.paidMinor > 0 ? r.paidMinor : r.totalMinor;
  return `${priceLabel(karaokeLateRefundMinor(paid, lateRefundPercent))} (KDV dahil)`;
}

/** "KRK-00042"; the booking's id is its code at the door. */
function bookingCode(id: string): string {
  return id.toUpperCase();
}

export function karaokeDurableCopyHtml(input: {
  reservation: DurableCopyBooking;
  consent: DurableCopyConsent;
  docs: readonly DurableCopyDocument[];
}): string {
  const { reservation: r, consent, docs } = input;
  const code = bookingCode(r.id);
  const titles = docs.map((d) => d.doc.title).join(" ve ");
  const rows: Row[] = [
    ...sellerRows(),
    ["Rezervasyon kodu", code],
    ["Onay anı", `${istanbulInstantLabel(consent.acceptedAt)} (Türkiye saati)`],
    ["Belge sürümü", consent.version],
    ["Ad", r.customerName],
    ["Tarih", formatReservationDate(r.date)],
    ["Saat", formatReservationTime(r.startHour, r.hours)],
    ["Süre", `${r.hours} saat`],
    ["Kişi", `${r.guests} kişi`],
    ["Toplam (KDV dahil)", priceLabel(r.totalMinor)],
    ["Son ücretsiz iptal", deadlineLabel(r)],
    ["Geç iptalde iade", lateRefundLabel(r)],
  ];
  const body = [
    `<header>`,
    `<h1>${e(titles)}</h1>`,
    `<p class="lead">${e(code)} kodlu rezervasyon için onaylanan metin, rezervasyonun bilgileriyle.</p>`,
    factsTable("Bu rezervasyonun bilgileri", rows),
    `</header>`,
    ...docs.map(documentHtml),
  ].join("\n");
  return page(`Karaoke rezervasyonu ${code} · ${titles}`, body);
}

// ── File names ──────────────────────────────────────────────────────────

/** `siparis-10042-on-bilgilendirme-ve-sozlesme.html`; digits only. */
export function orderDurableCopyFilename(orderNo: number): string {
  const no = Number.isSafeInteger(orderNo) && orderNo > 0 ? String(orderNo) : "";
  return no
    ? `siparis-${no}-on-bilgilendirme-ve-sozlesme.html`
    : "siparis-on-bilgilendirme-ve-sozlesme.html";
}

/** `karaoke-sozlesme-KRK-00042.html`; the code only when it is one. */
export function karaokeDurableCopyFilename(id: string): string {
  return isKaraokeRef(id)
    ? `karaoke-sozlesme-${bookingCode(id)}.html`
    : "karaoke-sozlesme.html";
}

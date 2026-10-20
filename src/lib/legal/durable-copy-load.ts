import "server-only";

import type { AdminOrder } from "@/lib/admin/store";
import type { KaraokeReservation } from "@/lib/mobile/karaoke-core";
import { SITE } from "@/lib/seo/site";

import { codedLegalDoc } from "./consent-texts";
import {
  karaokeDurableCopyFilename,
  karaokeDurableCopyHtml,
  orderDurableCopyFilename,
  orderDurableCopyHtml,
  type DurableCopyConsent,
  type DurableCopyDocument,
} from "./durable-copy";
import { CHECKOUT_CONSENT_DOCS, KARAOKE_CONSENT_DOCS } from "./meta";
import { getPublishedLegalOverrideLive } from "./store";
import {
  consentTextHashes,
  legalVersionOf,
  legalVersionPath,
  shownVersionDoc,
  type ConsentTextHashes,
  type LegalVersion,
} from "./version-core";
import { loadLegalVersions, recordLegalVersions } from "./versions";

/**
 * The confirmed contract of an order or a karaoke booking, as a file
 * (./durable-copy.ts), built from the version its consent recorded
 * (`legalConsent.textHashes`), never from today's text.
 *
 * The text comes from `legal_doc_versions` by hash. When the consent's own
 * write did not land, the text shown now is used only if it hashes to the
 * very hash recorded (then it IS that text) and is stored on the way, so the
 * mail's version link works too. Anything else - no hashes (an older or a
 * manual order), a text that is neither stored nor shown now - is no copy:
 * null, and the caller says the old sentence instead.
 */

export interface DurableCopy {
  filename: string;
  html: string;
  /** Each document's version page, in the order confirmed. */
  links: { slug: string; title: string; url: string }[];
}

/** A text the consent names but the table does not hold, if it is shown now. */
async function shownNowIfSame(
  slug: string,
  hash: string,
): Promise<LegalVersion | null> {
  const doc = await codedLegalDoc(slug);
  if (!doc) return null;
  const coded = legalVersionOf(shownVersionDoc(doc, null));
  if (coded.hash === hash) return coded;
  const override = await getPublishedLegalOverrideLive(slug);
  if (!override) return null;
  const live = legalVersionOf(shownVersionDoc(doc, override));
  return live.hash === hash ? live : null;
}

async function versionsFor(
  hashes: ConsentTextHashes,
  slugs: readonly string[],
): Promise<LegalVersion[] | null> {
  const stored = await loadLegalVersions(slugs.map((s) => hashes[s]));
  const out: LegalVersion[] = [];
  const heal: LegalVersion[] = [];
  for (const slug of slugs) {
    const hash = hashes[slug];
    let version = stored.get(hash) ?? null;
    if (!version) {
      version = await shownNowIfSame(slug, hash);
      if (!version) return null;
      heal.push(version);
    }
    if (version.slug !== slug) return null;
    out.push(version);
  }
  // The version page the mail links must open: a healed text is stored
  // before the copy is offered (a failure here is the caller's null).
  if (heal.length > 0) await recordLegalVersions(heal);
  return out;
}

function consentOf(raw: unknown): DurableCopyConsent | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as { acceptedAt?: unknown; version?: unknown };
  return typeof c.acceptedAt === "string" && c.acceptedAt
    ? {
        acceptedAt: c.acceptedAt,
        version: typeof c.version === "string" ? c.version : "",
      }
    : null;
}

function documents(versions: LegalVersion[]): DurableCopyDocument[] {
  return versions.map((v) => ({
    doc: v.doc,
    hash: v.hash,
    url: `${SITE.url}${legalVersionPath(v.slug, v.hash)}`,
  }));
}

function linksOf(docs: DurableCopyDocument[]): DurableCopy["links"] {
  return docs.map((d) => ({ slug: d.doc.slug, title: d.doc.title, url: d.url }));
}

/** The order's Ön Bilgilendirme Formu and Mesafeli Satış Sözleşmesi, filled. */
export async function orderDurableCopy(
  order: AdminOrder,
): Promise<DurableCopy | null> {
  const consent = consentOf(order.legalConsent);
  const hashes = consentTextHashes(order.legalConsent, CHECKOUT_CONSENT_DOCS);
  if (!consent || !hashes) return null;
  const versions = await versionsFor(hashes, CHECKOUT_CONSENT_DOCS);
  if (!versions) return null;
  const docs = documents(versions);
  return {
    filename: orderDurableCopyFilename(order.orderNo),
    html: orderDurableCopyHtml({
      order: {
        orderNo: order.orderNo,
        customerName: order.customerName ?? "",
        shippingAddress: order.shippingAddress ?? "",
        items: order.items ?? [],
        subtotalMinor: order.subtotalMinor,
        discountMinor: order.discountMinor,
        promoCode: order.promoCode,
        shippingMinor: order.shippingMinor,
        totalMinor: order.totalMinor,
        fulfillment: order.fulfillment,
        tableCode: order.tableCode,
        tableName: order.tableName,
      },
      consent,
      docs,
    }),
    links: linksOf(docs),
  };
}

/** The karaoke booking's terms, filled with the booking's own snapshot. */
export async function karaokeDurableCopy(
  r: KaraokeReservation,
): Promise<DurableCopy | null> {
  const consent = consentOf(r.legalConsent);
  const hashes = consentTextHashes(r.legalConsent, KARAOKE_CONSENT_DOCS);
  if (!consent || !hashes) return null;
  const versions = await versionsFor(hashes, KARAOKE_CONSENT_DOCS);
  if (!versions) return null;
  const docs = documents(versions);
  return {
    filename: karaokeDurableCopyFilename(r.id),
    html: karaokeDurableCopyHtml({ reservation: r, consent, docs }),
    links: linksOf(docs),
  };
}

/**
 * The copy for a mail, or null within `ms`: the payment return waits for
 * its mail, and the copy must not make it wait longer or fail it. A slow
 * read, a missing version or any error is logged with the record's id only
 * (no address, rule 9) and the mail goes without it.
 */
export async function durableCopyForMail(
  label: string,
  build: () => Promise<DurableCopy | null>,
  ms = 2_500,
): Promise<DurableCopy | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), ms);
  });
  try {
    const result = await Promise.race([build(), timeout]);
    if (result === "timeout") {
      console.warn(`[durable-copy] ${label}: no attachment (timed out)`);
      return null;
    }
    if (!result) console.warn(`[durable-copy] ${label}: no attachment (no stored version)`);
    return result;
  } catch (err) {
    console.warn(
      `[durable-copy] ${label}: no attachment (${(err instanceof Error ? err.message : String(err)).slice(0, 120)})`,
    );
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

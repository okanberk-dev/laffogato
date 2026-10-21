import { createHash } from "node:crypto";

import { isLiveLegalOverride, type ConsentOverride } from "./consent-version";
import type { LegalDoc, LegalSection } from "./documents";

/**
 * A legal text as /hukuk/<slug> showed it, in the one form its hash is taken
 * of (decision D-VERSIONS-TABLE, 20 Ekim 2026).
 *
 * An order's consent used to record a version LABEL only ("20 Ekim 2026"),
 * and two texts could share one label. Now it also records, per document,
 * the SHA-256 of the exact text shown (`legalConsent.textHashes`), and that
 * text is kept in `legal_doc_versions` under the same hash
 * (db/migrations/20261020180000_legal_doc_versions.sql), where the database
 * refuses a row whose hash is not its text's.
 *
 * The text is canonical JSON with a fixed key order: what the page printed
 * (category, title, summary, the "Son güncelleme" date) and the body, either
 * the coded sections with the company tokens already filled (as shown, so a
 * change in entity.ts is a new text with a new hash) or a panel override's
 * Markdown. One document, one string, one hash, whoever computes it.
 *
 * Pure: no I/O and no "server-only" (node:crypto only), so the tests and
 * every server path compute the same hash.
 */

export const LEGAL_VERSION_FORMAT = 1 as const;

interface LegalVersionBase {
  format: typeof LEGAL_VERSION_FORMAT;
  slug: string;
  category: string;
  title: string;
  summary: string;
  /** The date printed beside the text, "Son güncelleme". */
  updatedAt: string;
}

/** The coded document from content.ts, its tokens filled. */
export interface CodedLegalVersionDoc extends LegalVersionBase {
  source: "coded";
  references: string[];
  sections: LegalSection[];
}

/** A published panel override (`legal_docs`). */
export interface OverrideLegalVersionDoc extends LegalVersionBase {
  source: "override";
  bodyMarkdown: string;
}

export type LegalVersionDoc = CodedLegalVersionDoc | OverrideLegalVersionDoc;

/** A shown text with its canonical string and that string's hash. */
export interface LegalVersion {
  hash: string;
  slug: string;
  text: string;
  doc: LegalVersionDoc;
}

/** The override fields the page prints (`LegalDocOverride`). */
export interface ShownOverride extends ConsentOverride {
  title: string;
  summary: string;
}

/** The coded document, as the page prints it when no override is live. */
export function codedVersionDoc(doc: LegalDoc): CodedLegalVersionDoc {
  return {
    format: LEGAL_VERSION_FORMAT,
    slug: doc.slug,
    source: "coded",
    category: doc.category,
    title: doc.title,
    summary: doc.summary,
    updatedAt: doc.updatedAt,
    references: [...(doc.references ?? [])],
    sections: doc.sections,
  };
}

/**
 * A live override, as the page prints it: a blank title, summary or date
 * falls back to the coded document's (`override?.title || doc.title`,
 * src/app/hukuk/[slug]/page.tsx); the body is the override's Markdown.
 */
export function overrideVersionDoc(
  doc: LegalDoc,
  o: ShownOverride,
): OverrideLegalVersionDoc {
  return {
    format: LEGAL_VERSION_FORMAT,
    slug: doc.slug,
    source: "override",
    category: doc.category,
    title: o.title || doc.title,
    summary: o.summary || doc.summary,
    updatedAt: o.effectiveDate || doc.updatedAt,
    bodyMarkdown: o.bodyMarkdown,
  };
}

/** What /hukuk/<slug> shows for `doc` and its override (null: none). */
export function shownVersionDoc(
  doc: LegalDoc,
  override: ShownOverride | null | undefined,
): LegalVersionDoc {
  return isLiveLegalOverride(override)
    ? overrideVersionDoc(doc, override)
    : codedVersionDoc(doc);
}

function canonicalSection(s: LegalSection): Record<string, unknown> {
  const out: Record<string, unknown> = { heading: s.heading };
  if (s.paragraphs?.length) out.paragraphs = [...s.paragraphs];
  if (s.bullets?.length) out.bullets = [...s.bullets];
  if (s.ordered?.length) out.ordered = [...s.ordered];
  if (s.table?.length) {
    out.table = s.table.map((r) => ({ key: r.key, value: r.value }));
  }
  return out;
}

/** The canonical string: JSON, keys in a fixed order, nothing optional left empty. */
export function legalVersionText(doc: LegalVersionDoc): string {
  const head = {
    format: doc.format,
    slug: doc.slug,
    source: doc.source,
    category: doc.category,
    title: doc.title,
    summary: doc.summary,
    updatedAt: doc.updatedAt,
  };
  return JSON.stringify(
    doc.source === "coded"
      ? {
          ...head,
          references: [...doc.references],
          sections: doc.sections.map(canonicalSection),
        }
      : { ...head, bodyMarkdown: doc.bodyMarkdown },
  );
}

/** SHA-256 of the string's UTF-8 bytes, lowercase hex (Postgres: sha256(convert_to(body, 'UTF8'))). */
export function legalVersionHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function legalVersionOf(doc: LegalVersionDoc): LegalVersion {
  const text = legalVersionText(doc);
  return { hash: legalVersionHash(text), slug: doc.slug, text, doc };
}

// ── Reading a stored text back ──────────────────────────────────────────

const isString = (v: unknown): v is string => typeof v === "string";

function stringList(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
}

function parseSection(v: unknown): LegalSection | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const s = v as Record<string, unknown>;
  if (!isString(s.heading)) return null;
  const out: LegalSection = { heading: s.heading };
  for (const key of ["paragraphs", "bullets", "ordered"] as const) {
    if (s[key] === undefined) continue;
    if (!stringList(s[key])) return null;
    out[key] = s[key] as string[];
  }
  if (s.table !== undefined) {
    if (!Array.isArray(s.table)) return null;
    const rows: { key: string; value: string }[] = [];
    for (const row of s.table as unknown[]) {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      if (!isString(r.key) || !isString(r.value)) return null;
      rows.push({ key: r.key, value: r.value });
    }
    out.table = rows;
  }
  return out;
}

/**
 * A stored string back as a document, or null when it is not one this code
 * wrote: unknown format, a missing or mistyped field, or anything that does
 * not serialise back to the very same string (an extra key, another order).
 */
export function parseLegalVersionText(text: string): LegalVersionDoc | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.format !== LEGAL_VERSION_FORMAT) return null;
  for (const key of ["slug", "category", "title", "summary", "updatedAt"]) {
    if (!isString(o[key])) return null;
  }
  const base = {
    format: LEGAL_VERSION_FORMAT,
    slug: o.slug as string,
    category: o.category as string,
    title: o.title as string,
    summary: o.summary as string,
    updatedAt: o.updatedAt as string,
  };
  let doc: LegalVersionDoc;
  if (o.source === "coded") {
    if (!stringList(o.references) || !Array.isArray(o.sections)) return null;
    const sections: LegalSection[] = [];
    for (const s of o.sections as unknown[]) {
      const parsed = parseSection(s);
      if (!parsed) return null;
      sections.push(parsed);
    }
    doc = { ...base, source: "coded", references: o.references, sections };
  } else if (o.source === "override") {
    if (!isString(o.bodyMarkdown)) return null;
    doc = { ...base, source: "override", bodyMarkdown: o.bodyMarkdown };
  } else {
    return null;
  }
  return legalVersionText(doc) === text ? doc : null;
}

// ── Hashes, prefixes and links ──────────────────────────────────────────

const HASH_RE = /^[0-9a-f]{64}$/;

export function isLegalVersionHash(value: unknown): value is string {
  return typeof value === "string" && HASH_RE.test(value);
}

/**
 * How many hex digits a version link carries: 64 bits, far past any chance
 * of two stored texts sharing a prefix, short enough for a mail.
 */
export const VERSION_LINK_LENGTH = 16;

/**
 * A `?surum=` value the page accepts: lowercase hex, at least the link's
 * own length (a shorter prefix could name several texts and would let a
 * visitor walk the table a digit at a time), at most a whole hash.
 */
export function isVersionPrefix(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= VERSION_LINK_LENGTH &&
    value.length <= 64 &&
    /^[0-9a-f]+$/.test(value)
  );
}

/** `/hukuk/<slug>?surum=<16 hex>`: the stored text, unchanged. */
export function legalVersionPath(slug: string, hash: string): string {
  return `/hukuk/${slug}?surum=${hash.slice(0, VERSION_LINK_LENGTH)}`;
}

/** What a consent records next to its version: { slug: sha256 }. */
export type ConsentTextHashes = Record<string, string>;

/**
 * The consent's recorded hash for every one of `slugs`, in that order, or
 * null when the record has none (an order from before 21 Ekim 2026, a manual
 * order) or one is missing or malformed. Never a partial answer: a copy that
 * leaves out one of the confirmed documents is not the confirmed copy.
 */
export function consentTextHashes(
  consent: unknown,
  slugs: readonly string[],
): ConsentTextHashes | null {
  if (!consent || typeof consent !== "object") return null;
  const recorded = (consent as { textHashes?: unknown }).textHashes;
  if (!recorded || typeof recorded !== "object" || Array.isArray(recorded)) {
    return null;
  }
  const out: ConsentTextHashes = {};
  for (const slug of slugs) {
    const hash = (recorded as Record<string, unknown>)[slug];
    if (!isLegalVersionHash(hash)) return null;
    out[slug] = hash;
  }
  return slugs.length > 0 ? out : null;
}

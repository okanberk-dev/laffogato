import { describe, expect, it } from "vitest";

import {
  consentSaveRefusal,
  recordedConsentStates,
  resolveEffectiveDate,
  type ConsentArchiveRow,
} from "@/lib/admin/legal-schema";
import {
  consentVersionFrom,
  isLiveLegalOverride,
  istanbulDayLabel,
  type ConsentOverride,
} from "@/lib/legal/consent-version";
import { CHECKOUT_CONSENT_DOCS, LEGAL_UPDATED } from "@/lib/legal/meta";

/**
 * The checkout consent's version label across many edits of the two
 * checkout documents (admin audit CON-M01, decision D25). Both documents
 * share one label, so it must stand for one pair of texts: an order that
 * records "20 Ekim 2026" has to point at the Ön Bilgilendirme and the
 * Mesafeli Satış text it was shown.
 *
 * The run below edits both documents the way the panel does (a save goes
 * through consentSaveRefusal, a restore comes back as a draft when refused
 * and nothing live is replaced, "Varsayılana döndür" archives and removes)
 * and the store archives the way legal_doc_save / legal_doc_reset do (a save
 * that changes nothing writes nothing). After every step:
 *
 * - the versions rebuilt from the archive (recordedConsentStates) are the
 *   versions the run really recorded;
 * - a save or a restore never puts a second pair under a recorded label.
 *   Only taking a live text down can (a reset, or a draft over a live text):
 *   with both documents live, removing one leaves the later date standing,
 *   and no date can be chosen for "the coded text again". The archive keeps
 *   when each text was shown for those.
 *
 * The per-document check this replaced let a Mesafeli Satış text take a
 * date an archived Ön Bilgilendirme text had been recorded under, a restore
 * reuse its old label after the other document changed, and a date moved
 * back land on the other document's older pair.
 */

const DOCS = CHECKOUT_CONSENT_DOCS as readonly string[];
const BASE = LEGAL_UPDATED;
const SCOPE = { docs: DOCS, base: BASE };

type Row = ConsentOverride;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// Dates past any coded revision, and a clock in the same days.
const DATES = [
  "",
  "10 Mart 2030",
  "11 Mart 2030",
  "12 Mart 2030",
  "13 Mart 2030",
  "14 Mart 2030",
];
const BODIES = [
  "## 1. Taraflar\n\nBirinci metin.",
  "## 1. Taraflar\n\nİkinci metin.",
  "## 1. Taraflar\n\nÜçüncü metin.",
];

function pairOf(rows: Record<string, Row | null>): string {
  return JSON.stringify(
    DOCS.map((slug) => {
      const o = rows[slug];
      return isLiveLegalOverride(o) ? o.bodyMarkdown.trim() : null;
    }),
  );
}

function sameRow(a: Row, b: Row): boolean {
  return (
    a.bodyMarkdown === b.bodyMarkdown &&
    a.effectiveDate === b.effectiveDate &&
    a.isPublished === b.isPublished
  );
}

interface Outcome {
  /** A save or restore that put a second pair under a recorded label. */
  clash: string | null;
  /** Steps that took a live text down and left its label standing. */
  takenDown: number;
  /** The rebuild disagreed with what the run recorded, at this step. */
  rebuildMismatch: string | null;
}

function run(seed: number, steps: number): Outcome {
  const r = rng(seed);
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const rows: Record<string, Row | null> = {};
  const archive: ConsentArchiveRow[] = [];
  // What the run recorded: version -> pairs shown under it.
  const recorded = new Map<string, Set<string>>([
    [BASE, new Set([pairOf(rows)])],
  ]);
  let clock = Date.parse("2030-03-10T06:00:00.000Z");
  let takenDown = 0;

  const write = (slug: string, next: Row) => {
    const prev = rows[slug];
    if (prev && sameRow(prev, next)) return; // legal_doc_save writes nothing
    if (prev) archive.push({ ...prev, slug, archivedAt: next.updatedAt });
    rows[slug] = next;
  };
  const refusal = (slug: string, after: Row) =>
    consentSaveRefusal({
      slug,
      before: rows[slug] ?? null,
      after,
      overrides: rows,
      archived: archive,
    });

  for (let i = 0; i < steps; i++) {
    clock += r() < 0.3 ? 24 * 3600 * 1000 : 60 * 1000;
    const at = new Date(clock).toISOString();
    const roll = r();
    const old = archive.length > 0 ? pick(archive) : null;
    const restoring = roll >= 0.8 && old !== null;
    const slug = restoring ? old.slug : pick(DOCS);
    const wasLive = isLiveLegalOverride(rows[slug]);
    let step: string;
    if (restoring) {
      // restoreLegalDocAction
      const effectiveDate =
        old.isPublished && !old.effectiveDate.trim()
          ? (istanbulDayLabel(old.updatedAt) ?? "")
          : old.effectiveDate;
      let after: Row = {
        bodyMarkdown: old.bodyMarkdown,
        effectiveDate,
        isPublished: old.isPublished,
        updatedAt: at,
      };
      step = `restore ${slug} ${JSON.stringify(after)}`;
      const refused = refusal(slug, after);
      if (refused && wasLive) continue;
      if (refused) after = { ...after, isPublished: false };
      write(slug, after);
    } else if (roll < 0.6) {
      const publish = r() < 0.8;
      const after: Row = {
        bodyMarkdown: pick(BODIES),
        effectiveDate: resolveEffectiveDate(pick(DATES), publish, at),
        isPublished: publish,
        updatedAt: at,
      };
      step = `save ${slug} ${JSON.stringify(after)}`;
      if (!refusal(slug, after)) write(slug, after);
    } else {
      step = `reset ${slug}`;
      const prev = rows[slug];
      if (prev) {
        archive.push({ ...prev, slug, archivedAt: at });
        rows[slug] = null;
      }
    }

    const version = consentVersionFrom(rows, DOCS, BASE);
    const pair = pairOf(rows);
    const pairs = recorded.get(version) ?? new Set<string>();
    if (!pairs.has(pair) && pairs.size > 0) {
      // Taking a live text down: a reset, or a draft saved or restored
      // over a live text. Anything else is a failure.
      if (!wasLive || isLiveLegalOverride(rows[slug])) {
        return { clash: step, takenDown, rebuildMismatch: null };
      }
      takenDown++;
    }
    pairs.add(pair);
    recorded.set(version, pairs);

    const rebuilt = recordedConsentStates(SCOPE, archive, rows);
    const flat = (m: Map<string, Set<string>>) =>
      [...m].flatMap(([v, ps]) => [...ps].map((p) => `${v} ${p}`)).sort();
    if (JSON.stringify(flat(rebuilt)) !== JSON.stringify(flat(recorded))) {
      return { clash: null, takenDown, rebuildMismatch: step };
    }
  }
  return { clash: null, takenDown, rebuildMismatch: null };
}

describe("checkout consent version across edits of both documents", () => {
  it("rebuilds what was recorded, and no save or restore reuses a label for other texts", () => {
    let takenDown = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const out = run(seed, 30);
      expect(out.rebuildMismatch, `seed ${seed}`).toBeNull();
      expect(out.clash, `seed ${seed}`).toBeNull();
      takenDown += out.takenDown;
    }
    // The documented exception does occur in the run (so the run reaches
    // both documents live), and it is the only one.
    expect(takenDown).toBeGreaterThan(0);
  });
});

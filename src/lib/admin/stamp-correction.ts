// Client-safe (no server-only): the rules of the member page's stamp
// correction, shared by its server action (app/admin/musteriler/[email]/
// actions.ts) and its form (components/admin/customer-stamps.tsx).
//
// Since 21 Ekim 2026 (decision ASK-LOYALTY) the till gives a stamp only to a
// member who shows their own code. A stamp the till missed is put right
// here, by an owner or a manager, at the member's own request: the reason
// says who asked and how it was checked, and the ledger note says it was a
// correction.

/** Every correction's ledger note starts with this. */
export const STAMP_CORRECTION_PREFIX = "Düzeltme · ";

/** The reason must say something: who asked, and how it was checked. */
export const STAMP_CORRECTION_MIN = 10;

/**
 * The ledger keeps 120 characters of a note (`addCounterStamp`); the prefix
 * takes its share, so a full reason is never cut.
 */
export const STAMP_CORRECTION_MAX = 120 - STAMP_CORRECTION_PREFIX.length;

export const STAMP_CORRECTION_REASON_ERROR =
  "Düzeltme sebebini yaz: üyenin kendi talebi ve nasıl doğrulandığı (ör. QR okunmadı, üye kayıtlı e-postasından yazdı).";

/**
 * The reason as it goes into the ledger: one line (runs of white space
 * become one space), trimmed, at most `STAMP_CORRECTION_MAX` characters;
 * null when what is left is shorter than `STAMP_CORRECTION_MIN` characters
 * (counted as characters, so five emoji are not ten). Measured after the
 * cut, so padding cannot carry a short reason past the minimum.
 */
export function stampCorrectionReason(raw: unknown): string | null {
  let reason = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (reason.length > STAMP_CORRECTION_MAX) {
    reason = reason.slice(0, STAMP_CORRECTION_MAX);
    // Never leave half of a character at the cut.
    const last = reason.charCodeAt(reason.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) reason = reason.slice(0, -1);
    reason = reason.trimEnd();
  }
  return Array.from(reason).length >= STAMP_CORRECTION_MIN ? reason : null;
}

/** The ledger note of a correction. */
export function stampCorrectionNote(reason: string): string {
  return `${STAMP_CORRECTION_PREFIX}${reason}`;
}

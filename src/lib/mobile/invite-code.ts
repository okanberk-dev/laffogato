// Pure invite-code helpers - NO "server-only", NO DB. The database side
// (uniqueness, claiming) lives in `./invite.ts`.

export const INVITE_PREFIX = "LAF-";

/** Turkish letters that `normalize("NFD")` does not reduce to ASCII. */
const TR_MAP: Record<string, string> = {
  ı: "I",
  İ: "I",
  ş: "S",
  Ş: "S",
  ğ: "G",
  Ğ: "G",
  ç: "C",
  Ç: "C",
  ö: "O",
  Ö: "O",
  ü: "U",
  Ü: "U",
};

/** "Şükrü Ökten" → "SUKRUOKTEN": upper-case ASCII letters only. */
export function asciiLetters(name: string): string {
  const mapped = Array.from(name ?? "", (ch) => TR_MAP[ch] ?? ch).join("");
  return mapped
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

/** Deterministic 32-bit FNV-1a hash of a string. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Candidate code for a member: "LAF-" + first three letters of the name
 * (Turkish diacritics dropped, padded with "LAF" when the name is short) +
 * four digits derived from the member id (two-digit codes issued earlier
 * stay valid). `attempt` reseeds the digits when a
 * candidate collides with an existing code.
 */
export function inviteCodeCandidate(
  name: string,
  id: string,
  attempt = 0,
): string {
  const letters = (asciiLetters(name) + "LAF").slice(0, 3);
  const digits = fnv1a(`${id}#${attempt}`) % 10000;
  return `${INVITE_PREFIX}${letters}${String(digits).padStart(4, "0")}`;
}

/** Trims, upper-cases and re-attaches a missing "LAF-" prefix. */
export function normalizeInviteCode(raw: string): string {
  const upper = (raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, "")
    .replace(/[‐‑‒–—]/g, "-");
  if (!upper) return "";
  if (upper.startsWith(INVITE_PREFIX)) return upper;
  if (upper.startsWith("LAF") && (upper.length === 8 || upper.length === 10)) {
    return `${INVITE_PREFIX}${upper.slice(3)}`;
  }
  return `${INVITE_PREFIX}${upper}`;
}

export const INVITE_CODE_RE = /^LAF-[A-Z]{3}\d{2}(?:\d{2})?$/;

export function isInviteCodeShape(code: string): boolean {
  return INVITE_CODE_RE.test(code);
}

/** "Selin Kaya" → "Selin K." - how the inviter sees who joined. */
export function abbreviateName(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Üye";
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts.slice(0, -1).join(" ")} ${last.charAt(0).toUpperCase()}.`;
}

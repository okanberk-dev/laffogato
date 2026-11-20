import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";

import { PAYNKOLAY_MEMBER_KEY } from "./paynkolay";

/**
 * The member's card key, encrypted at rest (docs/PAYNKOLAY.md §16.3).
 *
 * The cards themselves stay at PayNkolay; this server keeps one value per
 * member, the random 11-character key PayNkolay files that member's cards
 * under (`customers."cardUserKey"`). It is not a card, but it is what points
 * at the cards, so it is never stored in the clear: a database dump, a
 * backup or a read through a query bug yields ciphertext that says nothing
 * about which member has saved cards, and cannot be moved from one member's
 * row to another's.
 *
 * - **Cipher:** AES-256-GCM (authenticated), a fresh 96-bit IV per seal.
 * - **Key:** HKDF-SHA256 from `CARD_VAULT_KEY` (its own secret, at least 32
 *   characters, set only in the deployment's environment, never in the
 *   database). While it is not set, the key is derived from
 *   `PAYNKOLAY_MERCHANT_SECRET_KEY` under a different HKDF label, so the
 *   value is encrypted from the first deploy on; setting `CARD_VAULT_KEY`
 *   later moves each row to it the next time the row is read.
 * - **Binding:** the customer row's id is the GCM associated data. A sealed
 *   value copied into another member's row does not open there.
 * - **Rotation:** every sealed value names its key (`kid`, a one-way
 *   fingerprint). `CARD_VAULT_KEY_PREVIOUS` (and the merchant-derived key)
 *   still open older values, and a value sealed under any key but the
 *   current one is sealed again when it is read.
 * - **Legacy:** a key stored in the clear before this module (5-19 Kasım
 *   2026, card storage on) is read as it is and sealed on that same read.
 *
 * Format: `cv1.<kid>.<iv>.<ciphertext>.<tag>`, base64url parts.
 */

const FORMAT = "cv1";
const HKDF_SALT = "laffogato-card-vault-v1";
const LABEL_OWN = "customers.cardUserKey|own-secret";
const LABEL_MERCHANT = "customers.cardUserKey|paynkolay-merchant-secret";
/** Short enough for a typo to be caught, long enough to carry 192 bits. */
export const CARD_VAULT_KEY_MIN_LENGTH = 32;

interface VaultKey {
  kid: string;
  key: Buffer;
}

interface Keyring {
  /** The key new values are sealed with; null when there is none at all. */
  current: VaultKey | null;
  /** Every key a stored value may have been sealed with, current first. */
  all: VaultKey[];
  /** `CARD_VAULT_KEY` is set but too short: nothing is sealed or opened. */
  misconfigured: boolean;
}

function derive(secret: string, label: string): VaultKey {
  const key = Buffer.from(hkdfSync("sha256", secret, HKDF_SALT, label, 32));
  const kid = createHash("sha256")
    .update("laffogato-card-vault-kid|")
    .update(key)
    .digest("base64url")
    .slice(0, 8);
  return { kid, key };
}

let cached: { signature: string; ring: Keyring } | null = null;

function keyring(): Keyring {
  const own = (process.env.CARD_VAULT_KEY ?? "").trim();
  const previous = (process.env.CARD_VAULT_KEY_PREVIOUS ?? "").trim();
  const merchant = (process.env.PAYNKOLAY_MERCHANT_SECRET_KEY ?? "").trim();
  // The signature is a hash, so the cache never holds a secret in the clear
  // beside the derived keys it already holds.
  const signature = createHash("sha256")
    .update(`${own}\u0000${previous}\u0000${merchant}`)
    .digest("base64url");
  if (cached?.signature === signature) return cached.ring;

  const misconfigured =
    (own !== "" && own.length < CARD_VAULT_KEY_MIN_LENGTH) ||
    (previous !== "" && previous.length < CARD_VAULT_KEY_MIN_LENGTH);
  const all: VaultKey[] = [];
  if (!misconfigured) {
    if (own) all.push(derive(own, LABEL_OWN));
    if (previous) all.push(derive(previous, LABEL_OWN));
    if (merchant) all.push(derive(merchant, LABEL_MERCHANT));
  }
  const ring: Keyring = { current: all[0] ?? null, all, misconfigured };
  if (misconfigured) {
    // The name only, never the value.
    console.error(
      `[card-vault] CARD_VAULT_KEY / CARD_VAULT_KEY_PREVIOUS must be at least ${CARD_VAULT_KEY_MIN_LENGTH} characters; saved cards stay off`,
    );
  }
  cached = { signature, ring };
  return ring;
}

/** Whether a member key can be sealed now. Card storage needs this. */
export function cardVaultReady(): boolean {
  return keyring().current !== null;
}

/** Whether `CARD_VAULT_KEY` itself (not the fallback) seals new values. */
export function cardVaultHasOwnKey(): boolean {
  const own = (process.env.CARD_VAULT_KEY ?? "").trim();
  return own.length >= CARD_VAULT_KEY_MIN_LENGTH && !keyring().misconfigured;
}

function aad(scope: string): Buffer {
  return Buffer.from(`${HKDF_SALT}|${scope}`, "utf8");
}

function sealWith(vk: VaultKey, plain: string, scope: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vk.key, iv);
  cipher.setAAD(aad(scope));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    FORMAT,
    vk.kid,
    iv.toString("base64url"),
    body.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

function openWith(vk: VaultKey, parts: string[], scope: string): string {
  const [, , iv, body, tag] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    vk.key,
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(aad(scope));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** The scope a customer row's value is bound to. */
export function customerScope(customerId: string): string {
  return `customer:${customerId}`;
}

/**
 * Seals a member key for the given scope (`customerScope(id)`). Throws when
 * there is no key to seal with: the caller then keeps nothing rather than
 * keep it in the clear.
 */
export function sealMemberKey(memberKey: string, scope: string): string {
  if (!PAYNKOLAY_MEMBER_KEY.test(memberKey)) {
    throw new Error("card-vault: not a member key");
  }
  const current = keyring().current;
  if (!current) throw new Error("card-vault: no key to seal with");
  return sealWith(current, memberKey, scope);
}

export type OpenedMemberKey =
  /**
   * `key` is the member key ("" when nothing is stored); `reseal` says the
   * stored form should move (legacy clear text, or an older key).
   */
  | { ok: true; key: string; reseal: boolean }
  /**
   * A value is stored but no configured key opens it (key removed or
   * rotated away, row copied from elsewhere, value damaged). Callers must
   * NOT overwrite it: the configuration may come back.
   */
  | { ok: false };

/** Opens a stored value; see `OpenedMemberKey`. Never throws. */
export function openMemberKey(stored: string, scope: string): OpenedMemberKey {
  const value = stored.trim();
  if (!value) return { ok: true, key: "", reseal: false };
  const ring = keyring();
  // Written in the clear before this module (legacy): readable as is, and
  // moved to its sealed form as soon as there is a key to seal it with.
  if (PAYNKOLAY_MEMBER_KEY.test(value)) {
    return { ok: true, key: value, reseal: ring.current !== null };
  }
  const parts = value.split(".");
  if (parts.length !== 5 || parts[0] !== FORMAT) return { ok: false };
  const vk = ring.all.find((k) => k.kid === parts[1]);
  if (!vk) return { ok: false };
  try {
    const key = openWith(vk, parts, scope);
    if (!PAYNKOLAY_MEMBER_KEY.test(key)) return { ok: false };
    return { ok: true, key, reseal: vk.kid !== ring.current?.kid };
  } catch {
    return { ok: false };
  }
}

/**
 * Moves a stored value from one scope to another (a closed account's key
 * going to the purge queue) without handing the plain key to the caller.
 * Null when it does not open or there is no key to seal with.
 */
export function rebindMemberKey(
  stored: string,
  fromScope: string,
  toScope: string,
): string | null {
  const opened = openMemberKey(stored, fromScope);
  if (!opened.ok || !opened.key) return null;
  if (!cardVaultReady()) return null;
  return sealMemberKey(opened.key, toScope);
}

/** A non-reversible label for logs: which row, never which key. */
export function memberKeyFingerprint(memberKey: string): string {
  return createHash("sha256")
    .update(`laffogato-card-vault-fp|${memberKey}`)
    .digest("hex")
    .slice(0, 12);
}

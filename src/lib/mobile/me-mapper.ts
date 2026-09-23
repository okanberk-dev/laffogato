// Pure wire mappers for `/me` and `/coupons` (docs/API-MOBILE.md §4, §5).
// NO "server-only", NO DB - unit-tested directly. Every response is an
// explicit allow-list: a `customers` row carries a password hash, tokens and
// consent timestamps that must never reach the app.

import type {
  AddressInput,
  CustomerAddress,
  CustomerUsual,
  NotificationPrefs,
  PublicCustomer,
} from "@/lib/customer/store";
import {
  isCafeOnlyCoupon,
  type CustomerCoupon,
} from "@/lib/customer/coupon-utils";

import type { LoyaltyView } from "./loyalty-core";
import type { MeMilestone } from "./milestones-core";

// ─── Addresses ───────────────────────────────────────────────────────────

/** Address as the app sees it (contract §4). */
export interface MeAddress {
  id: string;
  title: string;
  fullName: string;
  phone: string;
  city: string;
  district: string;
  neighbourhood: string;
  line: string;
  note: string;
  isDefault: boolean;
}

/** Address as the app sends it (`POST /me/addresses`, `PATCH …/{id}`). */
export interface MeAddressInput {
  title: string;
  fullName: string;
  phone: string;
  city: string;
  district: string;
  neighbourhood: string;
  line: string;
  note: string;
  isDefault?: boolean;
}

/**
 * The site's address record has no neighbourhood field; the app's does. The
 * neighbourhood is folded into `line1` on write ("Postane Mah., Atatürk Cad.
 * No: 28") and split back out on read when the leading segment is recognisably
 * a mahalle. An address typed on the site without that suffix reads back with
 * an empty `neighbourhood` and the whole text in `line` - nothing is lost.
 */
const NEIGHBOURHOOD_RE = /^(.{2,60}?\b(?:Mahallesi|Mah\.|Mh\.))\s*,\s*(.+)$/iu;

export function splitNeighbourhood(line1: string): {
  neighbourhood: string;
  line: string;
} {
  const m = NEIGHBOURHOOD_RE.exec((line1 ?? "").trim());
  if (!m) return { neighbourhood: "", line: (line1 ?? "").trim() };
  return { neighbourhood: m[1].trim(), line: m[2].trim() };
}

export function joinNeighbourhood(neighbourhood: string, line: string): string {
  const hood = (neighbourhood ?? "").trim();
  const rest = (line ?? "").trim();
  if (!hood) return rest;
  if (!rest) return hood;
  return `${hood}, ${rest}`;
}

export function toMeAddress(a: CustomerAddress): MeAddress {
  const { neighbourhood, line } = splitNeighbourhood(a.line1);
  return {
    id: a.id,
    title: a.label,
    fullName: a.recipientName,
    phone: a.phone,
    city: a.city,
    district: a.district,
    neighbourhood,
    line,
    note: a.line2,
    isDefault: a.isDefault,
  };
}

export function toMeAddresses(addresses: CustomerAddress[]): MeAddress[] {
  return addresses.map(toMeAddress);
}

/** App address → the store's `AddressInput`. `zip` is not collected by the app. */
export function fromMeAddress(input: MeAddressInput): AddressInput {
  return {
    label: input.title,
    recipientName: input.fullName,
    phone: input.phone,
    line1: joinNeighbourhood(input.neighbourhood, input.line),
    line2: input.note,
    district: input.district,
    city: input.city,
    zip: "",
    isDefault: input.isDefault === true,
  };
}

// ─── /me ─────────────────────────────────────────────────────────────────

export interface InvitePerson {
  name: string;
  status: "joined" | "pending";
  at: string;
  /**
   * Did the inviter actually get a free drink for this person? False once the
   * inviter is past the reward cap - the invitee is still rewarded, so the row
   * must not promise the inviter a coupon that was never issued.
   */
  rewarded: boolean;
}

export interface InviteSummary {
  code: string;
  invited: number;
  /** People who used the code and have since made their first paid order. */
  joined: number;
  /** Free drinks this inviter actually earned - capped, so ≤ `joined`. */
  earned: number;
  people: InvitePerson[];
}

export interface MeCustomer {
  id: string;
  email: string;
  name: string;
  phone: string;
  emailVerified: boolean;
  birthday: string;
  memberSince: string;
  notificationPrefs: NotificationPrefs;
  addresses: MeAddress[];
  /**
   * Product ids the member has favourited.
   *
   * The same list the site's /uye/hesap/favorilerim renders - one wishlist per
   * member, not one per surface. It was missing from this payload, so a
   * product favourited on the web was invisible in the app and the app's own
   * "Favorilerim" had nothing to show.
   */
  wishlist: string[];
}

/** `/me.loyalty` - the view plus the road map and the perks (karar 175, additive). */
export type MeLoyalty = LoyaltyView & {
  milestones?: MeMilestone[];
  perksByTier?: Record<"verde" | "argento" | "oro", string[]>;
};

export interface MeResponse {
  customer: MeCustomer;
  loyalty: MeLoyalty;
  invite: InviteSummary;
  usual: CustomerUsual | null;
}

export function toMe(
  customer: PublicCustomer,
  loyalty: MeLoyalty,
  invite: InviteSummary,
): MeResponse {
  return {
    customer: {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      emailVerified: customer.emailVerified,
      birthday: customer.birthday,
      memberSince: customer.createdAt,
      notificationPrefs: {
        orderUpdates: !!customer.notificationPrefs.orderUpdates,
        marketing: !!customer.notificationPrefs.marketing,
        newsletter: !!customer.notificationPrefs.newsletter,
      },
      addresses: toMeAddresses(customer.addresses),
      wishlist: [...customer.wishlist],
    },
    loyalty,
    invite,
    usual: customer.usual,
  };
}

// ─── /coupons ────────────────────────────────────────────────────────────

export interface MeCoupon {
  id: string;
  code: string;
  title: string;
  body: string;
  kind: "pct" | "fixed";
  value: number;
  minSpendMinor: number;
  expiresAt: string | null;
  usedAt: string | null;
  /**
   * Spendable only on a cafe basket (loyalty and invite free-drink coupons).
   * The app has read this since the coupon screens shipped - "Yalnızca kafe
   * siparişlerinde" - but the server never sent it, so the label never showed
   * and members tried the coupon on a shop basket, where the till refused it.
   */
  cafeOnly: boolean;
}

function formatLira(minor: number): string {
  const whole = Math.floor(minor / 100);
  const frac = minor % 100;
  const grouped = whole.toLocaleString("tr-TR");
  return frac === 0
    ? `${grouped} ₺`
    : `${grouped},${String(frac).padStart(2, "0")} ₺`;
}

/** Member-facing one-liner: "%15 indirim · 200 ₺ ve üzeri". */
export function couponBody(
  c: Pick<CustomerCoupon, "kind" | "value" | "minSubtotalMinor">,
): string {
  const head =
    c.kind === "pct" ? `%${c.value} indirim` : `${formatLira(c.value)} indirim`;
  return c.minSubtotalMinor > 0
    ? `${head} · ${formatLira(c.minSubtotalMinor)} ve üzeri`
    : head;
}

export function toMeCoupon(c: CustomerCoupon): MeCoupon {
  return {
    id: c.id,
    code: c.code,
    title: c.title,
    body: couponBody(c),
    kind: c.kind,
    value: c.value,
    minSpendMinor: c.minSubtotalMinor,
    expiresAt: c.expiresAt || null,
    usedAt: c.redeemedAt || null,
    cafeOnly: isCafeOnlyCoupon(c),
  };
}

// Pure address helpers for app orders (docs/API-MOBILE.md §3). NO
// "server-only", NO database - unit-tested directly. An order stores its
// address as one block of text, the way the panel and the courier read it;
// these turn a saved or a typed address into that block.

import type { CustomerAddress } from "@/lib/customer/store";

import { joinNeighbourhood } from "./me-mapper";
import type { InlineAddressInput, OrderAddressInput } from "./order-schema";

export interface ResolvedOrderAddress {
  /** "Evim - Eda Mancuso, +90 …\nPostane Mah., Atatürk Cad. …\nTuzla / İstanbul" */
  text: string;
  /** The courier note that rode with the address (door code, floor). */
  note: string;
  /** Recipient phone, when the address carries one. */
  phone: string;
}

function headline(title: string, fullName: string, phone: string): string {
  const who = [fullName.trim(), phone.trim()].filter(Boolean).join(", ");
  const label = title.trim();
  if (label && who) return `${label} - ${who}`;
  return label || who;
}

function locality(district: string, city: string, zip = ""): string {
  const place = [district.trim(), city.trim()].filter(Boolean).join(" / ");
  return [place, zip.trim()].filter(Boolean).join(" ");
}

/** A member's saved address (the site's record) as an order address. */
export function formatSavedAddress(a: CustomerAddress): ResolvedOrderAddress {
  const lines = [
    headline(a.label, a.recipientName, a.phone),
    a.line1.trim(),
    locality(a.district, a.city, a.zip),
  ].filter(Boolean);
  return { text: lines.join("\n"), note: a.line2.trim(), phone: a.phone };
}

/** An address typed in the app's checkout as an order address. */
export function formatInlineAddress(
  a: InlineAddressInput,
): ResolvedOrderAddress {
  const lines = [
    headline(a.title, a.fullName, a.phone),
    joinNeighbourhood(a.neighbourhood, a.line),
    locality(a.district, a.city),
  ].filter(Boolean);
  return { text: lines.join("\n"), note: a.note.trim(), phone: a.phone };
}

export type ResolveAddressResult =
  | { ok: true; address: ResolvedOrderAddress | null }
  | { ok: false; message: string };

/**
 * `{ id }` must be one of the member's own saved addresses; anything else
 * is a stale address book on the phone, not a reason to guess.
 */
export function resolveOrderAddress(
  saved: CustomerAddress[],
  input: OrderAddressInput,
): ResolveAddressResult {
  if (input === null) return { ok: true, address: null };
  if ("id" in input) {
    const found = saved.find((a) => a.id === input.id);
    if (!found) {
      return {
        ok: false,
        message: "Seçilen adres bulunamadı. Adresi yeniden seç.",
      };
    }
    return { ok: true, address: formatSavedAddress(found) };
  }
  return { ok: true, address: formatInlineAddress(input) };
}

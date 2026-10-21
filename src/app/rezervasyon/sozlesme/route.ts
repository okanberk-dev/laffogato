import {
  durableCopyNotFound,
  durableCopyResponse,
  durableCopyUnavailable,
} from "@/lib/legal/durable-copy-http";
import { karaokeDurableCopy } from "@/lib/legal/durable-copy-load";
import { getReservation, paymentStatusOf } from "@/lib/mobile/karaoke";
import { karaokeLinkId } from "@/lib/mobile/karaoke-link";
import { ownsReservation } from "@/lib/mobile/karaoke-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A booking whose terms became a contract: its payment was confirmed. */
const CONTRACTED = new Set(["paid", "refunding", "refunded"]);

/**
 * `GET /rezervasyon/sozlesme?t=<signed link>` - the Karaoke Odası Ön
 * Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi this booking's customer
 * confirmed, in the version the consent recorded and filled with the
 * booking: the same file the confirmation mail attaches (ASK-DURABLE).
 *
 * The person-specific link is the key, verified exactly as the booking's
 * own page verifies it (`ownsReservation` → `verifyKaraokeLink`: an HMAC
 * over the id, the address the mail went to and the end of the booked
 * block, compared in constant time). The route checks it itself on every
 * request (CLAUDE.md rule 27). No token, a token for another booking, an
 * expired or forged one, a booking never paid, one with no stored copy:
 * one and the same 404. A database that fails while the copy is read for
 * the link's holder is a 503 (`Retry-After`), never a bare 500. Like the
 * order's download, this GET can store a text shown today that the
 * consent named but whose own store did not land (durable-copy-load.ts).
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  const id = karaokeLinkId(token);
  if (!token || !id) return durableCopyNotFound();
  const r = await getReservation(id).catch(() => null);
  if (!r || !ownsReservation({ kind: "link", token }, r)) {
    return durableCopyNotFound();
  }
  if (!CONTRACTED.has(paymentStatusOf(r))) return durableCopyNotFound();
  try {
    const copy = await karaokeDurableCopy(r);
    if (!copy) return durableCopyNotFound();
    return durableCopyResponse(copy);
  } catch (err) {
    console.error(
      `[durable-copy] karaoke=${r.id}: download failed`,
      err instanceof Error ? err.message.slice(0, 160) : "unknown",
    );
    return durableCopyUnavailable();
  }
}

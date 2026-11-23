import { NextResponse } from "next/server";

import { readPosOrdersMarker } from "@/lib/admin/change-marker";
import { rememberedRead } from "@/lib/admin/remembered-read";
import { TAG_ORDERS } from "@/lib/cache/tags";
import { chooseBranch } from "@/lib/panel/branches";
import {
  panelOrdersAnswer,
  readPanelOrders,
  type PanelOrdersAnswer,
  type PanelOrdersRead,
} from "@/lib/panel/orders-feed";
import {
  PANEL_ORDERS_VERSION,
  parsePanelClosed,
  toPanelClosed,
  type PanelClosedOrder,
} from "@/lib/panel/orders-feed-core";
import {
  signedCaller,
  signedCallerKeys,
  type SignedCaller,
} from "@/lib/panel/signed-callers";

/**
 * `GET /api/panel/orders` - the köşk's panel (ladmin.laffogato.net) reading
 * the open café orders for its bar screen, after this site pinged it
 * (orders-ping.ts) or when the screen is opened stale
 * (src/lib/panel/orders-feed-core.ts, docs/PANEL-ORDERS.md).
 *
 * Server to server, no cookie: signed with the shared `KARAOKE_SYNC_SECRET`
 * like the karaoke route (CLAUDE.md rule 7), or by LafPOS, the café's till,
 * with its own `LAFPOS_SYNC_SECRET` (signed-callers.ts, docs/LAFPOS.md; it
 * pulls when `/api/pos/orders/version` moves). Neither key set: 503. Bad,
 * missing or stale signature: 401, nothing more said. The answer is the
 * whitelisted shape of `toPanelOrder`: the lines to make with their notes,
 * where they go, the planned time, a first name and the member's note on a
 * table or gel-al order; never a surname, e-mail, phone, address, courier
 * note or payment reference. Read only: the bar screen's
 * buttons move an order through `POST /api/panel/orders/stage`.
 *
 * Beside the list, `awaitingPayment` (added 28 Eki 2026; an older reader
 * ignores it): how many café orders for the screen still wait for a
 * payment on a checkout opened in the last 30 minutes (the order's own, or
 * a reopened one). A number only, no order: the panel polls a little while
 * it is above zero, so a payment whose ping was lost still reaches the bar
 * within minutes.
 *
 * Beside them, `calls` (added 6 Kas 2026; an older reader ignores it,
 * `version` stays 1): the open table calls ("Garson çağır" from the app,
 * src/lib/admin/table-calls-core.ts), oldest first, `{id, tableCode, label,
 * reason, createdAt}` and nothing about the guest; always present, `[]`
 * when none. The bar screen answers one with `POST /api/panel/calls/ack`.
 *
 * One branch's (21 Kas 2026, src/lib/panel/branches.ts): `?branch=`, else
 * the caller's own (the panel Tuzla, LafPOS its `LAFPOS_BRANCHES`, default
 * Marina). Orders, `awaitingPayment` and `calls` are that branch's alone
 * (a table order and a call carry their table's branch; gel-al and kurye
 * are Tuzla's), and the answer says which (`branch`). Before, both keys
 * got every order: Marina's till rang and moved Tuzla's paid orders.
 *
 * A quiet bar screen is remembered for LafPOS (22 Kas 2026,
 * src/lib/admin/remembered-read.ts): its 15-minute safety pull woke the
 * database four times an hour for as long as its business day was open.
 * When the last read under the current `live:orders` marker found nothing
 * at all (no row, none awaiting payment, no call), the same empty answer
 * is given without the database until a write to `orders` or `table_calls`
 * moves the marker, with one live read an hour as the net. Every bound of
 * the read is a lower one (paid, due, opened or called since), so with no
 * write an empty read can only stay empty. A read that found anything is
 * never remembered: it changes with the clock alone. The panel's key
 * (Tuzla) reads live on every ask, as before: `awaitingPayment` can rise
 * on a reopened checkout, which writes `payment_transactions` only, and
 * the panel polls on it; LafPOS does not read it and hears of the payment
 * by its version signal.
 *
 * Three additions of 23 Kas 2026 (lafpos docs/03-ENTEGRASYON.md
 * "Sözleşme eklemeleri"; an older reader ignores them, `version` stays 1):
 * `orders[].paidAtTill` (settled at the till: its money and fiş are the
 * till's, LafPOS does not book it as paid online), `orders[].lines[].index`
 * (the line's place in `items`, so LafPOS can void the one cancelled here)
 * and `closed`: `[{id, outcome}]`, the branch's café orders that left the
 * screen in the last 48 hours and why (`completed`, `cancelled`,
 * `refunded`; orders-feed-core.ts `panelClosedOutcome`), the most recently
 * paid first, at most 200; always present, `[]` when none. Only ids and
 * outcomes: nothing about the guest, the lines or the money.
 *
 * A remembered quiet screen keeps its `closed` with it: the list changes
 * with a write to `orders` (which moves the marker) and otherwise only
 * shrinks with the clock, so a remembered one names at worst an order a
 * little past its 48 hours, which is still true.
 *
 * `src/proxy.ts` lets every `/api/*` path through untouched.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** The panel, and LafPOS with its own key. */
const CALLERS: readonly SignedCaller[] = ["panel", "lafpos"];

/** Nothing read at all: no row, none awaiting payment, no call. */
function isQuiet(live: PanelOrdersRead): boolean {
  return (
    live.awaiting === 0 && live.rows.length === 0 && live.calls.length === 0
  );
}

/** What a quiet screen keeps in memory: ids and outcomes, no guest. */
interface QuietScreen {
  quiet: true;
  closed: PanelClosedOrder[];
}

/** A quiet screen's answer, read back from memory. */
function quietAnswer(remembered: unknown): PanelOrdersAnswer {
  return {
    complete: true,
    orders: [],
    awaitingPayment: 0,
    calls: [],
    closed: parsePanelClosed((remembered as Partial<QuietScreen>)?.closed),
  };
}

export async function GET(request: Request) {
  const keys = signedCallerKeys(process.env, CALLERS);
  if (!keys) {
    return NextResponse.json(
      { error: "not_configured" },
      { status: 503, headers: NO_STORE },
    );
  }
  const url = new URL(request.url);
  const caller = signedCaller(keys, request, "GET", url, "");
  if (!caller) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }
  const choice = chooseBranch(
    process.env,
    caller,
    url.searchParams.get("branch"),
  );
  if (!choice.ok) {
    return NextResponse.json(
      { error: choice.error, field: choice.field },
      { status: choice.status, headers: NO_STORE },
    );
  }
  const { branch } = choice;

  const now = new Date();
  let answer: PanelOrdersAnswer;
  try {
    if (caller === "lafpos") {
      // The marker before the read (remembered-read.ts).
      const marker = await readPosOrdersMarker();
      const read = await rememberedRead({
        name: "panel-orders-quiet",
        scope: branch,
        marker,
        tags: [TAG_ORDERS],
        nowMs: now.getTime(),
        read: () => readPanelOrders(branch, now),
        remember: (l): QuietScreen | null =>
          isQuiet(l) ? { quiet: true, closed: toPanelClosed(l.closed) } : null,
      });
      answer =
        read.from === "database"
          ? panelOrdersAnswer(read.live, now)
          : quietAnswer(read.remembered);
    } else {
      answer = panelOrdersAnswer(await readPanelOrders(branch, now), now);
    }
  } catch (err) {
    console.error("[panel-orders] orders could not be read", err);
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }
  return NextResponse.json(
    {
      version: PANEL_ORDERS_VERSION,
      now: now.toISOString(),
      branch,
      complete: answer.complete,
      orders: answer.orders,
      awaitingPayment: answer.awaitingPayment,
      calls: answer.calls,
      closed: answer.closed,
    },
    { headers: NO_STORE },
  );
}

import { NextResponse } from "next/server";

import { listReservationsForAdmin } from "@/lib/mobile/karaoke";
import {
  PANEL_MAX_ROWS,
  parsePanelRange,
  sortForPanel,
  toPanelReservation,
  withinLafposKaraokeReach,
  type PanelKaraokeReservation,
} from "@/lib/panel/karaoke-sync-core";
import { chooseBranch, KARAOKE_BRANCH } from "@/lib/panel/branches";
import { panelAuditActor } from "@/lib/panel/menu-link-core";
import {
  signedBy,
  signedCallerKeys,
  signedKeyHeader,
  type SignedCaller,
} from "@/lib/panel/signed-callers";

/**
 * `GET /api/panel/karaoke?from=YYYY-MM-DD&to=YYYY-MM-DD` - the köşk's panel
 * (ladmin.laffogato.net) reading the karaoke bookings of a window, after
 * this site pinged it or when its board is opened stale
 * (src/lib/panel/karaoke-sync-core.ts, docs/PANEL-KARAOKE.md).
 *
 * Server to server, no cookie: the panel signs the request with the shared
 * `KARAOKE_SYNC_SECRET` (HMAC-SHA256 over the instant, method, path, query
 * and body, five minutes of clock skew at most; CLAUDE.md rule 7). LafPOS,
 * the café's till, reads the same window with its own `LAFPOS_SYNC_SECRET`
 * (signed-callers.ts, docs/LAFPOS.md), so a room booked on the site is not
 * free on the till and an hour paid online is not charged again; it pulls
 * when the `karaoke` marker of `/api/pos/orders/version` moves. Neither key
 * set: 503, the link is off; LafPOS's key unset, or the panel's value
 * pasted in as it, leaves this route the panel's alone, as before. Bad,
 * missing or stale signature: 401, with nothing more said. Both callers get
 * the same whitelisted shape of `toPanelReservation` - a first name, the
 * hour, the head count, the states, the note, the amount; never an e-mail,
 * phone, surname, consent record or payment reference.
 *
 * The panel reads any window up to 400 days, as before. LafPOS's key, which
 * sits on the café's machine, reads Istanbul yesterday to tomorrow and no
 * more (`withinLafposKaraokeReach`): a wider window, or one with no `from`,
 * is 403 `forbidden` before anything is read, the way the menu route
 * refuses LafPOS a price.
 *
 * One branch's (21 Kas 2026, src/lib/panel/branches.ts): `?branch=`, else
 * the caller's own (the panel Tuzla, LafPOS its `LAFPOS_BRANCHES`, default
 * Marina). The one karaoke room is the Tuzla köşk's (`KARAOKE_BRANCH`): a
 * caller acting for another branch gets the window with no bookings and
 * nothing is read; the answer says which branch (`branch`). Before, Marina's
 * till read Tuzla's room and rang for its bookings.
 *
 * `src/proxy.ts` lets every `/api/*` path through untouched, so this one
 * gets no session refresh and no page CSP.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** The panel, and LafPOS with its own key. */
const CALLERS: readonly SignedCaller[] = ["panel", "lafpos"];

export async function GET(request: Request) {
  const keys = signedCallerKeys(process.env, CALLERS);
  if (!keys) {
    return NextResponse.json(
      { error: "not_configured" },
      { status: 503, headers: NO_STORE },
    );
  }
  const url = new URL(request.url);
  const signer = signedBy(keys, request, "GET", url, "");
  if (!signer) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }
  const { caller } = signer;
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
  const range = parsePanelRange(url.searchParams, now);
  if (!range) {
    return NextResponse.json(
      { error: "invalid_range" },
      { status: 400, headers: NO_STORE },
    );
  }
  // The till runs today's room: a stolen café machine must not page
  // through years of first names and notes (docs/LAFPOS.md).
  if (caller === "lafpos" && !withinLafposKaraokeReach(range, now)) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403, headers: NO_STORE },
    );
  }

  // Another branch has no room: nothing to read, nothing to ring for.
  if (branch !== KARAOKE_BRANCH) {
    return NextResponse.json(
      {
        now: now.toISOString(),
        from: range.from,
        to: range.to,
        branch,
        complete: true,
        reservations: [],
      },
      { headers: { ...NO_STORE, ...signedKeyHeader(signer) } },
    );
  }

  let rows: Awaited<ReturnType<typeof listReservationsForAdmin>>;
  try {
    rows = await listReservationsForAdmin({
      from: range.from,
      to: range.to,
      // One over the cap tells a full window from a cut one; earliest
      // first, so a cut drops the far end of the window, not today.
      limit: PANEL_MAX_ROWS + 1,
      ascending: true,
    });
  } catch (err) {
    console.error("[panel-karaoke] bookings could not be read", err);
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }

  // A window past the cap is not a real case (one room, booked by the hour:
  // the panel's 90 days hold about a thousand slots); if it ever happens,
  // `complete: false` tells the panel the list was cut (at its far end: the
  // read is earliest first).
  const reservations = sortForPanel(
    rows
      .map(toPanelReservation)
      .filter((r): r is PanelKaraokeReservation => r !== null),
  ).slice(0, PANEL_MAX_ROWS);
  return NextResponse.json(
    {
      now: now.toISOString(),
      from: range.from,
      to: range.to,
      branch,
      complete: rows.length <= PANEL_MAX_ROWS,
      reservations,
    },
    { headers: { ...NO_STORE, ...signedKeyHeader(signer) } },
  );
}

/** A desk request body is a handful of short fields. */
const DESK_MAX_BODY_BYTES = 4096;

function deny(
  status: number,
  error: string,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json({ error, ...extra }, { status, headers: NO_STORE });
}

/**
 * `POST /api/panel/karaoke` - the köşk's panel (ladmin) or its till takes
 * hours on the room's calendar (operator, 22 Kas 2026: "ladmin panelinden de
 * manuel rezervasyon alınsın, oradan dolu yapılabilsin ki insanlar siteden
 * bakınca görsünler"). Signed like the GET, over the exact body.
 *
 * Body, JSON:
 * - `{"action": "create", "kind": "booking" | "block", "date": "YYYY-MM-DD",
 *   "startHour": 20, "hours": 2, "guests": 6, "name": "Ayşe", "phone": "",
 *   "email": "", "note": "", "actor": "Kasa 1"}`: a phone/counter booking
 *   (paid at the köşk) or closed hours. 201 `{reservation}` in the GET's
 *   shape; 400 `invalid` with `field` and `message`; 409 `slot_taken` or
 *   `too_many`.
 * - `{"action": "cancel", "id": "krk-00042", "actor": "..."}`: frees a desk
 *   row (`channel: "desk"`) only; a booking paid online is cancelled and
 *   refunded in this site's panel (409 `not_desk`). 200 `{ok: true}`.
 * The written hours are taken on the site, in the app and on the till at
 * once (src/lib/mobile/karaoke-desk.ts); the write pings the panel back.
 * LafPOS may only write Istanbul yesterday to tomorrow, like its reads.
 * The one room is Tuzla's: another branch gets 409 `wrong_branch`.
 */
export async function POST(request: Request) {
  const keys = signedCallerKeys(process.env, CALLERS);
  if (!keys) return deny(503, "not_configured");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > DESK_MAX_BODY_BYTES) return deny(413, "too_large");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > DESK_MAX_BODY_BYTES) {
    return deny(413, "too_large");
  }
  const url = new URL(request.url);
  const signer = signedBy(keys, request, "POST", url, body);
  if (!signer) return deny(401, "unauthorized");
  const { caller } = signer;
  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return deny(400, "invalid", { field: "body" });
    }
    raw = parsed as Record<string, unknown>;
  } catch {
    return deny(400, "invalid", { field: "body" });
  }
  const branchRaw = typeof raw.branch === "string" ? raw.branch : null;
  const choice = chooseBranch(process.env, caller, branchRaw);
  if (!choice.ok) {
    return deny(choice.status, choice.error, { field: choice.field });
  }
  if (choice.branch !== KARAOKE_BRANCH) {
    return deny(409, "wrong_branch", { branch: choice.branch });
  }
  const actorRaw = typeof raw.actor === "string" ? raw.actor.trim() : "";
  if (!actorRaw) return deny(400, "invalid", { field: "actor" });
  const actor = panelAuditActor(actorRaw, caller);
  const { cancelDeskReservation, createDeskReservation, readDeskInput } =
    await import("@/lib/mobile/karaoke-desk");

  try {
    if (raw.action === "cancel") {
      const id = typeof raw.id === "string" ? raw.id.trim() : "";
      if (!/^krk-\d{5,}$/.test(id))
        return deny(400, "invalid", { field: "id" });
      if (caller === "lafpos") {
        // The till frees only what it may read: yesterday to tomorrow.
        const { getReservation } = await import("@/lib/mobile/karaoke");
        const row = await getReservation(id);
        if (!row) return deny(404, "not_found");
        const reach = withinLafposKaraokeReach(
          { from: row.date, to: row.date },
          new Date(),
        );
        if (!reach) return deny(403, "forbidden", { field: "id" });
      }
      const res = await cancelDeskReservation(id, actor);
      if (!res.ok) {
        const status = res.error === "not_found" ? 404 : 409;
        return deny(status, res.error);
      }
      return NextResponse.json(
        { ok: true },
        { headers: { ...NO_STORE, ...signedKeyHeader(signer) } },
      );
    }
    if (raw.action !== "create")
      return deny(400, "invalid", { field: "action" });
    const input = readDeskInput(raw);
    if (caller === "lafpos") {
      const now = new Date();
      const reach = withinLafposKaraokeReach(
        { from: input.date, to: input.date },
        now,
      );
      if (!reach) return deny(403, "forbidden", { field: "date" });
    }
    const res = await createDeskReservation(input, actor);
    if (!res.ok) {
      const status = res.error === "invalid" ? 400 : 409;
      return deny(status, res.error, {
        ...(res.field ? { field: res.field } : {}),
        message: res.message,
      });
    }
    return NextResponse.json(
      { reservation: toPanelReservation(res.reservation) },
      { status: 201, headers: { ...NO_STORE, ...signedKeyHeader(signer) } },
    );
  } catch (err) {
    console.error("[panel-karaoke] desk write failed", err);
    return deny(503, "unavailable");
  }
}

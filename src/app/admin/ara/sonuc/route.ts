import { z } from "zod";

import { getAdminSession, isAdminSessionUnavailable } from "@/lib/admin/auth";
import { piiLike } from "@/lib/admin/pii-like";
import {
  parseSearch,
  searchAdmin,
  searchSectionsFor,
  type SearchGroup,
} from "@/lib/admin/search";
import { isDbUnreachable } from "@/lib/db/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** On every answer, the refusals too: a search result is never cached. */
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * `{"q":"..."}` and nothing else: a kilobyte holds the box's 80 characters
 * many times over, two-byte Turkish letters included.
 */
const MAX_BODY_BYTES = 1024;

const bodySchema = z.strictObject({ q: z.string() });

/** A section of the answer, as the palette draws it. */
export type AdminSearchRouteGroup = Omit<SearchGroup, "listHref"> & {
  /**
   * The section's own list, or null when the text looks like a person
   * (`piiLike`): the palette then offers the bare list ("Listede ara")
   * and never builds a link around what was typed.
   */
  listHref: string | null;
};

export interface AdminSearchRouteAnswer {
  groups: AdminSearchRouteGroup[];
}

/**
 * `POST /admin/ara/sonuc` with `{"q":"..."}`: the record search behind the
 * panel's palette (admin UI v2, design §4.3). The same `searchAdmin` as the
 * results page (`/admin/ara`, its Server Action), answered as JSON.
 *
 * POSTed, never `GET ?q=`: what is typed is an e-mail or a phone as often
 * as an order number, and an address keeps it in the browser's history and
 * the host's request log (CLAUDE.md rule 9). A route, not a Server Action:
 * Next runs a client's actions one at a time, so typeahead would queue
 * behind the badge polls and form posts, and an action cannot be aborted
 * when the operator types on.
 *
 * Checked here, in this order, on every request (a route handler is not
 * behind `requireRole`, and `proxy.ts` only redirects a request with no
 * signed cookie, to /admin/giris):
 * 1. same origin (Sec-Fetch-Site, or the Origin's host) else 403;
 * 2. a session, else 401 (503 when the account cannot be read);
 * 3. a role with at least one searchable section (not the cashier), else 403;
 * 4. a JSON body of at most a kilobyte, exactly `{ q: string }`, else 400;
 * 5. under two characters: no query at all, `{ groups: [] }`.
 * Then each section the role may open, LIMIT 5 (lib/admin/search.ts). A
 * database that does not answer is 503 `{ error: "unavailable" }`, never
 * "no results".
 *
 * Nothing of the body is ever logged: a failure logs its class and code
 * only, as its message can quote the query.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return answer({ error: "forbidden" }, 403);

  let session;
  try {
    session = await getAdminSession();
  } catch (err) {
    if (!isAdminSessionUnavailable(err) && !isDbUnreachable(err)) throw err;
    console.error(`[admin/ara/sonuc] oturum okunamadı: ${errorCode(err)}`);
    return answer({ error: "unavailable" }, 503);
  }
  if (!session) return answer({ error: "unauthorized" }, 401);
  if (searchSectionsFor(session.role).length === 0) {
    return answer({ error: "forbidden" }, 403);
  }

  const q = await readQuery(request);
  if (q === null) return answer({ error: "bad_request" }, 400);
  const parsed = parseSearch(q);
  if (!parsed) {
    return answer({ groups: [] } satisfies AdminSearchRouteAnswer, 200);
  }

  let groups: SearchGroup[];
  try {
    groups = await searchAdmin(parsed, session.role);
  } catch (err) {
    console.error(`[admin/ara/sonuc] arama yapılamadı: ${errorCode(err)}`);
    if (isDbUnreachable(err)) return answer({ error: "unavailable" }, 503);
    return answer({ error: "failed" }, 500);
  }
  const personal = piiLike(q);
  const body: AdminSearchRouteAnswer = {
    groups: groups.map((g) => ({
      ...g,
      listHref: personal ? null : g.listHref,
    })),
  };
  return answer(body, 200);
}

function answer(body: object, status: number): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

/**
 * Asked by the panel's own page. A current browser says where a request
 * comes from in Sec-Fetch-Site (a page's script cannot set it), and only
 * "same-origin" passes: "same-site" is another subdomain. An older browser
 * sends no Sec-Fetch-Site but does send Origin on a POST, whose host must
 * be ours. Neither header: refused.
 */
function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin";
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host.toLowerCase();
  } catch {
    // "null" (a sandboxed frame, a file) or garbage.
    return false;
  }
}

/**
 * The `q` of a JSON body of at most MAX_BODY_BYTES, or null. The size is
 * counted as the body streams in, so a body with no Content-Length (or a
 * false one) is cut off at the limit rather than read whole. A NUL is
 * refused here: Postgres would reject it as text, a 500 for a typo.
 */
async function readQuery(request: Request): Promise<string | null> {
  const type = (request.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (type !== "application/json") return null;
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return null;
  }
  if (!request.body) return null;

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    // Not UTF-8, or the client went away mid-body.
    return null;
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const body = bodySchema.safeParse(json);
  if (!body.success || body.data.q.includes("\u0000")) return null;
  return body.data.q;
}

/**
 * What the log may say about a failure: the error's class and, when it has
 * one, its code (a SQLSTATE, ECONNREFUSED). Never the message.
 */
function errorCode(err: unknown): string {
  const name =
    err instanceof Error && /^[A-Za-z]{1,40}$/.test(err.name)
      ? err.name
      : "hata";
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code)
    ? `${name} ${code}`
    : name;
}

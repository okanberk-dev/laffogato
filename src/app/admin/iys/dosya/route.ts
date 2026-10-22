import { getAdminSession } from "@/lib/admin/auth";
import { safeAudit } from "@/lib/admin/audit";
import { canAccess } from "@/lib/admin/roles";
import { iysExportCsv, iysExportFileName } from "@/lib/iys/iys-core";
import { exportIysEvents, reconcileIys } from "@/lib/iys/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * `POST /admin/iys/dosya` - "İYS dosyasını indir": every consent and refusal
 * still to register in İYS, as a CSV in İYS's own column order
 * (`type,source,recipient,status,consentDate,recipientType`), for the
 * operator to upload on İYS Web (docs/IYS.md).
 *
 * POST, not a link: it writes. The outbox is reconciled first, then every
 * pending event and every one downloaded earlier but not confirmed is put
 * into one new batch (`exported`, a new batch id) in one statement, so the
 * latest file always holds whatever is still open.
 *
 * A route handler is not behind `requireRole` (that redirects pages), and
 * `proxy.ts` only redirects page views, so this checks, on every request:
 * same origin (Sec-Fetch-Site, or the Origin's host) else 403; a session
 * else 401; the `newsletter` role (owner, manager) else 403. The file holds
 * addresses: the export is itself an audit event, with counts only.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return new Response("Bu istek kabul edilmedi.", {
      status: 403,
      headers: NO_STORE,
    });
  }
  const session = await getAdminSession();
  if (!session) {
    return new Response("Giriş gerekli.", { status: 401, headers: NO_STORE });
  }
  if (!canAccess("newsletter", session.role)) {
    return new Response("Bu sayfaya erişimin yok.", {
      status: 403,
      headers: NO_STORE,
    });
  }
  const now = new Date();
  await reconcileIys(now);
  const { exportId, events } = await exportIysEvents(now);
  if (events.length === 0) {
    return new Response("İYS'ye yüklenecek kayıt yok.", {
      status: 409,
      headers: NO_STORE,
    });
  }
  await safeAudit({
    action: "export",
    entity: "iys",
    entityId: exportId,
    actor: session.email,
    payload: {
      events: events.length,
      onay: events.filter((e) => e.status === "ONAY").length,
      ret: events.filter((e) => e.status === "RET").length,
      legacy: events.filter((e) => e.legacy).length,
    },
  });
  return new Response(iysExportCsv(events), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${iysExportFileName(exportId)}"`,
      "X-Content-Type-Options": "nosniff",
      "X-Iys-Export-Id": exportId,
      "X-Iys-Count": String(events.length),
    },
  });
}

function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin";
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host.toLowerCase();
  } catch {
    return false;
  }
}

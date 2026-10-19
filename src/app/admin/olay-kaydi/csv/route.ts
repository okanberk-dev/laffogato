import { getAdminSession } from "@/lib/admin/auth";
import { listAuditLogs, safeAudit, type AdminAuditLog } from "@/lib/admin/audit";
import { AUDIT_CSV_MAX_ROWS, auditCsv } from "@/lib/admin/audit-csv";
import { AUDIT_FILTER_FIELDS, auditFilterOf } from "@/lib/admin/audit-view";
import { parseFilters } from "@/lib/admin/list-params";
import { istanbulStamp } from "@/lib/admin/order-csv";
import { canAccess } from "@/lib/admin/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rows per read while building the file. */
const BATCH = 500;

/**
 * `GET /admin/olay-kaydi/csv?<the log's filters>` - the filtered log as a
 * CSV file, for an accountant, a lawyer or an investigation (admin audit
 * SYS-09): the same filters as the page, newest first, up to
 * AUDIT_CSV_MAX_ROWS.
 *
 * A route handler is not behind `requireRole` (that redirects pages), and
 * `proxy.ts` only redirects page views, so the session and the role are
 * checked here, on every request: the log is the owner's (`audit`), and it
 * holds panel users' and members' addresses. The export is itself an event:
 * it writes an `export` row with the filters and the row count.
 */
export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return new Response("Giriş gerekli.", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!canAccess("audit", session.role)) {
    return new Response("Bu sayfaya erişimin yok.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const values = parseFilters(
    new URL(request.url).searchParams,
    AUDIT_FILTER_FIELDS,
  );
  const filter = auditFilterOf(values);
  // Rows written while the file is read would shift the pages under it
  // (newest first): the export stops at the moment it started, and an id
  // seen twice is kept once.
  const startedAt = new Date().toISOString();
  const to = filter.to && filter.to < startedAt ? filter.to : startedAt;
  const seen = new Set<string>();
  const rows: AdminAuditLog[] = [];
  for (let offset = 0; rows.length < AUDIT_CSV_MAX_ROWS; offset += BATCH) {
    const batch = await listAuditLogs({ ...filter, to, limit: BATCH, offset });
    for (const row of batch) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
    if (batch.length < BATCH) break;
  }
  const kept = rows.slice(0, AUDIT_CSV_MAX_ROWS);
  const csv = auditCsv(kept);
  await safeAudit({
    action: "export",
    entity: "audit_log",
    actor: session.email,
    payload: { filters: values, rows: kept.length },
  });
  const day = istanbulStamp(startedAt).slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="olay-kaydi-${day}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

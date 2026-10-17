import Link from "next/link";

import { PageHeader, formatDateTime } from "@/components/admin/forms";
import { Badge, DataTable, EmptyState, FilterBar } from "@/components/admin/ui";
import {
  listAuditLogs,
  type AdminAuditLog,
  type AuditAction,
  type AuditEntity,
} from "@/lib/admin/audit";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_TONES,
  AUDIT_ENTITY_LABELS,
  AUDIT_FILTER_FIELDS,
  auditPayloadEntries,
  auditRecordHref,
  istanbulDayRange,
} from "@/lib/admin/audit-view";
import { requireRole } from "@/lib/admin/auth";
import { parseFilters, withParams } from "@/lib/admin/list-params";

export const metadata = { title: "Admin · Olay Kaydı" };
export const dynamic = "force-dynamic";

const LIMIT = 500;
const PATH = "/admin/olay-kaydi";
const MONO = { fontFamily: "var(--mono), monospace" } as const;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function RecordCell({ row }: { row: AdminAuditLog }) {
  const label = AUDIT_ENTITY_LABELS[row.entity] ?? row.entity;
  const href = row.entityId ? auditRecordHref(row.entity, row.entityId) : null;
  return (
    <div className="grid gap-0.5">
      <span className="text-[var(--admin-text)]">{label}</span>
      {row.entityId ? (
        <span className="flex flex-wrap items-baseline gap-x-2 text-xs">
          {href ? (
            <Link
              href={href}
              className="break-all text-[var(--admin-primary)] underline-offset-4 hover:underline"
              style={MONO}
            >
              {row.entityId}
            </Link>
          ) : (
            <span
              className="break-all text-[var(--admin-text-soft)]"
              style={MONO}
            >
              {row.entityId}
            </span>
          )}
          {/* The name starts with the visible word "Geçmişi", so voice
              control still finds the link. */}
          <Link
            href={withParams(
              {},
              { entity: row.entity, entityId: row.entityId },
              PATH,
            )}
            className="text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
            aria-label={`Geçmişi: ${label} ${row.entityId}, bütün olaylar`}
          >
            Geçmişi
          </Link>
        </span>
      ) : null}
    </div>
  );
}

function PayloadCell({ row }: { row: AdminAuditLog }) {
  const entries = auditPayloadEntries(row.payload);
  if (entries.length === 0) {
    return <span className="text-[var(--admin-text-mute)]">-</span>;
  }
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {entries.map((e) => (
        <div key={e.key} className="contents">
          <dt className="text-[var(--admin-text-soft)]">{e.label}</dt>
          <dd className="break-all text-[var(--admin-text)]">{e.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  await requireRole("audit");
  const sp = await searchParams;
  const filters = parseFilters(sp, AUDIT_FILTER_FIELDS);
  const range = istanbulDayRange(filters.bas, filters.bit);
  const rows = await listAuditLogs({
    actor: filters.actor,
    entity: filters.entity as AuditEntity | undefined,
    action: filters.action as AuditAction | undefined,
    entityId: filters.entityId,
    from: range.from,
    to: range.to,
    limit: LIMIT,
  });
  const filtered = Object.keys(filters).length > 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Denetim"
        title="Olay Kaydı"
        description="Admin mutasyonlarının değiştirilemez tarihçesi. Yalnız okuma - kim, neyi, ne zaman değiştirdi."
      />

      <FilterBar
        fields={[...AUDIT_FILTER_FIELDS]}
        searchParams={sp}
        pathname={PATH}
        values={filters}
      />

      <DataTable
        caption="Olay kaydı"
        rows={rows}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            title={filtered ? "Bu filtreyle olay yok." : "Henüz olay yok."}
            description={
              filtered
                ? "Filtreleri gevşet ya da Sıfırla'ya bas."
                : "Bir ürün oluştur ya da bir sipariş durumu güncelle, burada görünür."
            }
          />
        }
        columns={[
          {
            key: "at",
            header: "Zaman",
            className: "whitespace-nowrap",
            cell: (r) => (
              <span className="text-xs" style={MONO}>
                {formatDateTime(r.createdAt)}
              </span>
            ),
          },
          {
            key: "actor",
            header: "Kim",
            cell: (r) => (
              <span className="text-xs break-all" style={MONO}>
                {r.actor}
              </span>
            ),
          },
          {
            key: "action",
            header: "İşlem",
            cell: (r) => (
              <Badge tone={AUDIT_ACTION_TONES[r.action] ?? "neutral"}>
                {AUDIT_ACTION_LABELS[r.action] ?? r.action}
              </Badge>
            ),
          },
          {
            key: "record",
            header: "Kayıt",
            cell: (r) => <RecordCell row={r} />,
          },
          {
            key: "payload",
            header: "Ayrıntı",
            className: "min-w-[220px]",
            cell: (r) => <PayloadCell row={r} />,
          },
        ]}
      />
      {rows.length >= LIMIT ? (
        <p className="mt-3 text-xs text-[var(--admin-text-soft)]">
          En yeni {LIMIT} olay gösteriliyor. Daha eskisi için tarih aralığını
          daralt.
        </p>
      ) : null}
    </main>
  );
}

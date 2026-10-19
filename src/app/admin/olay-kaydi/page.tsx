import Link from "next/link";

import { PageHeader } from "@/components/admin/forms";
import {
  Badge,
  BUTTON,
  DataTable,
  EmptyState,
  FilterBar,
  NUMERIC_STYLE,
  Pagination,
} from "@/components/admin/ui";
import {
  countAuditLogs,
  listAuditLogs,
  type AdminAuditLog,
} from "@/lib/admin/audit";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_TONES,
  AUDIT_ENTITY_LABELS,
  AUDIT_FILTER_FIELDS,
  AUDIT_LOG_PAGE_SIZE,
  AUDIT_LOG_PATH,
  auditActorText,
  auditEventHref,
  auditFilterOf,
  auditPayloadEntries,
  auditRecordHref,
  auditRecordText,
  auditTime,
} from "@/lib/admin/audit-view";
import { requireRole } from "@/lib/admin/auth";
import { parseFilters, parsePage, withParams } from "@/lib/admin/list-params";

export const metadata = { title: "Admin · Olay kaydı" };
export const dynamic = "force-dynamic";

/** Fields a row shows in the list; the event's own page has the rest. */
const PREVIEW_FIELDS = 3;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function RecordCell({ row }: { row: AdminAuditLog }) {
  const label = AUDIT_ENTITY_LABELS[row.entity] ?? row.entity;
  const href = row.entityId ? auditRecordHref(row.entity, row.entityId) : null;
  const text = row.entityId ? auditRecordText(row.entity, row.entityId) : "";
  // A section name reads as words; an id keeps its code face.
  const coded = text === row.entityId.trim();
  return (
    <div className="grid min-w-0 gap-0.5">
      <span className="text-[var(--admin-text)]">{label}</span>
      {row.entityId ? (
        <span className="flex flex-wrap items-baseline gap-x-2 text-xs">
          {href ? (
            <Link
              href={href}
              className="break-all text-[var(--admin-primary)] underline-offset-4 hover:underline"
              style={coded ? NUMERIC_STYLE : undefined}
            >
              {text}
            </Link>
          ) : (
            <span
              className="break-all text-[var(--admin-text-soft)]"
              style={coded ? NUMERIC_STYLE : undefined}
            >
              {text}
            </span>
          )}
          {/* The name starts with the visible word "Geçmişi", so voice
              control still finds the link. */}
          <Link
            href={withParams(
              {},
              { entity: row.entity, entityId: row.entityId },
              AUDIT_LOG_PATH,
            )}
            className="text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
            aria-label={`Geçmişi: ${label} ${text}, bütün olaylar`}
          >
            Geçmişi
          </Link>
        </span>
      ) : null}
    </div>
  );
}

/**
 * The first few fields, each name above its value so a narrow column still
 * gives the value its whole width (SYS-11: a 219 px name left 34 px for
 * "owner, manager, cashier"). The rest is one link away.
 */
function PayloadCell({ row }: { row: AdminAuditLog }) {
  const entries = auditPayloadEntries(row.payload, row);
  if (entries.length === 0) {
    return <span className="text-[var(--admin-text-mute)]">-</span>;
  }
  const shown = entries.slice(0, PREVIEW_FIELDS);
  const more = entries.length - shown.length;
  return (
    <div className="grid min-w-0 gap-1.5 text-xs">
      <dl className="grid min-w-0 gap-1.5">
        {shown.map((e) => (
          <div key={e.key} className="min-w-0">
            <dt className="text-[var(--admin-text-soft)]">{e.label}</dt>
            <dd className="line-clamp-3 break-words text-[var(--admin-text)]">
              {e.value}
            </dd>
          </div>
        ))}
      </dl>
      {more > 0 ? (
        <Link
          href={auditEventHref(row.id)}
          className="text-[var(--admin-primary)] underline-offset-4 hover:underline"
        >
          {`+${more} alan daha`}
          <span className="sr-only">{`, olay ${row.id}`}</span>
        </Link>
      ) : null}
    </div>
  );
}

function Actor({ actor }: { actor: string }) {
  const text = auditActorText(actor);
  return (
    <span className="block truncate text-xs" title={actor}>
      {text}
    </span>
  );
}

/**
 * Olay kaydı: who changed what in the panel, and when. Paged like the other
 * lists (50 a page, the newest first); each event has its own page with the
 * full payload, and the owner can take the filtered log as a CSV.
 */
export default async function AuditLogPage({ searchParams }: PageProps) {
  await requireRole("audit");
  const sp = await searchParams;
  const filters = parseFilters(sp, AUDIT_FILTER_FIELDS);
  const filter = auditFilterOf(filters);
  const page = parsePage(sp);
  const [rows, total] = await Promise.all([
    listAuditLogs({
      ...filter,
      limit: AUDIT_LOG_PAGE_SIZE,
      offset: (page - 1) * AUDIT_LOG_PAGE_SIZE,
    }),
    countAuditLogs(filter),
  ]);
  const filtered = Object.keys(filters).length > 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Sistem"
        title="Olay kaydı"
        description="Paneldeki değişikliklerin ve sistem olaylarının kaydı: kim, neyi, ne zaman. Kayıtlar değiştirilemez ve on yıl saklanır."
        action={
          total > 0 ? (
            // A plain link: a prefetching <Link> would download the file.
            <a
              href={withParams(sp, { sayfa: null }, `${AUDIT_LOG_PATH}/csv`)}
              download
              className={BUTTON.ghost}
            >
              CSV indir
            </a>
          ) : undefined
        }
      />

      <div className="mb-4">
        <FilterBar
          fields={[...AUDIT_FILTER_FIELDS]}
          searchParams={sp}
          pathname={AUDIT_LOG_PATH}
          values={filters}
        />
      </div>

      <DataTable<AdminAuditLog>
        caption="Olay kaydı"
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => auditEventHref(r.id)}
        empty={
          total > 0 ? (
            // A page past the end (an old link, a log that was filtered).
            <EmptyState
              title="Bu sayfada olay yok."
              action={
                <Link
                  href={withParams(sp, { sayfa: null }, AUDIT_LOG_PATH)}
                  className={BUTTON.ghost}
                >
                  İlk sayfaya dön
                </Link>
              }
            />
          ) : (
            <EmptyState
              title={filtered ? "Bu filtreyle olay yok." : "Henüz olay yok."}
              description={
                filtered
                  ? "Filtreleri gevşet ya da Sıfırla'ya bas."
                  : "Bir ürün oluştur ya da bir sipariş durumu güncelle, burada görünür."
              }
            />
          )
        }
        columns={[
          {
            key: "at",
            header: "Zaman",
            className: "whitespace-nowrap",
            cell: (r) => (
              <span className="text-xs" style={NUMERIC_STYLE}>
                {auditTime(r.createdAt)}
              </span>
            ),
          },
          {
            key: "actor",
            header: "Kim",
            // Wide enough for "info@laffogato.com" on one line; a longer
            // address ends in "…" with the whole of it in the title.
            className: "w-[12rem] max-w-[12rem]",
            cell: (r) => <Actor actor={r.actor} />,
          },
          {
            key: "action",
            header: "İşlem",
            className: "whitespace-nowrap",
            cell: (r) => (
              <Badge tone={AUDIT_ACTION_TONES[r.action] ?? "neutral"}>
                {AUDIT_ACTION_LABELS[r.action] ?? r.action}
              </Badge>
            ),
          },
          {
            key: "record",
            header: "Kayıt",
            className: "min-w-[9rem]",
            cell: (r) => <RecordCell row={r} />,
          },
          {
            key: "payload",
            header: "Ayrıntı",
            className: "min-w-[14rem]",
            cell: (r) => <PayloadCell row={r} />,
          },
        ]}
        mobileCard={(r) => (
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={auditEventHref(r.id)}
                className="text-xs text-[var(--admin-text)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
                style={NUMERIC_STYLE}
              >
                {auditTime(r.createdAt)}
              </Link>
              <Badge tone={AUDIT_ACTION_TONES[r.action] ?? "neutral"}>
                {AUDIT_ACTION_LABELS[r.action] ?? r.action}
              </Badge>
            </div>
            <RecordCell row={r} />
            <Actor actor={r.actor} />
            <PayloadCell row={r} />
          </div>
        )}
      />

      {total > AUDIT_LOG_PAGE_SIZE ? (
        <Pagination
          page={page}
          pageSize={AUDIT_LOG_PAGE_SIZE}
          total={total}
          searchParams={sp}
          pathname={AUDIT_LOG_PATH}
          label="Olay kaydı sayfaları"
        />
      ) : null}
    </main>
  );
}

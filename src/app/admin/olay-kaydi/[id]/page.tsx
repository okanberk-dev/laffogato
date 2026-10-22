import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/admin/back-link";
import {
  Badge,
  KeyValueGrid,
  ListSearchButton,
  NUMERIC_STYLE,
  Section,
  type KeyValueItem,
} from "@/components/admin/ui";
import { EYEBROW, MONO_STYLE } from "@/components/admin/ui/styles";
import { getAuditLog } from "@/lib/admin/audit";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_TONES,
  AUDIT_ENTITY_LABELS,
  AUDIT_LOG_PATH,
  auditActorText,
  auditEventIdOf,
  auditPayloadEntries,
  auditRecordHref,
  auditRecordText,
  auditTime,
} from "@/lib/admin/audit-view";
import { requireRole } from "@/lib/admin/auth";
import { withParams } from "@/lib/admin/list-params";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const id = auditEventIdOf((await params).id);
  return { title: id ? `Admin · Olay ${id}` : "Admin · Olay kaydı" };
}

/**
 * One event of Olay kaydı (Filament's view page, admin audit SYS-09): the
 * time to the second, who, what, the record with links to it and to its
 * whole history, and every field of the payload unclipped. The list clips
 * a value at 300 characters and shows three fields; a legal text or a bulk
 * edit's ids are read here in full. Read only, like the log.
 */
export default async function AuditEventPage({ params }: PageProps) {
  await requireRole("audit");
  const id = auditEventIdOf((await params).id);
  const row = id ? await getAuditLog(id) : null;
  if (!row) notFound();

  const entity = AUDIT_ENTITY_LABELS[row.entity] ?? row.entity;
  const recordHref = row.entityId
    ? auditRecordHref(row.entity, row.entityId)
    : null;
  const recordText = row.entityId
    ? auditRecordText(row.entity, row.entityId)
    : "";
  const entries = auditPayloadEntries(row.payload, row, { clip: false });
  const actor = auditActorText(row.actor);

  const details: KeyValueItem[] = [
    {
      label: "Zaman",
      value: <span style={NUMERIC_STYLE}>{auditTime(row.createdAt)}</span>,
      hint: "Köşkün saatiyle (İstanbul).",
    },
    {
      label: "Kim",
      value: <span className="break-all">{actor}</span>,
      hint: actor !== row.actor ? row.actor : undefined,
    },
    {
      label: "İşlem",
      value: (
        <Badge tone={AUDIT_ACTION_TONES[row.action] ?? "neutral"}>
          {AUDIT_ACTION_LABELS[row.action] ?? row.action}
        </Badge>
      ),
    },
    {
      label: "Kayıt",
      value: (
        <span className="flex flex-col gap-1">
          <span>{entity}</span>
          {row.entityId ? (
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
              {recordHref ? (
                <Link
                  href={recordHref}
                  className="break-all text-[var(--admin-primary)] underline-offset-4 hover:underline"
                >
                  {recordText}
                </Link>
              ) : (
                <span className="break-all text-[var(--admin-text-soft)]">
                  {recordText}
                </span>
              )}
              {/* A post: a member's or a panel user's record is their
                  e-mail address, kept out of the list's address. */}
              <ListSearchButton
                href={withParams({}, { entity: row.entity }, AUDIT_LOG_PATH)}
                terms={{ entityId: row.entityId }}
                className="text-[var(--admin-text-soft)] underline-offset-4 hover:text-[var(--admin-primary)] hover:underline"
                ariaLabel={`Geçmişi: ${entity} ${recordText}, bütün olaylar`}
              >
                Geçmişi
              </ListSearchButton>
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <main className="w-full px-4 pt-5 pb-10 sm:px-5 [&>:not(header)]:max-w-4xl">
      <BackLink href={AUDIT_LOG_PATH}>Olay kaydı</BackLink>

      <header className="mb-6 flex flex-col gap-2">
        <div className={EYEBROW} style={MONO_STYLE}>
          Sistem · Olay kaydı
        </div>
        <h1 className="text-2xl font-semibold tracking-tight break-words text-[var(--admin-text)] sm:text-3xl">
          {AUDIT_ACTION_LABELS[row.action] ?? row.action} · {entity}
        </h1>
        <p
          className="text-sm text-[var(--admin-text-soft)]"
          style={NUMERIC_STYLE}
        >
          {row.id}
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <Section title="Olay">
          <KeyValueGrid items={details} />
        </Section>

        <Section
          title="Ayrıntı"
          description={
            entries.length > 0
              ? "Kaydın yazdığı her alan, kısaltılmadan."
              : undefined
          }
        >
          {entries.length > 0 ? (
            <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
              {entries.map((e) => (
                <div key={e.key} className="contents">
                  <dt className="text-[var(--admin-text-soft)]">{e.label}</dt>
                  <dd className="-mt-2 min-w-0 break-words whitespace-pre-wrap text-[var(--admin-text)] sm:mt-0">
                    {e.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-[var(--admin-text-soft)]">
              Bu olay ayrıntı yazmadı.
            </p>
          )}
          <details className="mt-6 text-sm">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-[var(--admin-text-soft)] hover:text-[var(--admin-primary)] pointer-fine:min-h-9">
              Ham kayıt (JSON)
            </summary>
            <pre
              className="mt-2 max-h-[32rem] overflow-auto rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)] p-3 text-xs break-words whitespace-pre-wrap text-[var(--admin-text)]"
              style={NUMERIC_STYLE}
            >
              {JSON.stringify(row.payload ?? {}, null, 2)}
            </pre>
          </details>
        </Section>
      </div>
    </main>
  );
}
